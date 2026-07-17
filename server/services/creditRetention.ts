// FCRA/ECOA data-retention policies, retention status, archival.
// Split from the old server/services/creditService.ts — which re-exports all of it.
import { db } from "../db";
import { creditConsents, creditPulls, adverseActions, creditAuditLog, type CreditPull } from "@shared/schema";
import { eq, and, lt } from "drizzle-orm";
import { logCreditAction } from "./creditAuditChain";

// ============================================================================
// DATA RETENTION POLICIES
// ============================================================================

interface RetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number | null; // null = never delete, archive only
  legalBasis: string;
  regulatoryReference: string;
}

const DATA_RETENTION_POLICIES: Record<string, RetentionPolicy> = {
  credit_consent: {
    dataType: "credit_consent",
    retentionPeriodDays: 2555, // 7 years
    archiveAfterDays: 365, // Archive after 1 year
    deleteAfterDays: null, // Never delete - regulatory requirement
    legalBasis: "FCRA Section 604(b)(3) - Permissible purpose verification",
    regulatoryReference: "15 U.S.C. § 1681b(b)(3)",
  },
  credit_pull: {
    dataType: "credit_pull",
    retentionPeriodDays: 2555, // 7 years
    archiveAfterDays: 365,
    deleteAfterDays: null,
    legalBasis: "FCRA compliance and loan file retention",
    regulatoryReference: "12 CFR 1002.12 - Record retention",
  },
  adverse_action: {
    dataType: "adverse_action",
    retentionPeriodDays: 1825, // 5 years minimum under ECOA
    archiveAfterDays: 365,
    deleteAfterDays: null,
    legalBasis: "ECOA adverse action notice retention",
    regulatoryReference: "12 CFR 1002.12(b)(1)",
  },
  credit_audit_log: {
    dataType: "credit_audit_log",
    retentionPeriodDays: 2555, // 7 years
    archiveAfterDays: 730, // Archive after 2 years
    deleteAfterDays: null, // Never delete audit logs
    legalBasis: "Regulatory examination support and compliance verification",
    regulatoryReference: "CFPB Exam Manual - Fair Lending",
  },
  raw_bureau_response: {
    dataType: "raw_bureau_response",
    retentionPeriodDays: 2555,
    archiveAfterDays: 180, // Archive after 6 months (PII-heavy)
    deleteAfterDays: 2920, // Delete after 8 years
    legalBasis: "Loan file documentation with PII minimization",
    regulatoryReference: "GLBA Privacy Rule",
  },
  draft_consent: {
    dataType: "draft_consent",
    retentionPeriodDays: 7,
    archiveAfterDays: 7,
    deleteAfterDays: 7,
    legalBasis: "Session data - no regulatory retention requirement",
    regulatoryReference: "N/A",
  },
};

interface RetentionStatus {
  dataType: string;
  recordId: string;
  createdAt: Date;
  currentAgeDays: number;
  status: "active" | "archive_eligible" | "archived" | "delete_eligible";
  archiveEligibleDate: Date;
  deleteEligibleDate: Date | null;
  policy: RetentionPolicy;
}

export function getRetentionPolicies(): Record<string, RetentionPolicy> {
  return DATA_RETENTION_POLICIES;
}

export function getRetentionPolicy(dataType: string): RetentionPolicy | null {
  return DATA_RETENTION_POLICIES[dataType] || null;
}

function calculateRetentionStatus(
  dataType: string,
  recordId: string,
  createdAt: Date,
  archivedAt?: Date | null
): RetentionStatus | null {
  const policy = DATA_RETENTION_POLICIES[dataType];
  if (!policy) return null;

  const now = new Date();
  const ageMs = now.getTime() - createdAt.getTime();
  const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  const archiveEligibleDate = new Date(createdAt);
  archiveEligibleDate.setDate(archiveEligibleDate.getDate() + policy.archiveAfterDays);

  let deleteEligibleDate: Date | null = null;
  if (policy.deleteAfterDays) {
    deleteEligibleDate = new Date(createdAt);
    deleteEligibleDate.setDate(deleteEligibleDate.getDate() + policy.deleteAfterDays);
  }

  let status: RetentionStatus["status"] = "active";
  if (archivedAt) {
    status = "archived";
  } else if (deleteEligibleDate && now >= deleteEligibleDate) {
    status = "delete_eligible";
  } else if (now >= archiveEligibleDate) {
    status = "archive_eligible";
  }

  return {
    dataType,
    recordId,
    createdAt,
    currentAgeDays: ageDays,
    status,
    archiveEligibleDate,
    deleteEligibleDate,
    policy,
  };
}

