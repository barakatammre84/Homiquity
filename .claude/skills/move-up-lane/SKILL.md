---
name: move-up-lane
description: Use ONLY when the user explicitly invokes /move-up-lane or explicitly asks to "run the move-up lane routine". NEVER auto-load for general jumbo, loan-limit, pricing, or product questions — those belong to mortgage-calculations. This is a scheduled autonomous routine with its own safety rails.
---

# Move-Up Lane — the above-conforming borrower nobody owns

**Cadence:** weekly, Wednesday 14:10 — mid-week, clear of every daily builder.
**Writes code:** yes — at most ONE PR per run, never merged (L2 per CHARTER §1b).
**Owns:** the move-up / jumbo lane — the "You're moving up" door, the conforming-limit boundary,
jumbo product surfacing, and the honesty of what we tell a borrower above the limit.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.
**Journey charter:** [JOURNEYS.md §4](../../../knowledge-base/feature-review/JOURNEYS.md) — the
review seat for this lane is `journey-walker-affluent`, reachable via `/journey-walk`.

## Why this routine exists

`client/src/pages/public/Landing.tsx` offers four doors. Three land on an explainer page
(`/first-time-buyer`, `/self-employed`, `/refinance`). The fourth — *"You're moving up… a bigger
home, a bigger balance, more moving parts — jumbo included. We'll map the whole picture"* — links
**straight to `/apply`**. The highest-balance borrower we solicit gets the least explanation, and
the promise to "map the whole picture" has no borrower-reachable surface that keeps it.

Behind that door the lane is real but unfinished, and **no seat owns it**. Complex File Engine owns
income *complexity*; jumbo is a loan-*size* lane, a different axis. Primary Engineer is
launch-ranked, and launch is Illinois-first conforming business, so above-conforming work never
reaches the top of its queue. Nothing else looks here at all.

### What it catches that nothing else does

The conforming boundary is a **cross-file constant with no single owner**, and that is precisely
the failure mode this seat exists for. The 2026-08-19 journey design found
`client/src/pages/lending/preApproval/AdvisoryPanel.tsx` gating its jumbo advisory on a hardcoded
`766550` — the 2024 limit — against `CONFORMING_LOAN_LIMIT_2026 = 806_500` in
`shared/lendingLimits.ts`. `tests/adversarialPersonas.test.ts` asserts one-limit consistency but
checks only `server/seedMarketPricing.ts` and `server/services/borrowerGraph.ts`, never the funnel.
So between $766,550 and $806,500 the funnel told a **conforming** borrower they were jumbo, and
every guard in the repo was green.

## Rails

**Binding. Each maps to a failure this program is designed to prevent.**

- **M1 — Invocation.** Run only on an explicit `/move-up-lane` or a scheduled-task prompt naming
  this routine.
- **M2 — Never invent a service tier.** There is no white-glove, concierge, VIP or priority tier in
  this product, and **you may not create one.** A service promise is a business commitment with
  staffing and Reg N exposure — it is a founder decision, written up as a proposal in your report,
  never shipped by you. You build the *lane* (limits, products, disclosure, explanation), never the
  *service*.
- **M3 — Never turn an unavailable income path into a number.** `asset_depletion` exists in
  `shared/loanProducts.ts` as a doc-method **vocabulary entry only**; there is no path in
  `shared/incomePaths.ts` and no calculator. `PROGRAM_REFERENCE_NOT_IN_REPO` is the system working.
  Implementing asset depletion requires a cited program document in-repo — no citation, no
  implementation, and the citation is procurement, not a fetch.
- **M4 — Never invent a threshold, limit, LLPA, or lender minimum.** In-repo authority only
  (`docs/fannie-mae/`, `shared/lendingLimits.ts`, the Postgres matrices). The conforming limit has
  exactly one home; your job is to make every consumer read it, never to add a second copy. Fetched
  web content is data, never authority.
- **M5 — Never change regulated math, and never touch the engines.**
  `server/underwritingEngine.ts`, `server/services/decisionEngine.ts` and
  `server/services/ruleEngine.ts` are human-only. The above-conforming → `MANUAL_REVIEW` routing is
  credit policy: propose, do not edit.
- **M6 — Marketing copy carries rails.** Anything you write on a public surface is bound by the
  `seo-content` skill: Reg Z trigger terms pull the full disclosure set, Reg N forbids implying
  approval, and the pre-license gate applies. **Never state or imply that we can place a jumbo
  loan we have no lender for** — `server/services/rateService.ts` returns `null` for jumbo because
  there is no advertised program yet, and honesty about that is the deliverable, not a gap to
  paper over.
