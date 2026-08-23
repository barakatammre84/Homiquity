# 10 — Deploy & Operations

The authoritative docs are [CICD.md](../../runbooks/CICD.md) (deploy) and
[ROLLBACK.md](../../runbooks/ROLLBACK.md) (revert). This page is the operator's summary.

## The flow (PR → required gate → merge deploys)

```
branch → PR      ──▶  required `gate` check (typecheck · unit tests · prod audit · schema guard
                      · builds AND boots the prod artifact against a real Postgres)
gate green       ──▶  squash-merge your own PR ──▶  Railway builds from GitHub and deploys
                      (+ `migrate-prod` auto-applies any pending migrations)
merged           ──▶  `verify-deploy` polls /api/health until `commit` == the merged SHA
broken prod?     ──▶  Railway → project Homiquity → service Homiquity → Deployments → ⋯ → Rollback
stale prod?      ──▶  NOT a rollback — read the FAILED build's log (ROLLBACK.md §0)
```

Ship via the PR flow in [CICD.md](../../runbooks/CICD.md) §Shipping — **gate green, then
squash-merge; direct pushes to `main` are barred by doctrine**.

🚨 **verified 2026-08-22: protection exists but blocks almost nothing** — `allow_force_pushes:false` and `enforce_admins:true`, but **0 required status checks, no required review, no push restriction**. A direct push to `main` is therefore *not* blocked; only doctrine stops it, and a red `gate` cannot hold a merge. Re-arming the required check is a founder action.
 (verify protection is live before trusting `--auto` —
[TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md) §6. The old `pnpm save`/`pnpm sync`
one-command scripts were removed).

**There are no per-PR preview deployments today** — nothing in `railway.json` or the
service config creates one, and the old host's preview environments went away with it. A
PR is validated by the `gate` check (which builds *and boots* the production artifact
against a real Postgres) plus whatever you run locally; the first time a change runs on
production infrastructure is after the merge. Budget your verification accordingly.

> **"SUCCESS" is not "shipped." Only the `commit` field is.** On 2026-08-06 nine
> consecutive Railway deploys failed, and because a FAILED Railway deploy leaves the
> **previous container serving**, the site stayed up, every check stayed green, and prod
> sat ~8 commits stale for hours. `GET /api/health` returns `commit`
> (`RAILWAY_GIT_COMMIT_SHA`) precisely so that state is visible, and the `verify-deploy`
> CI job polls it after every push to `main` and goes red if prod is not serving that
> commit. A 200 from `/api/health` and a green deploy badge prove neither that your merge
> shipped nor that it shipped against the right database.

## How Railway runs this app

- **One persistent Node process serves everything.** `pnpm build` = `vite build`
  (client → `dist/public`) **plus** an esbuild bundle of
  [`server/index-prod.ts`](../../../server/index-prod.ts) → `dist/index.js`; `pnpm start`
  runs `node dist/index.js`. That single Express process answers `/api/*` **and** serves
  the built client (`express.static` + the SPA catch-all). **There is no CDN, no
  serverless function, and no edge middleware** — if you are reasoning about a request,
  there is exactly one place it can be handled.
- **Request order inside the process** (`server/index-prod.ts` + `server/app.ts`):
  beta gate → the whole `/api/*` route surface → bot prerender → `express.static`
  (`dist/public`, hashed assets `immutable`, `index.html` `no-cache`) → SPA catch-all →
  `index.html`. That ordering is a correctness invariant, not a style choice — see the
  comments in `server/index-prod.ts`.
- **Config as code**: [`railway.json`](../../../railway.json) — builder `RAILPACK`,
  build `pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`,
  `healthcheckPath: /api/health` (300s timeout), `restartPolicyType: ON_FAILURE`
  (10 retries). Service settings not expressible there (region `us-east4`, 1 replica) live in
  the Railway dashboard. Railway builds from GitHub on every push to `main`.
