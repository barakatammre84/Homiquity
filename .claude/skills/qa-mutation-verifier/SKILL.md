---
name: qa-mutation-verifier
description: Use ONLY when the user explicitly invokes /qa-mutation-verifier or explicitly asks to "run the QA mutation verifier routine". NEVER auto-load for general testing, vitest, coverage, or QA questions — those belong to the api-routes and ui-components skills. This is a scheduled autonomous routine with its own safety rails.
---

# QA Mutation Verifier — the adversarial QA seat

**Cadence:** daily, 16:20 — after the Deliverable QA Sweep, before Evening Triage.
**Writes code:** **only inside a throwaway worktree that is destroyed before the run ends.**
Nothing it writes is ever committed (L1 per CHARTER §1b).
**Produces:** a `PROVEN` / `UNPROVEN` verdict per claimed fix that merged today.
**Authority:** the Fannie Mae *Selling Guide*, edition 08-05-2026, committed at
[docs/fannie-mae/selling-guide/](../../../docs/fannie-mae/selling-guide/) — the policy authority
for eligibility, underwriting, income, credit, property and delivery, controlling over every job
aid in `docs/fannie-mae/`. Cite the section id; never answer a Fannie policy question from memory.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md)
and [knowledge-base/routines/TEAM.md](../../../knowledge-base/routines/TEAM.md) win over this file
on any conflict; say so in the report rather than following the stale copy.

## Why this routine exists

The house defect class is **silent success** — an operation that does not happen while the UI says
it did. Four public forms rendered success on rejected POSTs; co-borrower rows were dropped under
the words "Everything is safely stored"; a revoked consent still rendered as given. Every one of
those shipped past a green gate, because **a guard only asks its own question**.

The standing countermeasure is the reintroduction test: prove a fix by putting the bug back and
watching a test go red. It works, and it is applied unevenly — it depends on whoever wrote the PR
remembering to do it. This seat makes it a control instead of a habit, which is the difference the
hiring plan draws at
[knowledge-base/governance/HIRING_PLAN.md](../../../knowledge-base/governance/HIRING_PLAN.md) §2.4.

### What it catches that no other control does

The Deliverable QA Sweep **finds** defects. Nothing verifies that a *fix* is actually load-bearing.
A test that passes both with and without the fix is not evidence, and it is invisible to `pnpm
test`, to every guard, and to a reviewer reading the diff.

## Rails

**Binding. Each maps to a failure this program is designed to prevent.**

- **R1 — Invocation.** Run only on an explicit `/qa-mutation-verifier` or a scheduled-task prompt
  naming this routine.
- **R2 — Mutations live and die in a throwaway worktree.** Every mutation happens in a fresh
  worktree under `.claude/worktrees/`, on a branch that is **never pushed**, and the worktree is
  removed before the run ends (`git worktree remove`, never `--force`). **Never mutate the primary
  checkout** — it is shared, and a peer's uncommitted work lives there.
- **R3 — Never commit a mutation, and never leave one behind.** If the run aborts, the report says
  exactly which worktree and branch still exist so a human can clean up. A stranded mutation that
  looks like real work is worse than no run.
- **R4 — Never weaken a test to make anything pass.** Not to fix a red, not to unblock a
  verification. A test that fails for an unrelated reason is reported `BLOCKED (reason)`. Weakening
  a `complianceInvariants` test is a compliance incident, not a test fix (CHARTER §6).
- **R5 — Report-only lane on the real tree.** You may write: your report and the hand-off board
  ([knowledge-base/routines/HANDOFF.md](../../../knowledge-base/routines/HANDOFF.md)). You may
  **never** commit to `client/**`, `server/**`, `shared/**`, `tests/**` or `migrations/**`. A
  missing test is a **proposed ticket** naming the file and the case — a builder seat writes it.
