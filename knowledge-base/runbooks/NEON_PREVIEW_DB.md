# Neon preview databases — getting prod PII out of previews

> ## ⚪ STATUS 2026-08-06: DORMANT — there are no preview deployments any more
>
> The platform moved from Vercel to Railway and **the Vercel project was deleted**
> (its API now 404s). The Neon↔Vercel integration this runbook was written against
> is therefore gone, and with it the per-push preview branches:
>
> - **The hazard is moot for now.** Nothing creates a `preview/*` Neon branch, so
>   nothing is cloning the production borrower dataset. The "every preview
>   connection string is a production credential" exposure described in §1 has no
>   live surface.
> - **The two founder Console actions in §3 are NO LONGER REQUIRED.** They existed
>   to stop the Vercel integration from branching prod; there is no integration to
>   stop. Do not action them; they are kept below as the recipe, not as a to-do.
>   (Wherever another doc still lists them as an open founder item — e.g. the
>   go-live checklist — that item is closed by removal, not by being done.)
> - **The doctrine below stays.** It is the design the next preview environment must
>   satisfy. Railway supports per-PR environments; **if PR environments are ever
>   enabled for this project, the whole of §1–§5 applies again** — re-read it *before*
>   turning them on, not after, and re-derive the Neon side rather than assuming the
>   Vercel-specific mechanics (branch-per-push, integration-managed parent) carry over.
>   Whether Railway's PR environments would need Neon branching at all, or how they
>   would be wired to it, has **not** been investigated.
> - **`preview-seed` may still exist as a Neon branch.** It is harmless and no longer
>   consumed by anything. Leave it, or have the founder delete it — but be certain of
>   *which* branch you are looking at first (see the mis-pointing warning at the end
>   of §5).
>
> Prior status (superseded, kept for context): *2026-07-17 — tooling BUILT (this
> runbook + `preview-seed.yml`); the cutover needs two founder Console actions (§3).
> Until those happen, previews still clone production.*

**Everything below §1 describes the Vercel-era mechanism, in the present tense as it
was written. Read it as the design record, not as current state.**

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

## 3. Founder cutover (Console-only; Claude cannot click these) — ⚪ NOT REQUIRED, see STATUS

*These two clicks existed to disarm the Neon↔Vercel integration. That integration no longer
exists (the Vercel project was deleted), so there is nothing to turn off and no Preview-scoped
`DATABASE_URL` to repoint. Kept verbatim as the recipe for a future preview environment.*

> **Historical recipe — do not follow. Nothing here is clickable any more:** the Neon↔Vercel
> integration was deleted with the platform, so there is no toggle to turn off and no
> Preview-scoped `DATABASE_URL` to repoint. Kept only as the shape of the work if a preview
> environment is ever rebuilt.
>
> 1. **Neon Console → Integrations → Vercel → Manage**: turn **off** automatic
>    preview-branch creation.
> 2. **Vercel → Project → Settings → Environment Variables**: set the
>    **Preview**-scoped `DATABASE_URL` to `preview-seed`'s **pooled** connection
>    string (Neon Console → Branches → preview-seed → Connection string;
>    serverless = pooled, per the 2026-07-16 outage lesson). Check the
>    Environments column — Preview only; do not touch Production.
> 3. Delete any lingering `preview/*` branches in Neon by deleting their **git**
>    branches (the integration reaps the clone; never issue a Neon DELETE).
>    Squash-merge caveat: `gh pr list --head <branch> --state all` is the
>    authority on whether a git branch is safe to delete — never git ancestry.

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

> ⚠️ **A non-production Neon branch handed to the production app is its own outage
> class, and it is *quiet*.** On 2026-08-06 the running app's `DATABASE_URL` was
> pointed at a stale Neon branch (28 of 53 migrations applied, no writes since 07-15):
> `/api/articles` and `/sitemap.xml` 500'd for half an hour while `GET /api/health`
> kept returning **200**, because its `SELECT 1` succeeded perfectly well against the
> wrong database. Health checks cannot detect this. Whenever a second Neon branch
> exists for any reason — `preview-seed`, an orphaned clone, a restore — treat "which
> branch is the running service actually connected to?" as a thing to *verify*, not
> assume: Railway → project `Homiquity` → service `Homiquity` → **Variables** →
> `DATABASE_URL`, matched against the branch's connection string in the Neon Console.
> This is the strongest argument for deleting preview branches once they are done with.
