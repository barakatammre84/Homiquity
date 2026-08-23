// Storage domain: Broker referrals + commissions.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, or } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  users,
  loanApplications,
  brokerCommissions,
  type LoanApplication,
  type BrokerCommission,
  type InsertBrokerCommission,
  LOAN_APP_STATUSES,
  isTerminalLoanAppStatus,
} from "@shared/schema";
import { RatesStorage } from "./rates";
import { toPublicUser, type PublicUser } from "./publicUser";
export class BrokerReferralsStorage extends RatesStorage {
  // Broker Referrals & Commissions
  async getBrokerReferrals(brokerId: string): Promise<(LoanApplication & { borrower: PublicUser })[]> {
    const referrals = await db
      .select()
      .from(loanApplications)
      .innerJoin(users, eq(loanApplications.userId, users.id))
      .where(eq(loanApplications.referringBrokerId, brokerId))
      .orderBy(desc(loanApplications.createdAt));
    
    return referrals.map(r => ({
      ...r.loan_applications,
      borrower: toPublicUser(r.users),
    }));
  }

  async getBrokerReferralStats(brokerId: string): Promise<{
    totalReferrals: number;
    activeReferrals: number;
    closedLoans: number;
    totalLoanVolume: string;
    totalCommissionsEarned: string;
    pendingCommissions: string;
  }> {
    const referrals = await db
      .select()
      .from(loanApplications)
      .where(eq(loanApplications.referringBrokerId, brokerId));
    
    // Active = any non-terminal status; closed = funded. (The old hand-lists
    // contained phantom values — "verified", "approved", "closed" — that no
    // backend path writes, so broker closed-loan stats were permanently 0.)
    const activeStatuses = LOAN_APP_STATUSES.filter(s => !isTerminalLoanAppStatus(s)) as string[];
    const closedStatuses = ["funded"];
    
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => activeStatuses.includes(r.status)).length;
    const closedLoans = referrals.filter(r => closedStatuses.includes(r.status)).length;
    
    const closedLoanVolume = referrals
      .filter(r => closedStatuses.includes(r.status))
      .reduce((sum, r) => sum + Number(r.purchasePrice || 0), 0);
    
    const commissions = await db
      .select()
      .from(brokerCommissions)
      .where(eq(brokerCommissions.brokerId, brokerId));
    
    const paidCommissions = commissions
      .filter(c => c.status === "paid")
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
    
    const pendingCommissions = commissions
      .filter(c => c.status === "pending" || c.status === "approved")
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);
    
    return {
      totalReferrals,
      activeReferrals,
      closedLoans,
      totalLoanVolume: closedLoanVolume.toFixed(2),
      totalCommissionsEarned: paidCommissions.toFixed(2),
      pendingCommissions: pendingCommissions.toFixed(2),
    };
  }

  async createBrokerCommission(data: InsertBrokerCommission): Promise<BrokerCommission> {
    const [commission] = await db
      .insert(brokerCommissions)
      .values(data)
      .returning();
    return commission;
  }

  async getBrokerCommissions(brokerId: string): Promise<(BrokerCommission & { application: LoanApplication })[]> {
    const commissions = await db
      .select()
      .from(brokerCommissions)
      .innerJoin(loanApplications, eq(brokerCommissions.applicationId, loanApplications.id))
      .where(eq(brokerCommissions.brokerId, brokerId))
      .orderBy(desc(brokerCommissions.createdAt));
    
    return commissions.map(c => ({
      ...c.broker_commissions,
      application: c.loan_applications,
    }));
  }

  async getBrokerCommission(id: string): Promise<BrokerCommission | undefined> {
    const [commission] = await db
      .select()
      .from(brokerCommissions)
      .where(eq(brokerCommissions.id, id));
    return commission;
  }

  async updateBrokerCommission(id: string, data: Partial<BrokerCommission>): Promise<BrokerCommission | undefined> {
    const { id: commissionId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(brokerCommissions)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(brokerCommissions.id, id))
      .returning();
    return updated;
  }

  /**
   * Every commission row, whatever its status. The financial roll-ups need the
   * rejected and paid rows too — `getAllPendingCommissions` is an admin work
   * queue, not a ledger, and reading a ledger off a queue was how commission
   * payouts stayed outside the margin figure.
   */
  async getAllBrokerCommissions(): Promise<BrokerCommission[]> {
    return db.select().from(brokerCommissions).orderBy(desc(brokerCommissions.createdAt));
  }

  async getAllPendingCommissions(): Promise<(BrokerCommission & { broker: PublicUser; application: LoanApplication })[]> {
    const commissions = await db
      .select()
      .from(brokerCommissions)
      .innerJoin(users, eq(brokerCommissions.brokerId, users.id))
      .innerJoin(loanApplications, eq(brokerCommissions.applicationId, loanApplications.id))
      .where(or(eq(brokerCommissions.status, "pending"), eq(brokerCommissions.status, "approved")))
      .orderBy(desc(brokerCommissions.createdAt));
    
    return commissions.map(c => ({
      ...c.broker_commissions,
      broker: toPublicUser(c.users),
      application: c.loan_applications,
    }));
  }

}
