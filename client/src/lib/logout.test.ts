import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACTIVE_APP_STORAGE_KEY } from "@/hooks/useActiveApplication";

/**
 * Sign-out must leave nothing of the previous user behind.
 *
 * The regression these pin: the sidebar's logout was a third hand-rolled copy
 * that never called `queryClient.clear()`, so signing out from there kept the
 * previous user's applications/documents/messages in the query cache. The hard
 * navigation at the end hid it — until someone made that navigation
 * client-side, at which point one user's file would render for the next.
 */

/** Point window.location at "/" and capture any href assignment. */
function stubLocation() {
  const assigned: string[] = [];
  Object.defineProperty(window, "location", {
    value: {
      pathname: "/dashboard",
      set href(value: string) {
        assigned.push(value);
      },
    },
    writable: true,
    configurable: true,
  });
  return assigned;
}

describe("logout", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("clears the query cache, so the next user never sees the last one's data", async () => {
    const assigned = stubLocation();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const { queryClient } = await import("./queryClient");
    const { logout } = await import("./logout");

    queryClient.setQueryData(["/api/loan-applications"], [{ id: "someone-elses-file" }]);
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    await logout();

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(assigned).toEqual(["/"]);
  });

  it("drops the per-tab active-file mirror", async () => {
    stubLocation();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200 })));
    const { logout } = await import("./logout");

    window.sessionStorage.setItem(ACTIVE_APP_STORAGE_KEY, "app-of-previous-user");
    await logout();

    expect(window.sessionStorage.getItem(ACTIVE_APP_STORAGE_KEY)).toBeNull();
  });

  it("still signs out locally when the network call fails", async () => {
    // Stranding someone in a session they asked to end is worse than a failed
    // server-side teardown.
    const assigned = stubLocation();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    const { queryClient } = await import("./queryClient");
    const { logout } = await import("./logout");

    queryClient.setQueryData(["/api/dashboard"], { applications: [] });
    window.sessionStorage.setItem(ACTIVE_APP_STORAGE_KEY, "app-1");

    await expect(logout()).resolves.toBeUndefined();

    expect(queryClient.getQueryCache().getAll()).toEqual([]);
    expect(window.sessionStorage.getItem(ACTIVE_APP_STORAGE_KEY)).toBeNull();
    expect(assigned).toEqual(["/"]);
  });

  it("tears down the server session before navigating away", async () => {
    const order: string[] = [];
    stubLocation();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        order.push(`${init.method} ${url}`);
        return new Response("{}", { status: 200 });
      }),
    );
    const { logout } = await import("./logout");

    await logout();

    expect(order).toEqual(["POST /api/auth/logout"]);
  });
});
