# 10 — Deploy & Operations

The authoritative docs are [CICD.md](../../runbooks/CICD.md) (deploy) and
[ROLLBACK.md](../../runbooks/ROLLBACK.md) (revert). This page is the operator's summary.

## The flow (PR → required gate → merge deploys)

```
branch → PR      ──▶  required `gate` check (typecheck · unit tests · prod audit · schema guard)
gate green       ──▶  squash-merge your own PR ──▶  Vercel builds & deploys production
                      (+ `migrate-prod` auto-applies any pending migrations)
PR branches      ──▶  automatic preview deployments
broken prod?     ──▶  Vercel → Deployments → last good → Promote (instant)
```

Ship via the PR flow in [CICD.md](../../runbooks/CICD.md) §Shipping — **direct pushes to
`main` are rejected by branch protection** (the old `pnpm save`/`pnpm sync` one-command
scripts die on the push step).

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
  makes pnpm skip devDependencies like vite). `pnpm-lock.yaml` is the **single**
  lockfile — the proxy-poisoned `package-lock.json` was deleted (CH-1,
  2026-07-08); never resurrect it via `pnpm import`. **After changing
  dependencies, run `pnpm install` and commit `pnpm-lock.yaml`.** Local dev uses
  pnpm via corepack. Node is pinned to 24.x; `.npmrc` silences audit/fund.

## Environments

| | Local dev | Production (Vercel) |
|---|---|---|
| Start | `pnpm dev` (port 5001) | automatic on merge to `main` |
| DB | native Postgres `localhost:5432` | Neon (serverless driver) |
| Client | Vite middleware (HMR) | CDN static |
| Secrets | `.env` (gitignored) | Vercel project env vars |
| Sessions | Postgres `sessions` table | same (serverless-safe) |
| Files | GCS (same bucket unless you split) | GCS |

## Operational checks

- **Health**: `GET /api/health` → `{status:"ok"}` or 503 when the DB is
  unreachable. First thing to curl when anything looks wrong — and **after every
  production deploy** (`curl https://www.homiquity.com/api/health`): Vercel
  READY attests the build, not the runtime
  ([CICD.md](../../runbooks/CICD.md) §Post-deploy health check).
- **Logs**: Vercel → Deployments → Functions logs (server `log()` output).
  Sensitive response bodies are already suppressed.
- **Schema changes reach prod automatically**: the `migrate-prod` CI job applies
  pending hand-authored `migrations/00NN_*.sql` on every merge to `main` (URL
  minted from `NEON_API_KEY`). **Never `db:push`** (drops other branches'
  columns, no rollback), never hand-apply, never insert journal rows manually.
  Contract migrations need the read-only CI prod probe *before* authoring;
  snapshot/branch Neon first if the change is destructive. Full flow:
  [DB_MIGRATIONS.md](../../runbooks/DB_MIGRATIONS.md) (+ pre-flight in
  [03-database.md](./03-database.md)); ledger it in [CICD.md](../../runbooks/CICD.md).
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

## Quality checks — what CI enforces vs. what stays manual

The required `gate` check already enforces `pnpm check`, `pnpm test`, a blocking
`pnpm audit --prod --audit-level=high`, and `pnpm guard:schema` on every PR
([CICD.md](../../runbooks/CICD.md) §Checks). Still **manual — CI never runs these**:

```bash
TEST_BASE_URL=http://127.0.0.1:5001 pnpm test:integration   # needs a running dev server
pnpm build                                                  # prove the prod build compiles
node scripts/design-token-guard.cjs                         # raw-color ratchet
```
