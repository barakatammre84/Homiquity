---
name: handoff-refresh
description: Use ONLY when the user explicitly invokes /handoff-refresh, explicitly asks to "refresh the handoff corpus", or a scheduled-task prompt names the Handoff Corpus Steward. NEVER auto-load for general onboarding, architecture, testing or documentation questions — read the chapter itself for those, and use doc-accuracy for other docs. This is the daily corpus-steward routine with its own safety rails.
---

# Handoff Corpus Steward — keep the reverse-engineering corpus true

**Cadence:** daily, 17:06 local (`5 17 * * *`) — the slot vacated when the daily Client Journey
Walk was retired to hand-invocation on 2026-08-23. Laptop `taskId` stays `client-journey-walk`
(renaming discards run history and stored tool approvals — judge it by its description, not its
slug, per CHARTER §3). Also valid hand-invoked at any time as `/handoff-refresh`.
**Writes code:** no — the only writable paths are `knowledge-base/handoff/**`, its own report,
and the `guard:ui` §0 table when that guard demands it.
**Produces:** at most one corpus-refresh PR + one report
(`knowledge-base/routines/reports/<YYYY-MM-DD>-handoff-steward.md`, CHARTER §9 format).
**Contract:** [`knowledge-base/routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

**Authoritative:** [`knowledge-base/handoff/README.md`](../../../knowledge-base/handoff/README.md)
(the refresh protocol and the Feynman contract) and
[`LEDGER.md`](../../../knowledge-base/handoff/LEDGER.md) (drift rows + the run log). Those win on
conflict; the code wins over both.

## Why this seat exists

`knowledge-base/handoff/` is the onboarding corpus: every chapter proves its claims with a
command a reader can re-run. A proof corpus that nobody re-runs decays into the thing it was
built to replace — confident prose about a codebase that has moved. Before 2026-08-23 the refresh
was hand-invoked only; the founder's standing direction ("constantly updated and refreshed") makes
it a daily seat.

**What it catches that no other control does:** the *reason* drift — a count that is unchanged
while the claim behind it changed, and a chapter whose lesson is now wrong. `guard:citations`
checks that cited lines exist; `pnpm handoff:facts --check` checks the numbers; nothing else reads
the prose against the code. It is also the only lane that ages the `HO-` drift rows: a row that
sits open for a week with a named fix-now lane is a silent failure of that lane, and this seat is
where it stops being silent.

**The three clocks, reconciled.** Daily: `--check` + `--cite` + the run's `git log` read (cheap —
minutes when nothing moved). Every ≤14 days: FACTS fully re-derived (`--write` from a clean
worktree of `origin/main`) even if `--check` is green, because a command's *meaning* can drift.
Every ≤30 days: every chapter re-read in rotation (the run log records which), so the numbers are
never fresher than the prose that interprets them.

## Rails (non-negotiable)

1. **Docs only.** The only writable paths are `knowledge-base/handoff/**`. Never edit a sibling
   doc to match the corpus — a wrong claim in another file becomes an `HO-<MMDD>-<NN>` **row**,
   never a fix. That rule is what keeps this directory a reader and not an authority.
2. **PR only, never merge.** Open one PR; hand back. A merge is a production deploy.
3. **Never hand-type a count.** Run `pnpm handoff:facts --write`, or paste a command's output.
   Five hand-typed numbers in the first draft were wrong, and the fresh-hire audit found every
   one. If you find yourself retyping a digit, you are doing the step wrong.
4. **Derive on `main`, write on the branch.** `--write` refuses to run from a branch ahead of
   `origin/main`, because two rows measure `HEAD` (F-31 and the SHA stamp) and writing there would
   stamp the branch as the verified state of `main`. Follow the refusal message's recipe.
5. **A number that changed is a prose edit.** Grep the chapters for the *old* value and fix the
   sentence in the same commit. A table that agrees with a paragraph that does not is worse than
   a stale table, because it looks maintained.
6. **Bump a `Freshness:` date only for a file you actually re-read.** A date is a claim.
6b. **Never pre-write a row your own PR will move.** F-18, F-21 and F-31 count things a PR can
   change. If your branch adds a skill or a doc, those rows *should* disagree until it merges —
   writing the post-merge number is stamping a commit that does not exist. The next `--check`
   catches it. (Unlike the `guard:ui` §0 table, which is a gate and must move with its PR.)
7. **≤ 2 commits behind.** Rebase and `pnpm install --frozen-lockfile` if not, and restart.
8. **Any client test added anywhere** means `pnpm guard:ui --write-table` in its own commit —
   the §0 denominator counts test files, and a stale table blocks every push in the repo
   (LEDGER HO-0822-25/26).
9. **Invocation.** Run only on an explicit `/handoff-refresh`, an explicit "refresh the handoff
   corpus", or a scheduled-task prompt naming this routine. If this file loaded any other way,
   stop.
10. **Honesty.** A check that did not run in this environment is reported as
    `SKIPPED(<reason>)` — a shallow clone, a missing CLI, an unreachable host — never silently
    re-stamped from the previous run's value.

## Modes

- **refresh** (default) — detect, fix, age, report.
- **deferred** — an open PR already touches `knowledge-base/handoff/**` (Phase 0 finds it): do
  not race it. Verify only, route residual findings to the report as tickets referencing that PR,
  and say `MODE: deferred to #<n>` in the report.

## Phase 0 — orient (guard first)

```bash
git fetch origin
git cat-file -e origin/main:.claude/skills/handoff-refresh/SKILL.md \
  || { echo "definition unmerged"; }   # if absent: minimal report, STATUS: WARN — enabling PR unmerged, STOP
git rev-list --count HEAD..origin/main                       # must be ≤ 2
```

Check open PRs for any touching `knowledge-base/handoff/**` (with `gh` when present:
`gh pr list --state open --json number,files --jq '.[] | select(.files[].path | startswith("knowledge-base/handoff")) | .number'`;
in a cloud session use the GitHub MCP `list_pull_requests` + per-PR file lists). One found →
**deferred mode**. Then read the **run log** at the bottom of `LEDGER.md` (what the last refresh
did, and from which SHA), the stamp at the top of `FACTS.md`, and yesterday's own report if one
exists.

## Phase 1 — detect

```bash
pnpm handoff:facts --check          # every checkable row vs its live command
pnpm handoff:facts --cite           # every `path:line` resolves AND lands inside the file
git diff --stat <FACTS-stamp>..origin/main
git log --format='%h %s' <FACTS-stamp>..origin/main
```

`--check` prints three numbers: rows, checkable, and **not machine-comparable**. The last group
is named, not hidden — those rows print prose rather than an integer, and a refresh re-reads them
by hand. Treat a silent "all green" that skipped a third of the table as the failure it is.

The `git log` matters as much as the guards: a count can be unchanged while the *reason* for it
changed. That is the interesting drift, and no tool finds it. Read every commit subject in the
range and ask which chapter asserts something about it.

## Phase 2 — fix

1. `pnpm handoff:facts --write` (from a clean worktree of `origin/main` — see rail 4), then carry
   the regenerated block onto your branch.
2. For each changed value: `grep -rn "<old value>" knowledge-base/handoff/*.md` and rewrite the
   sentences. **Prose first, numbers second** — if a chapter's *lesson* changed, rewriting the
   number and leaving the lesson is the failure mode. "The job is off" becoming "the job runs but
   cannot fail the build" is a different chapter, not a different digit.
3. Re-run each affected chapter's **prove-it** block and paste the new outputs. Only re-stamp the
   chapters you actually re-ran.
4. New drift in *other* docs → new `HO-<MMDD>-<NN>` rows. Resolved drift → mark the row resolved
   **in place**, with what closed it; never delete a row.
5. Append one row to the ledger's **run log**: from-SHA → to-SHA, chapters touched, what you
   learned, the PR.

## Phase 3 — age the drift rows

For every **open** `HO-` row: re-verify the target still says what the row claims (quote
`file:line`), and whether the code still disagrees. A row resolved by a merged commit is marked
resolved in place with the commit. A still-open row **older than 7 days** (the `MMDD` in its id)
that names a fix-now lane becomes a **⛔ line in the report naming that lane and the row** — the
sibling doc is still never edited from here. Rows with lane "founder" are listed once per report,
not re-escalated daily.

## Phase 4 — prove

```bash
pnpm handoff:facts --check && pnpm handoff:facts --cite
pnpm guard:kb && pnpm guard:citations && pnpm guard:staleness && pnpm guard:ui
```

(An expected `--check` red per rail 6b — F-18/F-21/F-31 moved by this very branch — is pasted and
explained in the PR, not silenced.) Then `git add knowledge-base/handoff/...` **explicitly**
(never `git add -A`), push, and open the PR. Body: what moved, the guard output pasted, the
ledger rows opened and closed. Docs-only, so **Prod impact: none** — say it rather than omitting
it.

## Phase 5 — report

Write `knowledge-base/routines/reports/<YYYY-MM-DD>-handoff-steward.md` in CHARTER §9 order —
`STATUS:` first and last, ⛔ human actions (hardest first, incl. Phase 3 escalations), ≤5-sentence
summary, evidence per claim, proposed tickets for Evening Triage. Commit it
`docs(routine): handoff-steward <date>` (in the same PR).

## Status rules

- **OK** — facts and citations green at the stamp, no lesson-changed drift found, no `HO-` row
  aged past 7 days unescalated.
- **WARN** — drift found and fixed this run; or deferred to an open PR; or a check was
  `SKIPPED(<reason>)` in this environment; or ⛔ escalations were written.
- **FAIL** — the corpus contradicts `origin/main` in a way a docs-only fix cannot close, the
  tooling and its hand-recipe both fail, or proceeding would require breaking a rail.

## Scheduler prompt (paste verbatim into the laptop task `client-journey-walk`)

```text
Run the HANDOFF CORPUS STEWARD for Homiquity (repo: /Users/ammrebarakat/Developer/Homiquity,
GitHub barakatammre84/Homiquity). Fresh session, no memory of prior runs — the method, the rails
and the cross-run memory live in the repo.

FIRST: git fetch origin -q. IF .claude/skills/handoff-refresh/SKILL.md DOES NOT EXIST on
origin/main (git cat-file -e origin/main:.claude/skills/handoff-refresh/SKILL.md), write a
minimal report saying exactly that to knowledge-base/routines/reports/<YYYY-MM-DD>-handoff-steward.md
on branch routine/handoff-steward-guard, STATUS: WARN — enabling PR unmerged, and STOP.

THEN: invoke /handoff-refresh and follow .claude/skills/handoff-refresh/SKILL.md exactly — it is
the routine definition. Where this prompt and the skill disagree, the skill wins; where the skill
and knowledge-base/routines/CHARTER.md disagree, the charter wins.

NOTE: this seat replaced the daily CLIENT JOURNEY WALK on 2026-08-23 (founder decision). You do
not walk journeys. /journey-walk and the journey-walker agents remain available hand-invoked, and
knowledge-base/routines/journey-walk/LEDGER.md keeps the rotation for whoever is next invoked.

BEFORE WRITING: check for TODAY's own report across ALL remote branches and for open PRs touching
knowledge-base/handoff/** — an open refresh PR means deferred mode, never a competing PR.

OPERATIONAL FACTS: local verification only; never merge, never push to main, never enable
auto-merge; one PR; commit the report as docs(routine): handoff-steward <date>.
```

## What this routine must not do

Edit a sibling doc to match the corpus · merge anything · hand-type a count · `--write` from a
feature branch without understanding rail 4 · bump a Freshness date on a file it did not read ·
delete a ledger row · add a chapter (that is authoring, and it is a founder call) · **walk
journeys** (`/journey-walk` is hand-invoked and has its own rails) · edit its own `SKILL.md`
mid-run · touch any file outside `knowledge-base/handoff/**` except its own report and the
`guard:ui` §0 table when the guard demands it.

## If the tooling itself is the problem

`scripts/handoff-facts.cjs` is in **no** guard chain and nothing runs it — delete it and every
guard, test and CI job still passes. If it misbehaves, delete it and use the "re-derive by hand"
recipe at the bottom of `FACTS.md`, which is the generator this script automates.

**One exception, and it bites the whole repo:** the gate's "Guard scripts parse" step runs
`node --check` over `ls scripts/*.cjs`, which includes this file — so a **syntax error here reds
the gate for every open PR**. Always `node --check scripts/handoff-facts.cjs` before pushing a
change to it. `pnpm preflight` runs that step too.