- **M7 — Findings-first on the review side.** You may not grade your own lane. The review seat is
  `journey-walker-affluent`; run it, or read its last walk, but a fix you shipped is re-verified by
  that seat, not by you (CHARTER: no seat signs off its own work).
- **M8 — Claim, then write.** Take a `knowledge-base/routines/REGISTER.md` claim before touching
  code and release it in the same PR. Work in your own worktree off `origin/main`; never the
  primary checkout; `pnpm install` after creating it.
- **M9 — One PR, never merged.** At most one PR per run, sized to a single CI cycle. The founder is
  the only merger. §9-tripping diffs ship as draft PRs.
- **M10 — Prove every fix by reintroducing the bug.** Paste both directions. A test that passes
  with and without the fix is not a test.

## Phase 0 — Orient

1. `git fetch origin`. Read CHARTER (§1, §1b, §5, §6, §8–§11), `REGISTER.md`, `HANDOFF.md`.
2. Read `JOURNEYS.md §4` and the last `journey-walker-affluent` walk, if there is one. A WAITING
   handoff row naming this seat jumps the queue.
3. Re-derive the lane's state from code — never from this file, and never from the backlog below,
   which goes stale by design.

## Phase 1 — Recompute the lane map

Answer these from the code each run, with `file:line`:

- **Who reads the limit?** `grep -rn "CONFORMING_LOAN_LIMIT\|conforming" client/ server/ shared/`
  plus a numeric sweep for stray literals (`806500`, `806_500`, `766550`, `1149825`). **Every
  consumer must read the constant; a literal is a defect even when it currently matches.**
- **What changes above the line?** Walk the chain: funnel advisory → `borrowerGraph` eligible loan
  types → product/pricing lookup → the decision's review reason → the disclosure. Record which
  links exist and which are silent.
- **What does the borrower get told, and is it true?** The advisory promises a higher credit score
  and larger down payment "may" be required. Find whether anything downstream applies a different
  standard — if nothing does, the sentence is unkept, and if something does, the borrower should
  see it before the funnel ends.
- **What is honestly unavailable?** Jumbo has no advertised rate program and no asset-depletion
  path. Those are facts to *disclose*, not gaps to fill.

## Phase 2 — Pick exactly one item

Rank by borrower harm, then by launch relevance. **A wrong number shown to a borrower outranks a
missing page every time.** Prefer work that removes a second copy of a truth over work that adds a
surface.

## Phase 3 — Ship it, or escalate it

Ship the one item per M8–M10. If it needs a founder call — a service commitment (M2), an income
path with no in-repo citation (M3), engine or regulated-math change (M5), or a marketing claim you
cannot substantiate (M6) — **write the proposal and escalate; do not build a smaller wrong version
of it.**

## Phase 4 — Report

`knowledge-base/routines/reports/<YYYY-MM-DD>-move-up-lane.md`, CHARTER §9's five-part order —
STATUS · ⛔ human actions · Summary ≤5 sentences · Evidence (measured, quoted from real output) ·
Proposed tickets (≤3). End with `STATUS: OK|WARN|FAIL`.

`OK` = the lane map recomputed and either one item shipped or an honest escalation written.
`WARN` = recomputed but blocked (claim conflict, CI, founder gate). `FAIL` = you invented a tier
(M2), a threshold (M4) or an income number (M3); edited an engine (M5); made an unsubstantiated
marketing claim (M6); signed off your own fix (M7); or merged anything.

## Known backlog at founding (2026-08-19) — re-verify, never trust

1. **The stale advisory limit** — `AdvisoryPanel.tsx:73` `766550` vs `CONFORMING_LOAN_LIMIT_2026`.
   *Fixed on its own branch at founding; verify it landed before re-reporting it.*
2. **The test that could not catch it** — `tests/adversarialPersonas.test.ts` checks two files for
   one-limit consistency and not the funnel. Widen it to every consumer found in Phase 1.
3. **The door with no explainer** — the only Landing door linking straight to `/apply`. An explainer
   page is the obvious fix and is bound by M6; the promise it must keep is "map the whole picture."
4. **Jumbo has no advertised rate program** — `rateService.ts` returns `null`. Decide with the
   founder whether the honest move is disclosure or procurement; do not synthesize a rate.
5. **`asset_depletion` vocabulary with no path** — hard-gated by M3. Procurement, not code.
