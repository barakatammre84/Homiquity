// ---------------------------------------------------------------------------
// TRID business-day math (weekends + US federal holidays).
//
// Single source of truth for Reg Z §1026.19 timing: the Loan Estimate must be
// delivered or placed in the mail within 3 business days of application
// (§1026.19(e)(1)(iii)); the Closing Disclosure must be received at least
// 3 business days before consummation (§1026.19(f)(1)(ii)). Every module that
// computes a TRID deadline must import from here — do not reimplement this
// with calendar-day arithmetic.
// ---------------------------------------------------------------------------

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  // month is 0-indexed, weekday 0=Sun..6=Sat, n is 1-based occurrence
  const first = new Date(Date.UTC(year, month, 1));
  const firstWeekday = first.getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return new Date(Date.UTC(year, month, day));
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(Date.UTC(year, month + 1, 0));
  const lastWeekday = last.getUTCDay();
  const day = last.getUTCDate() - ((lastWeekday - weekday + 7) % 7);
  return new Date(Date.UTC(year, month, day));
}

function observedHoliday(date: Date): Date {
  // Federal holidays falling on Sat are observed Fri; on Sun observed Mon.
  const day = date.getUTCDay();
  if (day === 6) return new Date(date.getTime() - 24 * 60 * 60 * 1000);
  if (day === 0) return new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return date;
}

export function usFederalHolidays(year: number): Set<string> {
  const holidays: Date[] = [
    new Date(Date.UTC(year, 0, 1)), // New Year's Day
    nthWeekdayOfMonth(year, 0, 1, 3), // MLK Day - 3rd Mon Jan
    nthWeekdayOfMonth(year, 1, 1, 3), // Presidents Day - 3rd Mon Feb
    lastWeekdayOfMonth(year, 4, 1), // Memorial Day - last Mon May
    new Date(Date.UTC(year, 5, 19)), // Juneteenth
    new Date(Date.UTC(year, 6, 4)), // Independence Day
    nthWeekdayOfMonth(year, 8, 1, 1), // Labor Day - 1st Mon Sep
    nthWeekdayOfMonth(year, 9, 1, 2), // Columbus Day - 2nd Mon Oct
    new Date(Date.UTC(year, 10, 11)), // Veterans Day
    nthWeekdayOfMonth(year, 10, 4, 4), // Thanksgiving - 4th Thu Nov
    new Date(Date.UTC(year, 11, 25)), // Christmas
  ];
  const set = new Set<string>();
  for (const h of holidays) {
    const obs = observedHoliday(h);
    set.add(obs.toISOString().split("T")[0]);
  }
  return set;
}

export function isBusinessDay(date: Date, holidays: Set<string>): boolean {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !holidays.has(date.toISOString().split("T")[0]);
}

function holidaySetForRange(start: Date, end: Date): Set<string> {
  const years = new Set<number>();
  years.add(start.getUTCFullYear());
  years.add(end.getUTCFullYear());
  const set = new Set<string>();
  Array.from(years).forEach(y => {
    usFederalHolidays(y).forEach(h => set.add(h));
  });
  return set;
}

/** Returns the date `n` business days after `from` (excluding weekends + federal holidays). */
export function addBusinessDays(from: Date, n: number): Date {
  const end = new Date(from.getTime() + Math.ceil(n / 5 + 2) * 7 * 24 * 60 * 60 * 1000);
  const holidays = holidaySetForRange(from, end);
  let count = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (count < n) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isBusinessDay(cursor, holidays)) count++;
  }
  return cursor;
}

/** Returns the date `n` business days before `from` (excluding weekends + federal holidays). */
export function subtractBusinessDays(from: Date, n: number): Date {
  const start = new Date(from.getTime() - Math.ceil(n / 5 + 2) * 7 * 24 * 60 * 60 * 1000);
  const holidays = holidaySetForRange(start, from);
  let count = 0;
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (count < n) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (isBusinessDay(cursor, holidays)) count++;
  }
  return cursor;
}
