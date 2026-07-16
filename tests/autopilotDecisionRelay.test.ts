import { describe, expect, it } from "vitest";
import { planDecisionRelay } from "../server/services/autopilot/decisionRelay";

describe("planDecisionRelay — the Reg N / adverse-action invariants", () => {
  it("relays approval to the BORROWER only at clear-to-close (Reg N moment)", () => {
    const plan = planDecisionRelay("clear_to_close");
    expect(plan).not.toBeNull();
    expect(plan!.audience).toBe("borrower");
    expect(plan!.event).toBe("clear_to_close");
    expect(plan!.message.title.toLowerCase()).toContain("approved");
  });

  it("never uses approval language before clear-to-close", () => {
    // In-underwriting / conditions are NOT approvals — no relay at all.
    expect(planDecisionRelay("in_underwriting")).toBeNull();
    expect(planDecisionRelay("acknowledged")).toBeNull();
    expect(planDecisionRelay("conditions_issued")).toBeNull();
    expect(planDecisionRelay("conditions_cleared")).toBeNull();
    expect(planDecisionRelay("submitted")).toBeNull();
  });

  it("routes a denial to STAFF (adverse-action), never a 'denied' ping to the borrower", () => {
    const plan = planDecisionRelay("denied");
    expect(plan).not.toBeNull();
    expect(plan!.audience).toBe("staff");
    expect(plan!.message.type).toBe("adverse_action_required");
    // The staff message references the ECOA §1002.9 obligation…
    expect(plan!.message.title).toContain("1002.9");
    // …and the borrower-facing copy must NOT say "denied" or "rejected".
    const borrowerFacing = `${plan!.message.title} ${plan!.message.body}`.toLowerCase();
    expect(borrowerFacing).not.toContain("denied");
    expect(borrowerFacing).not.toContain("rejected");
  });

  it("relays funding to the borrower", () => {
    const plan = planDecisionRelay("funded");
    expect(plan!.audience).toBe("borrower");
    expect(plan!.event).toBe("funded");
  });

  it("does not disclose a wholesale-lender identity in borrower copy", () => {
    for (const status of ["clear_to_close", "funded"]) {
      const plan = planDecisionRelay(status)!;
      const copy = `${plan.message.title} ${plan.message.body}`.toLowerCase();
      // borrower-transparency doctrine: never name the wholesale lender
      expect(copy).toContain("your loan");
      expect(copy).not.toMatch(/wholesale|lender name|uwm|rocket|pennymac/);
    }
  });
});
