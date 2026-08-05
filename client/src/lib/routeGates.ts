import {
  CLIENT_ROLES,
  STAFF_ROLES,
  INTERNAL_STAFF_ROLES,
  type UserRole,
} from "@shared/roles";

/**
 * THE role gates for private routes — who may reach each surface.
 *
 * Two independent places used to answer this question with hand-copied literal
 * arrays: the router (`requiredRoles` in App.tsx) and the sidebar (`roles` on
 * each nav item). When they drift the failure is quiet and confusing — the nav
 * shows a link the route then bounces, or hides one the user is entitled to —
 * so both now read from here.
 *
 * Every gate is `UserRole[]`, so a typo or a retired role is a build error. An
 * unchecked string would produce a gate that silently admits nobody:
 * `requiredRoles.some(r => user.role === r)` can never match a misspelling, and
 * the user is bounced to their home route with nothing logged anywhere.
 *
 * Gates that ARE a named set from shared/roles.ts reference the constant rather
 * than restating it, so adding a role server-side cannot leave the client
 * behind. The rest are deliberately literal: they are narrower than any named
 * set, and inventing a shared constant for a single route's gate would imply a
 * contract the server does not actually share. Each carries the server-side
 * authorization it mirrors — keep them in step.
 *
 * Client gates are a UX affordance, never the security boundary. The server's
 * own role checks are what actually protect the data; these only keep users out
 * of pages that would fail for them anyway.
 */
export const ROUTE_GATES = {
  /** Borrower surfaces — the two client personas. */
  borrower: CLIENT_ROLES,

  /** Staff surfaces, including the external broker/lender partner roles. */
  staff: STAFF_ROLES,

  /**
   * Internal operations cockpits. External partners (broker, lender) are staff
   * *roles* but not internal staff, and must not reach these.
   */
  internalStaff: INTERNAL_STAFF_ROLES,

  /**
   * Policy / pricing / SLA governance surfaces (PolicyOps, TaskOperations,
   * PricingMatrices). Server APIs behind these are requireRole("admin",
   * "underwriter").
   */
  underwriterOps: ["admin", "underwriter"],

  /**
   * Market-data moat surfaces (PricingIntelligence). Mirrors the exact
   * server list on /api/market-data/* — internal staff MINUS closer
   * (server/routes/market-data.ts STAFF const). Offering the page to a
   * closer would render three 403s.
   */
  marketData: ["admin", "lo", "loa", "processor", "underwriter"],

  /**
   * Application-invite tooling. POST /api/application-invites is admin/lo/loa
   * only (server/routes/agent-broker/invites.ts:32) — brokers and lenders refer
   * via their referral codes instead.
   */
  loTeam: ["admin", "lo", "loa"],

  /** CPA partner portal — inviter-only surface, plus admin oversight. */
  cpaPortal: ["cpa", "admin"],

  /**
   * PartnerHub (PH-1). Deliberately a literal, NOT `[...PARTNER_ROLES, "admin"]`:
   * the server gate is requireRole("realtor","admin") (server/routes/partners.ts:199,213),
   * so spreading the shared partner set would silently widen the client gate the
   * moment a new partner role is added while the server stayed put.
   *
   * NOTE: `cpa` is listed here but the server answers 403 — a CPA reaching
   * PartnersHub gets an empty/error page. Pre-existing; narrowing it is a role-gate
   * change and needs the §9 security review, so it is not done as part of this
   * refactor. See the route-gate drift audit.
   */
  partnerHub: ["realtor", "cpa", "admin"],

  /** Admin console. */
  adminOnly: ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type RouteGate = keyof typeof ROUTE_GATES;
