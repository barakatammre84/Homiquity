// Shapes served by /api/admin/mortgage-rates and
// /api/admin/mortgage-rate-programs, plus the two dialog form payloads.
// Extracted verbatim from AdminRates.tsx.

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

export interface MortgageRate {
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

export interface RateFormData {
  programId: string;
  state: string | null;
  zipcode: string | null;
  rate: string;
  apr: string;
  points: string;
  pointsCost: string;
  loanAmount: string;
  downPaymentPercent: number | string;
  creditScoreMin: number | string;
  isActive: boolean;
}

export interface ProgramFormData {
  name: string;
  slug: string;
  description: string | null;
  termYears: number | null | string;
  isAdjustable: boolean;
  adjustmentPeriod: string | null;
  loanType: string;
  displayOrder: number | string;
  isActive: boolean;
}
