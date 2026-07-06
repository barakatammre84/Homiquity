# Deploy & Revert

Homiquity ships with a deliberately simple flow: **push to `main` → Vercel
deploys it. If it breaks, revert.** No approvals.

```
  git push (main)  ──▶  Vercel builds & deploys automatically
        │                     │
        ▼            broken?  ▼
  GitHub Actions    Vercel → Deployments → previous one → Promote  (instant)
  (planned — not
   on main yet,
   see below)
```

**CI status (corrected 2026-07-04): there is no CI on `main` today** — `.github/`
does not exist there, so nothing runs on push; all checks are manual (see
"Optional checks" below). A finished non-blocking workflow (`ci.yml`:
typecheck, unit tests, build, lockfile parity) is authored and waiting on local
branch `claude/inspiring-faraday-86b6b2` (commit `4fa08ad`), but the automation
GitHub token lacks the `workflow` scope, so **a human must push/merge it from a
normally-authenticated environment** (roadmap #5). Once landed it is
informational only — a red run marks the commit but the deploy still goes out.
To make it a hard gate later: GitHub → Settings → Branches → protect `main`,
require the `ci` check (this also blocks direct pushes, so `npm run save`
would move to a PR flow).

## Shipping

```bash
npm run save        # commit everything with a timestamp + pull + push
# or, if you've already committed:
npm run sync        # pull + push
```

Every push to `main` triggers a production deploy on Vercel. Every PR branch
gets its own preview deployment automatically.

## Reverting

Full detail in [ROLLBACK.md](ROLLBACK.md). Short version:

- **Prod is broken right now** → Vercel dashboard → Deployments → pick the last
  good one → **Promote to Production**. Instant, no rebuild.
- **Undo the bad code** → `git revert <sha> && git push` (never
  `reset --hard` + force-push).
- **Database** → schema changes ship as versioned migration files
  (`migrations/`, `npm run db:generate` + `npm run db:migrate` — see
  [ROLLBACK.md](ROLLBACK.md) §3). Still snapshot/branch in Neon before
  destructive schema changes; migrations have no automatic "down".

## How the Vercel deploy works

- `vercel.json` — install is `pnpm install --frozen-lockfile --prod=false`,
  build is `npm run vercel-build` (= `vite build` **plus** an esbuild bundle of
  the server into `api/_app.mjs`) → static client from `dist/public`; rewrites
  send `/api/*` to the serverless function `api/index.ts`, everything else
  falls back to the SPA `index.html`.
- **The function imports the pre-bundled `api/_app.mjs`, never the raw TS
  server graph.** Server code uses the `@shared/*` tsconfig alias, which
  Vercel's file tracer/Node runtime can't resolve (this produced opaque
  `FUNCTION_INVOCATION_FAILED` crashes); esbuild resolves the alias at build
  time. The handler imports the bundle *dynamically* so any bootstrap failure
  returns a readable `bootError` JSON instead of an opaque crash. Two more
  serverless rules learned the hard way: never construct SDK clients at module
  load (the OpenAI client throws without a key — build them lazily), and never
  write to the filesystem at module load (only the OS temp dir is writable).
- **Why pnpm on Vercel (do not switch back to npm casually):** npm crashed
  mid-install on Vercel's build image with "Exit handler never called" on
  Node 20, 22 AND 24 (reproduced four deploys in a row), while the identical
  install works locally. pnpm sidesteps npm entirely. `--prod=false` is
  required because Vercel sets `NODE_ENV=production`, which makes pnpm skip
  devDependencies — and vite (a devDependency) is needed to build.
- **Two lockfiles now exist.** Local dev can keep using npm
  (`package-lock.json`); Vercel uses `pnpm-lock.yaml` (generated via
  `pnpm import`, so versions match npm's exactly). **After any dependency
  change, run `npx pnpm@10 import` and commit both lockfiles together.**
- `engines.node: 24.x`; `.npmrc` disables audit/fund noise.
- Env vars (Vercel → Settings → Environment Variables): `DATABASE_URL` (Neon,
  non-localhost), `SESSION_SECRET`, `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`,
  `NODE_ENV=production`, plus optional `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`,
  `OPENAI_API_KEY`, and for document storage `GCS_SERVICE_ACCOUNT_KEY`,
  `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` (see `.env.example`).

Persistent hosts (Fly, a VPS) still work unchanged: `npm run build` +
`npm start`.

## Private beta gate (invite-link access)

Root-level `middleware.ts` is a Vercel **Edge Middleware** that locks the whole
site (every route except `/api/*`) behind invite links while the
`BETA_ACCESS_CODE` env var is set in Vercel. Tests live in
`tests/betaGate.test.ts`.

- **Turn on:** Vercel → Settings → Environment Variables → add
  `BETA_ACCESS_CODE` (Production) with one or more comma-separated codes, e.g.
  `hq-beta-7f3k2m` — then redeploy. Generate codes with `openssl rand -hex 4`
  or pick memorable phrases; avoid guessable words.
- **Invite testers:** send `https://<host>/?beta=<code>`. Opening it sets a
  90-day HttpOnly cookie (the SHA-256 of the code, so the raw code never sits
  in the browser) and redirects to a clean URL. Visitors without a code get a
  401 lock screen with a code-entry form.
- **Revoke a group:** remove that group's code from the env var and redeploy —
  its cookies stop validating immediately.
- **Turn off (public launch):** delete `BETA_ACCESS_CODE` and redeploy. The
  middleware becomes a no-op; nothing else to remove.
- **SEO while gated:** `/robots.txt` answers `Disallow: /` and every gate
  response carries `X-Robots-Tag: noindex`, so the beta never gets indexed.
  When the gate is off, the static `client/public/robots.txt` (allow-all)
  serves instead.
- **Why `/api/*` is exempt:** Vercel cron invocations and webhooks carry no
  browser cookie (they authenticate via `CRON_SECRET` / webhook secrets), and
  API routes already sit behind app auth. The gate is a privacy screen for the
  beta, not a security boundary — real access control stays in the app.
- Edge Middleware only runs on Vercel; `npm run dev` and local prod builds
  never execute it.

## Optional checks (run manually, nothing enforces them)

```bash
npm run check              # typecheck
npm run test:unit          # pure logic tests (no server needed)
TEST_BASE_URL=http://127.0.0.1:5001 npm run test:integration   # against a running dev server
```

If you later want gates again (block bad pushes before they deploy), add a
GitHub Actions workflow that runs the commands above and enable branch
protection — but that's a deliberate future choice, not the current setup.

## Production change ledger (append-only)

Every push to `main` (it deploys) and every action against the production database or its
env vars gets a row here **in the same session** — newest first
([TEAM_PRACTICES](kb/TEAM_PRACTICES.md) §6). Never rewrite or delete rows; corrections get a
new row. Each row: what shipped · prod DB/env actions (and how) · validation evidence ·
rollback pointer.

| Date | Change | Prod DB / env | Validation | Rollback |
|---|---|---|---|---|
| 2026-07-05 | Close-out push `049a7fc→809eb7c`: PR #52 (docs SDLC) + PR #51 (LS-10 slice 2 — lender MISMO package assembly). Includes this ledger row (docs follow-up). PR #53/#54 (overlapping pre-launch gates) held for coordination. | ⛔ **Migration `0009` (lender_submissions package columns) PENDING on prod** — founder-supervised `npm run db:migrate`; idempotent `ADD COLUMN IF NOT EXISTS`, and the write path is F1-gated so not urgent, but must precede any real lender submission | 656 unit + 73 integration green pre-push; server boot + `/api/health` 200 on :5002 | [ROLLBACK.md](ROLLBACK.md) §1; `git revert -m 1 809eb7c` isolates the two PRs |
| 2026-07-04 (evening) | Launch-integration batch: 13 PRs (#37, #39–#50) merged to `main` in one founder-authorized push | none (migrations 0005–0008 already applied) | 647 unit + 73 integration tests green pre-push | [ROLLBACK.md](ROLLBACK.md) §1–2 |
| 2026-07-04 | PR #38 — GSE delivery engines (SFC/QM/edit mirror), broker submission workflow, lender submissions, dual-AUS | Migrations 0005–0008 applied via direct `pg` client + manual journal insert (Neon pooler breaks `npm run db:migrate` — see the known-traps index in [TEAM_PRACTICES](kb/TEAM_PRACTICES.md) §5) | Deploy verified live post-migration | [ROLLBACK.md](ROLLBACK.md) §1, §3 |
| ≤ 2026-07-04 | Baseline — everything before this ledger existed: migrations `0000`–`0004` and all prior deploys | Verified applied/live in the 2026-07-04 source-of-truth audit | [ASSUMPTIONS.md](ASSUMPTIONS.md) §4 | — |
