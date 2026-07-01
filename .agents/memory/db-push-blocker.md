---
name: db:push interactive blocker
description: Why npm run db:push can fail non-interactively and the safe workaround
---
`npm run db:push` (drizzle-kit push) runs in a non-TTY shell and aborts when it
hits an interactive confirmation. In this repo the prompt is a PRE-EXISTING,
unrelated destructive change — not something your task introduced. Because it
aborts, NOTHING gets applied, so brand-new tables also silently never get created.
Two confirmed triggers seen:
1. A unique-constraint add that would truncate an existing table (seen on
   `materiality_rule_sets`, `calculator_profiles`; the exact table varies).
2. An ORPHAN table that exists in the DB but is not in the Drizzle schema, so
   push wants to DROP it. The `sessions` login-session store (created by
   connect-pg-simple, deliberately not in `shared/schema`) triggers this every
   time. `--force` here would DROP `sessions` and log every user out.
Note push is also just slow: introspecting ~150 tables can take >40s before it
even reaches the prompt, so a short timeout looks like a hang mid-"Pulling schema".

**Rule:** Do NOT run `drizzle-kit push --force` to get past it — that auto-accepts
every pending change including the unrelated truncate, destroying real rows.

**How to apply:** Apply only your own objects with idempotent SQL via the
executeSql sandbox callback: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` for
columns (nullable/defaulted so the add is non-destructive), or
`CREATE TABLE IF NOT EXISTS ...` / `CREATE TYPE` guarded by a `pg_type`/`pg_class`
existence check for whole tables/enums. Match the Drizzle column types exactly.
Verify with information_schema afterward.

**Fresh-env gotcha:** In a fresh dev DB the `lookup_matrices` /
`lookup_matrix_cells` tables (+ `policy_lifecycle_status` enum) may be absent for
this same reason, which makes the pricing/underwriting and lookup-matrix
integration tests fail with `relation "lookup_matrices" does not exist`. Create
them with the guarded DDL above before running those tests.
