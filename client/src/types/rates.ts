export interface MortgageRateProgram {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  termYears: number | null;
  isAdjustable: boolean | null;
  adjustmentPeriod: string | null;
  loanType: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

export interface MortgageRateWithProgram {
  id: string;
  state: string | null;
  zipcode: string | null;
  programId: string;
  rate: string;
  apr: string;
  points: string | null;
  pointsCost: string | null;
  loanAmount: string | null;
  downPaymentPercent: number | null;
  creditScoreMin: number | null;
  isActive: boolean | null;
  effectiveDate: string | null;
  program: MortgageRateProgram;
}
