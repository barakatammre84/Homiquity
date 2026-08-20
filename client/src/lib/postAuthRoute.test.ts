import { describe, it, expect, beforeEach } from "vitest";
import { getRoleHomeRoute } from "./roleRoutes";
import { getPostAuthRoute } from "./postAuthRoute";
import { setPendingCoachQuestion } from "./pendingCoachQuestion";
import { PREAPPROVAL_PENDING_SUBMIT_KEY } from "./pendingAttribution";

/**
 * The landing-hero question's half of post-auth routing.
 *
 * The deferred pre-approval submit's half is covered in the node lane by
 * tests/postAuthRoute.test.ts; this file adds the second pre-auth intent and,
 * most importantly, the PRECEDENCE between them. Both are stored the same way and
 * both are easy to strand — the funnel's deferred submit already had that bug
 * once, and the hero question is the second thing that must survive the gate.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("getPostAuthRoute", () => {
  it("sends a visitor who asked the hero a question to the coach, not the dashboard", () => {
    setPendingCoachQuestion("Can I afford a $450k house?");
    expect(getPostAuthRoute("aspiring_owner")).toBe("/ai-coach");
  });

  it("lets a deferred pre-approval submit win over a pending question", () => {
    // The submit expires into nothing if it is not replayed; the question is
    // still sitting in storage for the visitor's next trip to the coach.
    localStorage.setItem(PREAPPROVAL_PENDING_SUBMIT_KEY, "true");
    setPendingCoachQuestion("Should I refinance?");
    expect(getPostAuthRoute("aspiring_owner")).toBe("/apply");
  });

  it("honours the question for any role — /ai-coach is open to every signed-in user", () => {
    setPendingCoachQuestion("Can I afford a $450k house?");
    // Deliberate: whoever typed the question gets the answer. Staff reach the
    // coach too (it is AnyAuthPage), so this strands nobody on a gated route,
    // and their role home is one click away in the nav.
    expect(getPostAuthRoute("underwriter")).toBe("/ai-coach");
    expect(getRoleHomeRoute("underwriter")).toBe("/staff-dashboard");
  });
});
