# 10 — Deploy & Operations

The authoritative docs are [CICD.md](../../runbooks/CICD.md) (deploy) and
[ROLLBACK.md](../../runbooks/ROLLBACK.md) (revert). This page is the operator's summary.

## The flow (deliberately simple — no CI gates)

```
git push to main  ──▶  Vercel auto-builds & deploys production
PR branches       ──▶  automatic preview deployments
broken prod?      ──▶  Vercel → Deployments → last good → Promote (instant)
```

Ship with `pnpm save` (commit-all + pull + push) or plain `git push`.

## How Vercel runs this app

- **Client**: `pnpm vercel-build` (= `vite build`) → `dist/public`, served
  from Vercel's CDN.
- **API**: every `/api/*` request invokes the serverless function
  [`api/index.ts`](../../../api/index.ts), which builds the Express app once per
  warm instance via `createApp()` (no `listen()`).
- **Routing** (`vercel.json` rewrites): filesystem first (static assets), then
  `/api/(.*)` → the function, then everything → `index.html` (SPA fallback).
- **Vercel installs with pnpm, not npm — deliberately.** npm crashed
  mid-install on Vercel's build image ("Exit handler never called") on Node 20,
  22 and 24 alike, four deploys in a row, while the same install works locally.
  So `vercel.json` uses `pnpm install --frozen-lockfile --prod=false`
  (`--prod=false` matters: Vercel sets `NODE_ENV=production`, which otherwise
  makes pnpm skip devDependencies like vite). `pnpm-lock.yaml` mirrors
  `package-lock.json` via `pnpm import`. **After changing dependencies, run
  `npx pnpm@10 import` and commit both lockfiles.** Local dev can keep using
  npm. Node is pinned to 24.x; `.npmrc` silences audit/fund.

## Environments

| | Local dev | Production (Vercel) |
|---|---|---|
| Start | `pnpm dev` (port 5001) | automatic on push to `main` |
| DB | native Postgres `localhost:5432` | Neon (serverless driver) |
| Client | Vite middleware (HMR) | CDN static |
| Secrets | `.env` (gitignored) | Vercel project env vars |
| Sessions | Postgres `sessions` table | same (serverless-safe) |
| Files | GCS (same bucket unless you split) | GCS |

## Operational checks

- **Health**: `GET /api/health` → `{status:"ok"}` or 503 when the DB is
  unreachable. First thing to curl when anything looks wrong.
- **Logs**: Vercel → Deployments → Functions logs (server `log()` output).
  Sensitive response bodies are already suppressed.
- **Apply a schema change to prod** (founder-supervised): **never `db:push`** — it
  drops other branches' columns and has no rollback. Apply the hand-authored
  `migrations/00NN_*.sql` via a direct `pg` client (the Neon pooler breaks
  `db:migrate` against prod), then insert the `drizzle.__drizzle_migrations`
  journal row manually and verify it landed. Snapshot/branch Neon first if the
  change is destructive. Full recipe: [03-database.md](./03-database.md); ledger it
  in [CICD.md](../../runbooks/CICD.md).
- **Seeding**: happens automatically at boot, idempotent (existence-checked).
- **Scheduled jobs** (`vercel.json` crons, authenticated via `CRON_SECRET`; each also
  admin-triggerable): `/api/jobs/lifecycle` daily 13:00 UTC (refi/equity scans, graduation) ·
  `/api/jobs/rate-lock-alerts` daily 12:00 (expiring-lock sweep, #99) ·
  `/api/jobs/adverse-action-delivery` daily 14:00 (ECOA 30-day watchdog) ·
  `/api/jobs/aggregate-data` Mondays 11:17 (anonymized cohort aggregation, OPT-9).

## Serverless caveats (accepted trade-offs, revisit as traffic grows)

1. **Rate limiting is per-instance** (in-memory store) — not a global limit.
   Fix later with a shared store (e.g. Upstash Redis).
2. **Cold starts** re-run app wiring + the seed existence checks (~6 SELECTs).
   `maxDuration: 30` gives headroom.
3. **No WebSocket server** in the app (the `ws` dependency is only the Neon
   driver's client), so serverless is safe. If you ever add realtime features,
   they need a different transport (SSE/polling) or host.
4. **PDF generation** (pdfkit) — verify fonts bundle correctly on Vercel the
   first time you exercise letter generation in prod.

## Manual quality checks (nothing enforces these — run them yourself)

```bash
pnpm check          # typecheck (currently clean — 0 errors)
pnpm test:unit      # fast, no server needed
TEST_BASE_URL=http://127.0.0.1:5001 pnpm test:integration
pnpm build          # prove the prod build compiles
```

If you later want enforcement, add a GitHub Actions workflow running those
commands + branch protection — an earlier version existed and was removed by
choice; its design is described in git history of `CICD.md`.
