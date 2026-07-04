import { describe, it, expect } from "vitest";
import {
  evaluateLoanDeliveryEdits,
  type LoanDeliveryDataset,
} from "../shared/fannieMae/loanDeliveryEdits";

// ---------------------------------------------------------------------------
// Edit IDs and firing conditions transcribed from docs/fannie-mae/:
//  - QM Edits Job Aid 2026 Update (C-series, UCD 3015…3311, 3670…3673)
//  - UCD Phase 3 job aids (discount points/lender credits, escrows, prepaids)
//  - UCD Phase 4 LPQIRP job aid (3674/4675)
//  - EarlyCheck ULAD workbook MISMO 3.4 tab (144/1700)
// ---------------------------------------------------------------------------

/** A conventional first-lien fixed-rate loan that passes every local edit. */
function cleanDataset(overrides: Partial<LoanDeliveryDataset> = {}): LoanDeliveryDataset {
  return {
    noteDate: "2026-03-15",
    originalLoanAmount: 400_000,
    mortgageType: "Conventional",
    lienPriorityType: "FirstLien",
    amortizationType: "Fixed",
    noteRatePercent: 6.5,
    aprPercent: 6.75,
    averagePrimeOfferRatePercent: 6.4,
    currentRateSetDate: "2026-03-01",
    regulationZTotalLoanAmount: 395_000,
    regulationZTotalPointsAndFeesAmount: 6_000,
    regulationZTotalAffiliateFeesAmount: 0,
    abilityToRepayMethodType: "General",
    regulationZExcludedBonaFideDiscountPointsIndicator: false,
    loanPriceQuoteInterestRatePercent: 6.75,
    discountPoints: {
      feeTotalPercent: 0.25,
      feePaidToType: "Lender",
      actualPaymentAmount: 1_000,
      feePaymentPaidByType: "Buyer",
    },
    lenderCredits: { amount: -500, toleranceCureAmount: 0 },
    escrowItems: [
      {
        escrowItemType: "HomeownersInsurance",
        escrowMonthlyPaymentAmount: 120,
        escrowItemActualPaymentAmount: 360,
        feePaidToType: "InsuranceCompany",
      },
    ],
    prepaidItems: [
      {
        prepaidItemType: "PrepaidInterest",
        prepaidItemActualPaymentAmount: 850,
        prepaidItemPaidByType: "Buyer",
        feePaidToType: "Lender",
      },
    ],
    mortgageFunderFullName: "Homiquity Lending LLC",
    specialFeatureCodes: ["127"],
    ...overrides,
  };
}

const fatalIds = (d: LoanDeliveryDataset) => evaluateLoanDeliveryEdits(d).fatal.map(f => f.editId);
const warningIds = (d: LoanDeliveryDataset) => evaluateLoanDeliveryEdits(d).warnings.map(f => f.editId);

describe("clean dataset", () => {
  it("produces no fatal edits and is deliverable", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset());
    expect(result.fatal).toEqual([]);
    expect(result.deliverable).toBe(true);
  });
});

