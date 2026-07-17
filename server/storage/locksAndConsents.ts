// Storage domain: Rate locks, consent templates, borrower consents.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import {
  eq,
  desc,
  and,
  gte,
  lte,
  asc,
  inArray,
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  rateLocks,
  consentTemplates,
  borrowerConsents,
  type RateLock,
  type InsertRateLock,
  type ConsentTemplate,
  type InsertConsentTemplate,
  type BorrowerConsent,
  type InsertBorrowerConsent,
} from "@shared/schema";
import { JourneyStorage } from "./journey";
export class LocksAndConsentsStorage extends JourneyStorage {
  // ===== RATE LOCKS =====
  async createRateLock(data: InsertRateLock): Promise<RateLock> {
    const [lock] = await db.insert(rateLocks).values(data).returning();
    return lock;
  }

  async getRateLock(id: string): Promise<RateLock | undefined> {
    const [lock] = await db.select().from(rateLocks).where(eq(rateLocks.id, id));
    return lock;
  }

  async getRateLocksByApplication(applicationId: string): Promise<RateLock[]> {
    return await db
      .select()
      .from(rateLocks)
      .where(eq(rateLocks.applicationId, applicationId))
      .orderBy(desc(rateLocks.createdAt));
  }

  async getActiveRateLock(applicationId: string): Promise<RateLock | undefined> {
    // An extended lock is still a live lock — treat "extended" as active so the
    // one-active-lock-per-application guard and lookups don't miss it after an
    // extension flips the status.
    const [lock] = await db
      .select()
      .from(rateLocks)
      .where(and(eq(rateLocks.applicationId, applicationId), inArray(rateLocks.status, ["active", "extended"])));
    return lock;
  }

  async updateRateLock(id: string, data: Partial<RateLock>): Promise<RateLock | undefined> {
    const { id: lockId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(rateLocks)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(rateLocks.id, id))
      .returning();
    return updated;
  }

  async getExpiringRateLocks(withinDays: number): Promise<RateLock[]> {
    const now = new Date();
    const futureDate = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(rateLocks)
      .where(
        and(
          // Extended locks still expire — include them, or the alert sweep
          // misses the files most likely to be near expiry (already extended).
          inArray(rateLocks.status, ["active", "extended"]),
          gte(rateLocks.expiresAt, now),
          lte(rateLocks.expiresAt, futureDate)
        )
      )
      .orderBy(asc(rateLocks.expiresAt));
  }

  // ===== CONSENT TEMPLATES =====
  async createConsentTemplate(data: InsertConsentTemplate): Promise<ConsentTemplate> {
    const [template] = await db.insert(consentTemplates).values(data).returning();
    return template;
  }

  async getConsentTemplate(id: string): Promise<ConsentTemplate | undefined> {
    const [template] = await db.select().from(consentTemplates).where(eq(consentTemplates.id, id));
    return template;
  }

  async getActiveConsentTemplates(consentType?: string, state?: string): Promise<ConsentTemplate[]> {
    let query = db.select().from(consentTemplates).where(eq(consentTemplates.isActive, true));
    if (consentType) {
      query = db
        .select()
        .from(consentTemplates)
        .where(and(eq(consentTemplates.isActive, true), eq(consentTemplates.consentType, consentType)));
    }
    return await query.orderBy(desc(consentTemplates.effectiveDate));
  }

  async updateConsentTemplate(id: string, data: Partial<ConsentTemplate>): Promise<ConsentTemplate | undefined> {
    const { id: templateId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(consentTemplates)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(consentTemplates.id, id))
      .returning();
    return updated;
  }

  // ===== BORROWER CONSENTS =====
  async createBorrowerConsent(data: InsertBorrowerConsent): Promise<BorrowerConsent> {
    const [consent] = await db.insert(borrowerConsents).values(data).returning();
    return consent;
  }

  async getBorrowerConsent(id: string): Promise<BorrowerConsent | undefined> {
    const [consent] = await db.select().from(borrowerConsents).where(eq(borrowerConsents.id, id));
    return consent;
  }

  async getBorrowerConsentsByUser(userId: string): Promise<BorrowerConsent[]> {
    return await db
      .select()
      .from(borrowerConsents)
      .where(eq(borrowerConsents.userId, userId))
      .orderBy(desc(borrowerConsents.consentedAt));
  }

  async getBorrowerConsentsByApplication(applicationId: string): Promise<BorrowerConsent[]> {
    return await db
      .select()
      .from(borrowerConsents)
      .where(eq(borrowerConsents.applicationId, applicationId))
      .orderBy(desc(borrowerConsents.consentedAt));
  }

  async getConsentByTypeAndApplication(consentType: string, applicationId: string): Promise<BorrowerConsent | undefined> {
    const [consent] = await db
      .select()
      .from(borrowerConsents)
      .where(
        and(
          eq(borrowerConsents.consentType, consentType),
          eq(borrowerConsents.applicationId, applicationId),
          eq(borrowerConsents.isRevoked, false)
        )
      )
      .orderBy(desc(borrowerConsents.consentedAt))
      .limit(1);
    return consent;
  }

  async getConsentByTypeAndUser(consentType: string, userId: string): Promise<BorrowerConsent | undefined> {
    const [consent] = await db
      .select()
      .from(borrowerConsents)
      .where(
        and(
          eq(borrowerConsents.consentType, consentType),
          eq(borrowerConsents.userId, userId),
          eq(borrowerConsents.isRevoked, false)
        )
      )
      .orderBy(desc(borrowerConsents.consentedAt))
      .limit(1);
    return consent;
  }

  async revokeConsentsByTypeAndUser(consentType: string, userId: string, reason?: string): Promise<BorrowerConsent[]> {
    return await db
      .update(borrowerConsents)
      .set({ isRevoked: true, revokedAt: new Date(), revocationReason: reason ?? null })
      .where(
        and(
          eq(borrowerConsents.consentType, consentType),
          eq(borrowerConsents.userId, userId),
          eq(borrowerConsents.isRevoked, false)
        )
      )
      .returning();
  }

}
