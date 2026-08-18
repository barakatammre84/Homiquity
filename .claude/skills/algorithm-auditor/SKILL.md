---
name: algorithm-auditor
description: Use ONLY when the user explicitly invokes /algorithm-auditor or explicitly asks to "run the algorithm auditor routine". NEVER auto-load for general mortgage-math, pricing, DTI, or affordability questions — those belong to the mortgage-calculations skill. This is a scheduled autonomous routine with its own safety rails.
---

# Algorithm Auditor — attack one calculation until it breaks or holds

**Cadence:** daily, 18:20 — after the Workflow Prover, before Evening Triage.
**Writes code:** no. Its ledger and report only (L1 per CHARTER §1b).
**Produces:** one algorithm audited by differential, property and boundary attack.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

## Why this routine exists

The math suite here is real — `amortization`, `apr`, `aprValidation`, `qmThresholds`,
`pricingUnderwriting`, `underwritingEdgeCases` and more all have tests. **They pin known answers.**
Every one of them encodes what somebody already thought of, which means the failure mode they
cannot cover is the input nobody imagined.

This codebase has the receipts. `shared/lib/amortization.ts` replaced roughly two dozen copies of
the payment formula, and it deliberately keeps **two entry points** — one taking a percent (`6.5`),
one taking a fraction (`0.065`) — because merging them would hide the mistake. Mixing them is a
silent 100× error **that still produces a plausible-looking number**. A test suite full of pinned
values never finds that; a unit-consistency sweep finds it immediately.

And the numbers are not the code's to invent: every policy figure resolves from a Postgres matrix,
where `resolveMatrixValue` **throws** for decisioning (a Fair Lending rail) while
`tryResolveMatrixValue` returning null is display-only. A constant that has quietly become a
literal in code is both a correctness bug and a compliance one.

### What it catches that no other control does

Unit tests assert known outputs. The mutation verifier proves a *fix* is load-bearing. **Nothing
searches the input space** for the case nobody pinned, and nothing checks that a number came from
where policy says it must come from.

## Rails

**Binding. Each maps to a failure this program is designed to prevent.**

- **R1 — Invocation.** Run only on an explicit `/algorithm-auditor` or a scheduled-task prompt
  naming this routine.
- **R2 — Determinism is the first assertion.** Same inputs, same outputs, always. Any clock,
  randomness, ambient config, vendor call or model judgment inside `server/underwritingEngine.ts`,
  `server/services/decisionEngine.ts` or `server/services/ruleEngine.ts` is a **P0 finding**, not a
  design note.
- **R3 — Read-only, and never in the shared database.** You may write your ledger, the hand-off
  board and your report. You may **never** write `client/**`, `server/**`, `shared/**`,
  `tests/**`, `migrations/**` or `data/regulatory/**`. Scratch harnesses live in `/tmp` or a
  throwaway worktree and are never committed. **Never `pnpm db:push`**, and never seed against
  anything but a local database — `seedLendingGrids` wipes and rebuilds the pricing matrices.
- **R4 — No citation, no verdict.** A finding that a computation is *wrong* against policy needs
  the guideline or the matrix row that says so. Without one the verdict is **Needs Clarification**
  and it goes to the Domain Oracle — never "this looks wrong to me". Regulated math changes need a
  `data/regulatory/regulatory-ledger.json` entry, which a **builder** lands with the code; you
  propose it.
- **R5 — Never weaken a `complianceInvariants` test.** A failure there is a compliance incident,
  not a flaky test (CHARTER §6). Report it as an incident and stop touching it.
- **R6 — Findings only; never fix.** A fix, however small and however obvious, is a proposed ticket
  naming the file, the input that breaks it, and the expected output.
- **R7 — Every claim carries the input that produces it.** A finding without a reproducing input is
  not a finding. Quote the exact call and the exact output.
- **R8 — Date every standing claim** against `origin/main` before reporting it (R9 of the house
  rules; `git log -S '<symbol>' -- <path>`). Re-finding a fixed bug erodes the ledger.
