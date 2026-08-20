import { getRoleHomeRoute } from "./roleRoutes";
import {
  hasPendingPreApprovalSubmit,
  PENDING_COACH_QUESTION_KEY,
} from "./pendingAttribution";

// Split out of roleRoutes.ts, which is EAGER: useAuthGuard imports
// `getRoleHomeRoute`, and App.tsx pulls useAuthGuard in through PrivateLayout, so
// Rollup hoists that whole module into the bundle every visitor downloads. This
// half is reached only from the lazy auth pages (Login, Signup, TestLogin), so
// keeping it here means the pre-auth intent checks ride those chunks instead.

// Where to send a user immediately after they authenticate. Two pre-auth intents
// outrank the role home route, in this order:
//
//  1. A completed pre-approval funnel whose submit was deferred behind the auth
//     gate -> /apply, so the submit replays and the application is really created.
//  2. A question typed into the public landing hero -> /ai-coach, which sends it.
//
// The funnel wins when both are set: an unsent application is a finished piece of
// work that expires into nothing, while the question is still waiting in storage
// and the coach will pick it up on the visitor's next trip there.
export function getPostAuthRoute(role: string): string {
  if (hasPendingPreApprovalSubmit()) return "/apply";
  if (hasPendingCoachQuestion()) return "/ai-coach";
  return getRoleHomeRoute(role);
}

/**
 * Read the landing-hero question flag from the key rather than importing
 * `pendingCoachQuestion.ts`. Only the write and read/clear helpers live there and
 * they are used from lazy routes; pulling the module in for what is one getItem
 * would drag them along. The key itself stays shared, so the two cannot drift.
 */
function hasPendingCoachQuestion(): boolean {
  try {
    return !!localStorage.getItem(PENDING_COACH_QUESTION_KEY);
  } catch {
    return false;
  }
}
