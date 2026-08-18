/**
 * Postgres error detection that survives the ORM's wrapper.
 *
 * drizzle-orm 0.45 rethrows every driver error as `DrizzleQueryError`, with the
 * original pg error on `.cause` — so the long-standing idiom
 * `err.code === "23505"` matches nothing anymore. That is not hypothetical: the
 * duplicate-rent-payment 409 path shipped as a 500 because of exactly this, and
 * seven other call sites carry the same bare check (masked only where a pre-check
 * SELECT answers first, i.e. everywhere except under a race).
 *
 * This helper checks the wrapper AND the cause, so it is correct on both sides of
 * any future ORM upgrade that changes the wrapping again.
 */

const codeOf = (err: unknown): string | undefined => {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === "string") return e.code;
  const cause = e.cause as { code?: unknown } | undefined;
  return typeof cause?.code === "string" ? cause.code : undefined;
};

/** Unique-constraint violation (pg 23505), however deeply the ORM wrapped it. */
export function isUniqueViolation(err: unknown): boolean {
  return codeOf(err) === "23505";
}

/** Foreign-key violation (pg 23503) — e.g. an insert racing its parent's delete. */
export function isForeignKeyViolation(err: unknown): boolean {
  return codeOf(err) === "23503";
}
