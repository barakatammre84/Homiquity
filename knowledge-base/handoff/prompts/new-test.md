# Loop template: new test (characterisation or regression) — the zero-risk loop

> **Freshness:** last verified 2026-08-22 · review every 30 days
> The smallest loop in this directory and the one to run first when trying the mechanics: it
> touches one test file and one config line, so nothing it does can break the application.

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists (your memory from earlier iterations: base SHA, attempt count, last tier results).
Append to it before you finish each iteration. `$SCRATCH` is a directory **outside** the repo.

```
TASK:   <one sentence: what behaviour of which module the test pins, and why it matters>
TARGET: <the module under test, e.g. shared/lib/<name>.ts — must NOT appear in any open PR's file list>
WRITE:  tests/<name>.test.ts            (node lane)  — or —  client/src/<dir>/<Name>.test.tsx  (client lane)
        vitest.config.ts                 (node lane only: append ONE line at the END of `include`)
NEVER:  any file outside WRITE; the module under test; any baseline; package.json
        (exception inherited from _RAILS.md R5: the DESIGN_SYSTEM.md §0 table, regenerated only by
        `pnpm guard:ui --write-table` when the guard asks — a colocated client test moves its denominator)
PROOF:  the test runs (its file name appears in the lane output) and is green; for a regression
        test, also show it red against the bug's commit if one exists
MAX_ITER: 6
```

## Iteration procedure

0. **T-1.** `git fetch origin && git rev-list --count HEAD..origin/main` ≤ 2, else rebase +
   `pnpm install --frozen-lockfile` and restart. `gh pr list --state open --json number,files`
   — if `TARGET` or your test path is in any open PR → `STATUS: STOPPED(claimed)`.
1. Read the module under test and its existing tests (`grep -rl "<module basename>" tests
   client/src`). A characterisation test asserts what the code **does today**, with the inputs a
   caller actually sends; it does not assert what you think it should do.
2. Write the test. Node lane: append its path as the **last** entry of `include` in
   `vitest.config.ts` with a one-line comment naming what it pins (the file's own convention).
   Client lane: colocate it; no config change.
3. **T0.** `pnpm check` → `$SCRATCH/t0.log`. Guards are unaffected by a test file, but run
   `pnpm guard:kb` if you touched anything under `knowledge-base/`.
4. **T1.** `pnpm test > "$SCRATCH/t1.log" 2>&1`. Assert: the test file name appears in the log;
   the two `Test Files` counts equal the on-disk counts (`_RAILS.md` R14). A missing file name
   means the allowlist line was not appended — fix, do not proceed.
5. Commit with explicit `git add tests/<name>.test.ts vitest.config.ts` (or the colocated file).
6. **T2.** `pnpm preflight --fast > "$SCRATCH/t2.log" 2>&1`. Read the last 30 lines; §9 must
   report no trigger for a test-only diff — if it does, stop and report, do not edit the guard.
7. Territory check: `git diff --name-only origin/main...HEAD` ⊆ WRITE.
8. Push (no pipe), `gh pr create --draft` with the body from `_REPORT_FORMAT.md`.
   Any failure in 3–7 → fix and restart at 3. Five failed rounds → `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Change the module under test to make the test pass · skip the allowlist line · assert
behaviour the code does not have · add a `.skip` · touch a baseline.

Finish with the LOOP REPORT from `_REPORT_FORMAT.md`, then the promise.