export async function getApplicationRetentionStatus(
  applicationId: string
): Promise<{
  applicationId: string;
  records: RetentionStatus[];
  summary: {
    total: number;
    active: number;
    archiveEligible: number;
    archived: number;
    deleteEligible: number;
  };
  oldestRecord: Date | null;
  retentionCompliant: boolean;
}> {
  const [consents, pulls, actions, auditLogs] = await Promise.all([
    db.select().from(creditConsents).where(eq(creditConsents.applicationId, applicationId)),
    db.select().from(creditPulls).where(eq(creditPulls.applicationId, applicationId)),
    db.select().from(adverseActions).where(eq(adverseActions.applicationId, applicationId)),
    db.select().from(creditAuditLog).where(eq(creditAuditLog.applicationId, applicationId)),
  ]);

  const records: RetentionStatus[] = [];

  // Process consents
  for (const consent of consents) {
    const status = calculateRetentionStatus(
      "credit_consent",
      consent.id,
      consent.createdAt!,
      null
    );
    if (status) records.push(status);
  }

  // Process credit pulls
  for (const pull of pulls) {
    const status = calculateRetentionStatus(
      "credit_pull",
      pull.id,
      pull.createdAt!,
      pull.archivedAt
    );
    if (status) records.push(status);
  }

  // Process adverse actions
  for (const action of actions) {
    const status = calculateRetentionStatus(
      "adverse_action",
      action.id,
      action.createdAt!,
      null
    );
    if (status) records.push(status);
  }

  // Process audit logs
  for (const log of auditLogs) {
    const status = calculateRetentionStatus(
      "credit_audit_log",
      log.id.toString(),
      log.timestamp!,
      null
    );
    if (status) records.push(status);
  }

  const summary = {
    total: records.length,
    active: records.filter(r => r.status === "active").length,
    archiveEligible: records.filter(r => r.status === "archive_eligible").length,
    archived: records.filter(r => r.status === "archived").length,
    deleteEligible: records.filter(r => r.status === "delete_eligible").length,
  };

  const oldestRecord = records.length > 0
    ? new Date(Math.min(...records.map(r => r.createdAt.getTime())))
    : null;

  // Retention compliant means no records are delete-eligible without being archived
  const retentionCompliant = records.every(
    r => r.status !== "delete_eligible" || r.policy.deleteAfterDays === null
  );

  return {
    applicationId,
    records,
    summary,
    oldestRecord,
    retentionCompliant,
  };
}

export async function getArchiveEligibleRecords(): Promise<{
  creditPulls: CreditPull[];
  totalCount: number;
  byType: Record<string, number>;
}> {
  const archiveCutoff = new Date();
  archiveCutoff.setDate(archiveCutoff.getDate() - DATA_RETENTION_POLICIES.credit_pull.archiveAfterDays);

  const eligiblePulls = await db
    .select()
    .from(creditPulls)
    .where(
      and(
        lt(creditPulls.createdAt, archiveCutoff),
        eq(creditPulls.status, "completed")
      )
    );

  // Filter out already archived
  const notArchived = eligiblePulls.filter(p => !p.archivedAt);

  return {
    creditPulls: notArchived,
    totalCount: notArchived.length,
    byType: {
      credit_pull: notArchived.length,
    },
  };
}

