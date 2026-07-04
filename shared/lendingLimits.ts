/**
 * Single source of truth for agency loan limits.
 *
 * Keeping this here (rather than as scattered literals) prevents the class of
 * bug where one surface quotes a stale limit while another quotes the current
 * one — e.g. the borrower graph calling a $790k loan "jumbo" against the 2024
 * value while the rate sheets price it as conforming against the 2026 value.
 *
 * The deterministic underwriting engine does not import this constant directly;
 * it resolves the same value from the CONFORMING_LOAN_LIMIT policy scalar in
 * Postgres (seeded from this constant), consistent with its matrix-driven,
 * no-hardcoded-thresholds design.
 */

/** FHFA 2026 conforming loan limit, one-unit baseline (non-high-cost). */
export const CONFORMING_LOAN_LIMIT_2026 = 806_500;
