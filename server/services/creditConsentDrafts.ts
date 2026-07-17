// Consent draft save & resume.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { draftConsentProgress, type InsertDraftConsentProgress, type DraftConsentProgress } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { logCreditAction } from "./creditAuditChain";

export async function saveDraftConsent(
  applicationId: string,
  userId: string,
  data: Partial<InsertDraftConsentProgress>
): Promise<DraftConsentProgress> {
  const existing = await db
    .select()
    .from(draftConsentProgress)
    .where(and(
      eq(draftConsentProgress.applicationId, applicationId),
      eq(draftConsentProgress.userId, userId)
    ))
    .limit(1);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  
  if (existing.length > 0) {
    const [updated] = await db
      .update(draftConsentProgress)
      .set({
        ...data,
        lastSavedAt: new Date(),
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(draftConsentProgress.id, existing[0].id))
      .returning();
    
    await logCreditAction({
      applicationId,
      userId,
      action: "consent_progress_saved",
      actionDetails: {
        currentStep: data.currentStep,
        disclosureRead: data.disclosureRead,
        acknowledged: data.acknowledged,
      },
      performedBy: userId,
    });
    
    return updated;
  } else {
    const [created] = await db
      .insert(draftConsentProgress)
      .values({
        applicationId,
        userId,
        ...data,
        lastSavedAt: new Date(),
        expiresAt,
      })
      .returning();
    
    await logCreditAction({
      applicationId,
      userId,
      action: "consent_progress_started",
      actionDetails: {
        consentType: data.consentType || "hard_pull",
      },
      performedBy: userId,
    });
    
    return created;
  }
}

export async function getDraftConsent(
  applicationId: string,
  userId: string
): Promise<DraftConsentProgress | null> {
  const result = await db
    .select()
    .from(draftConsentProgress)
    .where(and(
      eq(draftConsentProgress.applicationId, applicationId),
      eq(draftConsentProgress.userId, userId)
    ))
    .limit(1);
  
  if (result.length === 0) return null;
  
  const draft = result[0];
  if (draft.expiresAt && new Date(draft.expiresAt) < new Date()) {
    await deleteDraftConsent(applicationId, userId);
    return null;
  }
  
  return draft;
}

export async function deleteDraftConsent(
  applicationId: string,
  userId: string
): Promise<void> {
  await db
    .delete(draftConsentProgress)
    .where(and(
      eq(draftConsentProgress.applicationId, applicationId),
      eq(draftConsentProgress.userId, userId)
    ));
}

export async function cleanupExpiredDrafts(): Promise<number> {
  const result = await db
    .delete(draftConsentProgress)
    .where(lt(draftConsentProgress.expiresAt, new Date()))
    .returning();
  
  return result.length;
}