describe("UCD Phase 1 QM data-presence edits", () => {
  it("3015: APR required and > 0", () => {
    expect(fatalIds(cleanDataset({ aprPercent: undefined }))).toContain("3015");
    expect(fatalIds(cleanDataset({ aprPercent: 0 }))).toContain("3015");
  });

  it("3026: ATR method type must be General or Exempt", () => {
    expect(fatalIds(cleanDataset({ abilityToRepayMethodType: undefined }))).toContain("3026");
    expect(fatalIds(cleanDataset({ abilityToRepayMethodType: "QualifiedMortgage" }))).toContain("3026");
  });

  it("3027: APOR required and > 0", () => {
    expect(fatalIds(cleanDataset({ averagePrimeOfferRatePercent: 0 }))).toContain("3027");
  });

  it("3029/3030: Reg Z total loan amount and rate-set date required", () => {
    expect(fatalIds(cleanDataset({ regulationZTotalLoanAmount: undefined }))).toContain("3029");
    expect(fatalIds(cleanDataset({ currentRateSetDate: undefined }))).toContain("3030");
  });

  it("3122: exemption reason required for exempt loans", () => {
    const ids = fatalIds(cleanDataset({ abilityToRepayMethodType: "Exempt" }));
    expect(ids).toContain("3122");
    const ok = fatalIds(cleanDataset({
      abilityToRepayMethodType: "Exempt",
      abilityToRepayExemptionReasonType: "PropertyUsage",
    }));
    expect(ok).not.toContain("3122");
  });

  it("3128 fatal when P&F missing/negative; 3317 warning when $0", () => {
    expect(fatalIds(cleanDataset({ regulationZTotalPointsAndFeesAmount: -1 }))).toContain("3128");
    expect(warningIds(cleanDataset({ regulationZTotalPointsAndFeesAmount: 0 }))).toContain("3317");
  });

  it("3311: affiliate fees amount required (>= 0 allowed)", () => {
    expect(fatalIds(cleanDataset({ regulationZTotalAffiliateFeesAmount: undefined }))).toContain("3311");
    expect(fatalIds(cleanDataset({ regulationZTotalAffiliateFeesAmount: 0 }))).not.toContain("3311");
  });

  it("warns when Reg Z total loan amount exceeds the original loan amount", () => {
    expect(warningIds(cleanDataset({ regulationZTotalLoanAmount: 400_001 }))).toContain("QM-NOTE-1");
  });
});

describe("bona fide discount points chain (3125/3126/3123, Phase 4 3674/4675)", () => {
  it("3125: indicator required when discount points > 0", () => {
    const ids = fatalIds(cleanDataset({ regulationZExcludedBonaFideDiscountPointsIndicator: undefined }));
    expect(ids).toContain("3125");
  });

  it("3123/3126: LPQIRP and excluded percent required when indicator is true", () => {
    const ids = fatalIds(cleanDataset({
      regulationZExcludedBonaFideDiscountPointsIndicator: true,
      loanPriceQuoteInterestRatePercent: undefined,
      regulationZExcludedBonaFideDiscountPointsPercent: undefined,
    }));
    expect(ids).toContain("3123");
    expect(ids).toContain("3126");
  });

  it("4675: LPQIRP must exceed the note rate when indicator is true", () => {
    const ids = fatalIds(cleanDataset({
      regulationZExcludedBonaFideDiscountPointsIndicator: true,
      regulationZExcludedBonaFideDiscountPointsPercent: 0.25,
      loanPriceQuoteInterestRatePercent: 6.5, // equal to note rate → fails
    }));
    expect(ids).toContain("4675");
  });

  it("3674: LPQIRP required whenever discount points percent is non-zero", () => {
    const ids = fatalIds(cleanDataset({ loanPriceQuoteInterestRatePercent: undefined }));
    expect(ids).toContain("3674");
  });
});

describe("short-reset ARM edits (3670–3673, C93)", () => {
  it("3670: ARM requires first rate change months count", () => {
    const ids = fatalIds(cleanDataset({ amortizationType: "AdjustableRate" }));
    expect(ids).toContain("3670");
  });

  it("3671 + C93: short-reset ARM requires the short-reset APR", () => {
    const ids = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 36,
    }));
    expect(ids).toContain("3671");
    expect(ids).toContain("C93");
  });

  it("3672/3673: short-reset APR must be positive", () => {
    const zero = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 36,
      qualifiedMortgageShortResetArmAprPercent: 0,
    }));
    expect(zero).toContain("3672");
    const negative = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 36,
      qualifiedMortgageShortResetArmAprPercent: -1,
    }));
    expect(negative).toContain("3673");
  });

  it("a 5/6 ARM (first change at 60 months) is short-reset; 61 months is not", () => {
    const at60 = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 60,
    }));
    expect(at60).toContain("3671");
    const at61 = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 61,
    }));
    expect(at61).not.toContain("3671");
  });
});

