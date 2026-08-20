/**
 * Autopilot live status — the shape streamed to the borrower's real-time banner
 * (Phase 4). Shared so the server (server/services/autopilot/events.ts) and the
 * client (useAutopilotStatus / AutopilotBanner) agree on one contract.
 *
 * This is broker packaging state, never a credit decision; the copy never
 * claims approval (Reg N).
 *
 * WHY THERE ARE FIVE PHASES AND NOT THREE. The banner's headline used to be
 * derived from one number — the count of outstanding conditions — and that
 * number is `0` in three situations that mean entirely different things:
 * the file was reviewed and is clear, nothing has ever been raised on the file,
 * and the conditions read failed. All three rendered as the green
 * "Looks good! No issues found." So a brand-new file, and a file the database
 * could not be asked about, both told the borrower we had looked and found
 * nothing. `no_items_yet` and `unavailable` exist so the snapshot can only
 * assert what it actually knows.
 */

export type AutopilotPhase =
  /** A run is in flight right now (published by the orchestrator). */
  | "reviewing"
  /** Items have been raised on this file and every one of them is resolved. */
  | "clean"
  /** At least one condition is outstanding. */
  | "items_needed"
  /**
   * No condition has ever been recorded on this file. Nothing was found
   * because nothing has been raised yet — which is NOT the same claim as
   * `clean`, and must never be rendered as one.
   */
  | "no_items_yet"
  /**
   * The conditions could not be read, so the outstanding count is unknown.
   * The snapshot asserts nothing about the file in this state.
   */
  | "unavailable";

export interface AutopilotStatus {
  applicationId: string;
  /** The borrower banner state — see AutopilotPhase. */
  phase: AutopilotPhase;
  message: string;
  /**
   * Outstanding conditions. `0` is only meaningful alongside `phase`: in
   * `unavailable` it is a placeholder for "unknown", not a measurement.
   */
  outstandingConditions: number;
  readyToSubmitToLender: boolean;
  /** "Package readiness" meter — ready stages over relevant stages. */
  readiness: { completed: number; total: number };
  updatedAt: string;
}
