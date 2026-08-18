import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Ticket 7: does a funnel field the borrower CLEARS actually reach the server
// draft?
//
// It did not. `buildDraftPatchPayload` omits empty answers — correctly, because
// an absent field means "unchanged" and the form is full of not-yet-reached
// blanks — so an erased answer was indistinguishable from an unanswered one and
// simply never travelled. Clear a field, leave, come back, accept the restore
// banner, and the old value was offered as though you had answered it.
//
// The pure rules are unit-tested in tests/funnelDraftPersistence.test.ts. These
// drive the HOOK, because the claim of this ticket is about the wiring: the
// debounce, what lands in the PATCH body, and when the memory of a held field
// is allowed to be forgotten.

const apiRequest = vi.fn();
vi.mock("@/lib/queryClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));

import { useServerDraftAutosave } from "./useServerDraftAutosave";

const BASE = {
  annualIncome: "",
  monthlyDebts: "",
  creditScore: "",
  employmentType: "employed",
  employmentYears: "",
  propertyType: "single_family",
  propertyState: "",
  purchasePrice: "",
  downPayment: "",
  loanPurpose: "purchase",
  isVeteran: false,
  isFirstTimeBuyer: false,
  hasAdditionalIncome: false,
  incomeSources: [],
} as never;

const withValues = (patch: Record<string, unknown>) =>
  ({ ...(BASE as object), ...patch }) as never;

/** Body of the last PATCH the hook issued, or null if it issued none. */
function lastPatchBody(): Record<string, unknown> | null {
  const call = [...apiRequest.mock.calls].reverse().find((c) => c[0] === "PATCH");
  return (call?.[2] as Record<string, unknown>) ?? null;
}

function render(initial: Record<string, unknown>) {
  return renderHook(
    ({ values }: { values: never }) =>
      useServerDraftAutosave({
        isAuthenticated: true,
        values,
        enabled: true,
        hasMeaningfulData: () => true,
        applicationId: "app-1",
        onDraftAdopted: () => {},
      }),
    { initialProps: { values: withValues(initial) } },
  );
}

/** Let the 2.5s debounce fire and the awaited request settle. */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(3000);
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useServerDraftAutosave — committing a clear", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ json: async () => ({ id: "app-1" }) });
  });
  afterEach(() => vi.useRealTimers());

  it("sends a cleared field as null once it has seen it hold a value", async () => {
    const { rerender } = render({ annualIncome: "85000" });
    await settle();
    expect(lastPatchBody()).toMatchObject({ annualIncome: "85000" });

    rerender({ values: withValues({ annualIncome: "" }) });
    await settle();

    // The whole point of the ticket: the erasure travels.
    expect(lastPatchBody()).toMatchObject({ annualIncome: null });
  });

  it("🚨 sends no clears at all on a fresh blank visit", async () => {
    // The catastrophic case. A visitor who opens /apply on a second device has
    // a blank form and a full server draft; if "empty" meant "clear", the first
    // debounce would erase the draft. Nothing here has ever held a value, so
    // nothing may be cleared — the PATCH carries only real answers.
    const { rerender } = render({});
    rerender({ values: withValues({ purchasePrice: "400000" }) });
    await settle();

    const body = lastPatchBody();
    expect(body).toEqual({
      // Only the answer they actually gave, plus the defaults the form carries.
      employmentType: "employed",
      propertyType: "single_family",
      loanPurpose: "purchase",
      isVeteran: false,
      isFirstTimeBuyer: false,
      purchasePrice: "400000",
    });
    expect(Object.values(body ?? {})).not.toContain(null);
  });

  it("clears a value the RESTORE banner hydrated, not just one typed here", async () => {
    // useDraftRestore fills the form in one shot with form.reset. A borrower
    // who restores and immediately clears a field must still have that travel,
    // which is why held fields are remembered on every observed change rather
    // than only when a debounce happens to catch them.
    const { rerender } = render({});
    rerender({ values: withValues({ monthlyDebts: "450", annualIncome: "85000" }) });
    rerender({ values: withValues({ monthlyDebts: "", annualIncome: "85000" }) });
    await settle();

    expect(lastPatchBody()).toMatchObject({ monthlyDebts: null, annualIncome: "85000" });
  });

  it("keeps re-sending a clear until the request actually succeeds", async () => {
    const { rerender } = render({ annualIncome: "85000" });
    await settle();

    apiRequest.mockRejectedValue(new Error("network"));
    rerender({ values: withValues({ annualIncome: "" }) });
    await settle();
    expect(lastPatchBody()).toMatchObject({ annualIncome: null });

    // Failures here are swallowed by design, so nothing else would notice a
    // dropped clear — it has to survive to the next tick.
    apiRequest.mockResolvedValue({ json: async () => ({ id: "app-1" }) });
    rerender({ values: withValues({ annualIncome: "", monthlyDebts: "450" }) });
    await settle();
    expect(lastPatchBody()).toMatchObject({ annualIncome: null, monthlyDebts: "450" });
  });

  it("stops re-sending a clear once it has landed", async () => {
    const { rerender } = render({ annualIncome: "85000" });
    await settle();
    rerender({ values: withValues({ annualIncome: "" }) });
    await settle();
    expect(lastPatchBody()).toMatchObject({ annualIncome: null });

    rerender({ values: withValues({ annualIncome: "", purchasePrice: "400000" }) });
    await settle();

    const body = lastPatchBody();
    expect(body).toMatchObject({ purchasePrice: "400000" });
    expect("annualIncome" in (body ?? {})).toBe(false);
  });
});
