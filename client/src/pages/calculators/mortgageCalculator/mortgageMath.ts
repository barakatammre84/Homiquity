/**
 * Mortgage payment maths for the public /calculators/mortgage page.
 *
 * Extracted verbatim from MortgageCalculator.tsx. Deterministic — no clock, no
 * randomness, no I/O.
 *
 * MODELLING NOTES, so the numbers on screen are not read as more than they are:
 *
 *  - PMI is a flat monthly figure charged whenever the down payment is under
 *    20%. It never drops off, because this calculator has no notion of time
 *    passing; a real loan sheds PMI as the balance amortizes. The figure is
 *    therefore a snapshot of the payment today, not a schedule.
 *  - totalInterestPaid and totalCostOfLoan cover principal and interest only,
 *    over the full scheduled term. They exclude the down payment, taxes,
 *    insurance, PMI and HOA — the page labels them "Total Interest Paid" and
 *    "Total Cost of Loan" for exactly that reason.
 *  - The amortization schedule assumes no extra payments and no escrow
 *    changes.
 */

export interface MortgageInputs {
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  pmiRate: number;
}

export interface AmortizationYear {
  year: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface MortgageResults {
  loanAmount: number;
  downPayment: number;
  monthlyPrincipalInterest: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  totalMonthlyPayment: number;
  totalInterestPaid: number;
  totalCostOfLoan: number;
  amortizationSchedule: AmortizationYear[];
}

export const defaultInputs: MortgageInputs = {
  homePrice: 400000,
  downPaymentPercent: 20,
  interestRate: 6.5,
  loanTermYears: 30,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  pmiRate: 0.5,
};

/** The threshold below which PMI applies, in down-payment percent. */
export const PMI_DOWN_PAYMENT_THRESHOLD = 20;

export function calculateMortgage(inputs: MortgageInputs): MortgageResults {
  const {
    homePrice,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    pmiRate,
  } = inputs;

  const downPayment = homePrice * (downPaymentPercent / 100);
  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;

  const monthlyPrincipalInterest =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyPropertyTax = (homePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (homePrice * (insuranceRate / 100)) / 12;
  const monthlyPMI = downPaymentPercent < PMI_DOWN_PAYMENT_THRESHOLD ? (loanAmount * (pmiRate / 100)) / 12 : 0;
  const monthlyHOA = hoaMonthly;

  const totalMonthlyPayment =
    monthlyPrincipalInterest + monthlyPropertyTax + monthlyInsurance + monthlyPMI + monthlyHOA;

  const totalInterestPaid = monthlyPrincipalInterest * numPayments - loanAmount;
  const totalCostOfLoan = monthlyPrincipalInterest * numPayments;

  const amortizationSchedule: AmortizationYear[] = [];
  let balance = loanAmount;

  for (let year = 1; year <= Math.min(loanTermYears, 30); year++) {
    let yearlyPrincipal = 0;
    let yearlyInterest = 0;

    for (let month = 0; month < 12; month++) {
      if (balance <= 0) break;
      const interestPayment = balance * monthlyRate;
      const principalPayment = Math.min(monthlyPrincipalInterest - interestPayment, balance);
      yearlyPrincipal += principalPayment;
      yearlyInterest += interestPayment;
      balance -= principalPayment;
    }

    amortizationSchedule.push({
      year,
      principal: yearlyPrincipal,
      interest: yearlyInterest,
      balance: Math.max(0, balance),
    });
  }

  return {
    loanAmount,
    downPayment,
    monthlyPrincipalInterest,
    monthlyPropertyTax,
    monthlyInsurance,
    monthlyPMI,
    monthlyHOA,
    totalMonthlyPayment,
    totalInterestPaid,
    totalCostOfLoan,
    amortizationSchedule,
  };
}

export interface BreakdownSlice {
  label: string;
  value: number;
  color: string;
}

/**
 * The five payment components in display order, with zero-valued ones dropped.
 *
 * Filtering matters twice over: the legend must not list "HOA $0" as though it
 * were a charge, and the stacked bar must not emit zero-width segments.
 */
export function paymentBreakdown(results: MortgageResults): BreakdownSlice[] {
  return [
    { label: "Principal & Interest", value: results.monthlyPrincipalInterest, color: "bg-chart-1" },
    { label: "Property Tax", value: results.monthlyPropertyTax, color: "bg-chart-2" },
    { label: "Insurance", value: results.monthlyInsurance, color: "bg-chart-3" },
    { label: "PMI", value: results.monthlyPMI, color: "bg-chart-4" },
    { label: "HOA", value: results.monthlyHOA, color: "bg-chart-5" },
  ].filter((item) => item.value > 0);
}
