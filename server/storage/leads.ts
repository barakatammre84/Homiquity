// Storage domain: Leads (top-of-funnel) + SMS opt-out ledger.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import { leads, type Lead, type InsertLead, smsOptOuts, type SmsOptOut } from "@shared/schema";
import { PricingPolicyStorage } from "./pricingPolicy";
export class LeadsStorage extends PricingPolicyStorage {
  // Leads (top-of-funnel intake)
  async createLead(data: InsertLead): Promise<Lead> {
    const [lead] = await db.insert(leads).values(data).returning();
    return lead;
  }

  async getLeadByExternalId(source: string, externalLeadId: string): Promise<Lead | undefined> {
    const [lead] = await db
      .select()
      .from(leads)
      .where(and(eq(leads.source, source), eq(leads.externalLeadId, externalLeadId)))
      .limit(1);
    return lead;
  }

  async listLeads(filters?: { status?: string; source?: string; limit?: number; offset?: number }): Promise<Lead[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(leads.status, filters.status));
    if (filters?.source) conditions.push(eq(leads.source, filters.source));
    return db
      .select()
      .from(leads)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(leads.createdAt))
      .limit(filters?.limit ?? 100)
      .offset(filters?.offset ?? 0);
  }

  async getLead(id: string): Promise<Lead | undefined> {
    const [lead] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
    return lead;
  }

  async deleteLead(id: string): Promise<boolean> {
    const deleted = await db.delete(leads).where(eq(leads.id, id)).returning({ id: leads.id });
    return deleted.length > 0;
  }

  // SMS opt-out ledger (TCPA/CTIA)
  async setSmsOptOut(input: { phone: string; optedOut: boolean; keyword?: string | null; source?: string }): Promise<SmsOptOut> {
    const now = new Date();
    const [row] = await db
      .insert(smsOptOuts)
      .values({
        phone: input.phone,
        optedOut: input.optedOut,
        optedOutAt: input.optedOut ? now : null,
        resubscribedAt: input.optedOut ? null : now,
        lastKeyword: input.keyword ?? null,
        source: input.source ?? "sms_webhook",
      })
      .onConflictDoUpdate({
        target: smsOptOuts.phone,
        set: {
          optedOut: input.optedOut,
          optedOutAt: input.optedOut ? now : sql`${smsOptOuts.optedOutAt}`,
          resubscribedAt: input.optedOut ? sql`${smsOptOuts.resubscribedAt}` : now,
          lastKeyword: input.keyword ?? null,
          source: input.source ?? "sms_webhook",
          updatedAt: now,
        },
      })
      .returning();
    return row;
  }

  async isPhoneOptedOut(phone: string): Promise<boolean> {
    const [row] = await db
      .select({ optedOut: smsOptOuts.optedOut })
      .from(smsOptOuts)
      .where(eq(smsOptOuts.phone, phone))
      .limit(1);
    return row?.optedOut ?? false;
  }

  // Best-effort sync of the do-not-contact flag onto any lead rows whose stored
  // phone matches (compared digits-only, since lead phones are stored verbatim).
  // Returns the number of lead rows updated.
  async applyLeadContactabilityByPhone(normalizedPhone: string, optedOut: boolean): Promise<number> {
    const national = normalizedPhone.replace(/^1/, ""); // 10-digit form
    const updated = await db
      .update(leads)
      .set({ doNotContact: optedOut, optOutAt: optedOut ? new Date() : null, updatedAt: new Date() })
      .where(
        sql`regexp_replace(${leads.phone}, '[^0-9]', '', 'g') IN (${normalizedPhone}, ${national})`,
      )
      .returning({ id: leads.id });
    return updated.length;
  }
}
