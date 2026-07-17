// Storage domain: Tax insights, CPA partner channel, PartnerHub identity spine, partner providers + orders.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import {
  eq,
  desc,
  and,
  gte,
  sql,
  asc,
  inArray,
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  users,
  loanApplications,
  partnerProviders,
  partnerOrders,
  type PartnerProvider,
  type InsertPartnerProvider,
  type PartnerOrder,
  type InsertPartnerOrder,
  taxInsights,
  type TaxInsight,
  type InsertTaxInsight,
  cpaPartners,
  cpaReferrals,
  type CpaPartner,
  type InsertCpaPartner,
  type CpaReferral,
  type InsertCpaReferral,
  partnerProfiles,
  type PartnerProfile,
  type InsertPartnerProfile,
  partnerProgressConsents,
  type PartnerProgressConsent,
  partnerWaitlist,
} from "@shared/schema";
import { LocksAndConsentsStorage } from "./locksAndConsents";
export class PartnersStorage extends LocksAndConsentsStorage {
  // ===== TAX INSIGHTS =====
  async upsertTaxInsight(data: InsertTaxInsight): Promise<TaxInsight> {
    const [insight] = await db
      .insert(taxInsights)
      .values(data)
      .onConflictDoUpdate({
        target: [taxInsights.userId, taxInsights.taxYear],
        set: { ...data, updatedAt: new Date() },
      })
      .returning();
    return insight;
  }

  async getTaxInsightsByUser(userId: string): Promise<TaxInsight[]> {
    return await db
      .select()
      .from(taxInsights)
      .where(eq(taxInsights.userId, userId))
      .orderBy(desc(taxInsights.taxYear));
  }

