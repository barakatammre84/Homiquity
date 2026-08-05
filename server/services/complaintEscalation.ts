/**
 * Roadmap CS2, server leg: when a borrower message trips the escalation scan
 * (shared/compliance/complaintEscalation.ts), put it in front of the founder
 * immediately — the playbook's "escalation line" step 2, automated.
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
import type { ComplaintCategory } from "@shared/compliance/complaintEscalation";

const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  discrimination: "possible discrimination complaint",
  credit_reporting_error: "possible credit-reporting error dispute",
};

export interface FlaggedMessageRef {
  messageId: string;
  applicationId: string | null;
  categories: ComplaintCategory[];
}

export async function escalateFlaggedMessage(
  storage: IStorage,
  ref: FlaggedMessageRef,
): Promise<void> {
  const admins = (await storage.getStaffUsersForTeamDisplay()).filter(
    (u) => u.role === "admin",
  );
  if (admins.length === 0) {
    console.warn("[complaints] flagged message but no admin to notify:", ref.messageId);
    return;
  }

  const label = ref.categories.map((c) => CATEGORY_LABELS[c]).join(" and ");
  await Promise.all(
    admins.map((admin) =>
      storage.createNotification({
        userId: admin.id,
        type: "complaint_escalation",
        title: "Compliance escalation: borrower message flagged",
        body:
          `A borrower message matched the ${label} triggers from the escalation playbook. ` +
          `Read the verbatim message in Messages before responding — use only the scripted ` +
          `acknowledgment, and never restate or add to adverse-action reasons.`,
        entityType: "team_message",
        entityId: ref.messageId,
        status: "unread",
      }),
    ),
  );
}
