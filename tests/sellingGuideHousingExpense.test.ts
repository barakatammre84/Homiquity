/**
 * Fannie Mae Selling Guide B3-6-03, Monthly Housing Expense for the Subject
 * Property (12/16/2020). Quotes are verbatim from the committed edition at
 * docs/fannie-mae/selling-guide/.
 *
 * "Monthly housing expense is the sum of the following and is referred to as
 * PITIA for the subject property: principal and interest (P&I); property, flood,
 * and mortgage insurance premiums (as applicable); real estate taxes; ground
 * rent; special assessments; any owners' association dues ...; any monthly co-op
 * corporation fee ...; any subordinate financing payments on mortgages secured
 * by the subject property."
 *
 * The defect these pin: PITIA was P&I + MI + escrow, and escrow is property tax
 * plus homeowner's insurance only. Association dues were absent from the
 * decision path entirely — routinely $300-800/month on a condo, understating the
 * DTI in the direction that approves files the ratio would decline.
 */
import { describe, expect, it } from "vitest";
import { isAssociationBearingPropertyType } from "../server/services/loanEstimate";

describe("B3-6-03 association-bearing property types", () => {
  // A null on these is "not captured", not zero — zero is a claim that the
  // property has no association, which is not plausible for a condo or co-op.
  it("treats condo, co-op, PUD and townhouse as association-bearing", () => {
    for (const t of ["condo", "condominium", "co_op", "coop", "cooperative", "pud", "townhouse", "townhome"]) {
      expect(isAssociationBearingPropertyType(t), t).toBe(true);
    }
  });

  it("tolerates the spelling variants intake actually produces", () => {
    for (const t of ["Condo", "CONDO", "co-op", "Co-Op", "Town House", "town-house"]) {
      expect(isAssociationBearingPropertyType(t), t).toBe(true);
    }
  });

  it("does not treat detached single-family as association-bearing", () => {
    // A detached SFR may still have an HOA, but zero is a plausible default
    // there. Gapping every SFR file would be noise, not rigor.
    for (const t of ["single_family", "manufactured", "multi_family", null, undefined, ""]) {
      expect(isAssociationBearingPropertyType(t as string | null | undefined), String(t)).toBe(false);
    }
  });
});

describe("B3-6-03 schema carries the dues as decision input", () => {
  it("urla_property_info has a monthly_association_dues column", async () => {
    const { urlaPropertyInfo } = await import("@shared/schema");
    expect(
      Object.keys(urlaPropertyInfo),
      "PITIA needs the dues on the SUBJECT property row, not on loan_options (a display/offer row)",
    ).toContain("monthlyAssociationDues");
  });

  // Zero would be a fabricated claim on every existing row. The whole point of
  // the column is to stop assuming the figure.
  it("does not default the dues to zero", async () => {
    const fs = await import("node:fs");
    const sql = fs.readFileSync("migrations/0057_subject_property_association_dues.sql", "utf-8");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS");
    expect(sql).not.toMatch(/monthly_association_dues[^;]*DEFAULT/i);
    expect(sql).not.toMatch(/monthly_association_dues[^;]*NOT NULL/i);
  });
});

describe("B3-6-03 the qualifying PITIA must never be decisioned as undefined", () => {
  /**
   * Found by a mock, not by design. Pointing the decision engine at
   * `qualifyingPitia` made an older fixture return a projection without it —
   * and nothing blew up. The undefined propagated through the DTI and reserve
   * math and emerged as a decision reporting ZERO months of reserves on a file
   * holding $2.05M in assets. A decision computed on nothing, rendered as a
   * decision computed on something.
   *
   * The guard converts that into an immediate throw. This test pins the guard
   * rather than the arithmetic, because the arithmetic is exactly what failed
   * to notice.
   */
  it("refuses to fall back to the Loan Estimate figure", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("server/services/decisionEngine.ts", "utf-8"),
    );
    // A fallback would silently resurrect the dues-omission defect: the LE
    // figure is the one that EXCLUDES association dues.
    expect(src).not.toMatch(/qualifyingPitia\s*\?\?\s*.*estimatedMonthlyTotal/);
    expect(src).toContain("qualifyingPitia");
  });

  it("throws rather than decisioning when the qualifying figure is missing", async () => {
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("server/services/decisionEngine.ts", "utf-8"),
    );
    expect(src).toMatch(/Number\.isFinite\(projection\.qualifyingPitia\)/);
    expect(src).toMatch(/CRITICAL DECISIONING ERROR: qualifying PITIA/);
  });
});
