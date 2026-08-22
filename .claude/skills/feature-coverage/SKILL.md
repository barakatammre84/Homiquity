---
name: feature-coverage
description: Use ONLY when the user explicitly invokes /feature-coverage or explicitly asks to "run the feature coverage routine". NEVER auto-load for general feature, ownership, or architecture questions — those belong to the FEATURE_MAP and the hq-*-owner agents. This is a scheduled autonomous routine with its own safety rails.
---

# Feature Coverage — walk the areas nobody has looked at, and write down what is there

**Cadence:** daily, 19:20 — after the Client Journey Walk (17:05) has landed its report, and far
enough before Evening Triage (21:00) that its tickets are in the day's consolidation.
**Writes code:** **no.** Ledger rows, tickets and its own report only (L1 per CHARTER §1b).
**Produces:** up to 8 area walks per run, each a row in
`knowledge-base/routines/feature-coverage/LEDGER.md`, plus buildable tickets in `FINDINGS.md`.
**Authority:** the Fannie Mae *Selling Guide*, edition 08-05-2026, committed at
[docs/fannie-mae/selling-guide/](../../../docs/fannie-mae/selling-guide/) — the policy authority
for eligibility, underwriting, income, credit, property and delivery, controlling over every job
aid in `docs/fannie-mae/`. Cite the section id; never answer a Fannie policy question from memory.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

## Why this routine exists

The fleet had four seats that fix things and none that could say **what had never been looked at.**

`DOMAINS.md` tracks 13 review domains and five had never been run. Underneath them sit 41 built
feature areas, of which **23 had never been visited by anything** — and no file recorded that. An
unvisited area and a clean one were indistinguishable, so the rotation could not be honest and the
build lanes had no way to prefer ignorance over staleness.

That is this routine's catch, and it is the only thing that justifies a seat: **it converts silence
into a measurement.** It does not fix anything. Four daily lanes already do that, and eight owner
agents each opening a PR would bury them.

## Rails

**R1 — invocation gate.** Run only when explicitly invoked, or when fired by the scheduler.

**R2 — you do not write code. At all.** Not a fix, not a test, not a "trivial" one-liner. Your
output is ledger rows, tickets and a report. The owner agents you dispatch run in **assessment
mode** — say so in their prompt, explicitly, every time. If an owner returns a diff, do not land
it; record what it proposed as a ticket and say in the report that you declined it.

**R3 — never mark a row you did not walk.** Not from a plan, not from a peer's report, not from a
domain review. A ledger that records intent instead of work is worse than no ledger, and this fleet
has already been burned by a findings register that overstated itself in one direction.

**R4 — a skipped area is reported, never silent.** If an area is claimed in `REGISTER.md`, sitting
in a peer's open PR, or unwalkable for any reason, leave the row untouched and name it in the run
log with the reason. A silently skipped area reads exactly like a covered one.

**R5 — CHARTER §8.** Never push to `main`, never merge, never enable auto-merge, never touch a
production variable. `git add` explicit paths only.

**R6 — honesty.** Report SKIPPED-with-reason rather than a soft pass. Never claim a walk you could
not perform — if the local server would not start, say so and mark the rows `blocked`, do not fall
back to reading source and calling it a walk. **A routine that cannot be shown to have run is not a
control.**

**R7 — findings are dated claims.** Before filing a ticket, date the gap with
`git log -S '<symbol>' -- <path>`. This fleet nearly shipped a month-old "launch blocker" that had
been fixed the same day it was recorded.

## Phase 0 — Orient

1. `git fetch origin -q`, then `pnpm install --frozen-lockfile` — a worktree with no install
   resolves `node_modules` upward to the primary checkout and reports its state, not yours.
2. Read `knowledge-base/handbook/FEATURE_MAP.md` (the 41 areas and their owners) and
   `knowledge-base/routines/feature-coverage/LEDGER.md` (what has been walked).
   **If `FEATURE_MAP.md` is not on `origin/main`, stop and report SKIPPED** — the map is your input;
   without it you would be inventing a rotation.
3. `gh pr list --state open --limit 30 --json number,title,files` and read `REGISTER.md`. Every file
   in an open PR is claimed.

## Phase 1 — Pick 8

Per the ledger's own rules: **`never` first**, preferring areas whose owner lists a §9 trigger or a
hand-back file; then oldest `last walked`; skip anything claimed.

**Check the machine before you fan out.** Several sessions share this laptop, and 8 concurrent
agents on a loaded machine is how test runs and profilers have been killed. Measure, do not assume:
if load is already high, drop to 5 or 3, walk those properly, and **say in the report that you
reduced the fan-out and why.** A partial walk honestly reported beats 8 walks that all timed out.

## Phase 2 — Walk, in parallel

Dispatch one `hq-*-owner` agent per area, concurrently. Each prompt must say:

- **assessment only — do not edit any file, do not open a PR** (R2);
- the three questions to answer: *what can this area's backend do that a client cannot reach; what
  does its UI promise that the product cannot keep; what would a client reasonably expect from a
  modern lender here that is missing;*
- that the local server is the only verification target (`http://localhost:5001`), never production;
- that its own §6 known traps are dated claims to re-verify, not facts.

Owners already carry their file list, authority chain, owned tests and traps. That is the point of
dispatching to them rather than re-deriving it: you supply the rotation and the evidence discipline,
they supply the area knowledge.

## Phase 3 — Record

For each area walked, update its ledger row: date, status, finding ids, one line of notes.

File each buildable gap as a ticket in `knowledge-base/feature-review/FINDINGS.md` using the
date-qualified id scheme (`F-<MMDD>-<NN>` — **never a next-free integer**; six sessions once minted
six different `F-20`s). A ticket names a file, an expected behaviour and an owner lane, or it is not
buildable and does not go in.

Append one row to the ledger's run log: areas walked, tickets filed, and every skip with its reason.

## Phase 4 — Report

Write `knowledge-base/routines/reports/<date>-feature-coverage.md`. Lead with the number that
matters: **areas still `never`, out of 41.** That figure going down is the only success condition
this routine has.

Open one docs-only PR with the ledger, the tickets and the report. Never merge it.

## What this routine deliberately does not do

- **It does not fix anything.** Four daily lanes do that, and they read the tickets it files.
- **It does not re-walk a fresh area to look busy.** If everything has been walked recently, say so
  and stop — a short honest run is a valid run.
- **It does not replace the Client Journey Walk.** That seat walks a *persona across* surfaces; this
  one walks *areas* in isolation. The seams between surfaces are invisible to this routine by
  construction, which is exactly why both exist.
