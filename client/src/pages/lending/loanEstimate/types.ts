/**
 * Shape of GET /api/loan-applications/:id/loan-estimate.
 *
 * The server is the sole author of every figure here: the page formats and
 * lays them out, it never derives a disclosed number. Server-formatted strings
 * (loanAmountFormatted, monthlyPIFormatted, …) are rendered as sent so the
 * disclosed presentation cannot drift from the disclosure that was generated.
 */
export interface LoanEstimateData {
  applicationId: string;
  dateIssued: string;
  expirationDate: string;
  loanTerms: {
    loanAmount: number;
    loanAmountFormatted: string;
    interestRate: number;
    interestRateFormatted: string;
    monthlyPrincipalAndInterest: number;
    monthlyPIFormatted: string;
    prepaymentPenalty: boolean;
    balloonPayment: boolean;
  };
  projectedPayments: {
    years1Through5: {
      principalAndInterest: number;
      mortgageInsurance: number;
      estimatedEscrow: number;
      estimatedTotal: number;
    };
    years6Through30?: {
      principalAndInterest: number;
      mortgageInsurance: number;
      estimatedEscrow: number;
      estimatedTotal: number;
    };
  };
  costsAtClosing: {
    estimatedClosingCosts: number;
    estimatedClosingCostsFormatted: string;
    estimatedCashToClose: number;
    estimatedCashToCloseFormatted: string;
  };
  closingCostDetails: {
    loanCosts: {
      originationCharges: { originationFee: number; points: number; applicationFee: number; underwritingFee: number; total: number; };
      servicesYouCannotShopFor: { appraisal: number; creditReport: number; floodDetermination: number; taxService: number; total: number; };
      servicesYouCanShopFor: { titleInsurance: number; titleSearch: number; surveyFee: number; pestInspection: number; total: number; };
      totalLoanCosts: number;
    };
    otherCosts: {
      taxesAndGovernmentFees: { recordingFees: number; transferTaxes: number; total: number; };
      prepaids: { homeownersInsurance: number; mortgageInsurance: number; prepaidInterest: number; propertyTaxes: number; total: number; };
      initialEscrowPaymentAtClosing: { homeownersInsurance: number; mortgageInsurance: number; propertyTaxes: number; total: number; };
      otherItems: { ownersTitleInsurance: number; total: number; };
      totalOtherCosts: number;
    };
    totalClosingCosts: number;
  };
  cashToClose: {
    totalClosingCosts: number;
    closingCostsPaidBeforeClosing: number;
    downPayment: number;
    deposit: number;
    fundsFromBorrower: number;
    sellerCredits: number;
    adjustmentsAndOtherCredits: number;
    cashToClose: number;
  };
  appraisedPropertyValue: number;
  estimatedPropertyTaxes: number;
  homeownersInsurance: number;
  comparisons: {
    inFiveYears: { totalYouWillHavePaid: number; principalPaidOff: number; };
    apr: number;
    totalInterestPercentage: number;
  };
  lenderCredits: number;
  tridCompliance: {
    disclosureProvided: boolean;
    dateProvided: string | null;
    withinThreeBusinessDays: boolean;
    applicationDate: string;
  };
}
