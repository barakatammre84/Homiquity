import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { scanForEscalationTriggers } from "@shared/compliance/complaintEscalation";

// ---------------------------------------------------------------------------
// Roadmap CS2: borrower messages alleging discrimination or credit-reporting
// errors must reach the founder immediately instead of sitting in a normal
// support inbox. The scanner's vocabulary comes from the escalation playbook
// (support-playbooks/discrimination-credit-error-escalation.md) and errs
// toward OVER-flagging: it gates only an internal notification, so a false
// positive costs a founder glance while a miss buries a Reg B/FCRA complaint.
// ---------------------------------------------------------------------------

describe("scanForEscalationTriggers — playbook phrase families flag", () => {
  const cases: Array<[string, string]> = [
    ["I feel like I was discriminated against", "discrimination"],
    ["This is discriminatory and I'm filing a complaint", "discrimination"],
    ["you denied me because of my race", "discrimination"],
    ["was I rejected because I'm older? that would be age discrimination", "discrimination"],
    ["this decision is unfair", "discrimination"],
    ["are you redlining my neighborhood?", "discrimination"],
    ["my credit report is wrong", "credit_reporting_error"],
    ["there are errors on my credit report", "credit_reporting_error"],
    ["that score isn't mine", "credit_reporting_error"],
    ["this score is not mine, someone mixed up my file", "credit_reporting_error"],
    ["I want to dispute this decision", "credit_reporting_error"],
    ["that's not my debt", "credit_reporting_error"],
    ["I was a victim of identity theft", "credit_reporting_error"],
    ["there's a fraudulent account on my report", "credit_reporting_error"],
  ];

  for (const [text, category] of cases) {
    it(`flags: "${text}"`, () => {
      const scan = scanForEscalationTriggers(text);
      expect(scan.flagged).toBe(true);
      expect(scan.categories).toContain(category);
    });
  }

  it("is case-insensitive", () => {
    expect(scanForEscalationTriggers("MY CREDIT REPORT IS WRONG").flagged).toBe(true);
    expect(scanForEscalationTriggers("Discriminated").flagged).toBe(true);
  });

  it("can carry both categories at once, discrimination first", () => {
    const scan = scanForEscalationTriggers(
      "this is unfair and my credit report is wrong",
    );
    expect(scan.categories).toEqual(["discrimination", "credit_reporting_error"]);
  });
});

describe("scanForEscalationTriggers — routine traffic does not flag", () => {
  const routine = [
    "When is my appraisal scheduled?",
    "I uploaded my W-2s yesterday, did you get them?",
    "My credit score improved since last month!",
    "Can we lock the rate this week?",
    "What documents do you still need from me?",
    "Thanks for the update on my loan",
  ];

  for (const text of routine) {
    it(`does not flag: "${text}"`, () => {
      expect(scanForEscalationTriggers(text).flagged).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// Source guards: the wiring contract in the send path and the notification
// service's data-minimization rule.
// ---------------------------------------------------------------------------

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

describe("POST /api/messages wiring", () => {
  const src = read("server/routes/borrower/messaging.ts");

  it("scans borrower-side messages and audits the flag", () => {
    expect(src).toContain("scanForEscalationTriggers(message)");
    expect(src).toContain('"complaint.flagged"');
  });

  it("escalation is fire-and-forget — a failure can never fail the send", () => {
    expect(src).toMatch(/escalateFlaggedMessage\([\s\S]*?\)\.catch\(/);
  });
});

describe("POST /api/coach/message* wiring — the assistant is a borrower-writable surface too", () => {
  const src = read("server/routes/coach.ts");

  // The gap this closes: the identical words escalated from Messages and
  // vanished from the assistant. The assistant is the LOWER-friction channel,
  // so it is if anything the more likely place a borrower says them.
  it("scans the assistant's borrower messages and audits the flag", () => {
    expect(src).toContain("scanForEscalationTriggers(");
    expect(src).toContain('"complaint.flagged"');
    expect(src).toContain('"coach_message"');
  });

  it("escalation is fire-and-forget — a failure can never fail the turn", () => {
    expect(src).toMatch(/escalateFlaggedMessage\([\s\S]*?\)\.catch\(/);
  });

  it("scans the text the borrower actually typed, not the redacted placeholder", () => {
    // The sensitive-input guard rewrites req.body.message BEFORE the turn is
    // prepared. Scanning post-redaction would silently drop a discrimination
    // allegation that shared a message with an SSN, so the raw text is
    // threaded through explicitly.
    expect(src).toContain("prepareCoachTurn(req, res, rawMessage)");
    expect(src).toContain("scanForEscalationTriggers(scanText ?? message)");
  });

  it("covers BOTH message endpoints via the shared pre-flight", () => {
    // Streaming and buffered both funnel through prepareCoachTurn; the scan
    // lives there precisely so neither can be wired up and the other missed.
    expect(src.match(/prepareCoachTurn\(req, res, rawMessage\)/g) ?? []).toHaveLength(2);
    expect(src.match(/scanForEscalationTriggers\(/g) ?? []).toHaveLength(1);
  });
});

describe("founder escalation service data-minimization", () => {
  const src = read("server/services/complaintEscalation.ts");

  it("notifies admins only (the founder carries the compliance hat)", () => {
    expect(src).toContain("isAdmin(u)"); // CH-4: the shared predicate, not a raw string compare
  });

  it("tells the admin which surface to look on", () => {
    // A team_message can be opened in Messages; a coach_message cannot (yet),
    // and nobody has replied to it. The copy must not send the founder to the
    // wrong screen or imply a human already saw it.
    expect(src).toContain('team_message:');
    expect(src).toContain('coach_message:');
    expect(src).toContain("entityType: meta.entityType");
  });

  it("never receives or forwards the borrower's message text", () => {
    // The service's input is ids + categories; the verbatim record is the
    // team_messages row itself. If someone adds a `message`/`text` field to
    // FlaggedMessageRef, this guard forces the conversation.
    expect(src).not.toMatch(/message(?:Text|Body)|\btext\b\s*:/);
    expect(src).toContain("entityId: ref.messageId");
  });
});
