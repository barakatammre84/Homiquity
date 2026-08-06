import { format, formatDistanceToNow } from "date-fns";

/**
 * Null-safe date formatting.
 *
 * WHY THIS EXISTS
 * ---------------
 * `format(new Date(x), pattern)` has two distinct failure modes when `x` is not
 * a usable date, and neither is acceptable on a mortgage surface. Measured
 * against the date-fns version this repo pins:
 *
 *   x = null       -> new Date(null) is the epoch, so it renders "Jan 1, 1970".
 *                     No error, no warning. The worst outcome of the three: a
 *                     plausible-looking date shown where the real answer is
 *                     "we don't have one". On an adverse-action notice date or
 *                     a closing-guarantee target that is a false record.
 *   x = undefined  -> format() throws RangeError: Invalid time value.
 *   x = ""         -> format() throws RangeError: Invalid time value.
 *
 * A throw inside render unmounts everything up to the nearest error boundary,
 * so one absent timestamp in one row blanks the whole card or page.
 *
 * The type system does not protect against this. Every call site these helpers
 * replaced declared its field as a non-optional `string` in a local interface
 * while the backing column is nullable (138 of the 157 `created_at` columns in
 * shared/schema are `.defaultNow()` WITHOUT `.notNull()`), and two of them
 * silenced the compiler with `!` outright. So the client believed a guarantee
 * the database never made.
 *
 * These wrappers are behaviour-preserving for every value that already worked —
 * same date-fns call, same pattern, same output — and substitute a fallback for
 * the three cases above instead of lying or throwing.
 *
 * Related: formatDate() in ./formatters.ts is the null-safe fixed-format
 * ("MMM d, yyyy") variant and needs no date-fns. Use it when you don't need a
 * custom pattern; these when you do.
 */

/** Rendered when there is no usable date. An em dash, not a guessed value. */
export const NO_DATE = "—";

type DateInput = Date | string | number | null | undefined;

/** Parse to a valid Date, or null. Never throws, never returns the epoch for null. */
function toValidDate(value: DateInput): Date | null {
  // Checked before `new Date(...)` precisely because new Date(null) is the
  // epoch rather than an invalid date — the silent-wrong-answer case.
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * `format(new Date(value), pattern)` that yields `fallback` instead of throwing
 * or rendering the epoch. Pattern is a date-fns format string.
 */
export function formatDateSafe(
  value: DateInput,
  pattern: string,
  fallback: string = NO_DATE,
): string {
  const d = toValidDate(value);
  return d === null ? fallback : format(d, pattern);
}

/**
 * `formatDistanceToNow(new Date(value), options)` with the same guarantee.
 *
 * Worth its own wrapper: an unguarded null here reads "over 56 years ago",
 * which is not obviously wrong to someone skimming a queue and so survives
 * review in a way "Jan 1, 1970" sometimes doesn't.
 */
export function formatDistanceToNowSafe(
  value: DateInput,
  options?: Parameters<typeof formatDistanceToNow>[1],
  fallback: string = NO_DATE,
): string {
  const d = toValidDate(value);
  return d === null ? fallback : formatDistanceToNow(d, options);
}

/** True when the value would produce a real date rather than a fallback. */
export function isUsableDate(value: DateInput): boolean {
  return toValidDate(value) !== null;
}
