// Storage domain: Loan pipeline tracking: milestones, conditions, requirement rules, underwriting snapshots, application properties, deal team, LO assignment/pool.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { groupRowsByKeyDense } from "./batchGroup";
import {
  eq,
  desc,
  and,
  sql,
  asc,
  inArray,
  ne,
  isNull,
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  users,
  loanApplications,
  loanMilestones,
  loanConditions,
  documentRequirementRules,
  underwritingSnapshots,
  applicationProperties,
  dealTeamMembers,
  type User,
  type LoanApplication,
  type LoanMilestone,
  type InsertLoanMilestone,
  type LoanCondition,
  type InsertLoanCondition,
  type DocumentRequirementRule,
  type InsertDocumentRequirementRule,
  type UnderwritingSnapshot,
  type InsertUnderwritingSnapshot,
  type ApplicationProperty,
  type InsertApplicationProperty,
  type DealTeamMember,
  type InsertDealTeamMember,
} from "@shared/schema";
import { AgentProfilesStorage } from "./agentProfiles";
export class PipelineStorage extends AgentProfilesStorage {
  // ============================================================================
  // LOAN PIPELINE TRACKING
  // ============================================================================

  // Loan Milestones
  async createLoanMilestone(data: InsertLoanMilestone): Promise<LoanMilestone> {
    const [milestone] = await db.insert(loanMilestones).values(data).returning();
    return milestone;
  }

  async getLoanMilestones(applicationId: string): Promise<LoanMilestone | undefined> {
    const [milestone] = await db
      .select()
      .from(loanMilestones)
      .where(eq(loanMilestones.applicationId, applicationId))
      .limit(1);
    return milestone;
  }

