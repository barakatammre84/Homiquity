import { Clock, DollarSign, TrendingDown, Zap } from "lucide-react";

/**
 * Borrower transparency doctrine: this borrower surface identifies offers by
 * neutral option labels only — the wholesale lender behind each option is
 * broker-side information and never reaches this page's data shape.
 */
export interface BorrowerOffer {
  id: string;
  offerId: string;
  /** "Option A" — the borrower-facing identity of this offer. */
  optionLabel: string;
  productName: string;
  rate: number;
  apr: number;
  points: number;
  monthlyPayment: number;
  cashToClose: number;
  lockTerm: number;
  estimatedCloseTime: string;
  labels: string[];
  fees: {
    origination: number;
    underwriting: number;
    appraisal: number;
    title: number;
    other: number;
  };
  conditions: string[];
  totalCost3yr: number;
  totalCost5yr: number;
}

export interface EligibilityContext {
  isValid: boolean;
  snapshotId: string;
  loanAmount: number;
  loanType: string;
  occupancy: string;
  creditTier: string;
  lockPeriod: number;
  cocStatus: "CLEAR" | "PENDING" | "MATERIAL_CHANGE";
  lastUpdated: string;
}

export const labelConfig: Record<string, { text: string; icon: typeof DollarSign; color: string }> = {
  LOWEST_PAYMENT: { text: "Lowest Monthly Payment", icon: DollarSign, color: "bg-success-subtle text-success-subtle-foreground" },
  LOWEST_TOTAL_COST: { text: "Lowest Total Cost (5 yrs)", icon: TrendingDown, color: "bg-info-subtle text-info" },
  BEST_SHORT_TERM: { text: "Best Short-Term Option", icon: Zap, color: "bg-secondary text-primary" },
  FASTEST_CLOSE: { text: "Fastest Closing", icon: Clock, color: "bg-warning-subtle text-warning-subtle-foreground" },
};
