import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { preApprovalLetters, preQualificationLetters, letterGenerationLogs } from "@shared/schema";

/**
 * Letter-expiry sweep.
 *
 * Persists "expired" onto issued letters past their expiration date so the
 * stored row matches what the read paths already compute at read time
 * (shared/letters.ts effectiveLetterStatus). The computed layer removes the
 * drift window between sweep runs; this sweep keeps the row itself honest
 * for anything that reads pre_approval_letters directly — staff queries,
 * reports, and the parked letter-authenticity surface if it ever lands.
 *
 * Only "issued" rows flip — revoked and superseded are terminal statuses
 * written with their own provenance (revokedBy / supersededBy) and must
 * never be overwritten by a clock.
 *
 * Intended to run from a Vercel cron (see server/routes/jobs.ts and
 * vercel.json). Safe to run manually as an admin.
 */
export async function runLetterExpirySweep(): Promise<{
  preApprovalExpired: number;
  preQualExpired: number;
}> {
  const now = new Date();

  const expired = await db
    .update(preApprovalLetters)
    .set({ status: "expired" })
    .where(
      and(
        eq(preApprovalLetters.status, "issued"),
        lt(preApprovalLetters.expirationDate, now),
      ),
    )
    .returning({
      id: preApprovalLetters.id,
      applicationId: preApprovalLetters.applicationId,
    });

  // One ledger row per expired letter, in a single batched insert. Failure is
  // non-fatal: the status flip is the guarantee, the ledger is the narrative.
  if (expired.length > 0) {
    try {
      await db.insert(letterGenerationLogs).values(
        expired.map((letter) => ({
          applicationId: letter.applicationId,
          letterId: letter.id,
          eventType: "letter_expired" as const,
          triggeredBySystem: true,
        })),
      );
    } catch (err) {
      console.error("[letterExpiry] Ledger write failed:", err);
    }
  }

  // Pre-qualification letters share the same issued-past-expiration defect.
  // No ledger rows here — letter_generation_logs' letterId references
  // pre_approval_letters only.
  const prequalExpired = await db
    .update(preQualificationLetters)
    .set({ status: "expired" })
    .where(
      and(
        eq(preQualificationLetters.status, "issued"),
        lt(preQualificationLetters.expirationDate, now),
      ),
    )
    .returning({ id: preQualificationLetters.id });

  return { preApprovalExpired: expired.length, preQualExpired: prequalExpired.length };
}
