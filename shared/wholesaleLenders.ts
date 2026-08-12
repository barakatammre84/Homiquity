/**
 * Wholesale lender counterparty rules.
 *
 * The lenders themselves — and their products, capabilities and requirements —
 * live in the `wholesale_lenders` table (shared/schema/lendingWholesale.ts),
 * with rate sheets and products hanging off it. This module holds only the
 * RULES that operate on a lender row: may we submit to it, and what does a
 * given submission status transition mean.
 *
 * It used to also hold a hardcoded Target-5 array. That array was a second
 * source of truth: the pricing engine read the table while submission read the
 * array, so the two disagreed about who our lenders were. The array is gone —
 * add or change a lender in the database (admin surface), not here.
 *
 * These functions stay PURE and take a plain row-shaped object, so they remain
 * unit-testable without a database and can be called from either side.
 */

export type LenderApprovalStatus = "target" | "application_in_progress" | "approved" | "inactive";

export const LENDER_APPROVAL_STATUSES: LenderApprovalStatus[] = [
  "target",
  "application_in_progress",
  "approved",
  "inactive",
];

export function isLenderApprovalStatus(value: unknown): value is LenderApprovalStatus {
  return typeof value === "string" && (LENDER_APPROVAL_STATUSES as string[]).includes(value);
}

/**
 * The subset of a `wholesale_lenders` row these rules need. Declared
 * structurally rather than importing the Drizzle row type so `shared/` stays
 * free of schema/driver coupling and the tests can build one inline.
 */
export interface LenderCounterparty {
  /** Business key on the row (`lender_id`), not the uuid primary key. */
  lenderId: string;
  lenderName: string;
  approvalStatus: LenderApprovalStatus;
  /** Seeded sample counterparty — a fictional company, never submittable. */
  isDemo?: boolean | null;
  /** Row liveness. Distinct from approvalStatus; never an agreement. */
  status?: string | null;
  nonQm?: boolean | null;
  /** NULL = no agreement yet, NOT "no clawback". See the column comment. */
  epoClawbackDays?: number | null;
}

// ---------------------------------------------------------------------------
// Counterparty capacity
//
// Revenue capacity is a step function of the number of SIGNED broker
// agreements, and `approvalStatus` is the only record of one. A lender at
// "target" is a business-development wish: sending them a borrower's file
// means transmitting PII to a company that has no relationship with us and no
// obligation to us.
//
// The count of approved lenders is the binding constraint on the business —
// more so than any engineering item — which is why it is surfaced as a metric
// (server/storage/stats.ts), counted off the table.
// ---------------------------------------------------------------------------

export function isApprovedLender(lender: LenderCounterparty): boolean {
  // A demo row is fictional; it can never be an approved counterparty however
  // its columns are set.
  return lender.approvalStatus === "approved" && !lender.isDemo;
}

export function approvedWholesaleLenders<T extends LenderCounterparty>(lenders: T[]): T[] {
  return lenders.filter(isApprovedLender);
}

/** Launch KPI: how many counterparties can we actually deliver a loan to? */
export function approvedLenderCount(lenders: LenderCounterparty[]): number {
  return approvedWholesaleLenders(lenders).length;
}

export interface LenderSubmissionEligibility {
  allowed: boolean;
  /** True when the leg must be recorded as a deterministic simulation. */
  simulated: boolean;
  reason: string;
  remediation: string[];
}

/**
 * May we submit a file to this lender?
 *
 * Approved            → yes, for real.
 * Not approved, prod  → NO. Production must never transmit a borrower file to
 *                       a company we have no agreement with.
 * Not approved, dev   → yes, but strictly as a simulation. The demo and the
 *                       beta walkthrough exercise this path, and the existing
 *                       `simulated` column already says what it is.
 *
 * The authorization lives in the catalog data, not in code: flipping a lender
 * to "approved" when the agreement is signed is what unblocks production.
 */
export function evaluateLenderSubmissionEligibility(
  lender: LenderCounterparty,
  opts: { isProduction: boolean },
): LenderSubmissionEligibility {
  // Demo rows first, and in EVERY environment. These are fictional companies
  // seeded so pricing/best-execution has something to quote; the contact
  // addresses are @*.example. Blocking them only in production would mean a
  // dev/staging run could still address a package to a company that does not
  // exist. This check deliberately precedes the approval check so that no
  // combination of column values can open the path.
  if (lender.isDemo) {
    return {
      allowed: false,
      simulated: true,
      reason:
        `${lender.lenderName} is a seeded demo counterparty, not a real company. ` +
        `Files can never be submitted to it.`,
      remediation: [
        `Pick a real wholesale lender with an executed broker agreement.`,
        `Demo rows exist for pricing and walkthroughs only; set status to INACTIVE ` +
          `on the admin lender screen to retire them at go-live.`,
      ],
    };
  }

  if (isApprovedLender(lender)) {
    return { allowed: true, simulated: false, reason: "Approved wholesale lender", remediation: [] };
  }

  if (opts.isProduction) {
    return {
      allowed: false,
      simulated: true,
      reason:
        `${lender.lenderName} is not an approved wholesale lender (status: ${lender.approvalStatus}). ` +
        `Submitting would transmit a borrower's file to a company with no broker agreement in place.`,
      remediation: [
        `Execute a broker agreement with ${lender.lenderName} and obtain wholesale credentials.`,
        `Set the lender's approval status to "approved" on the admin lender screen.`,
      ],
    };
  }

  return {
    allowed: true,
    simulated: true,
    reason:
      `${lender.lenderName} is not approved (status: ${lender.approvalStatus}) — recording a SIMULATED ` +
      `submission. This path is blocked in production.`,
    remediation: [],
  };
}

