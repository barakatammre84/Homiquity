// Storage domain: Deal desk, DPA, agent pipeline access, rescue escalations, strategy sessions, accelerator, coaching, closing guarantees, homeowner profiles, refi alerts, equity snapshots.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, sql, or, isNull, lte, gte, inArray } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  users,
  dealDeskThreads,
  dealDeskMessages,
  type DealDeskThread,
  type InsertDealDeskThread,
  type DealDeskMessage,
  type InsertDealDeskMessage,
  dpaPrograms,
  type DpaProgram,
  agentPipelineAccess,
  dealRescueEscalations,
  strategySessions,
  acceleratorEnrollments,
  acceleratorMilestones,
  coachingSessions,
  closingGuarantees,
  homeownerProfiles,
  refiAlerts,
  equitySnapshots,
  type AgentPipelineAccess,
  type InsertAgentPipelineAccess,
  type DealRescueEscalation,
  type InsertDealRescueEscalation,
  type StrategySession,
  type InsertStrategySession,
  type AcceleratorEnrollment,
  type InsertAcceleratorEnrollment,
  type AcceleratorMilestone,
  type InsertAcceleratorMilestone,
  type CoachingSession,
  type InsertCoachingSession,
  type ClosingGuarantee,
  type InsertClosingGuarantee,
  type HomeownerProfile,
  type InsertHomeownerProfile,
  type RefiAlert,
  type InsertRefiAlert,
  type EquitySnapshot,
  type InsertEquitySnapshot,
} from "@shared/schema";
import { IdentityStorage } from "./identity";
export class RealtorHomeownerStorage extends IdentityStorage {
  // Deal Desk
  async createDealDeskThread(data: InsertDealDeskThread): Promise<DealDeskThread> {
    const [thread] = await db.insert(dealDeskThreads).values(data).returning();
    return thread;
  }

  async getDealDeskThread(id: string): Promise<DealDeskThread | undefined> {
    const [thread] = await db.select().from(dealDeskThreads).where(eq(dealDeskThreads.id, id));
    return thread;
  }

  async getDealDeskThreadsByUser(userId: string): Promise<DealDeskThread[]> {
    return db.select().from(dealDeskThreads)
      .where(or(eq(dealDeskThreads.agentUserId, userId), eq(dealDeskThreads.loUserId, userId)))
      .orderBy(desc(dealDeskThreads.createdAt));
  }

  async updateDealDeskThread(id: string, data: Partial<DealDeskThread>): Promise<DealDeskThread | undefined> {
    const [updated] = await db.update(dealDeskThreads).set({ ...data, updatedAt: new Date() }).where(eq(dealDeskThreads.id, id)).returning();
    return updated;
  }

  async createDealDeskMessage(data: InsertDealDeskMessage): Promise<DealDeskMessage> {
    const [message] = await db.insert(dealDeskMessages).values(data).returning();
    return message;
  }

  async getDealDeskMessagesByThread(threadId: string): Promise<DealDeskMessage[]> {
    return db.select().from(dealDeskMessages)
      .where(eq(dealDeskMessages.threadId, threadId))
      .orderBy(dealDeskMessages.createdAt);
  }

  // DPA Programs
  async getDpaPrograms(filters?: { state?: string; firstTimeBuyer?: boolean; minCreditScore?: number; maxIncome?: number }): Promise<DpaProgram[]> {
    const conditions = [eq(dpaPrograms.isActive, true)];
    if (filters?.state) {
      conditions.push(or(eq(dpaPrograms.state, filters.state), isNull(dpaPrograms.state))!);
    }
    // firstTimeBuyer === true adds no condition: first-time buyers qualify for
    // both first-time-only and general programs.
    if (filters?.firstTimeBuyer === false) {
      conditions.push(eq(dpaPrograms.firstTimeBuyerOnly, false));
    }
    // A program with no published limit stays visible under either filter.
    if (filters?.minCreditScore !== undefined) {
      conditions.push(or(isNull(dpaPrograms.minCreditScore), lte(dpaPrograms.minCreditScore, filters.minCreditScore))!);
    }
    if (filters?.maxIncome !== undefined) {
      conditions.push(or(isNull(dpaPrograms.maxIncome), gte(dpaPrograms.maxIncome, String(filters.maxIncome)))!);
    }
    return db.select().from(dpaPrograms).where(and(...conditions)).orderBy(dpaPrograms.name);
  }

