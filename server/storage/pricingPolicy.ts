// Storage domain: Lookup matrices, AI coach, underwriting rules DSL, policy profiles/thresholds/approval/overlays, wholesale lenders, rate sheets + products, pricing adjustments, lender offers.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import {
  eq,
  desc,
  and,
  gte,
  lte,
  sql,
  or,
  asc,
  count,
  inArray,
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  coachConversations,
  coachMessages,
  type CoachConversation,
  type InsertCoachConversation,
  type CoachMessage,
  type InsertCoachMessage,
  underwritingRulesDsl,
  ruleExecutionLog,
  policyProfiles,
  policyThresholds,
  policyApprovalWorkflow,
  policyLenderOverlays,
  type UnderwritingRuleDsl,
  type InsertUnderwritingRuleDsl,
  type RuleExecutionLog,
  type InsertRuleExecutionLog,
  type PolicyProfile,
  type InsertPolicyProfile,
  type PolicyThreshold,
  type InsertPolicyThreshold,
  type PolicyApprovalWorkflow,
  type InsertPolicyApprovalWorkflow,
  type PolicyLenderOverlay,
  type InsertPolicyLenderOverlay,
  wholesaleLenders,
  rateSheets,
  rateSheetProducts,
  lenderPricingAdjustments,
  lenderOffers,
  type WholesaleLender,
  type InsertWholesaleLender,
  type RateSheet,
  type InsertRateSheet,
  type RateSheetProduct,
  type InsertRateSheetProduct,
  type LenderPricingAdjustment,
  type InsertLenderPricingAdjustment,
  type LenderOffer,
  type InsertLenderOffer,
  lookupMatrices,
  lookupMatrixCells,
  type LookupMatrix,
  type InsertLookupMatrix,
  type LookupMatrixCell,
  type InsertLookupMatrixCell,
} from "@shared/schema";
import { NotificationsOpsStorage } from "./notificationsOps";
export class PricingPolicyStorage extends NotificationsOpsStorage {
  // Lookup Matrices
  async getLookupMatrices(filters?: {
    matrixCode?: string;
    lifecycleStatus?: string;
  }): Promise<(LookupMatrix & { cellCount: number })[]> {
    const conditions = [];
    if (filters?.matrixCode) {
      conditions.push(eq(lookupMatrices.matrixCode, filters.matrixCode));
    }
    if (filters?.lifecycleStatus) {
      conditions.push(
        eq(lookupMatrices.lifecycleStatus, filters.lifecycleStatus as any),
      );
    }

    const rows = await db
      .select({
        matrix: lookupMatrices,
        cellCount: count(lookupMatrixCells.id),
      })
      .from(lookupMatrices)
      .leftJoin(
        lookupMatrixCells,
        eq(lookupMatrixCells.matrixId, lookupMatrices.id),
      )
      .where(conditions.length ? and(...conditions) : undefined)
      .groupBy(lookupMatrices.id)
      .orderBy(asc(lookupMatrices.matrixCode), desc(lookupMatrices.version));

    return rows.map((r) => ({ ...r.matrix, cellCount: Number(r.cellCount) }));
  }

  async getLookupMatrix(
    id: string,
  ): Promise<(LookupMatrix & { cells: LookupMatrixCell[] }) | undefined> {
    const [matrix] = await db
      .select()
      .from(lookupMatrices)
      .where(eq(lookupMatrices.id, id))
      .limit(1);
    if (!matrix) return undefined;

    const cells = await db
      .select()
      .from(lookupMatrixCells)
      .where(eq(lookupMatrixCells.matrixId, id));

    return { ...matrix, cells };
  }

  async getMaxLookupMatrixVersion(matrixCode: string): Promise<number> {
    const [row] = await db
      .select({ maxVersion: sql<number>`COALESCE(MAX(${lookupMatrices.version}), 0)` })
      .from(lookupMatrices)
      .where(eq(lookupMatrices.matrixCode, matrixCode));
    return Number(row?.maxVersion ?? 0);
  }

