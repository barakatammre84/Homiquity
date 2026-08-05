import { titleCaseFromSnake } from "@/lib/formatters";

const LABELS: Record<string, string> = {
  tax_return: "Tax Return",
  pay_stub: "Pay Stub",
  bank_statement: "Bank Statement",
  bank_statement_business: "Business Bank Statement",
  w2: "W-2 Form",
  id: "Government ID",
  government_id: "Government ID",
  homeowners_insurance: "Homeowners Insurance",
  purchase_contract: "Purchase Contract",
  gift_letter: "Gift Letter",
  profit_loss: "Profit & Loss Statement",
  business_license: "Business License",
  reserves_proof: "Proof of Reserves",
  social_security_award: "Social Security Award Letter",
  pension_statement: "Pension Statement",
  letter_of_explanation: "Letter of Explanation",
  other: "Other Document",
};

/** Fallback: humanize unknown snake_case types instead of showing raw keys. */
export function getDocumentCategoryLabel(category: string): string {
  return LABELS[category] || titleCaseFromSnake(category);
}
