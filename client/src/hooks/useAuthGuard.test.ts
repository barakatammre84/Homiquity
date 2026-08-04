import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { User } from "@shared/schema";

// Centralized route-authorization guard. These pin the single decision the
// guard now owns (replacing the old App-array + useEffect + inline-render
// split-brain in PrivateLayout): one status, one redirect, per auth state.

const navigateMock = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/current", navigateMock],
}));

// Mutable auth state the mock returns. hasRole mirrors the real useAuth impl so
// the guard's role decision is genuinely exercised, not stubbed away.
let authState: {
  user: Partial<User> | undefined;
  isAuthenticated: boolean;
  isLoading: boolean;
};
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    ...authState,
    isError: false,
    // Mirrors the real useAuth impl (fail-closed on user first) so the guard's
    // role decision is genuinely exercised, not stubbed away.
    hasRole: (roles?: readonly string[]) =>
      !!authState.user &&
      (!roles || roles.length === 0 || roles.some((r) => r === authState.user!.role)),
  }),
}));

import { useAuthGuard } from "./useAuthGuard";

let hrefSetter: ReturnType<typeof vi.fn>;
let originalLocation: Location;

beforeEach(() => {
  navigateMock.mockReset();
  hrefSetter = vi.fn();
  originalLocation = window.location;
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { pathname: "/current", set href(v: string) { hrefSetter(v); } },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
});

describe("useAuthGuard", () => {
  it("returns 'loading' and redirects nowhere while auth is resolving", () => {
    authState = { user: undefined, isAuthenticated: false, isLoading: true };
    const { result } = renderHook(() => useAuthGuard(["admin"]));
    expect(result.current).toBe("loading");
    expect(hrefSetter).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("redirects an unauthenticated user to /login via a hard load", () => {
    authState = { user: undefined, isAuthenticated: false, isLoading: false };
    const { result } = renderHook(() => useAuthGuard(["admin"]));
    expect(result.current).toBe("unauthenticated");
    expect(hrefSetter).toHaveBeenCalledWith("/login");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("authorizes a user whose role is in the required set", () => {
    authState = { user: { role: "admin" }, isAuthenticated: true, isLoading: false };
    const { result } = renderHook(() => useAuthGuard(["admin", "underwriter"]));
    expect(result.current).toBe("authorized");
    expect(hrefSetter).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("authorizes any authenticated user when no roles are required", () => {
    authState = { user: { role: "aspiring_owner" }, isAuthenticated: true, isLoading: false };
    const { result } = renderHook(() => useAuthGuard());
    expect(result.current).toBe("authorized");
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("soft-navigates a wrong-role user to their role home (no hard reload)", () => {
    authState = { user: { role: "cpa" }, isAuthenticated: true, isLoading: false };
    const { result } = renderHook(() => useAuthGuard(["admin"]));
    expect(result.current).toBe("forbidden");
    // cpa's home is the CPA portal (getRoleHomeRoute), via in-app nav.
    expect(navigateMock).toHaveBeenCalledWith("/cpa-portal", { replace: true });
    expect(hrefSetter).not.toHaveBeenCalled();
  });
});
