# Loop template: schema + migration (expand-only)

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists (base SHA, attempt count, last tier results); append to it before each iteration
ends.

```
TASK:   <one sentence: column(s) on which table, and the ONE read/write path that uses them>
WRITE:  shared/schema/<file>.ts
        migrations/<NNNN>_<slug>.sql              (NNNN = last idx + 1 — read the journal first)
        migrations/meta/_journal.json             (one new entry; idx contiguous; `when` unique and > previous)
        server/storage/<domain>.ts                (the storage method, if one is needed)
        server/routes/<domain>/<file>.ts          (the one route that reads/writes the column)
        tests/<name>.test.ts   (node lane globs — no config line)
NEVER:  contract steps (SET NOT NULL, CHECK, FK, type narrowing, DROP, RENAME); pnpm db:push;
        pnpm db:generate; any file outside WRITE; package.json; docs/**; data/regulatory/**
PROOF:  a test red on origin/main (the column is absent from the insert shape, or the route drops
        the value) and green after — both runs pasted
MAX_ITER: 8
```

## Iteration procedure

0. **T-1** + claim. Also: `gh pr list --state open --json number,files` for any PR touching
   `migrations/` — two branches once both authored the same migration number
   (`scripts/migration-ledger-guard.cjs` header). If one exists, take idx+2 or stop.
1. Write the failing test first; run the node lane; assert its file name appears.
2. Schema: add the column in `shared/schema/<file>.ts`. If it is a vocabulary column, re-pin it
   in the insert schema with `.extend({ col: z.enum(VOCAB) })`.
3. Migration: `ADD COLUMN IF NOT EXISTS` semantics; idempotent; no data backfill of a guessed
   value (`knowledge-base/runbooks/DB_MIGRATIONS.md`). Journal entry with the next idx and a
   `when` greater than the previous entry's.
4. `pnpm db:migrate` against the local database (`bash scripts/local-db.sh up` if none runs).
5. **T0**: `pnpm check`; `node --check` over `scripts/*.cjs`; `pnpm guard:schema &&
   pnpm guard:migrations` (the two that see this change) and the rest of the T0 guard list →
   `$SCRATCH/t0.log`.
6. **T1**: `pnpm test > "$SCRATCH/t1.log" 2>&1`; the guard's last line is `all lanes ran every
   file on disk`; your test name is present.
7. Commit (explicit `git add` of WRITE paths only; never the ralph state file). **T2**
   `pnpm preflight --fast`. A new PII-vocabulary column trips §9 → draft PR + ⛔, stop editing.
8. **T3** `pnpm preflight` (integration lane on 4000). A baseline that tightened is staged and
   named.
9. Territory check; push; PR body from `_REPORT_FORMAT.md` with **Prod impact** reading:
   "migration <NNNN> — `migrate-prod` applies it on merge (`.github/workflows/ci.yml:681`,
   re-armed 2026-08-22 by #669). After merge a human reads that job's log for
   `applied 1 migration(s)`, then confirms the `/api/health` commit. If the job has been paused
   again since — check its `if:` before writing this line — a human dispatches the workflow with
   `dry_run=false` instead; a dry run reconciles the journal and never executes the SQL." Five
   failed rounds → `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Write a contract migration · backfill a guessed value onto a provenance or audit column · add
the column to a borrower allow-list (`UPDATABLE_COLUMNS`) without saying why in the PR body ·
touch the engine that would consume the column (that is a separate, human-led change if it is
regulated math).

Finish with the LOOP REPORT, then the promise.
