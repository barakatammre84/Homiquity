/**
 * Wholesale lender catalog — the Target-5 shortlist from the lender-liquidity
 * work. Business development data, not regulatory data: entries move to
 * "approved" only when a signed broker agreement exists, and the submission
 * adapter stays a deterministic simulation until then (architecture rule:
 * no vendor calls outside adapters, simulations until contracts exist).
 */

export type LenderApprovalStatus = "target" | "application_in_progress" | "approved" | "inactive";

export interface WholesaleLender {
  id: string;
  name: string;
  /** Where this lender fits in the product box. */
  specialty: string;
  approvalStatus: LenderApprovalStatus;
  /** Supported AUS engines on their wholesale channel. */
  ausSupport: ("DU" | "LPA")[];
  /**
   * Runs non-QM programs (DSCR / bank-statement). The income analysis package
   * (UAL P6) includes the non-QM path sections only for these lenders.
   */
  nonQm?: boolean;
}

export const WHOLESALE_LENDERS: WholesaleLender[] = [
  { id: "uwm", name: "United Wholesale Mortgage", specialty: "Conventional/FHA/VA volume leader, fast turn times", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
  { id: "rocket-pro-tpo", name: "Rocket Pro TPO", specialty: "Conventional/FHA/VA, strong tech + pricing tools", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
  { id: "plaza", name: "Plaza Home Mortgage", specialty: "Broad product menu incl. renovation + manufactured", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
  { id: "angel-oak", name: "Angel Oak Mortgage Solutions", specialty: "Non-QM / bank statement / investor DSCR", approvalStatus: "target", ausSupport: ["DU"], nonQm: true },
  { id: "newrez", name: "Newrez Wholesale", specialty: "Conventional/government + non-QM overlay programs", approvalStatus: "target", ausSupport: ["DU", "LPA"], nonQm: true },
];

const BY_ID = new Map(WHOLESALE_LENDERS.map(l => [l.id, l]));

export function getWholesaleLender(id: string): WholesaleLender | undefined {
  return BY_ID.get(id);
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
// (server/storage/stats.ts) rather than left implicit in this array.
// ---------------------------------------------------------------------------

export function isApprovedLender(lender: WholesaleLender): boolean {
  return lender.approvalStatus === "approved";
}

export function approvedWholesaleLenders(): WholesaleLender[] {
  return WHOLESALE_LENDERS.filter(isApprovedLender);
}

/** Launch KPI: how many counterparties can we actually deliver a loan to? */
export function approvedLenderCount(): number {
  return approvedWholesaleLenders().length;
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
  lender: WholesaleLender,
  opts: { isProduction: boolean },
): LenderSubmissionEligibility {
  if (isApprovedLender(lender)) {
    return { allowed: true, simulated: false, reason: "Approved wholesale lender", remediation: [] };
  }

  if (opts.isProduction) {
    return {
      allowed: false,
      simulated: true,
      reason:
        `${lender.name} is not an approved wholesale lender (status: ${lender.approvalStatus}). ` +
        `Submitting would transmit a borrower's file to a company with no broker agreement in place.`,
      remediation: [
        `Execute a broker agreement with ${lender.name} and obtain wholesale credentials.`,
        `Set approvalStatus to "approved" for "${lender.id}" in shared/wholesaleLenders.ts.`,
      ],
    };
  }

  return {
    allowed: true,
    simulated: true,
    reason:
      `${lender.name} is not approved (status: ${lender.approvalStatus}) — recording a SIMULATED ` +
      `submission. This path is blocked in production.`,
    remediation: [],
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
