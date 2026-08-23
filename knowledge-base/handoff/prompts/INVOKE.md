# How to run a loop

> **Freshness:** last verified 2026-08-22 · review every 30 days
> Verified against the ralph-loop plugin 1.0.0 installed at
> `~/.claude/plugins/cache/claude-plugins-official/ralph-loop/1.0.0` (its stop hook, hooks/stop-hook.sh inside that directory, is
> the authority on promise matching and the state file).

## 0. Before the first loop (once per task)

```bash
# a throwaway worktree of origin/main, installed, with the env file
git -C /Users/ammrebarakat/Developer/Homiquity fetch origin
git -C /Users/ammrebarakat/Developer/Homiquity worktree add ~/Developer/hq-loop-<slug> -b <type>/<slug> origin/main
cd ~/Developer/hq-loop-<slug> && pnpm install --frozen-lockfile && cp /Users/ammrebarakat/Developer/Homiquity/.env .env
# a scratch directory OUTSIDE the repo for the loop's logs and memory
mkdir -p ~/hq-scratch/<slug> && export SCRATCH=~/hq-scratch/<slug>
```

Open the Claude Code session **in the worktree directory** — the ralph state file is written
relative to the session's cwd, and the templates assume `git rev-parse --show-toplevel` is the
worktree.

## 1. Ralph loop — the default for code

The prompt is a **pointer** to a template plus the fill-ins; the template is re-read from disk on
every iteration, so the prompt stays short and the rails stay in one place:

```
/ralph-loop Follow knowledge-base/handoff/prompts/bug-fix.md exactly. TASK="<one sentence>" WRITE="server/routes/lending/letters.ts, tests/letterExpiryWindow.test.ts, vitest.config.ts" PROOF="tests/letterExpiryWindow.test.ts" SCRATCH="$HOME/hq-scratch/<slug>" --completion-promise "LOOP TERMINAL" --max-iterations 8
```

- `--completion-promise "LOOP TERMINAL"` — always this constant; the hook does an exact,
  whitespace-normalised match on the first `<promise>…</promise>` in the final message. A promise
  with variable content (counts, PR numbers) can never match.
- `--max-iterations` — the template's `MAX_ITER`, which is the attempt cap (5) plus a margin.
  It is the only hard stop: if the loop never reaches `DONE` or a `STOPPED(...)`, this ends it.
- Monitor from another terminal: `head -10 ~/Developer/hq-loop-<slug>/.claude/ralph-loop.local.md`
  (`iteration:` and `max_iterations:` are in its frontmatter) and `tail -f $SCRATCH/loop-log.md`.
- Stop by hand: `/cancel-ralph` in the session.
- When it ends, read the LOOP REPORT (the last message). `STATUS: DONE` → review the draft PR;
  `STATUS: STOPPED(<reason>)` → the hand-back tells you what a human must decide.

## 2. `/loop` — for polling, never for code

`/loop` re-runs a prompt on an interval. Use it to watch things the harness cannot notify you
about:

```
/loop 10m Run `gh pr checks <n>`; if every check is green print the T5 commands from knowledge-base/handoff/prompts/_RAILS.md R14 and stop; otherwise report the failing check's name only.
```

A `/loop` never edits files — an edit on a timer with no rails is the failure mode the routine
CHARTER was written to prevent (`knowledge-base/routines/CHARTER.md` §0).

## 3. A plain session — when a loop is the wrong tool

Use an ordinary session (with the same rails read first) for anything the loop must stop on:
work that needs a design or taste decision; a change in a hand-back file (auth, the engines,
the vaults); anything that trips §9; a contract migration; a multi-layer feature that needs a
plan before its loops; anything in CHARTER §1b rows L3/L4 (merging, production variables,
disclosure policy, regulator correspondence).

## 4. After `STATUS: DONE` — what only a human does

1. Read the PR's **Proof** and **Verification** sections against the rails; a missing red run
   or a `SKIPPED` that is not explained sends it back.
2. Merge (L3 — a merge to `main` is a production deploy).
3. T5: `curl -s https://homiquity-production.up.railway.app/api/health | jq -r .commit` must equal
   the merge SHA. Do this **by hand even though `verify-deploy` now does it too** — it carries
   `continue-on-error: true` (`.github/workflows/ci.yml:672`, deliberately, so it cannot deadlock
   Railway's "Wait for CI"), and `main` requires no checks, so a green workflow tells you nothing
   about whether that job passed. A PR that carried a migration is applied automatically by
   `migrate-prod` (`:583`); read `applied N migration(s)` in its log. Re-check both jobs' `if:`
   lines before trusting either (`grep -n "if:" .github/workflows/ci.yml`) — they were paused for
   two days in August 2026 and nothing announced it. Chapter 07 keeps the dated status.
4. Remove the worktree: `git -C /Users/ammrebarakat/Developer/Homiquity worktree remove ~/Developer/hq-loop-<slug>`.
