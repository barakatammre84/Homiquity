/**
 * Autopilot live status — the shape streamed to the borrower's real-time banner
 * (Phase 4). Shared so the server (server/services/autopilot/events.ts) and the
 * client (useAutopilotStatus / AutopilotBanner) agree on one contract.
 *
 * This is broker packaging state, never a credit decision; the copy never
 * claims approval (Reg N).
 */

export type AutopilotPhase = "reviewing" | "clean" | "items_needed";

export interface AutopilotStatus {
  applicationId: string;
  /** The three borrower banner states. */
  phase: AutopilotPhase;
  message: string;
  outstandingConditions: number;
  readyToSubmitToLender: boolean;
  /** "Package readiness" meter — ready stages over relevant stages. */
  readiness: { completed: number; total: number };
  updatedAt: string;
}
