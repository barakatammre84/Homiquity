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
// seeded (migration 0047 deliberately inserts no row), so
// DEFAULT_PLATFORM_FEE_SCHEDULE remains the documented default until an admin
// publishes over it.
// ---------------------------------------------------------------------------

import { db } from "../db";
import { platformFeeSchedules, loanEstimateDisclosures } from "@shared/schema";
import { desc, eq, isNull } from "drizzle-orm";
import {
  DEFAULT_PLATFORM_FEE_SCHEDULE,
  type PlatformFeeSchedule,
} from "./loanCosts";

/**
 * Sentinel for "pinned to the compiled-in baseline" — see the tri-state note
 * on loan_estimate_disclosures.fee_schedule_version. Published versions start
 * at 1, so 0 can never collide with one.
 */
export const BASELINE_FEE_SCHEDULE_VERSION = 0;

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

// ---------------------------------------------------------------------------
// Version pinning (audit FA-20)
// ---------------------------------------------------------------------------
// Published rows are immutable, so a resolved version can be cached forever.
const byVersion = new Map<number, PlatformFeeSchedule>();

/**
 * The schedule as published at a specific version.
 *
 * Returns the compiled-in baseline for BASELINE_FEE_SCHEDULE_VERSION, and null
 * when the version is not found — the caller decides what an unresolvable pin
 * means rather than being handed a silently different price.
 */
export async function feeScheduleByVersion(
  version: number,
): Promise<PlatformFeeSchedule | null> {
  if (version === BASELINE_FEE_SCHEDULE_VERSION) return DEFAULT_PLATFORM_FEE_SCHEDULE;

  const hit = byVersion.get(version);
  if (hit) return hit;

  const [row] = await db
    .select()
    .from(platformFeeSchedules)
    .where(eq(platformFeeSchedules.version, version))
    .limit(1);
  if (!row) return null;

  const schedule: PlatformFeeSchedule = {
    applicationFee: Number(row.applicationFee),
    underwritingFee: Number(row.underwritingFee),
    taxServiceFee: Number(row.taxServiceFee),
    originationFeeRate: Number(row.originationFeeRate),
  };
  byVersion.set(version, schedule);
  return schedule;
}

export interface ResolvedFeeSchedule {
  schedule: PlatformFeeSchedule;
  /** The version to pin, using BASELINE_FEE_SCHEDULE_VERSION for the baseline. */
  version: number;
  /** True when this came from an existing pin rather than the active schedule. */
  pinned: boolean;
}

/**
 * The fee schedule that governs a specific file.
 *
 * Once a Loan Estimate has been issued, the file is PINNED to the schedule it
 * was disclosed under, and re-pricing the platform no longer moves its
 * zero-tolerance lines (audit FA-20). Before first issuance — and for
 * disclosures written before the column existed — this is the active schedule,
 * exactly as before.
 */
export async function resolveFeeScheduleForApplication(
  applicationId: string,
): Promise<ResolvedFeeSchedule> {
  // Pricing must never hard-fail because a table is unreachable — the same
  // rule getActiveFeeSchedule follows. A missed pin is recoverable: the
  // disclosure baseline is the backstop, so reconcileDisclosure still serves
  // the borrower the figures that were actually issued rather than these.
  try {
    const [row] = await db
      .select({ feeScheduleVersion: loanEstimateDisclosures.feeScheduleVersion })
      .from(loanEstimateDisclosures)
      .where(eq(loanEstimateDisclosures.applicationId, applicationId))
      .orderBy(desc(loanEstimateDisclosures.version))
      .limit(1);

    const pin = row?.feeScheduleVersion;
    if (pin !== null && pin !== undefined) {
      const pinnedSchedule = await feeScheduleByVersion(pin);
      if (pinnedSchedule) return { schedule: pinnedSchedule, version: pin, pinned: true };
      // A pin we cannot resolve means the row it names is gone — the table is
      // append-only, so this should be impossible. Fall back loudly rather
      // than pricing the file at a schedule it was never disclosed under.
      console.error(
        `Loan estimate for application ${applicationId} pins fee schedule version ${pin}, ` +
          `which no longer exists. Falling back to the active schedule.`,
      );
    }
  } catch (error) {
    console.error(
      `Failed to read the fee schedule pin for application ${applicationId}; ` +
        `using the active schedule:`,
      error,
    );
  }

  const active = await getActiveFeeSchedule();
  return {
    schedule: active.schedule,
    version: active.version ?? BASELINE_FEE_SCHEDULE_VERSION,
    pinned: false,
  };
}
