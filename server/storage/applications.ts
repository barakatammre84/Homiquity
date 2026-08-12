// Storage domain: Loan applications, loan options, documents, deal activities.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { groupRowsByKeyDense } from "./batchGroup";
import { eq, desc, and, inArray } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  loanApplications,
  loanOptions,
  documents,
  dealActivities,
  dealTeamMembers,
  isInternalStaffRole,
  type LoanApplication,
  type InsertLoanApplication,
  type LoanOption,
  type InsertLoanOption,
  type Document,
  type InsertDocument,
  type DealActivity,
  type InsertDealActivity,
} from "@shared/schema";
import { WRITER_CONTRACT_KEY, WRITER_CONTRACT_VERSION } from "@shared/borrowerActivityView";
import { UsersStorage } from "./users";
export class ApplicationsStorage extends UsersStorage {
  // Loan Applications
  async createLoanApplication(data: InsertLoanApplication): Promise<LoanApplication> {
    const [application] = await db.insert(loanApplications).values(data).returning();
    return application;
  }

  async getLoanApplication(id: string): Promise<LoanApplication | undefined> {
    const [application] = await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.id, id))
      .limit(1);
    return application;
  }

  async getLoanApplicationWithAccess(id: string, userId: string, userRole: string): Promise<LoanApplication | undefined> {
    // Admins retain platform-wide access.
    if (userRole === "admin") {
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(eq(loanApplications.id, id))
        .limit(1);
      return application;
    }

    // All non-admin internal staff (lo, loa, processor, underwriter, closer) and
    // external partner roles (broker, lender) must be active deal-team members on the
    // specific application. No assignment = no access.
    if (isInternalStaffRole(userRole) || userRole === "broker" || userRole === "lender") {
      const [application] = await db
        .select()
        .from(loanApplications)
        .where(eq(loanApplications.id, id))
        .limit(1);

      if (!application) return undefined;

      const [membership] = await db
        .select({ id: dealTeamMembers.id })
        .from(dealTeamMembers)
        .where(and(
          eq(dealTeamMembers.applicationId, id),
          eq(dealTeamMembers.userId, userId),
          eq(dealTeamMembers.isActive, true)
        ))
        .limit(1);

      return membership ? application : undefined;
    }

    // Borrowers can only access their own applications.
    const [application] = await db
      .select()
      .from(loanApplications)
      .where(and(
        eq(loanApplications.id, id),
        eq(loanApplications.userId, userId)
      ))
      .limit(1);
    return application;
  }

  async getLoanApplicationsByUser(userId: string): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.userId, userId))
      .orderBy(desc(loanApplications.createdAt));
  }

  // Batched variant for list views (the /api/dashboard inArray house pattern) —
  // same newest-first ordering per user as getLoanApplicationsByUser.
  async getLoanApplicationsByUserIds(userIds: string[]): Promise<LoanApplication[]> {
    if (userIds.length === 0) return [];
    return await db
      .select()
      .from(loanApplications)
      .where(inArray(loanApplications.userId, userIds))
      .orderBy(desc(loanApplications.createdAt));
  }

  async getAllLoanApplications(limit: number = 500): Promise<LoanApplication[]> {
    return await db
      .select()
      .from(loanApplications)
      .orderBy(desc(loanApplications.createdAt))
      .limit(limit);
  }

  async updateLoanApplication(
    id: string,
    data: Partial<LoanApplication>
  ): Promise<LoanApplication | undefined> {
    const [application] = await db
      .update(loanApplications)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(loanApplications.id, id))
      .returning();
    return application;
  }

  // Loan Options
  async createLoanOption(data: InsertLoanOption): Promise<LoanOption> {
    const [option] = await db.insert(loanOptions).values(data).returning();
    return option;
  }

  async getLoanOption(id: string): Promise<LoanOption | undefined> {
    const [option] = await db
      .select()
      .from(loanOptions)
      .where(eq(loanOptions.id, id))
      .limit(1);
    return option;
  }

  async getLoanOptionsByApplication(applicationId: string): Promise<LoanOption[]> {
    return await db
      .select()
      .from(loanOptions)
      .where(eq(loanOptions.applicationId, applicationId))
      .orderBy(loanOptions.isRecommended);
  }

  // Used to keep intake finalization idempotent: clear prior options before a
  // re-drive so a recovered application doesn't accumulate duplicate scenarios.
  async deleteLoanOptionsByApplication(applicationId: string): Promise<void> {
    await db.delete(loanOptions).where(eq(loanOptions.applicationId, applicationId));
  }

  async updateLoanOption(id: string, data: Partial<LoanOption>): Promise<LoanOption | undefined> {
    const [option] = await db
      .update(loanOptions)
      .set(data)
      .where(eq(loanOptions.id, id))
      .returning();
    return option;
  }

  async lockLoanOption(id: string): Promise<LoanOption | undefined> {
    const lockExpiry = new Date();
    lockExpiry.setDate(lockExpiry.getDate() + 30);

    const [option] = await db
      .update(loanOptions)
      .set({
        isLocked: true,
        lockedAt: new Date(),
        lockExpiresAt: lockExpiry,
      })
      .where(eq(loanOptions.id, id))
      .returning();
    return option;
  }

  // Documents
  async createDocument(data: InsertDocument): Promise<Document> {
    const [doc] = await db.insert(documents).values(data).returning();
    return doc;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return doc;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByApplication(applicationId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.applicationId, applicationId))
      .orderBy(desc(documents.createdAt));
  }

  // Batched variant of getDocumentsByApplication for list views — one query for
  // N applications instead of N. Same `orderBy`, so each bucket comes out in
  // the order the per-application query produced (see ./batchGroup.ts).
  async getDocumentsByApplications(applicationIds: string[]): Promise<Map<string, Document[]>> {
    if (applicationIds.length === 0) return new Map();
    const rows = await db
      .select()
      .from(documents)
      .where(inArray(documents.applicationId, applicationIds))
      .orderBy(desc(documents.createdAt));
    return groupRowsByKeyDense(applicationIds, rows, (row) => row.applicationId!);
  }

  async getDocumentsByStoragePath(storagePath: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.storagePath, storagePath))
      .limit(1);
  }

  async updateDocument(id: string, data: Partial<Document>): Promise<Document | undefined> {
    const [doc] = await db
      .update(documents)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return doc;
  }

  // Deal Activities
  async createDealActivity(data: InsertDealActivity): Promise<DealActivity> {
    // Single insert path for deal_activities, so this is where the writer
    // contract is recorded: the marker tells the borrower view that this row's
    // description is derived copy rather than pre-contract staff free text.
    // It rides metadata (embargoed from every client-role payload) because
    // created_at cannot carry the distinction — it is a zone-less timestamp
    // filled by the column default, so its meaning depends on the writing
    // session's timezone. See shared/borrowerActivityView.ts.
    const caller =
      data.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
        ? (data.metadata as Record<string, unknown>)
        : {};
    const [activity] = await db
      .insert(dealActivities)
      .values({ ...data, metadata: { ...caller, [WRITER_CONTRACT_KEY]: WRITER_CONTRACT_VERSION } })
      .returning();
    return activity;
  }

  async getDealActivitiesByApplication(applicationId: string): Promise<DealActivity[]> {
    return await db
      .select()
      .from(dealActivities)
      .where(eq(dealActivities.applicationId, applicationId))
      .orderBy(desc(dealActivities.createdAt));
  }

}
