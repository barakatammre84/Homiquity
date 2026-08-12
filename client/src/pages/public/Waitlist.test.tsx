import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// The pre-launch waitlist — "/" while PRELAUNCH_GATED, so this is THE conversion
// surface before the company NMLS licence is issued.
//
// The behaviour pinned here is the one that was broken: a REJECTED submission
// must not look like a successful one. The page used to `await` the browser
// fetch primitive with no `res.ok` check, and that primitive only rejects on a
// NETWORK error — so a 400 (Zod rejects an address the client regex allowed) or
// a 429 (5 per 15 min per IP, server/app.ts emailCaptureLimiter — reachable from
// one shared office or CGNAT mobile IP) resolved normally and the visitor got
// the "you're on the list" screen while nothing was stored.
//
// That is invisible in dev: the happy path works, and the failure only shows up
// as leads that never arrive. Hence a test rather than a manual check.

vi.mock("@/components/SEOHead", () => ({ SEOHead: () => null }));

const toast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

import Waitlist from "./Waitlist";

let fetchMock: ReturnType<typeof vi.fn>;

/** A response in the shape apiRequest inspects. */
function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: "/api/email-capture",
    statusText: "",
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

beforeEach(() => {
  toast.mockReset();
  fetchMock = vi.fn().mockResolvedValue(response(200, { ok: true }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function submitEmail(value = "someone@example.com") {
  render(<Waitlist />);
  const input = screen.getByTestId("input-waitlist-email") as HTMLInputElement;
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form")!);
}

describe("Waitlist submission", () => {
  it("shows the confirmation only when the server accepted the signup", async () => {
    await submitEmail();
    await waitFor(() => {
      expect(screen.queryByTestId("waitlist-success")).toBeTruthy();
    });
  });

  // THE REGRESSION. Each of these resolved (not rejected) from the fetch
  // primitive, so the pre-fix page fell straight through to the success screen.
  it.each([
    [400, { error: "Invalid email address" }, "rejected the address"],
    [429, { error: "Too many requests, please try again later" }, "rate limit tripped"],
    [500, { error: "boom" }, "server fault"],
  ])("does NOT confirm when the server answers %i (%s)", async (status, body) => {
    fetchMock.mockResolvedValue(response(status, body));
    await submitEmail();

    await waitFor(() => {
      expect(toast).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("waitlist-success")).toBeNull();
    expect(toast.mock.calls[0][0].variant).toBe("destructive");
  });

  it("surfaces the server's own message on a 4xx, not generic copy", async () => {
    fetchMock.mockResolvedValue(response(429, { error: "Too many requests, please try again later" }));
    await submitEmail();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    // friendlyApiError extracts {"error": …} from the "<status>: <body>" throw.
    expect(toast.mock.calls[0][0].description).toContain("Too many requests");
  });

  it("keeps a 5xx body off the page", async () => {
    fetchMock.mockResolvedValue(response(500, { error: "pg: duplicate key on email_captures_pkey" }));
    await submitEmail();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    // friendlyApiError suppresses non-deliberate 5xx detail on a public surface.
    expect(toast.mock.calls[0][0].description).not.toContain("email_captures_pkey");
  });

  it("still reports a network failure", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await submitEmail();

    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(screen.queryByTestId("waitlist-success")).toBeNull();
  });
});
