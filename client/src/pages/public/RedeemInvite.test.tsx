import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Staff invite redemption. The behaviour pinned here is the distinction the page
// used to collapse: "this code is not valid" vs "we could not check the code".
//
// GET /api/staff-invites/validate/:code answers 500 with `{ error }` and NO
// `valid` field (server/routes/staff-invites.ts:77). The page set that straight
// into `validation`, so `validation.valid` was `undefined` — falsy — which
// rendered the destructive invalid-code panel AND disabled Redeem
// (`validation !== null && !validation.valid`). A transient server error told a
// staff member their good invite was invalid and locked them out of it.

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isAuthenticated: false, isLoading: false, isError: false, hasRole: () => false }),
}));

import RedeemInvite from "./RedeemInvite";

let fetchMock: ReturnType<typeof vi.fn>;

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url: "/api/staff-invites/validate/ABC123",
    statusText: "",
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function validate(code = "ABC123") {
  render(<RedeemInvite />);
  const input = screen.getByTestId("input-invite-code") as HTMLInputElement;
  fireEvent.change(input, { target: { value: code } });
  fireEvent.click(screen.getByTestId("button-validate-code"));
}

describe("invite code validation", () => {
  it("accepts a valid code", async () => {
    fetchMock.mockResolvedValue(response(200, { valid: true, role: "loan_officer" }));
    await validate();
    await waitFor(() => expect(screen.queryByTestId("text-valid-invite")).toBeTruthy());
  });

  it("reports a genuinely invalid code — a 404 IS the server's answer", async () => {
    fetchMock.mockResolvedValue(response(404, { valid: false, error: "Invalid invite code" }));
    await validate();
    await waitFor(() => expect(screen.queryByTestId("text-invalid-invite")).toBeTruthy());
    expect(screen.getByTestId("text-invalid-invite").textContent).toContain("Invalid invite code");
  });

  it("reports an already-used code (200 with valid:false)", async () => {
    fetchMock.mockResolvedValue(response(200, { valid: false, error: "Invite already used" }));
    await validate();
    await waitFor(() => expect(screen.queryByTestId("text-invalid-invite")).toBeTruthy());
  });

  // THE REGRESSION.
  it("does NOT call a code invalid when the server merely failed", async () => {
    fetchMock.mockResolvedValue(response(500, { error: "Failed to validate invite" }));
    await validate();

    await waitFor(() => expect(screen.queryByTestId("text-invite-check-failed")).toBeTruthy());
    // Not presented as an invalid code…
    expect(screen.queryByTestId("text-invalid-invite")).toBeNull();
    // …and the 5xx internal string stays off a public page.
    expect(screen.getByTestId("text-invite-check-failed").textContent).not.toContain(
      "Failed to validate invite",
    );
  });

  it("leaves Redeem enabled after a failed check, so a good code is not locked out", async () => {
    fetchMock.mockResolvedValue(response(500, { error: "Failed to validate invite" }));
    await validate();

    await waitFor(() => expect(screen.queryByTestId("text-invite-check-failed")).toBeTruthy());
    expect((screen.getByTestId("button-redeem-code") as HTMLButtonElement).disabled).toBe(false);
  });

  it("still disables Redeem when the server actually said the code is invalid", async () => {
    fetchMock.mockResolvedValue(response(404, { valid: false, error: "Invalid invite code" }));
    await validate();

    await waitFor(() => expect(screen.queryByTestId("text-invalid-invite")).toBeTruthy());
    expect((screen.getByTestId("button-redeem-code") as HTMLButtonElement).disabled).toBe(true);
  });

  it("treats a network failure as could-not-check, not invalid", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await validate();

    await waitFor(() => expect(screen.queryByTestId("text-invite-check-failed")).toBeTruthy());
    expect(screen.queryByTestId("text-invalid-invite")).toBeNull();
  });
});
