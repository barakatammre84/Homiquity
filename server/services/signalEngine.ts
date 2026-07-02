import { db } from "../db";
import { documents, loanApplications, loanConditions, users } from "@shared/schema";
import { and, inArray, isNotNull, lte, sql } from "drizzle-orm";

/**
 * Staff signals feed — the loan-officer "who needs attention first" queue.
 *
 * Aggregates the platform's machine-generated signals into one prioritized
 * list so an LO opens the day knowing exactly which files to touch:
 *   1 (act now)   — pre-underwriting flags blocking progress
 *   2 (review)    — conditions moved to "submitted" by document uploads
 *   3 (rescue)    — applications stalled mid-funnel (no activity in 3+ days)
 *   4 (freshness) — documents approaching the 30-day staleness rule
 *
 * Pure read — the feed derives from state the engines already maintain
 * (preUnderwriting, pipelineEngine condition matching, optimizationEngine).
 */

export interface StaffSignal {
  type: "preuw_flag" | "conditions_review" | "stalled" | "docs_expiring";
  priority: 1 | 2 | 3 | 4;
  applicationId: string;
  borrowerName: string;
  title: string;
  detail: string;
}

const ACTIVE_STATUSES = [
  "submitted",
  "analyzing",
  "pre_approved",
  "verified",
  "doc_collection",
  "processing",
  "underwriting",
  "conditional",
] as const;

const DOC_FRESHNESS_DAYS = 30;
const DOC_WARNING_DAYS = 25;
const STALL_DAYS = 3;

export async function buildStaffSignals(limit = 30): Promise<StaffSignal[]> {
  const activeApps = await db
    .select({
      id: loanApplications.id,
      userId: loanApplications.userId,
      status: loanApplications.status,
      updatedAt: loanApplications.updatedAt,
      preUwFlags: loanApplications.preUwFlags,
    })
    .from(loanApplications)
    .where(inArray(loanApplications.status, [...ACTIVE_STATUSES]));

  if (activeApps.length === 0) return [];
  const appIds = activeApps.map((a) => a.id);
  const appById = new Map(activeApps.map((a) => [a.id, a]));

  const [conditionRows, docRows, userRows] = await Promise.all([
    db
      .select({
        applicationId: loanConditions.applicationId,
        title: loanConditions.title,
      })
      .from(loanConditions)
      .where(and(inArray(loanConditions.applicationId, appIds), sql`${loanConditions.status} = 'submitted'`)),
    db
      .select({
        applicationId: documents.applicationId,
        fileName: documents.fileName,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          isNotNull(documents.applicationId),
          inArray(documents.applicationId, appIds),
          lte(documents.createdAt, sql`now() - interval '${sql.raw(String(DOC_WARNING_DAYS))} days'`),
        ),
      ),
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(inArray(users.id, [...new Set(activeApps.map((a) => a.userId))])),
  ]);

  const nameOf = new Map(
    userRows.map((u) => [u.id, [u.firstName, u.lastName].filter(Boolean).join(" ") || u.email || "Borrower"]),
  );
  const borrower = (appId: string) => nameOf.get(appById.get(appId)?.userId ?? "") ?? "Borrower";

  const signals: StaffSignal[] = [];

  // 1 — pre-underwriting flags
  for (const app of activeApps) {
    const flags = (app.preUwFlags as { flags?: Array<{ code: string; severity: string; reason: string }> } | null)
      ?.flags;
    if (flags && flags.length > 0) {
      const blocking = flags.some((f) => f.severity === "blocking");
      signals.push({
        type: "preuw_flag",
        priority: 1,
        applicationId: app.id,
        borrowerName: borrower(app.id),
        title: flags.map((f) => f.code.replace(/_/g, " ").toLowerCase()).join(", "),
        detail: (blocking ? "Blocking: " : "") + flags[0].reason,
      });
    }
  }

  // 2 — conditions awaiting review (uploaded documents matched by the pipeline)
  const conditionsByApp = new Map<string, string[]>();
  for (const c of conditionRows) {
    (conditionsByApp.get(c.applicationId) ?? conditionsByApp.set(c.applicationId, []).get(c.applicationId)!).push(
      c.title,
    );
  }
  for (const [appId, titles] of conditionsByApp) {
    signals.push({
      type: "conditions_review",
      priority: 2,
      applicationId: appId,
      borrowerName: borrower(appId),
      title: `${titles.length} condition${titles.length === 1 ? "" : "s"} ready for review`,
      detail: titles.slice(0, 3).join("; "),
    });
  }

  // 3 — stalled applications (no update in STALL_DAYS on early stages)
  const stallCutoff = Date.now() - STALL_DAYS * 24 * 3600 * 1000;
  for (const app of activeApps) {
    if (!["submitted", "analyzing", "doc_collection"].includes(app.status)) continue;
    const updated = app.updatedAt ? new Date(app.updatedAt).getTime() : 0;
    if (updated > 0 && updated < stallCutoff) {
      const days = Math.floor((Date.now() - updated) / (24 * 3600 * 1000));
      signals.push({
        type: "stalled",
        priority: 3,
        applicationId: app.id,
        borrowerName: borrower(app.id),
        title: `No activity for ${days} days`,
        detail: `File is sitting in "${app.status.replace(/_/g, " ")}" — a nudge or a call may unstick it.`,
      });
    }
  }

  // 4 — documents approaching the 30-day freshness rule
  const docsByApp = new Map<string, { fileName: string; ageDays: number }[]>();
  for (const d of docRows) {
    if (!d.applicationId || !d.createdAt) continue;
    const ageDays = Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (24 * 3600 * 1000));
    if (ageDays >= DOC_FRESHNESS_DAYS + 30) continue; // ancient docs on dormant files are noise
    (docsByApp.get(d.applicationId) ?? docsByApp.set(d.applicationId, []).get(d.applicationId)!).push({
      fileName: d.fileName,
      ageDays,
    });
  }
  for (const [appId, docs_] of docsByApp) {
    const oldest = Math.max(...docs_.map((d) => d.ageDays));
    signals.push({
      type: "docs_expiring",
      priority: 4,
      applicationId: appId,
      borrowerName: borrower(appId),
      title: `${docs_.length} document${docs_.length === 1 ? "" : "s"} aging (oldest ${oldest}d)`,
      detail: `Most lenders require documents under ${DOC_FRESHNESS_DAYS} days old at underwriting — request refreshed copies before this delays closing.`,
    });
  }

  signals.sort((a, b) => a.priority - b.priority);
  return signals.slice(0, limit);
}
