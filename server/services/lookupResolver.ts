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
 */
export class LookupResolverService {
  private static cache: Map<string, { data: number; expiry: number }> = new Map();
  private static CACHE_TTL_MS = 60 * 1000; // 1-minute TTL

  /**
   * Resolves a value from a multidimensional dynamic matrix.
   * Fails loudly with an explicit error message if no matrix matches or the
   * coordinates fall outside permitted intervals.
   */
  public async resolveMatrixValue(query: LookupQuery): Promise<number> {
    const referenceDate = query.targetDate || new Date();
    // Cache key uses day-level date granularity so repeated default ("now")
    // lookups within a day share cache entries (matrices are date-effective,
    // not time-of-day sensitive). This keeps the 1-minute TTL meaningful instead
    // of producing a near-unique key per call from a millisecond timestamp.
    const dateBucket = referenceDate.toISOString().slice(0, 10);
    const cacheKey = `${query.matrixCode}_d1:${query.dim1Value ?? "na"}_d2:${query.dim2Value ?? "na"}_d3:${query.dim3Identifier ?? "na"}_t:${dateBucket}`;

    const cached = LookupResolverService.cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

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

    const result = parseFloat(cell.outputValue);
    LookupResolverService.cache.set(cacheKey, {
      data: result,
      expiry: Date.now() + LookupResolverService.CACHE_TTL_MS,
    });

    return result;
  }

  /**
   * Helper shortcut to retrieve standard policy threshold scalars (1-D matrices
   * with a single unbounded cell).
   */
  public async getPolicyScalar(scalarCode: string): Promise<number> {
    return this.resolveMatrixValue({ matrixCode: scalarCode });
  }

  /**
   * Invalidates cached lookup results. Must be called whenever a matrix's
   * lifecycle changes (publish/activate/retire/future-date) so freshly
   * resolved values reflect the new policy immediately instead of serving a
   * stale, possibly expired rate for up to the cache TTL.
   *
   * @param matrixCode When provided, only entries for that matrix are dropped;
   *                   otherwise the entire cache is cleared.
   */
  public static invalidate(matrixCode?: string): void {
    if (!matrixCode) {
      LookupResolverService.cache.clear();
      return;
    }
    const prefix = `${matrixCode}_`;
    for (const key of Array.from(LookupResolverService.cache.keys())) {
      if (key.startsWith(prefix)) {
        LookupResolverService.cache.delete(key);
      }
    }
  }

  /**
   * Non-throwing variant for NON-DECISION display surfaces only (e.g. marketing
   * calculators) where a missing seeded band legitimately means "not
   * applicable" rather than a compliance error. The deterministic decision
   * engine never uses this path — it always uses resolveMatrixValue.
   */
  public async tryResolveMatrixValue(query: LookupQuery): Promise<number | null> {
    try {
      return await this.resolveMatrixValue(query);
    } catch {
      return null;
    }
  }
}

export const lookupResolver = new LookupResolverService();
