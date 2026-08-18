# Running Homiquity locally (Antigravity / any terminal)

The whole app runs on your machine. Only Postgres is a managed service — the free
tier of Neon costs nothing, so this is a $0 local setup.

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
1. Install Postgres — Postgres.app on Mac, or Docker. **Use the script, not a raw `docker run`:**
   ```bash
   pnpm db:start
   ```
   It is `docker start homiquity-db 2>/dev/null || docker run -d --name homiquity-db …postgres:16`
   — the `docker start` fast path is what makes it safe to run again. A bare `docker run` a second
   time fails with a name conflict on `homiquity-db`, which reads like a broken setup and isn't.
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
echo "SESSION_SECRET=$(openssl rand -hex 32)"          # see the warning below — do not skip this one
echo "CREDIT_ENCRYPTION_KEY=$(openssl rand -base64 32)"
echo "PII_HASH_SALT=$(openssl rand -hex 32)"
```
Paste those lines into `.env`, add your `DATABASE_URL`, and (optionally) a
`ANTHROPIC_API_KEY` for AI features (or `EXTRACTION_SIMULATE=true`) and a `DEV_TEST_PASSWORD` for the dev login.

> ⚠️ **Only one of those three is actually required locally, and it is the one that fails silently.**
>
> - **`SESSION_SECRET` — mandatory.** Its boot-time guard is production-only
>   ([`server/integrations/auth/session.ts`](../../server/integrations/auth/session.ts)), and the
>   value is then passed to express-session regardless. Measured on a real boot with it blank:
>   the server **starts with no error and logs `serving on port 5001`**, `GET /health` still returns
>   `{"status":"ok"}` because it is mounted above the session middleware — and **everything else,
>   the homepage included, returns 500 `secret option required for sessions`.** express-session only
>   checks per request, so there is no boot-time signal at all; the first symptom is a dead site with
>   a healthy-looking process. If you see that error, this is why.
> - **`CREDIT_ENCRYPTION_KEY` and `PII_HASH_SALT` — optional in dev.** Both fall back silently
>   outside production ([`encryptionService.ts:52`](../../server/services/encryptionService.ts) and
>   `:536`); `assertEncryptionConfig()` returns early when `NODE_ENV !== "production"`. Set them
>   anyway — they cost one command — but their absence will not break your local run.
>
> Set all three regardless: `pnpm build && pnpm start` runs in production mode, where **all three do
> throw at boot** (`SESSION_SECRET` needs ≥32 chars). That is the cheapest way to catch a prod
> config gap before a deploy rather than after one — see §8 for the one extra step it needs.

**Leave `CREDIT_VENDOR_API_KEY` unset.** It is a *provenance stamp*, not a connection setting —
setting it flips `isSimulated` to false on regulated credit records. `.env.example` says so at
length; believe it.

## 5. Create the tables
```bash
pnpm db:migrate
```
Fresh databases are built from the committed migration files in `migrations/`.
If your database was created earlier with `db:push`, adopt it once with
`pnpm db:migrate:adopt -- --apply` (records existing migrations as applied
without re-running them). Schema-change workflow: [ROLLBACK.md](./ROLLBACK.md) §3.

**This step is not optional if you want to log in.** The session store runs with
`createTableIfMissing: false`, and the `sessions` table comes from `migrations/0000_baseline.sql` —
so an unmigrated database gives you a running server that cannot hold a login.

You do **not** need `pnpm db:seed`. The server seeds itself idempotently on every boot
(`server/routes.ts`), so the seed is a warm-up, not a prerequisite. It does now read your `.env` if
you want to run it by hand.

## 6. Run it
```bash
pnpm dev
```
Open http://localhost:5001. Edits hot-reload.

**On the port:** nothing in the code defaults to 5001 — [`server/app.ts`](../../server/app.ts) falls
back to `5000`. You land on 5001 because `.env.example` ships `PORT=5001` and you copied it in step 4.
If you land on 5000, your `.env` is missing that line; either add it or run `PORT=5001 pnpm dev`.
The convention exists because macOS AirPlay squats on 5000 and answers with an HTTP 403 that looks
like a broken app. Worktree test servers use 5002+.

**Prove the wiring before you go hunting bugs:**
```bash
curl -s localhost:5001/api/health
```
`{"status":"ok",…}` means the app reached Postgres. A **503** means it didn't — that endpoint runs a
real `SELECT 1`. (`GET /health`, without the `/api`, is pure liveness and answers even when the
database is down, so it is not evidence of anything except that the process is up. `commit` is
`null` locally; Railway injects it in production.)

**If it looks like it hangs:** a throw inside `createApp()` is only *logged* by the
`unhandledRejection` handler — `server.listen()` is never reached and the process stays alive with
nothing bound to the port. It is a config error two screens up in the log, not a hang.

**One alarming-looking log line on a fresh database is expected.** During the boot seed you will see
a stack trace containing `CRITICAL COMPLIANCE ERROR: Required matrix configuration [FANNIE_LLPA] is
missing, expired, or not active`, from `syncBestExecutionRates`. It is non-fatal — the seed
continues, prints `Database seeded successfully`, and the server binds. A fresh local database has
no LLPA matrix rows, so best-execution pricing has nothing to price against. Nothing else depends on
it for a click-through.

## 6a. Beta-test it — logging in and clicking through

Set `DEV_TEST_PASSWORD=<anything>` in `.env`, then open **http://localhost:5001/test-login**, type
that password once, and click a role card. There are **eleven seeded accounts**, all `@test.com`,
sharing that one password ([`server/auth.ts`](../../server/auth.ts)):

| Staff | Partner | Borrower |
|---|---|---|
| `admin@` · `lo@` · `loa@` · `processor@` · `underwriter@` · `closer@` | `broker@` · `lender@` · `cpa@` | `renter@` (aspiring owner) · `buyer@` (active buyer) |

Login **upserts** the user, so these self-heal after a database reset — you never have to re-seed to
get back in. `DEV_TEST_PASSWORD` unset gives a **503**, not a 401; a wrong password gives the 401.
The route is registered only outside production (it returns a flat 404 in prod), and it is
rate-limited to 20 attempts per 15 minutes. Fuller notes: [TEST_ACCOUNTS.md](./TEST_ACCOUNTS.md).

**What genuinely does not work locally** — these are environment gaps, not bugs, and each will look
like a broken feature if you don't know:

| Surface | Behaviour without credentials | Workaround |
|---|---|---|
| Document upload / download | fails — object storage needs real `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` | none; there is no simulation path |
| Plaid (asset/income linking) | throws `Plaid is not configured` ([`server/plaid.ts`](../../server/plaid.ts)) | none; contained to Plaid routes |
| Document extraction / AI Coach | coach degrades to labelled offline guidance | `EXTRACTION_SIMULATE=true` for a deterministic extraction path |
| Outbound email | printed to the console, and `sendEmail()` still reports success | none needed — this is the desired local behaviour |
| Maps | degrade without `GOOGLE_MAPS_API_KEY` | optional |

Credit, AVM and GSE vendors are deterministic simulations by design, so those paths work fully
offline — that is the architecture, not a local limitation.

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

⚠️ **`pnpm start` does not read `.env`.** Only the dev entrypoint loads it —
`server/index-dev.ts` opens with `import "./load-env"`, and `server/index-prod.ts` deliberately does
not, because Railway injects its variables from the service config. So running the production bundle
**on your own machine** dies immediately with
`Error: DATABASE_URL must be set. Did you forget to provision a database?` even when your `.env` is
perfect. Export it first, the same idiom the integration tests use:

```bash
pnpm build
set -a; . ./.env; set +a          # .env is not read by the prod entrypoint
PORT=5055 pnpm start              # a spare port, so it can run beside `pnpm dev`
curl -s localhost:5055/api/health
```

Worth doing before any deploy: production mode arms the throws dev skips (`SESSION_SECRET` ≥32
chars, `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`), and CSRF is enforced — `/api/test-login` answers
**403** there rather than the dev 200, which is the gate working, not a bug.
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
