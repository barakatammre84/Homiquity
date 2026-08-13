import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// #485 — Plaid Link was opened from the RENDER BODY:
//
//   if (linkToken && ready && !isLoading) { setIsLoading(true); open(); }
//
// `setIsLoading` there is a state update during render, and `open()` is an
// external side effect fired from a path React may run more than once. The
// guard was `isLoading` itself, which cannot work from render — the state it
// reads is the value being replaced. `PlaidConnectButton.tsx` had the correct
// shape (a ref plus an effect) the whole time.
//
// The user-visible symptom: closing Plaid made the next render re-fire open(),
// so the modal the borrower had just dismissed came straight back unasked.

const openMock = vi.hoisted(() => vi.fn());
const plaidState = vi.hoisted(() => ({ ready: true, onExit: undefined as undefined | (() => void) }));

vi.mock("react-plaid-link", () => ({
  usePlaidLink: (opts: any) => {
    plaidState.onExit = opts.onExit;
    return { open: openMock, ready: plaidState.ready };
  },
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const apiRequestMock = vi.hoisted(() =>
  vi.fn(async () => ({ json: async () => ({ linkToken: "link-sandbox-1", id: "lt-1" }) })),
);
vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return { ...actual, apiRequest: apiRequestMock };
});

const { PlaidLinkButton } = await import("./Verification");

function renderButton() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlaidLinkButton applicationId="app-1" verificationType="assets" onSuccess={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("PlaidLinkButton — opening Plaid Link", () => {
  beforeEach(() => {
    openMock.mockClear();
    apiRequestMock.mockClear();
    plaidState.ready = true;
  });

  it("does not open Plaid before a link token exists", () => {
    // Nothing has been requested yet, so there is nothing to open. Under the old
    // render-body version this was only accidentally true.
    renderButton();
    expect(openMock).not.toHaveBeenCalled();
  });

  it("opens exactly once when the token arrives, and not again on re-render", async () => {
    const { rerender } = renderButton();
    await userEvent.click(screen.getByTestId("button-verify-assets"));

    expect(openMock).toHaveBeenCalledTimes(1);

    // Re-render with no state change. From the render body this was a second
    // handoff to Plaid; from an effect with a ref guard it is a no-op.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    rerender(
      <QueryClientProvider client={client}>
        <PlaidLinkButton applicationId="app-1" verificationType="assets" onSuccess={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(openMock).toHaveBeenCalledTimes(1);
  });

  it("hands off to Plaid exactly once per request the borrower makes", async () => {
    // THE DISCRIMINATING ASSERTION. Two user actions — open, close, open again
    // — must produce exactly two handoffs.
    //
    // From the render body it produces THREE. Closing Plaid runs onExit, which
    // sets isLoading back to false; that arms the render-body condition again,
    // so the NEXT render fires open() on its own, and the borrower's second
    // click fires it a third time. Measured: expected 2, received 3.
    //
    // (Asserting immediately after onExit does not catch it — no render has
    // happened yet at that point. The spurious open lands on the next render,
    // which is why this test drives a real click afterwards rather than
    // checking the counter synchronously.)
    renderButton();
    await userEvent.click(screen.getByTestId("button-verify-assets"));
    expect(openMock).toHaveBeenCalledTimes(1);

    plaidState.onExit?.();
    await userEvent.click(screen.getByTestId("button-verify-assets"));
    expect(openMock).toHaveBeenCalledTimes(2);
  });

  it("does not open while Plaid reports it is not ready", async () => {
    plaidState.ready = false;
    renderButton();
    await userEvent.click(screen.getByTestId("button-verify-assets"));
    expect(openMock).not.toHaveBeenCalled();
  });
});
