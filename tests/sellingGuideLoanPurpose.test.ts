/**
 * Fannie Mae Selling Guide B2-1.3-02 (Limited Cash-Out Refinance) and B2-1.3-03
 * (Cash-Out Refinance). Both route the maximum LTV, CLTV and HCLTV ratios to the
 * **Eligibility Matrix** — a companion document this repo does not hold. The
 * Selling Guide defers to that Matrix 39 times.
 *
 * The defect these pin: the funnel collects `loanPurpose` (it is driven by the
 * `?type=` entry point — see client/src/pages/lending/preApproval/entryType.ts),
 * and `CONVENTIONAL_MAX_LTV` is keyed on units × occupancy with NO purpose
 * dimension. The engine never read the purpose at all, so a cash-out file was
 * measured against the PURCHASE ceiling — approving loans above the cash-out
 * limit.
 *
 * We cannot encode the correct ratio without the Matrix, so the engine routes a
 * non-purchase file to human review. That tightens a gate instead of inventing a
 * number, which is the only direction a reading may move without its authority
 * in hand.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";

const ENGINE = fs.readFileSync("server/underwritingEngine.ts", "utf-8");
const DECISION = fs.readFileSync("server/services/decisionEngine.ts", "utf-8");

describe("B2-1.3 loan purpose reaches the engine", () => {
  it("the engine accepts a loanPurpose input", () => {
    expect(ENGINE).toMatch(/loanPurpose\?: string/);
  });

  it("the decision engine actually passes it — a field nothing populates is not a gate", () => {
    // The whole defect class: an input the engine declares but no caller fills
    // reads as handled and is not. Assert the wiring, not just the shape.
    expect(DECISION).toMatch(/loanPurpose:\s*app\.loanPurpose/);
  });
});

describe("B2-1.3 a non-purchase file must not be decisioned on purchase ceilings", () => {
  it("routes any non-purchase purpose to review", () => {
    expect(ENGINE).toMatch(/purpose !== "purchase"/);
    expect(ENGINE).toMatch(/reviewReasons\.push/);
  });

  it("cites the governing topics and names the missing authority", () => {
    // A reviewer must be able to see WHY this is a review rather than a decline,
    // and that the blocker is a document we lack, not an unimplemented rule.
    expect(ENGINE).toContain("B2-1.3-02");
    expect(ENGINE).toContain("B2-1.3-03");
    expect(ENGINE).toMatch(/Eligibility Matrix/);
  });

  it("does not invent a cash-out LTV ratio", () => {
    // The Matrix is not in the repo. Any hardcoded cash-out ceiling here would
    // be fabricated authority — the failure mode the whole conformance pass
    // exists to prevent.
    const purposeBlock = ENGINE.slice(
      ENGINE.indexOf("B2-1.3-02 / B2-1.3-03"),
      ENGINE.indexOf("Subject-property reconciliation"),
    );
    expect(purposeBlock.length).toBeGreaterThan(0);
    expect(purposeBlock).not.toMatch(/\b(80|75|70|85)\s*%/);
  });

  it("leaves a purchase file alone", () => {
    // Omitted purpose defaults to purchase, so existing purchase behavior is
    // byte-identical — this must not become a review gate on every file.
    expect(ENGINE).toMatch(/input\.loanPurpose \?\? "purchase"/);
  });
});

describe("B3-6-04 an ARM must not be qualified at its note rate", () => {
  /**
   * Found by auditing every captured column against what the decision path
   * consumes: 67 columns on loan_applications, 27 read by the engine. Eight of
   * the unread ones are the ARM block — index, margin, initial/periodic/lifetime
   * caps, adjustment frequency — which is precisely what B3-6-04 needs.
   *
   * The chain that makes it live rather than theoretical:
   *   1. URLA Section 4a offers "Adjustable Rate (ARM)";
   *   2. loan_applications.amortization_type stores it;
   *   3. derivePricing prices a 30-year fixed regardless;
   *   4. mismoValidation then DEMANDS the arm_* terms at delivery — terms
   *      nothing in the product writes.
   * So an ARM borrower was qualified at the teaser rate and could not be
   * delivered.
   */
  it("the engine accepts an amortizationType input", () => {
    expect(ENGINE).toMatch(/amortizationType\?: string/);
  });

  it("the decision engine populates it — a declared input nothing fills is not a gate", () => {
    expect(DECISION).toMatch(/amortizationType:\s*app\.amortizationType/);
  });

  it("routes an adjustable-rate file to review", () => {
    expect(ENGINE).toMatch(/amortization === "adjustable"/);
  });

  it("cites B3-6-04 and says why it cannot compute the rate", () => {
    expect(ENGINE).toContain("B3-6-04");
    // The reason must name the missing capture, not just the missing rule —
    // otherwise the next session "implements" it against absent inputs.
    expect(ENGINE).toMatch(/index, margin, caps/);
  });

  it("does not invent a qualifying rate or a cap", () => {
    const block = ENGINE.slice(
      ENGINE.indexOf("B3-6-04, Qualifying Payment Requirements"),
      ENGINE.indexOf("Subject-property reconciliation"),
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/\d+(\.\d+)?\s*%/);
  });

  it("leaves a fixed-rate file alone", () => {
    expect(ENGINE).toMatch(/input\.amortizationType \?\? "fixed"/);
  });
});
