---
name: handoff-refresh
description: Use ONLY when the user explicitly invokes /handoff-refresh or explicitly asks to "refresh the handoff corpus". NEVER auto-load for general onboarding, architecture, testing or documentation questions — read the chapter itself for those, and use doc-accuracy for other docs. This is a hand-invoked docs-only routine with its own safety rails.
---

# handoff-refresh

Bring `knowledge-base/handoff/` back into agreement with `origin/main`, and record what moved.

**Authoritative:** [`knowledge-base/handoff/README.md`](../../../knowledge-base/handoff/README.md)
(the refresh protocol and the Feynman contract) and
[`LEDGER.md`](../../../knowledge-base/handoff/LEDGER.md) (drift rows + the run log). Those win on
conflict; the code wins over both. **Scheduled consumer:** the daily `doc-accuracy` tick runs this
protocol as its Phase 1.4 (`.claude/skills/doc-accuracy/SKILL.md`); invoke this skill by hand
between ticks, or when a tick reported the refresh deferred.

## Rails (non-negotiable)

1. **Docs only.** The only writable paths are `knowledge-base/handoff/**`. Never edit a sibling
   doc to match the corpus — a wrong claim in another file becomes an `HO-<MMDD>-<NN>` **row**,
   never a fix. That rule is what keeps this directory a reader and not an authority.
2. **PR only, never merge.** Open one PR; hand back. A merge is a production deploy. Inside the
   daily doc-accuracy tick, the refresh rides that tick's single docs-only PR instead of opening
   its own.
3. **Never hand-type a count.** Run `pnpm handoff:facts --write`, or paste a command's output.
   Five hand-typed numbers in the first draft were wrong, and the fresh-hire audit found every
   one. If you find yourself retyping a digit, you are doing the step wrong.
4. **Derive on `main`, write on the branch.** `--write` refuses to run from a branch ahead of
   `origin/main`, because two rows measure `HEAD` (F-31 and the SHA stamp) and writing there would
   stamp the branch as the verified state of `main`. Follow the refusal message's recipe — or the
   seat's stricter form of it: derive in a clean `origin/main` worktree and copy `FACTS.md` back
   (`.claude/skills/doc-accuracy/SKILL.md` Phase 1.4), which needs no override flag at all; the
   scheduled routine is forbidden `--write --force` outright.
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

## Phase 0 — orient

```bash
git fetch origin
git rev-list --count HEAD..origin/main                       # must be ≤ 2
gh pr list --state open --json number,files --jq '.[] | select(.files[].path | startswith("knowledge-base/handoff")) | .number'
# (where `gh` is absent — remote sessions — the GitHub MCP `list_pull_requests` answers the same question)
```

An open PR already touching `handoff/` means stop and say so — do not race it. Then read the
**run log** at the bottom of `LEDGER.md` (what the last refresh did, and from which SHA) and the
stamp at the top of `FACTS.md`.

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

## Phase 3 — prove and hand back

```bash
pnpm handoff:facts --check && pnpm handoff:facts --cite
pnpm guard:kb && pnpm guard:citations && pnpm guard:staleness && pnpm guard:ui
```

Then `git add knowledge-base/handoff/...` **explicitly** (never `git add -A`), push, and open the
PR. Body: what moved, the guard output pasted, the ledger rows opened and closed. Docs-only, so
**Prod impact: none** — say it rather than omitting it.

## What this routine must not do

Edit a sibling doc to match the corpus · merge anything · hand-type a count · `--write` from a
feature branch without understanding rail 4 · bump a Freshness date on a file it did not read ·
delete a ledger row · add a chapter (that is authoring, and it is a founder call) · touch any
file outside `knowledge-base/handoff/**` except the `guard:ui` §0 table when the guard demands it.

## If the tooling itself is the problem

`scripts/handoff-facts.cjs` is in **no** guard chain and nothing runs it — delete it and every
guard, test and CI job still passes. If it misbehaves, delete it and use the "re-derive by hand"
recipe at the bottom of `FACTS.md`, which is the generator this script automates.

**One exception, and it bites the whole repo:** the gate's "Guard scripts parse" step runs
`node --check` over `ls scripts/*.cjs`, which includes this file — so a **syntax error here reds
the gate for every open PR**. Always `node --check scripts/handoff-facts.cjs` before pushing a
change to it. `pnpm preflight` runs that step too.
