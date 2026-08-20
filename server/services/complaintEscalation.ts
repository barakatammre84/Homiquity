/**
 * Roadmap CS2, server leg: when a borrower message trips the escalation scan
 * (shared/compliance/complaintEscalation.ts), put it in front of the founder
 * immediately — the playbook's "escalation line" step 2, automated.
 *
 * TWO SURFACES, one escalation. A borrower can allege discrimination or a
 * credit-reporting error in a message to their loan team (team_messages) OR
 * to the AI assistant (coach_messages). The assistant is the lower-friction
 * channel, so it is if anything the MORE likely place to hear it — scanning
 * only the first surface left the second silent. `surface` selects the entity
 * type and the "where to read it" line; everything else is identical, because
 * the obligation is identical.
 *
 * Deliberate boundaries:
 *  - In-app notification ONLY, to admins (the founder carries the Compliance
 *    Executive hat at this company size — see the playbook). No email leg:
 *    that would be a new outbound-messaging surface (a TEAM_PRACTICES §9
 *    security-review trigger) and would tempt message content into email.
 *  - The notification body carries the matched CATEGORIES, never the
 *    borrower's text. The verbatim record the playbook requires is the
 *    team_messages row itself, referenced by entityId — logged verbatim by
 *    definition, behind login.
 *  - Failures here must NEVER fail or delay the borrower's message: the
 *    route fires and forgets, matching the leadNotifications pattern.
 */
import type { IStorage } from "../storage";
import { isAdmin } from "@shared/roles";
import type { ComplaintCategory } from "@shared/compliance/complaintEscalation";

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  discrimination: "possible discrimination complaint",
  credit_reporting_error: "possible credit-reporting error dispute",
};

/** Which borrower-writable surface the flagged text arrived on. */
export type ComplaintSurface = "team_message" | "coach_message";

const SURFACE_META: Record<ComplaintSurface, { entityType: string; whereToRead: string }> = {
  team_message: {
    entityType: "team_message",
    whereToRead: "Read the verbatim message in Messages before responding",
  },
  coach_message: {
    entityType: "coach_message",
    whereToRead:
      "The borrower wrote this to the AI assistant, not to a person — nobody has replied. " +
      "Read the verbatim message on the borrower's assistant conversation before responding",
  },
};

export interface FlaggedMessageRef {
  messageId: string;
  /** The surface the message was written on — selects entity type and copy. */
  surface: ComplaintSurface;
  /** The borrower who wrote it. Always known; the application may not be. */
  userId: string;
  applicationId: string | null;
  categories: ComplaintCategory[];
}

export async function escalateFlaggedMessage(
  storage: IStorage,
  ref: FlaggedMessageRef,
): Promise<void> {
  const admins = (await storage.getStaffUsersForTeamDisplay()).filter(
    (u) => isAdmin(u),
  );
  if (admins.length === 0) {
    console.warn("[complaints] flagged message but no admin to notify:", ref.messageId);
    return;
  }

  const label = ref.categories.map((c) => CATEGORY_LABELS[c]).join(" and ");
  const meta = SURFACE_META[ref.surface];
  await Promise.all(
    admins.map((admin) =>
      storage.createNotification({
        userId: admin.id,
        type: "complaint_escalation",
        title: "Compliance escalation: borrower message flagged",
        body:
          `A borrower message matched the ${label} triggers from the escalation playbook. ` +
          `${meta.whereToRead} — use only the scripted acknowledgment, and never restate ` +
          `or add to adverse-action reasons.`,
        entityType: meta.entityType,
        entityId: ref.messageId,
        status: "unread",
      }),
    ),
  );
}
