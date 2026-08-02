import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session-expiry redirect wiring.
 *
 * The regression these pin: `handleSessionExpired` used to set its latch BEFORE
 * checking the path. POST /api/auth/login answers 401 on a wrong password
 * (server/auth.ts:155), so a single typo on /login consumed the latch — and the
 * real session expiry hours later then redirected nowhere, leaving the user on a
 * dead shell throwing raw "401: Unauthorized" on every surface.
 *
 * The module keeps latch state at module scope, so every test re-imports it
 * fresh via vi.resetModules().
 */

/** Point window.location at `pathname` and capture any href assignment. */
function stubLocation(pathname: string) {
  const assigned: string[] = [];
  Object.defineProperty(window, "location", {
    value: {
      pathname,
      set href(value: string) {
        assigned.push(value);
      },
    },
    writable: true,
    configurable: true,
  });
  return assigned;
}

function stubFetchStatus(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(status === 200 ? "{}" : "nope", { status })),
  );
}

/** Outlast the 100ms setTimeout the redirect is scheduled behind. */
const afterRedirectWindow = () => new Promise((r) => setTimeout(r, 200));

describe("session expiry redirect", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it("does not redirect for a failed sign-in on /login", async () => {
    const assigned = stubLocation("/login");
    const { apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await expect(
      apiRequest("POST", "/api/auth/login", { email: "a@b.com", password: "wrong" }),
    ).rejects.toThrow(/401/);
    await afterRedirectWindow();

    expect(assigned).toEqual([]);
  });

  it("still redirects on a real expiry after a failed sign-in burned the old latch", async () => {
    stubLocation("/login");
    const { apiRequest } = await import("./queryClient");

    // 1. Wrong password on /login.
    stubFetchStatus(401);
    await expect(
      apiRequest("POST", "/api/auth/login", { email: "a@b.com", password: "wrong" }),
    ).rejects.toThrow(/401/);

    // 2. Correct password, then work for a while, then the session expires.
    const assigned = stubLocation("/dashboard");
    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/loan-applications")).rejects.toThrow(/401/);
    await afterRedirectWindow();

    expect(assigned).toEqual(["/login"]);
  });

  it("collapses a burst of concurrent 401s into one redirect", async () => {
    const assigned = stubLocation("/dashboard");
    const { apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await Promise.allSettled([
      apiRequest("GET", "/api/loan-applications"),
      apiRequest("GET", "/api/dashboard"),
      apiRequest("GET", "/api/tasks"),
    ]);
    await afterRedirectWindow();

    expect(assigned).toEqual(["/login"]);
  });

  it("re-arms after a successful request, so a second expiry still redirects", async () => {
    let assigned = stubLocation("/dashboard");
    const { apiRequest } = await import("./queryClient");

    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/dashboard")).rejects.toThrow(/401/);
    await afterRedirectWindow();
    expect(assigned).toEqual(["/login"]);

    // User signs back in — a 2xx proves the session is alive again.
    stubFetchStatus(200);
    await apiRequest("GET", "/api/auth/user");

    // Later, that new session expires too.
    assigned = stubLocation("/dashboard");
    stubFetchStatus(401);
    await expect(apiRequest("GET", "/api/dashboard")).rejects.toThrow(/401/);
    await afterRedirectWindow();
    expect(assigned).toEqual(["/login"]);
  });
});
