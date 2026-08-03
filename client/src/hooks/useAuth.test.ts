import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { User } from "@shared/schema";

// useAuth.hasRole is the authoritative role check. These pin its fail-closed
// contract: "no roles required" means ANY AUTHENTICATED USER, never "anyone".
// A signed-out visitor must get `false` even with no roles argument, so a future
// caller that uses hasRole() standalone as an auth check cannot be fooled.

let queryResult: { data: Partial<User> | undefined; isLoading: boolean; isError: boolean };
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => queryResult,
}));

import { useAuth } from "./useAuth";

function withUser(user: Partial<User> | undefined) {
  queryResult = { data: user, isLoading: false, isError: false };
  return renderHook(() => useAuth()).result.current;
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
    queryResult = { data: undefined, isLoading: false, isError: true };
    const auth = renderHook(() => useAuth()).result.current;
    expect(auth.isError).toBe(true);
    expect(auth.isAuthenticated).toBe(false);
  });
});
