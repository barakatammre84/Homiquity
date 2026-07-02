# 10 — Deploy & Operations

The authoritative docs are [CICD.md](../../CICD.md) (deploy) and
[ROLLBACK.md](../../ROLLBACK.md) (revert). This page is the operator's summary.

## The flow (deliberately simple — no CI gates)

```
git push to main  ──▶  Vercel auto-builds & deploys production
PR branches       ──▶  automatic preview deployments
broken prod?      ──▶  Vercel → Deployments → last good → Promote (instant)
```

Ship with `npm run save` (commit-all + pull + push) or plain `git push`.

## How Vercel runs this app

- **Client**: `npm run vercel-build` (= `vite build`) → `dist/public`, served
  from Vercel's CDN.
- **API**: every `/api/*` request invokes the serverless function
  [`api/index.ts`](../../api/index.ts), which builds the Express app once per
  warm instance via `createApp()` (no `listen()`).
- **Routing** (`vercel.json` rewrites): filesystem first (static assets), then
  `/api/(.*)` → the function, then everything → `index.html` (SPA fallback).
- **Node is pinned** to 22.x (`engines` in package.json) — older images hit a
  fatal npm bug ("Exit handler never called").

## Environments

| | Local dev | Production (Vercel) |
|---|---|---|
| Start | `npm run dev` (port 5001) | automatic on push to `main` |
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
- **DB schema push to prod**: `DATABASE_URL="$PROD_DATABASE_URL" npm run db:push`
  (the URL is stashed in your gitignored `.env`). Snapshot/branch Neon first if
  the change is destructive — drizzle push has **no down migrations**.
- **Seeding**: happens automatically at boot, idempotent (existence-checked).

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
npm run check          # typecheck (currently red: ~22 pre-existing errors)
npm run test:unit      # fast, no server needed
TEST_BASE_URL=http://127.0.0.1:5001 npm run test:integration
npm run build          # prove the prod build compiles
```

If you later want enforcement, add a GitHub Actions workflow running those
commands + branch protection — an earlier version existed and was removed by
choice; its design is described in git history of `CICD.md`.
