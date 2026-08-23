# LOOP REPORT — the last message of a loop's terminal iteration

> **Freshness:** last verified 2026-08-22 · review every 30 days

The ralph-loop plugin ends a loop only when the assistant's final text contains the exact
completion promise (whitespace-normalised, exact match — there is no pattern matching and no
second promise for "blocked"). The plugin's own rule is that the promise may be written only when
its statement is **literally true**. So the promise in every template here is a statement about
the loop's *state*, not about success:

```
<promise>LOOP TERMINAL</promise>
```

**Definition.** `LOOP TERMINAL` is true when, and only when, one of these holds and the LOOP
REPORT above it says which: the task is done with T0–T3 evidence cited (`STATUS: DONE`), or a
stop condition from `_RAILS.md` R11 has been hit and the hand-back is written
(`STATUS: STOPPED(<reason>)`). Writing the promise on an iteration that is neither is a false
promise. `--max-iterations` is the hard cap that ends a loop that never reaches either.

## The block (exactly this shape, every line present)

```
LOOP REPORT
STATUS: DONE | STOPPED(<reason>)
BASE: origin/main @ <sha>   HEAD: <sha>   WORKTREE: <path>   ITERATIONS: <n>/<max>
PR: <url> | none
T0@BASE: <first summary line of $SCRATCH/t0-base.log> | trunk-red
T0: <tsc summary line> | <guards: one word each, e.g. schema ✓ migrations ✓ channel ✓ kb ✓ staleness ✓ citations ✓ querykeys ✓ tokens ✓ ui ✓>
T1: <the guard's last line: "all lanes ran every file on disk" | "test collection floor FAILED — N problem(s):" + the named problems> | <node "Test Files" line> | <client "Test Files" line>
T2: <preflight --fast last summary line, incl. §9 result>
T3: <preflight last summary line, incl. the integration-lane line> | not run (why)
T4: <probe output summary> | n/a (no UI change)
PROOF: <test file> red @ <base sha> → green @ <head sha> | characterisation: <file>
TERRITORY: git diff --name-only origin/main...HEAD ⊆ WRITE: yes/no
BASELINES TIGHTENED: none | <file> <old> → <new>
SKIPPED: <what and why> | none
HAND-BACK: <only for STOPPED: the line, the change it needs, who owns it>
<promise>LOOP TERMINAL</promise>
```

Rules for filling it:

- **The promise is the last line of the final message.** Nothing follows it — no commentary, no
  closing remark. The first acceptance run wrote the block, then two paragraphs of commentary,
  and left the tag out; the Stop hook refused the exit and burned an iteration before the next
  pass noticed. If you have something to say, say it *above* the block.

- Every `T*` line is **copied** from the output file the tier wrote (`"$SCRATCH/t0.log"` …),
  never retyped from memory. If a tier did not run, the line says `not run` and why.
- `T0@BASE` is the R1b baseline — T0 run on the untouched worktree before the first edit, from
  `"$SCRATCH/t0-base.log"`. `trunk-red` there means the loop stopped with
  `STATUS: STOPPED(trunk-red)` and the hand-back names the failing step, not the diff.
- The T1 line opens with the collection guard's own verdict (`_RAILS.md` R14): `pnpm test` is
  `scripts/test-collection-guard.cjs`, which compares each lane's collected set with the disk for
  you — copy its last line, and on a failure the lane or files it names. A `Test Files N passed (M)`
  with N < M can only come from `pnpm test:raw`, which a loop never runs.
- `SKIPPED` lines from `scripts/preflight.sh` are reproduced verbatim; a skipped stage is not a
  pass.
- `PR:` is `none` unless `gh pr view <n> --json url` printed it.

## PR body headings (mandatory, in this order)

```
## What & why
## Proof                 (the red run and the green run, pasted)
## Verification          (the T0–T3 lines, pasted; T4 when UI changed)
## Prod impact           ("none" | "migration <NNNN> — apply via the CI workflow dispatch after merge (human)")
## Docs                  ("no doc update required" | the files touched under knowledge-base/)
## Security review       ("no §9 trigger — guard output pasted" | "⛔ §9 trigger: <category> — review needed")
```

These mirror the definition of done in `knowledge-base/governance/TEAM_PRACTICES.md` §5 and the
report shape in `knowledge-base/routines/CHARTER.md` §13 (`STATUS` first, evidence per claim).
