# 01 — Start Here

## What this application is

**Homiquity** is a digital mortgage platform ("Clarity for every stage of
homeownership"). It takes a homebuyer from *"can I afford this house?"* through
a conversational pre-approval application, document collection, deterministic
underwriting, and a generated pre-approval letter — with dashboards for
borrowers, loan-processing staff, admins, and referring real-estate agents.

The product vision and module map live in [L1_VISION_AND_SCOPE.md](../../L1_VISION_AND_SCOPE.md)
(which superseded and absorbed the old `PRODUCT_SPINE.md`).
The one-paragraph version: modules are **Lend** (origination), **Coach** (AI
guidance), **Listings** (property search + affordability), **Ops** (staff
pipeline), **Rates**, **Calculators**, **Education**, **Realtor Engine**
(agent referrals), and **Homeowner** (post-close).

## The stack in one table

| Layer | Technology | Where |
|-------|-----------|-------|
| Frontend | React 18 + TypeScript + Vite, Wouter (routing), TanStack Query, Shadcn/Radix UI, Tailwind | `client/` |
| Backend | Node.js + Express + TypeScript (run with `tsx` in dev, esbuild bundle in prod) | `server/` |
| Database | PostgreSQL — Neon in prod, local Postgres in dev — via Drizzle ORM | `shared/schema/`, `server/db.ts` |
| Shared types | Zod + drizzle-zod schemas shared by client and server | `shared/` |
| AI | Anthropic Claude only — document extraction (never in the decision path) + the borrower coach | `server/extraction*.ts` family, `server/services/coaching*.ts` family (the old `extractionService.ts`/`coachingService.ts` are re-export shims) |
| File storage | Google Cloud Storage (signed URLs) | `server/integrations/object_storage/` |
| Deploy | Railway — one persistent Node process (`dist/index.js`) serving the API **and** the static client. No CDN, no serverless function | `railway.json`, `server/index-prod.ts` |

## Run it locally (5 minutes)

Full guide: [LOCAL_DEV.md](../../runbooks/LOCAL_DEV.md). Short version:

```bash
pnpm install
cp .env.example .env        # fill in DATABASE_URL + the three secrets
pnpm db:migrate          # create tables (apply hand-authored migrations; never db:push)
pnpm dev                 # http://localhost:5001 (PORT is set in .env)
```

On this machine specifically: Postgres runs **natively** (not Docker) on
localhost:5432, and the app uses **PORT=5001** because macOS AirPlay squats on
port 5000.

Log in during dev with the test accounts (see [TEST_ACCOUNTS.md](../../runbooks/TEST_ACCOUNTS.md))
via `POST /api/test-login` — enabled only when `NODE_ENV !== production` and
`DEV_TEST_PASSWORD` is set.

## Useful commands

```bash
pnpm dev                # dev server with Vite middleware (hot reload for client)
pnpm check              # TypeScript typecheck (see "known issues" below)
pnpm test:unit          # fast pure-logic tests
TEST_BASE_URL=http://127.0.0.1:5001 pnpm test:integration   # API tests against a running server
pnpm build && pnpm start # production build + run — exactly what Railway runs in prod
pnpm db:migrate         # apply versioned migrations (hand-authored SQL in migrations/)
```

Landing work: branch → PR → `gate` check green → squash merge → Railway builds
and deploys `main` ([CICD.md](../../runbooks/CICD.md) §Shipping). Direct pushes
to `main` are blocked by branch protection and barred by doctrine — and verify
protection is live before trusting `--auto`
([TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md) §6); the old
`pnpm save`/`pnpm sync` scripts were removed.

⚠️ **A merged, green PR is not a shipped deploy.** A failed Railway build leaves
the *previous* container serving, so the site stays up and every check stays
green while prod goes stale — that is exactly what happened on 2026-08-06 (nine
consecutive failed deploys, ~8 commits behind, unnoticed). The only proof is the
`commit` field of `GET /api/health`, which the CI `verify-deploy` job polls after
every push to `main`. See [10-deploy-ops.md](./10-deploy-ops.md).

⚠️ Do **not** use `pnpm db:push` — the shared dev DB serves multiple branches and
push drops other branches' columns; migrations are hand-authored (drizzle-kit generate
has snapshot drift). See [DB_MIGRATIONS.md](../../runbooks/DB_MIGRATIONS.md) and CLAUDE.md.

## Health of the codebase (as of 2026-07-08)

Clean bill: `pnpm check` is **0 errors**, unit tests **739 green**, integration
tests **73/73** (against a running dev server; see [TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md)
for the auth-rate-limit note when running the full integration suite). All Replit
coupling was removed on 2026-07-02 — auth (session + Passport) now initializes
unconditionally, so login works on any host. If any of those go red, it's the change
in front of you, not inherited debt.

## Where to go next

Read [02-architecture.md](./02-architecture.md) for how a request actually moves
through this system.
