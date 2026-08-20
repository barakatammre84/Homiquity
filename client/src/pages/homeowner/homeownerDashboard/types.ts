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

/**
 * What the Hub's two action buttons actually did. Both endpoints derive their
 * result server-side and answer with the outcome rather than an empty 201, so
 * the surface can say "nothing changed, and here is why" instead of reporting a
 * success that did not happen. Mirrors `EquitySnapshotOutcome` and
 * `RefiOpportunityOutcome` in `server/services/lifecycleEngine.ts`.
 */
export type EquitySnapshotOutcome =
  | { created: true; pmiAlert: boolean }
  | { created: false; reason: "already-recorded-today" };

export type RefiOpportunityOutcome =
  | { created: true; currentRate: number; marketRate: number; monthlySavings: number }
  | {
      created: false;
      reason:
        | "clawback-window"
        | "no-market-rate"
        | "no-note-rate"
        | "rate-not-lower"
        | "open-alert-exists";
    };
