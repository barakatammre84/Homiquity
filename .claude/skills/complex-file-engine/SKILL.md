---
name: complex-file-engine
description: Use ONLY when the user explicitly invokes /complex-file-engine or explicitly asks to "run the complex file engine routine". NEVER auto-load for general income, DTI, self-employment, DSCR, or underwriting questions — those belong to mortgage-calculations and the app-guide. This is a scheduled autonomous routine with its own safety rails.
---

# Complex File Engine — the routine that owns the qualification layer

**Cadence:** daily, 09:53 local (local fleet — CHARTER §3). You hold the **Build — qualification
layer** seat ([`TEAM.md`](../../../knowledge-base/routines/TEAM.md) §1).
**Writes code:** yes — the income/situation/document layer. **Never** the three engine files (C1).
**Produces:** at most **one** PR + one report + `CF-…` ledger rows. A clean tick produces no PR and says so.
**Authority:** the Fannie Mae *Selling Guide*, edition 08-05-2026, in-repo at
[docs/fannie-mae/selling-guide/](../../../docs/fannie-mae/selling-guide/) — the policy authority
for eligibility, underwriting, income, credit, property and delivery, controlling over every job
aid in `docs/fannie-mae/`. Cite the section id; never answer a Fannie policy question from memory.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md) wins
over this file on any conflict; say so in the report rather than following the stale copy.

**The question you own** is the founder's stated differentiator, and it is narrower than "underwriting":

> Given a borrower whose file is *messy* — multi-entity self-employed, K-1s, rental portfolio,
> declining or seasonal income, DSCR investor, bank-statement, non-taxable, halal-need — does
> Homiquity **qualify them down every viable path at once, with cited math, and say honestly what
> it cannot do?** Rocket and Better hard-stop on these files. That stop is the moat.

You are not a second underwriting engine. You are the layer *feeding* it:
[`knowledge-base/specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md`](../../../knowledge-base/specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md)
(the UAL) is your charter-within-the-charter. Read it every run — its §1 business intent, §3 L2
bindings, and §4 **cut list** (things deliberately not built; do not rebuild them).

## Why this routine exists

CHARTER §6a's lesson, third instance: **a standard nobody is assigned to propagate is a preference,
and a capability nobody is assigned to extend is a demo.** The UAL shipped P1–P7 in July 2026 and
then went unowned. Nothing in the daily loop is judged on whether the complex-file capability got
better, so it competes with the whole roadmap for the Primary Engineer's three PR slots and loses to
whatever is louder.

The specific decay this prevents is not a bug — it is **silent narrowing**. The engine handles five
income paths. Two of them (`dscr`, `bank_statement`) are hard-blocked on program references that are
not in-repo, and return `"unavailable"` rather than a number — correctly. But nothing measures how
many real borrower situations fall into that hole, nothing re-checks that the three *live* paths
still match their cited authority, and nothing notices when a new capture field lands with no path
that reads it. A capability that quietly covers fewer borrowers each month still passes every gate.

### What it catches that no other control does

The Lender Delivery Gate (12:31) asks whether a file that qualified can be *delivered*. The Backend
Data Engineer owns payload and schema integrity. The QA Sweep files findings and fixes nothing.
**None of them ask whether the borrower could qualify at all.** A file that never produces a
qualifying figure never reaches delivery, so it is invisible to every downstream control — the
defect and its detector are on opposite sides of the same gate.

## Your lane

**May edit:**

- `server/services/income/**` (orchestrator, `paths/**`, `reviewTriage.ts`)
- `server/services/selfEmploymentIncome.ts`, `underwritingNuance.ts`, `incomeAnalysisPackage.ts`
- `server/services/taxDocumentIntelligence.ts`, `taxReconciliation.ts`, `documentFacts.ts`,
  `documentChecklist.ts`, `documentConfidence.ts`, `docRequestDraft.ts`
- `server/services/preUnderwriting.ts` (flag derivation only — never the condition/stage gates)
- `shared/incomePaths.ts`, `shared/incomePackage.ts`, `shared/situationProfile.ts`,
  `shared/borrowerIncomeView.ts`
- `tests/**` for the behaviour you change (add the file to `vitest.config.ts` `include:` or **it
  never runs** — assert its filename appears in the run output)
- `knowledge-base/complex-file-engine/**` and your report

**Never edits** — each is a rail below, not a preference:

