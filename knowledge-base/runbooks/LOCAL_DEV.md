# Running Homiquity locally (Antigravity / any terminal)

The whole app runs on your machine, database included.

## Quick start — one command *(added 2026-08-18)*

```bash
pnpm dev:up        # provisions a local Postgres, writes .env, migrates, seeds, serves :5001
```

Measured cold on a clean clone with no `.env` and no database: **15 seconds** to a healthy
server. It is idempotent — run it as often as you like — and it **never overwrites a value
already in your `.env`**, it only fills in what is missing and prints which keys it added.

```bash
pnpm dev:up down   # stop the server (the database stays up)
pnpm dev:up logs   # tail it
pnpm dev:up status # is it up?
pnpm db:local reset  # rebuild the database from migrations + seed
```

Sign in with any seeded account — `buyer@test.com`, `lo@test.com`, `admin@test.com`,
`underwriter@test.com`, `broker@test.com`, `lender@test.com`, `closer@test.com`,
`cpa@test.com` — password `test1234` (`DEV_TEST_PASSWORD`).

**Why this exists.** `pnpm dev` on a clean checkout dies with `DATABASE_URL must be set` before
it prints anything useful, and the documented fix below is a five-step manual setup. Every step
is easy; the *sequence* is what goes wrong, which is why the server felt like it "had trouble
spinning up" when it actually had trouble being set up, once, correctly. The manual path below
still works and still explains what each piece is for — read it when something breaks.

**No Docker required.** `pnpm db:local` uses whatever is available, in this order: an existing
`DATABASE_URL` → Docker → a plain `pg_ctl` cluster under `$HOME`. Never point it at the shared
dev database: it seeds, and `seedLendingGrids` **wipes and rebuilds the pricing matrices**.

## Before you push — the whole gate, locally

```bash
pnpm preflight            # all 17 checks CI's `gate` job runs — ~2m45s measured
pnpm preflight --fast     # skip build + boot + integration lane (~2 min)
```

`.githooks/pre-push` (install once: `git config core.hooksPath .githooks`) runs the cheap half
automatically on every push — typecheck, ten guards, both test lanes. **`preflight` adds the
three that only ever ran in CI**, and they are the ones that catch a broken *deploy* rather than
a broken diff: the production build, the self-host boot of `dist/index.js`, and the 18-file
integration lane against a real HTTP server.

A stage that cannot run is reported `SKIPPED` with the reason — it never silently passes. And
green preflight is **not** a promise CI is green: it prints what it did not cover, every run.

## Seeing it — a real browser, no dependency added

```bash
node scripts/browser-probe.cjs --url http://localhost:5001/ --width 320 --out /tmp/shot.png
```

Renders in real Chromium and answers what a text scan cannot: horizontal overflow at a given
width, images that failed to load, sub-44px touch targets, controls with no accessible name.
Details and limits: [BROWSER_PROBE.md](./BROWSER_PROBE.md).

---

## The manual path, and what each piece is for

Only Postgres is a managed service if you choose Neon — the free tier costs nothing, so that is
also a $0 setup.

## 1. Prerequisites
- Node.js 24 (`node -v`) — matches the pinned `engines.node` in `package.json` (what Railway builds with)
  - ⚠️ **Keep `engines.node` an exact major (`"24"`), never an npm range like `"24.x"`.** Railway's
    builder (Railpack) resolves the toolchain with mise, which does **not** understand npm range
    syntax; on 2026-08-06 `"24.x"` made nine consecutive Railway builds fail — and because a failed
    Railway deploy leaves the *previous* container serving, the site stayed up and nothing noticed
    for ~8 commits.
- A Postgres database (see step 3)
- `git` and this repo cloned locally

## 2. Install dependencies

