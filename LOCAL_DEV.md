# Running Homiquity locally (Antigravity / any terminal)

The whole app runs on your machine. Only Postgres is a managed service — the free
tier of Neon costs nothing, so this is a $0 local setup. Replit is optional.

## 1. Prerequisites
- Node.js 20+ (`node -v`)
- A Postgres database (see step 3)
- `git` and this repo cloned locally

## 2. Install dependencies
```bash
npm install
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
3. `npm run db:push` then `npm run dev`. That's it — fully offline, $0.

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
`GEMINI_API_KEY` for AI features and a `DEV_TEST_PASSWORD` for the dev login.

## 5. Create the tables
```bash
npm run db:push
```

## 6. Run it
```bash
npm run dev
```
Open http://localhost:5000. Edits hot-reload.

## 7. Typecheck before committing
```bash
npm run check
```

## GitHub sync — one-command workflows

```bash
npm run save   # commit everything with a timestamp + pull + push (daily driver)
npm run sync   # just pull + push (when you've already committed)
npm run db:start  # start (or first-time create) the local Postgres container
```

`save` is the "back everything up now" button: stages all changes, commits with a
timestamped message, pulls any remote changes (merge, no editor), and pushes.
If you also push from Replit, `sync`/`save` handle the pull-before-push for you.

## Reverting to a previous version

List history (every checkpoint is a commit):
```bash
git log --oneline -20
```

**Undo one bad commit (safest — keeps history):**
```bash
git revert <commit-sha>     # creates a new commit that undoes that one
npm run sync
```

**Restore a single file from an older commit:**
```bash
git checkout <commit-sha> -- path/to/file.tsx
npm run save
```

**Roll the whole project back to an older state (history-preserving):**
```bash
git revert --no-commit <bad-sha-1> <bad-sha-2> ...   # or a range: <old-sha>..HEAD
git commit -m "revert to known-good state"
npm run sync
```

**Just look around an old version (no changes):**
```bash
git checkout <commit-sha>    # detached HEAD, read-only exploration
git checkout main            # come back
```

Avoid `git reset --hard` + force-push — it rewrites shared history and will
conflict with Replit or any other clone. `git revert` gives the same outcome
with a safe, append-only history.

**Tag releases you may want to return to:**
```bash
git tag beta-1 && git push origin beta-1
# later: git revert --no-commit beta-1..HEAD && git commit -m "roll back to beta-1"
```

---

## Low-cost deployment (beta) — cheaper than Replit

This is one Express server + Postgres, so host it as a single web service:

| Option | Cost | Notes |
|--------|------|-------|
| **Neon (Postgres) + Fly.io** | ~free–$5/mo | Fly's small shared VM + Neon free tier. Good default. |
| **Neon + Render** | free tier (spins down) / $7/mo | Simplest dashboard; free tier sleeps when idle. |
| **Neon + Railway** | ~$5/mo credit | Easy Git deploys. |
| **Cheap VPS (Hetzner / DigitalOcean) + Neon** | $4–6/mo | Most control, cheapest at scale; you manage the box. |

**Build/run for any host:**
```bash
npm run build          # vite build + esbuild server -> dist/
npm start              # NODE_ENV=production node dist/index.js
```
Set the same env vars in the host's dashboard (`DATABASE_URL`, `CREDIT_ENCRYPTION_KEY`,
`PII_HASH_SALT`, `SESSION_SECRET`, `GEMINI_API_KEY`, `PORT`). The host provides
`PORT`; the server already reads it.

**Recommendation for beta:** Neon (free Postgres) + Fly.io or Render. Point your
GitHub repo at it for auto-deploy on push. Migrate off Replit entirely — nothing
in the app depends on Replit except optional integrations under
`server/replit_integrations/` (object storage / auth), which you can swap later.
