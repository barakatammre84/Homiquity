// ---------------------------------------------------------------------------
// Active platform fee schedule — the impure edge around a pure fee model.
//
// services/loanCosts.ts stays pure: every function there takes a
// PlatformFeeSchedule as a parameter. This module is the ONE place that reads
// the published schedule out of the database and hands it to those functions,
// so re-pricing is an admin action rather than a code change and a deploy
// (audit F-17's business lever, made operable).
//
// WHY APPEND-ONLY, AND WHY A CACHE IS SAFE HERE
// ---------------------------------------------------------------------------
// `platform_fee_schedules` is never updated in place — publishing supersedes
// the active row and inserts a new one. So a cached schedule can only ever be
// stale, never wrong-for-its-version, and `invalidate()` on publish closes
// even that window within one process. The TTL is the belt-and-braces for
// other instances.
//
// An EMPTY table is valid and means "use the compiled-in baseline". Nothing is
// seeded (migration 0046 deliberately inserts no row), so
// DEFAULT_PLATFORM_FEE_SCHEDULE remains the documented default until an admin
// publishes over it.
// ---------------------------------------------------------------------------

import { db } from "../db";
import { platformFeeSchedules } from "@shared/schema";
import { desc, isNull } from "drizzle-orm";
import {
  DEFAULT_PLATFORM_FEE_SCHEDULE,
  type PlatformFeeSchedule,
} from "./loanCosts";

export interface ActiveFeeSchedule {
  schedule: PlatformFeeSchedule;
  /** Null when no schedule has been published — the baseline is in force. */
  version: number | null;
  effectiveFrom: Date | null;
}

/** How long a resolved schedule may be reused before re-reading. */
const CACHE_TTL_MS = 60_000;

let cached: { value: ActiveFeeSchedule; at: number } | null = null;

/** The compiled-in baseline, presented as an ActiveFeeSchedule. */
export function baselineFeeSchedule(): ActiveFeeSchedule {
  return { schedule: DEFAULT_PLATFORM_FEE_SCHEDULE, version: null, effectiveFrom: null };
}

/**
 * Drop the cache. Called by the publish route so the next price uses the new
 * schedule immediately rather than up to a TTL later.
 */
export function invalidateFeeScheduleCache(): void {
  cached = null;
}

/**
 * The schedule in force right now.
 *
 * Falls back to the compiled-in baseline both when nothing is published and
 * when the read fails — pricing must never hard-fail because a config table is
 * unreachable, and the baseline is a known-good schedule rather than a guess.
 */
export async function getActiveFeeSchedule(): Promise<ActiveFeeSchedule> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  try {
    const [row] = await db
      .select()
      .from(platformFeeSchedules)
      .where(isNull(platformFeeSchedules.supersededAt))
      .orderBy(desc(platformFeeSchedules.version))
      .limit(1);

    const value: ActiveFeeSchedule = row
      ? {
          schedule: {
            applicationFee: Number(row.applicationFee),
            underwritingFee: Number(row.underwritingFee),
            taxServiceFee: Number(row.taxServiceFee),
            originationFeeRate: Number(row.originationFeeRate),
          },
          version: row.version,
          effectiveFrom: row.effectiveFrom,
        }
      : baselineFeeSchedule();

    cached = { value, at: Date.now() };
    return value;
  } catch (error) {
    console.error("Failed to read the active platform fee schedule; using the baseline:", error);
    return baselineFeeSchedule();
  }
}

/** Convenience for the many callers that only need the schedule itself. */
export async function activeFeeSchedule(): Promise<PlatformFeeSchedule> {
  return (await getActiveFeeSchedule()).schedule;
}
