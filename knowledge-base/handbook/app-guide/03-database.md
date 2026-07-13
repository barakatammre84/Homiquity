# 03 — Database & Schema

## Fundamentals

- **PostgreSQL**, accessed through **Drizzle ORM**.
- Schema is defined in TypeScript under [`shared/schema/`](../../../shared/schema/)
  (21 schema files, **178 tables** as of 2026-07-12), re-exported through
  [`shared/schema.ts`](../../../shared/schema.ts). Because it lives in `shared/`,
  the client gets the same types and Zod validators (via `drizzle-zod`).
- **Driver selection** ([`server/db.ts`](../../../server/db.ts)): a
  `localhost`/`127.0.0.1` `DATABASE_URL` (or `USE_LOCAL_PG=true`) uses the
  standard `pg` driver; any other URL uses the **Neon serverless** driver
  (WebSocket-based — what runs on Vercel).
- **Migrations**: versioned SQL in [`migrations/`](../../../migrations/)
  (`0000_baseline.sql` onward), **hand-authored** — `drizzle-kit generate` has
  snapshot drift in this repo and produces wrong output. Apply with
  `pnpm db:migrate`. Forward-only (no automatic "down"); snapshot/branch the
  Neon DB before destructive changes (see [ROLLBACK.md](../../runbooks/ROLLBACK.md) §3).
  `db:push` is retired for shared environments — see the pre-flight below.

### Environments

| Environment | Database | How |
|-------------|----------|-----|
| Local dev | Native Postgres on `localhost:5432`, db `homiquity` | `DATABASE_URL` in `.env` |
| Production (Vercel) | Neon (us-east-2, pooled) | `DATABASE_URL` in Vercel env; also stored locally as `PROD_DATABASE_URL` in `.env` for founder-supervised migration applies (see pre-flight below) |

## Schema domains (what lives where)

| File (`shared/schema/`) | Tables | What it covers |
|---|---|---|
| `lending.ts` | 44 | The core origination domain: `loan_applications`, `loan_options`, URLA form data (`urla_personal_info`, `employment_history`, `urla_assets`, `urla_liabilities`, `urla_property_info`, `borrower_declarations`), `rate_locks`, `mortgage_rates`/`mortgage_rate_programs`, pre-approval/pre-qualification letters & conditions, milestones, SLAs, deal teams/activities |
| `underwriting.ts` | 36 | Deterministic underwriting: rules DSL, decision records, lookup grids, rate sheets, pricing adjustments, wholesale lenders |
| `admin.ts` | 28 | Staff/admin: roles & invites, task engine, notifications, audit logs, policy ops, automation config |
| `intelligence.ts` | 12 | Borrower graph & intelligence layer: borrower profiles, state history, readiness checklist, intent events, lender match results, analytics events, outcomes, predictions |
| `compliance.ts` | 13 | Consents (credit/communications), credit pulls (FICO + VantageScore 4.0), adverse actions, hash-chained credit audit log, disclosure versions, data-retention, third-party verification reports (Plaid/Truv GSE report IDs) |
| `documents.ts` | 9 | Document management: uploads, classification, extraction results, confidence scores |
| `property.ts` | 6 | Properties, saved searches, affordability analyses |
| `coach.ts` | 3 | AI coach conversations/messages |
| `lookup.ts` | 2 | Lookup matrix infrastructure |
| `core.ts` | 4 | `users`, `sessions` (Postgres session store), and auth/verification token tables |
| `leads.ts` | 1 | Inbound lead capture: source attribution (Zillow/LendingTree/organic), TrustedForm + TCPA consent evidence, opt-outs, conversion linkage |
| `decisions.ts` | 1 | Decision engine records |
| `ai.ts` | 1 | AI usage/audit |
| `marketData.ts` | 3 | Free-data moat: HMDA competitor loans, competitor rate benchmarks, loan-performance profiles |
| `delivery.ts` | 2 | Fannie Mae loan-delivery capture (`loan_delivery_data`) + delivery-readiness state |
| `cpaPartners.ts` | 2 | CPA partner registry + referral tracking (inviter-only channel) |
| `taxInsights.ts` | 1 | Tax Return Insight signals derived from consumer-uploaded returns |

## The tables you'll touch most

- **`users`** (`core.ts`) — one row per account; `role` drives RBAC (the roles defined in
  [`shared/roles.ts`](../../../shared/roles.ts): internal staff, external partners incl. `cpa`,
  and clients — see [doc 06](./06-auth-security-secrets.md)). Password hash lives here for
  email/password auth; social logins link by email.
- **`loan_applications`** (`lending.ts`) — the aggregate root of the whole
  system. Almost everything else hangs off `loan_application_id` or `user_id`.
- **`documents`** — uploaded files; the DB stores metadata + the GCS object
  path, never file bytes.
- **`sessions`** — express-session storage (via `connect-pg-simple`). If login
  behaves oddly, look here.
- **`credit_pulls` / `credit_consents` / `credit_audit_log`** — the FCRA
  compliance chain; audit log rows are hash-chained (tamper-evident) and
  sensitive fields are encrypted with `CREDIT_ENCRYPTION_KEY`.

## How to make a schema change (pre-flight)

1. Edit the right `shared/schema/<domain>.ts` (or create a new domain file and
   export it from `shared/schema.ts`).
2. **Hand-author** the SQL in a new `migrations/00NN_<name>.sql` — never
   `drizzle-kit generate` (snapshot drift). Apply locally with
   `pnpm db:migrate` and test.
3. From a **worktree**, never `pnpm db:push` against the shared dev DB — it
   drops other branches' columns; use targeted `ALTER TABLE` statements instead
   ([.agents/memory/db-push-blocker.md](../../../.agents/memory/db-push-blocker.md)).
4. Production applies are **founder-supervised**
   ([TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md) §6). The Neon pooler breaks
   `db:migrate` against prod — apply via a direct `pg` client and insert the
   migrations-journal row manually; verify the journal row landed. **If the
   change drops/renames anything, snapshot Neon first.** Record the apply in
   CICD.md's production change ledger.
5. Drizzle infers insert/select types — use `createInsertSchema` (drizzle-zod)
   for request validation like the existing routes do.

## Reading the data-access layer

[`server/storage.ts`](../../../server/storage.ts) (~4,700 lines) implements the
`IStorage` interface — a very wide repository of CRUD methods passed into most
route registrars. Newer services (e.g. the intelligence layer) often query
Drizzle directly instead. Both patterns coexist; prefer keeping related queries
near their existing home.