describe("Loan Delivery QM C-series edits", () => {
  it("C87/C88: covered points-and-fees over the tier cap", () => {
    const ids = fatalIds(cleanDataset({ regulationZTotalPointsAndFeesAmount: 12_000 })); // 3% of 395k = 11,850
    expect(ids).toContain("C87/C88");
  });

  it("C85: covered fixed-rate APR spread over the tier limit", () => {
    const ids = fatalIds(cleanDataset({ aprPercent: 8.7 })); // spread 2.30 > 2.25
    expect(ids).toContain("C85");
  });

  it("C94: same failure on an ARM maps to the ARM edit", () => {
    const ids = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 84, // not short-reset
      aprPercent: 8.7,
    }));
    expect(ids).toContain("C94");
  });

  it("C90: short-reset ARM spread uses the short-reset APR", () => {
    const ids = fatalIds(cleanDataset({
      amortizationType: "AdjustableRate",
      firstRateChangeMonthsCount: 36,
      qualifiedMortgageShortResetArmAprPercent: 8.7,
    }));
    expect(ids).toContain("C90");
  });

  it("C86: manufactured-home fixed-rate spread edit", () => {
    const ids = fatalIds(cleanDataset({ manufacturedHome: true, aprPercent: 8.7 }));
    expect(ids).toContain("C86");
  });

  it("C47/C52: exempt-loan caps", () => {
    const pf = fatalIds(cleanDataset({
      abilityToRepayMethodType: "Exempt",
      abilityToRepayExemptionReasonType: "PropertyUsage",
      regulationZTotalPointsAndFeesAmount: 20_000, // > 5% of 395k
    }));
    expect(pf).toContain("C47");

    const spread = fatalIds(cleanDataset({
      abilityToRepayMethodType: "Exempt",
      abilityToRepayExemptionReasonType: "PropertyUsage",
      aprPercent: 12.9, // spread exactly 6.5 → "6.5% or more" fails
    }));
    expect(spread).toContain("C52");
  });

  it("skips C-series (does not pass or fail) when the note date is missing", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset({ noteDate: undefined }));
    expect(result.fatal.map(f => f.editId)).not.toContain("C85");
    expect(result.notEvaluated.some(n => n.editId === "C47-C99")).toBe(true);
  });

  it("skips C-series for note years with no local threshold table", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset({ noteDate: "2023-06-01" }));
    expect(result.notEvaluated.some(n => n.editId === "C47-C99" && n.reason.includes("manual review"))).toBe(true);
  });
});

describe("UCD Phase 3 critical edits: discount points and lender credits", () => {
  it("3542: the LoanDiscountPoints fee line is required even at $0", () => {
    expect(fatalIds(cleanDataset({ discountPoints: null }))).toContain("3542");
  });

  it("3505: at most one LoanDiscountPoints occurrence", () => {
    expect(fatalIds(cleanDataset({ discountPointsOccurrenceCount: 2 }))).toContain("3505");
  });

  it("3506: Fee Actual Payment Amount required even when $0", () => {
    const ids = fatalIds(cleanDataset({
      discountPoints: { feeTotalPercent: 0.25, feePaidToType: "Lender", feePaymentPaidByType: "Buyer" },
    }));
    expect(ids).toContain("3506");
  });

  it("non-zero discount points require the full FEE component set", () => {
    const ids = fatalIds(cleanDataset({
      discountPoints: { actualPaymentAmount: 1_000 },
    }));
    expect(ids).toContain("P3-DISCOUNT-COMPONENTS");
  });

  it("a $0 discount points line needs no further components", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset({
      discountPoints: { actualPaymentAmount: 0, feeTotalPercent: 0 },
    }));
    expect(result.fatal.map(f => f.editId)).not.toContain("P3-DISCOUNT-COMPONENTS");
  });

  it("3603/3656: lender credits line required; cure amount required when non-zero", () => {
    expect(fatalIds(cleanDataset({ lenderCredits: null }))).toContain("3603");
    expect(fatalIds(cleanDataset({ lenderCredits: { amount: -500 } }))).toContain("3656");
    expect(fatalIds(cleanDataset({ lenderCredits: { amount: 0 } }))).not.toContain("3656");
  });
});