  async getActiveLookupMatrix(
    matrixCode: string,
  ): Promise<LookupMatrix | undefined> {
    const [matrix] = await db
      .select()
      .from(lookupMatrices)
      .where(
        and(
          eq(lookupMatrices.matrixCode, matrixCode),
          eq(lookupMatrices.lifecycleStatus, "ACTIVE"),
        ),
      )
      .orderBy(desc(lookupMatrices.version))
      .limit(1);
    return matrix;
  }

  async createLookupMatrix(
    data: InsertLookupMatrix,
    cells: InsertLookupMatrixCell[],
  ): Promise<LookupMatrix & { cells: LookupMatrixCell[] }> {
    return db.transaction(async (tx) => {
      const [matrix] = await tx
        .insert(lookupMatrices)
        .values(data)
        .returning();

      let insertedCells: LookupMatrixCell[] = [];
      if (cells.length > 0) {
        insertedCells = await tx
          .insert(lookupMatrixCells)
          .values(cells.map((c) => ({ ...c, matrixId: matrix.id })))
          .returning();
      }

      return { ...matrix, cells: insertedCells };
    });
  }

  async updateLookupMatrix(
    id: string,
    updates: Partial<InsertLookupMatrix>,
  ): Promise<LookupMatrix | undefined> {
    // Always advance updated_at (via DB clock, not the app clock) so the
    // resolver's cross-process invalidation stamp moves on every lifecycle
    // mutation regardless of which instance handled it.
    const [updated] = await db
      .update(lookupMatrices)
      .set({ ...updates, updatedAt: sql`now()` })
      .where(eq(lookupMatrices.id, id))
      .returning();
    return updated;
  }

  // AI Coach
  async createCoachConversation(data: InsertCoachConversation): Promise<CoachConversation> {
    const [conv] = await db.insert(coachConversations).values(data).returning();
    return conv;
  }

  async getCoachConversationsByUser(userId: string): Promise<CoachConversation[]> {
    return db.select().from(coachConversations)
      .where(eq(coachConversations.userId, userId))
      .orderBy(desc(coachConversations.updatedAt));
  }

  async getCoachConversation(id: string): Promise<CoachConversation | undefined> {
    const [conv] = await db.select().from(coachConversations)
      .where(eq(coachConversations.id, id)).limit(1);
    return conv;
  }

