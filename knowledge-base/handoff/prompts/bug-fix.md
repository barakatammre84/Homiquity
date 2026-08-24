# Loop template: bug fix

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists; append to it before each iteration ends.

```
TASK:   <one sentence: the wrong behaviour, the input that produces it, the right behaviour>
WRITE:  <the one or two source files that own the defect>
        tests/<name>.test.ts   (node lane globs — no config line)   — or —   client/src/<dir>/<Name>.test.tsx
NEVER:  files outside WRITE; hand-back files (_RAILS.md R3); baselines; allowlists; package.json
PROOF:  a test that is RED on origin/main and GREEN on the branch — both runs pasted
MAX_ITER: 8
```

## Iteration procedure

0. **T-1** (`_RAILS.md` R1–R2). Claim the target in `knowledge-base/routines/REGISTER.md`
   unless an open PR already owns the file (then `STATUS: STOPPED(claimed)`).
1. **Reproduce before you touch anything.** Write the failing test first. Run its lane; paste
   the red assertion into `$SCRATCH/loop-log.md`. If you cannot make it fail, you have not found
   the bug — stop and report what you tried.
2. Find the root cause, not the symptom. Check `git log -S"<token>" -- <file>` for the commit
   that introduced it and read its message; fixes that contradict a documented decision are a
   hand-back, not a change.
3. Fix inside WRITE only. If the fix needs a status transition, it goes through
   `updatePipelineStage`; if it touches PII, through the vault and `logAudit`; if it changes
   regulated math, stop (`_RAILS.md` R8).
4. **T0** → **T1** (the test's file name in the log; the guard's `all lanes ran every file on disk`
   last line) → commit (explicit `git add`).
5. **T2** `pnpm preflight --fast`. A §9 trigger → draft PR + ⛔ line, stop editing.
6. **T3** `pnpm preflight` when the fix touches a route, storage, schema or anything the
   integration lane exercises. A baseline that tightened is staged and named.
7. Territory check; push; PR with the body from `_REPORT_FORMAT.md` (Proof = both runs).
   Any failure in 4–7 → fix and restart at 4. Five failed rounds → `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Fix by deleting or skipping the test · widen an allowlist to let the value through · change the
engine/vault/auth files · "also clean up" neighbouring code (that is a `refactor.md` loop).

Finish with the LOOP REPORT, then the promise.
