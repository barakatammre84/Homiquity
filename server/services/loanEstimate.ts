import { storage } from "../storage";
import { calculateLLPA } from "../pricing";
import { calculateMortgageAPR } from "./apr";
import { addBusinessDays } from "./businessDays";
import { computeClosingCosts, calculatePMI, estimateMonthlyEscrow } from "./loanCosts";
import { activeFeeSchedule } from "./platformFeeSchedule";
import { resolveCompensation } from "@shared/compliance/loCompensation";
import { toActualFeeMap, type ActualFeeMap } from "@shared/compliance/feeProvenance";
import type { LoanApplication } from "@shared/schema";

export interface LoanEstimateData {
  applicationId: string;
  dateIssued: Date;
  expirationDate: Date;
  
  loanTerms: {
    loanAmount: number;
    interestRate: number;
    monthlyPrincipalAndInterest: number;
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
    estimatedCashToClose: number;
  };
  
  closingCostDetails: {
    loanCosts: {
      originationCharges: {
        /**
         * Borrower-paid origination fee. §1026.37(f)(1) requires every
         * origination charge itemized by name and amount — this line used to
         * be folded silently into `total`, so the subtotal exceeded the lines
         * above it by 1% of the loan amount and the platform's largest fee had
         * no name anywhere on the disclosure.
         */
        originationFee: number;
        points: number;
        applicationFee: number;
        underwritingFee: number;
        total: number;
      };
      servicesYouCannotShopFor: {
        appraisal: number;
        creditReport: number;
        floodDetermination: number;
        taxService: number;
        total: number;
      };
      servicesYouCanShopFor: {
        titleInsurance: number;
        titleSearch: number;
        surveyFee: number;
        pestInspection: number;
        total: number;
      };
      totalLoanCosts: number;
    };
    otherCosts: {
      taxesAndGovernmentFees: {
        recordingFees: number;
        transferTaxes: number;
        total: number;
      };
      prepaids: {
        homeownersInsurance: number;
        mortgageInsurance: number;
        prepaidInterest: number;
        propertyTaxes: number;
        total: number;
      };
      initialEscrowPaymentAtClosing: {
        homeownersInsurance: number;
        mortgageInsurance: number;
        propertyTaxes: number;
        total: number;
      };
      otherItems: {
        ownersTitleInsurance: number;
        total: number;
      };
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
    inFiveYears: {
      totalYouWillHavePaid: number;
      principalPaidOff: number;
    };
    apr: number;
    totalInterestPercentage: number;
  };
  
  lenderCredits: number;
  
  tridCompliance: {
    disclosureProvided: boolean;
    dateProvided: Date | null;
    withinThreeBusinessDays: boolean;
    /** When the 6th piece of §1026.2(a)(3) information arrived; null until then. */
    applicationDate: Date | null;
    /** 3 business days after applicationDate (§1026.19(e)(1)(iii)); null until triggered. */
    leDueDate: Date | null;
  };
}

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate === 0) return principal / termMonths;
  const monthlyRate = annualRate / 12 / 100;
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, termMonths)) / 
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function estimateClosingDate(): Date {
  const closingDate = new Date();
  closingDate.setDate(closingDate.getDate() + 30);
  return closingDate;
}

/** Days of prepaid interest at closing: the days remaining in the closing month. */
function prepaidInterestDaysFor(closingDate: Date): number {
  const daysInMonth = new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, 0).getDate();
  return daysInMonth - closingDate.getDate();
}

/**
 * Cost-ledger categories that correspond to a disclosed third-party fee. A
 * real invoice booked against the file becomes the disclosed amount.
 *
 * Only categories that map 1:1 to a single LE line are listed — "verification"
 * and "marketing" are real costs but not borrower charges, and must never
 * silently inflate a disclosure.
 */
const COST_CATEGORY_TO_FEE_ID: Record<string, string> = {
  appraisal: "appraisal",
  credit_report: "credit_report",
  flood: "flood_determination",
  title: "title_insurance",
};

