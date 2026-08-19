import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The landing hero's coach bar, and the one thing it must never do: accept a
 * question and then lose it.
 *
 * `/ai-coach` is behind `AnyAuthPage`, and the auth guard bounces a signed-out
 * visitor with a HARD load to /login that carries no return-to. So the naive
 * version of this component — a box that navigates to /ai-coach — would take a
 * question, show a redirect, and drop it on the floor. That is the exact
 * silent-success shape this codebase keeps re-shipping, so it gets pinned here.
 */

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/", navigate],
}));

let authed = false;
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ isAuthenticated: authed }),
}));

import { CoachPromptBar } from "./CoachPromptBar";
import { PENDING_COACH_QUESTION_KEY } from "@/lib/pendingCoachQuestion";

beforeEach(() => {
  navigate.mockReset();
  localStorage.clear();
  authed = false;
});

describe("CoachPromptBar", () => {
  it("stashes a signed-out visitor's question before sending them to signup", async () => {
    const user = userEvent.setup();
    render(<CoachPromptBar />);

    await user.type(screen.getByTestId("input-coach-question"), "Can I afford a $450k house?");
    await user.click(screen.getByTestId("button-coach-ask"));

    // The question survives the auth gate: it is durable storage, not component
    // state that the redirect is about to unmount.
    expect(localStorage.getItem(PENDING_COACH_QUESTION_KEY)).toBe("Can I afford a $450k house?");
    expect(navigate).toHaveBeenCalledWith("/signup");
  });

  it("sends an authenticated visitor straight to the coach, still carrying the question", async () => {
    authed = true;
    const user = userEvent.setup();
    render(<CoachPromptBar />);

    await user.type(screen.getByTestId("input-coach-question"), "Should I refinance?");
    await user.click(screen.getByTestId("button-coach-ask"));

    expect(localStorage.getItem(PENDING_COACH_QUESTION_KEY)).toBe("Should I refinance?");
    expect(navigate).toHaveBeenCalledWith("/ai-coach");
  });

  it("carries the quick-prompt chips through the same handoff", async () => {
    const user = userEvent.setup();
    render(<CoachPromptBar />);

    await user.click(screen.getByTestId("button-coach-prompt-what-could-i-afford"));

    expect(localStorage.getItem(PENDING_COACH_QUESTION_KEY)).toBe("What could I afford?");
    expect(navigate).toHaveBeenCalledWith("/signup");
  });

  it("sends on Enter — the gesture most visitors will actually use", async () => {
    const user = userEvent.setup();
    render(<CoachPromptBar />);

    await user.type(
      screen.getByTestId("input-coach-question"),
      "How much can I borrow?{Enter}",
    );

    expect(localStorage.getItem(PENDING_COACH_QUESTION_KEY)).toBe("How much can I borrow?");
    expect(navigate).toHaveBeenCalledWith("/signup");
  });

  it("fires the send exactly once on Enter, not twice via implicit submission", async () => {
    const user = userEvent.setup();
    render(<CoachPromptBar />);

    await user.type(screen.getByTestId("input-coach-question"), "Should I refinance?{Enter}");

    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("does nothing at all on an empty submit — no stash, no navigation", async () => {
    const user = userEvent.setup();
    render(<CoachPromptBar />);

    // The submit control is disabled while the box is empty, so a stray Enter in
    // the field is the only way to fire the form.
    expect(screen.getByTestId("button-coach-ask")).toHaveProperty("disabled", true);
    await user.type(screen.getByTestId("input-coach-question"), "   {Enter}");

    expect(localStorage.getItem(PENDING_COACH_QUESTION_KEY)).toBeNull();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("states the Reg N limit AND who actually decides", () => {
    render(<CoachPromptBar />);
    const disclaimer = screen.getByTestId("text-coach-disclaimer").textContent ?? "";

    expect(disclaimer).toMatch(/not a loan approval, offer, or commitment/i);
    // Homiquity is a broker and does not make credit decisions (Footer.tsx). An
    // assistant sitting in the hero is exactly where a visitor would assume
    // otherwise, so the page says who decides right underneath it.
    expect(disclaimer).toMatch(/lenders make the credit decision/i);
  });
});
