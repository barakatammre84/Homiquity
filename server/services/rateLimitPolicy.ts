/**
 * RATE_LIMIT_RELAXED=true is set only when booting a local server for the
 * integration suite, whose ~30 auth calls exceed the auth limiter's 20/15min
 * budget in a single pass. The flag is never set in production or normal dev, and
 * is ignored outright in production, so deployed behavior is unchanged.
 * Read per-request so a test server never needs a restart to change posture.
 */
export function isRateLimitRelaxed(): boolean {
  return (
    process.env.RATE_LIMIT_RELAXED === "true" &&
    process.env.NODE_ENV !== "production"
  );
}