  async updateLoanMilestones(applicationId: string, data: Partial<LoanMilestone>): Promise<LoanMilestone | undefined> {
    const { createdAt, updatedAt, id, ...cleanData } = data as any;
    const [updated] = await db
      .update(loanMilestones)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(loanMilestones.applicationId, applicationId))
      .returning();
    return updated;
  }

  // Loan Conditions
  async createLoanCondition(data: InsertLoanCondition): Promise<LoanCondition> {
    const [condition] = await db.insert(loanConditions).values(data).returning();
    return condition;
  }

  // Single batched insert (never insert in a loop).
  async createLoanConditions(data: InsertLoanCondition[]): Promise<LoanCondition[]> {
    if (data.length === 0) return [];
    return await db.insert(loanConditions).values(data).returning();
  }

  async getLoanCondition(id: string): Promise<LoanCondition | undefined> {
    const [condition] = await db
      .select()
      .from(loanConditions)
      .where(eq(loanConditions.id, id))
      .limit(1);
    return condition;
  }

  async getLoanConditionsByApplication(applicationId: string): Promise<LoanCondition[]> {
    return await db
      .select()
      .from(loanConditions)
      .where(eq(loanConditions.applicationId, applicationId))
      .orderBy(loanConditions.priority, desc(loanConditions.createdAt));
  }

  // Batched variant of getLoanConditionsByApplication for list views. Same
  // `orderBy`, so each bucket matches the per-application query's ordering
  // (see ./batchGroup.ts).
  async getLoanConditionsByApplications(
    applicationIds: string[],
  ): Promise<Map<string, LoanCondition[]>> {
    if (applicationIds.length === 0) return new Map();
    const rows = await db
      .select()
      .from(loanConditions)
      .where(inArray(loanConditions.applicationId, applicationIds))
      .orderBy(loanConditions.priority, desc(loanConditions.createdAt));
    return groupRowsByKeyDense(applicationIds, rows, (row) => row.applicationId!);
  }

  // One batched fetch for per-submission condition rollups (inArray — never
  // query per submission in a loop).
  async getLoanConditionsBySubmissionIds(submissionIds: string[]): Promise<LoanCondition[]> {
    if (submissionIds.length === 0) return [];
    return await db
      .select()
      .from(loanConditions)
      .where(inArray(loanConditions.lenderSubmissionId, submissionIds))
      .orderBy(desc(loanConditions.createdAt));
  }

  async updateLoanCondition(id: string, data: Partial<LoanCondition>): Promise<LoanCondition | undefined> {
    const { createdAt, updatedAt, id: condId, ...cleanData } = data as any;
    const [updated] = await db
      .update(loanConditions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(loanConditions.id, id))
      .returning();
    return updated;
  }

  async deleteLoanCondition(id: string): Promise<void> {
    await db.delete(loanConditions).where(eq(loanConditions.id, id));
  }

  async clearLoanCondition(id: string, userId: string, notes?: string): Promise<LoanCondition | undefined> {
    const [updated] = await db
      .update(loanConditions)
      .set({
        status: "cleared",
        clearedByUserId: userId,
        clearedAt: new Date(),
        clearanceNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(loanConditions.id, id))
      .returning();
    return updated;
  }

  // Document Requirement Rules
  async createDocumentRequirementRule(data: InsertDocumentRequirementRule): Promise<DocumentRequirementRule> {
    const [rule] = await db.insert(documentRequirementRules).values(data).returning();
    return rule;
  }

  async getDocumentRequirementRule(id: string): Promise<DocumentRequirementRule | undefined> {
    const [rule] = await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.id, id))
      .limit(1);
    return rule;
  }

  async getAllDocumentRequirementRules(): Promise<DocumentRequirementRule[]> {
    return await db
      .select()
      .from(documentRequirementRules)
      .where(eq(documentRequirementRules.isActive, true))
      .orderBy(documentRequirementRules.priority);
  }

  async updateDocumentRequirementRule(id: string, data: Partial<DocumentRequirementRule>): Promise<DocumentRequirementRule | undefined> {
    const { createdAt, updatedAt, id: ruleId, ...cleanData } = data as any;
    const [updated] = await db
      .update(documentRequirementRules)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(documentRequirementRules.id, id))
      .returning();
    return updated;
  }

  // Underwriting Snapshots
  async createUnderwritingSnapshot(data: InsertUnderwritingSnapshot): Promise<UnderwritingSnapshot> {
    const [snapshot] = await db.insert(underwritingSnapshots).values(data).returning();
    return snapshot;
  }

  async getUnderwritingSnapshotsByApplication(applicationId: string): Promise<UnderwritingSnapshot[]> {
    return await db
      .select()
      .from(underwritingSnapshots)
      .where(eq(underwritingSnapshots.loanId, applicationId))
      .orderBy(desc(underwritingSnapshots.createdAt));
  }

  async getLatestUnderwritingSnapshot(applicationId: string): Promise<UnderwritingSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(underwritingSnapshots)
      .where(eq(underwritingSnapshots.loanId, applicationId))
      .orderBy(desc(underwritingSnapshots.createdAt))
      .limit(1);
    return snapshot;
  }

  // Application Properties - multi-property support
  async createApplicationProperty(data: InsertApplicationProperty): Promise<ApplicationProperty> {
    // If this is marked as current, unset current on other properties for this application
    if (data.isCurrentProperty) {
      await db
        .update(applicationProperties)
        .set({ isCurrentProperty: false, updatedAt: new Date() })
        .where(eq(applicationProperties.applicationId, data.applicationId));
    }
    const [property] = await db.insert(applicationProperties).values(data).returning();
    return property;
  }

  async getApplicationProperties(applicationId: string): Promise<ApplicationProperty[]> {
    return await db
      .select()
      .from(applicationProperties)
      .where(eq(applicationProperties.applicationId, applicationId))
      .orderBy(desc(applicationProperties.createdAt));
  }

  async getCurrentProperty(applicationId: string): Promise<ApplicationProperty | undefined> {
    const [property] = await db
      .select()
      .from(applicationProperties)
      .where(
        and(
          eq(applicationProperties.applicationId, applicationId),
          eq(applicationProperties.isCurrentProperty, true)
        )
      )
      .limit(1);
    return property;
  }

  async updateApplicationProperty(applicationId: string, propertyId: string, data: Partial<ApplicationProperty>): Promise<ApplicationProperty | undefined> {
    const { id: propId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationProperties)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(and(eq(applicationProperties.id, propertyId), eq(applicationProperties.applicationId, applicationId)))
      .returning();
    return updated;
  }

  async switchToProperty(applicationId: string, propertyId: string): Promise<ApplicationProperty | undefined> {
    // First, unset current on all properties for this application
    await db
      .update(applicationProperties)
      .set({ isCurrentProperty: false, updatedAt: new Date() })
      .where(eq(applicationProperties.applicationId, applicationId));
    
    // Then set the new property as current, only if it belongs to the same application
    const [updated] = await db
      .update(applicationProperties)
      .set({ isCurrentProperty: true, status: "active", updatedAt: new Date() })
      .where(and(eq(applicationProperties.id, propertyId), eq(applicationProperties.applicationId, applicationId)))
      .returning();
    return updated;
  }

  async markDealFellThrough(applicationId: string, propertyId: string, reason: string): Promise<ApplicationProperty | undefined> {
    const [updated] = await db
      .update(applicationProperties)
      .set({ 
        status: "deal_fell_through", 
        isCurrentProperty: false,
        notes: reason,
        updatedAt: new Date() 
      })
      .where(and(eq(applicationProperties.id, propertyId), eq(applicationProperties.applicationId, applicationId)))
      .returning();
    return updated;
  }

  // Deal Team Members
  async createDealTeamMember(data: InsertDealTeamMember): Promise<DealTeamMember> {
    const [member] = await db.insert(dealTeamMembers).values(data).returning();
    return member;
  }

  async getDealTeamMembers(applicationId: string): Promise<(DealTeamMember & { user?: User })[]> {
    const members = await db
      .select()
      .from(dealTeamMembers)
      .leftJoin(users, eq(dealTeamMembers.userId, users.id))
      .where(and(
        eq(dealTeamMembers.applicationId, applicationId),
        eq(dealTeamMembers.isActive, true)
      ))
      .orderBy(asc(dealTeamMembers.teamRole));

    return members.map(row => ({
      ...row.deal_team_members,
      user: row.users || undefined,
    }));
  }

  async getDealTeamMember(id: string): Promise<DealTeamMember | undefined> {
    const [member] = await db
      .select()
      .from(dealTeamMembers)
      .where(eq(dealTeamMembers.id, id));
    return member;
  }

  async updateDealTeamMember(id: string, data: Partial<DealTeamMember>): Promise<DealTeamMember | undefined> {
    const [updated] = await db
      .update(dealTeamMembers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(dealTeamMembers.id, id))
      .returning();
    return updated;
  }

  async removeDealTeamMember(id: string): Promise<void> {
    await db
      .update(dealTeamMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(dealTeamMembers.id, id));
  }

  async getTeamMembersByUser(userId: string): Promise<(DealTeamMember & { application?: LoanApplication })[]> {
    const members = await db
      .select()
      .from(dealTeamMembers)
      .leftJoin(loanApplications, eq(dealTeamMembers.applicationId, loanApplications.id))
      .where(and(
        eq(dealTeamMembers.userId, userId),
        eq(dealTeamMembers.isActive, true)
      ))
      .orderBy(desc(dealTeamMembers.assignedAt));

    return members.map(row => ({
      ...row.deal_team_members,
      application: row.loan_applications || undefined,
    }));
  }

  // Single chokepoint for putting a file on a loan officer's desk (or clearing it).
  // Keeps the denormalized loanApplications.loanOfficerId pointer and the deal-team
  // membership row — the authorization boundary used by getLoanApplicationWithAccess
  // and scoped by the pipeline queue — in lockstep, so "assigned LO" always equals
  // "the LO can open the file AND see it in their queue". Idempotent: assigning the
  // same LO twice is a no-op on the membership row.
  async assignLoanOfficer(
    applicationId: string,
    loanOfficerId: string | null,
    assignedBy: string,
  ): Promise<LoanApplication | undefined> {
    const [application] = await db
      .update(loanApplications)
      .set({ loanOfficerId, updatedAt: new Date() })
      .where(eq(loanApplications.id, applicationId))
      .returning();
    if (!application) return undefined;

    // Deactivate any active primary loan_officer membership that isn't the new
    // owner (reassignment/unassignment moves the desk). Other deal-team roles
    // (processor, underwriter, closer, external partners) are left untouched.
    await db
      .update(dealTeamMembers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(dealTeamMembers.applicationId, applicationId),
        eq(dealTeamMembers.teamRole, "loan_officer"),
        eq(dealTeamMembers.isActive, true),
        loanOfficerId ? ne(dealTeamMembers.userId, loanOfficerId) : sql`true`,
      ));

    if (loanOfficerId) {
      const [existing] = await db
        .select({ id: dealTeamMembers.id })
        .from(dealTeamMembers)
        .where(and(
          eq(dealTeamMembers.applicationId, applicationId),
          eq(dealTeamMembers.userId, loanOfficerId),
          eq(dealTeamMembers.teamRole, "loan_officer"),
          eq(dealTeamMembers.isActive, true),
        ))
        .limit(1);
      if (!existing) {
        await db.insert(dealTeamMembers).values({
          applicationId,
          userId: loanOfficerId,
          teamRole: "loan_officer",
          isPrimary: true,
          isActive: true,
          assignedBy,
          assignedAt: new Date(),
        });
      }
    }

    return application;
  }

  // Active applications with no loan officer on file — the intake "pool" an LO
  // claims from. Keyed off the denormalized pointer (a file with no primary LO
  // has loanOfficerId null); assignLoanOfficer keeps that pointer honest.
  async getUnassignedApplications(): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .where(and(
        isNull(loanApplications.loanOfficerId),
        sql`${loanApplications.status} not in ('draft','funded','denied','withdrawn')`,
      ))
      .orderBy(desc(loanApplications.createdAt));
  }

}
