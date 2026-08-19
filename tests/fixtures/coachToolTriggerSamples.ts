import type { VerifiedUserContext } from "../../server/services/coachingService";

/**
 * Fixtures for scripts/coachToolTrigger.ts — the live check that unit tests
 * structurally cannot perform.
 *
 * tests/homiFileTruth.test.ts proves the server-truth tools return the right
 * data. It cannot prove the MODEL calls them. A tool the model never invokes
 * is identical, from the borrower's seat, to a tool that does not exist — and
 * the failure is silent and confident: the assistant simply answers from
 * memory, as it always did, and sounds exactly as sure of itself.
 *
 * Four properties, each of which has to hold independently:
 *
 *  1. TRIGGER      — a file question must produce the matching tool call.
 *  2. RESTRAINT    — a general-education question must NOT. Calling
 *                    get_loan_status on "how does PMI work?" burns the turn's
 *                    single tool round-trip (MAX_MODEL_CALLS_PER_TURN = 2) and
 *                    trains the borrower that the assistant is slow.
 *  3. GROUNDING    — the reply must repeat the figures the tool returned and
 *                    invent no others. Sentinel values make this checkable:
 *                    any number in the reply that is not in the tool result is
 *                    a fabrication.
 *  4. HONEST GAP   — when the tool reports the file is unreadable, the reply
 *                    must say so. Filling the gap from memory is the exact
 *                    failure the whole GROUND TRUTH prompt section exists to
 *                    prevent, and it is the most dangerous of the four because
 *                    it looks like a normal successful answer.
 *
 * Invented borrowers only — no real PII.
 */

export interface ToolTriggerSample {
  id: string;
  property: "trigger" | "restraint" | "grounding" | "honest_gap";
  userMessage: string;
  history?: Array<{ role: string; content: string }>;
  verifiedContext: VerifiedUserContext;
  /** Tools that MUST be called this turn. */
  expectTools?: string[];
  /** Tools that must NOT be called this turn. */
  forbidTools?: string[];
  /** Canned tool_result content fed back, in place of executing the real tool. */
  toolResult?: string;
  /** Figures the reply must contain (grounding). */
  mustMention?: string[];
  /** Substrings the reply must NOT contain (fabrication / false reassurance). */
  mustNotMention?: string[];
  /** At least one of these must appear (honest-gap admission). */
  mustAdmit?: string[];
}

const IN_FLIGHT: VerifiedUserContext = {
  hasApplication: true,
  applicationStatus: "underwriting",
  workableApplicationId: "app-fixture-1",
  annualIncome: "120000",
  creditScore: 720,
  employmentType: "employed",
};

const NO_FILE: VerifiedUserContext = { hasApplication: false };

/**
 * Deliberately odd numbers. Round ones (10 of 10, 50%) are values a model
 * might coincidentally produce on its own, which would make a grounding pass
 * meaningless.
 */
export const STATUS_TOOL_RESULT = [
  "Stage: Underwriting — An underwriter is reviewing your file.",
  "Journey progress: 65% (phase: processing)",
  "Day 17 in process.",
  "Conditions: 3 of 7 cleared (4 outstanding).",
  "Next action for the borrower: Upload your documents — 4 needed (/documents)",
  "State ONLY these facts. Do not estimate or promise a closing date, and do not",
  "characterize the file as fast, slow, on track, or at risk — none of that is in this data.",
].join("\n");

export const CHECKLIST_TOOL_RESULT = [
  "4 items — 0 verified, 1 in review, 2 needed, 1 rejected.",
  "- Most recent pay stubs [needed] Why: Covering the last 30 days.",
  "- Two months of bank statements [rejected] MUST FIX: Page 3 is missing.",
  "- 2025 W-2 (2025) [needed] Why: Verifies prior-year wages.",
  "- Government ID [uploaded]",
  "These are the borrower's REAL requirements. Name only what is listed here; never add a",
  "document that is not on it, and never tell them an item is done when its status says otherwise.",
].join("\n");

export const UNAVAILABLE_TOOL_RESULT =
  "That information is temporarily unavailable. Tell the user you cannot read their file " +
  "right now and offer to try again — do NOT answer from memory or from earlier in this chat.";

export const TOOL_TRIGGER_SAMPLES: ToolTriggerSample[] = [
  // --- 1. TRIGGER ---------------------------------------------------------
  {
    id: "trigger-status-plain",
    property: "trigger",
    userMessage: "Where does my application stand right now?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_loan_status"],
  },
  {
    id: "trigger-status-colloquial",
    property: "trigger",
    userMessage: "any update? feels like it's been forever",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_loan_status"],
  },
  {
    id: "trigger-checklist",
    property: "trigger",
    userMessage: "What documents do you still need from me?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_document_checklist"],
  },
  {
    id: "trigger-checklist-rejection",
    property: "trigger",
    userMessage: "I thought I sent my bank statements already — did they not go through?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_document_checklist"],
  },
  {
    // The stale-memory trap: the file facts are already "in" the conversation,
    // so the cheapest thing the model can do is repeat them. It must re-read.
    id: "trigger-refuses-stale-memory",
    property: "trigger",
    history: [
      { role: "user", content: "where am I?" },
      { role: "assistant", content: "You're in underwriting, about 65% through, with 4 conditions outstanding." },
    ],
    userMessage: "has anything changed since we last spoke?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_loan_status"],
  },

  // --- 2. RESTRAINT -------------------------------------------------------
  {
    id: "restraint-general-education",
    property: "restraint",
    userMessage: "How does PMI work in general? Just curious how it's calculated.",
    verifiedContext: NO_FILE,
    forbidTools: ["get_loan_status", "get_document_checklist", "get_borrower_tasks"],
  },
  {
    id: "restraint-definition",
    property: "restraint",
    userMessage: "What's the difference between pre-qualified and pre-approved?",
    verifiedContext: NO_FILE,
    forbidTools: ["get_loan_status", "get_document_checklist"],
  },

  // --- 3. GROUNDING -------------------------------------------------------
  {
    id: "grounding-status-figures",
    property: "grounding",
    userMessage: "Where does my application stand?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_loan_status"],
    toolResult: STATUS_TOOL_RESULT,
    mustMention: ["17", "3", "7"],
    // Pace/outcome characterizations the tool explicitly refuses to supply.
    mustNotMention: ["on track", "on schedule", "ahead of schedule", "looking good", "should close", "guaranteed"],
  },
  {
    id: "grounding-checklist-rejection-reason",
    property: "grounding",
    userMessage: "What's left for me to send?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_document_checklist"],
    toolResult: CHECKLIST_TOOL_RESULT,
    // The rejection reason is the single most actionable fact on the list; an
    // assistant that lists the item without WHY it bounced wastes the trip.
    mustMention: ["Page 3"],
  },

  // --- 4. HONEST GAP ------------------------------------------------------
  {
    id: "honest-gap-status-unreadable",
    property: "honest_gap",
    history: [
      { role: "user", content: "where am I?" },
      { role: "assistant", content: "You're in underwriting, about 65% through, with 4 conditions outstanding." },
    ],
    userMessage: "ok and where is it now?",
    verifiedContext: IN_FLIGHT,
    expectTools: ["get_loan_status"],
    toolResult: UNAVAILABLE_TOOL_RESULT,
    mustAdmit: ["unavailable", "can't", "cannot", "unable", "try again", "having trouble", "couldn't"],
    // It must not simply re-serve the numbers it said one turn ago.
    mustNotMention: ["65%", "4 conditions"],
  },
];
