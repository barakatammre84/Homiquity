# Loop template: documentation update

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now (R0, R1, R3, R9, R13 apply; the code rails do not). Then read
`$SCRATCH/loop-log.md` if it exists; append to it before each iteration ends.

```
TASK:   <one sentence: which doc, what fact changed, what the code says now (file:line)>
WRITE:  knowledge-base/<path>.md                 (the doc)
        knowledge-base/README.md                 (ONLY if a new file needs its index line — one additive line)
NEVER:  CLAUDE.md; .claude/**; docs/**; knowledge-base/logs/**, routines/reports/**, archive/** (immutable);
        peer ledgers (financial-audit/LEDGER.md, refactor-radar/LEDGER.md, feature-review/FINDINGS.md …);
        CTO_ROADMAP.md; any code file
PROOF:  the guards below green; every new relative link resolves from its own directory;
        every changed fact carries the command that proves it
MAX_ITER: 5
```

## Iteration procedure

0. **T-1** (`_RAILS.md` R1). Docs-only work needs no REGISTER row, but
   `knowledge-base/README.md` is a shared-file hazard — check `gh pr list --state open --json
   number,files` for PRs touching it and keep your change to one additive line.
1. Decide which side is wrong **before** editing: if the doc disagrees with the code, run the
   command that proves the code's behaviour and paste it into the commit message; if the code
   regressed, do not edit the doc to match it — report instead ("editing the doc to match broken
   code launders the regression", `.claude/skills/doc-accuracy/SKILL.md`).
2. Edit. House rules (`knowledge-base/governance/TEAM_PRACTICES.md` §7): links relative to the
   linking file; no transient state (open PR numbers, branch names) in living docs; a backticked
   file path must exist — a deliberately absent file is named in prose, not backticked; `pnpm`,
   never the other package manager's verbs; a count is written next to the command that produced
   it.
3. Verify: `pnpm guard:kb && pnpm guard:staleness && pnpm guard:citations && pnpm guard:docs`,
   then `node scripts/citation-guard.cjs --list | grep <your file>` and
   `node scripts/doc-staleness-guard.cjs --list | grep <your file>` — both print nothing.
4. `git diff --stat` proves the diff is markdown-only and inside WRITE. Commit with explicit
   `git add`.
5. Push; PR body: what changed, the proving command, "no prod impact", "no §9 trigger".
   Five failed rounds → `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Bump a freshness date without re-reading the whole doc · rewrite a dated report · fix a peer
routine's ledger (propose a ticket) · change rule semantics in a skill or CHARTER (founder pen).

Finish with the LOOP REPORT (T0–T3 lines read `n/a — docs only`; the guard line carries the four
doc guards), then the promise.