- **R9 — CHARTER §8, verbatim.** Never push to `main`, merge, enable auto-merge, or touch a
  production variable. `git add` explicit paths only.
- **R10 — Honesty.** A property you could not test is `SKIPPED (reason)`. Never report a sweep as
  exhaustive when it sampled. State the sample size and the range.

## Modes

**audit** (default — one algorithm, all four attacks) · **differential** (two implementations that
should agree, when the codebase has more than one path to the same number) · **observe** ·
**aborted**.

## Phase 0 — Orient

1. `git fetch origin`. Read CHARTER, the hand-off board, your ledger.
2. Pick one target. Rotate across: amortization/payment · APR (Appendix J) · DTI · LTV/CLTV ·
   affordability · LLPA and pricing · mortgage insurance (MI/MIP/UFMIP) · QM points-and-fees ·
   TRID tolerance math · rent-vs-buy. **Never-audited outranks re-audit.**
3. Read the algorithm and its tests before writing a single probe. What the tests already pin is
   the space you do **not** need to search.

## Phase 1 — The four attacks

Run all four. Skipping one and saying so is acceptable; skipping one silently is not.

1. **Differential.** Where two code paths produce the same number, drive both across a swept input
   range and diff. Where only one path exists, recompute independently from the formula's own
   definition — and treat any disagreement as a finding on *both* until you can say which is right.
2. **Property / invariant.** Assert relationships, not values: monotonicity (a higher rate never
   lowers a payment) · the schedule sums to the principal to the cent · boundary continuity (no
   step at 80% LTV unless a cited matrix row puts one there) · sign and range sanity · idempotence.
3. **Boundary sweep.** Every threshold in the domain and both sides of it, at the smallest
   representable step: LTV 79.99/80/80.01, DTI limits, credit-band edges, loan-limit edges, note-date
   table boundaries. **Off-by-one at a policy edge is a Fair Lending problem**, not a rounding nit.
4. **Unit consistency.** Follow each rate, ratio and percentage across every call boundary and
   confirm the unit does not change silently. Percent vs fraction is the known 100× trap and it
   produces plausible output. Also check ×100 applied to an already-percent value, basis points
   read as percent, and monthly vs annual.

## Phase 2 — Provenance

For every constant the algorithm uses: does it come from a Postgres matrix, a cited ledger entry,
or a **literal in the code**? A literal that encodes policy is a finding even when its value is
currently correct — it is a number nobody can update, audit, or attribute. Note which resolver a
decisioning path uses: `resolveMatrixValue` (throws — correct for decisioning) or
`tryResolveMatrixValue` (null — display only). A decisioning path on the null-returning resolver is
a P0.

## Phase 3 — Hand off and report

Append confirmed findings to the hand-off board naming the builder seat; send anything needing a
guideline reading to the Domain Oracle rather than adjudicating it yourself. Then one report at
`knowledge-base/routines/reports/<YYYY-MM-DD>-algorithm-auditor.md` in CHARTER §9 order — STATUS ·
⛔ human actions · Summary ≤5 sentences · Evidence (the reproducing input and the real output for
every claim) · Proposed tickets (≤3). Commit `docs(routine): algorithm-auditor <date>` on your own
branch, PR it, never push to `main`.

## Status rules

`OK` = one algorithm audited with all four attacks run or explicitly skipped with reasons. `WARN` =
a finding needing a guideline reading, or an attack that could not run. `FAIL` = you changed
application code, weakened an invariant test, reported a finding with no reproducing input, seeded
a shared database, or claimed an exhaustive sweep you sampled.

**An audit that finds nothing is a real result** — say what you searched and how densely, so the
next run does not repeat it. "Nothing found" without a stated search space is worthless.

## What this routine deliberately does not do

Fix any calculation · write or edit a test · add a regulatory-ledger entry · adjudicate a guideline
question (that is the Domain Oracle's seat) · touch the shared dev database · merge anything (L3).
