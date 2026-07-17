import { db } from "../db";
import {
  documents,
  loanApplications,
  loanConditions,
  users,
  LOAN_APP_STATUSES,
  LOAN_APP_TERMINAL_STATUSES,
  type LoanAppStatus,
} from "@shared/schema";
import { and, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import { storage } from "../storage";

/**
 * Staff signals feed — the loan-officer "who needs attention first" queue.
 *
 * Aggregates the platform's machine-generated signals into one prioritized
 * list so an LO opens the day knowing exactly which files to touch:
 *   1 (act now)   — pre-underwriting flags blocking progress
 *   2 (review)    — conditions moved to "submitted" by document uploads;
 *                   documents staged for human verify (extraction ran, a
 *                   human decision is owed — deep-links to the workbench)
 *   3 (rescue)    — applications stalled mid-funnel (no activity in 3+ days);
 *                   also investor-loan (DSCR) candidates from tax insights
 *   4 (freshness) — documents approaching the 30-day staleness rule
 *
 * Pure read — the feed derives from state the engines already maintain
 * (preUnderwriting, pipelineEngine condition matching, documentConfidence,
 * optimizationEngine).
 */

export interface StaffSignal {
  type:
    | "preuw_flag"
    | "conditions_review"
    | "docs_ready_for_review"
    | "stalled"
    | "docs_expiring"
    | "investor_candidate";
  priority: 1 | 2 | 3 | 4;
  /** Null for signals that predate any application (e.g. incubator tax insights). */
  applicationId: string | null;
  /** Set when applicationId is null so the client can still identify the person. */
  userId?: string;
  borrowerName: string;
  title: string;
  detail: string;
}

const DSCR_SIGNAL_WINDOW_DAYS = 30;

export interface DocsReadyGroup {
  applicationId: string;
  count: number;
  /** First three file names, for the signal detail line. */
  fileNames: string[];
}

/**
 * Pure grouping for the docs-ready-for-review signal (exported for tests):
 * one group per application, counting its documents awaiting a human verdict.
 * This definition intentionally equals the workbench's "needs review" bucket
 * (client/src/lib/documentReview.ts documentReviewGroup) so the signal count
 * matches what the reviewer sees after clicking through.
 */
export function planDocsReadySignals(
  rows: Array<{ applicationId: string | null; fileName: string }>,
): DocsReadyGroup[] {
  const byApp = new Map<string, DocsReadyGroup>();
  for (const row of rows) {
    if (!row.applicationId) continue;
    const group =
      byApp.get(row.applicationId) ?? { applicationId: row.applicationId, count: 0, fileNames: [] };
    group.count += 1;
    if (group.fileNames.length < 3) group.fileNames.push(row.fileName);
    byApp.set(row.applicationId, group);
  }
  return [...byApp.values()];
}

/**
 * Investor-loan (DSCR) candidates: users whose self-uploaded tax return showed
 * Schedule E rental income. Informational lead signal only — no compensation
 * or referral mechanics attach to it (RESPA §8).
 */
async function buildDscrSignals(): Promise<StaffSignal[]> {
  try {
    const candidates = await storage.getRecentDscrCandidates(DSCR_SIGNAL_WINDOW_DAYS, 20);
    return candidates.map((c) => {
      const props = c.rentalPropertyCount
        ? `, ${c.rentalPropertyCount} propert${c.rentalPropertyCount === 1 ? "y" : "ies"}`
        : "";
      const via = c.cpaFirm ? ` Referred by ${c.cpaFirm} (CPA).` : "";
      return {
        type: "investor_candidate" as const,
        priority: 3 as const,
        applicationId: null,
        userId: c.userId,
        borrowerName: c.userName || "Borrower",
        title: "Investor-loan (DSCR) candidate",
        detail: `Rental income (Schedule E${props}) found on ${c.taxYear} tax return.${via}`,
      };
    });
  } catch (err) {
    console.warn("[Signals] DSCR candidate fetch failed (non-fatal):", err);
    return [];
  }
}

/**
 * Which applications the feed considers — derived from the canonical status
 * vocabulary (shared/schema/lendingCore.ts) so the two can't drift. Beyond
 * the terminal statuses, excluded on purpose:
 *   - "draft" — nothing submitted yet; nothing for staff to act on
 *   - "clear_to_close" / "closing" — closing track: conditions are cleared
 *     and documents locked into the closing package (mirrors
 *     lifecycleEngine's IN_FLIGHT_STATUSES reasoning)
 *   - "suspended" — deliberately paused by staff; signals resume when the
 *     file resumes to a working stage
 * Exported for tests, which pin the exact membership.
 */
export const SIGNAL_ACTIVE_STATUSES: readonly LoanAppStatus[] = LOAN_APP_STATUSES.filter(
  (s) =>
    !(LOAN_APP_TERMINAL_STATUSES as readonly string[]).includes(s) &&
    s !== "draft" &&
    s !== "clear_to_close" &&
    s !== "closing" &&
    s !== "suspended",
);

/**
 * Stall-rescue scope: stages where the file is waiting on a person — the
 * borrower (intake, document collection) or our own underwriter
 * ("under_review", where a file may carry no pre-UW flags and would
 * otherwise surface nowhere while ECOA/Reg B's 30-day action clock runs).
 * "pre_approved" is the borrower shopping — inactivity there is normal —
 * and later stages have their own queues (conditions, docs-ready).
 */
export const STALL_WATCH_STATUSES: readonly LoanAppStatus[] = [
  "submitted",
  "analyzing",
  "under_review",
  "doc_collection",
];

const DOC_FRESHNESS_DAYS = 30;
const DOC_WARNING_DAYS = 25;
const STALL_DAYS = 3;

/**
 * Optional deal-team scope. When supplied (a non-admin staffer's cockpit), the
 * feed is restricted to those applications and the cross-borrower DSCR/investor
 * lead signals are omitted — a loan officer must never see signals for files
 * they are not on the deal team for (IDOR). Omit the scope for the platform-wide
 * feed (admin cockpit, notification cron).
 */
export interface StaffSignalScope {
  applicationIds: string[];
}

export async function buildStaffSignals(limit = 30, scope?: StaffSignalScope): Promise<StaffSignal[]> {
  // A scoped caller with no accessible applications gets an empty feed — never
  // the platform-wide query.
  if (scope && scope.applicationIds.length === 0) return [];

  const statusFilter = inArray(loanApplications.status, [...SIGNAL_ACTIVE_STATUSES]);
  const activeApps = await db
    .select({
      id: loanApplications.id,
      userId: loanApplications.userId,
      status: loanApplications.status,
      updatedAt: loanApplications.updatedAt,
      preUwFlags: loanApplications.preUwFlags,
    })
    .from(loanApplications)
    .where(
      scope
        ? and(statusFilter, inArray(loanApplications.id, scope.applicationIds))
        : statusFilter,
    );

  // DSCR candidates come from tax_insights, not applications — they must
  // surface even when the active-application pipeline is empty, but only in the
  // platform-wide feed: they are cross-borrower incubator leads with no deal
  // team, so a scoped (non-admin) caller never sees them.
  const dscrSignals = scope ? [] : await buildDscrSignals();
  if (activeApps.length === 0) return dscrSignals.slice(0, limit);
  const appIds = activeApps.map((a) => a.id);
  const appById = new Map(activeApps.map((a) => [a.id, a]));

  const [conditionRows, reviewDocRows, docRows, userRows] = await Promise.all([
    db
      .select({
        applicationId: loanConditions.applicationId,
        title: loanConditions.title,
      })
      .from(loanConditions)
      .where(and(inArray(loanConditions.applicationId, appIds), sql`${loanConditions.status} = 'submitted'`)),
    // Documents owed a human verdict: staged "verifying" by extraction, or
    // still "uploaded" with an open human-review requirement from the
    // confidence gate. Status-based first so docs verified/rejected before
    // confidence stamping shipped still drop out.
    db
      .select({
        applicationId: documents.applicationId,
        fileName: documents.fileName,
      })
      .from(documents)
      .where(
        and(
          isNotNull(documents.applicationId),
          inArray(documents.applicationId, appIds),
          or(
            sql`${documents.status} = 'verifying'`,
            and(
              sql`${documents.status} = 'uploaded'`,
              sql`EXISTS (
                SELECT 1 FROM document_confidence_scores dcs
                WHERE dcs.document_id = ${documents.id}
                  AND dcs.human_review_required = true
                  AND dcs.human_review_completed = false
              )`,
            ),
          ),
        ),
      ),
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

  // 2 — documents awaiting a human verify/reject (the A6 workbench queue)
  for (const group of planDocsReadySignals(reviewDocRows)) {
    signals.push({
      type: "docs_ready_for_review",
      priority: 2,
      applicationId: group.applicationId,
      borrowerName: borrower(group.applicationId),
      title: `${group.count} document${group.count === 1 ? "" : "s"} awaiting review`,
      detail: group.fileNames.join("; "),
    });
  }

  // 3 — stalled applications (no update in STALL_DAYS on early stages)
  const stallCutoff = Date.now() - STALL_DAYS * 24 * 3600 * 1000;
  for (const app of activeApps) {
    if (!(STALL_WATCH_STATUSES as readonly string[]).includes(app.status)) continue;
    const updated = app.updatedAt ? new Date(app.updatedAt).getTime() : 0;
    if (updated > 0 && updated < stallCutoff) {
      const days = Math.floor((Date.now() - updated) / (24 * 3600 * 1000));
      const stage = app.status.replace(/_/g, " ");
      signals.push({
        type: "stalled",
        priority: 3,
        applicationId: app.id,
        borrowerName: borrower(app.id),
        title: `No activity for ${days} days`,
        // The ball is in a different court per stage: under_review waits on
        // our underwriter, everything else waits on the borrower.
        detail:
          app.status === "under_review"
            ? `File is sitting in "${stage}" — an underwriting decision is owed.`
            : `File is sitting in "${stage}" — a nudge or a call may unstick it.`,
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

  signals.push(...dscrSignals);

  signals.sort((a, b) => a.priority - b.priority);
  return signals.slice(0, limit);
}
