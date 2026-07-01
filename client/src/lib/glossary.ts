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
};

export function getGlossaryEntry(term: string): GlossaryEntry | undefined {
  return GLOSSARY[term];
}
