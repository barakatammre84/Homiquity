import { db } from "../db";
import { lookupMatrices, lookupMatrixCells } from "@shared/schema";
import { and, eq, lte, gte, or, isNull, sql } from "drizzle-orm";

export interface LookupQuery {
  matrixCode: string;
  dim1Value?: number;
  dim2Value?: number;
  dim3Identifier?: string;
  targetDate?: Date;
}

/**
 * Result of resolving a single value from the database. `expiresAt` is the
 * epoch-ms of the matrix's expirationDate (or null for an open-ended matrix) so
 * a cached entry can be capped to never outlive the matrix it came from.
 */
interface ResolvedValue {
  value: number;
  expiresAt: number | null;
}

/**
 * Reads the cross-process invalidation stamp for a matrix code. Two server
 * instances backed by the same database see the same stamp; any lifecycle
 * mutation bumps it, so instances that did NOT handle the mutation still notice
 * the change on their next read.
 */
export type StampReader = (matrixCode: string) => Promise<number>;

/** Performs the actual (uncached) database resolution for a query. */
export type ValueResolver = (
  query: LookupQuery,
  referenceDate: Date,
) => Promise<ResolvedValue>;

export interface LookupResolverOptions {
  /**
   * How long (ms) a stamp read is reused before re-querying the shared store.
   *
   * DEFAULT 0 = read the stamp on every resolve. This is the correct, strict
   * mode: a lifecycle change made on any instance is reflected immediately on
   * every other instance, so a sibling can never serve a stale/expired value
   * after activate/retire/reschedule. The cost is one lightweight indexed
   * MAX(updated_at) query per resolve (a cache hit still avoids the heavier
   * matrix+cell resolution).
   *
   * A positive value is an explicit, opt-in PERFORMANCE mode that coalesces
   * stamp reads under very high load, trading up to `stampWindowMs` of
   * cross-process staleness for fewer stamp queries. Only enable it (via the
   * `LOOKUP_MATRIX_STAMP_WINDOW_MS` env var) if you accept that a sibling
   * instance may quote a just-expired value for that window. Same-process
   * mutations are always reflected immediately via {@link invalidate},
   * independent of this value.
   */
  stampWindowMs?: number;
  /**
   * Maximum age (ms) of a cached value irrespective of the stamp. Acts as a
   * defensive backstop; correctness for lifecycle changes comes from the stamp.
   */
  valueTtlMs?: number;
  stampReader?: StampReader;
  valueResolver?: ValueResolver;
}

/**
 * LookupResolverService
 *
 * Versioned, date-aware resolver for the dynamic policy/pricing matrices that
 * replace hardcoded underwriting constants. It verifies a matrix is ACTIVE and
 * chronologically valid, then intersects the supplied coordinates against the
 * matrix cells.
 *
 * FULL REPLACEMENT — there are no silent fallbacks. If a matrix is missing,
 * expired, or no cell matches the inputs, a descriptive Error is thrown so the
 * failure is loud and auditable (Fair Lending / Reg B determinism).
 *
 * Cross-process cache coherence
 * -----------------------------
 * The resolved-value cache is per-process and in-memory. Because production
 * may run on more than one replica,
 * more than one instance can serve traffic, and a lifecycle mutation handled by
 * one instance does not reach another instance's local cache. To prevent a
 * sibling instance from quoting a stale/expired value for the full cache TTL,
 * every cached value is tagged with a database-derived invalidation stamp
 * (MAX(updated_at) per matrix_code). On a cache hit the stamp is compared
 * against the current shared stamp; a mismatch forces a fresh resolve. The
 * instance that performs the mutation additionally clears its own cache
 * immediately via {@link invalidate}.
 */
export class LookupResolverService {
  private cache: Map<string, { data: number; expiry: number; stamp: number }> =
    new Map();
  private stampCache: Map<string, { stamp: number; expiry: number }> =
    new Map();

  private readonly stampWindowMs: number;
  private readonly valueTtlMs: number;
  private readonly stampReader: StampReader;
  private readonly valueResolver: ValueResolver;

