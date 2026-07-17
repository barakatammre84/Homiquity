// Storage domain: Application milestones, SLA configurations, analytics snapshots + computed.
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
} from "drizzle-orm";
// SSN uses ssnVault (canonical, from main); account numbers use piiVault (this
// branch — main leaves account numbers plaintext).

import {
  loanApplications,
  applicationMilestones,
  slaConfigurations,
  analyticsSnapshots,
  type ApplicationMilestone,
  type InsertApplicationMilestone,
  type SlaConfiguration,
  type InsertSlaConfiguration,
  type AnalyticsSnapshot,
  type InsertAnalyticsSnapshot,
} from "@shared/schema";
import { PartnersStorage } from "./partners";
export class OpsAnalyticsStorage extends PartnersStorage {
  // ===== APPLICATION MILESTONES =====
  async createApplicationMilestone(data: InsertApplicationMilestone): Promise<ApplicationMilestone> {
    const [milestone] = await db.insert(applicationMilestones).values(data).returning();
    return milestone;
  }

  async getApplicationMilestone(applicationId: string): Promise<ApplicationMilestone | undefined> {
    const [milestone] = await db
      .select()
      .from(applicationMilestones)
      .where(eq(applicationMilestones.applicationId, applicationId));
    return milestone;
  }

  async updateApplicationMilestone(applicationId: string, data: Partial<ApplicationMilestone>): Promise<ApplicationMilestone | undefined> {
    const { id, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(applicationMilestones)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(applicationMilestones.applicationId, applicationId))
      .returning();
    return updated;
  }

  async getOrCreateApplicationMilestone(applicationId: string): Promise<ApplicationMilestone> {
    let milestone = await this.getApplicationMilestone(applicationId);
    if (!milestone) {
      milestone = await this.createApplicationMilestone({
        applicationId,
        applicationReceivedAt: new Date(),
      });
    }
    return milestone;
  }

  // ===== SLA CONFIGURATIONS =====
  async createSlaConfiguration(data: InsertSlaConfiguration): Promise<SlaConfiguration> {
    const [config] = await db.insert(slaConfigurations).values(data).returning();
    return config;
  }

  async getActiveSlaConfiguration(loanType?: string): Promise<SlaConfiguration | undefined> {
    const now = new Date();
    let query;
    if (loanType) {
      query = db
        .select()
        .from(slaConfigurations)
        .where(
          and(
            eq(slaConfigurations.isActive, true),
            lte(slaConfigurations.effectiveDate, now),
            or(eq(slaConfigurations.loanType, loanType), sql`${slaConfigurations.loanType} IS NULL`)
          )
        )
        .orderBy(desc(slaConfigurations.effectiveDate))
        .limit(1);
    } else {
      query = db
        .select()
        .from(slaConfigurations)
        .where(and(eq(slaConfigurations.isActive, true), lte(slaConfigurations.effectiveDate, now)))
        .orderBy(desc(slaConfigurations.effectiveDate))
        .limit(1);
    }
    const [config] = await query;
    return config;
  }

  async getAllSlaConfigurations(): Promise<SlaConfiguration[]> {
    return await db.select().from(slaConfigurations).orderBy(desc(slaConfigurations.effectiveDate));
  }

  async updateSlaConfiguration(id: string, data: Partial<SlaConfiguration>): Promise<SlaConfiguration | undefined> {
    const { id: configId, createdAt, ...cleanData } = data as any;
    const [updated] = await db
      .update(slaConfigurations)
      .set({ ...cleanData, updatedAt: new Date() })
      .where(eq(slaConfigurations.id, id))
      .returning();
    return updated;
  }

  // ===== ANALYTICS SNAPSHOTS =====
  async createAnalyticsSnapshot(data: InsertAnalyticsSnapshot): Promise<AnalyticsSnapshot> {
    const [snapshot] = await db.insert(analyticsSnapshots).values(data).returning();
    return snapshot;
  }

