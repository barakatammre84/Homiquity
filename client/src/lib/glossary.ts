// Plain-language definitions for mortgage jargon. Written for a first-time buyer
// at a 6th–8th grade reading level. Keyed by a stable slug; `label` is what shows
// on screen. Used by the TermTooltip component.

export interface GlossaryEntry {
  label: string;
  definition: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  dti: {
    label: "DTI",
    definition:
      "Debt-to-Income ratio — how much of your monthly income goes to debt payments. Lenders usually want this at or below 43%.",
  },
  ltv: {
    label: "LTV",
    definition:
      "Loan-to-Value ratio — the loan amount compared to the home's value. A lower LTV (bigger down payment) usually means a better rate.",
  },
  piti: {
    label: "PITI",
    definition:
      "Your full monthly housing payment: Principal, Interest, property Taxes, and homeowners Insurance.",
  },
  pmi: {
    label: "PMI",
    definition:
      "Private Mortgage Insurance — an added monthly cost when your down payment is under 20%. It protects the lender, not you, and can usually be removed later.",
  },
  escrow: {
    label: "escrow",
    definition:
      "An account your lender uses to collect and pay your property taxes and insurance for you, spread across your monthly payment.",
  },
  apr: {
    label: "APR",
    definition:
      "Annual Percentage Rate — the yearly cost of the loan including the interest rate plus most fees. It's the best number for comparing loans.",
  },
  points: {
    label: "points",
    definition:
      "An optional upfront fee you can pay to lower your interest rate. One point costs 1% of the loan amount.",
  },
  earnestMoney: {
    label: "earnest money",
    definition:
      "A good-faith deposit you put down when your offer is accepted, showing you're serious. It's applied toward your costs at closing.",
  },
  closingCosts: {
    label: "closing costs",
    definition:
      "One-time fees paid when the loan finalizes — things like appraisal, title, and lender fees. Often 2–5% of the loan.",
  },
  cashToClose: {
    label: "cash to close",
    definition:
      "The total money you bring on closing day: your down payment plus closing costs, minus any deposits or credits already applied.",
  },
  preApproval: {
    label: "pre-approval",
    definition:
      "A lender's conditional estimate of how much you can borrow, based on your finances. It makes your offers stronger, but is not a final loan commitment.",
  },
  underwriting: {
    label: "underwriting",
    definition:
      "The review step where the lender verifies your income, assets, and credit and decides whether to approve the loan.",
  },
  dscr: {
    label: "DSCR",
    definition:
      "Debt-Service Coverage Ratio — for investment properties, how much the property's rental income covers the loan payment. Above 1.0 means it pays for itself.",
  },
  amortization: {
    label: "amortization",
    definition:
      "How your loan is paid off over time. Early payments go mostly to interest; later ones go mostly to principal.",
  },
  rateLock: {
    label: "rate lock",
    definition:
      "Freezes your interest rate for a set window (often 30–60 days) while your loan is finalized, so market moves don't change it. Locks can expire, so timing matters.",
  },
  aus: {
    label: "AUS",
    definition:
      "Automated Underwriting System — software (like Fannie Mae's or Freddie Mac's) that gives a fast initial read on your application. A human underwriter still makes the final call.",
  },
  loanEstimate: {
    label: "Loan Estimate",
    definition:
      "A standard 3-page form you get within 3 business days of applying. It shows your estimated rate, monthly payment, and closing costs — in the same format from every lender, so you can compare.",
  },
  closingDisclosure: {
    label: "Closing Disclosure",
    definition:
      "The final version of your loan terms and costs, delivered at least 3 business days before closing. Compare it to your Loan Estimate and ask about anything that changed.",
  },
  appraisal: {
    label: "appraisal",
    definition:
      "An independent professional's estimate of the home's value. Lenders require it to confirm the home is worth what you're borrowing against.",
  },
  titleInsurance: {
    label: "title insurance",
    definition:
      "A one-time policy that protects against ownership disputes or old claims on the property — like unpaid liens from a previous owner.",
  },
  giftLetter: {
    label: "gift letter",
    definition:
      "A signed note from someone giving you money for your down payment, confirming it's a gift and not a loan you have to repay.",
  },
  reserves: {
    label: "reserves",
    definition:
      "Savings left over after closing, measured in months of housing payments. Lenders like to see you could still pay the mortgage if your income paused.",
  },
  conditions: {
    label: "conditions",
    definition:
      "Items the underwriter needs before final approval — like an updated pay stub or a letter explaining a deposit. Clearing them quickly keeps your closing on schedule.",
  },
};

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term];
}
