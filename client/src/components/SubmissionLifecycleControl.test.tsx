import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SubmissionLifecycleControl } from "./SubmissionLifecycleControl";
import {
  LENDER_SUBMISSION_STATUSES,
  isTerminalSubmissionStatus,
  nextSubmissionStatuses,
  type LenderSubmissionStatus,
} from "@shared/wholesaleLenders";

// WF2-F5: PATCH /api/lender-submissions/:id had zero client callers, so a
// submitted file was inert in the product and the funded figures (F-6) had no
// UI writer. These tests pin the control to the SHARED status machine — if the
// client's offered set ever drifts from what the server would accept, CI reds.

// Radix Select drives pointer-capture + scroll APIs happy-dom doesn't ship.
beforeAll(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
});

const SUBMISSION_ID = "sub-1";

function renderControl(status: LenderSubmissionStatus) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SubmissionLifecycleControl
        applicationId="app-1"
        submissionId={SUBMISSION_ID}
        status={status}
        lenderName="United Wholesale Mortgage"
      />
    </QueryClientProvider>,
  );
}

/** Opens the next-status select; resolves to the options listbox. */
async function openStatusSelect(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId(`next-status-${SUBMISSION_ID}`));
  return screen.findByRole("listbox");
}

const NON_TERMINAL = LENDER_SUBMISSION_STATUSES.filter(s => !isTerminalSubmissionStatus(s));
const TERMINAL = LENDER_SUBMISSION_STATUSES.filter(isTerminalSubmissionStatus);

describe("SubmissionLifecycleControl", () => {
  it.each(NON_TERMINAL)(
    "from %s, offers exactly the shared legal transition set — no phantoms, none missing",
    async status => {
      const user = userEvent.setup();
      const { unmount } = renderControl(status);
      const listbox = await openStatusSelect(user);
      const offered = within(listbox)
        .getAllByRole("option")
        .map(o => o.getAttribute("data-testid")?.replace("option-next-status-", ""));
      expect(offered).toEqual(nextSubmissionStatuses(status));
      unmount();
    },
  );

  it("never offers a transition the server's own predicate would reject", async () => {
    // The inverse assertion: whatever is on screen must survive the shared
    // check. Guards against a hand-maintained list creeping back in.
    const user = userEvent.setup();
    renderControl("in_underwriting");
    const listbox = await openStatusSelect(user);
    const offered = within(listbox)
      .getAllByRole("option")
      .map(o => o.getAttribute("data-testid")!.replace("option-next-status-", ""));
    expect(offered.length).toBeGreaterThan(0);
    expect(offered).not.toContain("in_underwriting");
    for (const to of offered) {
      expect(nextSubmissionStatuses("in_underwriting")).toContain(to as LenderSubmissionStatus);
    }
  });

  it.each(TERMINAL)("offers nothing at all from terminal status %s", status => {
    renderControl(status);
    expect(screen.queryByTestId(`next-status-${SUBMISSION_ID}`)).toBeNull();
    expect(screen.queryByTestId(`advance-submission-${SUBMISSION_ID}`)).toBeNull();
    const note = screen.getByTestId(`submission-terminal-${SUBMISSION_ID}`);
    expect(note.textContent).toContain("no further status changes");
  });

  it("requires BOTH funding figures before the funded transition can be submitted", async () => {
    const user = userEvent.setup();
    renderControl("clear_to_close");
    const listbox = await openStatusSelect(user);
    await user.click(within(listbox).getByTestId("option-next-status-funded"));

    const advance = screen.getByTestId(`advance-submission-${SUBMISSION_ID}`);
    expect(screen.getByTestId(`funding-form-${SUBMISSION_ID}`)).toBeTruthy();
    expect(advance.hasAttribute("disabled")).toBe(true);

    // Funded amount alone is not enough.
    await user.type(screen.getByTestId(`funded-amount-${SUBMISSION_ID}`), "372000");
    expect(advance.hasAttribute("disabled")).toBe(true);

    // Both present — the server's 400 contract is satisfied client-side.
    await user.type(screen.getByTestId(`compensation-received-${SUBMISSION_ID}`), "4650");
    expect(advance.hasAttribute("disabled")).toBe(false);
  });

  it("accepts zero remitted compensation but not a blank box (mirrors the server's min(0))", async () => {
    const user = userEvent.setup();
    renderControl("clear_to_close");
    const listbox = await openStatusSelect(user);
    await user.click(within(listbox).getByTestId("option-next-status-funded"));

    const advance = screen.getByTestId(`advance-submission-${SUBMISSION_ID}`);
    await user.type(screen.getByTestId(`funded-amount-${SUBMISSION_ID}`), "372000");
    expect(advance.hasAttribute("disabled")).toBe(true); // compensation still blank
    await user.type(screen.getByTestId(`compensation-received-${SUBMISSION_ID}`), "0");
    expect(advance.hasAttribute("disabled")).toBe(false);
  });

  it("does not gate a non-funded transition behind the funding form", async () => {
    const user = userEvent.setup();
    renderControl("submitted");
    const listbox = await openStatusSelect(user);
    await user.click(within(listbox).getByTestId("option-next-status-acknowledged"));
    expect(screen.queryByTestId(`funding-form-${SUBMISSION_ID}`)).toBeNull();
    expect(screen.getByTestId(`advance-submission-${SUBMISSION_ID}`).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("warns that a denial triggers the ECOA §1002.9 adverse-action obligation", async () => {
    const user = userEvent.setup();
    renderControl("in_underwriting");
    const listbox = await openStatusSelect(user);
    await user.click(within(listbox).getByTestId("option-next-status-denied"));
    const notice = screen.getByTestId(`denial-notice-${SUBMISSION_ID}`);
    expect(notice.textContent).toContain("adverse-action notice");
    expect(notice.textContent).toContain("30 days");
  });

  it("keeps the advance action inert until a target status is chosen", () => {
    renderControl("submitted");
    expect(screen.getByTestId(`advance-submission-${SUBMISSION_ID}`).hasAttribute("disabled")).toBe(
      true,
    );
  });
});