  async updateCoachConversation(id: string, data: Partial<CoachConversation>): Promise<CoachConversation | undefined> {
    const [conv] = await db.update(coachConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coachConversations.id, id))
      .returning();
    return conv;
  }

  async createCoachMessage(data: InsertCoachMessage): Promise<CoachMessage> {
    const [msg] = await db.insert(coachMessages).values(data).returning();
    return msg;
  }

  async getCoachMessages(conversationId: string): Promise<CoachMessage[]> {
    return db.select().from(coachMessages)
      .where(eq(coachMessages.conversationId, conversationId))
      .orderBy(asc(coachMessages.createdAt));
  }

  async countUserCoachMessagesToday(userId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const convIds = await db.select({ id: coachConversations.id })
      .from(coachConversations)
      .where(eq(coachConversations.userId, userId));

    if (convIds.length === 0) return 0;

    const [result] = await db.select({ value: count() })
      .from(coachMessages)
      .where(and(
        inArray(coachMessages.conversationId, convIds.map(c => c.id)),
        eq(coachMessages.role, "user"),
        gte(coachMessages.createdAt, today),
      ));

    return result?.value ?? 0;
  }

  // Underwriting Rules DSL
  async getUnderwritingRules(filters?: { category?: string; triggerType?: string; isActive?: boolean }): Promise<UnderwritingRuleDsl[]> {
    const conditions = [];
    if (filters?.category) conditions.push(eq(underwritingRulesDsl.category, filters.category));
    if (filters?.triggerType) conditions.push(eq(underwritingRulesDsl.triggerType, filters.triggerType));
    if (filters?.isActive !== undefined) conditions.push(eq(underwritingRulesDsl.isActive, filters.isActive));

    const query = conditions.length > 0
      ? db.select().from(underwritingRulesDsl).where(and(...conditions))
      : db.select().from(underwritingRulesDsl);

    return query.orderBy(asc(underwritingRulesDsl.priority), asc(underwritingRulesDsl.ruleCode));
  }

  async getUnderwritingRule(id: string): Promise<UnderwritingRuleDsl | undefined> {
    const [rule] = await db.select().from(underwritingRulesDsl).where(eq(underwritingRulesDsl.id, id)).limit(1);
    return rule;
  }

  async getUnderwritingRuleByCode(code: string): Promise<UnderwritingRuleDsl | undefined> {
    const [rule] = await db.select().from(underwritingRulesDsl).where(eq(underwritingRulesDsl.ruleCode, code)).limit(1);
    return rule;
  }

  async createUnderwritingRule(data: InsertUnderwritingRuleDsl): Promise<UnderwritingRuleDsl> {
    const [rule] = await db.insert(underwritingRulesDsl).values(data).returning();
    return rule;
  }

  async updateUnderwritingRule(id: string, data: Partial<UnderwritingRuleDsl>): Promise<UnderwritingRuleDsl | undefined> {
    const [rule] = await db.update(underwritingRulesDsl)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(underwritingRulesDsl.id, id))
      .returning();
    return rule;
  }

  async createRuleExecutionLog(data: InsertRuleExecutionLog): Promise<RuleExecutionLog> {
    const [log] = await db.insert(ruleExecutionLog).values(data).returning();
    return log;
  }

  async getRuleExecutionLogs(snapshotId: string): Promise<RuleExecutionLog[]> {
    return db.select().from(ruleExecutionLog)
      .where(eq(ruleExecutionLog.snapshotId, snapshotId))
      .orderBy(asc(ruleExecutionLog.executedAt));
  }

  // Policy Profiles
  async getPolicyProfiles(filters?: { authority?: string; productType?: string; status?: string }): Promise<PolicyProfile[]> {
    const conditions = [];
    if (filters?.authority) conditions.push(eq(policyProfiles.authority, filters.authority));
    if (filters?.productType) conditions.push(eq(policyProfiles.productType, filters.productType));
    if (filters?.status) conditions.push(eq(policyProfiles.status, filters.status));

    const query = conditions.length > 0
      ? db.select().from(policyProfiles).where(and(...conditions))
      : db.select().from(policyProfiles);

    return query.orderBy(desc(policyProfiles.createdAt));
  }

  async getPolicyProfile(id: string): Promise<PolicyProfile | undefined> {
    const [profile] = await db.select().from(policyProfiles).where(eq(policyProfiles.id, id)).limit(1);
    return profile;
  }

  async createPolicyProfile(data: InsertPolicyProfile): Promise<PolicyProfile> {
    const [profile] = await db.insert(policyProfiles).values(data).returning();
    return profile;
  }

  async updatePolicyProfile(id: string, data: Partial<PolicyProfile>): Promise<PolicyProfile | undefined> {
    const [profile] = await db.update(policyProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policyProfiles.id, id))
      .returning();
    return profile;
  }

  // Policy Thresholds
  async getPolicyThresholds(policyProfileId: string): Promise<PolicyThreshold[]> {
    return db.select().from(policyThresholds)
      .where(eq(policyThresholds.policyProfileId, policyProfileId))
      .orderBy(asc(policyThresholds.displayOrder), asc(policyThresholds.category));
  }

  async getPolicyThreshold(id: string): Promise<PolicyThreshold | undefined> {
    const [threshold] = await db.select().from(policyThresholds).where(eq(policyThresholds.id, id)).limit(1);
    return threshold;
  }

  async createPolicyThreshold(data: InsertPolicyThreshold): Promise<PolicyThreshold> {
    const [threshold] = await db.insert(policyThresholds).values(data).returning();
    return threshold;
  }

  async updatePolicyThreshold(id: string, data: Partial<PolicyThreshold>): Promise<PolicyThreshold | undefined> {
    const [threshold] = await db.update(policyThresholds)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policyThresholds.id, id))
      .returning();
    return threshold;
  }

  async deletePolicyThreshold(id: string): Promise<boolean> {
    const result = await db.delete(policyThresholds).where(eq(policyThresholds.id, id)).returning();
    return result.length > 0;
  }

  // Policy Approval Workflow
  async createPolicyApproval(data: InsertPolicyApprovalWorkflow): Promise<PolicyApprovalWorkflow> {
    const [approval] = await db.insert(policyApprovalWorkflow).values(data).returning();
    return approval;
  }

  async getPolicyApprovals(policyProfileId: string): Promise<PolicyApprovalWorkflow[]> {
    return db.select().from(policyApprovalWorkflow)
      .where(eq(policyApprovalWorkflow.policyProfileId, policyProfileId))
      .orderBy(desc(policyApprovalWorkflow.createdAt));
  }

  // Policy Lender Overlays
  async getPolicyLenderOverlays(basePolicyProfileId: string): Promise<PolicyLenderOverlay[]> {
    return db.select().from(policyLenderOverlays)
      .where(eq(policyLenderOverlays.basePolicyProfileId, basePolicyProfileId))
      .orderBy(desc(policyLenderOverlays.createdAt));
  }

  async getPolicyLenderOverlay(id: string): Promise<PolicyLenderOverlay | undefined> {
    const [overlay] = await db.select().from(policyLenderOverlays).where(eq(policyLenderOverlays.id, id)).limit(1);
    return overlay;
  }

  async createPolicyLenderOverlay(data: InsertPolicyLenderOverlay): Promise<PolicyLenderOverlay> {
    const [overlay] = await db.insert(policyLenderOverlays).values(data).returning();
    return overlay;
  }

  async updatePolicyLenderOverlay(id: string, data: Partial<PolicyLenderOverlay>): Promise<PolicyLenderOverlay | undefined> {
    const [overlay] = await db.update(policyLenderOverlays)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(policyLenderOverlays.id, id))
      .returning();
    return overlay;
  }

  async deletePolicyLenderOverlay(id: string): Promise<boolean> {
    const result = await db.delete(policyLenderOverlays).where(eq(policyLenderOverlays.id, id)).returning();
    return result.length > 0;
  }

  // Wholesale Lenders
  async getWholesaleLenders(filters?: { status?: string; integrationTier?: string }): Promise<WholesaleLender[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(wholesaleLenders.status, filters.status));
    if (filters?.integrationTier) conditions.push(eq(wholesaleLenders.integrationTier, filters.integrationTier));
    return db.select().from(wholesaleLenders)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(wholesaleLenders.lenderName));
  }

  async getWholesaleLender(id: string): Promise<WholesaleLender | undefined> {
    const [lender] = await db.select().from(wholesaleLenders).where(eq(wholesaleLenders.id, id)).limit(1);
    return lender;
  }

  /**
   * Look up by the business key (`lender_id`, e.g. "uwm") rather than the uuid
   * primary key. Submission and the income package address lenders by this
   * stable key — it is what a staff-facing selection and an audit row carry.
   */
  async getWholesaleLenderByLenderId(lenderId: string): Promise<WholesaleLender | undefined> {
    const [lender] = await db
      .select()
      .from(wholesaleLenders)
      .where(eq(wholesaleLenders.lenderId, lenderId))
      .limit(1);
    return lender;
  }

  async createWholesaleLender(data: InsertWholesaleLender): Promise<WholesaleLender> {
    const [lender] = await db.insert(wholesaleLenders).values(data).returning();
    return lender;
  }

  async updateWholesaleLender(id: string, data: Partial<WholesaleLender>): Promise<WholesaleLender | undefined> {
    const [lender] = await db.update(wholesaleLenders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(wholesaleLenders.id, id))
      .returning();
    return lender;
  }

  // Rate Sheets
  async getRateSheets(filters?: { lenderId?: string; status?: string }): Promise<RateSheet[]> {
    const conditions = [];
    if (filters?.lenderId) conditions.push(eq(rateSheets.lenderId, filters.lenderId));
    if (filters?.status) conditions.push(eq(rateSheets.status, filters.status));
    return db.select().from(rateSheets)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(rateSheets.effectiveDate));
  }

  async getActiveRateSheets(): Promise<RateSheet[]> {
    const today = new Date().toISOString().split("T")[0];
    return db.select().from(rateSheets)
      .where(and(
        eq(rateSheets.status, "ACTIVE"),
        lte(rateSheets.effectiveDate, today),
        gte(rateSheets.expirationDate, today)
      ))
      .orderBy(desc(rateSheets.effectiveDate));
  }

  async getRateSheet(id: string): Promise<RateSheet | undefined> {
    const [sheet] = await db.select().from(rateSheets).where(eq(rateSheets.id, id)).limit(1);
    return sheet;
  }

  async createRateSheet(data: InsertRateSheet): Promise<RateSheet> {
    const [sheet] = await db.insert(rateSheets).values(data).returning();
    return sheet;
  }

  async updateRateSheet(id: string, data: Partial<RateSheet>): Promise<RateSheet | undefined> {
    const [sheet] = await db.update(rateSheets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(rateSheets.id, id))
      .returning();
    return sheet;
  }

  // Rate Sheet Products
  async getRateSheetProducts(rateSheetId: string): Promise<RateSheetProduct[]> {
    return db.select().from(rateSheetProducts)
      .where(eq(rateSheetProducts.rateSheetId, rateSheetId))
      .orderBy(asc(rateSheetProducts.productCode));
  }

  async getRateSheetProduct(id: string): Promise<RateSheetProduct | undefined> {
    const [product] = await db.select().from(rateSheetProducts).where(eq(rateSheetProducts.id, id)).limit(1);
    return product;
  }

  async createRateSheetProduct(data: InsertRateSheetProduct): Promise<RateSheetProduct> {
    const [product] = await db.insert(rateSheetProducts).values(data).returning();
    return product;
  }

  async updateRateSheetProduct(id: string, data: Partial<RateSheetProduct>): Promise<RateSheetProduct | undefined> {
    const [product] = await db.update(rateSheetProducts)
      .set(data)
      .where(eq(rateSheetProducts.id, id))
      .returning();
    return product;
  }

  // Lender Pricing Adjustments
  async getLenderPricingAdjustments(filters?: { lenderId?: string; adjustmentType?: string }): Promise<LenderPricingAdjustment[]> {
    const conditions = [];
    if (filters?.lenderId) conditions.push(eq(lenderPricingAdjustments.lenderId, filters.lenderId));
    if (filters?.adjustmentType) conditions.push(eq(lenderPricingAdjustments.adjustmentType, filters.adjustmentType));
    const today = new Date().toISOString().split("T")[0];
    conditions.push(lte(lenderPricingAdjustments.effectiveDate, today));
    conditions.push(or(
      sql`${lenderPricingAdjustments.expirationDate} IS NULL`,
      gte(lenderPricingAdjustments.expirationDate, today)
    )!);
    return db.select().from(lenderPricingAdjustments)
      .where(and(...conditions))
      .orderBy(asc(lenderPricingAdjustments.adjustmentType));
  }

  async createLenderPricingAdjustment(data: InsertLenderPricingAdjustment): Promise<LenderPricingAdjustment> {
    const [adj] = await db.insert(lenderPricingAdjustments).values(data).returning();
    return adj;
  }

  async updateLenderPricingAdjustment(id: string, data: Partial<LenderPricingAdjustment>): Promise<LenderPricingAdjustment | undefined> {
    const [adj] = await db.update(lenderPricingAdjustments)
      .set(data)
      .where(eq(lenderPricingAdjustments.id, id))
      .returning();
    return adj;
  }

  // Lender Offers
  async getLenderOffers(filters?: { applicationId?: string; lenderId?: string; status?: string }): Promise<LenderOffer[]> {
    const conditions = [];
    if (filters?.applicationId) conditions.push(eq(lenderOffers.applicationId, filters.applicationId));
    if (filters?.lenderId) conditions.push(eq(lenderOffers.lenderId, filters.lenderId));
    if (filters?.status) conditions.push(eq(lenderOffers.status, filters.status));
    return db.select().from(lenderOffers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(lenderOffers.createdAt));
  }

  async getLenderOffer(id: string): Promise<LenderOffer | undefined> {
    const [offer] = await db.select().from(lenderOffers).where(eq(lenderOffers.id, id)).limit(1);
    return offer;
  }

  async createLenderOffer(data: InsertLenderOffer): Promise<LenderOffer> {
    const [offer] = await db.insert(lenderOffers).values(data).returning();
    return offer;
  }

  async updateLenderOffer(id: string, data: Partial<LenderOffer>): Promise<LenderOffer | undefined> {
    const [offer] = await db.update(lenderOffers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(lenderOffers.id, id))
      .returning();
    return offer;
  }

}
