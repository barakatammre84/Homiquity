# 03 — Database & Schema

## Fundamentals

- **PostgreSQL**, accessed through **Drizzle ORM**.
- Schema is defined in TypeScript under [`shared/schema/`](../../shared/schema/)
  (13 domain files, **160 tables**), re-exported through
  [`shared/schema.ts`](../../shared/schema.ts). Because it lives in `shared/`,
  the client gets the same types and Zod validators (via `drizzle-zod`).
- **Driver selection** ([`server/db.ts`](../../server/db.ts)): a
  `localhost`/`127.0.0.1` `DATABASE_URL` (or `USE_LOCAL_PG=true`) uses the
  standard `pg` driver; any other URL uses the **Neon serverless** driver
  (WebSocket-based — what runs on Vercel).
- **Migrations**: there are none — the project uses `drizzle-kit push`
  (`npm run db:push`), which diffs the TS schema against the live DB and
  applies it. Forward-only. Snapshot/branch the Neon DB before destructive
  changes (see [ROLLBACK.md](../../ROLLBACK.md) §3).

### Environments

| Environment | Database | How |
|-------------|----------|-----|
| Local dev | Native Postgres on `localhost:5432`, db `homiquity` | `DATABASE_URL` in `.env` |
| Production (Vercel) | Neon (us-east-2, pooled) | `DATABASE_URL` in Vercel env; also stored locally as `PROD_DATABASE_URL` in `.env` for schema pushes: `DATABASE_URL="$PROD_DATABASE_URL" npm run db:push` |

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
| `core.ts` | 2 | `users`, `sessions` (the Postgres session store table) |
| `leads.ts` | 1 | Inbound lead capture: source attribution (Zillow/LendingTree/organic), TrustedForm + TCPA consent evidence, opt-outs, conversion linkage |
| `decisions.ts` | 1 | Decision engine records |
| `ai.ts` | 1 | AI usage/audit |

## The tables you'll touch most

- **`users`** (`core.ts`) — one row per account; `role` drives RBAC
  (borrower / staff / admin / agent). Password hash lives here for
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

## How to make a schema change

1. Edit the right `shared/schema/<domain>.ts` (or create a new domain file and
   export it from `shared/schema.ts`).
2. `npm run db:push` against your local DB; test.
3. Ship the code; run `DATABASE_URL="$PROD_DATABASE_URL" npm run db:push` for
   production. **If the change drops/renames anything, snapshot Neon first.**
4. Drizzle infers insert/select types — use `createInsertSchema` (drizzle-zod)
   for request validation like the existing routes do.

## Reading the data-access layer

[`server/storage.ts`](../../server/storage.ts) (~4,700 lines) implements the
`IStorage` interface — a very wide repository of CRUD methods passed into most
route registrars. Newer services (e.g. the intelligence layer) often query
Drizzle directly instead. Both patterns coexist; prefer keeping related queries
near their existing home.