pnpm is the package manager (pinned via `packageManager` in `package.json`; it's the only lockfile — `pnpm-lock.yaml` — and what Railway builds with). Activate it once with corepack, which ships with Node:
```bash
corepack enable      # one-time; activates the pinned pnpm
pnpm install
```

## 3. Database — pick one

### Option A (recommended, zero code changes): free Neon database
1. Sign up at https://neon.tech (free tier, no card).
2. Create a project → copy the connection string.
3. Put it in `.env` as `DATABASE_URL` (step 4).

The app already uses Neon's driver, so this Just Works. The app still runs on
your machine — only the database is hosted (and free).

### Option B (fully offline): local Postgres — supported out of the box
`server/db.ts` auto-detects a local database: a `localhost` / `127.0.0.1`
connection string (or `USE_LOCAL_PG=true`) uses the standard `pg` driver; any
other URL uses Neon. No code change needed.
1. Install Postgres — Postgres.app on Mac, or Docker:
   ```bash
   docker run -d --name homiquity-db -e POSTGRES_PASSWORD=pass -e POSTGRES_DB=homiquity -p 5432:5432 postgres:16
   ```
2. In `.env`:
   ```
   DATABASE_URL=postgresql://postgres:pass@localhost:5432/homiquity
   ```
3. `pnpm db:migrate` then `pnpm dev`. That's it — fully offline, $0.

## 4. Create your `.env`
```bash
cp .env.example .env
```
Fill it in. Generate the three secrets:
```bash
echo "CREDIT_ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "PII_HASH_SALT=$(openssl rand -hex 32)"
echo "SESSION_SECRET=$(openssl rand -hex 32)"
```
Paste those lines into `.env`, add your `DATABASE_URL`, and (optionally) a
`ANTHROPIC_API_KEY` for AI features (or `EXTRACTION_SIMULATE=true`) and a `DEV_TEST_PASSWORD` for the dev login.

## 5. Create the tables
```bash
pnpm db:migrate
```
Fresh databases are built from the committed migration files in `migrations/`.
If your database was created earlier with `db:push`, adopt it once with
`pnpm db:migrate:adopt -- --apply` (records existing migrations as applied
without re-running them). Schema-change workflow: [ROLLBACK.md](./ROLLBACK.md) §3.

## 6. Run it
```bash
PORT=5001 pnpm dev
```
Open http://localhost:5001. Edits hot-reload. (Local convention: **5001** — macOS
AirPlay squats on 5000 and answers with an HTTP 403 that looks like a broken app.
Worktree test servers use 5002+.)

## 7. Typecheck and tests before committing
```bash
pnpm check     # TypeScript
pnpm test          # unit suite (no DB or server needed)
```
Integration tests need a running server. Boot it with `RATE_LIMIT_RELAXED=true` — the
suite makes ~30 auth calls, which would otherwise trip the auth rate limiter (20 per
15 min; the flag is ignored in production builds):
```bash
RATE_LIMIT_RELAXED=true PORT=5002 pnpm dev   # in one terminal
set -a; source .env; set +a
TEST_BASE_URL=http://localhost:5002 pnpm test:integration
```

### Run the gate locally — one-time setup, and why it saves money

```bash
git config core.hooksPath .githooks
```

That arms `.githooks/pre-push`, which runs exactly what CI's `gate` job runs —
typecheck, the schema↔migration guard, the design-token ratchet, then the unit
suites — and **refuses the push** if any of them fails. Skip it once with
`git push --no-verify`.

This is a cost control, not a style preference. The repo is private, so Actions
minutes are metered (roadmap KTLO-2). Measured 2026-08-17: **66 CI runs over 4.85
days — ~13.6/day**, one billable `gate` job each at ~4–5 min, so **~1,850
min/month against a 2,000-minute free allowance.** A red gate costs that run *and*
the re-run after the fix, so catching one locally saves about ten minutes of
allowance, not five. Ordered fail-fastest-first: `tsc` is ~25 s and catches the
common break before vitest spends three minutes proving the same thing.

The hooks live in a **tracked** `.githooks/` rather than `.git/hooks` so they
survive a reclone, apply in every worktree, and are visible to review.

`pnpm checkup` remains the heavier pre-PR sweep — it adds the production build,
the dependency audit, the KB/doc/regulatory guards and a prod health probe. The
hook deliberately skips those to stay cheap enough to leave on.

