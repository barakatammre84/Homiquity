import { describe, it, expect, beforeEach, vi } from "vitest";
import { getPostAuthRoute, getRoleHomeRoute } from "@/lib/roleRoutes";
import {
  PREAPPROVAL_PENDING_SUBMIT_KEY,
  hasPendingPreApprovalSubmit,
} from "@/lib/pendingAttribution";

// Minimal in-memory localStorage so the client routing helpers can run under the
// node test environment (there is no jsdom here).
function installLocalStorage() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  vi.stubGlobal("localStorage", mock);
  return store;
}

describe("getPostAuthRoute — deferred pre-approval submit routing", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("sends a consumer with a completed-but-unsubmitted funnel back to /apply", () => {
    // This is the P0 fix: the funnel stashes this marker at the auth gate, and
    // without the redirect the finished application is silently dropped.
    localStorage.setItem(PREAPPROVAL_PENDING_SUBMIT_KEY, "true");
    expect(hasPendingPreApprovalSubmit()).toBe(true);
    expect(getPostAuthRoute("aspiring_owner")).toBe("/apply");
    // The pending-submit redirect must win even for a staff role.
    expect(getPostAuthRoute("admin")).toBe("/apply");
  });

  it("falls back to the role home route when there is no pending submit", () => {
    expect(hasPendingPreApprovalSubmit()).toBe(false);
    expect(getPostAuthRoute("aspiring_owner")).toBe(getRoleHomeRoute("aspiring_owner"));
    expect(getPostAuthRoute("aspiring_owner")).toBe("/dashboard");
    expect(getPostAuthRoute("admin")).toBe("/admin");
  });

  it("ignores a non-'true' marker value", () => {
    localStorage.setItem(PREAPPROVAL_PENDING_SUBMIT_KEY, "false");
    expect(getPostAuthRoute("aspiring_owner")).toBe("/dashboard");
  });
});
