/**
 * IO seam for the G-C cycle-time / pull-through report: loads the window's
 * applications and each file's FIRST transition into "funded" from the audit
 * trail, then hands both to the pure shared computation. The audit log is the
 * source of funding timestamps because loan_applications keeps only a mutable
 * updatedAt — the status ledger is the immutable record (roadmap G-C).
 */
import { db } from "../db";
import { and, eq, gte, sql } from "drizzle-orm";
import { loanApplications, auditLogs } from "@shared/schema";
import { computeCycleTimeReport, type CycleTimeReport } from "@shared/cycleTimeReport";

export async function buildCycleTimeReport(windowDays: number): Promise<CycleTimeReport> {
  const cutoff = new Date(Date.now() - windowDays * 86_400_000);

  const apps = await db
    .select({
      id: loanApplications.id,
      createdAt: loanApplications.createdAt,
      status: loanApplications.status,
    })
    .from(loanApplications)
    .where(gte(loanApplications.createdAt, cutoff));

  const fundedRows = await db
    .select({
      applicationId: auditLogs.targetId,
      fundedAt: sql<string>`min(${auditLogs.createdAt})`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, "loan_application.status_changed"),
        sql`${auditLogs.metadata} ->> 'newStatus' = 'funded'`,
      ),
    )
    .groupBy(auditLogs.targetId);

  return computeCycleTimeReport(
    windowDays,
    apps
      .filter((a) => a.createdAt != null)
      .map((a) => ({ id: a.id, createdAt: a.createdAt!, status: a.status })),
    fundedRows
      .filter((r) => r.applicationId != null)
      .map((r) => ({ applicationId: r.applicationId!, fundedAt: r.fundedAt })),
  );
}