/**
 * Actual third-party charges recorded for a file, keyed by fee id. Multiple
 * entries in a category sum (a supplemental appraisal invoice adds to the
 * first) and reversal-negative entries are respected, because both are part of
 * the real invoiced total. Failures degrade to "no actuals" — a ledger problem
 * must not stop a Loan Estimate from being produced.
 *
 * SIMULATED ENTRIES ARE EXCLUDED. The cost ledger records what Homiquity pays
 * a vendor; this function turns that into what the BORROWER is charged on a
 * disclosure. While an adapter is a deterministic simulation it books its
 * platform-assumption unit cost — creditPulls.ts books a soft pull at $5
 * against an estimated $75 credit-report line — and letting that through
 * replaced a disclosed fee with a made-up one. `credit_report` is a
 * zero-tolerance line (shared/compliance/feeTolerance.ts), where an
 * understatement at closing is a dollar-for-dollar cure, so the simulation
 * would have manufactured real liability. creditPulls.ts sets `simulated`
 * precisely "so they cannot leak"; honoring that flag here is what makes the
 * claim true. Only a real invoice may move a disclosed number.
 */
async function resolveActualFeesFor(applicationId: string): Promise<ActualFeeMap> {
  try {
    const entries = await storage.getLoanCostEntries(applicationId);
    const totals: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.simulated) continue;
      const feeId = COST_CATEGORY_TO_FEE_ID[entry.category];
      if (!feeId) continue;
      totals[feeId] = (totals[feeId] ?? 0) + Number(entry.amount || 0);
    }
    // A category that nets to zero or below is not a disclosable charge.
    for (const key of Object.keys(totals)) {
      if (!(totals[key] > 0)) delete totals[key];
    }
    return toActualFeeMap(
      Object.entries(totals).map(([feeId, amount]) => ({
        feeId,
        amount,
        source: "loan cost ledger",
        recordedAt: new Date().toISOString(),
      })),
    );
  } catch (err) {
    console.warn("[loanEstimate] actual-fee lookup failed; using estimates:", err);
    return {};
  }
}

/**
 * The pricing derivation SHARED by the disclosable Loan Estimate and the
 * internal payment projection: input guards, note-rate derivation (base rate
 * by product, credit-score adjustments, LLPA), P&I and MI. Extracted verbatim
 * from generateLoanEstimate — one derivation, two consumers, no drift.
 *
 * Deliberately compensation-free: nothing in here reads the §1026.36(d)(2)
 * election, because no monthly-payment input depends on how the originator is
 * paid. The election guard stays on the DISCLOSABLE path below.
 *
 * THAT IS AN INVARIANT, NOT A COINCIDENCE (F-047). computePaymentProjection's
 * whole right to skip the election guard rests on it. If you are about to price
 * lender-paid compensation into `baseRate` here — the industry-standard thing to
 * do, and the reason this needs saying — understand that it silently makes the
 * instant-decision engine compensation-dependent and bypasses the fail-closed
 * guard for a number that now depends on the election.
 *
 * Enforced by tests/paymentProjection.test.ts ("is byte-identical with no
 * election, lender-paid, and borrower-paid"). Note the parity tests in that file
 * CANNOT enforce it: they compare this function's two consumers, which both call
 * it, so a change here moves both sides equally and parity still passes. Verified
 * by mutation — a comp-bearing rate bump left all six pre-existing tests green.
 */
interface PricingDerivation {
  application: LoanApplication;
  purchasePrice: number;
  downPayment: number;
  loanAmount: number;
  ltv: number;
  isVaLoan: boolean;
  llpaResult: Awaited<ReturnType<typeof calculateLLPA>>;
  interestRate: number;
  termMonths: number;
  monthlyPandI: number;
  monthlyPMI: number;
}

