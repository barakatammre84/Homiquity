---
name: db:push interactive blocker
description: Why npm run db:push can fail non-interactively and the safe workaround
---
`npm run db:push` (drizzle-kit push) runs in a non-TTY shell and aborts when it
hits an interactive confirmation. In this repo the prompt is a PRE-EXISTING,
unrelated destructive change (a unique constraint on `materiality_rule_sets` that
would truncate existing rows) — not something your task introduced.

**Rule:** Do NOT run `drizzle-kit push --force` to get past it — that auto-accepts
every pending change including the unrelated truncate, destroying real rows.

**How to apply:** When you only need to add your own new columns, apply them with
idempotent SQL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`) via the executeSql
sandbox callback. New columns must be nullable or have defaults so the add is
non-destructive. Verify with information_schema.columns afterward.
