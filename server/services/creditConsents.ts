// FCRA consent lifecycle: create, fetch, revoke.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { creditConsents, type InsertCreditConsent, type CreditConsent } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logCreditAction } from "./creditAuditChain";
import { CURRENT_DISCLOSURE_VERSION, FCRA_DISCLOSURE_TEXT } from "./creditCatalogs";

/**
 * Which consent types authorize which pull types (F-035).
 *
 * DENY BY DEFAULT and exact-match. A `soft_pull` consent authorizes ONLY a soft
 * pull — that is the whole point: the pre-approval funnel's checkbox tells the
 * borrower "a soft inquiry, which will not affect my credit score", and before
 * this map existed that consent silently unblocked a hard tri-merge.
 *
 * `hard_pull` covers soft as lesser-included, because the hard-pull disclosure
 * the borrower is shown at /credit-consent explicitly authorizes "both 'soft'
 * inquiries ... and 'hard' inquiries".
 *
 * `credit_pull` and `monitoring` appear in the schema's taxonomy comment but no
 * code path has ever written them; they intentionally authorize nothing, so a
 * future writer fails closed rather than inheriting a guessed permission.
 *
 * ⚠ The MECHANISM here needs no legal interpretation; the MAP does. It encodes a
 * reading of FCRA's written-instruction requirement that could not be verified
 * against primary sources (absent from this repo — escalations U-11/U-12), so it
 * is deliberately the strictest defensible mapping. Widen it only on a ratified
 * answer, never to make a call site pass.
 */
const CONSENT_PULL_COVERAGE: Record<string, readonly string[]> = {
  soft_pull: ["soft"],
  hard_pull: ["soft", "hard", "tri_merge"],
};

/** True when `consentType` authorizes `pullType`. Unknown types authorize nothing. */
export function consentCoversPullType(consentType: string, pullType: string): boolean {
  return (CONSENT_PULL_COVERAGE[consentType] ?? []).includes(pullType);
}

export async function createCreditConsent(
  data: {
    applicationId: string;
    userId: string;
    consentType: string;
    borrowerFullName: string;
    borrowerSSNLast4?: string;
    borrowerDOB?: string;
    consentGiven: boolean;
    ipAddress?: string;
    userAgent?: string;
    /**
     * The disclosure text ACTUALLY RENDERED to this borrower, and its version.
     * The schema contract for this column is "Full text of disclosure shown"
     * (shared/schema/compliance.ts) — so it must be what they saw, not a
     * constant. Hardcoding `FCRA_DISCLOSURE_TEXT` here meant a funnel borrower
     * who only ever saw a one-line soft-inquiry checkbox had a ~1,700-character
     * both-inquiry-types authorization recorded against them, with IP, user
     * agent and signatureType "electronic" attached as e-signature evidence
     * (F-034). Callers pass what they displayed; the fallback preserves prior
     * behaviour only for callers not yet migrated.
     */
    disclosureText?: string;
    disclosureVersion?: string;
  }
): Promise<CreditConsent> {
  const disclosureVersion = data.disclosureVersion ?? CURRENT_DISCLOSURE_VERSION;
  const consent: InsertCreditConsent = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentType: data.consentType,
    disclosureVersion,
    disclosureText: data.disclosureText ?? FCRA_DISCLOSURE_TEXT,
    consentGiven: data.consentGiven,
    consentTimestamp: new Date(),
    borrowerFullName: data.borrowerFullName,
    borrowerSSNLast4: data.borrowerSSNLast4,
    borrowerDOB: data.borrowerDOB,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
    signatureType: "electronic",
    isActive: true,
  };

  const [result] = await db.insert(creditConsents).values(consent).returning();

  await logCreditAction({
    applicationId: data.applicationId,
    userId: data.userId,
    consentId: result.id,
    action: data.consentGiven ? "consent_given" : "consent_declined",
    actionDetails: {
      consentType: data.consentType,
      disclosureVersion,
    },
    performedBy: data.userId,
    ipAddress: data.ipAddress,
    userAgent: data.userAgent,
  });

  return result;
}

export async function getActiveConsent(applicationId: string): Promise<CreditConsent | null> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(
      and(
        eq(creditConsents.applicationId, applicationId),
        eq(creditConsents.isActive, true),
        eq(creditConsents.consentGiven, true)
      )
    )
    .orderBy(desc(creditConsents.consentTimestamp))
    .limit(1);

  return consent || null;
}

export async function getConsentById(consentId: string): Promise<CreditConsent | null> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(eq(creditConsents.id, consentId));
  return consent || null;
}

export async function revokeConsent(
  consentId: string,
  reason: string,
  performedBy: string,
  ipAddress?: string
): Promise<void> {
  const [consent] = await db
    .select()
    .from(creditConsents)
    .where(eq(creditConsents.id, consentId));

  if (!consent) {
    throw new Error("Consent not found");
  }

  await db
    .update(creditConsents)
    .set({
      isActive: false,
      revokedAt: new Date(),
      revokedReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(creditConsents.id, consentId));

  await logCreditAction({
    applicationId: consent.applicationId,
    userId: consent.userId,
    consentId: consentId,
    action: "consent_revoked",
    actionDetails: { reason },
    performedBy,
    ipAddress,
  });
}

