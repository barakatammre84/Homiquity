# DB Migrations — schema-gated, auto-applied to prod

**Authority:** this runbook is the *how*; the binding rule is [CLAUDE.md](../../CLAUDE.md) §Database
("Schema changes are migration-gated and auto-applied to prod"). Where they disagree, CLAUDE.md wins.

## Why this exists

Prod is **migrate-only** (it is never `db:push`-ed). Two ways a schema change breaks prod, and
both have happened here:

- **Schema without a migration** — a column added to `shared/schema` via `db:push` (dev-only) but
  never captured in `migrations/*.sql`. Prod never gets the column; every `select` of the table
  500s. (Root cause of the 2026-07-13 outage — migration 0027.)
- **Migration never applied** — the `migrations/*.sql` file exists, but nobody ran it against prod.
  The code deploys expecting the new shape; prod DB is behind. (Migration 0026.)

The pipeline below makes both mechanically impossible to ship.

## The pipeline

```
PR touches shared/schema/**
        │
        ▼
  gate job (.github/workflows/ci.yml, on: pull_request)
    pnpm check · pnpm test · pnpm guard:schema   ← schema-without-migration ⇒ RED, cannot merge
        │  green
        ▼
   merge to main  (auto-merge-green policy)
        │
        ▼
  migrate-prod job (.github/workflows/ci.yml, on: push to main)
    node scripts/migrate-prod.cjs  →  applies pending migrations to PROD (Neon DIRECT url)
```

- **Author-time gate:** [`scripts/schema-migration-guard.cjs`](../../scripts/schema-migration-guard.cjs)
  fails if a column declared in `shared/schema/*.ts` appears in no `migrations/*.sql`.
- **Deploy-time apply:** [`scripts/migrate-prod.cjs`](../../scripts/migrate-prod.cjs) applies pending
  migrations over a plain `pg` client (NOT the Neon serverless pool — that has the pooler gotcha).
  Idempotent: a no-op when nothing is pending, safe to re-run on every merge.

## One-time setup (done in GitHub — not by Claude, involves a prod credential)

1. **Add the secret.** Repo → Settings → Secrets and variables → Actions → New repository secret:
   - Name: `PROD_DATABASE_URL`
   - Value: the Neon **DIRECT (unpooled)** connection URL with `sslmode=require`
     (the host **without** the `-pooler` suffix). The pooled URL will not migrate reliably.
   Until this secret exists, the `migrate-prod` job fails loudly on merge (visible in Actions) —
   by design, so a missing config is never a silent slip.
2. **Make the gate binding.** Settings → Branches → branch protection on `main` → require the
   `gate` status check to pass before merge. Without this, "green" is advisory and auto-merge could
   merge a red PR.
3. **Pre-flight the first auto-run (mandatory).** Pending-detection is journal-based (hash OR
   `created_at`). Before trusting the auto-job, confirm the first run is a clean no-op against
   prod's actual journal:
   ```
   DATABASE_URL=<prod-direct-url> pnpm db:migrate:prod --dry-run
   ```
   It must report **"up to date — no pending migrations"** (prod is already at the current
   migration HEAD). If instead it lists migrations prod already has (journal drift from the
   old raw-pg apply recipe), reconcile the journal first — `tsx server/scripts/markMigrationsApplied.ts --apply`
   against prod — then re-run the dry-run until it's clean. Only then let a merge trigger the real apply.
   (Re-running is idempotent for the current `ADD COLUMN IF NOT EXISTS` migrations, but the first
   auto-apply should still be a verified no-op.)

## Adding a migration (every schema PR)

1. Edit `shared/schema/*.ts`.
2. Hand-author `migrations/NNNN_short_name.sql` (next number in sequence). Additive + idempotent:
   `ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "c" <type>;`. **Never** `drizzle-kit generate` (snapshot
   drift in this repo). **Never** a destructive change in the same PR as code that needs the new shape
   (expand/contract — keep it backward-compatible).
3. Add the `_journal.json` entry (`idx`, `version`, `when` = ms timestamp, `tag`, `breakpoints`).
4. `pnpm guard:schema` must pass locally before you push.

## Manual / break-glass

- **Apply to any DB by hand:** `DATABASE_URL=<direct-url> pnpm db:migrate:prod`
  (add `--dry-run` to list pending without applying).
- **Local dev:** `pnpm db:migrate` (drizzle-kit, dev DB).
- **Reconcile a DB whose schema already matches but journal is behind** (e.g. a `db:push`-built DB):
  `tsx server/scripts/markMigrationsApplied.ts --apply` — records files as applied without running them.

All three tools share the same `drizzle.__drizzle_migrations` table, the same sha256-of-raw-file
hash, and `created_at` = journal `when`, so they interoperate and none double-applies another's work.