describe("UCD Phase 3 critical edits: escrows and prepaids", () => {
  it("3638/3640/3642: escrow item component data", () => {
    const ids = fatalIds(cleanDataset({ escrowItems: [{}] }));
    expect(ids).toContain("3638");
    expect(ids).toContain("3640");
    expect(ids).toContain("3642");
  });

  it("3636: escrow Fee Paid To Type of Other requires the description", () => {
    const ids = fatalIds(cleanDataset({
      escrowItems: [{
        escrowItemType: "PropertyTaxes",
        escrowMonthlyPaymentAmount: 200,
        escrowItemActualPaymentAmount: 600,
        feePaidToType: "Other",
      }],
    }));
    expect(ids).toContain("3636");
  });

  it("3587: a PrepaidInterest item is required even at $0", () => {
    expect(fatalIds(cleanDataset({ prepaidItems: [] }))).toContain("3587");
  });

  it("3627/3629/3596: prepaid item component data", () => {
    const ids = fatalIds(cleanDataset({
      prepaidItems: [
        { prepaidItemType: "PrepaidInterest", prepaidItemActualPaymentAmount: 850, feePaidToType: "Lender" },
        {},
      ],
    }));
    expect(ids).toContain("3627");
    expect(ids).toContain("3629");
    expect(ids).toContain("3596");
  });

  it("prepaid interest at $0 may omit Fee Paid To Type", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset({
      prepaidItems: [{ prepaidItemType: "PrepaidInterest", prepaidItemActualPaymentAmount: 0 }],
    }));
    expect(result.fatal.map(f => f.editId)).not.toContain("3594");
  });
});

describe("EarlyCheck MISMO 3.4 investor edits", () => {
  it("1700: mortgage funder name required", () => {
    expect(fatalIds(cleanDataset({ mortgageFunderFullName: undefined }))).toContain("1700");
  });

  it("144: funder name format — length, alphabetic, not numeric, not a date", () => {
    expect(fatalIds(cleanDataset({ mortgageFunderFullName: "AB" }))).toContain("144");
    expect(fatalIds(cleanDataset({ mortgageFunderFullName: "12345" }))).toContain("144");
    expect(fatalIds(cleanDataset({ mortgageFunderFullName: "2026-01-01" }))).toContain("144");
    expect(fatalIds(cleanDataset({ mortgageFunderFullName: "Homiquity Lending LLC" }))).not.toContain("144");
  });
});

describe("honest gating for uncaptured containers", () => {
  it("reports fee containers as notEvaluated (not fatal) before closing data exists", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset({
      discountPoints: undefined,
      lenderCredits: undefined,
      escrowItems: undefined,
      prepaidItems: undefined,
    }));
    const fatalSet = result.fatal.map(f => f.editId);
    expect(fatalSet).not.toContain("3542");
    expect(fatalSet).not.toContain("3603");
    expect(fatalSet).not.toContain("3587");
    expect(result.notEvaluated.length).toBeGreaterThanOrEqual(4);
  });
});

describe("SFC set validation surfaces through the edit result", () => {
  it("conjunction failures are fatal SFC findings", () => {
    const result = evaluateLoanDeliveryEdits(cleanDataset({ specialFeatureCodes: ["177"] }));
    expect(result.fatal.some(f => f.source === "SFC" && f.message.includes("630"))).toBe(true);
  });
});
