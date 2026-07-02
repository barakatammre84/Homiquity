# 01 — Start Here

## What this application is

**Homiquity** is a digital mortgage platform ("Clarity for every stage of
homeownership"). It takes a homebuyer from *"can I afford this house?"* through
a conversational pre-approval application, document collection, deterministic
underwriting, and a generated pre-approval letter — with dashboards for
borrowers, loan-processing staff, admins, and referring real-estate agents.

The product vision and module map live in [PRODUCT_SPINE.md](../../PRODUCT_SPINE.md).
The one-paragraph version: modules are **Lend** (origination), **Coach** (AI
guidance), **Listings** (property search + affordability), **Ops** (staff
pipeline), **Rates**, **Calculators**, **Education**, **Realtor Engine**
(agent referrals), and **Homeowner** (post-close).

## The stack in one table

| Layer | Technology | Where |
|-------|-----------|-------|
| Frontend | React 18 + TypeScript + Vite, Wouter (routing), TanStack Query, Shadcn/Radix UI, Tailwind | `client/` |
| Backend | Node.js + Express + TypeScript (run with `tsx` in dev, esbuild bundle in prod) | `server/` |
| Database | PostgreSQL — Neon serverless in prod, local Postgres in dev — via Drizzle ORM | `shared/schema/`, `server/db.ts` |
| Shared types | Zod + drizzle-zod schemas shared by client and server | `shared/` |
| AI | Gemini (document extraction), OpenAI (coach), pluggable gateway | `server/gemini.ts`, `server/services/aiGateway.ts` |
| File storage | Google Cloud Storage (signed URLs) | `server/replit_integrations/object_storage/` |
| Deploy | Vercel (static client + serverless Express) | `vercel.json`, `api/index.ts` |

## Run it locally (5 minutes)

Full guide: [LOCAL_DEV.md](../../LOCAL_DEV.md). Short version:

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL + the three secrets
npm run db:push             # create tables
npm run dev                 # http://localhost:5001 (PORT is set in .env)
```

On this machine specifically: Postgres runs **natively** (not Docker) on
localhost:5432, and the app uses **PORT=5001** because macOS AirPlay squats on
port 5000.

Log in during dev with the test accounts (see [TEST_ACCOUNTS.md](../../TEST_ACCOUNTS.md))
via `POST /api/test-login` — enabled only when `NODE_ENV !== production` and
`DEV_TEST_PASSWORD` is set.

## Useful commands

```bash
npm run dev                # dev server with Vite middleware (hot reload for client)
npm run check              # TypeScript typecheck (see "known issues" below)
npm run test:unit          # fast pure-logic tests
TEST_BASE_URL=http://127.0.0.1:5001 npm run test:integration   # API tests against a running server
npm run build && npm start # production build + run
npm run save               # commit-everything + pull + push (the daily driver)
npm run db:push            # apply schema changes to the DB in DATABASE_URL
```

## Known issues to be aware of (as of 2026-07-02)

1. **Auth off-Replit**: session/Passport middleware historically only
   initialized on Replit; a fix is in progress. Symptom: `req.isAuthenticated
   is not a function` unhandled rejections and hanging protected routes.
2. **~22 pre-existing TypeScript errors** on `main` (`npm run check` is red);
   a cleanup task is in progress. Don't mistake them for your own breakage.
3. `server/replit_integrations/{image,chat,batch}` are **unused dead code**
   slated for deletion.

## Where to go next

Read [02-architecture.md](02-architecture.md) for how a request actually moves
through this system.
