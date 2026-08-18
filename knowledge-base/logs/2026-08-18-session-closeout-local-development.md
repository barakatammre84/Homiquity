# Session close-out — routine registration, the decide-or-close clock, and the move to local development

**Date:** 2026-08-18 (evening, UTC). **Status:** dated snapshot — true as of its date only.
**Why this exists:** the session shipped one merge, paused two fleets, and left three verified
findings that outlived the PR carrying them. Chat scrollback is not a record; CHARTER §0's whole
lesson is that a control nobody can point at did not happen.

---

## What landed on `main`

**[PR #574](https://github.com/barakatammre84/Homiquity/pull/574) → `70598e3`.** Merged on an
observed-green `gate`, not on trust. `migrate-prod` ran and reported **success** (the PR carried no
migrations, so it was a no-op against prod — but it ran, as it does on every push to `main`).

Three things in one PR:

1. **The Backend Data Engineer** — the suite's first backend-lane routine and the accountable owner
   of §1's question A on the data side. Registered both ways §11 demands in one session: the in-repo
   `SKILL.md` (rails R1–R13) and CCR trigger `trig_01K5iHLyJ8r9x6DG8KppW62o` (`0 11 * * *` UTC).
   §6b resolves the lane the §6a way — **accountable owner, shared lane**; Primary Engineer is not
   narrowed.
2. **§5's decide-or-close clock** — PRs aged against their last *substantive* commit; `>72h` draft
   promoted or proposed for closure **with content recorded first**; `>7 days` a ⛔ item. A routine
   proposes, never executes.
3. **§6c's dependency-bump lane**, carrying a **founder-authorized amendment to §1b's L3 merge
   row** — a routine may merge a green patch/minor bump under seven preconditions, and it then owns
   the deploy.

Also added `handbook/app-guide/12-api-contract.md`, the UI↔backend boundary chapters 04 and 05
assumed but never stated.

---

## Fleet state — everything Homiquity is paused

**All thirteen Homiquity CCR triggers are disabled** as of 2026-08-18 ~21:40Z. Five were paused by
this session (Backend Data Engineer, UI conformance sweep, doc-accuracy steward, page-by-page
inspection, PR sync loop); the remainder were disabled independently, including two this session
had never seen (a report-only Frontend Wiring Audit at 10:20Z and a Deliverable QA Sweep at 16:10Z).

Two enabled triggers remain and **neither touches this repo**: a one-shot `send_later` SendGrid
reminder, and the Barakat RE inbox triage (a different business).

**Deliberately left running:** `.github/workflows/cron-jobs.yml`'s **seven** production sweeps.
They are the running app doing its job, not a deploy. Two are compliance watchdogs —
`adverse-action-delivery` is an **ECOA §1002.9 30-day statutory-deadline alarm**, and
`credit-monitoring` raises staff tasks on score drops. Freezing those was considered and rejected.

### Consequences of the pause worth knowing before resuming

- The **Backend Data Engineer skill is on `main` but its trigger is off** — it will not fire.
- The **§6c L3 dependency-merge authority is live in the charter**, held by a paused routine.
  Nothing can auto-deploy while that stays true.
- The **decide-or-close clock has nothing computing it.** The PR sync loop is its only executor.
  **Re-enable that one first** when the freeze lifts, or §5 describes a mechanism that is not running
  — registered-looking and unregistered, which is precisely §11's fossil.

---

## Local development — what is true, and what was measured

[PR #578](https://github.com/barakatammre84/Homiquity/pull/578) → `daea3c2` landed `pnpm dev:up`
(one command, ~15s cold, no Docker required — it falls back to a `pg_ctl` cluster under `$HOME`).
That is the recommended path and it supersedes the manual sequence for day-to-day work.

This session ran the stack end to end independently — Postgres 16.13, 57/57 migrations, `pnpm dev`,
a real login, `pnpm build && pnpm start` — and the following are **measurements, not readings**:

| Finding | Evidence |
|---|---|
| **`SESSION_SECRET` is mandatory in dev and fails silently** | Boot guard is production-only (`session.ts`), value passed to express-session regardless. With it blank the server logs `serving on port 5001`, `/health` returns ok, and **everything else including the homepage 500s** `secret option required for sessions`. No boot-time signal. `dev:up` generates it, so this bites the manual path only. |
| **`pnpm start` does not read `.env`** | `index-dev.ts` has `import "./load-env"`; `index-prod.ts` deliberately does not, because Railway injects its own. The prod bundle dies on `DATABASE_URL must be set` with a correct `.env` present. Needs `set -a; . ./.env; set +a`. **Hits both paths.** |
| **A fresh DB logs a `CRITICAL COMPLIANCE ERROR` during boot seed** | `FANNIE_LLPA` matrix missing, from `syncBestExecutionRates`. Non-fatal; seed completes, server binds. A new local DB has no LLPA rows to price against. |
| **`X-Forwarded-Proto: https` is not needed locally** | `session.ts` sets `secure: NODE_ENV === "production"`. A login round-trip sent no such header and the session held across a follow-up authenticated call. `TEST_ACCOUNTS.md` claimed otherwise; ~10 test files repeat it in comments. |
| **Nothing defaults to port 5001** | `server/app.ts` falls back to `5000`; 5001 comes from `.env`. |
| **`pnpm db:seed` could not read `.env`** | `runSeed.ts` imported only `seedDatabase`, so `../db` threw at import. Fixed with `import "dotenv/config"`, matching `markMigrationsApplied.ts`. Mutation-proven both directions. |

**Also confirmed working:** 57/57 migrations on a fresh Postgres 16 · `/health` and `/api/health`
both ok, with `commit: null` and `email.configured: false` as documented · homepage and
`/test-login` 200 · login as `buyer@test.com` returning the seeded `active_buyer` · wrong password
401 · `pnpm build` clean · prod bundle boots and serves, with `/api/test-login` correctly 403 under
production CSRF.

**Not proven:** nothing ran on macOS; Node here was v22.22.2 against the `engines` pin of 24; the
Docker path in §3 Option B is unexercised — this run used a directly-installed Postgres 16 because
no Docker daemon was available.

---

## Open threads

- **[PR #579](https://github.com/barakatammre84/Homiquity/pull/579) closed unmerged**, content
  recorded first per §5. Branch `claude/local-dev-runbook-freeze` (`da72433`) remains on the remote
  as the cherry-pick source.
- **[PR #542](https://github.com/barakatammre84/Homiquity/pull/542)** — its blocking precondition
  (#537) landed, and #576 rescued four of its five compliance suites. Worth re-checking what remains.
- **The six local-clock routines** — Launch Gate, Wiring Audit, Lender Delivery Gate, QA Sweep,
  Evening Triage, Vendor & Procurement — still have no definition any session can read. They live
  only in `~/.claude/scheduled-tasks/` on the founder's laptop, so they cannot be reviewed or
  improved, and §3 says they stop silently when the app is closed. Migrating them in-repo needs one
  attended session and remains the highest-leverage cleanup available.
- **`verify-deploy` for `70598e3` was still polling when this session ended.** Its job conclusion is
  the only proof prod advanced — **not** the workflow's, which is `continue-on-error: true` and
  reports success regardless. Check the job, or `GET /api/health`'s `commit` field.