## Landing work on GitHub

`main` is protected — direct pushes are blocked by branch protection and barred
by doctrine; the old `pnpm save`/`pnpm sync` one-command scripts were **removed**
(PR #251). Everything lands as a short-lived branch → PR → `gate` check green →
squash merge ([CICD.md](./CICD.md) §Shipping; verify protection is live before
trusting `--auto` — [TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §6):

```bash
git checkout -b <topic-branch>
git push -u origin <topic-branch>
gh pr create --fill          # the gate runs automatically
gh pr merge --auto --squash --delete-branch   # merges itself when green
```

Local Postgres: `pnpm db:start` starts (or first-time creates) the container.

## Reverting to a previous version

List history (every checkpoint is a commit):
```bash
git log --oneline -20
```

**Undo one bad commit (safest — keeps history):**
```bash
git revert <commit-sha>     # creates a new commit that undoes that one
# …then land it via the PR lane above (see also ROLLBACK.md §2 for prod)
```

**Restore a single file from an older commit:**
```bash
git checkout <commit-sha> -- path/to/file.tsx
git commit -m "restore file to <commit-sha>"   # …then the PR lane
```

**Roll the whole project back to an older state (history-preserving):**
```bash
git revert --no-commit <bad-sha-1> <bad-sha-2> ...   # or a range: <old-sha>..HEAD
git commit -m "revert to known-good state"           # …then the PR lane
```

**Just look around an old version (no changes):**
```bash
git checkout <commit-sha>    # detached HEAD, read-only exploration
git checkout main            # come back
```

Avoid `git reset --hard` + force-push — it rewrites shared history and will
conflict with any other clone. `git revert` gives the same outcome
with a safe, append-only history.

**Tag releases you may want to return to:**
```bash
git tag beta-1 && git push origin beta-1
# later: git revert --no-commit beta-1..HEAD && git commit -m "roll back to beta-1"
```

---

## How production runs it (and the alternatives)

The primary deploy is **Railway** — see [CICD.md](./CICD.md). Production is not a
different program: it is exactly the two commands below, run by Railway on a single
persistent Node process. One Express server serves both the API and the built client
(`express.static` + SPA catch-all) — there is no CDN, no serverless function, no edge
middleware.

**Build/run — locally and on any host:**
```bash
pnpm build          # vite build + esbuild server -> dist/index.js
pnpm start          # NODE_ENV=production node dist/index.js
```
Railway runs precisely these, declared as config-as-code in
[`railway.json`](../../railway.json) (builder `RAILPACK`, build
`pnpm install --frozen-lockfile && pnpm build`, start `pnpm start`, health check
`/api/health`, restart policy `ON_FAILURE`).

Set the same env vars in the host's dashboard (`DATABASE_URL`, `CREDIT_ENCRYPTION_KEY`,
`PII_HASH_SALT`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `PORT`). The host provides
`PORT`; the server already reads it. On Railway these live in **service variables**
(Railway → project `Homiquity` → service `Homiquity` → **Variables**). Note that
`VITE_*` variables are **build-time** — they are compiled into the client bundle, so
changing one requires a **redeploy**, not a restart.

Because the whole thing is "one Express process + Postgres", it stays portable. If
Railway ever has to be left behind, these are equivalent single-web-service hosts —
no code changes, just the same build/start pair and the same env vars:

| Option | Cost | Notes |
|--------|------|-------|
| **Neon (Postgres) + Fly.io** | ~free–$5/mo | Fly's small shared VM + Neon free tier. |
| **Neon + Render** | free tier (spins down) / $7/mo | Simplest dashboard; free tier sleeps when idle. |
| **Cheap VPS (Hetzner / DigitalOcean) + Neon** | $4–6/mo | Most control, cheapest at scale; you manage the box. |

**The app has no host-specific dependencies** — no Replit, and (since the 2026-08-06
migration) no Vercel. It runs on Railway today and can move without code changes.
