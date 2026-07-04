/**
 * Currency/number parsing — the single canonical helper.
 *
 * Replaces five byte-identical private copies (`toNum`/`toNumber`) that were
 * scattered across lifecycleEngine, underwritingNuance, preUnderwriting,
 * decisionEngine, and the client pre-approval funnel.
 *
 * CONTRACT — do not change without auditing every call site:
 *   - strips `,` and `$`, then parseFloat
 *   - a numeric input passes straight through
 *   - null / undefined / unparseable  →  NaN  (callers rely on `isNaN(...)`)
 *
 * Several decision-path modules (Reg B credit math) depend on the exact NaN
 * behavior above — a change here silently changes underwriting calculations.
 */
export function toNum(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return NaN;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[,$]/g, ""));
  return isNaN(n) ? NaN : n;
}

/** `toNum` with a fallback for the "treat unparseable as 0" call sites. */
export function toNumOr(v: string | number | null | undefined, fallback = 0): number {
  const n = toNum(v);
  return isNaN(n) ? fallback : n;
}

/** Strip currency punctuation (`,` and `$`) without parsing. */
export function stripCurrency(v: string): string {
  return v.replace(/[,$]/g, "");
}