  async getLatestAnalyticsSnapshot(): Promise<AnalyticsSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(analyticsSnapshots)
      .orderBy(desc(analyticsSnapshots.snapshotDate))
      .limit(1);
    return snapshot;
  }

  async getAnalyticsSnapshots(days: number): Promise<AnalyticsSnapshot[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return await db
      .select()
      .from(analyticsSnapshots)
      .where(gte(analyticsSnapshots.snapshotDate, startDate))
      .orderBy(asc(analyticsSnapshots.snapshotDate));
  }

  // ===== ANALYTICS COMPUTED =====
  async computePipelineMetrics(): Promise<{
    totalApplications: number;
    byStatus: { status: string; count: number }[];
    avgCycleTimeHours: number | null;
    slaComplianceRate: number | null;
    closedVolume: string;
    fundedVolume: string;
  }> {
    const apps = await db.select().from(loanApplications);
    const byStatus: Record<string, number> = {};
    let closedVolume = 0;
    let fundedVolume = 0;

    for (const app of apps) {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
      if (app.status === "funded") {
        const amount = parseFloat(app.preApprovalAmount || "0");
        closedVolume += amount;
        fundedVolume += amount;
      }
    }

    const milestones = await db
      .select()
      .from(applicationMilestones)
      .where(sql`${applicationMilestones.totalCycleTimeHours} IS NOT NULL`);
    
    let avgCycleTime = null;
    if (milestones.length > 0) {
      const total = milestones.reduce((sum, m) => sum + parseFloat(m.totalCycleTimeHours || "0"), 0);
      avgCycleTime = total / milestones.length;
    }

    const slaMet = milestones.filter(m => m.isSlaMet === true).length;
    const slaComplianceRate = milestones.length > 0 ? (slaMet / milestones.length) * 100 : null;

    return {
      totalApplications: apps.length,
      byStatus: Object.entries(byStatus).map(([status, count]) => ({ status, count })),
      avgCycleTimeHours: avgCycleTime,
      slaComplianceRate,
      closedVolume: closedVolume.toFixed(2),
      fundedVolume: fundedVolume.toFixed(2),
    };
  }

  async getStaffWorkloadMetrics(): Promise<{
    loansPerLO: { userId: string; count: number }[];
    loansPerProcessor: { userId: string; count: number }[];
    loansPerUnderwriter: { userId: string; count: number }[];
  }> {
    const apps = await db.select().from(loanApplications);
    const loByLO: Record<string, number> = {};
    
    for (const app of apps) {
      if (app.referringBrokerId) {
        loByLO[app.referringBrokerId] = (loByLO[app.referringBrokerId] || 0) + 1;
      }
    }

    return {
      loansPerLO: Object.entries(loByLO).map(([userId, count]) => ({ userId, count })),
      loansPerProcessor: [],
      loansPerUnderwriter: [],
    };
  }

  async getBottleneckAnalysis(): Promise<{
    stage: string;
    avgTimeHours: number;
    count: number;
    atRisk: number;
  }[]> {
    const milestones = await db.select().from(applicationMilestones);
    
    const stages = [
      { name: "Document Collection", start: "applicationReceivedAt", end: "documentCollectionCompletedAt" },
      { name: "Processing", start: "submittedToProcessingAt", end: "processingCompletedAt" },
      { name: "Underwriting", start: "submittedToUnderwritingAt", end: "conditionalApprovalAt" },
      { name: "Closing", start: "clearToCloseAt", end: "closedAt" },
    ];

    const analysis = stages.map(stage => {
      const relevantMilestones = milestones.filter(m => {
        const start = (m as any)[stage.start];
        const end = (m as any)[stage.end];
        return start && end;
      });

      let totalHours = 0;
      for (const m of relevantMilestones) {
        const start = new Date((m as any)[stage.start]).getTime();
        const end = new Date((m as any)[stage.end]).getTime();
        totalHours += (end - start) / (1000 * 60 * 60);
      }

      const inProgress = milestones.filter(m => {
        const start = (m as any)[stage.start];
        const end = (m as any)[stage.end];
        return start && !end;
      });

      return {
        stage: stage.name,
        avgTimeHours: relevantMilestones.length > 0 ? totalHours / relevantMilestones.length : 0,
        count: relevantMilestones.length,
        atRisk: inProgress.length,
      };
    });

    return analysis;
  }

}