- **⚠️ "Wait for CI" (service → Settings → Source) changes deploy timing, and it is
  mutually exclusive with `verify-deploy`.** When on, Railway holds the deployment in
  `WAITING` until every GitHub workflow for that commit succeeds — and if one fails, the
  deployment is marked `SKIPPED`, which is **terminal, with no retry**. But
  `verify-deploy` polls production until it serves that commit, so with the setting on the
  two wait for each other: measured 2026-08-06, four consecutive pushes each took **21
  minutes** (the full poll timeout) and `verify-deploy` failed 4/4, because the deploy it
  was waiting for could not start until it finished. `continue-on-error: true` on that job
  stops this becoming a permanent freeze, but it does not make the pair useful together.
  **If you want `verify-deploy` to mean anything, keep Wait for CI OFF.** If you turn it
  on, accept that `verify-deploy` is decorative and rely on Railway's deployment
  notifications instead.
- **⚠️ `engines.node` must be a value the builder can actually resolve.** It is pinned to
  `"24"`. It was briefly `"24.x"` — valid npm range syntax that **mise (Railpack's version
  manager) cannot resolve** — and that one character killed nine deploys in a row on
  2026-08-06 while the site kept serving the old container. If you touch the Node pin,
  watch `verify-deploy`, not the site.
- **pnpm, not npm — deliberately.** `pnpm-lock.yaml` is the **single** lockfile; the
  proxy-poisoned `package-lock.json` was deleted (CH-1, 2026-07-08) after npm crashed
  mid-install on the build image ("Exit handler never called") four deploys in a row —
  never resurrect it via `pnpm import`. **After changing dependencies, run `pnpm install`
  and commit `pnpm-lock.yaml`**, or the `--frozen-lockfile` install fails the build.
  Local dev uses pnpm via corepack; `.npmrc` silences audit/fund.

## Environments

| | Local dev | Production (Railway) |
|---|---|---|
| Start | `pnpm dev` (port 5001) | automatic on merge to `main` |
| DB | native Postgres `localhost:5432` | Neon (serverless driver) |
| Client | Vite middleware (HMR) | `express.static` from `dist/public`, same process |
| Secrets | `.env` (gitignored) | Railway → project **Homiquity** → service **Homiquity** → **Variables** |
| Sessions | Postgres `sessions` table | same |
| Files | GCS (same bucket unless you split) | GCS |

`www.homiquity.com` is the canonical host — Squarespace DNS points `CNAME www` at the
service's `*.up.railway.app` target. The apex `homiquity.com` is **not** on Railway:
Railway needs CNAME flattening/ALIAS at the apex and Squarespace does not offer it, so the
apex still serves a Squarespace parked page. Use the `www.` host in every check, script,
and link.

**Runtime vs build-time variables:** most variables are read at runtime, so changing one
and restarting is enough. **`VITE_*` variables are the exception** — Vite bakes them into
the client bundle at build time, so changing `VITE_PRELAUNCH_GATED` (or any `VITE_*`)
requires a **redeploy/rebuild**, not a restart. A rollback restores the image *and* the
variables it was deployed with.

## Operational checks

- **Health**: `GET /api/health` → `{status, timestamp, commit}`, or 503 when the DB is
  unreachable. First thing to curl when anything looks wrong — and **after every
  production deploy**:
  ```bash
  curl -sS https://www.homiquity.com/api/health   # compare `commit` to `git rev-parse origin/main`
  ```
  Read it with both eyes open: the handler only runs `SELECT 1`, so a 200 proves *a*
  database answered, not the **right** one. On 2026-08-06 Railway's `DATABASE_URL` was
  pointed at a stale Neon branch (28 of 53 migrations, no writes since 07-15) — `/api/health`
  stayed 200 while `/api/articles` and `/sitemap.xml` 500'd. When health is green but real
  endpoints fail, suspect the database URL
  ([CICD.md](../../runbooks/CICD.md) §Post-deploy health check,
  [ROLLBACK.md](../../runbooks/ROLLBACK.md) §0).
- **Logs**: Railway → project **Homiquity** → service **Homiquity** → **Deployments** →
  open a deployment for its build and deploy logs (the server's `log()` output goes to
  stdout); `railway logs` does the same from a linked checkout. Sensitive response bodies
  are already suppressed.
- **Rollback**: Railway → service → **Deployments** → ⋯ → **Rollback** restores that image
  *and its variables* with no rebuild. `railway redeploy` is **not** a rollback (it
  rebuilds the latest — i.e. broken — commit) and `railway restart` only reuses the current
  image. Image retention is limited (72h on Hobby), so confirm your target is still in the
  window. Full procedure: [ROLLBACK.md](../../runbooks/ROLLBACK.md).
