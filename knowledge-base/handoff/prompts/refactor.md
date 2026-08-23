# Loop template: refactor (behaviour-preserving)

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists; append to it before each iteration ends.

```
TASK:   <one sentence: what moves/splits/renames, and the observable behaviour that must not change>
WRITE:  <the files being refactored and every importer the move touches — list them>
        <characterisation tests if none exist: tests/<name>.test.ts + vitest.config.ts (END)>
NEVER:  behaviour changes; hand-back files; baselines; allowlists; package.json;
        client/src/pages/borrower/URLAForm.tsx helpers (knowledge-base/handbook/URLA_FORM_REFACTOR_TRAP.md)
PROOF:  every characterisation test green before AND after; `pnpm check` clean; the guards'
        counts unchanged or lower (a tightened baseline is staged and named)
MAX_ITER: 8
```

## Iteration procedure

0. **T-1** + claim. A refactor claims **every file it will touch**, importers included
   (`grep -rln "<module>" server shared client/src`).
1. If the code has no tests, write characterisation tests **before** moving anything and run
   them green on the untouched code. A refactor without a before-run is a rewrite.
2. One mechanical move per iteration: extract, move, rename — then re-run the tests. Keep the
   diff reviewable in one CI cycle (`knowledge-base/governance/TEAM_PRACTICES.md` §4, PR size).
3. Sub-registrar directories keep their registration order (`server/routes/*/index.ts`
   comments) — a moved route is appended, never inserted.
4. **T0** (the UI ratchets matter here: `pnpm guard:ui`, `pnpm guard:tokens`,
   `pnpm guard:querykeys`) → **T1** → commit → **T2** → **T3** when server code moved.
5. Territory check; push; PR body from `_REPORT_FORMAT.md`. Five failed rounds →
   `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

"Improve" behaviour while moving it · delete code because nothing imports it (code that never
fires may be the control — `knowledge-base/routines/CHARTER.md` §10) · raise a baseline · extract
the URLA form helpers.

Finish with the LOOP REPORT, then the promise.