  async getRecentDscrCandidates(days: number, limit: number): Promise<Array<TaxInsight & { userName: string | null; cpaFirm: string | null }>> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        insight: taxInsights,
        firstName: users.firstName,
        lastName: users.lastName,
        cpaFirm: cpaPartners.firmName,
      })
      .from(taxInsights)
      .innerJoin(users, eq(taxInsights.userId, users.id))
      .leftJoin(cpaReferrals, eq(cpaReferrals.referredUserId, taxInsights.userId))
      .leftJoin(cpaPartners, eq(cpaPartners.id, cpaReferrals.cpaPartnerId))
      .where(and(eq(taxInsights.dscrCandidate, true), gte(taxInsights.updatedAt, since)))
      .orderBy(desc(taxInsights.updatedAt))
      .limit(limit);
    return rows.map((r) => ({
      ...r.insight,
      userName: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      cpaFirm: r.cpaFirm ?? null,
    }));
  }

  // ===== CPA PARTNER CHANNEL =====
  async createCpaPartner(data: InsertCpaPartner): Promise<CpaPartner> {
    const [row] = await db.insert(cpaPartners).values(data).returning();
    return row;
  }

  async getCpaPartnerByCode(code: string): Promise<CpaPartner | undefined> {
    const [row] = await db.select().from(cpaPartners).where(eq(cpaPartners.referralCode, code)).limit(1);
    return row;
  }

  async getCpaPartnerByUserId(userId: string): Promise<CpaPartner | undefined> {
    const [row] = await db.select().from(cpaPartners).where(eq(cpaPartners.userId, userId)).limit(1);
    return row;
  }

  async getCpaReferralByUser(referredUserId: string): Promise<CpaReferral | undefined> {
    const [row] = await db.select().from(cpaReferrals).where(eq(cpaReferrals.referredUserId, referredUserId)).limit(1);
    return row;
  }

  async createCpaReferral(data: InsertCpaReferral): Promise<CpaReferral> {
    const [row] = await db.insert(cpaReferrals).values(data).returning();
    return row;
  }

  async getCpaReferralsForPortal(
    cpaPartnerId: string,
  ): Promise<Array<{ displayName: string; stage: string; referredAt: Date }>> {
    const refs = await db
      .select({
        referredUserId: cpaReferrals.referredUserId,
        clientName: cpaReferrals.clientName,
        referredAt: cpaReferrals.createdAt,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(cpaReferrals)
      .innerJoin(users, eq(cpaReferrals.referredUserId, users.id))
      .where(eq(cpaReferrals.cpaPartnerId, cpaPartnerId))
      .orderBy(desc(cpaReferrals.createdAt));

    // Latest application status per referred user (stage only — no financials).
    const userIds = refs.map((r) => r.referredUserId);
    const stageByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const apps = await db
        .select({
          userId: loanApplications.userId,
          status: loanApplications.status,
          createdAt: loanApplications.createdAt,
        })
        .from(loanApplications)
        .where(inArray(loanApplications.userId, userIds))
        .orderBy(desc(loanApplications.createdAt));
      for (const a of apps) {
        if (!stageByUser.has(a.userId)) stageByUser.set(a.userId, a.status); // desc → first is latest
      }
    }

    return refs.map((r) => {
      // Privacy minimization: first name + last initial only. Never email,
      // income, tax figures, or DSCR flags — a CPA is an inviter, not a
      // recipient of borrower financial data (IRC §7216).
      const initial = r.lastName ? `${r.lastName.charAt(0)}.` : "";
      const displayName =
        [r.firstName, initial].filter(Boolean).join(" ") || r.clientName || "Client";
      return {
        displayName,
        stage: stageByUser.get(r.referredUserId) ?? "exploring",
        referredAt: r.referredAt,
      };
    });
  }

  async getCpaReferralStats(
    cpaPartnerId: string,
  ): Promise<{ total: number; active: number; exploring: number }> {
    const portal = await this.getCpaReferralsForPortal(cpaPartnerId);
    const exploring = portal.filter((p) => p.stage === "exploring").length;
    return { total: portal.length, active: portal.length - exploring, exploring };
  }

  async deleteTaxInsightsByUser(userId: string): Promise<number> {
    const deleted = await db
      .delete(taxInsights)
      .where(eq(taxInsights.userId, userId))
      .returning({ id: taxInsights.id });
    return deleted.length;
  }

  // ===== PARTNERHUB IDENTITY SPINE (PH-1) =====

  async listCpaPartners(): Promise<CpaPartner[]> {
    return db.select().from(cpaPartners).orderBy(desc(cpaPartners.createdAt));
  }

  async createPartnerProfile(data: InsertPartnerProfile): Promise<PartnerProfile> {
    const [row] = await db.insert(partnerProfiles).values(data).returning();
    return row;
  }

  async getPartnerProfileByUserId(userId: string): Promise<PartnerProfile | undefined> {
    const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.userId, userId)).limit(1);
    return row;
  }

  async getPartnerProfileBySlug(slug: string): Promise<PartnerProfile | undefined> {
    const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.referralSlug, slug)).limit(1);
    return row;
  }

  async getPartnerProfileById(id: string): Promise<PartnerProfile | undefined> {
    const [row] = await db.select().from(partnerProfiles).where(eq(partnerProfiles.id, id)).limit(1);
    return row;
  }

  async listPartnerProfiles(): Promise<PartnerProfile[]> {
    return db.select().from(partnerProfiles).orderBy(desc(partnerProfiles.createdAt));
  }

  async updatePartnerProfileReview(
    id: string,
    patch: { licenseVerificationStatus?: string; status?: string },
  ): Promise<PartnerProfile | undefined> {
    const [row] = await db
      .update(partnerProfiles)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(partnerProfiles.id, id))
      .returning();
    return row;
  }

  async setUserPartnerIdentity(
    userId: string,
    identity: { referralCode: string; partnerCompanyName: string },
  ): Promise<void> {
    await db
      .update(users)
      .set({
        referralCode: identity.referralCode,
        partnerCompanyName: identity.partnerCompanyName,
        isPartner: true,
      })
      .where(eq(users.id, userId));
  }

  async getPartnerReferralsForHub(
    partnerUserId: string,
  ): Promise<Array<{ displayName: string; stage: string; shared: boolean; referredAt: Date | null }>> {
    // The realtor rail is users.referred_by_user_id (written by /api/apply-referral).
    const refs = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        referredAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.referredByUserId, partnerUserId))
      .orderBy(desc(users.createdAt));

    const userIds = refs.map((r) => r.id);

    // PH-2 consent gate: which of these borrowers opted in to share progress
    // with THIS partner. Batched (inArray) — no per-row query.
    const sharedBorrowers = new Set<string>();
    if (userIds.length > 0) {
      const consents = await db
        .select({ borrowerUserId: partnerProgressConsents.borrowerUserId })
        .from(partnerProgressConsents)
        .where(
          and(
            eq(partnerProgressConsents.partnerUserId, partnerUserId),
            eq(partnerProgressConsents.shared, true),
            inArray(partnerProgressConsents.borrowerUserId, userIds),
          ),
        );
      for (const c of consents) sharedBorrowers.add(c.borrowerUserId);
    }

    // Latest application status per referred user (stage only — no financials).
    const stageByUser = new Map<string, string>();
    if (userIds.length > 0) {
      const apps = await db
        .select({
          userId: loanApplications.userId,
          status: loanApplications.status,
        })
        .from(loanApplications)
        .where(inArray(loanApplications.userId, userIds))
        .orderBy(desc(loanApplications.createdAt));
      for (const a of apps) {
        if (!stageByUser.has(a.userId)) stageByUser.set(a.userId, a.status); // desc → first is latest
      }
    }

    return refs.map((r) => {
      // Privacy minimization, identical to the CPA portal projection: first
      // name + last initial only. Never email, financials, or documents — a
      // partner is an inviter, not a recipient of borrower data (charter §5-C6).
      const initial = r.lastName ? `${r.lastName.charAt(0)}.` : "";
      const displayName = [r.firstName, initial].filter(Boolean).join(" ") || "Client";
      const shared = sharedBorrowers.has(r.id);
      // Consent gate: real progression only when the borrower opted in;
      // otherwise the existence-only "invited" the partner already knows.
      const stage = shared ? (stageByUser.get(r.id) ?? "exploring") : "invited";
      return { displayName, stage, shared, referredAt: r.referredAt };
    });
  }

  async getPartnerProgressConsent(
    borrowerUserId: string,
    partnerUserId: string,
  ): Promise<PartnerProgressConsent | undefined> {
    const [row] = await db
      .select()
      .from(partnerProgressConsents)
      .where(
        and(
          eq(partnerProgressConsents.borrowerUserId, borrowerUserId),
          eq(partnerProgressConsents.partnerUserId, partnerUserId),
        ),
      )
      .limit(1);
    return row;
  }

  async setPartnerProgressConsent(
    borrowerUserId: string,
    partnerUserId: string,
    share: boolean,
    meta: { ipAddress?: string | null },
  ): Promise<PartnerProgressConsent> {
    const now = new Date();
    // Upsert the single current-state row for this borrower↔partner pair.
    const [row] = await db
      .insert(partnerProgressConsents)
      .values({
        borrowerUserId,
        partnerUserId,
        shared: share,
        grantedAt: share ? now : null,
        revokedAt: share ? null : now,
        ipAddress: meta.ipAddress ?? null,
      })
      .onConflictDoUpdate({
        target: [partnerProgressConsents.borrowerUserId, partnerProgressConsents.partnerUserId],
        set: {
          shared: share,
          grantedAt: share ? now : sql`${partnerProgressConsents.grantedAt}`,
          revokedAt: share ? sql`${partnerProgressConsents.revokedAt}` : now,
          ipAddress: meta.ipAddress ?? null,
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  async markPartnerWaitlistInvited(id: string): Promise<typeof partnerWaitlist.$inferSelect | undefined> {
    const [row] = await db
      .update(partnerWaitlist)
      .set({ invitedAt: new Date() })
      .where(eq(partnerWaitlist.id, id))
      .returning();
    return row;
  }

  // ===== PARTNER PROVIDERS =====
  async createPartnerProvider(data: InsertPartnerProvider): Promise<PartnerProvider> {
    const [provider] = await db.insert(partnerProviders).values(data).returning();
    return provider;
  }

  async getPartnerProvider(id: string): Promise<PartnerProvider | undefined> {
    const [provider] = await db.select().from(partnerProviders).where(eq(partnerProviders.id, id));
    return provider;
  }

  async getPartnerProviderByCode(code: string): Promise<PartnerProvider | undefined> {
    const [provider] = await db.select().from(partnerProviders).where(eq(partnerProviders.code, code));
    return provider;
  }

  async getPartnerProvidersByServiceType(serviceType: string): Promise<PartnerProvider[]> {
    return await db
      .select()
      .from(partnerProviders)
      .where(and(eq(partnerProviders.serviceType, serviceType), eq(partnerProviders.isActive, true)));
  }

  async getAllPartnerProviders(): Promise<PartnerProvider[]> {
    return await db.select().from(partnerProviders).orderBy(asc(partnerProviders.name));
  }

  async updatePartnerProvider(id: string, data: Partial<PartnerProvider>): Promise<PartnerProvider | undefined> {
    const { id: providerId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(partnerProviders)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(partnerProviders.id, id))
      .returning();
    return updated;
  }

  // ===== PARTNER ORDERS =====
  async createPartnerOrder(data: InsertPartnerOrder): Promise<PartnerOrder> {
    const [order] = await db.insert(partnerOrders).values(data).returning();
    return order;
  }

  async getPartnerOrder(id: string): Promise<PartnerOrder | undefined> {
    const [order] = await db.select().from(partnerOrders).where(eq(partnerOrders.id, id));
    return order;
  }

  async getPartnerOrdersByApplication(applicationId: string): Promise<PartnerOrder[]> {
    return await db
      .select()
      .from(partnerOrders)
      .where(eq(partnerOrders.applicationId, applicationId))
      .orderBy(desc(partnerOrders.createdAt));
  }

  async getPartnerOrdersByStatus(status: string): Promise<PartnerOrder[]> {
    return await db
      .select()
      .from(partnerOrders)
      .where(eq(partnerOrders.status, status))
      .orderBy(asc(partnerOrders.createdAt));
  }

  async updatePartnerOrder(id: string, data: Partial<PartnerOrder>): Promise<PartnerOrder | undefined> {
    const { id: orderId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(partnerOrders)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(partnerOrders.id, id))
      .returning();
    return updated;
  }

}
