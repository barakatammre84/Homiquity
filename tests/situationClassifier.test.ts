import { describe, it, expect, beforeAll } from "vitest";
import {
  classifySituation,
  situationInputsFingerprint,
  type SituationClassifierInput,
} from "../server/services/situationClassifier";
import { resolveBusinessEntities } from "../server/services/borrowerEntityResolution";
import { runTieOuts } from "../server/services/taxReconciliation";
import { situationProfileSchema } from "../shared/situationProfile";
import type { PublicTaxFormInstance } from "../server/services/taxDocumentIntelligence";

/**
 * Unit tests for the P2c situation classifier: deterministic structural
 * facts over resolved entities + tie-out results → flags, income-path
 * signals, and document requests. The classifier never judges — every
 * threshold-flavored statement defers to the cited calculators. Test data =
 * the deterministic simulated scenario (the same data the live simulate path
 * persists). Pure in-process — no HTTP server, no database.
 */

let svc: typeof import("../server/extractionService");

beforeAll(async () => {
  delete process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  process.env.EXTRACTION_SIMULATE = "true";
  svc = await import("../server/extractionService");
});

function simInstances(seed = "/objects/uploads/situation"): PublicTaxFormInstance[] {
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

function classifierInput(instances = simInstances()): SituationClassifierInput {
  return {
    instances,
    entities: resolveBusinessEntities(instances),
    checks: runTieOuts(instances),
  };
}

describe("classifySituation on the sim scenario", () => {
  // Lazy: the sim scenario needs the dynamically imported extraction service,
  // so nothing here may run at collection time.
  let cached: ReturnType<typeof classifySituation> | undefined;
  const getProfile = () => (cached ??= classifySituation(classifierInput()));

  it("produces a schema-valid profile", () => {
    expect(() => situationProfileSchema.parse(getProfile())).not.toThrow();
  });

  it("identifies the multi-entity self-employed situation", () => {
    const profile = getProfile();
    const flagIds = profile.flags.map((f) => f.id);
    void flagIds;
    expect(flagIds).toContain("self_employed");
    expect(flagIds).toContain("multi_entity_self_employed");
    expect(flagIds).toContain("k1_income_present");
    expect(flagIds).toContain("rental_income_present");
    expect(flagIds).toContain("w2_income_present");
    // Simworth Trading Co runs at a loss in the sim.
    expect(flagIds).toContain("business_loss_present");
    const loss = profile.flags.find((f) => f.id === "business_loss_present")!;
    expect(loss.evidence).toContain("Simworth Trading Co");
  });

  it("keeps judgment out: no variance flag on a clean file, calculators own thresholds", () => {
    const profile = getProfile();
    const flagIds = profile.flags.map((f) => f.id);
    void flagIds;
    expect(flagIds).not.toContain("extraction_variances_open");
    // Consulting grew YoY in the sim, so no declined flag either.
    expect(flagIds).not.toContain("business_income_declined_yoy");
    for (const f of profile.flags) {
      // Any flag touching qualification defers explicitly.
      if (["k1_income_present", "business_income_declined_yoy"].includes(f.id)) {
        expect(f.detail).toMatch(/calculator/i);
      }
    }
  });

  it("signals income paths without ever claiming eligibility", () => {
    const profile = getProfile();
    const flagIds = profile.flags.map((f) => f.id);
    void flagIds;
    const byId = Object.fromEntries(profile.incomePaths.map((p) => [p.pathId, p]));
    expect(byId.agency_wage.signal).toBe("applicable");
    expect(byId.self_employment.signal).toBe("applicable");
    expect(byId.rental.signal).toBe("applicable");
    // Non-QM paths stay candidates behind the P4 program-reference gate.
    expect(byId.dscr.signal).toBe("candidate");
    expect(byId.dscr.reason).toMatch(/PROGRAM_REFERENCE_NOT_IN_REPO/);
    expect(byId.bank_statement.signal).toBe("candidate");
    expect(byId.bank_statement.reason).toMatch(/PROGRAM_REFERENCE_NOT_IN_REPO/);
  });

  it("generates the document checklist from the file's actual gaps", () => {
    const profile = getProfile();
    const flagIds = profile.flags.map((f) => f.id);
    void flagIds;
    const ids = profile.documentRequests.map((d) => d.id);
    // Missing second K-1 (from the not-evaluable tie-out).
    expect(ids.some((i) => i.startsWith("tieout:k1_sum_to_1065"))).toBe(true);
    // Prior-year missing Schedule 1 (from the not-evaluable carry check).
    expect(ids.some((i) => i.startsWith("tieout:schedule_1_to_1040"))).toBe(true);
    // Trading Co has one year of history → prior-year request.
    const priorYearReqs = profile.documentRequests.filter((d) => d.id.startsWith("prior-year:"));
    expect(priorYearReqs.some((d) => d.entityName === "Simworth Trading Co")).toBe(true);
    // Consulting has TWO years → no prior-year request for it.
    expect(priorYearReqs.some((d) => d.entityName === "Simworth Consulting")).toBe(false);
  });

  it("summarizes the situation for the LO", () => {
    const profile = getProfile();
    const flagIds = profile.flags.map((f) => f.id);
    void flagIds;
    expect(profile.summary).toMatch(/3 business entit/);
    expect(profile.summary).toMatch(/Self-employed across 3 entities/);
    expect(profile.summary).toMatch(/Rental real estate present/);
    expect(profile.entityCount).toBe(3);
    expect(profile.taxYears.length).toBe(2);
  });
});

describe("classifySituation edge behavior", () => {
  it("flags open variances when a misread exists", () => {
    const year = new Date().getFullYear() - 1;
    const instances = simInstances().map((i) =>
      i.formType === "schedule_1" && i.taxYear === year
        ? {
            ...i,
            fields: {
              ...i.fields,
              businessIncomeOrLoss: {
                value: (i.fields.businessIncomeOrLoss.value as number) + 9000,
                confidence: 0.9,
              },
            },
          }
        : i,
    );
    const profile = classifySituation(classifierInput(instances));
    const flag = profile.flags.find((f) => f.id === "extraction_variances_open");
    expect(flag).toBeDefined();
    expect(flag!.detail).toMatch(/human must resolve/i);
  });

  it("requests the parent business return when only a K-1 is in the file", () => {
    const withoutParent = simInstances().filter((i) => i.formType !== "business_tax_return_1065");
    const profile = classifySituation(classifierInput(withoutParent));
    const req = profile.documentRequests.find((d) => d.id.startsWith("entity-return:"));
    expect(req).toBeDefined();
    expect(req!.description).toMatch(/Form 1065/);
    expect(req!.entityName).toBe("Simworth Ventures LP");
  });

  it("reports a wage-only file without SE machinery", () => {
    const wageOnly = simInstances().filter((i) => i.formType === "tax_return_1040");
    const profile = classifySituation(classifierInput(wageOnly));
    expect(profile.flags.map((f) => f.id)).toContain("w2_income_present");
    expect(profile.flags.map((f) => f.id)).not.toContain("self_employed");
    const byId = Object.fromEntries(profile.incomePaths.map((p) => [p.pathId, p]));
    expect(byId.self_employment.signal).toBe("not_indicated");
    expect(byId.dscr.signal).toBe("not_indicated");
  });
});

describe("situationInputsFingerprint", () => {
  it("is stable for identical inputs and order-insensitive", () => {
    const a = situationInputsFingerprint(classifierInput());
    const b = situationInputsFingerprint({
      ...classifierInput(),
      instances: [...simInstances()].reverse(),
    });
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(b).toBe(a);
  });

  it("changes when a field value changes", () => {
    const base = situationInputsFingerprint(classifierInput());
    const year = new Date().getFullYear() - 1;
    const mutated = simInstances().map((i) =>
      i.formType === "schedule_c" && i.entityName === "Simworth Consulting" && i.taxYear === year
        ? {
            ...i,
            fields: {
              ...i.fields,
              netProfitOrLoss: {
                value: (i.fields.netProfitOrLoss.value as number) + 1,
                confidence: 0.9,
              },
            },
          }
        : i,
    );
    expect(situationInputsFingerprint(classifierInput(mutated))).not.toBe(base);
  });
});

describe("halalNeed routing signal (UAL P7)", () => {
  it("defaults to null when the intake answer is absent (and on pre-P7 profiles)", () => {
    const profile = classifySituation(classifierInput());
    expect(profile.halalNeed).toBeNull();
  });

  it("copies the declared answer through to the profile verbatim", () => {
    expect(classifySituation({ ...classifierInput(), halalNeed: true }).halalNeed).toBe(true);
    expect(classifySituation({ ...classifierInput(), halalNeed: false }).halalNeed).toBe(false);
  });

  it("is a routing signal only — it changes no flags, paths, or document requests", () => {
    const without = classifySituation(classifierInput());
    const withNeed = classifySituation({ ...classifierInput(), halalNeed: true });
    expect(withNeed.flags).toEqual(without.flags);
    expect(withNeed.incomePaths).toEqual(without.incomePaths);
    expect(withNeed.documentRequests).toEqual(without.documentRequests);
    expect(withNeed.summary).toBe(without.summary);
  });

  it("a changed answer is a changed situation (fingerprint moves)", () => {
    const base = situationInputsFingerprint(classifierInput());
    const declared = situationInputsFingerprint({ ...classifierInput(), halalNeed: true });
    const answeredNo = situationInputsFingerprint({ ...classifierInput(), halalNeed: false });
    expect(declared).not.toBe(base);
    expect(answeredNo).not.toBe(base);
    expect(declared).not.toBe(answeredNo);
    // Explicit null must hash identically to "not asked" (pre-P7 rows re-run
    // without churning new profile rows).
    expect(situationInputsFingerprint({ ...classifierInput(), halalNeed: null })).toBe(base);
  });
});
