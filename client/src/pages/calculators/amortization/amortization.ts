/**
 * Amortization schedule and extra-payment comparison.
 *
 * Extracted verbatim from AmortizationCalculator.tsx. Deterministic — no
 * clock, no randomness, no I/O.
 *
 * Two guards matter here and are pinned in amortization.test.ts:
 *  - a payment that never covers the monthly interest returns Infinity rather
 *    than looping forever, and the caller falls back to the scheduled term;
 *  - every loop is capped at 1200 months so a pathological input cannot hang
 *    the browser.
 */
export interface AmortizationInputs {
  loanAmount: number;
  interestRate: number;
  loanTermYears: number;
  extraMonthly: number;
}

export interface YearRow {
  year: number;
  principal: number;
  interest: number;
  balance: number;
  endingBalance: number;
}

export interface MonthRow {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface AmortizationResults {
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  payoffMonths: number;
  baselineTotalInterest: number;
  baselineMonths: number;
  interestSaved: number;
  monthsSaved: number;
  yearly: YearRow[];
  monthly: MonthRow[];
}

export const defaultInputs: AmortizationInputs = {
  loanAmount: 320000,
  interestRate: 6.5,
  loanTermYears: 30,
  extraMonthly: 0,
};

/** Standard fully-amortizing monthly principal-and-interest payment. */
export function monthlyPI(loan: number, annualRatePct: number, months: number): number {
  if (loan <= 0 || months <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return loan / months;
  return (loan * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/** Simulate a loan to payoff, returning total interest and the number of months taken. */
export function simulate(
  loan: number,
  annualRatePct: number,
  basePayment: number,
  extraMonthly: number,
): { totalInterest: number; months: number } {
  const r = annualRatePct / 100 / 12;
  let balance = loan;
  let totalInterest = 0;
  let months = 0;
  // Cap iterations so a payment that never covers interest can't loop forever.
  while (balance > 0.01 && months < 1200) {
    const interest = balance * r;
    let principal = basePayment + extraMonthly - interest;
    if (principal <= 0) {
      // Payment doesn't cover interest — loan never amortizes.
      return { totalInterest: Infinity, months: Infinity };
    }
    principal = Math.min(principal, balance);
    balance -= principal;
    totalInterest += interest;
    months += 1;
  }
  return { totalInterest, months };
}

export function calculate(inputs: AmortizationInputs): AmortizationResults {
  const { loanAmount, interestRate, loanTermYears, extraMonthly } = inputs;
  const numPayments = loanTermYears * 12;
  const monthlyRate = interestRate / 100 / 12;
  const monthlyPayment = monthlyPI(loanAmount, interestRate, numPayments);

  const baseline = simulate(loanAmount, interestRate, monthlyPayment, 0);
  const accelerated = simulate(loanAmount, interestRate, monthlyPayment, extraMonthly);

  // Build the detailed schedule using the accelerated (actual) payment stream.
  const yearly: YearRow[] = [];
  const monthly: MonthRow[] = [];
  let balance = loanAmount;
  let month = 0;
  let yearPrincipal = 0;
  let yearInterest = 0;
  const startBalanceForYear = { value: loanAmount };

  while (balance > 0.01 && month < 1200) {
    const interest = balance * monthlyRate;
    let principal = monthlyPayment + extraMonthly - interest;
    if (principal <= 0) break;
    principal = Math.min(principal, balance);
    const totalPaymentThisMonth = interest + principal;
    balance -= principal;
    month += 1;
    yearPrincipal += principal;
    yearInterest += interest;

    monthly.push({
      month,
      payment: totalPaymentThisMonth,
      principal,
      interest,
      balance: Math.max(0, balance),
    });

    if (month % 12 === 0 || balance <= 0.01) {
      yearly.push({
        year: Math.ceil(month / 12),
        principal: yearPrincipal,
        interest: yearInterest,
        balance: startBalanceForYear.value,
        endingBalance: Math.max(0, balance),
      });
      startBalanceForYear.value = Math.max(0, balance);
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }

  const payoffMonths = accelerated.months === Infinity ? numPayments : accelerated.months;
  const totalInterest = accelerated.totalInterest === Infinity ? baseline.totalInterest : accelerated.totalInterest;

  return {
    monthlyPayment,
    totalInterest,
    totalPaid: loanAmount + totalInterest,
    payoffMonths,
    baselineTotalInterest: baseline.totalInterest,
    baselineMonths: baseline.months === Infinity ? numPayments : baseline.months,
    interestSaved: Math.max(0, baseline.totalInterest - totalInterest),
    monthsSaved: Math.max(0, (baseline.months === Infinity ? numPayments : baseline.months) - payoffMonths),
    yearly,
    monthly,
  };
}

