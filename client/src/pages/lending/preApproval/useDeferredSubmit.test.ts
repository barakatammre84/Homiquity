import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { UseFormReturn } from "react-hook-form";
import type { PreApprovalFormData } from "@shared/schema";
import {
  PREAPPROVAL_AUTOSAVE_KEY,
  PREAPPROVAL_PENDING_SUBMIT_KEY,
} from "@/lib/pendingAttribution";
import { useDeferredSubmit } from "./useDeferredSubmit";

// The post-auth replay finishes a loan application the borrower completed while
// signed out. Two properties matter and neither is visible in dev: it must fire
// EXACTLY once (a second POST is a duplicate application), and it must not fire
// at all once the page is gone (the bare setTimeout this replaced still
// submitted after an unmount).

const VALUES = {
  annualIncome: "120,000",
  purchasePrice: "450,000",
  downPayment: "50,000",
  monthlyDebts: "400",
  // A real CREDIT_SCORE_BAND_VALUES member. This fixture said "excellent" —
  // the leads vocabulary, which the funnel's schema rejects — and a fixture
  // asserting an invalid value is how the calculator handoff shipped writing
  // one for a year. Keep funnel fixtures answerable by the funnel.
  creditScore: "760",
} as unknown as PreApprovalFormData;

let submit: ReturnType<typeof vi.fn>;
let setConsent: ReturnType<typeof vi.fn>;
let reset: ReturnType<typeof vi.fn>;
let form: UseFormReturn<PreApprovalFormData>;

function render(isAuthenticated = true) {
  return renderHook(
    ({ auth }: { auth: boolean }) =>
      useDeferredSubmit({ form, isAuthenticated: auth, setConsent, submit }),
    { initialProps: { auth: isAuthenticated } },
  );
}

/** Arm a completed-but-unsent funnel, exactly as the final step does. */
function armPendingSubmit(saved: string = JSON.stringify(VALUES)) {
  localStorage.setItem(PREAPPROVAL_PENDING_SUBMIT_KEY, "true");
  localStorage.setItem(PREAPPROVAL_AUTOSAVE_KEY, saved);
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  submit = vi.fn();
  setConsent = vi.fn();
  reset = vi.fn();
  form = { reset } as unknown as UseFormReturn<PreApprovalFormData>;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useDeferredSubmit — replaying a completed funnel after sign-up", () => {
  it("restores the answers and the consent, then submits", () => {
    armPendingSubmit();
    render();

    expect(reset).toHaveBeenCalledWith(VALUES);
    // The marker is only ever written after the final step's consent gate
    // passed, so the acknowledgment is restored rather than assumed.
    expect(setConsent).toHaveBeenCalledWith(true);
    expect(submit).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(500));
    expect(submit).toHaveBeenCalledExactlyOnceWith(VALUES);
  });

  it("consumes the marker synchronously, so a re-arm cannot double-submit", () => {
    armPendingSubmit();
    const { rerender } = render();

    expect(localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY)).toBeNull();

    // A second auth transition (a session probe blinking, a tab regaining
    // focus) must not replay: one completed funnel is one application.
    rerender({ auth: false });
    rerender({ auth: true });
    act(() => void vi.advanceTimersByTime(1000));

    expect(submit).toHaveBeenCalledTimes(1);
  });

  it("survives an auth flap inside the replay delay", () => {
    armPendingSubmit();
    const { rerender } = render();

    // The claim and the timer live in SEPARATE effects for exactly this. Sharing
    // one meant the cleanup fired on every isAuthenticated transition, so a
    // momentary flap cancelled the replay while the marker was already
    // consumed — silently dropping a finished application.
    rerender({ auth: false });
    rerender({ auth: true });
    act(() => void vi.advanceTimersByTime(500));

    expect(submit).toHaveBeenCalledExactlyOnceWith(VALUES);
  });

  it("does NOT submit when the page unmounts inside the replay delay", () => {
    armPendingSubmit();
    const { unmount } = render();

    unmount();
    act(() => void vi.advanceTimersByTime(1000));

    // The bare setTimeout this replaced had no cleanup, so a redirect or a fast
    // Back inside the delay still POSTed an application for a dead page.
    expect(submit).not.toHaveBeenCalled();
  });

  it("stays inert for a visitor who is not signed in", () => {
    armPendingSubmit();
    render(false);

    act(() => void vi.advanceTimersByTime(1000));
    expect(submit).not.toHaveBeenCalled();
    // The marker survives, so the replay still happens once they sign in.
    expect(localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY)).toBe("true");
  });

  it("does nothing when no funnel is waiting", () => {
    render();
    act(() => void vi.advanceTimersByTime(1000));
    expect(reset).not.toHaveBeenCalled();
    expect(submit).not.toHaveBeenCalled();
  });

  it("clears the marker but does not submit when the autosave is corrupt", () => {
    armPendingSubmit("{not json");
    render();

    act(() => void vi.advanceTimersByTime(1000));
    expect(submit).not.toHaveBeenCalled();
    // Cleared regardless: a marker that can never be honoured would otherwise
    // suppress the restore banner on every future visit.
    expect(localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY)).toBeNull();
  });
});

describe("useDeferredSubmit — hasPendingSubmit", () => {
  it("stays true for the rest of the mount once a replay is claimed", () => {
    armPendingSubmit();
    const { result } = render();

    // The key is already consumed, but the restore banner must stay suppressed
    // while the submit is in flight — offering to restore answers a deferred
    // submit owns would double-consume them.
    expect(localStorage.getItem(PREAPPROVAL_PENDING_SUBMIT_KEY)).toBeNull();
    expect(result.current.hasPendingSubmit()).toBe(true);
  });

  it("reads the marker when no replay has been claimed yet", () => {
    const { result } = render(false);
    expect(result.current.hasPendingSubmit()).toBe(false);

    armPendingSubmit();
    expect(result.current.hasPendingSubmit()).toBe(true);
  });
});