export interface LenderLockEligibility {
  allowed: boolean;
  /**
   * True when no real lender is on the hook, whatever confirmation number was
   * keyed in. Persisted to `rate_locks.simulated`, which is what
   * `isLenderConfirmed()` reads (F-20).
   */
  simulated: boolean;
  reason: string;
  remediation: string[];
}

/**
 * May we record a rate lock against this lender?
 *
 * This is deliberately WEAKER than the submission rule, because the risk is
 * different. Submission transmits a borrower's file to a third party, so an
 * unapproved counterparty is refused outright. A lock is an internal record —
 * no PII leaves the system — and the harm is MISREPRESENTATION: telling a
 * borrower their rate is committed when nobody is obliged to honor it.
 *
 * So the rule classifies rather than blocks. Staff may record what they have
 * pre-launch; it is simply not a lock unless a real approved lender made a
 * real commitment. The one refusal is a demo row in production: a fictional
 * company has no business appearing on a production borrower's file at all,
 * and by go-live the demo rows are meant to be retired.
 */
export function evaluateLenderLockEligibility(
  lender: LenderCounterparty,
  opts: { isProduction: boolean },
): LenderLockEligibility {
  if (lender.isDemo) {
    if (opts.isProduction) {
      return {
        allowed: false,
        simulated: true,
        reason:
          `${lender.lenderName} is a seeded demo counterparty, not a real company. ` +
          `A rate lock cannot be recorded against it on a production file.`,
        remediation: [
          `Pick a real wholesale lender with an executed broker agreement.`,
          `Retire the demo rows: set status to INACTIVE on the admin lender screen.`,
        ],
      };
    }
    return {
      allowed: true,
      simulated: true,
      reason:
        `${lender.lenderName} is a seeded demo counterparty — recording an INDICATIVE QUOTE, ` +
        `not a lock. This path is blocked in production.`,
      remediation: [],
    };
  }

  if (isApprovedLender(lender)) {
    return { allowed: true, simulated: false, reason: "Approved wholesale lender", remediation: [] };
  }

  return {
    allowed: true,
    simulated: true,
    reason:
      `${lender.lenderName} is not an approved wholesale lender (status: ${lender.approvalStatus}), ` +
      `so this is an INDICATIVE QUOTE rather than a lender commitment.`,
    remediation: [
      `Execute a broker agreement with ${lender.lenderName} to obtain real lock commitments.`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Submission status machine
// ---------------------------------------------------------------------------

export const LENDER_SUBMISSION_STATUSES = [
  "submitted",
  "acknowledged",
  "in_underwriting",
  "conditions_issued",
  "conditions_cleared",
  "clear_to_close",
  "funded",
  "denied",
  "withdrawn",
  "suspended",
] as const;

export type LenderSubmissionStatus = (typeof LENDER_SUBMISSION_STATUSES)[number];

const TERMINAL: LenderSubmissionStatus[] = ["funded", "denied", "withdrawn"];

/**
 * Forward transitions the staff UI may perform as the lender responds.
 * Any non-terminal status may also move to denied/withdrawn/suspended.
 */
const FORWARD: Record<LenderSubmissionStatus, LenderSubmissionStatus[]> = {
  submitted: ["acknowledged", "in_underwriting"],
  acknowledged: ["in_underwriting"],
  in_underwriting: ["conditions_issued", "clear_to_close"],
  conditions_issued: ["conditions_cleared", "in_underwriting"],
  conditions_cleared: ["clear_to_close", "conditions_issued"],
  clear_to_close: ["funded", "conditions_issued"],
  suspended: ["in_underwriting"],
  funded: [],
  denied: [],
  withdrawn: [],
};

export function isValidSubmissionTransition(
  from: LenderSubmissionStatus,
  to: LenderSubmissionStatus,
): boolean {
  if (from === to) return false;
  if (TERMINAL.includes(from)) return false;
  if (to === "denied" || to === "withdrawn" || to === "suspended") return true;
  return FORWARD[from]?.includes(to) ?? false;
}

/** A terminal submission accepts no further transitions — the machine is done. */
export function isTerminalSubmissionStatus(status: LenderSubmissionStatus): boolean {
  return TERMINAL.includes(status);
}

/**
 * Every status the machine will accept from `from` — the set a staff UI may
 * offer. DERIVED from `isValidSubmissionTransition`, never a second table: the
 * client must not be able to offer a transition the server would reject, and
 * the only way to guarantee that is to ask the same predicate the service asks.
 * Terminal statuses yield [] , which is how a UI knows to offer nothing.
 */
export function nextSubmissionStatuses(
  from: LenderSubmissionStatus,
): LenderSubmissionStatus[] {
  return LENDER_SUBMISSION_STATUSES.filter(to => isValidSubmissionTransition(from, to));
}
