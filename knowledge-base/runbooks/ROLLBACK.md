# Rollback Runbook

Every change to Homiquity must be reversible. There are three independent layers
you may need to roll back — **the running deployment**, **the code in git**, and
**the database schema**. They are separate; rolling back one does not roll back
the others.

> TL;DR for a bad production deploy: **roll back the Vercel deployment first**
> (seconds, instant), then fix the code in git at your own pace. Only touch the
> database if the bad change included a schema migration.

---

## 1. Roll back the live deployment (Vercel) — fastest

Vercel keeps every previous deployment. Promoting an older one is instant and
does **not** require a rebuild or a git change.

### Via the dashboard (recommended under pressure)
1. Vercel → the Homiquity project → **Deployments**.
2. Find the last known-good deployment (green, older timestamp).
3. **⋯ menu → Promote to Production** (a.k.a. "Rollback").
4. Production traffic switches to that deployment immediately.

### Via the CLI
```bash
npm i -g vercel            # once
vercel login
vercel ls                  # list deployments, copy the good deployment URL
vercel promote <deployment-url>   # or: vercel rollback
```

This is the primary lever for "prod is broken, fix it NOW." It buys you time to
do the git/database steps calmly.

---

## 2. Roll back the code (git)

The deployment rollback above changes what's *live* but not what's on `main`.
The next push to `main` will redeploy `main`, so you must also fix the code.

**Always prefer `git revert` over `git reset --hard` + force-push** — revert is
append-only and won't fight other clones (Replit, teammates, CI).

Undo one bad commit (keeps history):
```bash
git revert <bad-sha>
git push origin main
```

Undo a range / several commits:
```bash
git revert --no-commit <old-good-sha>..HEAD
git commit -m "revert to known-good state"
git push origin main
```

Restore a single file from an older commit:
```bash
git checkout <good-sha> -- path/to/file.tsx
git commit -m "restore file to <good-sha>"
git push origin main
```

Just look at an old version without changing anything:
```bash
git checkout <sha>      # detached HEAD, read-only
git checkout main       # come back
```

### Tag releases you may want to return to
Tag before every production deploy so rollback targets are obvious:
```bash
git tag -a rel-2026-07-02 -m "prod deploy"
git push origin rel-2026-07-02
# later, to roll the code back to that tag:
git revert --no-commit rel-2026-07-02..HEAD && git commit -m "roll back to rel-2026-07-02"
git push origin main
```

---

## 3. Roll back the database (careful — not automatic)

The app uses Drizzle with **versioned migrations** (`migrations/`, applied with
`npm run db:migrate`). Schema changes are committed SQL files, so every change
is reviewable and reproducible — but Postgres migrations still have no
automatic "down". Reverting code does **not** revert schema changes.

The workflow for a schema change (canonical: [kb/app-guide/03-database.md](../handbook/app-guide/03-database.md)):
1. Edit `shared/schema/*.ts`.
2. **Hand-author** the SQL in a new `migrations/00NN_<name>.sql` — **never
   `drizzle-kit generate`** (snapshot drift in this repo). Review it like code
   (especially any `DROP`/`ALTER ... TYPE`).
3. `npm run db:migrate` — applies pending migrations to `DATABASE_URL`. **Never
   `npm run db:push`**: it has no down-migration and, against the shared dev DB,
   drops columns belonging to other branches.
4. Commit the migration file together with the schema change. Production applies
   are founder-supervised — the Neon pooler breaks `db:migrate` against prod, so
   apply via a direct `pg` client and insert the migrations-journal row manually
   (snapshot Neon first if the change is destructive).

Rules of thumb:
- **Additive changes** (new nullable column, new table) are safe to leave in
  place even after a code rollback — old code ignores them.
- **Destructive changes** (dropped/renamed column, type narrowing) are the
  dangerous ones. These need a real backup to recover data.

Before any schema change that drops or rewrites data:
1. **Snapshot the database first.**
   - Neon: use the console's **branch/restore** (point-in-time) feature to create
     a restore point, or take a branch before the migration.
   - Self-hosted Postgres: `pg_dump "$DATABASE_URL" > backup-$(date +%F).sql`
2. Apply the schema change.
3. If you must roll back: restore the Neon branch / `psql "$DATABASE_URL" < backup.sql`.

---

## 4. Emergency checklist (prod is down)

1. **Stop the bleeding:** promote the last good Vercel deployment (§1). Confirm
   the site recovers.
2. **Identify the bad change:** `git log --oneline -20` and the Vercel deploy logs.
3. **Fix forward or revert:** `git revert` the bad commit(s) and push (§2).
4. **Database:** only if the bad change ran a destructive migration — restore
   from the snapshot taken before it (§3).
5. **Verify:** the new Vercel deploy is green, the site loads, and a smoke test
   of the broken flow passes.
6. **Write it down:** note what broke and why in the PR / an incident note so the
   next person isn't surprised.

---

## Related docs
- [CICD.md](./CICD.md) — how deploys happen (push → Vercel).
- [LOCAL_DEV.md](./LOCAL_DEV.md) — local setup, env vars, `npm run save`/`sync`.
