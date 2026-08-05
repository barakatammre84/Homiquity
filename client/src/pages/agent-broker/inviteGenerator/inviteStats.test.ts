import { describe, it, expect } from "vitest";
import { computeInviteStats, filterInvites } from "./inviteStats";
import type { InviteWithStatus } from "./types";

function invite(over: Partial<InviteWithStatus> & { id: string }): InviteWithStatus {
  return {
    status: "pending",
    isExpired: false,
    applicationStatus: null,
    clientName: null,
    clientEmail: null,
    clientPhone: null,
    message: null,
    token: `tok-${over.id}`,
    createdAt: null,
    expiresAt: null,
    ...over,
  } as InviteWithStatus;
}

// A realistic mix: every status, plus the two cases that make the buckets
// interesting — an applied invite whose link has since lapsed, and a clicked
// invite that expired before the client finished.
const INVITES: InviteWithStatus[] = [
  invite({ id: "1", status: "pending" }),
  invite({ id: "2", status: "pending", isExpired: true }),
  invite({ id: "3", status: "clicked" }),
  invite({ id: "4", status: "clicked", isExpired: true }),
  invite({ id: "5", status: "applied" }),
  invite({ id: "6", status: "applied", isExpired: true }),
];

describe("computeInviteStats", () => {
  it("returns all zeroes rather than NaN before the invites load", () => {
    // conversionRate divides by total; an unguarded 0/0 would render "NaN%".
    expect(computeInviteStats(undefined)).toEqual({
      total: 0, pending: 0, clicked: 0, applied: 0, expired: 0, conversionRate: 0,
    });
    expect(computeInviteStats([])).toEqual({
      total: 0, pending: 0, clicked: 0, applied: 0, expired: 0, conversionRate: 0,
    });
  });

  it("counts an applied invite as a conversion even after its link lapsed", () => {
    // Invite 6 applied AND is expired. Counting it as expired would understate
    // the partner's conversion rate — the client did convert.
    const stats = computeInviteStats(INVITES);
    expect(stats.total).toBe(6);
    expect(stats.applied).toBe(2);
    expect(stats.expired).toBe(2); // invites 2 and 4 — not 6
  });

  it("excludes expired links from pending", () => {
    expect(computeInviteStats(INVITES).pending).toBe(1); // invite 1 only
  });

  it("rounds the conversion rate to a whole percent", () => {
    expect(computeInviteStats(INVITES).conversionRate).toBe(33); // 2/6
    const oneOfThree = INVITES.slice(0, 2).concat(invite({ id: "7", status: "applied" }));
    expect(computeInviteStats(oneOfThree).conversionRate).toBe(33);
  });
});

describe("filterInvites", () => {
  const ids = (f: Parameters<typeof filterInvites>[1]) =>
    filterInvites(INVITES, f).map(i => i.id);

  it("is empty, not undefined, before the invites load", () => {
    expect(filterInvites(undefined, "all")).toEqual([]);
  });

  it("shows everything under All", () => {
    expect(ids("all")).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("keeps applied invites out of the expired tab", () => {
    expect(ids("applied")).toEqual(["5", "6"]);
    expect(ids("expired")).toEqual(["2", "4"]);
  });

  it("hides expired links from the pending tab", () => {
    expect(ids("pending")).toEqual(["1"]);
  });

  it("KNOWN DIVERGENCE: the clicked counter and the clicked tab disagree", () => {
    // computeInviteStats counts every status === "clicked" invite, but
    // filterInvites drops the expired ones. So the tab reads "Clicked (2)"
    // and then renders a single row. Invite 4 is the one that goes missing.
    //
    // Pinned as-is because this is a refactor — the buckets moved out of the
    // component unchanged. Fixing it is a product call: either the counter
    // should exclude expired (matching Pending), or the tab should include
    // them. Whichever way it goes, the two must move together.
    expect(computeInviteStats(INVITES).clicked).toBe(2);
    expect(ids("clicked")).toEqual(["3"]);
  });
});
