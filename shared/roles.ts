/**
 * Role system — pure constants and helpers, ZERO runtime dependencies.
 *
 * Kept separate from schema/core.ts (which imports drizzle-orm) so the client
 * can import role helpers without dragging the ORM and every table definition
 * into the browser bundle. schema/core.ts re-exports everything here, so
 * server code and existing `@shared/schema` imports are unaffected.
 */

// Staff Roles (Internal & Partner). Every role here is provisioned by a trusted
// process (staff invite / admin assignment) — NOT self-registration. Many
// endpoints gate on isStaffRole() alone, so a self-registerable role must never
// be added to this list (see PARTNER_ROLES).
export const STAFF_ROLES = [
  "admin",           // Tech/Ops Lead - Full system access
  "lo",              // Loan Officer - Sales & lead qualification
  "loa",             // Loan Officer Assistant - Document collection & appointments
  "processor",       // Processor - File bundling & pre-underwriting
  "underwriter",     // Underwriter - Final loan decisions
  "closer",          // Closer/Funder - Wire management & final docs
  "broker",          // Mortgage Broker - Loan origination & lender relationships
  "lender",          // Lender Representative - Loan product & pricing management
] as const;

// Client Roles
export const CLIENT_ROLES = [
  "aspiring_owner",  // Renter exploring homeownership (sandbox mode)
  "active_buyer",    // Borrower in buying process
] as const;

// Self-registering external partners. Deliberately NOT in STAFF_ROLES: because
// these accounts are created by public self-service (POST /api/cpa-partners/register),
// treating them as staff would expose every isStaffRole()-gated endpoint (staff
// directory, compliance reports, deal-rescue, etc.) to anyone. Access is granted
// ONLY through exact-role checks (requireRole("cpa", ...) / the /cpa-portal gate).
export const PARTNER_ROLES = [
  "cpa",             // CPA Partner - Inviter-only referral source (never sees borrower data)
] as const;

// All roles combined
export const ALL_ROLES = [...STAFF_ROLES, ...CLIENT_ROLES, ...PARTNER_ROLES] as const;
export type UserRole = typeof ALL_ROLES[number];

// Role display names for UI
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: "Tech/Ops Lead",
  lo: "Loan Officer",
  loa: "Loan Officer Assistant",
  processor: "Processor",
  underwriter: "Underwriter",
  closer: "Closer/Funder",
  broker: "Mortgage Broker",
  lender: "Lender Representative",
  cpa: "CPA Partner",
  aspiring_owner: "Aspiring Owner",
  active_buyer: "Active Buyer",
};

// Role descriptions for UI
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin: "Full system access, user management, configuration",
  lo: "Sales & lead qualification, client relationships",
  loa: "Document collection, appointments, client updates",
  processor: "File bundling, pre-underwriting, condition management",
  underwriter: "Final loan approval/denial, risk assessment",
  closer: "Wire management, final document sign-off",
  broker: "Loan origination, lender relationships, deal management",
  lender: "Loan product management, pricing, approvals",
  cpa: "Refer clients to check home-buying readiness; sees referral progress only",
  aspiring_owner: "Explore homeownership, sandbox mode, gap calculator",
  active_buyer: "Apply for mortgages, upload documents, track progress",
};

// Internal staff roles: tightly controlled employees who have platform-wide access.
// External partner roles (broker, lender) are intentionally excluded; they must be
// explicitly assigned to a deal-team before accessing any borrower record.
export const INTERNAL_STAFF_ROLES = [
  "admin",
  "lo",
  "loa",
  "processor",
  "underwriter",
  "closer",
] as const;

// Helper to check if role is staff (includes external partner roles)
export function isStaffRole(role: string): boolean {
  return STAFF_ROLES.includes(role as typeof STAFF_ROLES[number]);
}

// Helper to check if role is an *internal* staff role.
// Use this instead of isStaffRole() whenever object-level authorization is required,
// because broker and lender are external partners that must be deal-team members to
// access any specific borrower record.
export function isInternalStaffRole(role: string): boolean {
  return INTERNAL_STAFF_ROLES.includes(role as typeof INTERNAL_STAFF_ROLES[number]);
}

// Helper to check if role is client
export function isClientRole(role: string): boolean {
  return CLIENT_ROLES.includes(role as typeof CLIENT_ROLES[number]);
}

// Helper to check if role is a self-registering external partner (e.g. cpa).
// These are NOT staff and reach only their own exact-role-gated surfaces.
export function isPartnerRole(role: string): boolean {
  return PARTNER_ROLES.includes(role as typeof PARTNER_ROLES[number]);
}
