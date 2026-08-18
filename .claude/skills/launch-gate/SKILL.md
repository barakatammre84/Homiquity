---
name: launch-gate
description: Use ONLY when the user explicitly invokes /launch-gate or explicitly asks to "run the launch gate routine". NEVER auto-load for general CI, deploy, release, or "is main green" questions — those belong to the runbooks. This is a scheduled autonomous routine with its own safety rails.
---

# Launch Gate — can we ship today?

**Cadence:** daily, 07:48. **Writes code:** never; tickets only.
**Produces:** the `RELEASABLE` line — the suite's headline output — plus the day's gate verdict.
**Contract:** [`knowledge-base/routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

> **Provenance.** Reconstructed 2026-08-18 into the repo from CHARTER §2, §7, §8 and §9 and from
> this routine's own `2026-08-17` report, because the definition existed only on one machine — see
> [`logs/2026-08-18-routine-suite-audit.md`](../../../knowledge-base/logs/2026-08-18-routine-suite-audit.md).
> **If the scheduled-task copy carries rails not derivable from the charter, merge them in — never
> delete them.** Repointing the scheduler at this copy is the founder's step (CHARTER §11).

## Why this routine exists

**A green check is not a shipped deploy.** A failed Railway build leaves the *previous* container
serving, so the site stays up and every check stays green while production goes stale — nine
consecutive failed deploys, ~8 commits behind, undetected, on 2026-08-06. The only proof is the
`commit` field of `GET /api/health`.

### What it catches that no other control does

CI proves a *diff* is sound. This routine proves the *state* is shippable: that `main` is green
right now, that prod is serving `main`, and that if today's deploy is bad there is something to
roll back to. Railway's Hobby image retention is **72 hours** — past that there is no one-step
rollback, and nothing else in this repo is watching that clock.

## Rails

- **R1 — Invocation.** Only on an explicit `/launch-gate` or a scheduled-task prompt naming this
  routine. Never self-start.
- **R2 — Writes nothing but its report.** No code, no config, no roadmap edits — proposed tickets
  go to Evening Triage, which holds §0–§3. Takes **no `REGISTER.md` claim**: a claim it never
  releases would block peers that do write code.
- **R3 — Never claim `main` is broken without reinstalling after the rebase**, and without
  confirming against the real check-runs. Stale `node_modules` fakes a red `tsc` in files nobody
  touched, and a routine has already nearly reported a broken `main` on that alone. **Zero
  check-runs may be an Actions outage, not a failure.**
- **R4 — Never claim a deploy without `/api/health`'s `commit`.** Not from a green check, not from
  a Railway status, not from a 200 — a 200 proves the process is alive and nothing more.
- **R5 — Probe the machine host.** `https://homiquity-production.up.railway.app/api/health` from a
  scheduled session. `www.homiquity.com` is a CNAME in a third-party zone and three cron sweeps
  died on its DNS (`curl` exit 6) on 2026-08-06. CI's `verify-deploy` probes `www` deliberately —
  that job's job is proving the public path. **Say which host you probed.**
- **R6 — A check that did not run is `SKIPPED (reason)`**, never assumed green and never omitted.
- **R7 — CHARTER §8 verbatim.** Never push to `main`, merge, arm auto-merge, flip a production
  variable, rotate a credential, or apply a migration. The report **is** the page.
- **R8 — Date every standing claim** before repeating it (`git log -S '<symbol>' -- <path>`).

## Phase 0 — Orient

`git fetch origin`; work from current `origin/main`; `pnpm install --frozen-lockfile` **again after
the rebase** (R3). Read `CHARTER.md` (§2, §7, §8), `REGISTER.md`, and yesterday's reports.

## Phase 1 — Is `main` releasable?

On current `origin/main`: `pnpm check` · `pnpm test` (node **and** client lanes) · `pnpm build` ·
the full `pnpm guard:*` suite. Then confirm against CI itself (`gh run list --branch main`, or
`mcp__github__actions_list`) before believing any local red (R3).

## Phase 2 — Is prod current?

`GET /api/health` on the Railway host (R5). Compare its `commit` to `origin/main` HEAD.

- equal → `prod ✓`.
- behind → **`FAIL`.** Prod is stale *and every check is still green* — that is the silent-failure
  mode this routine exists for. Say how many commits, and name the newest commit prod is missing.

## Phase 3 — Is rollback real?

Railway image retention is **72 h on Hobby**. List deployments (Railway MCP `list-deployments`);
if every prior deployment reads `REMOVED`, or the previous image is older than 72 h, then
`rollback ✗` — and that is a `CTO_ROADMAP.md` §0 escalation, not a footnote. Recovery is then
`git revert <sha>` + push + a full rebuild: minutes, not seconds
([`runbooks/ROLLBACK.md`](../../../knowledge-base/runbooks/ROLLBACK.md) §1).

## Phase 4 — What broke overnight, and what is in flight

- Commits merged since yesterday's gate; anything reverted.
- Open PRs: `mergeable` **and** check-runs at the **current head SHA** — an earlier green run at a
  stale head is not a passing PR.
- Yesterday's routine reports, **searched across every remote branch** (reports commonly sit on
  unmerged `routine/*` branches). A missing upstream is a `WARN` naming the routine (CHARTER §4).

## Phase 5 — Publish the line

```
RELEASABLE: yes|no · main <sha> · prod <sha> · drift <n> commits · gates ✓/✗ · rollback ✓/✗
```

`RELEASABLE: no` when `main` is red or prod is stale. `rollback ✗` alone does not make the day
un-releasable — it makes it un-*undoable*, which belongs in ⛔ rather than in the verdict.

## Phase 6 — Report

`knowledge-base/routines/reports/<YYYY-MM-DD>-launch-gate.md`, CHARTER §9 order: `STATUS` + the
`RELEASABLE` block · ⛔ human actions (hardest first) · Summary ≤5 sentences · Evidence (command
output for every claim) · proposed tickets for Evening Triage. Commit
`docs(routine): launch-gate <date>` on a branch; open a PR; never push to `main`.

**A `FAIL` here is the next Primary Engineer run's item one. No exceptions, no features first** —
so a `FAIL` must name the exact failing thing, not a symptom.

**Status rules.** `FAIL` = `main` red, prod stale, or a gate you could not evaluate at all.
`WARN` = `rollback ✗`, a missing upstream report, a conflicted PR queue, an unprobeable host.
`OK` = releasable, current, rollback available.

## What this routine deliberately does not do

Fix what it finds (that is Primary Engineer's item one tomorrow) · edit the roadmap · merge or
re-run anything · touch production.
