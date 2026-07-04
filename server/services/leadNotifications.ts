/**
 * Speed-to-lead (roadmap G-A): the moment a lead lands, the sales desk knows
 * and the borrower hears back. Time-to-first-touch is the #1 conversion lever
 * — a lead that sits silently in the database is a lost borrower and a wasted
 * TrustedForm consent.
 *
 * Compliance rails on the acknowledgment email:
 *  - No rate, payment, APR, or cost figures (Reg Z §1026.24 trigger terms).
 *  - No approval/eligibility implication (Reg B / Reg N — this acknowledges an
 *    inquiry, it is not a credit decision).
 *  - Email only. Any future SMS follow-up must pass evaluateOutboundSms
 *    (quiet hours + STOP ledger) — do not add an SMS leg here casually.
 *
 * Failures here must NEVER fail the intake: the route fires and forgets.
 */
import type { IStorage } from "../storage";
import type { Lead } from "@shared/schema";
import { sendEmail, emailTemplates } from "./emailService";

/** The sales desk: same roles the /api/leads staff list endpoint admits. */
const LEAD_DESK_ROLES = new Set(["admin", "lo", "loa"]);

const PURPOSE_LABELS: Record<string, string> = {
  purchase: "purchase",
  refinance: "refinance",
  cash_out_refinance: "cash-out refinance",
  heloc: "HELOC",
};

export async function notifyNewLead(storage: IStorage, lead: Lead): Promise<void> {
  const results = await Promise.allSettled([
    notifyLeadDesk(storage, lead),
    acknowledgeBorrower(lead),
  ]);
  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[leads] speed-to-lead notification leg failed:", r.reason);
    }
  }
}

/** In-app notification to every lead-desk staff member: first touch wins. */
async function notifyLeadDesk(storage: IStorage, lead: Lead): Promise<void> {
  const staff = (await storage.getStaffUsersForTeamDisplay()).filter((u) =>
    LEAD_DESK_ROLES.has(u.role),
  );
  if (staff.length === 0) {
    console.warn("[leads] new lead but no lead-desk staff to notify:", lead.id);
    return;
  }

  const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "A borrower";
  const purpose = lead.loanPurpose ? PURPOSE_LABELS[lead.loanPurpose] ?? lead.loanPurpose : "inquiry";
  const where = lead.propertyState ? ` in ${lead.propertyState}` : "";
  const contact = lead.email || lead.phone || "no contact on file";

  await Promise.all(
    staff.map((user) =>
      storage.createNotification({
        userId: user.id,
        type: "lead_received",
        title: `New lead from ${lead.source}`,
        body: `${name} — ${purpose}${where}. Reach out now: ${contact}`,
        entityType: "lead",
        entityId: lead.id,
        status: "unread",
      }),
    ),
  );
}

/** Acknowledgment email to the borrower — sets the response expectation. */
async function acknowledgeBorrower(lead: Lead): Promise<void> {
  if (!lead.email) return;
  const template = emailTemplates.leadReceived(lead.firstName);
  await sendEmail({ ...template, to: lead.email });
}
