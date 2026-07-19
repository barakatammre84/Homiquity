# Running Homiquity locally (Antigravity / any terminal)

The whole app runs on your machine. Only Postgres is a managed service — the free
tier of Neon costs nothing, so this is a $0 local setup.

## 1. Prerequisites
- Node.js 24.x (`node -v`) — matches the pinned `engines.node` in `package.json` (what Vercel builds with)
- A Postgres database (see step 3)
- `git` and this repo cloned locally

## 2. Install dependencies

pnpm is the package manager (pinned via `packageManager` in `package.json`; it's the only lockfile — `pnpm-lock.yaml` — and what Vercel builds with). Activate it once with corepack, which ships with Node:
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

## Landing work on GitHub

`main` is protected — direct pushes are rejected by branch protection, so the old
`pnpm save`/`pnpm sync` one-command scripts are **dead** (they die on the push
step). Everything lands as a short-lived branch → PR → required `gate` check →
squash merge ([CICD.md](./CICD.md) §Shipping):

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

## Alternative low-cost hosts (the primary deploy is Vercel — see CICD.md)

This is one Express server + Postgres, so host it as a single web service:

| Option | Cost | Notes |
|--------|------|-------|
| **Neon (Postgres) + Fly.io** | ~free–$5/mo | Fly's small shared VM + Neon free tier. Good default. |
| **Neon + Render** | free tier (spins down) / $7/mo | Simplest dashboard; free tier sleeps when idle. |
| **Neon + Railway** | ~$5/mo credit | Easy Git deploys. |
| **Cheap VPS (Hetzner / DigitalOcean) + Neon** | $4–6/mo | Most control, cheapest at scale; you manage the box. |

**Build/run for any host:**
```bash
pnpm build          # vite build + esbuild server -> dist/
pnpm start              # NODE_ENV=production node dist/index.js
```
Set the same env vars in the host's dashboard (`DATABASE_URL`, `CREDIT_ENCRYPTION_KEY`,
`PII_HASH_SALT`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `PORT`). The host provides
`PORT`; the server already reads it.

**The app has no Replit dependencies** — it deploys to Vercel today (see
[CICD.md](./CICD.md)) and can move to any of the hosts above without code changes.
