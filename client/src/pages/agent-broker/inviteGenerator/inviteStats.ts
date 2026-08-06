/**
 * Invite tallying and filtering.
 *
 * Extracted from InviteGenerator.tsx unchanged. One rule runs through all of
 * it and is easy to break by accident: "applied" outranks "expired". A client
 * who applied and then let the link lapse is a conversion, not an expiry —
 * so an applied invite never lands in the expired bucket, on either the
 * counters or the tab filter, and the two must agree or a tab shows a count
 * it cannot fill.
 */
import type { FilterTab, InviteWithStatus } from "./types";

export interface InviteStats {
  total: number;
  pending: number;
  clicked: number;
  applied: number;
  expired: number;
  /** Applied as a share of all invites ever sent, rounded to whole percent. */
  conversionRate: number;
}

export function computeInviteStats(invites: InviteWithStatus[] | undefined): InviteStats {
  const total = invites?.length || 0;
  const pending = invites?.filter(i => i.status === "pending" && !i.isExpired).length || 0;
  const clicked = invites?.filter(i => i.status === "clicked").length || 0;
  const applied = invites?.filter(i => i.status === "applied").length || 0;
  const expired = invites?.filter(i => i.isExpired && i.status !== "applied").length || 0;
  const conversionRate = total > 0 ? Math.round((applied / total) * 100) : 0;
  return { total, pending, clicked, applied, expired, conversionRate };
}

export function filterInvites(
  invites: InviteWithStatus[] | undefined,
  activeFilter: FilterTab,
): InviteWithStatus[] {
  if (!invites) return [];
  switch (activeFilter) {
    case "pending":
      return invites.filter(i => i.status === "pending" && !i.isExpired);
    case "clicked":
      return invites.filter(i => i.status === "clicked" && !i.isExpired);
    case "applied":
      return invites.filter(i => i.status === "applied");
    case "expired":
      return invites.filter(i => i.isExpired && i.status !== "applied");
    default:
      return invites;
  }
}
