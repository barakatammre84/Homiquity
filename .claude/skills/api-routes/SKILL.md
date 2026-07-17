---
name: api-routes
description: Use when adding or changing backend API endpoints under server/routes/ — request handlers, auth/role gating, validation, webhooks, or data access. Covers the route→Zod→service→adapter→Drizzle→typed-JSON pattern, the authorization rules, CSRF/webhook carve-out, PII/audit requirements, and the N+1/inArray query rule.
---

# Backend API routes

Fast-start router. **Authoritative reference:** [`kb/handbook/app-guide/04-api-routes.md`](../../../knowledge-base/handbook/app-guide/04-api-routes.md) (endpoint tables) and `02-architecture.md`; [`DEVELOPER_PLAYBOOK.md`](../../../knowledge-base/handbook/DEVELOPER_PLAYBOOK.md) §2–4. Those win on any conflict — fix them if they drift.

## Non-negotiables
- **Layering:** `client/` never imports `server/`; both import `shared/`. One route file per domain in [`server/routes/`](../../../server/routes/), registered in `server/routes.ts`.
- **Authorization (server-side, never by hiding UI):** public data → no middleware; borrower-specific → `isAuthenticated` + verify the resource belongs to `req.user.id`; staff/admin → `requireRole(...)`. Use `isInternalStaffRole`/`isStaffRole` from `shared/roles.ts`. Never trust a client-supplied user id.
- **Validation:** Zod on every body (often `createInsertSchema` from the shared Drizzle schema). Errors: `res.status(4xx).json({ error })`; unexpected errors bubble to the central handler.
- **PII + audit:** SSNs via `server/services/ssnVault.ts`, other PII via `encryptionService.ts`; every PII-touching mutation writes a `server/auditLog.ts` entry. Response-body logging is **allow-list only** (`server/app.ts` → `RESPONSE_BODY_LOG_ALLOWLIST`).
- **CSRF:** enabled app-wide with a single `/api/webhooks/*` carve-out; webhook receivers authenticate with a shared-secret header instead.
- **Vendors:** credit/AVM/GSE calls go only through their adapters (deterministic simulations until contracts). The underwriting engine stays deterministic — no vendor calls or nondeterminism inside it.
- **Queries:** batch with `inArray` — never query inside a loop (the `/api/dashboard` two-wave pattern in `lending.ts`). New status pools use `pgEnum`.
- **Migrations:** hand-author the SQL in `migrations/`; **never** `drizzle-kit generate` or `npm run db:push` (see CLAUDE.md → Database).

## Where it lives
`server/routes/` (~523 endpoints; the four largest domains — `borrower/`, `lending/`, `underwriting/`, `agent-broker/` — are sub-registrar directories whose `index.ts` call order = Express matching order) · `server/auth.ts` (middleware) · `server/storage/` (data-access layer; inheritance chain, add methods in the matching domain file) · `server/app.ts` (middleware, CSRF, logging).

Enumerate a domain's endpoints: `grep -nE 'app\.(get|post|put|patch|delete)\(' server/routes/<domain>.ts`.
