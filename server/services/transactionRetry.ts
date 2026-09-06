const RETRYABLE_TRANSACTION_CODES = new Set(["40001", "40P01"]);

/**
 * PostgreSQL may abort a repeatable-read/serializable transaction when a row
 * it references changes concurrently. The whole transaction is safe to replay
 * because none of its writes committed. Keep the retry here bounded so review
 * writers can recover from presence/login churn without hiding a persistent
 * database failure.
 */
export async function withPostgresTransactionRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!RETRYABLE_TRANSACTION_CODES.has(postgresErrorCode(error) ?? "") || attempt >= maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, attempt * 10));
    }
  }
}

/** Drizzle/pg may expose the server error directly or through `cause`. */
export function postgresErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as { code?: unknown; cause?: unknown };
    if (typeof candidate.code === "string") return candidate.code;
    current = candidate.cause;
  }
  return undefined;
}
