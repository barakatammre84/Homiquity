// ---------------------------------------------------------------------------
// TRID application trigger — Reg Z §1026.2(a)(3) / §1026.19(e)(1)(iii).
//
// A regulatory "application" exists the moment the creditor has all six
// pieces of information: (1) borrower name, (2) income, (3) SSN,
// (4) property address, (5) estimated property value, (6) loan amount.
// From that moment the Loan Estimate must be delivered or placed in the
// mail within 3 business days.
//
// This module is the ONLY writer of loanApplications.tridTriggeredAt.
// Every route that can supply one of the six items calls
// evaluateTridTrigger() after persisting; the check is idempotent and
// cheap when already triggered. Status/stage advancement routes call
// tridHardStopError() and must refuse to move a file forward while a
// required Loan Estimate is outstanding past its due date.
// ---------------------------------------------------------------------------

import { storage } from "../storage";
import { addBusinessDays } from "./businessDays";
import { LOAN_APP_TERMINAL_STATUSES, type LoanApplication, type UrlaPersonalInfo, type UrlaPropertyInfo } from "@shared/schema";

/**
 * Transitions the LE hard stop must not block: every way an application ends
 * without consummation (denied / withdrawn / expired) plus "suspended" (a
 * pause, not an advance). "funded" is deliberately NOT an exit — it is
 * consummation, the one terminal the overdue-LE stop must still gate.
 * Derived from the canonical vocabulary; the old hand list carried the
 * phantom "closed" and omitted "expired", which blocked staff from marking
 * an LE-overdue pre-approval expired through the status routes.
 */
const TRID_EXIT_STATUSES: ReadonlySet<string> = new Set([
  ...LOAN_APP_TERMINAL_STATUSES.filter((s) => s !== "funded"),
  "suspended",
]);

export interface SixPiecesAssessment {
  complete: boolean;
  missing: string[];
}

function positiveNumber(value: unknown): boolean {
  const n = parseFloat(String(value ?? ""));
  return !isNaN(n) && n > 0;
}

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Checks whether all six pieces of §1026.2(a)(3) information are on file.
 *
 * Name is treated as satisfied once the application exists — the account
 * holder supplies their name at signup, and under-counting here would start
 * the LE clock late (a violation), while over-counting merely starts it
 * early (conservative).
 */
export function assessSixPieces(
  application: LoanApplication,
  personalInfo: UrlaPersonalInfo | undefined,
  propertyInfo?: UrlaPropertyInfo | undefined,
): SixPiecesAssessment {
  const missing: string[] = [];

  const hasIncome =
    positiveNumber(application.annualIncome) ||
    (Array.isArray(application.incomeSources) && (application.incomeSources as unknown[]).length > 0);
  if (!hasIncome) missing.push("income");

  if (!nonEmpty(personalInfo?.ssn)) missing.push("ssn");

  // An address supplied ANYWHERE counts — the URLA property record is a valid
  // source even before it mirrors onto the application row. Under-counting
  // starts the LE clock late (a violation); over-counting is conservative.
  const hasAddress =
    nonEmpty(application.propertyAddress) || nonEmpty(propertyInfo?.propertyStreet);
  if (!hasAddress) missing.push("property_address");

  const hasEstimatedValue =
    positiveNumber(application.propertyValue) ||
    positiveNumber(application.purchasePrice) ||
    positiveNumber(propertyInfo?.propertyValue);
  if (!hasEstimatedValue) missing.push("estimated_property_value");

  const purchasePrice = parseFloat(String(application.purchasePrice ?? ""));
  const downPayment = parseFloat(String(application.downPayment ?? ""));
  const hasLoanAmount =
    positiveNumber(application.preApprovalAmount) ||
    (!isNaN(purchasePrice) && !isNaN(downPayment) && purchasePrice - downPayment > 0);
  if (!hasLoanAmount) missing.push("loan_amount");

  return { complete: missing.length === 0, missing };
}

export interface TridStatus {
  triggered: boolean;
  tridTriggeredAt: Date | null;
  leDueDate: Date | null;
  leIssued: boolean;
  leOverdue: boolean;
}

