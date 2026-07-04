/**
 * TCPA quiet-hours guard.
 *
 * The TCPA prohibits telephone solicitations (calls and texts) before 8:00 AM
 * or after 9:00 PM in the *recipient's* local time (47 CFR §64.1200(c)(1)).
 * This service answers "may we contact this person right now?" from their ZIP,
 * and MUST gate any future outbound SMS / dialer feature.
 *
 * Timezone is inferred from the ZIP's 3-digit prefix. When a ZIP can't be
 * resolved (missing, malformed, or non-US), we fail SAFE: contact is allowed
 * only when it is inside the calling window in BOTH the far-eastern and
 * far-western US zones, so we never ring someone at a prohibited local hour
 * regardless of where they actually are.
 */

// Contact permitted for local hours in [8:00, 21:00). 21:00 (9 PM) itself is quiet.
export const CALLING_WINDOW_START_HOUR = 8;
export const CALLING_WINDOW_END_HOUR = 21;

// Far-eastern and far-western US timezones, used to bound an unknown ZIP.
const EAST_EXTREME_TZ = "America/New_York";
const WEST_EXTREME_TZ = "Pacific/Honolulu";

// ZIP 3-digit-prefix ranges → IANA timezone. Approximate at the ~1% of ZIPs
// that straddle a timezone line within a state; a state's dominant zone is used.
// Arizona uses America/Phoenix (no DST). Ordered, non-overlapping ranges.
const ZIP_PREFIX_TIMEZONES: Array<{ min: number; max: number; tz: string }> = [
  { min: 6, max: 6, tz: "America/Puerto_Rico" }, // PR/VI (Atlantic)
  { min: 7, max: 9, tz: "America/Puerto_Rico" },
  { min: 10, max: 299, tz: "America/New_York" }, // New England → Mid-Atlantic
  { min: 300, max: 349, tz: "America/New_York" }, // GA, FL (peninsula)
  { min: 350, max: 369, tz: "America/Chicago" }, // AL
  { min: 370, max: 397, tz: "America/Chicago" }, // TN, MS
  { min: 398, max: 399, tz: "America/New_York" }, // GA
  { min: 400, max: 459, tz: "America/New_York" }, // KY, OH
  { min: 460, max: 479, tz: "America/New_York" }, // IN
  { min: 480, max: 499, tz: "America/New_York" }, // MI
  { min: 500, max: 567, tz: "America/Chicago" }, // IA, WI, MN
  { min: 570, max: 588, tz: "America/Chicago" }, // SD, ND (eastern)
  { min: 590, max: 599, tz: "America/Denver" }, // MT
  { min: 600, max: 693, tz: "America/Chicago" }, // IL, MO, KS, NE (eastern)
  { min: 700, max: 729, tz: "America/Chicago" }, // LA, AR
  { min: 730, max: 749, tz: "America/Chicago" }, // OK
  { min: 750, max: 797, tz: "America/Chicago" }, // TX (most)
  { min: 798, max: 799, tz: "America/Denver" }, // TX (El Paso)
  { min: 800, max: 816, tz: "America/Denver" }, // CO
  { min: 820, max: 831, tz: "America/Denver" }, // WY
  { min: 832, max: 838, tz: "America/Denver" }, // ID (southern)
  { min: 840, max: 847, tz: "America/Denver" }, // UT
  { min: 850, max: 865, tz: "America/Phoenix" }, // AZ (no DST)
  { min: 870, max: 884, tz: "America/Denver" }, // NM
  { min: 885, max: 885, tz: "America/Denver" }, // TX (El Paso)
  { min: 889, max: 898, tz: "America/Los_Angeles" }, // NV
  { min: 900, max: 961, tz: "America/Los_Angeles" }, // CA
  { min: 967, max: 968, tz: "Pacific/Honolulu" }, // HI
  { min: 969, max: 969, tz: "Pacific/Guam" }, // GU/MP
  { min: 970, max: 979, tz: "America/Los_Angeles" }, // OR
  { min: 980, max: 994, tz: "America/Los_Angeles" }, // WA
  { min: 995, max: 999, tz: "America/Anchorage" }, // AK
];

/** Resolve an IANA timezone from a US ZIP code, or null if it can't be mapped. */
export function resolveTimezoneFromZip(zip: string | null | undefined): string | null {
  if (!zip) return null;
  const match = zip.trim().match(/^(\d{5})/);
  if (!match) return null;
  const prefix = parseInt(match[1].slice(0, 3), 10);
  if (Number.isNaN(prefix)) return null;
  for (const range of ZIP_PREFIX_TIMEZONES) {
    if (prefix >= range.min && prefix <= range.max) return range.tz;
  }
  return null;
}

/** The wall-clock hour (0–23) at `date` in the given IANA timezone. */
export function localHourInTimezone(date: Date, timeZone: string): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hour12: false,
  }).format(date);
  // ICU may render midnight as "24"; normalize to 0.
  const hour = parseInt(hourStr, 10) % 24;
  return Number.isNaN(hour) ? 0 : hour;
}

/** True when `date` falls inside the 8 AM–9 PM calling window in `timeZone`. */
export function isWithinCallingWindow(date: Date, timeZone: string): boolean {
  const hour = localHourInTimezone(date, timeZone);
  return hour >= CALLING_WINDOW_START_HOUR && hour < CALLING_WINDOW_END_HOUR;
}

export interface QuietHoursDecision {
  allowed: boolean;
  /** The timezone the decision was made against ("uncertain" for the safe fallback). */
  timezone: string;
  /** Local hour in the resolved timezone, or null when the ZIP was unresolved. */
  localHour: number | null;
  reason: string;
}

/**
 * Decide whether an outbound solicitation may be sent right now.
 *
 * @param opts.zip       recipient ZIP (preferred timezone source)
 * @param opts.timezone  explicit IANA timezone (overrides ZIP when provided)
 * @param opts.now       evaluation instant (defaults to now; injectable for tests)
 */
export function isContactAllowed(opts: {
  zip?: string | null;
  timezone?: string | null;
  now?: Date;
}): QuietHoursDecision {
  const now = opts.now ?? new Date();
  const timezone = opts.timezone || resolveTimezoneFromZip(opts.zip);

  if (timezone) {
    const localHour = localHourInTimezone(now, timezone);
    const allowed = isWithinCallingWindow(now, timezone);
    return {
      allowed,
      timezone,
      localHour,
      reason: allowed
        ? `Within calling window (local hour ${localHour} in ${timezone})`
        : `Outside 8 AM–9 PM quiet hours (local hour ${localHour} in ${timezone})`,
    };
  }

  // Unknown timezone: allow only when it's inside the window at BOTH US extremes.
  const allowed =
    isWithinCallingWindow(now, EAST_EXTREME_TZ) && isWithinCallingWindow(now, WEST_EXTREME_TZ);
  return {
    allowed,
    timezone: "uncertain",
    localHour: null,
    reason: allowed
      ? "Timezone unknown — inside calling window across all US zones"
      : "Timezone unknown — outside the safe calling window in at least one US zone",
  };
}
