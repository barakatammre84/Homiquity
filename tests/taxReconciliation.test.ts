import { describe, it, expect, beforeAll } from "vitest";
import { resolveBusinessEntities } from "../server/services/borrowerEntityResolution";
import { runTieOuts, roundingTolerance } from "../server/services/taxReconciliation";
import type { PublicTaxFormInstance } from "../server/services/taxDocumentIntelligence";

/**
 * Unit tests for the P2b deterministic accuracy layer: entity resolution
 * (reconstructing the borrower's business structure from extracted forms) and
 * the cross-form tie-out engine (a tax package must reconcile against itself;
 * authority = the transcribed carry map in docs/irs-forms/README.md).
 *
 * Test data = the deterministic simulated scenario from the extraction
 * adapter, converted to the public instance shape — the same data the live
 * simulate path persists, so these tests pin the exact behavior dev/runtime
 * exhibits. Pure in-process — no HTTP server, no database.
 */

let svc: typeof import("../server/extractionService");

beforeAll(async () => {
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.EXTRACTION_SIMULATE = "true";
  svc = await import("../server/extractionService");
});

function simInstances(seed = "/objects/uploads/tieout"): PublicTaxFormInstance[] {
  const { instances } = svc.buildSimulatedTaxScenario(seed);
  return instances.map((i, idx) => ({
    logicalDocumentId: `ld-${idx}`,
    formType: i.meta.formType,
    taxYear: i.extraction.taxYear,
    entityName: i.extraction.entityName,
    k1Variant: i.meta.k1Variant ?? null,
    pageStart: i.meta.pageStart ?? null,
    pageEnd: i.meta.pageEnd ?? null,
    classificationConfidence: i.meta.confidence,
    fields: i.extraction.fields,
    warnings: i.extraction.warnings,
  }));
}

const year = new Date().getFullYear() - 1;

// ---------------------------------------------------------------------------
// Entity resolution
// ---------------------------------------------------------------------------

describe("resolveBusinessEntities", () => {
  it("reconstructs the sim scenario's three businesses", () => {
    const entities = resolveBusinessEntities(simInstances());
    expect(entities).toHaveLength(3);
    const byName = Object.fromEntries(entities.map((e) => [e.name, e]));

    const consulting = byName["Simworth Consulting"];
    expect(consulting.entityType).toBe("sole_proprietorship");
    expect(consulting.identityKey).toBe("name:simworth consulting");
    // Two tax years of Schedule Cs merge into ONE entity.
    expect(consulting.firstTaxYear).toBe(year - 1);
    expect(consulting.lastTaxYear).toBe(year);
    expect(consulting.sourceForms).toHaveLength(2);

    const trading = byName["Simworth Trading Co"];
    expect(trading.entityType).toBe("sole_proprietorship");

    const lp = byName["Simworth Ventures LP"];
    // Typed by the authoritative 1065, keyed by EIN, K-1 + 1065 merged.
    expect(lp.entityType).toBe("partnership");
    expect(lp.identityKey).toMatch(/^ein:\d{4}$/);
    expect(lp.ownershipPercent).toBe(50);
    expect(lp.sourceForms.map((f) => f.formType).sort()).toEqual([
      "business_tax_return_1065",
      "schedule_k1",
    ]);
  });

  it("types a K-1 without its parent return from the K-1 variant", () => {
    const withoutParent = simInstances().filter(
      (i) => i.formType !== "business_tax_return_1065",
    );
    const entities = resolveBusinessEntities(withoutParent);
    const lp = entities.find((e) => e.name === "Simworth Ventures LP")!;
    expect(lp.entityType).toBe("partnership");
  });

  it("merges by EIN when display names differ, and leaves a review note", () => {
    const instances = simInstances().map((i) =>
      i.formType === "schedule_k1"
        ? {
            ...i,
            entityName: "Simworth Ventures Limited Partnership",
            fields: {
              ...i.fields,
              entityName: { value: "Simworth Ventures Limited Partnership", confidence: 0.9 },
            },
          }
        : i,
    );
    const entities = resolveBusinessEntities(instances);
    const lps = entities.filter((e) => e.identityKey.startsWith("ein:"));
    expect(lps).toHaveLength(1);
    expect(lps[0].notes.some((n) => /two names/i.test(n))).toBe(true);
  });

  it("is deterministic regardless of caller instance order", () => {
    const forward = resolveBusinessEntities(simInstances());
    const reversed = resolveBusinessEntities([...simInstances()].reverse());
    expect(reversed).toEqual(forward);
  });
});

// ---------------------------------------------------------------------------
// Tie-out engine
// ---------------------------------------------------------------------------

