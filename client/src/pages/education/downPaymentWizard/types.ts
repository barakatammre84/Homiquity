export interface DpaProgram {
  id: string;
  name: string;
  programType: string;
  state: string | null;
  description: string;
  assistanceType: string;
  maxAssistanceAmount: string | null;
  maxAssistancePercent: string | null;
  minCreditScore: number | null;
  maxIncome: string | null;
  maxHomePrice: string | null;
  firstTimeBuyerOnly: boolean;
  eligibilityNotes: string | null;
  applicationUrl: string | null;
  isActive: boolean;
}

export interface WizardFilters {
  state: string;
  firstTimeBuyer: string;
  minCreditScore: string;
}

/** Defaults to Illinois — the directory's actual coverage — not "all". */
export const defaultFilters = (): WizardFilters => ({
  state: "IL",
  firstTimeBuyer: "all",
  minCreditScore: "",
});

export const clearedFilters = (): WizardFilters => ({
  state: "all",
  firstTimeBuyer: "all",
  minCreditScore: "",
});
