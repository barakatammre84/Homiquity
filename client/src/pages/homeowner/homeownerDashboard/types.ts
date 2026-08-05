export interface HomeownerProfile {
  id: string;
  userId: string;
  originalLoanAmount: string | null;
  currentLoanBalance: string | null;
  interestRate: string | null;
  monthlyPayment: string | null;
  propertyValue: string | null;
  purchasePrice: string | null;
  purchaseDate: string | null;
  loanCloseDate: string | null;
  propertyAddress: string | null;
  nextReviewDate: string | null;
  lastReviewDate: string | null;
}

export interface RefiAlert {
  id: string;
  homeownerProfileId: string;
  currentRate: string;
  marketRate: string;
  potentialSavingsMonthly: string | null;
  potentialSavingsLifetime: string | null;
  isActionable: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface EquitySnapshot {
  id: string;
  homeownerProfileId: string;
  snapshotDate: string;
  estimatedValue: string | null;
  loanBalance: string | null;
  equityAmount: string | null;
  equityPercent: string | null;
}
