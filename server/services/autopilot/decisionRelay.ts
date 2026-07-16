import { storage } from "../../storage";
import { isAutopilotEnabled, canRelayDecisions } from "./config";
import type { LoanApplication } from "@shared/schema";

/**
 * Autopilot decision relay — routes a wholesale lender's decision to the right
 * audience, the compliant way. Homiquity is a broker: it relays the lender's
 * decision; it makes none.
 *
 *   clear_to_close → tell the BORROWER they're approved. Reg N (12 CFR 1014)
 *                    bars "approved" before a real approval — clear-to-close is
 *                    that moment. No wholesale-lender identity is disclosed
 *                    (borrower-transparency doctrine).
 *   funded         → tell the BORROWER their loan funded.
 *   denied         → do NOT tell the borrower "denied", and do NOT auto-generate
 *                    the notice. Flag the DEAL TEAM that an ECOA §1002.9
 *                    adverse-action notice is required within 30 days, pointing
 *                    to the regulated staff flow. FCRA reasons + disclosures are
 *                    a staff/lender determination, never the agent's.
 *
 * Everything else (acknowledged, in_underwriting, conditions_*) → no relay.
 */

export type RelayAudience = "borrower" | "staff";

export interface RelayMessage {
  type: string;
  title: string;
  body: string;
}

export interface DecisionRelayPlan {
  event: "clear_to_close" | "funded" | "denied";
  /** Who hears about it. Denials go to staff — never a borrower "denied" ping. */
  audience: RelayAudience;
  message: RelayMessage;
  activityTitle: string;
  activityDescription: string;
}

/**
 * Pure mapping from a lender-submission status to the relay plan (or null when
 * the transition isn't a borrower-relevant decision). No DB, no side effects —
 * unit-tested for the Reg N / adverse-action invariants.
 */
export function planDecisionRelay(toStatus: string): DecisionRelayPlan | null {
  switch (toStatus) {
    case "clear_to_close":
      return {
        event: "clear_to_close",
        audience: "borrower",
        message: {
          type: "loan_approved",
          title: "Great news — your loan is approved!",
          // Reg N-safe: approval is now real. No lender identity disclosed.
          body: "Your loan has been approved and is clear to close. Your loan team will reach out with the closing details and next steps.",
        },
        activityTitle: "Autopilot relayed the lender approval to the borrower",
        activityDescription:
          "Lender submission reached clear-to-close. The borrower was notified of approval (Reg N: approval is now confirmed; no wholesale-lender identity disclosed).",
      };
    case "funded":
      return {
        event: "funded",
        audience: "borrower",
        message: {
          type: "loan_funded",
          title: "Your loan has funded — congratulations!",
          body: "Your mortgage has funded. Welcome home! Your loan team will follow up with any remaining next steps.",
        },
        activityTitle: "Autopilot relayed the funding confirmation to the borrower",
        activityDescription: "Lender submission reached funded. The borrower was notified.",
      };
    case "denied":
      return {
        event: "denied",
        audience: "staff",
        message: {
          type: "adverse_action_required",
          title: "Action required: adverse-action notice (ECOA §1002.9)",
          body: "A lender returned a denial on this file. An adverse-action notice must be prepared and delivered to the borrower within 30 days. Use the credit adverse-action flow to generate and deliver it.",
        },
        activityTitle: "Autopilot flagged: adverse-action notice required",
        activityDescription:
          "Lender submission moved to denied. Staff must prepare and deliver the ECOA §1002.9 adverse-action notice within 30 days (credit adverse-action flow → letter PDF → deliver). Autopilot does not auto-generate the notice or notify the borrower of the denial — FCRA reasons and disclosures require staff/lender input.",
      };
    default:
      return null;
  }
}

export interface DecisionRelayParams {
  application: LoanApplication;
  toStatus: string;
  performedBy: string;
}

/**
 * Execute the relay for a lender-submission transition. Gated by the Autopilot
 * kill switch; never throws (a relay failure must not fail the status update).
 */
export async function relayLenderDecision(params: DecisionRelayParams): Promise<void> {
  const { application, toStatus, performedBy } = params;
  try {
    const plan = planDecisionRelay(toStatus);
    if (!plan) return;
    // Gated by the master kill switch AND its own capability toggle — the relay
    // stays dark until an operator explicitly turns it on (Reg N / ECOA).
    if (!(await isAutopilotEnabled(application.loanOfficerId))) return;
    if (!(await canRelayDecisions())) return;

    // Borrower relays go to the borrower; denial relays go to the deal team
    // (the loan officer) — never a "denied" ping to the borrower.
    const recipientId = plan.audience === "borrower" ? application.userId : application.loanOfficerId;
    if (recipientId) {
      await storage.createNotification({
        userId: recipientId,
        type: plan.message.type,
        title: plan.message.title,
        body: plan.message.body,
        entityType: "loan_application",
        entityId: application.id,
        metadata: { source: "autopilot_decision_relay", event: plan.event },
      });
    }

    await storage.createDealActivity({
      applicationId: application.id,
      activityType: "autopilot_review",
      title: plan.activityTitle,
      description: plan.activityDescription,
      performedBy,
    });
  } catch (err) {
    console.error(`[Autopilot] Decision relay failed for ${application.id} (non-fatal):`, err);
  }
}