export function getTridStatus(application: LoanApplication, now: Date = new Date()): TridStatus {
  const triggeredAt = application.tridTriggeredAt ? new Date(application.tridTriggeredAt) : null;
  if (!triggeredAt) {
    return { triggered: false, tridTriggeredAt: null, leDueDate: null, leIssued: false, leOverdue: false };
  }
  const leDueDate = addBusinessDays(triggeredAt, 3);
  const leIssued = nonEmpty(application.leIssuedDate);
  // Overdue once the due date's calendar day has fully elapsed without issuance.
  const endOfDueDay = new Date(leDueDate);
  endOfDueDay.setUTCHours(23, 59, 59, 999);
  return {
    triggered: true,
    tridTriggeredAt: triggeredAt,
    leDueDate,
    leIssued,
    leOverdue: !leIssued && now.getTime() > endOfDueDay.getTime(),
  };
}

/**
 * Returns a blocking error message when the file may not advance because a
 * required Loan Estimate is overdue, or null when advancement is allowed.
 * Terminal/exit dispositions (denied, withdrawn, suspended) are never
 * blocked — a borrower can always exit the pipeline.
 */
export function tridHardStopError(
  application: LoanApplication,
  targetStatus: string,
  now: Date = new Date(),
): string | null {
  if (TRID_EXIT_STATUSES.has(targetStatus)) return null;

  const status = getTridStatus(application, now);
  if (!status.leOverdue) return null;

  const due = status.leDueDate!.toISOString().split("T")[0];
  return (
    `TRID hard stop: all six pieces of application information were received ` +
    `${status.tridTriggeredAt!.toISOString().split("T")[0]} and the Loan Estimate was due ` +
    `${due} (Reg Z §1026.19(e)(1)(iii)). Issue the Loan Estimate before advancing this file.`
  );
}

export interface TridTriggerResult {
  triggered: boolean;
  justTriggered: boolean;
  tridTriggeredAt: Date | null;
  leDueDate: Date | null;
  missing: string[];
}

/**
 * Idempotent six-pieces check. Call after any write that can complete one of
 * the six items. Sets tridTriggeredAt exactly once, records a compliance
 * activity on the file, and notifies the assigned loan officer of the LE
 * due date.
 */
export async function evaluateTridTrigger(applicationId: string): Promise<TridTriggerResult> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    return { triggered: false, justTriggered: false, tridTriggeredAt: null, leDueDate: null, missing: ["application_not_found"] };
  }

  if (application.tridTriggeredAt) {
    const triggeredAt = new Date(application.tridTriggeredAt);
    return {
      triggered: true,
      justTriggered: false,
      tridTriggeredAt: triggeredAt,
      leDueDate: addBusinessDays(triggeredAt, 3),
      missing: [],
    };
  }

  const [personalInfo, propertyInfo] = await Promise.all([
    storage.getUrlaPersonalInfo(applicationId),
    storage.getUrlaPropertyInfo(applicationId),
  ]);
  const assessment = assessSixPieces(application, personalInfo, propertyInfo);
  if (!assessment.complete) {
    return { triggered: false, justTriggered: false, tridTriggeredAt: null, leDueDate: null, missing: assessment.missing };
  }

  const now = new Date();
  const leDueDate = addBusinessDays(now, 3);
  await storage.updateLoanApplication(applicationId, { tridTriggeredAt: now });

  const dueLabel = leDueDate.toISOString().split("T")[0];
  await storage.createDealActivity({
    applicationId,
    activityType: "compliance_event",
    title: "TRID application triggered — Loan Estimate clock started",
    description:
      `All six pieces of application information (Reg Z §1026.2(a)(3)) are on file. ` +
      `The Loan Estimate must be delivered or placed in the mail by ${dueLabel} ` +
      `(3 business days, §1026.19(e)(1)(iii)).`,
  });

  if (application.loanOfficerId) {
    await storage.createNotification({
      userId: application.loanOfficerId,
      type: "compliance_deadline",
      title: "Loan Estimate due — TRID clock started",
      body: `Application ${applicationId.substring(0, 8).toUpperCase()} became a TRID application. The Loan Estimate is due by ${dueLabel}.`,
      entityType: "loan_application",
      entityId: applicationId,
      status: "unread",
    });
  }

  return { triggered: true, justTriggered: true, tridTriggeredAt: now, leDueDate, missing: [] };
}