async function derivePricing(applicationId: string): Promise<PricingDerivation> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const purchasePrice = Number(application.purchasePrice);
  if (!purchasePrice || purchasePrice <= 0) {
    throw new Error("Purchase price is required to generate a loan estimate");
  }
  const downPayment = Number(application.downPayment);
  if (isNaN(downPayment) || downPayment < 0) {
    throw new Error("Down payment is required to generate a loan estimate");
  }
  const loanAmount = purchasePrice - downPayment;
  if (loanAmount <= 0) {
    throw new Error("Loan amount must be positive (purchase price must exceed down payment)");
  }
  const creditScore = application.creditScore;
  if (!creditScore) {
    throw new Error("Credit score is required to generate a loan estimate");
  }
  const propertyState = application.propertyState;
  if (!propertyState) {
    throw new Error("Property state is required to generate a loan estimate");
  }

  const ltv = (loanAmount / purchasePrice) * 100;
  const isVeteran = application.isVeteran || false;
  const loanType = application.preferredLoanType || "conventional";
  // VA pricing path: veterans route to VA underwriting (see underwritingEngine),
  // so price them as VA even when preferredLoanType was never set at intake.
  const isVaLoan = isVeteran || loanType === "va";

  let baseRate = 6.875;
  if (isVaLoan) baseRate = 6.250;
  else if (loanType === "fha") baseRate = 6.500;

  if (creditScore >= 780) baseRate -= 0.25;
  else if (creditScore >= 760) baseRate -= 0.125;
  else if (creditScore < 680) baseRate += 0.375;
  else if (creditScore < 700) baseRate += 0.25;

  const propertyType = (application.propertyType || "single_family") as "single_family" | "condo" | "townhouse" | "multi_family";

  // Fannie Mae LLPAs and private MI do not apply to VA loans — VA guarantees
  // the loan (funding fee instead) and allows up to 100% LTV, which the
  // FANNIE_LLPA matrix has no band for. Price VA at its base-rate model.
  const llpaResult = isVaLoan
    ? {
        baseLLPA: 0,
        propertyTypeAdjustment: 0,
        condoAdjustment: 0,
        fthbWaiver: 0,
        totalLLPA: 0,
        pricing: { loanAmount, lLPAFeeAmount: 0, pmiAnnualRate: 0, pmiMonthlyPayment: 0 },
      }
    : await calculateLLPA(
        loanAmount,
        creditScore,
        ltv,
        propertyType,
        "primary_residence",
        application.isFirstTimeBuyer || false
      );

  baseRate += llpaResult.totalLLPA * 0.125;
  const interestRate = Math.round(baseRate * 1000) / 1000;

  const termMonths = 360;
  const monthlyPandI = calculateMonthlyPayment(loanAmount, interestRate, termMonths);
  const monthlyPMI = isVaLoan ? 0 : calculatePMI(loanAmount, purchasePrice, creditScore);

  return {
    application,
    purchasePrice,
    downPayment,
    loanAmount,
    ltv,
    isVaLoan,
    llpaResult,
    interestRate,
    termMonths,
    monthlyPandI,
    monthlyPMI,
  };
}

/**
 * INTERNAL PRICING PROJECTION — not a disclosure.
 *
 * The instant-decision engine consumes exactly one pricing number: the
 * proposed monthly PITI (P&I + MI + escrow). Every input of that number is
 * independent of the §1026.36(d)(2) compensation election — no origination
 * fee rides in a monthly payment, and the rate derivation never reads the
 * election — so this path omits the election guard that generateLoanEstimate
 * applies to the DISCLOSABLE Loan Estimate. (WF1-002: routing the engine
 * through the disclosable generator made every fresh intake undecidable,
 * because no intake path elects compensation.)
 *
 * Equally deliberately, the return shape carries ONLY the payment projection:
 * no fee lines, no closing costs, no APR — nothing disclosable that could
 * ever reach a borrower as a Loan Estimate. The numbers are byte-identical to
 * the LE's projectedPayments.years1Through5 for the same inputs (same
 * derivation, same escrow model, same rounding).
 */