- **R6 — Prove the lane, not just the assertion.** A new test file under `tests/` is glob-collected
  by `vitest.config.ts` (#725, 2026-08-24 deleted the hand-typed `include:` allowlist) — but it is
  still droppable via that file's `exclude:` block — and `vitest run <file>` defaults to the **node**
  config — so a `client/src` test invoked that way silently runs nothing. **Assert the test's
  filename appears in the run output** before believing any verdict. An unrun test is `UNPROVEN`,
  never `PROVEN`.
- **R7 — Mutate the behaviour, not the syntax.** Reintroduce the actual defect the fix claims to
  close — restore the dropped filter, the old predicate, the unconditional toast. A mutation that
  only breaks a type or deletes a function proves the compiler works, not the test.
- **R8 — Sweep the siblings.** When a fix is slot-, index- or role-indexed, check the other slots
  before signing it off. Our own #547 shipped a silent-success fix that covered **only slot 1**,
  dropping co-borrower rows under a success message. A `PROVEN` verdict on one slot is not a
  verdict on the feature.
- **R9 — Selling Guide.** Every Fannie policy claim cites a section id that resolves in
  `docs/fannie-mae/selling-guide/section-index.tsv` and is read out of the committed text this run
  — never from memory. An id the index does not know is a **wrong** citation, not an old one: the
  Guide renumbers, and the stale URL used to return HTTP 200 rather than 404. A value read out of a
  **table** is unverified until you open the PDF page — borderless tables lose their row/column
  association in extraction. Where the Guide and a job aid disagree the Guide controls, and the
  conflict escalates rather than being resolved here. Enforced in CI by `pnpm guard:authority`
  (TEAM_PRACTICES §10).
- **R10 — CHARTER §8, verbatim.** Never push to `main`, merge, enable auto-merge, touch a production
  variable, or run anything against production. Verification is **local** — `http://localhost:5001`
  (worktree servers on 5002). Never reproduce or verify against the deployed site: a failed Railway
  build leaves the previous container serving, so what you see there may not be the code you think.
- **R11 — Honesty.** A check that did not run is `SKIPPED (reason)`, never assumed green. Dev
  servers may not start unattended — say plainly when verification was static. `UNPROVEN` is an
  honest and common verdict; never upgrade one to `PROVEN` because the fix looks right.

## Modes

**verify** (default) · **observe** (nothing merged since the last run — report and stop) ·
**aborted** (repo dirty in a way you did not cause, or a worktree cannot be created — report
exactly what you saw, including anything left behind, and stop).

## Phase 0 — Orient

1. `git fetch origin`. Read CHARTER (§1, §1b, §6, §8–§11), TEAM.md, HANDOFF.md.
2. Read today's `deliverable-qa-sweep` report and the day's merges
   (`git log --merges origin/main --since=...`, plus `gh pr list --state merged`).
3. Confirm the tree is clean and `pnpm install` is current — a worktree with no install resolves
   `node_modules` upward to the primary checkout, and the primary carries other people's changes.

## Phase 1 — Build the verification queue

Every fix merged to `main` since the last run that **claims** to close a defect. Rank by CHARTER §1
(question A before B), then §1a. **A fix in the capture path outranks everything** — that is where
this defect class lives: the calculators → funnel → URLA path, plus consent and task surfaces.

Take at most **five** per run. A properly mutation-proven verdict is the product; five hedged ones
are not.

## Phase 2 — Mutate

Per fix, in its own throwaway worktree:

1. Confirm the suite is green as merged. Not green → `BLOCKED (reason)`, move on.
2. Reintroduce the defect (R7), touching only what the fix changed.
3. Re-run the **correct lane** and assert the filename appears in the output (R6).
4. **Red → `PROVEN`.** Record which test reds and its name. **Green → `UNPROVEN`** — the fix may
   still be correct, but nothing is stopping it from regressing, and that is the finding.
5. Restore, confirm green again, remove the worktree.
6. Sweep the siblings (R8) and record what you checked.

## Phase 3 — Hand off and report

Append a `VERDICTS` block to HANDOFF.md — every `UNPROVEN` names the seat that picks up the missing
test tomorrow. Then one report at
`knowledge-base/routines/reports/<YYYY-MM-DD>-qa-mutation-verifier.md` in CHARTER §9 order —
STATUS · ⛔ human actions (hardest first) · Summary ≤5 sentences · Evidence for every claim (the
test name that reds, quoted from real output — never paraphrased) · Proposed tickets (≤3). Commit
`docs(routine): qa-mutation-verifier <date>` on your own branch, PR it, never push to `main`.

## Status rules

`OK` = every queued fix carries a verdict backed by real output, or a clean deliberate observe day.
`WARN` = one or more `UNPROVEN` or `BLOCKED` rows — name each and what is missing. `FAIL` = you
committed or pushed a mutation, left a worktree behind without saying so, weakened a test, verified
against production, or reported a verdict you did not actually observe.

**A run full of `UNPROVEN` is a successful run.** It is the exact information nothing else in this
program produces.

## What this routine deliberately does not do

Commit or push any mutation · write or edit a test on the real tree · weaken any test or invariant ·
fix the defects it finds — it is the check on the builders, and a seat that both writes and signs
off its own work is not a control · verify against the deployed site · merge anything (L3).