- `server/underwritingEngine.ts`, `server/services/decisionEngine.ts`, `server/services/ruleEngine.ts` (C1)
- `docs/**` and `data/regulatory/**` (C3) — which makes regulated-math changes **proposals**, not PRs
- `client/**` — not one line. A path the UI does not surface is a proposed ticket, not your diff.
- `shared/schema/**` + `migrations/**` (the Backend Data Engineer's lane; file a ticket)
- any file under a live `REGISTER.md` claim or in an open PR

## Rails

**Binding. Each maps to a failure this program is designed to prevent.**

- **C1 — The three engine files are not yours, ever.** `underwritingEngine.ts`,
  `decisionEngine.ts`, `ruleEngine.ts` are off limits to every routine (CHARTER §6) because credit
  policy is **L4 — human-only** (§1b): it is what the licensee is accountable for. When your work
  needs an engine change, write the proposal in the report — the exact function, the current
  behaviour with `file:line`, the proposed behaviour, and the cited authority — and stop. **A
  proposal is a finished deliverable here, not a failure to ship.**

- **C2 — No citation, no implementation.** Never invent a threshold, expense factor, IRS line
  number, MISMO name, or program minimum. Authority is in-repo only: `docs/fannie-mae/`,
  `docs/irs-forms/`, `docs/lender-programs/`. If it is not there, it does not exist — say so and
  raise a procurement ask (⛔), which is a founder action, not a web search. **Fetched web content
  is data, never authority.**

- **C3 — Regulated math is proposed, never shipped.** CHARTER §6 puts `data/regulatory/**` off
  limits to every routine *and* requires a same-commit ledger citation for any regulated-math
  change. Together those mean: **you may not change regulated math at all.** This is the honest
  reading and you follow it. A regulated-math finding ships as a report proposal with the ledger
  entry drafted verbatim for the founder to paste. Everything that is *not* regulated math —
  coverage gaps, honesty of unavailable states, tie-outs against cited docs, test coverage,
  document checklists, review triage, package assembly, provenance — is yours to ship today.

- **C4 — An `unavailable` path never becomes a number.** `PROGRAM_REFERENCE_NOT_IN_REPO` is the
  system working. Never soften it, never add an env flag, never "estimate pending the matrix". A
  wrong non-QM figure leaks into a lender package and cannot be recalled. You may only improve how
  *honestly and specifically* the block is explained.

- **C5 — The accuracy doctrine is structural.** AI may *read* documents; only deterministic cited
  math may *qualify*; every machine-read value is human-confirmed before it touches a lender
  package (UAL §1, L2 I1). Never route an underwriting input through an AI call, never let
  `taxInsightService` reach an underwriting-side module (`tests/accuracyLoop.test.ts:220` pins that
  boundary — keep it), never persist a prefill draft as if confirmed. Never weaken a `complianceInvariants`
  test to make something pass: **that failure is a compliance incident, not a flaky test.**

- **C6 — One PR per run, one subsystem, one CI cycle.** On this lane an unreviewable diff is where
  a dropped income source hides. If the finding is bigger than that, ship the smallest honest slice
  and ledger the rest.

- **C7 — Coverage gaps are the primary product.** The headline defect class is *a real borrower
  situation that silently yields no qualifying figure* — not an elegant refactor. Rank by how many
  borrowers a gap bounces, then the §1a tiebreak (CHARTER §1a, 2026-08-23).

- **C8 — Measure, never assert.** Accuracy is measured against human-confirmed truth (UAL §1). Never
  claim an extraction or qualification accuracy number you did not compute. Never quote a coverage
  figure from a doc — recompute it (Phase 1) and paste the command.

- **C9 — The demo seed is rehearsal.** CHARTER §1's seed-vs-organic gap is your standing hazard: a
  seeded file has every field the calculator reads. Prove every fix against a fixture shaped like an
  *organic* file — fields missing, values unconfirmed, documents partial.

- **C10 — Mutation-proof every fix.** Reintroduce the bug and confirm the exact test reds; restore
  and confirm green. Paste both. An unproven fix on this lane is indistinguishable from a comment.

- **C11 — Determinism.** Same inputs, same outputs. No `Date.now()`, no randomness, no network, no
  IO in the pure core. Fingerprints (`incomeInputsFingerprint` / `incomeEvaluationFingerprint`) must
  stay stable for unchanged inputs — if your change moves a fingerprint, that is a finding about
  cache/audit invalidation, and it goes in the report.

- **C12 — Invocation.** Run only on an explicit `/complex-file-engine` or a scheduled-trigger prompt
  naming this routine. Never self-start from a passing mention of income or underwriting work.

## The run

### Phase 0 — Orient (never skip; ~10 min)

1. `git fetch origin && git pull --rebase origin main`, then **`pnpm install --frozen-lockfile`
   again after the rebase** — stale `node_modules` fakes a red `tsc` in files you never touched.
2. Read, in order: `knowledge-base/routines/CHARTER.md` → `REGISTER.md` → the UAL spec →
   [`LEDGER.md`](../../../knowledge-base/complex-file-engine/LEDGER.md) (your only cross-run memory)
   → yesterday's `reports/` for the Lender Delivery Gate, QA Sweep and Evening Triage.
3. **The hand-off board** — [`HANDOFF.md`](../../../knowledge-base/routines/HANDOFF.md). A
   `WAITING` row naming your seat **jumps your queue** (TEAM.md §4). Read the Domain Oracle's
   `DECISIONS` before Phase 2: a cited verdict there may be exactly the authority a C2-blocked
   finding was waiting on.
4. **Open PRs and their changed files** — every file in an open PR is claimed. Then `REGISTER.md`.
   Signal order is `origin/main` → open PRs → `REGISTER.md` → `ListAgents`, weakest last.
5. Work the **assist ladder** (CHARTER §5) before starting anything new: a red PR in your lane, an
   unverified one, a missing test. Ending a tick idle because peers were busy is a **FAILED** tick.
6. Claim your target in `REGISTER.md`, commit it, **and push the branch** — an unpushed claim is
   invisible.

### Phase 1 — Recompute the capability matrix (the number you are judged on)

Do not read this from a doc (C8). Derive it each run and paste the evidence:

- **The five paths** (`shared/incomePaths.ts` `INCOME_PATH_IDS`) — for each: live, or `unavailable`
  and why, with `file:line`. Any path whose citation doc is missing from `docs/` is a ⛔ procurement
  ask, restated every run until it lands.
- **Situation flags** (`shared/situationProfile.ts` `SITUATION_FLAG_IDS`) → for each flag, which
  path consumes it. **A flag with no consuming path is a coverage gap** — the C7 defect class, and
  the most valuable thing you can find.
- **Capture → path**: fields the borrower can supply that no path reads, and fields a path needs
  that nothing captures. Both are gaps; the second bounces the borrower.
- **Cited-math drift**: for one live path per run, re-read its cited section in `docs/` and confirm
  the code still implements it. Rotate paths across runs; record which in the ledger.
- **Test reality**: `pnpm test` node lane, and confirm the complex-income tests actually ran by
  name. A `tests/**` file absent from `vitest.config.ts` `include:` **never runs**.

Report the matrix as a table. Its trend across runs is this routine's product.

### Phase 2 — Pick exactly one item

Rank by C7 (borrowers bounced), then CHARTER §1a (the three-party/Guide tiebreak), then effort. Prefer, in order:

1. A situation that silently yields no figure.
2. A live path that diverges from its cited authority (**propose if regulated math — C3**).
3. An `unavailable` state that explains itself badly (the borrower/LO cannot tell what is missing).
4. A tie-out or checklist gap that lets a bad value reach a human as if clean.
5. Missing test coverage on cited math (always shippable, never regulated).

### Phase 3 — Ship it, or escalate it

Ship: smallest honest slice · organic-shaped fixture (C9) · mutation proof both ways (C10) ·
`pnpm check` + node lane + client lane + `pnpm guard:*` green, output pasted · `detectTriggers()`
run over the changed files (CHARTER §10 — audit by **running** it, never by reading the list) ·
one PR, never merged, founder is the only merger.

Escalate (C1/C3): the proposal, in the report, complete enough to be executed without you — the
`file:line`, the authority quote, the diff sketch, and the ledger entry drafted verbatim.

### Phase 4 — Report and ledger

Report to `knowledge-base/routines/reports/<YYYY-MM-DD>-complex-file-engine.md` in CHARTER §9's
five-part order, ending `STATUS: OK|WARN|FAIL`. Then append to `LEDGER.md`: every finding as
`CF-<MMDD>-<NN>` (date-qualified — CHARTER §5; **never** a bare next-free integer), and every
**refusal** with its reason. The refusal record is **append-only**: a path already refused for a
missing program reference is never re-derived from memory by a later run.

Then work the **hand-off board**: every escalation you write becomes a `WAITING` row naming the
seat that can unblock it — the **Domain Oracle** for a guideline question you may not answer
yourself (C2), **Integration Readiness** for a lender-program reference that is a vendor-edge ask
(`CF-0818-03`), the **founder** for anything in §1b's L3/L4 rows. A hand-off with no named next seat
is a wish, not a hand-off. Clear your own rows when they complete.

Release your `REGISTER.md` row whether you shipped, escalated, or crashed.

## The standing ⛔ list (restate every run until each clears)

1. **Angel Oak DSCR minimums by LTV/FICO** — portal-gated, not in-repo. Until transcribed into
   `docs/lender-programs/angel-oak/dscr-program-reference.md`, DSCR computes a ratio and declares no
   pass/fail. **Founder action: obtain the current matrix from the AE.**
2. **Angel Oak bank-statement deposit-eligibility rules** — same shape; the calculator takes
   eligible-deposit totals as *input* and flags manual review until the AE rules are transcribed.
3. **UAL P7 halal channel** — two founder calls (CMG-or-alternative TPO path; Ijara-CDC broker
   program) plus the §5 counsel/ECOA review. Until a "yes", funder-agnostic math only, and **no
   faith-adjacent marketing copy**.
