import { isStaffRole } from "@shared/roles";

// Post-login landing route for a given role. Single source of truth so the login
// flow and its tests can't drift.
//
// - admin        -> admin console
// - broker       -> its own referral/commission dashboard
// - cpa          -> its own inviter-only partner portal
// - realtor      -> PartnerHub (PH-1), the self-service partner home
// - lender       -> deferred persona: falls through to the staff route, which renders
//                   a neutral partner landing for non-internal-staff (no product surface yet)
// - other staff  -> internal operations dashboard
// - clients      -> borrower dashboard
export function getRoleHomeRoute(role: string): string {
  if (role === "admin") return "/admin";
  if (role === "broker") return "/broker-dashboard";
  if (role === "cpa") return "/cpa-portal";
  if (role === "realtor") return "/partners/hub";
  if (isStaffRole(role)) return "/staff-dashboard";
  return "/dashboard";
}
