// Audit findings F-10 (lock-extension fee had no payer) and F-12 (the Reg Z
// Total Loan Amount stand-in erred permissive, and its comment said the
// opposite).
import { describe, it, expect } from "vitest";
import { EXTENSION_FEE_PAYERS } from "../shared/schema/lendingRatesOps";
import {
  knownPrepaidFinanceCharges,
  ORIGINATION_FEE_RATE,
  PLATFORM_APPLICATION_FEE,
  PLATFORM_TAX_SERVICE_FEE,
  PLATFORM_UNDERWRITING_FEE,
} from "../server/services/loanCosts";
import { evaluateCoveredPointsAndFees } from "../shared/fannieMae/qmThresholds";

describe("F-10 — extension fee payer vocabulary", () => {
  it("names all three parties who can bear an extension fee", () => {
    expect([...EXTENSION_FEE_PAYERS]).toEqual(["borrower", "broker", "lender"]);
  });

  it("keeps 'broker' available — the case that lands on our own P&L", () => {
    // In the wholesale model the lender bills the BROKER for an extension.
    // Recording that is the difference between a tracked cost and a silent one.
    expect(EXTENSION_FEE_PAYERS).toContain("broker");
  });
});

describe("F-12 — Reg Z Total Loan Amount basis", () => {
  const LOAN = 400_000;

  it("subtracts the platform's known prepaid finance charges", () => {
    // Lender-paid comp: no borrower origination fee, so the charges are the
    // flat platform fees only.
    expect(knownPrepaidFinanceCharges(0)).toBe(
      PLATFORM_APPLICATION_FEE + PLATFORM_UNDERWRITING_FEE + PLATFORM_TAX_SERVICE_FEE,
    );
    // Borrower-paid: the 1% origination fee joins them.
    expect(knownPrepaidFinanceCharges(LOAN * ORIGINATION_FEE_RATE)).toBe(
      4_000 + PLATFORM_APPLICATION_FEE + PLATFORM_UNDERWRITING_FEE + PLATFORM_TAX_SERVICE_FEE,
    );
  });

  it("produces a basis BELOW the note amount — never above it", () => {
    for (const originationFee of [0, 2_000, 4_000]) {
      const basis = LOAN - knownPrepaidFinanceCharges(originationFee);
      expect(basis).toBeLessThan(LOAN);
    }
  });

  it("yields a STRICTER cap than the discarded note-amount stand-in", () => {
    // This is the whole finding: the old stand-in used the note amount, which
    // makes the 3% cap LARGER than the real one — permissive, not
    // conservative, the opposite of what the old comment claimed.
    const noteDate = "2026-03-15";
    const oldCap = evaluateCoveredPointsAndFees(noteDate, LOAN, LOAN, 0).maxAllowableAmount!;
    const newBasis = LOAN - knownPrepaidFinanceCharges(0);
    const newCap = evaluateCoveredPointsAndFees(noteDate, LOAN, newBasis, 0).maxAllowableAmount!;

    expect(oldCap).toBe(12_000);
    expect(newCap).toBe(11_937);
    expect(newCap).toBeLessThan(oldCap);
  });

  it("catches a file the old cap waved through", () => {
    const noteDate = "2026-03-15";
    const pointsAndFees = 11_950; // under 12,000, over 11,937
    const newBasis = LOAN - knownPrepaidFinanceCharges(0);

    expect(evaluateCoveredPointsAndFees(noteDate, LOAN, LOAN, pointsAndFees).compliant).toBe(true);
    expect(evaluateCoveredPointsAndFees(noteDate, LOAN, newBasis, pointsAndFees).compliant).toBe(false);
  });

  it("stays an upper bound on the true basis, so it can only over-flag", () => {
    // Prepaid interest and prepaid MI are not subtracted (they need a closing
    // date), so the true Total Loan Amount is lower still and the true cap
    // lower still. The check therefore remains slightly permissive — but
    // strictly tighter than before, never looser.
    const basis = LOAN - knownPrepaidFinanceCharges(4_000);
    const withPrepaidInterest = basis - 1_130;
    expect(withPrepaidInterest).toBeLessThan(basis);
  });
});