export async function archiveCreditPull(
  creditPullId: string,
  archiveReason: string,
  performedBy: string
): Promise<void> {
  await db
    .update(creditPulls)
    .set({
      archivedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(creditPulls.id, creditPullId));

  const [pull] = await db
    .select()
    .from(creditPulls)
    .where(eq(creditPulls.id, creditPullId));

  if (pull) {
    await logCreditAction({
      applicationId: pull.applicationId,
      creditPullId: creditPullId,
      userId: pull.requestedBy,
      action: "credit_pull_archived",
      actionDetails: {
        reason: archiveReason,
        archivedAt: new Date().toISOString(),
      },
      performedBy,
    });
  }
}

export async function getRetentionComplianceReport(): Promise<{
  generatedAt: Date;
  policies: RetentionPolicy[];
  recordCounts: Record<string, number>;
  archiveEligibleCounts: Record<string, number>;
  deleteEligibleCounts: Record<string, number>;
  retentionReviewCounts: Record<string, number>;
  recommendations: string[];
}> {
  const now = new Date();
  const policies = Object.values(DATA_RETENTION_POLICIES);

  // Get actual data with creation dates for proper analysis
  const [consents, pulls, actions, auditLogs] = await Promise.all([
    db.select().from(creditConsents),
    db.select().from(creditPulls),
    db.select().from(adverseActions),
    db.select().from(creditAuditLog),
  ]);

  const recordCounts: Record<string, number> = {
    credit_consent: consents.length,
    credit_pull: pulls.length,
    adverse_action: actions.length,
    credit_audit_log: auditLogs.length,
  };

  // Calculate archive-eligible, delete-eligible, and retention-review counts
  const archiveEligibleCounts: Record<string, number> = {
    credit_consent: 0,
    credit_pull: 0,
    adverse_action: 0,
    credit_audit_log: 0,
  };
  const deleteEligibleCounts: Record<string, number> = {
    credit_consent: 0,
    credit_pull: 0,
    adverse_action: 0,
    credit_audit_log: 0,
  };
  const retentionReviewCounts: Record<string, number> = {
    credit_consent: 0,
    credit_pull: 0,
    adverse_action: 0,
    credit_audit_log: 0,
  };

  // Helper function to check record status
  const checkRecordStatus = (
    createdAt: Date | null,
    policy: RetentionPolicy,
    archivedAt?: Date | null
  ): "active" | "archive_eligible" | "delete_eligible" | "retention_review" => {
    if (!createdAt) return "active";
    
    const ageMs = now.getTime() - createdAt.getTime();
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    
    // Check if data has exceeded the retention period (regardless of deleteAfterDays)
    // This is a compliance violation - data should be reviewed for retention justification
    if (ageDays >= policy.retentionPeriodDays) {
      return "delete_eligible"; // Exceeding retention period = compliance flag
    }
    
    // Check delete eligibility (if explicit delete policy exists)
    if (policy.deleteAfterDays && ageDays >= policy.deleteAfterDays) {
      return "delete_eligible";
    }
    
    // Check if approaching retention period end (within 180 days of max retention)
    if (ageDays >= policy.retentionPeriodDays - 180) {
      return "retention_review";
    }
    
    // Check archive eligibility
    if (ageDays >= policy.archiveAfterDays && !archivedAt) {
      return "archive_eligible";
    }
    
    return "active";
  };

  // Process credit consents
  for (const consent of consents) {
    const status = checkRecordStatus(consent.createdAt, DATA_RETENTION_POLICIES.credit_consent);
    if (status === "archive_eligible") archiveEligibleCounts.credit_consent++;
    if (status === "delete_eligible") deleteEligibleCounts.credit_consent++;
    if (status === "retention_review") retentionReviewCounts.credit_consent++;
  }

  // Process credit pulls
  for (const pull of pulls) {
    const status = checkRecordStatus(pull.createdAt, DATA_RETENTION_POLICIES.credit_pull, pull.archivedAt);
    if (status === "archive_eligible") archiveEligibleCounts.credit_pull++;
    if (status === "delete_eligible") deleteEligibleCounts.credit_pull++;
    if (status === "retention_review") retentionReviewCounts.credit_pull++;
  }

  // Process adverse actions
  for (const action of actions) {
    const status = checkRecordStatus(action.createdAt, DATA_RETENTION_POLICIES.adverse_action);
    if (status === "archive_eligible") archiveEligibleCounts.adverse_action++;
    if (status === "delete_eligible") deleteEligibleCounts.adverse_action++;
    if (status === "retention_review") retentionReviewCounts.adverse_action++;
  }

  // Process audit logs
  for (const log of auditLogs) {
    const status = checkRecordStatus(log.timestamp, DATA_RETENTION_POLICIES.credit_audit_log);
    if (status === "archive_eligible") archiveEligibleCounts.credit_audit_log++;
    if (status === "delete_eligible") deleteEligibleCounts.credit_audit_log++;
    if (status === "retention_review") retentionReviewCounts.credit_audit_log++;
  }

  // Generate recommendations
  const recommendations: string[] = [];

  const archiveTotal = Object.values(archiveEligibleCounts).reduce((a, b) => a + b, 0);
  if (archiveTotal > 0) {
    recommendations.push(
      `${archiveTotal} records are eligible for archival. Consider running the archive process.`
    );
  }

  const reviewTotal = Object.values(retentionReviewCounts).reduce((a, b) => a + b, 0);
  if (reviewTotal > 0) {
    recommendations.push(
      `${reviewTotal} records are approaching the end of their retention period (within 180 days). Review for compliance planning.`
    );
  }

  if (recordCounts.credit_audit_log > 10000) {
    recommendations.push(
      "Audit log has grown large. Consider exporting older entries to cold storage."
    );
  }

  const deleteTotal = Object.values(deleteEligibleCounts).reduce((a, b) => a + b, 0);
  if (deleteTotal > 0) {
    recommendations.push(
      `${deleteTotal} records are past their retention period. Review for secure deletion.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push("All retention policies are being met. No action required.");
  }

  return {
    generatedAt: now,
    policies,
    recordCounts,
    archiveEligibleCounts,
    deleteEligibleCounts,
    retentionReviewCounts,
    recommendations,
  };
}
