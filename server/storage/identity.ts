// Storage domain: KBA sessions, KYC/AML screenings, onboarding profiles/feedback, co-brand profiles.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  kbaSessions,
  kycScreenings,
  onboardingProfiles,
  onboardingFeedback,
  type KbaSession,
  type InsertKbaSession,
  type KycScreening,
  type InsertKycScreening,
  type OnboardingProfile,
  type InsertOnboardingProfile,
  type OnboardingFeedback,
  type InsertOnboardingFeedback,
  coBrandProfiles,
  type CoBrandProfile,
  type InsertCoBrandProfile,
} from "@shared/schema";
import { MessagingStorage } from "./messaging";
export class IdentityStorage extends MessagingStorage {
  // KBA Sessions
  async createKbaSession(data: InsertKbaSession): Promise<KbaSession> {
    const [session] = await db.insert(kbaSessions).values(data).returning();
    return session;
  }

  async getKbaSession(id: string): Promise<KbaSession | undefined> {
    const [session] = await db.select().from(kbaSessions).where(eq(kbaSessions.id, id));
    return session;
  }

  async getKbaSessionsByUser(userId: string): Promise<KbaSession[]> {
    return db.select().from(kbaSessions).where(eq(kbaSessions.userId, userId)).orderBy(desc(kbaSessions.createdAt));
  }

  async updateKbaSession(id: string, data: Partial<KbaSession>): Promise<KbaSession | undefined> {
    const [updated] = await db.update(kbaSessions).set(data).where(eq(kbaSessions.id, id)).returning();
    return updated;
  }

  // KYC/AML Screenings
  async createKycScreening(data: InsertKycScreening): Promise<KycScreening> {
    const [screening] = await db.insert(kycScreenings).values(data).returning();
    return screening;
  }

  async getKycScreening(id: string): Promise<KycScreening | undefined> {
    const [screening] = await db.select().from(kycScreenings).where(eq(kycScreenings.id, id));
    return screening;
  }

  async getKycScreeningByApplication(applicationId: string): Promise<KycScreening | undefined> {
    const [screening] = await db.select().from(kycScreenings)
      .where(eq(kycScreenings.applicationId, applicationId))
      .orderBy(desc(kycScreenings.createdAt))
      .limit(1);
    return screening;
  }

  async getKycScreeningsByUser(userId: string): Promise<KycScreening[]> {
    return db.select().from(kycScreenings).where(eq(kycScreenings.userId, userId)).orderBy(desc(kycScreenings.createdAt));
  }

  async updateKycScreening(id: string, data: Partial<KycScreening>): Promise<KycScreening | undefined> {
    const [updated] = await db.update(kycScreenings).set({ ...data, updatedAt: new Date() }).where(eq(kycScreenings.id, id)).returning();
    return updated;
  }

  /**
   * Screenings awaiting a compliance decision — the staff clearance queue (F-044).
   *
   * `simulateKycScreening` deliberately refuses to auto-clear ("prevents any
   * automated path from producing a falsely-cleared compliance record") and defers
   * to a staff workflow that did not exist, so every screening sat at
   * `pending_review` forever and nothing could ever reach `cleared`. This is the
   * read side of the workflow it was waiting for.
   */
  async getKycScreeningsPendingReview(): Promise<KycScreening[]> {
    return db
      .select()
      .from(kycScreenings)
      .where(eq(kycScreenings.overallStatus, "pending_review"))
      .orderBy(desc(kycScreenings.createdAt));
  }

  // Onboarding Profiles
  async createOnboardingProfile(data: InsertOnboardingProfile): Promise<OnboardingProfile> {
    const [profile] = await db.insert(onboardingProfiles).values({
      ...data,
      completedSteps: data.completedSteps || [],
    } as any).returning();
    return profile;
  }

  async getOnboardingProfile(id: string): Promise<OnboardingProfile | undefined> {
    const [profile] = await db.select().from(onboardingProfiles).where(eq(onboardingProfiles.id, id));
    return profile;
  }

  async getOnboardingProfileByUser(userId: string): Promise<OnboardingProfile | undefined> {
    const [profile] = await db.select().from(onboardingProfiles)
      .where(eq(onboardingProfiles.userId, userId))
      .orderBy(desc(onboardingProfiles.createdAt))
      .limit(1);
    return profile;
  }

  async updateOnboardingProfile(id: string, data: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined> {
    const [updated] = await db.update(onboardingProfiles).set({ ...data, updatedAt: new Date() }).where(eq(onboardingProfiles.id, id)).returning();
    return updated;
  }

  // Onboarding Feedback
  async createOnboardingFeedback(data: InsertOnboardingFeedback): Promise<OnboardingFeedback> {
    const [feedback] = await db.insert(onboardingFeedback).values(data).returning();
    return feedback;
  }

  async getOnboardingFeedbackByUser(userId: string): Promise<OnboardingFeedback[]> {
    return db.select().from(onboardingFeedback).where(eq(onboardingFeedback.userId, userId)).orderBy(desc(onboardingFeedback.createdAt));
  }

  // Co-Brand Profiles
  async createCoBrandProfile(data: InsertCoBrandProfile): Promise<CoBrandProfile> {
    const [profile] = await db.insert(coBrandProfiles).values(data).returning();
    return profile;
  }

  async getCoBrandProfile(id: string): Promise<CoBrandProfile | undefined> {
    const [profile] = await db.select().from(coBrandProfiles).where(eq(coBrandProfiles.id, id));
    return profile;
  }

  async getCoBrandProfileByUser(userId: string): Promise<CoBrandProfile | undefined> {
    const [profile] = await db.select().from(coBrandProfiles).where(eq(coBrandProfiles.userId, userId)).limit(1);
    return profile;
  }

  async updateCoBrandProfile(id: string, data: Partial<CoBrandProfile>): Promise<CoBrandProfile | undefined> {
    const [updated] = await db.update(coBrandProfiles).set({ ...data, updatedAt: new Date() }).where(eq(coBrandProfiles.id, id)).returning();
    return updated;
  }

}
