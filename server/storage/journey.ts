// Storage domain: Calculator results/profiles, homeownership goals, credit actions, savings, journey milestones, application invites.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, asc } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  calculatorResults,
  homeownershipGoals,
  creditActions,
  savingsTransactions,
  journeyMilestones,
  applicationInvites,
  type CalculatorResult,
  type InsertCalculatorResult,
  type CalculatorProfile,
  type InsertCalculatorProfile,
  calculatorProfiles,
  type HomeownershipGoal,
  type InsertHomeownershipGoal,
  type CreditAction,
  type InsertCreditAction,
  type SavingsTransaction,
  type InsertSavingsTransaction,
  type JourneyMilestone,
  type InsertJourneyMilestone,
  type ApplicationInvite,
  type InsertApplicationInvite,
} from "@shared/schema";
import { BrokerReferralsStorage } from "./brokerReferrals";
export class JourneyStorage extends BrokerReferralsStorage {
  // Calculator Results
  async createCalculatorResult(data: InsertCalculatorResult): Promise<CalculatorResult> {
    const [result] = await db
      .insert(calculatorResults)
      .values(data)
      .returning();
    return result;
  }

  async getCalculatorResultsByUser(userId: string): Promise<CalculatorResult[]> {
    return await db
      .select()
      .from(calculatorResults)
      .where(eq(calculatorResults.userId, userId))
      .orderBy(desc(calculatorResults.createdAt));
  }

  async getLatestCalculatorResult(userId: string, type: string): Promise<CalculatorResult | undefined> {
    const [result] = await db
      .select()
      .from(calculatorResults)
      .where(and(eq(calculatorResults.userId, userId), eq(calculatorResults.calculatorType, type)))
      .orderBy(desc(calculatorResults.createdAt))
      .limit(1);
    return result;
  }

  // Calculator Profiles (Lead Capture)
  async upsertCalculatorProfile(email: string, data: Partial<InsertCalculatorProfile>): Promise<CalculatorProfile> {
    const existing = await this.getCalculatorProfileByEmail(email);
    if (existing) {
      const [updated] = await db
        .update(calculatorProfiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(calculatorProfiles.email, email))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(calculatorProfiles)
      .values({ ...data, email } as InsertCalculatorProfile)
      .returning();
    return created;
  }

  async getCalculatorProfileByEmail(email: string): Promise<CalculatorProfile | undefined> {
    const [result] = await db
      .select()
      .from(calculatorProfiles)
      .where(eq(calculatorProfiles.email, email))
      .limit(1);
    return result;
  }

  // Homeownership Goals (Aspiring Owner Journey)
  async getHomeownershipGoal(userId: string): Promise<HomeownershipGoal | undefined> {
    const [goal] = await db
      .select()
      .from(homeownershipGoals)
      .where(eq(homeownershipGoals.userId, userId));
    return goal;
  }

  async createHomeownershipGoal(data: InsertHomeownershipGoal): Promise<HomeownershipGoal> {
    const [goal] = await db
      .insert(homeownershipGoals)
      .values(data)
      .returning();
    return goal;
  }

  async updateHomeownershipGoal(userId: string, data: Partial<HomeownershipGoal>): Promise<HomeownershipGoal | undefined> {
    const { id, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(homeownershipGoals)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(homeownershipGoals.userId, userId))
      .returning();
    return updated;
  }

  // Credit Actions
  async getCreditActions(goalId: string): Promise<CreditAction[]> {
    return await db
      .select()
      .from(creditActions)
      .where(eq(creditActions.goalId, goalId))
      .orderBy(desc(creditActions.priority), asc(creditActions.createdAt));
  }

  async getCreditActionById(id: string): Promise<CreditAction | undefined> {
    const [action] = await db.select().from(creditActions).where(eq(creditActions.id, id));
    return action;
  }

  async createCreditAction(data: InsertCreditAction): Promise<CreditAction> {
    const [action] = await db
      .insert(creditActions)
      .values(data)
      .returning();
    return action;
  }

  async updateCreditAction(id: string, data: Partial<CreditAction>, ownerGoalId?: string): Promise<CreditAction | undefined> {
    const { id: actionId, createdAt, goalId, ...cleanData } = data as any;
    const whereClause = ownerGoalId
      ? and(eq(creditActions.id, id), eq(creditActions.goalId, ownerGoalId))
      : eq(creditActions.id, id);
    const [updated] = await db
      .update(creditActions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(whereClause)
      .returning();
    return updated;
  }

  // Savings Transactions
  async getSavingsTransactions(goalId: string): Promise<SavingsTransaction[]> {
    return await db
      .select()
      .from(savingsTransactions)
      .where(eq(savingsTransactions.goalId, goalId))
      .orderBy(desc(savingsTransactions.createdAt));
  }

  async createSavingsTransaction(data: InsertSavingsTransaction): Promise<SavingsTransaction> {
    const [transaction] = await db
      .insert(savingsTransactions)
      .values(data)
      .returning();
    return transaction;
  }

  // Journey Milestones
  async getJourneyMilestones(goalId: string): Promise<JourneyMilestone[]> {
    return await db
      .select()
      .from(journeyMilestones)
      .where(eq(journeyMilestones.goalId, goalId))
      .orderBy(desc(journeyMilestones.achievedAt));
  }

  async createJourneyMilestone(data: InsertJourneyMilestone): Promise<JourneyMilestone> {
    const [milestone] = await db
      .insert(journeyMilestones)
      .values(data)
      .returning();
    return milestone;
  }

  // Application Invites
  async createApplicationInvite(data: InsertApplicationInvite): Promise<ApplicationInvite> {
    const [invite] = await db
      .insert(applicationInvites)
      .values(data)
      .returning();
    return invite;
  }

  async getApplicationInviteByToken(token: string): Promise<ApplicationInvite | undefined> {
    const [invite] = await db
      .select()
      .from(applicationInvites)
      .where(eq(applicationInvites.token, token));
    return invite;
  }

  async getApplicationInvitesByReferrer(referrerId: string): Promise<ApplicationInvite[]> {
    return await db
      .select()
      .from(applicationInvites)
      .where(eq(applicationInvites.referrerId, referrerId))
      .orderBy(desc(applicationInvites.createdAt));
  }

  async updateApplicationInvite(id: string, data: Partial<ApplicationInvite>): Promise<ApplicationInvite | undefined> {
    const { id: inviteId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationInvites)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(applicationInvites.id, id))
      .returning();
    return updated;
  }

}
