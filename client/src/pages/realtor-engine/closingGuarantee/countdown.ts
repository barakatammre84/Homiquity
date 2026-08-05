/**
 * Countdown text for a guarantee's target date.
 *
 * Split out of the useCountdown hook so the formatting is testable without a
 * clock: the hook supplies `Date.now()`, this decides the words. The hook also
 * used to return a `progress` value that was only ever assigned on expiry —
 * always 0 for a live guarantee — and its single caller never read it, so it
 * is gone rather than carried forward as a permanently-zero progress bar.
 */

export const EXPIRED_LABEL = "Expired";

/** Formats a remaining duration in milliseconds. Non-positive reads "Expired". */
export function formatRemaining(diffMs: number): string {
  if (diffMs <= 0) return EXPIRED_LABEL;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days} day${days !== 1 ? "s" : ""}, ${hours} hour${hours !== 1 ? "s" : ""} remaining`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}, ${minutes} min remaining`;
  }
  return `${minutes} minute${minutes !== 1 ? "s" : ""} remaining`;
}

/** Remaining text for a target date, measured from `now`. */
export function remainingUntil(targetDate: string, now: number): string {
  return formatRemaining(new Date(targetDate).getTime() - now);
}

/**
 * How far through the created -> target window we are, 0-100.
 *
 * This is the card's real progress bar (the hook's old `progress` field was
 * always 0 and unread). Clamped both ends: a guarantee created after its own
 * target, or one long past due, must not render a negative or >100% bar.
 */
export function elapsedPercent(createdAt: string, targetDate: string, now: number): number {
  const created = new Date(createdAt).getTime();
  const target = new Date(targetDate).getTime();
  const totalDuration = target - created;
  if (!(totalDuration > 0)) return 0;
  return Math.min(100, Math.max(0, ((now - created) / totalDuration) * 100));
}