export interface PaymentProjection {
  loanAmount: number;
  /** Note rate, % — the same derivation the Loan Estimate prices. */
  interestRate: number;
  monthlyPrincipalAndInterest: number;
  monthlyMortgageInsurance: number;
  monthlyEscrow: number;
  /** P&I + MI + escrow — the engine's proposed PITI. */
  estimatedMonthlyTotal: number;
}

export async function computePaymentProjection(applicationId: string): Promise<PaymentProjection> {
  const { purchasePrice, loanAmount, interestRate, monthlyPandI, monthlyPMI } =
    await derivePricing(applicationId);
  const { monthlyEscrow } = estimateMonthlyEscrow({ purchasePrice });
  return {
    loanAmount,
    interestRate,
    monthlyPrincipalAndInterest: Math.round(monthlyPandI * 100) / 100,
    monthlyMortgageInsurance: Math.round(monthlyPMI * 100) / 100,
    monthlyEscrow: Math.round(monthlyEscrow * 100) / 100,
    estimatedMonthlyTotal: Math.round((monthlyPandI + monthlyPMI + monthlyEscrow) * 100) / 100,
  };
}

export async function generateLoanEstimate(applicationId: string): Promise<LoanEstimateData> {
  const {
    application,
    purchasePrice,
    downPayment,
    loanAmount,
    ltv,
    llpaResult,
    interestRate,
    termMonths,
    monthlyPandI,
    monthlyPMI,
  } = await derivePricing(applicationId);

  // §1026.36(d)(2): the fee schedule cannot be built without knowing who pays
  // the originator — a guessed model produces either an unlawful borrower
  // charge or an understated disclosure. Fail closed. This guard binds the
  // DISCLOSABLE Loan Estimate only; the engine's payment projection above is
  // compensation-independent by construction.
  const compensation = resolveCompensation(
    application.loCompensationModel,
    application.loCompensationBps,
  );
  if (!compensation) {
    throw new Error(
      "Loan originator compensation model and rate are required to generate a loan estimate (12 CFR 1026.36(d)(2))",
    );
  }

  // Fee schedule + cost structure from the shared platform model
  // (services/loanCosts.ts) — the LO-2 scenario simulator reads the same
  // function, so a scenario's cash-to-close matches the LE for equal inputs.
  const closingDate = estimateClosingDate();
  // The ACTIVE published fee schedule, not the compiled-in baseline: fees are
  // admin-editable, and the LE is the surface that discloses them.
  const feeSchedule = await activeFeeSchedule();
  const costs = computeClosingCosts({
    purchasePrice,
    downPayment,
    loanAmount,
    interestRate,
    monthlyPMI,
    prepaidInterestDays: prepaidInterestDaysFor(closingDate),
    compensation,
    feeSchedule,
    noteDate: closingDate,
    // Real quotes for this file replace the unverified national estimates
    // (F-9). Derived from the cost ledger: an appraisal invoice already booked
    // against the file is the actual charge, so disclose it rather than the
    // $650 working figure and remove the cure instead of measuring it.
    actualFees: await resolveActualFeesFor(applicationId),
    lenderCredits: llpaResult.fthbWaiver > 0 ? llpaResult.fthbWaiver * loanAmount / 100 : 0,
  });
  const {
    originationFee, points, applicationFee, underwritingFee,
    appraisalFee, creditReportFee, floodDeterminationFee, taxServiceFee,
    titleInsurance, titleSearch, surveyFee, pestInspectionFee,
    recordingFees, transferTaxes, ownersTitleInsurance,
    annualPropertyTax, annualHomeownersInsurance, monthlyEscrow,
    prepaidInterest, prepaidHomeownersInsurance, prepaidMortgageInsurance, prepaidPropertyTaxes,
    escrowHomeownersInsurance, escrowMortgageInsurance, escrowPropertyTaxes,
    loanCostsTotal, otherCostsTotal, totalClosingCosts, lenderCredits, cashToClose,
  } = costs;

  const monthlyTotal = monthlyPandI + monthlyPMI + monthlyEscrow;

  const totalPaidIn5Years = (monthlyTotal * 60) + totalClosingCosts;
  
  let principalPaidOff = 0;
  let balance = loanAmount;
  const monthlyRate = interestRate / 12 / 100;
  for (let i = 0; i < 60; i++) {
    const interestPayment = balance * monthlyRate;
    const principalPayment = monthlyPandI - interestPayment;
    balance -= principalPayment;
    principalPaidOff += principalPayment;
  }
  
  const totalInterest = (monthlyPandI * termMonths) - loanAmount;
  const totalInterestPercentage = (totalInterest / loanAmount) * 100;
  
  // Actuarial APR (§1026.22 / Appendix J): solve the payment stream against
  // the amount financed. Prepaid finance charges per §1026.4 come from the
  // shared cost model (services/loanCosts.ts).
  const apr = calculateMortgageAPR({
    loanAmount,
    noteRatePct: interestRate,
    termMonths,
    monthlyMI: monthlyPMI,
    propertyValue: purchasePrice,
    prepaidFinanceCharges: costs.prepaidFinanceCharges,
  });

  // TRID timing (§1026.19(e)(1)(iii)): the clock anchors to tridTriggeredAt —
  // the moment the 6th piece of application information arrived (written by
  // services/trid.ts) — and runs in business days, never calendar days.
  const tridTriggeredAt = application.tridTriggeredAt ? new Date(application.tridTriggeredAt) : null;
  const leDueDate = tridTriggeredAt ? addBusinessDays(tridTriggeredAt, 3) : null;
  const leIssuedDate = application.leIssuedDate ? new Date(`${application.leIssuedDate}T00:00:00Z`) : null;

  const now = new Date();
  const complianceCheckDate = leIssuedDate ?? now;
  const endOfDueDay = leDueDate ? new Date(leDueDate) : null;
  if (endOfDueDay) endOfDueDay.setUTCHours(23, 59, 59, 999);
  const dateIssued = now;
  const expirationDate = new Date(now);
  expirationDate.setDate(expirationDate.getDate() + 10);
  
  return {
    applicationId,
    dateIssued,
    expirationDate,
    
    loanTerms: {
      loanAmount,
      interestRate,
      monthlyPrincipalAndInterest: Math.round(monthlyPandI * 100) / 100,
      prepaymentPenalty: false,
      balloonPayment: false,
    },
    
    projectedPayments: {
      years1Through5: {
        principalAndInterest: Math.round(monthlyPandI * 100) / 100,
        mortgageInsurance: Math.round(monthlyPMI * 100) / 100,
        estimatedEscrow: Math.round(monthlyEscrow * 100) / 100,
        estimatedTotal: Math.round(monthlyTotal * 100) / 100,
      },
      years6Through30: ltv > 78 ? undefined : {
        principalAndInterest: Math.round(monthlyPandI * 100) / 100,
        mortgageInsurance: 0,
        estimatedEscrow: Math.round(monthlyEscrow * 100) / 100,
        estimatedTotal: Math.round((monthlyPandI + monthlyEscrow) * 100) / 100,
      },
    },
    
    costsAtClosing: {
      estimatedClosingCosts: Math.round(totalClosingCosts),
      estimatedCashToClose: Math.round(cashToClose),
    },
    
    closingCostDetails: {
      loanCosts: {
        originationCharges: {
          originationFee: Math.round(originationFee),
          points: Math.round(points),
          applicationFee: Math.round(applicationFee),
          underwritingFee: Math.round(underwritingFee),
          total: Math.round(originationFee + points + applicationFee + underwritingFee),
        },
        servicesYouCannotShopFor: {
          appraisal: Math.round(appraisalFee),
          creditReport: Math.round(creditReportFee),
          floodDetermination: Math.round(floodDeterminationFee),
          taxService: Math.round(taxServiceFee),
          total: Math.round(appraisalFee + creditReportFee + floodDeterminationFee + taxServiceFee),
        },
        servicesYouCanShopFor: {
          titleInsurance: Math.round(titleInsurance),
          titleSearch: Math.round(titleSearch),
          surveyFee: Math.round(surveyFee),
          pestInspection: Math.round(pestInspectionFee),
          total: Math.round(titleInsurance + titleSearch + surveyFee + pestInspectionFee),
        },
        totalLoanCosts: Math.round(loanCostsTotal),
      },
      otherCosts: {
        taxesAndGovernmentFees: {
          recordingFees: Math.round(recordingFees),
          transferTaxes: Math.round(transferTaxes),
          total: Math.round(recordingFees + transferTaxes),
        },
        prepaids: {
          homeownersInsurance: Math.round(prepaidHomeownersInsurance),
          mortgageInsurance: Math.round(prepaidMortgageInsurance),
          prepaidInterest: Math.round(prepaidInterest),
          propertyTaxes: Math.round(prepaidPropertyTaxes),
          total: Math.round(prepaidHomeownersInsurance + prepaidMortgageInsurance + prepaidInterest + prepaidPropertyTaxes),
        },
        initialEscrowPaymentAtClosing: {
          homeownersInsurance: Math.round(escrowHomeownersInsurance),
          mortgageInsurance: Math.round(escrowMortgageInsurance),
          propertyTaxes: Math.round(escrowPropertyTaxes),
          total: Math.round(escrowHomeownersInsurance + escrowMortgageInsurance + escrowPropertyTaxes),
        },
        otherItems: {
          ownersTitleInsurance: Math.round(ownersTitleInsurance),
          total: Math.round(ownersTitleInsurance),
        },
        totalOtherCosts: Math.round(otherCostsTotal),
      },
      totalClosingCosts: Math.round(totalClosingCosts),
    },
    
    cashToClose: {
      totalClosingCosts: Math.round(totalClosingCosts),
      closingCostsPaidBeforeClosing: 0,
      downPayment: Math.round(downPayment),
      deposit: 0,
      fundsFromBorrower: Math.round(downPayment + totalClosingCosts),
      sellerCredits: 0,
      adjustmentsAndOtherCredits: Math.round(lenderCredits),
      cashToClose: Math.round(cashToClose),
    },
    
    appraisedPropertyValue: purchasePrice,
    estimatedPropertyTaxes: Math.round(annualPropertyTax),
    homeownersInsurance: Math.round(annualHomeownersInsurance),
    
    comparisons: {
      inFiveYears: {
        totalYouWillHavePaid: Math.round(totalPaidIn5Years),
        principalPaidOff: Math.round(principalPaidOff),
      },
      apr: Math.round(apr * 1000) / 1000,
      totalInterestPercentage: Math.round(totalInterestPercentage * 10) / 10,
    },
    
    lenderCredits: Math.round(lenderCredits),
    
    tridCompliance: {
      disclosureProvided: !!leIssuedDate,
      dateProvided: leIssuedDate,
      withinThreeBusinessDays: endOfDueDay ? complianceCheckDate.getTime() <= endOfDueDay.getTime() : true,
      applicationDate: tridTriggeredAt,
      leDueDate,
    },
  };
}

export function formatLoanEstimateForDisplay(le: LoanEstimateData) {
  return {
    ...le,
    loanTerms: {
      ...le.loanTerms,
      loanAmountFormatted: `$${le.loanTerms.loanAmount.toLocaleString()}`,
      interestRateFormatted: `${le.loanTerms.interestRate}%`,
      monthlyPIFormatted: `$${le.loanTerms.monthlyPrincipalAndInterest.toLocaleString()}`,
    },
    costsAtClosing: {
      ...le.costsAtClosing,
      estimatedClosingCostsFormatted: `$${le.costsAtClosing.estimatedClosingCosts.toLocaleString()}`,
      estimatedCashToCloseFormatted: `$${le.costsAtClosing.estimatedCashToClose.toLocaleString()}`,
    },
  };
}