  constructor(options: LookupResolverOptions = {}) {
    const envWindow = Number(process.env.LOOKUP_MATRIX_STAMP_WINDOW_MS);
    // Strict-by-default: read the stamp on every resolve so lifecycle changes
    // are reflected immediately on every instance. A positive env value is an
    // explicit opt-in to the coalescing performance mode (see options doc).
    this.stampWindowMs =
      options.stampWindowMs ??
      (Number.isFinite(envWindow) && envWindow > 0 ? envWindow : 0);
    this.valueTtlMs = options.valueTtlMs ?? 60_000;
    this.stampReader = options.stampReader ?? defaultStampReader;
    this.valueResolver = options.valueResolver ?? defaultValueResolver;
  }

  /**
   * Resolves a value from a multidimensional dynamic matrix.
   * Fails loudly with an explicit error message if no matrix matches or the
   * coordinates fall outside permitted intervals.
   */
  public async resolveMatrixValue(query: LookupQuery): Promise<number> {
    const referenceDate = query.targetDate || new Date();
    // Cache key uses day-level date granularity so repeated default ("now")
    // lookups within a day share cache entries (matrices are date-effective,
    // not time-of-day sensitive). This keeps the TTL meaningful instead of
    // producing a near-unique key per call from a millisecond timestamp.
    const dateBucket = referenceDate.toISOString().slice(0, 10);
    const cacheKey = `${query.matrixCode}_d1:${query.dim1Value ?? "na"}_d2:${query.dim2Value ?? "na"}_d3:${query.dim3Identifier ?? "na"}_t:${dateBucket}`;

    const currentStamp = await this.getStamp(query.matrixCode);

    const cached = this.cache.get(cacheKey);
    if (
      cached &&
      cached.expiry > Date.now() &&
      cached.stamp === currentStamp
    ) {
      return cached.data;
    }

    const { value, expiresAt } = await this.valueResolver(query, referenceDate);

    // Cap the cache entry so it can never outlive the matrix's own expiration,
    // then bound it by the defensive TTL.
    let expiry = Date.now() + this.valueTtlMs;
    if (expiresAt !== null && expiresAt < expiry) {
      expiry = expiresAt;
    }

    this.cache.set(cacheKey, { data: value, expiry, stamp: currentStamp });
    return value;
  }

  /**
   * Returns the current invalidation stamp for a matrix code, coalescing reads
   * within {@link stampWindowMs}.
   */
  private async getStamp(matrixCode: string): Promise<number> {
    if (this.stampWindowMs > 0) {
      const cached = this.stampCache.get(matrixCode);
      if (cached && cached.expiry > Date.now()) {
        return cached.stamp;
      }
    }
    const stamp = await this.stampReader(matrixCode);
    if (this.stampWindowMs > 0) {
      this.stampCache.set(matrixCode, {
        stamp,
        expiry: Date.now() + this.stampWindowMs,
      });
    }
    return stamp;
  }

  /**
   * Helper shortcut to retrieve standard policy threshold scalars (1-D matrices
   * with a single unbounded cell).
   */
  public async getPolicyScalar(scalarCode: string): Promise<number> {
    return this.resolveMatrixValue({ matrixCode: scalarCode });
  }

  /**
   * Invalidates this instance's cached lookup results immediately. Called on the
   * instance that handled a lifecycle change (publish/activate/retire/
   * future-date) so its own freshly resolved values reflect the new policy at
   * once. Cross-process propagation is handled separately by the database stamp:
   * other instances notice the bumped stamp on their next read.
   *
   * Dropping the stamp cache too forces the next read to re-fetch the (now
   * bumped) stamp rather than trusting a value coalesced moments earlier.
   *
   * @param matrixCode When provided, only entries for that matrix are dropped;
   *                   otherwise the entire cache is cleared.
   */
  public invalidateInstance(matrixCode?: string): void {
    if (!matrixCode) {
      this.cache.clear();
      this.stampCache.clear();
      return;
    }
    const prefix = `${matrixCode}_`;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    this.stampCache.delete(matrixCode);
  }

  /**
   * Process-wide invalidation entry point used by the lifecycle routes. Clears
   * the shared singleton's cache. Cross-process invalidation is carried by the
   * database stamp, not by this call.
   */
  public static invalidate(matrixCode?: string): void {
    lookupResolver.invalidateInstance(matrixCode);
  }

