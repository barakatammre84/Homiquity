# Neon preview databases — getting prod PII out of previews

**Status 2026-07-17: tooling BUILT (this runbook + `preview-seed.yml`); the
cutover needs two founder Console actions (§3). Until those happen, previews
still clone production.**

## 1. The problem (verified by CI probe, 2026-07-17)

The Neon↔Vercel integration creates a database branch per **git push** (not per
PR), always parented on the project's **default** branch — production. So:

- Every preview branch is a copy-on-write clone of the **real borrower
  dataset** (43MB logical size = prod's).
- Child branches inherit the parent's role **passwords** — a preview
  `DATABASE_URL` differs from production's only by hostname. **Every preview
  connection string is a production credential.**
- Vercel Deployment Protection (SSO) gates the *app*, not the *database*: this
  is hygiene-tier, not a live exposure — anonymous requests get a 302 to SSO.

Two "obvious" fixes are **wrong** — do not rediscover them:

- ❌ **"Repoint the integration's preview parent"** — no such setting exists;
  it always branches from `default=true`.
- ☠️ **"Make a non-prod branch the default"** — `migrate-prod` resolves its
  target by `default=true` (`scripts/neon-connection-uri.cjs`), so this
  silently re-aims production migrations at the wrong branch with green CI:
  the 2026-07-13 outage class.
- ⛔ **Neon branch protection** (auto-rotates child credentials) needs a paid
  plan; Free's limit is 0. Founder deferred the upgrade 2026-07-17 — don't
  re-raise unprompted. The `PATCH …/branches/{id}` `{"branch":{"protected":true}}`
  shape is confirmed working when the plan allows.

## 2. The fix that works on the Free plan

One **schema-only root branch, `preview-seed`** — prod's DDL, zero rows,
synthetic Learning-Center content, **role passwords rotated** so it shares no
credential with production — and Vercel Preview pointed at it instead of the
per-push clones.

Run it (idempotent; re-run any time to refresh/rotate):

```
gh workflow run preview-seed.yml
```

The workflow (`.github/workflows/preview-seed.yml`, manual-dispatch only —
`NEON_API_KEY` exists only as an Actions secret):

1. `scripts/neon-preview-seed-branch.cjs` — find-or-create the branch
   (+ compute endpoint) and rotate every role password. Schema-only is
   preferred, but **this project 412s on schema-only** ("legacy web access
   role … role: anonymous" — a leftover of Neon's old passwordless web
   access; removing a production role is a founder/Neon-support call), so the
   script falls back to a child clone that the next step erases.
2. `scripts/reset-preview-seed-db.cjs` — wipe the branch to an empty schema.
   Guarded: it resolves its own connection from the Neon API (never a raw
   `DATABASE_URL`) and hard-refuses the default branch, so it cannot be
   mis-aimed at production.
3. `pnpm db:migrate` — rebuild from the FULL migration chain (a nice side
   effect: every run validates the chain from zero). Future schema PRs:
   previews tolerate an older DB by the expand/contract rule; re-run the
   workflow after a merge to pick up new schema.
4. `pnpm db:seed` — the idempotent synthetic content seed (same one the server
   runs at boot; no PII, no prod extract).

No step prints a connection string or password.

## 3. Founder cutover (Console-only; Claude cannot click these)

1. **Neon Console → Integrations → Vercel → Manage**: turn **off** automatic
   preview-branch creation.
2. **Vercel → Project → Settings → Environment Variables**: set the
   **Preview**-scoped `DATABASE_URL` to `preview-seed`'s **pooled** connection
   string (Neon Console → Branches → preview-seed → Connection string;
   serverless = pooled, per the 2026-07-16 outage lesson). Check the
   Environments column — Preview only; do not touch Production.
3. Delete any lingering `preview/*` branches in Neon by deleting their **git**
   branches (the integration reaps the clone; never issue a Neon DELETE).
   Squash-merge caveat: `gh pr list --head <branch> --state all` is the
   authority on whether a git branch is safe to delete — never git ancestry.

## 4. Trade-offs accepted (decide with eyes open)

- **Previews share one database.** Two open PRs testing conflicting data
  changes can now step on each other; before, each push got an isolated clone.
  Re-run `preview-seed.yml` to reset the branch to schema + seed.
- **Schema-ahead PRs**: a preview whose code *requires* brand-new tables will
  500 on those paths until the workflow is re-run post-merge (same expand/
  contract tolerance as production deploys).
- **Clone-path residual**: on this project the branch is born a data clone
  and wiped seconds later; Neon time-travel history retains the pre-wipe
  state for the plan's retention window (hours on Free), after which no
  borrower data exists anywhere on the branch.
- The nicer long-term options remain: ask Neon support to **remove the legacy
  web-access role** (unlocks schema-only branches), Neon **anonymized
  branches**, or the paid plan's branch protection.

## 5. Verification after cutover

- A new git push must **not** create a `preview/*` Neon branch (Neon Console →
  Branches; or probe from CI — `NEON_API_KEY` is Actions-only — with a
  read-only `GET /projects/{id}/branches` step).
- A preview deployment's `/api/health` returns ok, and its data is the seed —
  not real borrowers.
- Prod migrations still target production: `migrate-prod` is untouched
  (`NEON_BRANCH_NAME` is opt-in and only `preview-seed.yml` sets it).
