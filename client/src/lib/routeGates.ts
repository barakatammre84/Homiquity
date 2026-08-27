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
   * Disclosure surfaces the BORROWER must be able to reach, and staff preview
   * as work product. The Loan Estimate is the case that named this gate
   * (ux-30): `/loan-estimate/:id` shipped behind `staff`, so the one act that
   * discharges TRID delivery — the borrower retrieving their own LE — was
   * unreachable from the product, and `leIssuedDate` (stamped ONLY on borrower
   * retrieval, server/routes/underwriting/delivery.ts:95) had never fired from
   * a UI click. The page was always built for them: it renders the borrower's
   * `e_disclosure` ConsentGateCard, which was dead code behind a staff gate.
   *
   * Widening, not narrowing: the server endpoint is already
   * `isAuthenticated + requireConsent("e_disclosure")` with NO role gate, and
   * object-level access is enforced by `getLoanApplicationWithAccess`, so a
   * borrower reaches only their own file. This gate stops bouncing a user the
   * server would have served.
   */
  disclosure: [...CLIENT_ROLES, ...STAFF_ROLES],

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

  /** Inbound mortgage lead inbox. Mirrors LEAD_STAFF_ROLES in server/routes/leads.ts. */
  leadOps: ["admin", "lo", "loa"],

  /** CPA partner portal — inviter-only surface, plus admin oversight. */
  cpaPortal: ["cpa", "admin"],

  /**
   * PartnerHub (PH-1). Deliberately a literal, NOT `[...PARTNER_ROLES, "admin"]`:
   * the server gate is requireRole("realtor","admin") (server/routes/partners.ts:199,213),
   * so spreading the shared partner set would silently widen the client gate the
   * moment a new partner role is added while the server stayed put.
   *
   * `cpa` was listed here until 2026-08-12 while the server answered 403, so a
   * CPA reaching PartnersHub rendered a page whose every data call failed. It is
   * removed rather than added server-side: CPAs already have their own surface
   * (`cpaPortal` above), and PartnerHub serves referral and commission data —
   * which is precisely what the CPA channel must never carry, since RESPA §8(a)
   * bars referral compensation to CPAs in any form. Widening the server to match
   * the client would have built the thing the charter forbids.
   *
   * Pinned by tests/routeGateDrift.test.ts so it cannot drift back.
   */
  partnerHub: ["realtor", "admin"],

  /** Admin console. */
  adminOnly: ["admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type RouteGate = keyof typeof ROUTE_GATES;
