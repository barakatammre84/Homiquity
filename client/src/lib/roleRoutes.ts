import { isStaffRole } from "@shared/roles";
import { hasPendingPreApprovalSubmit } from "@/lib/pendingAttribution";

// Post-login landing route for a given role. Single source of truth so the login
// flow and its tests can't drift.
//
// - admin        -> admin console
// - broker       -> its own referral/commission dashboard
// - cpa          -> its own inviter-only partner portal
// - lender       -> deferred persona: falls through to the staff route, which renders
//                   a neutral partner landing for non-internal-staff (no product surface yet)
// - other staff  -> internal operations dashboard
// - clients      -> borrower dashboard
export function getRoleHomeRoute(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "broker") return "/broker-dashboard";
  if (role === "cpa") return "/cpa-portal";
  if (isStaffRole(role)) return "/staff-dashboard";
  return "/dashboard";
}

// Where to send a user immediately after they authenticate. If they completed the
// pre-approval funnel and deferred the submit behind the auth gate, return them to
// /apply so the deferred submit replays and the finished application is actually
// created — otherwise fall back to their role's home. Without this, a consumer who
// filled the entire funnel and then signed up lands on the dashboard with their
// answers stranded, and the application (and any invite link) is silently dropped.
export function getPostAuthRoute(role: string): string {
  if (hasPendingPreApprovalSubmit()) return "/apply";
  return getRoleHomeRoute(role);
}