describe("roundingTolerance", () => {
  it("is the whole-dollar rounding bound ceil(0.5·(n+1))", () => {
    expect(roundingTolerance(1)).toBe(1);
    expect(roundingTolerance(2)).toBe(2);
    expect(roundingTolerance(3)).toBe(2);
    expect(roundingTolerance(5)).toBe(3);
  });
});

describe("runTieOuts", () => {
  const find = (checks: ReturnType<typeof runTieOuts>, id: string, y = year) =>
    checks.filter((c) => c.checkId === id && c.taxYear === y);

  it("passes every evaluable check on the internally consistent sim scenario", () => {
    const checks = runTieOuts(simInstances());

    expect(find(checks, "schedule_c_to_schedule_1")[0].status).toBe("pass");
    expect(find(checks, "schedule_e_to_schedule_1")[0].status).toBe("pass");
    expect(find(checks, "schedule_1_to_1040")[0].status).toBe("pass");
    expect(find(checks, "form_1040_total_income")[0].status).toBe("pass");
    expect(find(checks, "k1_share_of_1065")[0].status).toBe("pass");
    expect(find(checks, "form_1065_internal")[0].status).toBe("pass");
    // No check may ever fire without its transcribed authority.
    for (const c of checks) expect(c.authority.length).toBeGreaterThan(0);
  });

  it("reports the missing second K-1 as not-evaluable with a document request", () => {
    const [k1Sum] = find(runTieOuts(simInstances()), "k1_sum_to_1065");
    expect(k1Sum.status).toBe("not_evaluable");
    expect(k1Sum.detail).toMatch(/only 1 K-1/i);
    expect(k1Sum.detail).toMatch(/request the missing/i);
  });

  it("flags an injected Schedule 1 misread as a variance with the exact amount", () => {
    const instances = simInstances().map((i) =>
      i.formType === "schedule_1" && i.taxYear === year
        ? {
            ...i,
            fields: {
              ...i.fields,
              businessIncomeOrLoss: {
                value: (i.fields.businessIncomeOrLoss.value as number) + 5000,
                confidence: 0.9,
              },
            },
          }
        : i,
    );
    const [check] = find(runTieOuts(instances), "schedule_c_to_schedule_1");
    expect(check.status).toBe("variance");
    expect(check.varianceAmount).toBe(5000);
    expect(check.sourceRefs.length).toBeGreaterThanOrEqual(3);
  });

  it("goes not-evaluable (never guesses) when one side of a carry is missing", () => {
    const withoutSch1 = simInstances().filter(
      (i) => !(i.formType === "schedule_1" && i.taxYear === year),
    );
    const checks = runTieOuts(withoutSch1);
    const [schC] = find(checks, "schedule_c_to_schedule_1");
    expect(schC.status).toBe("not_evaluable");
    // The 1040 still carries a Schedule 1 figure → explicit "request it".
    const [carry] = find(checks, "schedule_1_to_1040");
    expect(carry.status).toBe("not_evaluable");
    expect(carry.detail).toMatch(/no Schedule 1 was found/i);
  });

  it("marks prior-year business-only coverage honestly (no Schedule 1 in the sim's prior year)", () => {
    const checks = runTieOuts(simInstances());
    const [priorSchC] = find(checks, "schedule_c_to_schedule_1", year - 1);
    expect(priorSchC.status).toBe("not_evaluable");
    const [priorTotal] = find(checks, "form_1040_total_income", year - 1);
    expect(priorTotal.status).toBe("pass");
  });

  it("reports the year-over-year trend as info with no pass/fail judgment", () => {
    const checks = runTieOuts(simInstances());
    const yoy = checks.filter((c) => c.checkId === "yoy_business_net");
    expect(yoy).toHaveLength(1);
    expect(yoy[0].status).toBe("info");
    expect(yoy[0].entityName).toBe("Simworth Consulting");
    expect(yoy[0].detail).toMatch(/self-employment income calculator/i);
  });

  it("flags captured 1040 components exceeding total income as an impossible-state variance", () => {
    const instances = simInstances().map((i) =>
      i.formType === "tax_return_1040" && i.taxYear === year
        ? {
            ...i,
            fields: {
              ...i.fields,
              totalIncome: {
                value: (i.fields.totalIncome.value as number) - 10_000,
                confidence: 0.9,
              },
            },
          }
        : i,
    );
    // Damaging totalIncome breaks both the coverage check and the Sch-1 carry
    // consistency is unaffected; we assert the coverage check specifically.
    const [coverage] = find(runTieOuts(instances), "form_1040_total_income");
    expect(coverage.status).toBe("variance");
    expect(coverage.detail).toMatch(/EXCEEDING/);
  });

  it("is deterministic and stably ordered", () => {
    const a = runTieOuts(simInstances());
    const b = runTieOuts(simInstances());
    expect(b).toEqual(a);
    const years = a.map((c) => c.taxYear);
    expect(years).toEqual([...years].sort((x, y) => y - x));
  });
});
