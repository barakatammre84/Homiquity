// =============================================================================
// MARKET DATA PARSERS (pure functions — no I/O, no db)
//
// Shared by the HMDA competitor ingester and the Fannie Mae loan-performance
// ingester. Kept side-effect free so the parsing/bucketing logic is unit
// testable without a database or network.
// =============================================================================

// ---------------------------------------------------------------------------
// CSV parsing (HMDA data-browser CSV: header row, quoted fields, no embedded
// newlines inside fields in the public LAR extract)
// ---------------------------------------------------------------------------

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(current);
      current = "";
    } else if (ch !== "\r") {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Map header names → column index, lowercased so callers are case-safe. */
export function indexHeader(headerLine: string): Map<string, number> {
  const map = new Map<string, number>();
  parseCsvLine(headerLine).forEach((name, i) => map.set(name.trim().toLowerCase(), i));
  return map;
}

/** HMDA uses "NA"/"Exempt"/"" for unavailable numerics. */
export function numericOrNull(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === "" || /^(na|exempt)$/i.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

// ---------------------------------------------------------------------------
// Risk bucketing (used for Fannie Mae aggregation and runtime risk lookups —
// the same functions must produce the keys at ingest and query time)
// ---------------------------------------------------------------------------

export function creditBucket(score: number | null): string {
  if (score === null || score <= 0) return "unknown";
  if (score < 580) return "<580";
  if (score < 620) return "580-619";
  if (score < 660) return "620-659";
  if (score < 700) return "660-699";
  if (score < 740) return "700-739";
  if (score < 780) return "740-779";
  return "780+";
}

export function ltvBand(ltv: number | null): string {
  if (ltv === null || ltv <= 0) return "unknown";
  if (ltv <= 60) return "<=60";
  if (ltv <= 70) return "60-70";
  if (ltv <= 80) return "70-80";
  if (ltv <= 90) return "80-90";
  if (ltv <= 95) return "90-95";
  return "95+";
}

export function dtiBand(dti: number | null): string {
  if (dti === null || dti <= 0) return "unknown";
  if (dti <= 20) return "<=20";
  if (dti <= 30) return "20-30";
  if (dti <= 36) return "30-36";
  if (dti <= 43) return "36-43";
  if (dti <= 50) return "43-50";
  return "50+";
}

// ---------------------------------------------------------------------------
// Fannie Mae Single-Family Loan Performance file (pipe-delimited, no header,
// one row per loan per reporting month, rows grouped by loan id).
//
// Column positions follow the published "Single-Family Loan Performance Data
// File Layout" (data dynamics portal). If Fannie revises the layout, run the
// ingest script with --inspect to print indexed fields from the first row and
// adjust this map.
// ---------------------------------------------------------------------------

export const FANNIE_COLUMNS = {
  LOAN_ID: 1,
  ORIG_RATE: 7,
  OLTV: 19,
  DTI: 22,
  CSCORE_B: 23,
  DLQ_STATUS: 39,
  ZB_CODE: 43,
} as const;

/** Zero-balance codes that represent a terminal credit event (default). */
export const DEFAULT_ZB_CODES = new Set(["02", "03", "09", "15"]);
/** Voluntary payoff. */
export const PREPAID_ZB_CODE = "01";

export interface LoanTerminalState {
  loanId: string;
  origRate: number | null;
  creditScore: number | null;
  oltv: number | null;
  dti: number | null;
  everSeriouslyDelinquent: boolean;
  defaulted: boolean;
  prepaid: boolean;
}

export interface PerformanceCell {
  creditBucket: string;
  ltvBand: string;
  dtiBand: string;
  loanCount: number;
  defaultCount: number;
  seriousDelinqCount: number;
  prepaidCount: number;
  rateSum: number;
  rateCount: number;
}

/**
 * Folds monthly performance rows into per-band aggregates in O(1) memory:
 * because the source files group all rows for a loan together, we only ever
 * hold the state of the loan currently being read — never a map of all loans.
 * Memory is bounded by the number of band combinations (a few hundred),
 * regardless of whether the input is 100 rows or 100 GB.
 */
export class FannieLoanAggregator {
  private cells = new Map<string, PerformanceCell>();
  private current: LoanTerminalState | null = null;
  private loansSeen = 0;
  private rowsSeen = 0;
  private skippedRows = 0;

  constructor(private columns: typeof FANNIE_COLUMNS = FANNIE_COLUMNS) {}

  addRow(fields: string[]): void {
    this.rowsSeen++;
    const loanId = fields[this.columns.LOAN_ID]?.trim();
    if (!loanId) {
      this.skippedRows++;
      return;
    }

    if (!this.current || this.current.loanId !== loanId) {
      this.finalizeCurrent();
      this.current = {
        loanId,
        origRate: numericOrNull(fields[this.columns.ORIG_RATE]),
        creditScore: numericOrNull(fields[this.columns.CSCORE_B]),
        oltv: numericOrNull(fields[this.columns.OLTV]),
        dti: numericOrNull(fields[this.columns.DTI]),
        everSeriouslyDelinquent: false,
        defaulted: false,
        prepaid: false,
      };
      this.loansSeen++;
    }

    // Origination fields only appear on some rows in newer file vintages —
    // backfill whichever monthly row carries them.
    this.current.origRate ??= numericOrNull(fields[this.columns.ORIG_RATE]);
    this.current.creditScore ??= numericOrNull(fields[this.columns.CSCORE_B]);
    this.current.oltv ??= numericOrNull(fields[this.columns.OLTV]);
    this.current.dti ??= numericOrNull(fields[this.columns.DTI]);

    const dlqRaw = fields[this.columns.DLQ_STATUS]?.trim() ?? "";
    const dlq = /^\d+$/.test(dlqRaw) ? parseInt(dlqRaw, 10) : null;
    if (dlq !== null && dlq >= 3) this.current.everSeriouslyDelinquent = true;

    const zb = fields[this.columns.ZB_CODE]?.trim();
    if (zb) {
      const padded = zb.padStart(2, "0");
      if (DEFAULT_ZB_CODES.has(padded)) this.current.defaulted = true;
      else if (padded === PREPAID_ZB_CODE) this.current.prepaid = true;
    }
  }

  private finalizeCurrent(): void {
    if (!this.current) return;
    const loan = this.current;
    const key = `${creditBucket(loan.creditScore)}|${ltvBand(loan.oltv)}|${dtiBand(loan.dti)}`;

    let cell = this.cells.get(key);
    if (!cell) {
      cell = {
        creditBucket: creditBucket(loan.creditScore),
        ltvBand: ltvBand(loan.oltv),
        dtiBand: dtiBand(loan.dti),
        loanCount: 0,
        defaultCount: 0,
        seriousDelinqCount: 0,
        prepaidCount: 0,
        rateSum: 0,
        rateCount: 0,
      };
      this.cells.set(key, cell);
    }

    cell.loanCount++;
    if (loan.defaulted) cell.defaultCount++;
    if (loan.everSeriouslyDelinquent) cell.seriousDelinqCount++;
    if (loan.prepaid) cell.prepaidCount++;
    if (loan.origRate !== null) {
      cell.rateSum += loan.origRate;
      cell.rateCount++;
    }
    this.current = null;
  }

  finish(): { cells: PerformanceCell[]; loansSeen: number; rowsSeen: number; skippedRows: number } {
    this.finalizeCurrent();
    return {
      cells: [...this.cells.values()],
      loansSeen: this.loansSeen,
      rowsSeen: this.rowsSeen,
      skippedRows: this.skippedRows,
    };
  }
}
