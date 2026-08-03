import {
  STAFF_ROLES,
  INTERNAL_STAFF_ROLES,
  CLIENT_ROLES,
  PARTNER_ROLES,
  type UserRole,
} from "@shared/roles";

/**
 * Client-side route authorization groups — the SINGLE SOURCE OF TRUTH for which
 * roles may reach which surfaces. Every role-gated route in App.tsx references a
 * group here instead of spelling out an inline array, so the same authorization
 * decision is expressed exactly once.
 *
 * Two drift guards are deliberately baked in:
 *  1. Groups reference the shared canonical constants (STAFF_ROLES,
 *     INTERNAL_STAFF_ROLES, CLIENT_ROLES, PARTNER_ROLES) wherever a group IS one
 *     of those sets — so adding a role to shared/roles.ts flows through here for
 *     free and can't silently diverge.
 *  2. `satisfies Record<..., readonly UserRole[]>` makes a typo in a custom
 *     subset (e.g. "underwritter") a COMPILE error rather than a silent
 *     always-forbidden route.
 *
 * These client groups mirror the server's requireRole lists on the APIs each
 * surface calls. When you change a server gate, change the matching group here.
 */
export const ROLE_GROUPS = {
  /** Borrower surfaces (clients working on their mortgage) — shared CLIENT_ROLES. */
  borrower: CLIENT_ROLES,

  /** All staff incl. external partners (broker/lender) — shared STAFF_ROLES. */
  staff: STAFF_ROLES,

  /**
   * Internal operations cockpits — shared INTERNAL_STAFF_ROLES. Excludes the
   * external partner roles (broker, lender): they are staff *roles* but must not
   * reach the internal cockpits.
   */
  internalStaff: INTERNAL_STAFF_ROLES,

  /** Policy/pricing/SLA governance — server APIs are requireRole("admin","underwriter"). */
  underwriterOps: ["admin", "underwriter"],

  /**
   * Application-invite tooling — POST /api/application-invites is admin/lo/loa
   * only (brokers/lenders refer via their referral codes instead).
   */
  loTeam: ["admin", "lo", "loa"],

  /** CPA inviter portal — requireRole("cpa","admin"). */
  cpa: ["cpa", "admin"],

  /**
   * PartnerHub (PH-1): self-registering partner personas + admin. Partners are
   * never staff, so this is the shared PARTNER_ROLES set plus admin.
   */
  partner: [...PARTNER_ROLES, "admin"],

  /** Admin console. */
  admin: ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;
