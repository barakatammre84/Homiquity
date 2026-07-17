// Storage domain: Dashboard/user stats.
// One link in the DatabaseStorage inheritance chain — see ./index.ts.
import { db } from "../db";
import { eq, desc, and, sql } from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).
import { AMOUNT_BEARING_STATUSES } from "@shared/stageRequirements";

import { users, loanApplications, loanOptions, documents, isApprovedGradeLoanAppStatus } from "@shared/schema";
import { PropertiesStorage } from "./properties";
export class StatsStorage extends PropertiesStorage {
  // Stats
  async getAdminStats() {
    const [
      [userCount],
      appStats,
      recentAppsWithUsers,
      loanTypeStats,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(users),

      db.select({
        status: loanApplications.status,
        count: sql<number>`count(*)::int`,
        // Coherent amount: purchase price once under contract, else the
        // pre-approval amount — pre-approval precedes property selection (#7).
        volume: sql<string>`coalesce(sum(coalesce(purchase_price::numeric, pre_approval_amount::numeric)), 0)::text`,
      })
        .from(loanApplications)
        .groupBy(loanApplications.status),

      db.select({
        application: loanApplications,
        user: users,
      })
        .from(loanApplications)
        .leftJoin(users, eq(loanApplications.userId, users.id))
        .orderBy(desc(loanApplications.createdAt))
        .limit(10),

      db.select({
        type: loanOptions.loanType,
        count: sql<number>`count(DISTINCT ${loanOptions.applicationId})::int`,
        volume: sql<string>`coalesce(sum(${loanOptions.loanAmount}::numeric), 0)::text`,
      })
        .from(loanOptions)
        .innerJoin(loanApplications, eq(loanOptions.applicationId, loanApplications.id))
        .where(eq(loanOptions.isRecommended, true))
        .groupBy(loanOptions.loanType),
    ]);

    const totalApplications = appStats.reduce((sum, s) => sum + s.count, 0);
    // Approval rate = applications at or past pre-approval. (The old check for
    // a literal "approved" status matched nothing — that metric read 0.)
    const approvedCount = appStats
      .filter(s => isApprovedGradeLoanAppStatus(s.status))
      .reduce((sum, s) => sum + s.count, 0);
    // Pipeline volume = coherent amount across every amount-bearing status, not
    // just fully-approved files — a pre-approved file has real pipeline value
    // before a property is chosen, so summing only "approved" reads $0 (#7).
    const totalLoanVolume = appStats
      .filter(s => AMOUNT_BEARING_STATUSES.has(s.status))
      .reduce((sum, s) => sum + (parseFloat(s.volume) || 0), 0)
      .toString();
    const approvalRate = totalApplications > 0
      ? Math.round((approvedCount / totalApplications) * 100)
      : 0;

    const appsWithUsers = recentAppsWithUsers.map(r => ({
      ...r.application,
      user: r.user,
    }));

    const loansByTypeMap = new Map(loanTypeStats.map(lt => [lt.type, lt]));
    const loansByType = ["conventional", "fha", "va"].map(type => ({
      type,
      count: loansByTypeMap.get(type)?.count ?? 0,
      volume: loansByTypeMap.get(type)?.volume ?? "0",
    }));

    return {
      totalUsers: userCount.count,
      totalApplications,
      totalLoanVolume,
      approvalRate,
      applicationsByStatus: appStats.map(s => ({ status: s.status, count: s.count })),
      loansByType,
      recentApplications: appsWithUsers,
    };
  }

  async getDashboardStats(userId: string) {
    const [appCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(loanApplications)
      .where(eq(loanApplications.userId, userId));

    const [preApproved] = await db
      .select({ total: sql<string>`coalesce(max(pre_approval_amount::numeric), 0)::text` })
      .from(loanApplications)
      .where(
        and(
          eq(loanApplications.userId, userId),
          eq(loanApplications.status, "pre_approved")
        )
      );

    const [pendingDocs] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(eq(documents.userId, userId), eq(documents.status, "uploaded"))
      );

    return {
      totalApplications: appCount.count,
      preApprovedAmount: preApproved.total,
      pendingDocuments: pendingDocs.count,
    };
  }

}
