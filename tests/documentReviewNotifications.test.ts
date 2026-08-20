import { afterEach, describe, expect, it, vi } from "vitest";

import { emailTemplates, sendNotificationEmail } from "../server/services/emailService";

afterEach(() => {
  vi.restoreAllMocks();
});

/** Strip markup + inline-style values so bans hit copy, not CSS. */
function visibleText(subject: string, html: string): string {
  return `${subject} ${html}`
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/#[0-9a-f]{3,8}\b/g, " ")
    .replace(/\d+px|\d+%/g, " ");
}

describe("document review emails stay inside the compliance rails", () => {
  // Reg N / Reg B: accepting a DOCUMENT must never read as a loan approval or
  // eligibility signal. Reg Z §1026.24: no rate/payment/cost trigger terms.
  // And no timeline promises we can't keep. Full words ("approved"), not the
  // "approv" substring — the baseTemplate footer carries the brand tagline
  // "Clear Answers. Confident Approvals." on every email (the lead-ack test
  // draws the same line).
  const BANNED = [
    "approved",
    "pre-approved",
    "approval decision",
    "guarantee",
    "qualif",
    "eligib",
    " apr",
    "rate",
    "payment",
    "$",
    "within",
    "business day",
    "instant",
  ];

  it("documentAccepted carries no approval/trigger/timeline language", () => {
    const { subject, html } = emailTemplates.documentAccepted("Ava", "bank statement");
    const text = visibleText(subject, html);
    for (const banned of BANNED) {
      expect(text, `banned term "${banned}" in documentAccepted`).not.toContain(banned);
    }
  });

  it("documentAccepted says a document review is not a loan decision", () => {
    const { html } = emailTemplates.documentAccepted("Ava", "bank statement");
    expect(html).toContain("not a loan decision");
  });

  it("documentActionNeeded carries no approval/trigger/timeline language and routes to login", () => {
    const { subject, html } = emailTemplates.documentActionNeeded("Ava", "bank statement");
    const text = visibleText(subject, html);
    for (const banned of BANNED) {
      expect(text, `banned term "${banned}" in documentActionNeeded`).not.toContain(banned);
    }
    expect(html).toContain("Documents");
  });
});

describe("the rejection reason never travels over email", () => {
  // The reason is staff-typed free text (may contain borrower PII) — it is
  // shown in-app behind login only. Even if a caller passes it in `data`,
  // the sendNotificationEmail wiring must not hand it to the template.
  // (Spying on emailTemplates works because the internal call site and the
  // export reference the same object — unlike sendEmail, which is a
  // same-module binding a mock cannot intercept.)
  it("document_rejected wiring passes only name + document label, never the reason", () => {
    const spy = vi.spyOn(emailTemplates, "documentActionNeeded");
    sendNotificationEmail({
      type: "document_rejected",
      recipientEmail: "ava@example.com",
      data: {
        borrowerName: "Ava",
        documentName: "bank statement",
        reason: "REASON_SENTINEL_NEVER_IN_EMAIL",
      },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Ava", "bank statement");
    const rendered = spy.mock.results[0].value as { subject: string; html: string };
    expect(`${rendered.subject} ${rendered.html}`).not.toContain("REASON_SENTINEL_NEVER_IN_EMAIL");
  });

  it("document_verified routes to the accepted template with the document label", () => {
    const spy = vi.spyOn(emailTemplates, "documentAccepted");
    sendNotificationEmail({
      type: "document_verified",
      recipientEmail: "ava@example.com",
      data: { borrowerName: "Ava", documentName: "pay stub" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Ava", "pay stub");
    const rendered = spy.mock.results[0].value as { subject: string; html: string };
    expect(rendered.html).toContain("pay stub");
  });

  it("skips template rendering entirely when the recipient has no email", () => {
    const accepted = vi.spyOn(emailTemplates, "documentAccepted");
    const actionNeeded = vi.spyOn(emailTemplates, "documentActionNeeded");
    sendNotificationEmail({
      type: "document_rejected",
      recipientEmail: "",
      data: { borrowerName: "Ava", documentName: "bank statement" },
    });
    expect(accepted).not.toHaveBeenCalled();
    expect(actionNeeded).not.toHaveBeenCalled();
  });
});

describe("submission emails: one per submit, action-oriented, reason-free", () => {
  // The founder's inbox on 2026-08-18: "application under review" and
  // "application received and being reviewed" — two near-identical emails
  // racing through the provider, arriving reversed, neither naming a next
  // step. The under_review path now sends ONE purposeful email.

  it("applicationUnderReview acknowledges receipt AND names what to do", () => {
    const email = emailTemplates.applicationUnderReview("Ava", "12345678-abcd");
    const text = `${email.subject} ${email.html}`;
    expect(email.subject).toContain("Received");
    expect(text).toContain("licensed underwriter");
    expect(text).toContain("dashboard");
    expect(text).toContain("pay stubs");
    // The account is where specifics live — same rule as document rejections:
    // no review reasons over email. The template takes no reason parameter,
    // so one appearing would have to be smuggled through the name field.
    expect(text).not.toContain("Flagged for review");
    // Reg N rail: an under-review notice must not read as an approval.
    const visible = email.html.replace(/<[^>]+>/g, " ").toLowerCase();
    expect(visible).not.toContain("congratulations");
    expect(visible).not.toContain("you're approved");
    expect(visible).toContain("not a credit decision");
  });

  it("application_under_review dispatches to the dedicated template", () => {
    const spy = vi.spyOn(emailTemplates, "applicationUnderReview");
    sendNotificationEmail({
      type: "application_under_review",
      recipientEmail: "ava@example.com",
      data: { borrowerName: "Ava", applicationId: "12345678-abcd" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Ava", "12345678-abcd");
  });

  it("applicationSubmitted (the delayed-analysis fallback) no longer claims a review is underway", () => {
    const email = emailTemplates.applicationSubmitted("Ava", "12345678-abcd");
    // It fires only when finalizeIntake failed and the sweep will re-drive —
    // "being reviewed now" was untrue on exactly that path.
    expect(email.html).not.toContain("being reviewed now");
    expect(email.html).toContain("in line for review");
  });
});
