/**
 * A borrower asked for a 1:1 with a loan officer — put it in front of one.
 *
 * The gap this closes: `POST /api/accelerator/coaching` wrote a row and told
 * the borrower "Coaching session has been scheduled." `getCoachingSessions` had
 * exactly ONE reader in the whole codebase — the borrower's own page. No staff
 * surface, no notification, no task. The borrower held an appointment nobody at
 * Homiquity knew existed.
 *
 * The task engine cannot carry this: `tasks.applicationId` is NOT NULL with an
 * FK to loan_applications (shared/schema/underwritingTasks.ts:214), and the
 * borrowers this program is for are aspiring owners with no application at all.
 * The intake inbox cannot carry it either — `getUnassignedApplications()` also
 * starts from loan_applications. So the routing is a role fan-out, and the
 * durable destination is the request queue in the LO Command Center.
 *
 * Deliberate boundaries, following complaintEscalation.ts rather than
 * leadNotifications.ts:
 *  - IN-APP notification only. NO email leg — that is a new outbound-messaging
 *    surface and a TEAM_PRACTICES §9 security-review trigger. The borrower is
 *    told in the UI that we will confirm; nothing is sent to them.
 *  - The notification names where to act, because `entityType` values outside
 *    NotificationsPanel's href map land on /dashboard. Until that mapping
 *    exists, the body has to carry the destination in words.
 *  - Failure here must NEVER fail the borrower's request: the route fires and
 *    forgets, matching leadNotifications and complaintEscalation.
 */
import type { IStorage } from "../storage";

/** Who staffs these. Same desk that takes new leads. */
const SESSION_DESK_ROLES = new Set(["admin", "lo", "loa"]);

export interface SessionRequestRef {
  sessionId: string;
  /** The borrower who asked. Always known — a session hangs off their enrollment. */
  borrowerName: string;
  requestedFor: Date;
  topic: string | null;
}

/**
 * Fan a pending session request out to the session desk. Never throws — the
 * caller awaits nothing and a notification failure must not cost the borrower
 * their request.
 */
export async function notifySessionRequested(
  storage: IStorage,
  request: SessionRequestRef,
): Promise<void> {
  try {
    const staff = (await storage.getStaffUsersForTeamDisplay()).filter((u) =>
      SESSION_DESK_ROLES.has(u.role),
    );
    if (staff.length === 0) {
      // Loud on purpose: a request nobody can be told about is the defect this
      // module exists to end, and silence here would recreate it exactly.
      console.warn(
        "[accelerator] session requested but no lo/loa/admin to notify:",
        request.sessionId,
      );
      return;
    }

    const when = request.requestedFor.toISOString();
    const about = request.topic ? ` about "${request.topic}"` : "";

    await Promise.all(
      staff.map((user) =>
        storage.createNotification({
          userId: user.id,
          type: "accelerator_session_requested",
          title: `${request.borrowerName} asked for a 1:1`,
          body:
            `Requested ${when}${about}. Nothing is booked until a loan officer confirms it — ` +
            `open the LO Command Center to confirm or decline.`,
          entityType: "accelerator_session",
          entityId: request.sessionId,
          status: "unread",
        }),
      ),
    );
  } catch (error) {
    console.error("[accelerator] failed to notify the session desk:", error);
  }
}

/**
 * Tell the BORROWER what happened to their request.
 *
 * The first cut of this fanned out in one direction only — staff learned a
 * request existed, and the borrower learned the outcome by happening to revisit
 * the page. A loan officer accepting or declining a meeting is exactly the kind
 * of thing the person waiting on it should be told.
 *
 * In-app only, same rule as above: no email, no SMS.
 */
export interface SessionOutcomeRef {
  sessionId: string;
  borrowerUserId: string;
  scheduledAt: Date;
  /** The loan officer's display name, when one is on the record. */
  loanOfficerName: string | null;
}

type BorrowerFacingOutcome = "confirmed" | "cancelled" | "completed" | "no_show";

export async function notifyBorrowerOfSessionOutcome(
  storage: IStorage,
  outcome: BorrowerFacingOutcome,
  ref: SessionOutcomeRef,
): Promise<void> {
  try {
    const who = ref.loanOfficerName ?? "A loan officer";
    const when = ref.scheduledAt.toISOString();

    // No "we'll be in touch" on a cancellation: that is a promise about a
    // follow-up nothing in this codebase schedules. The borrower is told what
    // is true and where to act.
    const copy: Record<BorrowerFacingOutcome, { title: string; body: string }> = {
      confirmed: {
        title: "Your 1:1 is confirmed",
        body: `${who} confirmed your session for ${when}.`,
      },
      cancelled: {
        title: "Your 1:1 was cancelled",
        body: `The session for ${when} is not going ahead. You can ask for another time in the Accelerator.`,
      },
      completed: {
        title: "Your 1:1 is marked complete",
        body: `${who} marked your ${when} session as done. Ask for another whenever you want one.`,
      },
      no_show: {
        title: "We missed you",
        body: `Your ${when} session was marked as missed. You can ask for a new time in the Accelerator.`,
      },
    };

    await storage.createNotification({
      userId: ref.borrowerUserId,
      type: `accelerator_session_${outcome}`,
      title: copy[outcome].title,
      body: copy[outcome].body,
      entityType: "accelerator_session",
      entityId: ref.sessionId,
      status: "unread",
    });
  } catch (error) {
    console.error("[accelerator] failed to notify the borrower:", error);
  }
}

/**
 * Tell the assigned loan officer that the borrower moved or dropped the meeting
 * they had agreed to. Nothing when no loan officer has taken it — there is
 * nobody with an expectation to correct.
 */
export async function notifyLoanOfficerOfBorrowerChange(
  storage: IStorage,
  change: "cancelled" | "rescheduled",
  ref: { sessionId: string; assignedToUserId: string | null; borrowerName: string; scheduledAt: Date },
): Promise<void> {
  if (!ref.assignedToUserId) return;
  try {
    await storage.createNotification({
      userId: ref.assignedToUserId,
      type: `accelerator_session_${change}_by_borrower`,
      title:
        change === "cancelled"
          ? `${ref.borrowerName} cancelled your 1:1`
          : `${ref.borrowerName} asked to move your 1:1`,
      body:
        change === "cancelled"
          ? `The session is off. Nothing to do unless you want to reach out.`
          : `They asked for ${ref.scheduledAt.toISOString()} instead. It is back in the requests queue for you to confirm.`,
      entityType: "accelerator_session",
      entityId: ref.sessionId,
      status: "unread",
    });
  } catch (error) {
    console.error("[accelerator] failed to notify the loan officer:", error);
  }
}