  async getDpaProgram(id: string): Promise<DpaProgram | undefined> {
    const [program] = await db.select().from(dpaPrograms).where(eq(dpaPrograms.id, id));
    return program;
  }

  // Agent Pipeline Access
  async getAgentPipeline(agentUserId: string): Promise<AgentPipelineAccess[]> {
    return db.select().from(agentPipelineAccess)
      .where(eq(agentPipelineAccess.agentUserId, agentUserId))
      .orderBy(desc(agentPipelineAccess.createdAt));
  }

  async upsertAgentPipelineAccess(data: InsertAgentPipelineAccess): Promise<AgentPipelineAccess> {
    const [result] = await db
      .insert(agentPipelineAccess)
      .values(data)
      .onConflictDoUpdate({
        target: [agentPipelineAccess.agentUserId, agentPipelineAccess.applicationId],
        set: {
          borrowerName: data.borrowerName,
          currentStage: data.currentStage,
          lastMilestone: data.lastMilestone,
          nextStep: data.nextStep,
          estimatedCloseDate: data.estimatedCloseDate,
          loanAmount: data.loanAmount,
          propertyAddress: data.propertyAddress,
          lastUpdatedAt: new Date(),
        },
      })
      .returning();
    return result;
  }

  // Deal Rescue Escalations
  async getDealRescueEscalations(filters?: { status?: string; reportedByUserId?: string }): Promise<DealRescueEscalation[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(dealRescueEscalations.status, filters.status));
    }
    if (filters?.reportedByUserId) {
      conditions.push(eq(dealRescueEscalations.reportedByUserId, filters.reportedByUserId));
    }
    if (conditions.length > 0) {
      return db.select().from(dealRescueEscalations)
        .where(and(...conditions))
        .orderBy(desc(dealRescueEscalations.createdAt));
    }
    return db.select().from(dealRescueEscalations)
      .orderBy(desc(dealRescueEscalations.createdAt));
  }

  async getDealRescueEscalation(id: string): Promise<DealRescueEscalation | undefined> {
    const [escalation] = await db.select().from(dealRescueEscalations)
      .where(eq(dealRescueEscalations.id, id))
      .limit(1);
    return escalation;
  }

  async createDealRescueEscalation(data: InsertDealRescueEscalation): Promise<DealRescueEscalation> {
    const [escalation] = await db.insert(dealRescueEscalations).values(data).returning();
    return escalation;
  }

  async updateDealRescueEscalation(id: string, data: Partial<DealRescueEscalation>): Promise<DealRescueEscalation | undefined> {
    const [updated] = await db.update(dealRescueEscalations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealRescueEscalations.id, id))
      .returning();
    return updated;
  }

  // Strategy Sessions
  async getStrategySessions(agentUserId: string): Promise<StrategySession[]> {
    return db.select().from(strategySessions)
      .where(eq(strategySessions.agentUserId, agentUserId))
      .orderBy(desc(strategySessions.createdAt));
  }

  async getStrategySession(id: string): Promise<StrategySession | undefined> {
    const [session] = await db.select().from(strategySessions)
      .where(eq(strategySessions.id, id))
      .limit(1);
    return session;
  }

  async createStrategySession(data: InsertStrategySession): Promise<StrategySession> {
    const [session] = await db.insert(strategySessions).values(data).returning();
    return session;
  }

  async updateStrategySession(id: string, data: Partial<StrategySession>): Promise<StrategySession | undefined> {
    const [updated] = await db.update(strategySessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(strategySessions.id, id))
      .returning();
    return updated;
  }

  // Accelerator Enrollments
  async getAcceleratorEnrollment(userId: string): Promise<AcceleratorEnrollment | undefined> {
    const [enrollment] = await db.select().from(acceleratorEnrollments)
      .where(eq(acceleratorEnrollments.userId, userId))
      .limit(1);
    return enrollment;
  }

  async createAcceleratorEnrollment(data: InsertAcceleratorEnrollment): Promise<AcceleratorEnrollment> {
    const [enrollment] = await db.insert(acceleratorEnrollments).values(data).returning();
    return enrollment;
  }

  async updateAcceleratorEnrollment(id: string, data: Partial<AcceleratorEnrollment>): Promise<AcceleratorEnrollment | undefined> {
    const [updated] = await db.update(acceleratorEnrollments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(acceleratorEnrollments.id, id))
      .returning();
    return updated;
  }

  // Accelerator Milestones
  async getAcceleratorMilestones(enrollmentId: string): Promise<AcceleratorMilestone[]> {
    return db.select().from(acceleratorMilestones)
      .where(eq(acceleratorMilestones.enrollmentId, enrollmentId))
      .orderBy(desc(acceleratorMilestones.createdAt));
  }

  async getAcceleratorMilestoneById(id: string): Promise<AcceleratorMilestone | undefined> {
    const [milestone] = await db.select().from(acceleratorMilestones).where(eq(acceleratorMilestones.id, id));
    return milestone;
  }

  async createAcceleratorMilestone(data: InsertAcceleratorMilestone): Promise<AcceleratorMilestone> {
    const [milestone] = await db.insert(acceleratorMilestones).values(data).returning();
    return milestone;
  }

  async updateAcceleratorMilestone(id: string, data: Partial<AcceleratorMilestone>, ownerEnrollmentId?: string): Promise<AcceleratorMilestone | undefined> {
    const { enrollmentId, ...cleanData } = data as any;
    const whereClause = ownerEnrollmentId
      ? and(eq(acceleratorMilestones.id, id), eq(acceleratorMilestones.enrollmentId, ownerEnrollmentId))
      : eq(acceleratorMilestones.id, id);
    const [updated] = await db.update(acceleratorMilestones)
      .set(cleanData)
      .where(whereClause)
      .returning();
    return updated;
  }

  // Coaching Sessions
  async getCoachingSessions(enrollmentId: string): Promise<CoachingSession[]> {
    return db.select().from(coachingSessions)
      .where(eq(coachingSessions.enrollmentId, enrollmentId))
      .orderBy(desc(coachingSessions.createdAt));
  }

  async getCoachingSessionById(id: string): Promise<CoachingSession | undefined> {
    const [session] = await db.select().from(coachingSessions).where(eq(coachingSessions.id, id));
    return session;
  }

  async createCoachingSession(data: InsertCoachingSession): Promise<CoachingSession> {
    const [session] = await db.insert(coachingSessions).values(data).returning();
    return session;
  }

  /**
   * Every session still waiting on a loan officer, oldest request first, with
   * the borrower's name resolved.
   *
   * Deliberately NOT scoped to one enrollment: this is the staff queue, and the
   * borrowers it serves are aspiring owners with no loan application, so none
   * of the application-shaped queues (getUnassignedApplications, the task
   * engine) can see them. Ordered by the time the borrower ASKED, not the time
   * they asked FOR — the oldest unanswered request is the one that has been
   * waiting on us longest.
   */
  async getPendingCoachingSessions(
    statuses: readonly string[],
  ): Promise<Array<CoachingSession & { borrowerName: string; borrowerUserId: string }>> {
    if (statuses.length === 0) return [];
    const rows = await db
      .select({
        session: coachingSessions,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        userId: users.id,
      })
      .from(coachingSessions)
      .innerJoin(acceleratorEnrollments, eq(coachingSessions.enrollmentId, acceleratorEnrollments.id))
      .innerJoin(users, eq(acceleratorEnrollments.userId, users.id))
      .where(inArray(coachingSessions.status, [...statuses]))
      .orderBy(coachingSessions.createdAt);

    return rows.map((r) => ({
      ...r.session,
      borrowerUserId: r.userId,
      borrowerName:
        [r.firstName, r.lastName].filter(Boolean).join(" ") || r.email || "A borrower",
    }));
  }

  async updateCoachingSession(id: string, data: Partial<CoachingSession>, ownerEnrollmentId?: string): Promise<CoachingSession | undefined> {
    const { enrollmentId, ...cleanData } = data as any;
    const whereClause = ownerEnrollmentId
      ? and(eq(coachingSessions.id, id), eq(coachingSessions.enrollmentId, ownerEnrollmentId))
      : eq(coachingSessions.id, id);
    const [updated] = await db.update(coachingSessions)
      .set(cleanData)
      .where(whereClause)
      .returning();
    return updated;
  }

  // Closing Guarantees
  async getAllClosingGuarantees(): Promise<ClosingGuarantee[]> {
    return db.select().from(closingGuarantees)
      .orderBy(desc(closingGuarantees.createdAt));
  }

  async getClosingGuarantees(applicationId: string): Promise<ClosingGuarantee[]> {
    return db.select().from(closingGuarantees)
      .where(eq(closingGuarantees.applicationId, applicationId))
      .orderBy(desc(closingGuarantees.createdAt));
  }

  async getClosingGuarantee(id: string): Promise<ClosingGuarantee | undefined> {
    const [guarantee] = await db.select().from(closingGuarantees)
      .where(eq(closingGuarantees.id, id))
      .limit(1);
    return guarantee;
  }

  async createClosingGuarantee(data: InsertClosingGuarantee): Promise<ClosingGuarantee> {
    const [guarantee] = await db.insert(closingGuarantees).values(data).returning();
    return guarantee;
  }

  async updateClosingGuarantee(id: string, data: Partial<ClosingGuarantee>): Promise<ClosingGuarantee | undefined> {
    const [updated] = await db.update(closingGuarantees)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(closingGuarantees.id, id))
      .returning();
    return updated;
  }

  // Homeowner Profiles
  async getHomeownerProfile(userId: string): Promise<HomeownerProfile | undefined> {
    const [profile] = await db.select().from(homeownerProfiles)
      .where(eq(homeownerProfiles.userId, userId))
      .limit(1);
    return profile;
  }

  async createHomeownerProfile(data: InsertHomeownerProfile): Promise<HomeownerProfile> {
    const [profile] = await db.insert(homeownerProfiles).values(data).returning();
    return profile;
  }

  async updateHomeownerProfile(id: string, data: Partial<HomeownerProfile>): Promise<HomeownerProfile | undefined> {
    const [updated] = await db.update(homeownerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(homeownerProfiles.id, id))
      .returning();
    return updated;
  }

  // Refi Alerts
  async getRefiAlerts(homeownerProfileId: string): Promise<RefiAlert[]> {
    return db.select().from(refiAlerts)
      .where(eq(refiAlerts.homeownerProfileId, homeownerProfileId))
      .orderBy(desc(refiAlerts.createdAt));
  }

  async getRefiAlertById(id: string): Promise<RefiAlert | undefined> {
    const [alert] = await db.select().from(refiAlerts).where(eq(refiAlerts.id, id));
    return alert;
  }

  async createRefiAlert(data: InsertRefiAlert): Promise<RefiAlert> {
    const [alert] = await db.insert(refiAlerts).values(data).returning();
    return alert;
  }

  async updateRefiAlert(id: string, data: Partial<RefiAlert>, ownerProfileId?: string): Promise<RefiAlert | undefined> {
    const { homeownerProfileId, ...cleanData } = data as any;
    const whereClause = ownerProfileId
      ? and(eq(refiAlerts.id, id), eq(refiAlerts.homeownerProfileId, ownerProfileId))
      : eq(refiAlerts.id, id);
    const [updated] = await db.update(refiAlerts)
      .set(cleanData)
      .where(whereClause)
      .returning();
    return updated;
  }

  // Equity Snapshots
  async getEquitySnapshots(homeownerProfileId: string): Promise<EquitySnapshot[]> {
    return db.select().from(equitySnapshots)
      .where(eq(equitySnapshots.homeownerProfileId, homeownerProfileId))
      .orderBy(desc(equitySnapshots.createdAt));
  }

  async createEquitySnapshot(data: InsertEquitySnapshot): Promise<EquitySnapshot> {
    const [snapshot] = await db.insert(equitySnapshots).values(data).returning();
    return snapshot;
  }

}
