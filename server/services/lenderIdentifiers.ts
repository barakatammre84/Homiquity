import { db } from "../db";
import { wholesaleLenders } from "@shared/schema";
import { buildLenderIdentifiers } from "@shared/borrowerConditionView";

/**
 * The wholesale-lender identifier list used to scrub lender identity out of
 * borrower-facing text (borrower-transparency doctrine; §9 review F-1).
 *
 * The lender catalog is a database table, but the scrub runs on every borrower
 * dashboard, pipeline and activity read — a query per request on a hot path for
 * a table that changes maybe monthly. So the derived list is cached in process
 * with a short TTL.
 *
 * Failure policy is the important part. If the read fails we return the LAST
 * KNOWN GOOD list rather than an empty one: an empty list silently disables
 * scrubbing and leaks wholesale-lender names into borrower payloads, which is
 * exactly the bypass F-1 probed. A stale list over-scrubs at worst.
 */
const TTL_MS = 5 * 60 * 1000;

let cached: string[] = [];
let cachedAt = 0;
let everLoaded = false;

/** Drop the cache — for tests and for the admin lender screen after a write. */
export function invalidateLenderIdentifiers(): void {
  cachedAt = 0;
}

export async function getLenderIdentifiers(now: number = Date.now()): Promise<readonly string[]> {
  if (everLoaded && now - cachedAt < TTL_MS) return cached;
  try {
    const rows = await db
      .select({
        lenderId: wholesaleLenders.lenderId,
        lenderName: wholesaleLenders.lenderName,
      })
      .from(wholesaleLenders);
    cached = buildLenderIdentifiers(rows);
    cachedAt = now;
    everLoaded = true;
  } catch (err) {
    // Keep the previous list. On a cold process with no successful read yet
    // this is empty, and there is nothing truthful to scrub against — but the
    // caller still gets a list, never a throw on a borrower read path.
    console.error("[lender-identifiers] refresh failed; serving last known list", err);
  }
  return cached;
}
