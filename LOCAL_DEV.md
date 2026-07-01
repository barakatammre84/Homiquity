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

### Option B (fully offline): local Postgres
The default driver (`@neondatabase/serverless`) talks over WebSockets and does NOT
connect to a plain local Postgres. To go fully local you must switch the driver:
1. Install Postgres (Postgres.app on Mac, or `docker run -e POSTGRES_PASSWORD=pass -p 5432:5432 postgres`).
2. Ask me to add the local-Postgres driver branch to `server/db.ts` (a small,
   env-gated change that uses `pg` for `localhost` URLs and Neon otherwise). It
   needs `npm run check` to confirm types — that's why it's opt-in, not default.
3. `DATABASE_URL=postgresql://postgres:pass@localhost:5432/homiquity`

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

## GitHub as backup
```bash
git add -A && git commit -m "..." && git push origin main
```
If you also push from Replit, always `git pull` before pushing to avoid diverging.

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
