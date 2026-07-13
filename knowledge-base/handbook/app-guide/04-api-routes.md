# 04 — API Surface

All API endpoints live under `/api/*`, return JSON, and (where protected) use
**session-cookie auth** — there are no API keys or JWTs for first-party calls.
Unknown `/api/*` paths hit a JSON 404 catch-all; everything else falls through
to the SPA.

## System endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Liveness + DB connectivity (200 ok / 503 if DB unreachable). Use this for uptime checks and post-deploy smoke tests. |
| `POST /api/test-login` | Dev-only login as seeded test accounts (404s in production). |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/user`, logout | Email/password + session (see doc 06). |
| `/api/auth/<provider>/…` | Social OAuth (Google, LinkedIn, Apple) via Passport. |

## Route domains

Each file in [`server/routes/`](../../../server/routes/) registers one domain in
`registerRoutes()` ([`server/routes.ts`](../../../server/routes.ts)). Endpoint
counts give you a sense of surface area (~523 total across 41 route files, 2026-07-12
recount; counts are approximate — grep a file to confirm):

| File | ~Endpoints | Domain |
|------|-----------:|--------|
| `borrower.ts` | 117 | The borrower portal: applications, URLA form sections, dashboard data, pre-approvals, invites, Plaid verification, partner orders |
| `agent-broker.ts` | 47 | Agent/broker portal: referrals, invites, deal visibility, revenue tools |
| `admin.ts` | 36 | Admin panel: users/roles, config, audit, automation |
| `compliance.ts` | 33 | Consents, credit pulls, adverse action, data retention, disclosures |
| `lending.ts` | 25 | Loan pipeline operations, letters, MISMO export, rate locks |
| `task-engine.ts` | 23 | Staff task engine: rules-driven task creation/assignment |
| `intelligence.ts` | 23 | Borrower graph, state machine, lender matching, readiness |
| `rate-sheets.ts` | 20 | Wholesale rate sheets & pricing adjustments |
| `policy-ops.ts` | 19 | Underwriting policy operations/admin |
| `underwriting.ts` | 18 | Run underwriting, decisions, findings |
| `data-intelligence.ts` | 16 | Analytics events, funnels, outcomes, predictions, benchmarks |
| `property.ts` | 12 | Properties CRUD, affordability analysis |
| `optimizations.ts` | 12 | Optimization engine (recommendations) |
| `underwriting-rules.ts` | 10 | Rules DSL CRUD/testing |
| `partners.ts` | 10 | PartnerHub (PH-1/PH-2): realtor registration + admin approval queue, unified attribution, masked partner pipeline behind borrower consent |
| `coach.ts` | 8 | AI coach conversations |
| `taxIntelligence.ts` | 8 | UAL income engine (P2–P6): situation profile, income-path evaluations, review workbench, income analysis package |
| `aus.ts` | 2 | GSE/AUS orchestration: Plaid asset webhook -> verification_reports; DU casefile submit -> Day 1 Certainty + commitment letter |
| `documents.ts` | 7 | Upload URL issuance, document metadata, extraction triggers |
| `lookup-matrix.ts` | 6 | Lookup grid management |
| `geocode.ts` | 4 | Google Maps proxy: autocomplete, details, validation |
| `staff-invites.ts` | 4 | Staff invitation flow |
| `notifications.ts` | 4 | User notifications |
| `listings.ts` | 3 | External property listings search (Redfin/RapidAPI) |
| `calculators.ts` | 2 | Mortgage calculators |
| `jobs.ts` | 6 | Scheduled lifecycle jobs: refi/equity scans, adverse-action delivery, closed-loan graduation |
| `cpaPartners.ts` | 6 | CPA partner portal: self-registration, referral-code validate/apply, partner self-view (inviter-only) |
| `leads.ts` | 4 | Public lead intake (`POST /api/leads`, TrustedForm-gated + rate-limited) + staff list/detail + admin delete |
| `market-data.ts` | 3 | Market-data moat: competitor benchmark, undercut quote, risk profile |
| `seo.ts` | 3 | SEO engine: DB-driven sitemap, bot head-injection/meta, JSON-LD (#91) |
| `taxInsights.ts` | 2 | Tax Return Insight pipeline: consumer-direct upload → readiness signals |
| `cockpit.ts` | 2 | LO Command Center (LO-1): `/api/staff/signals` feed + per-application cockpit hydration |
| `webhooks.ts` | 1 | Inbound provider webhooks (SMS STOP/opt-out; provider-agnostic) |
| `monitoring.ts` | 1 | Client error intake (`/api/client-errors`) → server-side Sentry reporter |
| `shell.ts` | 1 | Consolidated badge counts for the authenticated app shell |
| `scenarios.ts` | 1 | LO-2 What-If Scenario Simulator: deterministic scenario runs (`scenario_runs`) |
| `comms.ts` | 1 | LO-5 comms compliance lint (deterministic Reg Z/Reg N lexicon) |

To enumerate a domain's exact endpoints, grep it:

```bash
grep -nE 'app\.(get|post|put|patch|delete)\(' server/routes/borrower.ts | less
```

## Authorization pattern

Handlers protect themselves with middleware from [`server/auth.ts`](../../../server/auth.ts):

- `isAuthenticated` — any logged-in user; also refreshes `req.user.role` from
  the DB so role changes take effect without re-login.
- `isAdmin` — admin only.
- `requireRole("staff", "admin", …)` — allow-list of roles.

Rule of thumb when adding endpoints: **public data → no middleware; anything
borrower-specific → `isAuthenticated` + verify the resource belongs to
`req.user.id`; staff/admin operations → `requireRole`.** Several existing
handlers also do per-resource ownership checks inline — copy that pattern, and
never trust a client-supplied user id.

## Conventions

- Validate request bodies with Zod schemas (often `createInsertSchema` from
  the shared Drizzle schema).
- Errors: `res.status(4xx).json({ error: "..." })`; unexpected errors bubble to
  the central error handler.
- Rate limits: auth endpoints and uploads have stricter limiters (see doc 02).
- Response-body logging is **allow-list only**: only explicitly PII-free paths log their
  bodies, everything else logs status/duration only
  (`server/app.ts` → `RESPONSE_BODY_LOG_ALLOWLIST`; matches doc 06).
