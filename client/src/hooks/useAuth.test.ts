import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { User } from "@shared/schema";

// useAuth.hasRole is the authoritative role check. These pin its fail-closed
// contract: "no roles required" means ANY AUTHENTICATED USER, never "anyone".
// A signed-out visitor must get `false` even with no roles argument, so a future
// caller that uses hasRole() standalone as an auth check cannot be fooled.

let queryResult: {
  data: Partial<User> | undefined;
  status: "pending" | "error" | "success";
  error?: unknown;
};
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryResult,
}));

import { useAuth, shouldRetryAuth } from "./useAuth";

function withUser(user: Partial<User> | undefined) {
  queryResult = { data: user, status: "success", error: null };
  return renderHook(() => useAuth()).result.current;
}

/** What the transport actually throws — ApiError carries a numeric status. */
function apiError(status: number) {
  return Object.assign(new Error(`${status}: nope`), { status });
}

describe("useAuth.hasRole", () => {
  it("returns false for a signed-out visitor even when no roles are required", () => {
    const auth = withUser(undefined);
    expect(auth.isAuthenticated).toBe(false);
    expect(auth.hasRole()).toBe(false);
    expect(auth.hasRole([])).toBe(false);
  });

  it("returns true for any authenticated user when no roles are required", () => {
    const auth = withUser({ role: "aspiring_owner" });
    expect(auth.hasRole()).toBe(true);
    expect(auth.hasRole([])).toBe(true);
  });

  it("matches only when the user's role is in the required set", () => {
    const auth = withUser({ role: "underwriter" });
    expect(auth.hasRole(["admin", "underwriter"])).toBe(true);
    expect(auth.hasRole(["admin"])).toBe(false);
  });

  it("surfaces a non-401 failure as isError rather than silently 'logged out'", () => {
    queryResult = { data: undefined, status: "error", error: apiError(502) };
    const auth = renderHook(() => useAuth()).result.current;
    expect(auth.isError).toBe(true);
    expect(auth.isAuthenticated).toBe(false);
  });

  // The default queryFn is getQueryFn({ on401: "throw" }), so a signed-out
  // visitor's 401 ALSO lands in react-query's error state. Reading `isError`
  // straight off the query would classify "please sign in" as "the server is
  // down": useAuthGuard would render its degraded panel and never redirect to
  // /login, stranding every signed-out visitor on a retry button.
  it("does NOT report isError for a 401 — that is an answer, not a failure", () => {
    queryResult = { data: undefined, status: "error", error: apiError(401) };
    const auth = renderHook(() => useAuth()).result.current;
    expect(auth.isError).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
  });

  it("reports isError when the request never got an answer at all", () => {
    queryResult = { data: undefined, status: "error", error: new TypeError("Failed to fetch") };
    expect(renderHook(() => useAuth()).result.current.isError).toBe(true);
  });

  // Caught in the browser, not in review. react-query's `isLoading` is
  // `isPending && isFetching`, so it drops to FALSE in the gap between retry
  // attempts (fetchStatus "paused") while the query is still pending. Reading
  // it there gave useAuthGuard "not loading, no user, no error" — which is its
  // definition of unauthenticated — and a 502 hard-reloaded a signed-in user
  // to /login mid-retry. `isLoading` must track the whole unsettled period.
  it("stays loading through the whole pending window, retries and pauses included", () => {
    queryResult = { data: undefined, status: "pending", error: null };
    const auth = renderHook(() => useAuth()).result.current;
    expect(auth.isLoading).toBe(true);
    expect(auth.isError).toBe(false);
    expect(auth.isAuthenticated).toBe(false);
  });
});

// A 401 is a real answer ("the session is gone"); everything else is the
// transport failing, and a transport failure must not be read as evidence that
// the user is signed out. Global `retry: false` used to make one blip look
// exactly like a sign-out — see useAuthGuard's "degraded" branch.
describe("shouldRetryAuth", () => {
  it("never retries a 401 — the answer will not change", () => {
    expect(shouldRetryAuth(0, { status: 401 })).toBe(false);
  });

  it("retries transport failures twice, then gives up", () => {
    expect(shouldRetryAuth(0, { status: 502 })).toBe(true);
    expect(shouldRetryAuth(1, { status: 502 })).toBe(true);
    expect(shouldRetryAuth(2, { status: 502 })).toBe(false);
  });

  it("retries an error with no status at all (network drop)", () => {
    expect(shouldRetryAuth(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetryAuth(0, undefined)).toBe(true);
  });
});