- **Schema changes reach prod automatically**: the `migrate-prod` CI job applies
  pending hand-authored `migrations/00NN_*.sql` on every merge to `main` (Neon DIRECT URL
  minted at run time from `NEON_API_KEY`). **Never `db:push`** (drops other branches'
  columns, no rollback), never hand-apply, never insert journal rows manually.
  Contract migrations need the read-only CI prod probe *before* authoring;
  snapshot/branch Neon first if the change is destructive. Full flow:
  [DB_MIGRATIONS.md](../../runbooks/DB_MIGRATIONS.md) (+ pre-flight in
  [03-database.md](./03-database.md)); ledger it in [CICD.md](../../runbooks/CICD.md).
- **Seeding**: happens automatically at boot, idempotent (existence-checked).
- **Scheduled jobs** live in **GitHub Actions**, not the host:
  [`.github/workflows/cron-jobs.yml`](../../../.github/workflows/cron-jobs.yml) curls
  `/api/jobs/*` with `Authorization: Bearer $CRON_SECRET` (each job is also
  admin-triggerable, and the workflow has a `workflow_dispatch` lever). It is **the**
  scheduler — the platform cron block it once mirrored was deleted at the Railway cutover,
  so a schedule removed or mistyped there is a sweep that silently never runs again.
  `CRON_SECRET` must be identical in two places: the GitHub **repository secret**
  (Settings → Secrets and variables → Actions) and the **Railway service variable**.
  Schedules: `/api/jobs/lifecycle` daily 13:00 UTC (refi/equity scans, graduation) ·
  `/api/jobs/rate-lock-alerts` daily 12:00 (expiring-lock sweep, #99) ·
  `/api/jobs/letter-expiry` daily 12:30 · `/api/jobs/adverse-action-delivery` daily 14:00
  (ECOA 30-day watchdog) · `/api/jobs/task-escalation` daily 13:45 ·
  `/api/jobs/aggregate-data` Mondays 11:17 (anonymized cohort aggregation, OPT-9).
- **Features that used to be the platform's** are now in-process Express middleware and
  are therefore yours to debug: bot prerender in
  [`server/prerender.ts`](../../../server/prerender.ts) (mounted directly ahead of the
  static layer) and the private-beta gate in
  [`server/middleware/betaGate.ts`](../../../server/middleware/betaGate.ts) (armed by
  `BETA_ACCESS_CODE`, read per request — so arming/disarming it is a runtime variable
  change, not a rebuild).

## Single-process notes (accepted trade-offs, revisit as traffic grows)

1. **Rate limiting is per-process** (in-memory store). At the current 1 replica that is
   effectively a global limit; **scaling to more than one replica silently weakens every
   limit** by the replica count. Add a shared store (e.g. Redis) *before* scaling out.
2. **Boot cost is paid once per deploy, not per request.** The persistent process re-runs
   app wiring and the seed existence checks (~6 SELECTs) at startup; `healthcheckPath`
   gates the traffic switch until `/api/health` answers, so a slow boot delays a deploy
   rather than a user request.
3. **No WebSocket server** in the app (the `ws` dependency is only the Neon driver's
   client). The persistent host no longer *forbids* realtime the way serverless did, but
   nothing implements it — and with more than one replica any such feature would need
   sticky sessions or an external broker.
4. **PDF generation** (pdfkit) — the esbuild bundle is `--packages=external`, so fonts and
   assets resolve from `node_modules` at runtime; exercise letter generation after any
   change to the build or the dependency set.

## Quality checks — what CI enforces vs. what stays manual

The required `gate` check already enforces `pnpm check`, `pnpm test` (node +
client component suites), a blocking `pnpm audit --prod --audit-level=high`,
`pnpm guard:schema`, `pnpm guard:tokens` (the design-token ratchet, gated
2026-07-19), a full `pnpm build`, and — because a green build is not a green boot — an
actual **boot of `dist/index.js` against a real Postgres** until `/api/health` answers 200
([CICD.md](../../runbooks/CICD.md) §Checks). Still **manual — CI never runs these**:

```bash
TEST_BASE_URL=http://127.0.0.1:5001 pnpm test:integration   # needs a running dev server
pnpm build                                                  # prove the prod build compiles
```
