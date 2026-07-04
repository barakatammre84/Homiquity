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
}

export const WHOLESALE_LENDERS: WholesaleLender[] = [
  { id: "uwm", name: "United Wholesale Mortgage", specialty: "Conventional/FHA/VA volume leader, fast turn times", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
  { id: "rocket-pro-tpo", name: "Rocket Pro TPO", specialty: "Conventional/FHA/VA, strong tech + pricing tools", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
  { id: "plaza", name: "Plaza Home Mortgage", specialty: "Broad product menu incl. renovation + manufactured", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
  { id: "angel-oak", name: "Angel Oak Mortgage Solutions", specialty: "Non-QM / bank statement / investor DSCR", approvalStatus: "target", ausSupport: ["DU"] },
  { id: "newrez", name: "Newrez Wholesale", specialty: "Conventional/government + non-QM overlay programs", approvalStatus: "target", ausSupport: ["DU", "LPA"] },
];

const BY_ID = new Map(WHOLESALE_LENDERS.map(l => [l.id, l]));

export function getWholesaleLender(id: string): WholesaleLender | undefined {
  return BY_ID.get(id);
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
