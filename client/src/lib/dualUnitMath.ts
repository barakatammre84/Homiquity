// Dual-unit financial display math (knowledge-base/handbook/design/DESIGN_SYSTEM.md §13; teardown §4.11).
//
// One source figure (annual), two renderings (annual + monthly) — the monthly
// column is always DERIVED here, never supplied separately, so the two units
// cannot disagree (the standard's Agreement rule). `null` means "not
// applicable" and renders as "—", never as $0: those are different facts.

export interface DualUnitRow {
  label: string;
  /** Annual amount in dollars; null = not applicable (renders "—", never $0). */
  annual: number | null;
  /** Optional testid for the rendered row. */
  testId?: string;
}

export interface DualUnitGroup {
  label: string;
  /** Optional underwriting-rule note shown with the group (plain English). */
  note?: string;
  rows: DualUnitRow[];
}

export function monthlyFromAnnual(annual: number | null): number | null {
  return annual === null ? null : annual / 12;
}

/** Sum of the applicable (non-null) annual amounts. */
export function sumAnnual(rows: readonly DualUnitRow[]): number {
  return rows.reduce((sum, row) => sum + (row.annual ?? 0), 0);
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** "$7,083" for numbers, "—" for not-applicable. Never "$0" for null. */
export function formatUsd(amount: number | null): string {
  return amount === null ? "—" : usd.format(amount);
}
