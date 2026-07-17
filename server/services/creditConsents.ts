// FCRA consent lifecycle: create, fetch, revoke.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { creditConsents, type InsertCreditConsent, type CreditConsent } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logCreditAction } from "./creditAuditChain";
import { CURRENT_DISCLOSURE_VERSION, FCRA_DISCLOSURE_TEXT } from "./creditCatalogs";

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
  }
): Promise<CreditConsent> {
  const consent: InsertCreditConsent = {
    applicationId: data.applicationId,
    userId: data.userId,
    consentType: data.consentType,
    disclosureVersion: CURRENT_DISCLOSURE_VERSION,
    disclosureText: FCRA_DISCLOSURE_TEXT,
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
      disclosureVersion: CURRENT_DISCLOSURE_VERSION,
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

