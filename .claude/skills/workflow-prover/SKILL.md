---
name: workflow-prover
description: Use ONLY when the user explicitly invokes /workflow-prover or explicitly asks to "run the workflow prover routine". NEVER auto-load for general testing, endpoint, or workflow questions — those belong to the api-routes skill. This is a scheduled autonomous routine with its own safety rails.
---

# Workflow Prover — run one workflow end to end and prove the values are true

**Cadence:** daily, 17:10 — after the QA Sweep, with the server the App Walker left running.
**Writes code:** no. Its trace, the workflow ledger, and its report (L1 per CHARTER §6).
**Produces:** a per-step pass/fail trace for one workflow, with **value equality** at every seam.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

## Why this routine exists

[`knowledge-base/feature-review/WORKFLOWS.md`](../../../knowledge-base/feature-review/WORKFLOWS.md)
scripts the core end-to-end flows, and its own ledger carries the finding that defines this seat —
**D-014, on workflow 3**:

> run as written it catches **3 of the 9** registered Domain 8 findings and **misses the P0**,
> because every step-3 assertion is a *schema* assertion and F-051/054/055/069 are all
> **schema-valid falsehoods** that `xmllint` passes.

That is the whole problem in one line. A well-formed package is not a truthful package. A green
run of a shape-checking script proves the envelope, not the contents — and the defects that reach
a lender are almost always truthful-looking envelopes with the wrong value inside.

Three of the seven scripted workflows (6, 7, and the analytics loop) have **never been run at
all**, and workflow 3's last run was static-only against an orphaned listener.

### What it catches that no other control does

Unit and integration tests exercise seams in isolation. The App Walker renders pages. **Nothing
carries a single value across the whole chain** — intake → decision → disclosure → package — and
asserts it is still the same value at the other end. That is where this codebase's worst defects
live: a credit band bouncing a borrower *after* the FCRA consent, a URLA save tripping a TRID
write, a co-applicant's rows landing under the primary borrower.

## Rails

**Binding. Each maps to a failure this program is designed to prevent.**

- **R1 — Invocation.** Run only on an explicit `/workflow-prover` or a scheduled-task prompt naming
  this routine.
- **R2 — Value equality, never shape validity.** Every seam assertion is **emitted value == stored
  value**, read from both ends. Schema validation, XSD conformance and HTTP 200 are *preconditions*
  you record, never the assertion itself. A step whose only evidence is "it validated" is reported
  `UNPROVEN`, not `PASS`. This rail is D-014, and it is the reason this routine exists.
- **R3 — Never run workflow 3 on the old script.** Its ledger row says explicitly: do not re-run
  until the script gains an explicit emitted-value-equals-stored-value leg for `ausRecommendation`,
  `amortizationType`, occupancy, loan purpose and lien priority. **Extending the script is the
  work**; a green run without that leg is worse than no run, because it retires a live finding.
- **R4 — Local only, against a server you identified.** `http://localhost:5001` (worktree 5002).
  Confirm which checkout is serving before trusting a step — a local `/api/health` answers
  `commit: null` for any branch, and the 2026-08-17 workflow-3 run was recorded against a **12-day
  old orphaned listener from a deleted worktree**. Never run a workflow against production: it
  writes.
- **R5 — Seeded data only.** Use the dev seed accounts. Never a real borrower record, never a real
  SSN, never a real credential. Vendor legs run against the deterministic simulations — a simulated
  response is expected; an **unhandled** error is a finding.
- **R6 — `[gate]` steps must actually refuse.** A negative check that returns success is a P0, not a
  note. Record what you sent and exactly what came back. Never satisfy a gate by weakening it.
- **R7 — Findings only; never fix.** You may write your trace, the `WORKFLOWS.md` status ledger
  row for the workflow you ran, the hand-off board, and your report. You may **never** write
  `client/**`, `server/**`, `shared/**`, `tests/**`, `migrations/**`.
- **R8 — Date every standing claim.** Before reporting a step as broken, verify against
  `origin/main` (`git log -S '<symbol>' -- <path>`). WF2-F4 sat asserted in three documents for a
  week after it was fixed, and nearly shipped to eight routines as the headline launch blocker.
- **R9 — CHARTER §12, verbatim.** Never push to `main`, merge, enable auto-merge, or touch a
  production variable. `git add` explicit paths only.
- **R10 — Honesty.** A step you could not execute is `SKIPPED (reason)` — never `PASS` by
  inference from code. Static tracing is a legitimate fallback **only when labelled as such**, and
  a run that is entirely static says so in its STATUS line.

## Modes

**prove** (default — one workflow, every step live) · **extend** (repair or deepen a script whose
assertions are shape-only — R3's case; produces a better script, not a verdict) · **observe** (no
server and none startable) · **aborted**.

## Phase 0 — Orient

1. `git fetch origin`. Read CHARTER, the hand-off board, and `WORKFLOWS.md` in full.
2. Establish and **identify** a server (R4). Static-only is a labelled fallback, never a silent one.
3. Pick one workflow. Rotate, but **never-run outranks re-run**: workflows 6, 7 and the analytics
   loop have no first run, and a first run finds more than a fifth re-run of workflow 2.

## Phase 1 — Expand the script before running it

`WORKFLOWS.md` says outlines are expanded into exact route + payload steps by reading the client
code, because **the UI's actual requests are the spec**. Confirm every route and payload against
code; never assume one. Then, per R2, write down for each seam:

| | |
|---|---|
| **the value** | the specific field being carried |
| **read at source** | where it is stored, and how you will read it |
| **read at sink** | where it is emitted, and how you will read it |
| **equality** | what exactly must match, and what a legitimate transform would be |

A seam with no value to carry is a shape check. Say so and mark the step `UNPROVEN` up front rather
than discovering it after a green run.

## Phase 2 — Execute

Step by step, recording the real request and the real response for each. On the first hard failure,
**keep going** where later steps are independent — a single trace that finds three defects is worth
more than one that stops at the first. Record `[gate]` steps by what they refused and how.

## Phase 3 — Ledger, hand off and report

Update the workflow's row in `WORKFLOWS.md` — last run, verdict, and any new finding id. Append
confirmed findings to the hand-off board naming the builder seat. Then one report at
`knowledge-base/routines/reports/<YYYY-MM-DD>-workflow-prover.md` in CHARTER §13 order — STATUS ·
⛔ human actions · Summary ≤5 sentences · Evidence (real requests and responses, quoted) · Proposed
tickets (≤3). Commit `docs(routine): workflow-prover <date>` on your own branch, PR it, never push
to `main`.

## Status rules

`OK` = every step carries a value-equality verdict from a live run. `WARN` = steps `UNPROVEN` or
`SKIPPED` with reasons, or the run was static and labelled. `FAIL` = you asserted shape and called
it proof, ran against production, ran workflow 3 on the unextended script, weakened a gate, or
reported a step you did not execute.

**`UNPROVEN` is the most valuable verdict this routine produces.** It marks a seam nobody is
actually checking — which is exactly what D-014 turned out to be.

## What this routine deliberately does not do

Fix what it finds · weaken or satisfy a gate to make a step pass · run against production · use
real borrower data · accept schema validity as proof of truth · merge anything (L3).
