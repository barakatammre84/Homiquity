/**
 * The borrower-facing shape of a lease.
 *
 * WHY A VIEW TYPE AT ALL. `leases` stores landlord email and property address as
 * encrypted triples (`*_encrypted` / `*_iv` / `*_key_id`). The raw row must never reach
 * a client: the ciphertext is useless to it, and shipping key ids out of the server is
 * gratuitous. This type is what the API actually returns — decrypted for the owner,
 * with the triples dropped — and it is shared so the client types against the same
 * thing the server promises rather than a hand-copied interface that drifts.
 *
 * Dates cross the wire as `YYYY-MM-DD` strings, not Date objects. JSON has no date
 * type, and a serialized ISO instant invites the exact local-vs-UTC read that makes a
 * lease look like it started a day earlier west of Greenwich.
 */
export interface LeaseView {
  readonly id: string;
  readonly landlordName: string | null;
  /** Decrypted. Null when never captured. */
  readonly landlordEmail: string | null;
  /** Decrypted. Null when never captured. */
  readonly propertyAddress: string | null;
  readonly monthlyRentAmount: string;
  /** `YYYY-MM-DD`, or null. */
  readonly leaseStartDate: string | null;
  /** `YYYY-MM-DD`, or null. */
  readonly leaseEndDate: string | null;
  readonly status: string;
  readonly verificationStatus: string;
  /**
   * Whether this lease is enrolled for credit-bureau furnishing.
   *
   * Always `false` today — enrolling is a separate affirmative act that does not exist
   * yet, and nothing in the repo can furnish anything regardless (the Metro 2 authority
   * is absent). Present so the surface can state the fact rather than imply it.
   */
  readonly furnishingEnrolled: boolean;
}

/** `YYYY-MM-DD` from a UTC-anchored timestamp. Never uses local getters — see the header. */
export function toDateOnly(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Parse a `YYYY-MM-DD` string to the UTC midnight instant it denotes.
 *
 * `new Date("2026-06-30")` is already UTC midnight per ES2015+, but the explicit suffix
 * is the house spelling (server/services/loanEstimate.ts, routes/underwriting/delivery.ts)
 * and it survives a future refactor that starts appending a time. Returns null rather
 * than an Invalid Date so a caller cannot persist NaN.
 */
export function fromDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
