// Storage domain: TRID change-of-circumstance, notifications, staff invites.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  notifications,
  staffInvites,
  type Notification,
  type InsertNotification,
  type StaffInvite,
  type InsertStaffInvite,
  auditLogs,
  type AuditLog,
  type InsertAuditLog,
  changeOfCircumstances,
  type ChangeOfCircumstance,
  type InsertChangeOfCircumstance,
  loanEstimateDisclosures,
  type LoanEstimateDisclosure,
  type InsertLoanEstimateDisclosure,
  loanCostEntries,
  type LoanCostEntry,
  type InsertLoanCostEntry,
} from "@shared/schema";
import { RealtorHomeownerStorage } from "./realtorHomeowner";
export class NotificationsOpsStorage extends RealtorHomeownerStorage {
  // TRID change of circumstance (Reg Z §1026.19(e)(3)(iv) / (e)(4)(i))
  async createChangeOfCircumstance(data: InsertChangeOfCircumstance): Promise<ChangeOfCircumstance> {
    const [coc] = await db.insert(changeOfCircumstances).values(data).returning();
    return coc;
  }

  async getChangeOfCircumstance(id: string): Promise<ChangeOfCircumstance | undefined> {
    const [coc] = await db.select().from(changeOfCircumstances).where(eq(changeOfCircumstances.id, id)).limit(1);
    return coc;
  }

  async getChangeOfCircumstancesByApplication(applicationId: string): Promise<ChangeOfCircumstance[]> {
    return db
      .select()
      .from(changeOfCircumstances)
      .where(eq(changeOfCircumstances.applicationId, applicationId))
      .orderBy(desc(changeOfCircumstances.createdAt));
  }

  async getOpenChangeOfCircumstances(applicationId: string): Promise<ChangeOfCircumstance[]> {
    return db
      .select()
      .from(changeOfCircumstances)
      .where(and(eq(changeOfCircumstances.applicationId, applicationId), eq(changeOfCircumstances.status, "open")))
      .orderBy(desc(changeOfCircumstances.createdAt));
  }

  async updateChangeOfCircumstance(id: string, data: Partial<ChangeOfCircumstance>): Promise<ChangeOfCircumstance | undefined> {
    const { createdAt, updatedAt, id: cocId, ...cleanData } = data as any;
    const [updated] = await db
      .update(changeOfCircumstances)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(changeOfCircumstances.id, id))
      .returning();
    return updated;
  }

  // ===== ISSUED LOAN ESTIMATE DISCLOSURES (TRID tolerance baseline) =====
  // Rows are immutable evidence of what was disclosed — there is deliberately
  // no update method.

  async createLoanEstimateDisclosure(data: InsertLoanEstimateDisclosure): Promise<LoanEstimateDisclosure> {
    const [row] = await db.insert(loanEstimateDisclosures).values(data).returning();
    return row;
  }

  /** The disclosure currently in force — the tolerance baseline. */
  async getLatestLoanEstimateDisclosure(applicationId: string): Promise<LoanEstimateDisclosure | undefined> {
    const [row] = await db
      .select()
      .from(loanEstimateDisclosures)
      .where(eq(loanEstimateDisclosures.applicationId, applicationId))
      .orderBy(desc(loanEstimateDisclosures.version))
      .limit(1);
    return row;
  }

  async getLoanEstimateDisclosures(applicationId: string): Promise<LoanEstimateDisclosure[]> {
    return db
      .select()
      .from(loanEstimateDisclosures)
      .where(eq(loanEstimateDisclosures.applicationId, applicationId))
      .orderBy(desc(loanEstimateDisclosures.version));
  }

  // ===== LOAN COST LEDGER (unit economics) =====
  // Append-only by convention: a correction is a negative reversal row, never
  // an edit, so there is deliberately no update or delete method.

  async createLoanCostEntry(data: InsertLoanCostEntry): Promise<LoanCostEntry> {
    const [row] = await db.insert(loanCostEntries).values(data).returning();
    return row;
  }

  async getLoanCostEntries(applicationId: string): Promise<LoanCostEntry[]> {
    return db
      .select()
      .from(loanCostEntries)
      .where(eq(loanCostEntries.applicationId, applicationId))
      .orderBy(desc(loanCostEntries.incurredAt));
  }

  /** Company-wide, for the unit-economics report. Admin-gated at the route. */
  async getAllLoanCostEntries(): Promise<LoanCostEntry[]> {
    return db.select().from(loanCostEntries).orderBy(desc(loanCostEntries.incurredAt));
  }

  // Single batched update (never update in a loop).
  async markChangeOfCircumstancesRedisclosed(ids: string[], deliveredAt: Date): Promise<ChangeOfCircumstance[]> {
    if (ids.length === 0) return [];
    return db
      .update(changeOfCircumstances)
      .set({ status: "redisclosed", revisedLeDeliveredAt: deliveredAt, updatedAt: new Date() })
      .where(inArray(changeOfCircumstances.id, ids))
      .returning();
  }

  // Notifications
  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data).returning();
    return notification;
  }

  async getNotificationsByUser(userId: string, limit: number = 50): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.status, "unread")));
    return Number(result[0]?.count || 0);
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ status: "read" })
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ status: "read" })
      .where(and(eq(notifications.userId, userId), eq(notifications.status, "unread")));
  }

  // Staff Invites
  async createStaffInvite(data: InsertStaffInvite): Promise<StaffInvite> {
    const [invite] = await db.insert(staffInvites).values(data).returning();
    return invite;
  }

  async getStaffInviteByCode(code: string): Promise<StaffInvite | undefined> {
    const [invite] = await db.select().from(staffInvites)
      .where(eq(staffInvites.code, code));
    return invite;
  }

  async getStaffInvites(): Promise<StaffInvite[]> {
    return db.select().from(staffInvites)
      .orderBy(desc(staffInvites.createdAt));
  }

  async redeemStaffInvite(code: string, userId: string): Promise<StaffInvite | undefined> {
    const [updated] = await db.update(staffInvites)
      .set({ usedAt: new Date(), usedBy: userId })
      .where(and(eq(staffInvites.code, code), sql`${staffInvites.usedAt} IS NULL`))
      .returning();
    return updated;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }

}
