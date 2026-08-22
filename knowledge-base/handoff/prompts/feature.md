# Loop template: feature (one seam, end to end)

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists; append to it before each iteration ends.

A feature that crosses a boundary (schema → route → query key → component) is **several loops**,
not one: the schema loop (`schema-migration.md`), the route loop (`new-route.md`), the UI loop
(`ui-page.md`). This template is for a feature that lives within one layer. If the TASK below
needs more than one WRITE group, split it first.

```
TASK:   <one sentence: the user-visible outcome, for which persona, behind which gate>
LAYER:  shared | server | client            (one)
WRITE:  <the files in that layer, listed>
        <tests: tests/<name>.test.ts + vitest.config.ts (END)  or  client/src/<dir>/<Name>.test.tsx>
NEVER:  any other layer; hand-back files; baselines; allowlists; package.json; docs/**
        (inherited exception, R5: the DESIGN_SYSTEM.md §0 table via `pnpm guard:ui --write-table` when a client file is added)
PROOF:  1) a characterisation test of the neighbours, green BEFORE the change and green after
        2) the feature test, red before and green after
MAX_ITER: 10
```

## Iteration procedure

0. **T-1** + claim (`_RAILS.md` R1–R2).
1. Read the owner rails for the area (`knowledge-base/handbook/FEATURE_MAP.md` → the
   `hq-*-owner` agent file) and the app-guide chapter it cites. Copy the **shape** of the nearest
   existing implementation (route: `server/routes/lending/applications.ts`; page: a sibling in
   `client/src/pages/`); do not invent a new shape.
2. Write the characterisation test of the neighbours first; run it green.
3. Write the feature test; run it red.
4. Implement inside WRITE. Server: Zod intake → gate → storage → `logAudit`. Client: query keys
   from the factories in `client/src/lib/queryClient.ts`, gate from
   `client/src/lib/routeGates.ts`, tokens only, icons from `client/src/lib/icons.ts`.
5. **T0** → **T1** (both test names in the log; counts equal) → commit (explicit `git add`).
6. **T2**; a §9 trigger → draft PR + ⛔, stop editing.
7. **T3** for server/shared layers; **T4** (`scripts/browser-probe.cjs` at 320 on the route) for
   client layers — paste the probe output.
8. Territory check; push; PR body from `_REPORT_FORMAT.md`. Five failed rounds →
   `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Cross into a second layer "while here" · add a column without `schema-migration.md` · add a
route gate that differs from `ROUTE_GATES` · call a vendor outside its adapter · write a
`queryFn` by hand.

Finish with the LOOP REPORT, then the promise.
