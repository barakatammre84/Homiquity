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
   merge to main  (merge-on-green policy — TEAM_PRACTICES §6)
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

## One-time setup (done in GitHub)

1. **Connect Neon ↔ GitHub.** The integration provisions the repo secret `NEON_API_KEY`.
   That is the *only* credential CI needs: `migrate-prod` mints a fresh Neon **DIRECT
   (unpooled)** connection string at run time via
   [`scripts/neon-connection-uri.cjs`](../../scripts/neon-connection-uri.cjs), so **no prod DB
   password is ever stored in GitHub** and rotating the Neon password never breaks CI.
   Until `NEON_API_KEY` exists, `migrate-prod` fails loudly on merge (visible in Actions) —
   by design, so a missing config is never a silent slip.
   - **`NEON_PROJECT_ID` repo *variable*** (Settings → Secrets and variables → Actions →
     Variables) is needed **only** when the API key can see more than one Neon project — the
     script fails with the list of project ids when it's ambiguous. A project id is not secret.
   - The connection string is piped straight into the migrator by command substitution; it is
     never echoed, never written to `GITHUB_ENV`, and neither script prints it.
2. **Make the gate binding.** ✅ Done 2026-07-17; **dropped and re-applied 2026-07-19** —
   when the repo briefly went private that day, the Free plan doesn't support protection on
   private repos and GitHub **deleted** the rule outright (API 404, not a suspension);
   #252–#259 merged pre-green through the gap. On the repo going public again the rule was
   re-applied **from this table** (which is why it stays maintained verbatim) and verified
   by probe PR #262. If `gh api …/branches/main/protection` ever 403s/404s again,
   enforcement is OFF: use watch-then-merge and flag the founder
   ([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §6). Current rule
   (`gh api repos/OWNER/REPO/branches/main/protection` to read it back):

   | Setting | Value | Why |
   |---|---|---|
   | Required check | `gate (typecheck · tests · schema guard)` | the only check that must pass |
   | `enforce_admins` | **on** | auto-merge runs *as* the repo owner; without this the rule is decorative |
   | Required reviews | none | a solo owner can't approve their own PR — this keeps autonomous merge of a GREEN PR working |
   | Force-push / delete `main` | blocked | |
   | `strict` (branch up to date) | off | avoids an update+re-run cycle on every merge |

   Deliberately **not** required: `migrate-prod` (it reports `skipped` on PRs — requiring it would
   deadlock every PR) and Vercel's checks (third-party, not a correctness gate).

   ⚠️ **The required context is the gate job's `name:`, matched verbatim.** Renaming that job
   without re-pointing the rule deadlocks every PR, unbypassable. See the warning comment on the
   job in [`ci.yml`](../../.github/workflows/ci.yml).

   **Break-glass:** `enforce_admins` binds the owner too, so a genuine emergency needs it
   turned off deliberately (Settings → Branches), not bypassed silently — which is the
   point. (In an interval where protection is plan-gated off entirely, the equivalent is a
   deliberate, ledgered founder direct push — [ROLLBACK.md](./ROLLBACK.md) §2.)
3. **Pre-flight before trusting the auto-run (mandatory).** Pending-detection is journal-based
   (hash OR `created_at`), so confirm what it *thinks* is pending before it applies anything.
   Run it from GitHub — **no local credential needed**:

   **Actions → CI → Run workflow → `dry_run: true`** (the default). This runs `migrate-prod.cjs
   --dry-run`: it lists pending migrations and applies nothing.

   Read the output against reality:
   - **"up to date — no pending migrations"** — prod is at HEAD. Expected in steady state.
   - **Lists migrations prod genuinely lacks** — correct; let a merge (or `dry_run: false`) apply them.
   - **Lists migrations prod *already has*** — journal drift (from the old raw-pg apply recipe).
     Reconcile first — `tsx server/scripts/markMigrationsApplied.ts --apply` against prod — then
     re-run the dry-run until it's clean.

   (Re-running is idempotent for `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
   migrations, but the first real apply should still follow a read dry-run.)

   **What the dry-run does *not* prove.** It reconciles the journal — nothing more. It never
   executes a pending migration's SQL, so it cannot tell you whether that SQL will succeed.
   For an additive migration that distinction is academic (they don't fail on data); for a
   **contract** migration it is the whole ballgame — see the next section.

## Adding a migration (every schema PR)

1. Edit `shared/schema/*.ts`.
2. Hand-author `migrations/NNNN_short_name.sql` (next number in sequence). Additive + idempotent:
   `ALTER TABLE "t" ADD COLUMN IF NOT EXISTS "c" <type>;`. **Never** `drizzle-kit generate` (snapshot
   drift in this repo). **Never** a destructive change in the same PR as code that needs the new shape
   (expand/contract — keep it backward-compatible). If the migration is a **contract** step rather
   than additive, do the data check in the next section *before* you author it.
3. Add the `_journal.json` entry (`idx`, `version`, `when` = ms timestamp, `tag`, `breakpoints`).
   **`when` must be unique and strictly increasing across the journal.** The applier dedupes by
   `when` as well as by hash ([`migrate-prod.cjs`](../../scripts/migrate-prod.cjs) — the
   `appliedWhens` check), so a `when` copy-pasted from an earlier entry makes prod treat the new
   migration as already applied and **silently skip it**: green job, missing DDL. Take the current
   timestamp, never an adjacent entry's.
4. `pnpm guard:schema` must pass locally before you push.

## Contract migrations (`SET NOT NULL`, `CHECK`, `FK`, type narrowing)

Everything above assumes an **additive** migration — one that cannot fail on data. A **contract**
migration can: `SET NOT NULL` aborts if a single row is NULL; a `CHECK` or `FK` aborts if a single
row violates it. That abort fails the post-merge `migrate-prod` job and strands prod behind the
code that just deployed — the 2026-07-13 outage class.

**The dry-run pre-flight cannot catch this.** `--dry-run` prints `pending <tag>` and `continue`s
([`migrate-prod.cjs`](../../scripts/migrate-prod.cjs)) without executing the file. For
`0031_extraction_engine_require_named.sql` it would have printed `pending 0031_…` and exited 0
whether prod held zero NULL rows or a million. It answers *"is the ledger in sync?"*, never
*"will this DDL succeed?"*

So for a contract migration: **check the data against prod before authoring it**, and record the
counts in the migration's header comment (see
[`migrations/0031_extraction_engine_require_named.sql`](../../migrations/0031_extraction_engine_require_named.sql)
for the shape) so a reviewer can see what licensed the change.

### The read-only prod probe

`NEON_API_KEY` is **write-only in GitHub** and lives in no local `.env` — prod cannot be queried
from a laptop. Borrow CI's credential instead:

1. Throwaway branch off `main` (e.g. `probe/0031-nulls`).
2. **Edit the existing [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)**, *replacing*
   the `migrate-prod` apply step with a SELECT-only probe script. Replace rather than append, so
   no combination of dispatch inputs can mutate prod.
3. Push, then `gh workflow run ci.yml --ref probe/0031-nulls`.
4. Read the log (`gh run view <id> --log`), then delete the branch.

**Why edit the existing workflow instead of adding a new one:** GitHub only exposes
`workflow_dispatch` for workflows present on the **default branch**. A brand-new workflow file on
a scratch branch is not dispatchable at all — the dispatch simply won't find it. `--ref` runs
*that ref's version* of a workflow `main` already knows about, which is what makes the
edit-in-place route work.

**What to probe** — counts and shape only; never select row contents out of prod:

```sql
-- shape: did the previous migration actually land?
SELECT is_nullable, column_default, character_maximum_length
  FROM information_schema.columns
 WHERE table_name = 'document_confidence_scores'
   AND column_name = 'extraction_engine';

-- the gate: would SET NOT NULL abort?
SELECT count(*) AS total,
       count(*) FILTER (WHERE extraction_engine IS NULL) AS nulls
  FROM document_confidence_scores;
```

Working reference: **CI run 29553889961** (the #174 probe), which reported `is_nullable=YES`,
`total=0 nulls=0` — zero rows, therefore nothing for the `ALTER` to fail on.

**If the probe finds violating rows, do not invent data to clear them.** Backfilling a guessed
value into a provenance or audit column (*which engine extracted this? who approved it?*) makes
the column lie, permanently and invisibly, about the very thing it exists to record. A NULL is an
honest gap; a wrong value is a falsified record. Bring the counts to the founder and decide the
backfill together.

## Manual / break-glass

- **Apply to any DB by hand:** `DATABASE_URL=<direct-url> pnpm db:migrate:prod`
  (add `--dry-run` to list pending without applying).
- **Local dev:** `pnpm db:migrate` (drizzle-kit, dev DB).
- **Reconcile a DB whose schema already matches but journal is behind** (e.g. a `db:push`-built DB):
  `tsx server/scripts/markMigrationsApplied.ts --apply` — records files as applied without running them.

All three tools share the same `drizzle.__drizzle_migrations` table, the same sha256-of-raw-file
hash, and `created_at` = journal `when`, so they interoperate and none double-applies another's work.