  /**
   * Non-throwing variant for NON-DECISION display surfaces only (e.g. marketing
   * calculators) where a missing seeded band legitimately means "not
   * applicable" rather than a compliance error. The deterministic decision
   * engine never uses this path — it always uses resolveMatrixValue.
   */
  public async tryResolveMatrixValue(
    query: LookupQuery,
  ): Promise<number | null> {
    try {
      return await this.resolveMatrixValue(query);
    } catch {
      return null;
    }
  }
}

/**
 * Default stamp reader: MAX(updated_at) for the matrix code, as epoch-ms. Every
 * lifecycle mutation sets updated_at = now() on the affected row, so this value
 * advances whenever any version of the code changes. Returns 0 when the code
 * has no rows.
 */
const defaultStampReader: StampReader = async (matrixCode) => {
  const [row] = await db
    .select({
      stamp: sql<string>`COALESCE(EXTRACT(EPOCH FROM MAX(${lookupMatrices.updatedAt})) * 1000, 0)`,
    })
    .from(lookupMatrices)
    .where(eq(lookupMatrices.matrixCode, matrixCode));
  return Number(row?.stamp ?? 0);
};

/** Default DB-backed value resolution (no caching). */
const defaultValueResolver: ValueResolver = async (query, referenceDate) => {
  // Step 1: Resolve the active, chronologically valid master matrix record.
  const [matrix] = await db
    .select()
    .from(lookupMatrices)
    .where(
      and(
        eq(lookupMatrices.matrixCode, query.matrixCode),
        eq(lookupMatrices.lifecycleStatus, "ACTIVE"),
        lte(lookupMatrices.effectiveDate, referenceDate),
        or(
          isNull(lookupMatrices.expirationDate),
          gte(lookupMatrices.expirationDate, referenceDate),
        ),
      ),
    )
    .orderBy(sql`${lookupMatrices.version} DESC`)
    .limit(1);

  if (!matrix) {
    throw new Error(
      `CRITICAL COMPLIANCE ERROR: Required matrix configuration [${query.matrixCode}] is missing, expired, or not active for date ${referenceDate.toISOString()}`,
    );
  }

  // Step 2: Build intersection conditions across the supplied dimensions.
  const conditions = [eq(lookupMatrixCells.matrixId, matrix.id)];

  if (query.dim1Value !== undefined) {
    conditions.push(
      and(
        or(
          isNull(lookupMatrixCells.dim1Min),
          lte(lookupMatrixCells.dim1Min, sql`${query.dim1Value}::numeric`),
        ),
        or(
          isNull(lookupMatrixCells.dim1Max),
          gte(lookupMatrixCells.dim1Max, sql`${query.dim1Value}::numeric`),
        ),
      )!,
    );
  }

  if (query.dim2Value !== undefined) {
    conditions.push(
      and(
        or(
          isNull(lookupMatrixCells.dim2Min),
          lte(lookupMatrixCells.dim2Min, sql`${query.dim2Value}::numeric`),
        ),
        or(
          isNull(lookupMatrixCells.dim2Max),
          gte(lookupMatrixCells.dim2Max, sql`${query.dim2Value}::numeric`),
        ),
      )!,
    );
  }

  if (query.dim3Identifier !== undefined) {
    conditions.push(eq(lookupMatrixCells.dim3Identifier, query.dim3Identifier));
  }

  // Step 3: Fetch the matching cell.
  const [cell] = await db
    .select()
    .from(lookupMatrixCells)
    .where(and(...conditions))
    .limit(1);

  if (!cell) {
    throw new Error(
      `CRITICAL DECISIONING ERROR: Lookup parameters [d1: ${query.dim1Value ?? "N/A"}, d2: ${query.dim2Value ?? "N/A"}, d3: ${query.dim3Identifier ?? "N/A"}] fell outside permitted compliance intervals in active matrix [${query.matrixCode}]`,
    );
  }

  return {
    value: parseFloat(cell.outputValue),
    expiresAt: matrix.expirationDate
      ? new Date(matrix.expirationDate).getTime()
      : null,
  };
};

export const lookupResolver = new LookupResolverService();
