import { Car, CreditCard, GraduationCap, Banknote, Heart, MoreHorizontal } from "lucide-react";
import type { AffordabilityEstimateInputs, AffordabilityEstimateResults } from "@/lib/affordabilityEstimate";

export interface DebtItem {
  id: string;
  type: string;
  name: string;
  monthlyPayment: number;
}

export interface AffordabilityInputs extends AffordabilityEstimateInputs {
  zipCode: string;
}

export type AffordabilityResults = AffordabilityEstimateResults;

export const defaultInputs: AffordabilityInputs = {
  annualIncome: 100000,
  monthlyDebts: 500,
  downPaymentSaved: 50000,
  creditScore: 680,
  interestRate: 6.5,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  loanTermYears: 30,
  zipCode: "",
};

export const DEBT_TYPES = [
  { value: "auto_loan", label: "Auto Loan", icon: Car },
  { value: "student_loan", label: "Student Loan", icon: GraduationCap },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "personal_loan", label: "Personal Loan", icon: Banknote },
  { value: "child_support", label: "Child Support / Alimony", icon: Heart },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

export function debtTypeIcon(type: string) {
  const found = DEBT_TYPES.find((t) => t.value === type);
  return found ? found.icon : MoreHorizontal;
}
