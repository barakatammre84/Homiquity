# Financial Audit — Ledger

The cross-run memory of the `/financial-audit` routine
([`.claude/skills/financial-audit/SKILL.md`](../../.claude/skills/financial-audit/SKILL.md)).
Every tick reads this file **before** choosing work (rail R2) and updates it in the same PR
as the change it describes. Ids are `F-###` in discovery order and are **never reused** —
they are the same ids the dated audit logs cite.

> ## ⚠️ THE `F-2x` ID NAMESPACE HAS COLLAPSED — read before citing or minting an id
>
> **There are NINE financial audits, one per day from 2026-08-04 to 2026-08-12**, and **six of
> them independently minted ids starting at `F-20`**. `F-20` currently means six different
> findings. A bare `F-2x` cite is meaningless.
>
> | audit | ids minted | where | one-line subject |
> |---|---|---|---|
> | 08-04 | F-1…F-16 | `main` | the founding audit — unambiguous, still canonical |
> | 08-05 | F-17…F-19 | `main` | QM dead band, election-time gate, finance-charge symmetry |
> | 08-06 | — | `main` | pricing-policy control plane |
> | 08-07 | F-20…F-23 | PR [#489](https://github.com/barakatammre84/Homiquity/pull/489) | counterparty gate absent at price formation; no receivable; ungated TRID re-pricing; register has no denominator |
> | 08-08 | F-20…F-24 | **`main` (merged)** | commission payouts as cost; payout unbounded by revenue; platform fees absent from revenue; cash-conversion; money-out audit |
> | 08-09 | F-20…F-23 | PR #489 | dual-comp guard covers one fee of three; revenue single-channel; recorded vs charged comp; debit-only ledger |
> | 08-10 | F-20…F-25 | PR #489 | **near-duplicate of 08-12 — see below** |
> | 08-11 | F-20…F-26 | PR #489 | revenue pinned by the QM cap; fee trim as unrecorded concession; platform fees not revenue |
> | 08-12 | F-20…F-23 | this branch | confirmation is a presence test; revenue simulation-blind; authorization audit trail; no EPO write surface |
>
> ### The duplication this cost, stated plainly
>
> **The 08-10 audit found what the 08-12 audit found, two days earlier**, and has been sitting
> unmerged on a docs branch the whole time:
>
> | 08-10 finding | 08-12 finding |
> |---|---|
> | F-20 a simulated confirmation counts as the lender's obligation — honor exposure reports $0 | F-20, same defect, same $0 register consequence |
> | F-21 the rate-lock route accepts fictional demo lenders the submission path hard-blocks | F-20(a), same |
> | F-22 there is no implemented path to approve a lender — the revenue switch does not exist | F-22 + the `/admin/lenders` build |
> | F-23 two surfaces compute EPO exposure over different windows | F-23 / the `epoClawbackDays` work |
>
> Four findings, discovered twice, by two sessions that could not see each other. The second pass
> also *fixed* them — so the fix is real and not wasted, but the **audit** was duplicated. This is
> the concrete cost of per-session id minting and unmerged memory, and it is the reason for the
> allocation rule below.
>
> ### How to cite until this is resolved
>
> **Always qualify with the audit date: `F-21 (08-09)`.** Never a bare `F-21`.
>
> ### Resolution — owner decision, not taken unilaterally
>
> Renumbering one branch is no longer sufficient; six sets collide. The two workable schemes:
> **(a) date-qualified ids** (`F-0810-01`) — no renumbering of history, every existing cite stays
> readable once qualified; or **(b) one monotonic register on `main`** that each audit appends to
> *before* publishing, renumbering the five unmerged sets on the way in. (b) is cleaner long-term,
> (a) is cheaper today. Either way TEAM_PRACTICES §2 forbids rewriting the published logs in
> place — the mapping goes in a supersession banner.
>
> ### Allocation rule, effective now
>
> Ids are allocated **in this file on `main`**, never minted per-session from "next free". A
> session that cannot see `main`'s ledger records `F-NEW-<slug>` and numbers it on rebase. This is
> the cheap rail that would have prevented all six collisions.

Seeded 2026-08-12; **corrected the same day** after tick 1 discovered six further audits. Not three —
nine. Five are on `main` (08-04, 08-05, 08-06, 08-08, and the merged history), four are stranded
on PR [#489](https://github.com/barakatammre84/Homiquity/pull/489) (08-07, 08-09, 08-10, 08-11),
and 08-12 is on this branch. **A tick that reads only `main` sees barely half the audit history** —
which is why Phase 0.4 reads open PRs, not just `main`.

## Status vocabulary

- `open` — a verified finding, not yet authorized for a fix. **The routine reports it; it
  does not fix it.** Discovery is not permission (R7).
- `authorized` — the owner has approved a fix. Only these are eligible for Phase 2, one
  per tick.
- `in-pr` — a fix PR is open (URL in evidence). Not re-picked.
- `done` — fixed and merged, or verified resolved (date + evidence).
- `blocked-human: <reason>` — needs an owner decision, counsel, or a document this
  environment cannot fetch. The routine only annotates these.
- `blocked-collision: <PR#>` — another session has an open PR touching the same files
  (Phase 0.4). Re-evaluate once that PR lands.
- `sound` — audited and found correct. Recorded so it is not "re-discovered" as a defect,
  and so a regression is visible as a *change* from sound.
- `failed: <reason>` — a fix attempt was discarded. Needs the reason addressed first.

## Open — the routine reports these, and fixes none of them without authorization

| id | area | sev | summary | status | evidence |
|----|------|-----|---------|--------|----------|
| F-9 | risk | Medium | Third-party fee constants are unsourced national guesses in a **zero-tolerance** bucket. Architecture fixed (provenance tiers, `suspectedInaccurate` on transfer taxes); the **values** remain `platform_estimate`. Illinois transfer tax is levied at state, county AND municipal level against a single 0.1% national constant | `blocked-human`: needs a human with the Illinois statute — `ilga.gov`, `tax.illinois.gov`, `chicago.gov` are all blocked from this environment | `shared/compliance/feeProvenance.ts`; ledger `platform-closing-cost-fee-schedule` (30-day interval) |
| F-14 | capital efficiency | Escalation | Broker vs. mini-correspondent. One constant, and the largest unanswered question about the capital structure: under correspondent, F-16 dies, a warehouse line becomes necessary, duration mismatch becomes real, and the contingent-liability register is materially incomplete | `blocked-human`: founder decision | [CHANNEL_DECISION.md](../governance/CHANNEL_DECISION.md); `shared/businessChannel.ts`; freeze guard holds 1,482 lines at baseline |
| F-17 | unit economics | High | The QM dead band was resolved in code (fees now trim to fit), but the **business lever** remains: at ~300 bps compensation alone exceeds the cap and no fee reduction rescues the file. Fees are no longer the constraint at any loan size; the comp plan is | `blocked-human`: a negotiation, not a code change | [2026-08-05 log](../logs/2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md) §Resolution |
| F-24 | balance sheet | Medium | **Minimum net worth and surety bond are unquantified**, so reserve adequacy cannot be answered — every contingent exposure is a claim against exactly the net worth the licence requires be maintained. Verified 2026-08-12 that the local NMLS guidebook (Ch. VII, pp. 120/122) is filing mechanics only and defers the amount to state law. Structural note: the requirement is the **most stringent state in the footprint**, so multi-state expansion moves the floor *discontinuously* — an expansion plan's licensing line is a `max()`, not a sum | `blocked-human`: needs the Illinois RMLA statute | [CONTINGENT_LIABILITY_REGISTER.md](../governance/CONTINGENT_LIABILITY_REGISTER.md) §2 |
| F-25 | risk | Low | Reg Z readings shipped ahead of verification (dual compensation §1026.36(d)(2), points-and-fees §1026.32(b)(1)(ii), the §1026.4(a)(3) finance-charge question, the tax-service-fee classification, LE Section C tolerance tier). All are conservative in one direction only, and all carry short review intervals so `pnpm checkup` goes loud | `blocked-human`: `docs/reg-z/` holds no authoritative source text; every federal host is blocked | `data/regulatory/regulatory-ledger.json`; [docs/reg-z/README.md](../../docs/reg-z/README.md) |
| F-26 | balance sheet | Low | The clawback register quantifies exposure but **does not monitor for actual payoffs** — nothing tells the platform a loan paid off, so `totalAtRisk` is exposure, never realized loss. EPD (early-payment-default) repurchase provisions are also unmodeled | `open` | `shared/compensationClawback.ts`; noted in the F-8 remediation |
| F-27 | unit economics | Medium | Gross margin is an **upper bound** and says so: loan-officer compensation, processing labour and overhead allocation are modeled nowhere, so the cost side is direct vendor spend only | `open` | `shared/costLedger.ts` `computeUnitEconomics` notes |

## Closed — recorded so they are not re-discovered, and so a regression reads as a change

| id | summary | status |
|----|---------|--------|
| F-1 | Dual-compensation transaction on every file (Reg Z §1026.36(d)(2)) | `done` 2026-08-04 — comp model is a required input; lender-paid ⇒ borrower-paid origination is zero |
| F-2 | QM points-and-fees cap structurally unenforced, failing open | `done` 2026-08-04 — three-valued verdict off a computed floor; never passes on missing evidence |
| F-3 | "Phantom lock" — rate commitments with no lender-side lock | `done` 2026-08-04 — confirmation fields required (see also F-20, which fixed what "confirmed" *means*) |
| F-4 | Zero-tolerance cure liability unmodeled and untracked | `done` 2026-08-04 — immutable `loan_estimate_disclosures` baseline + tolerance engine |
| F-5 | Counterparty capacity zero, and submission did not check | `done` 2026-08-04 — `evaluateLenderSubmissionEligibility`; hardened by #417's fail-closed `approval_status` |
| F-6 | No revenue, receivable, or compensation representation | `done` 2026-08-04 — two-sided comp lifecycle; funding requires the money |
| F-7 | LE Section A omitted its largest line from the itemization | `done` 2026-08-04 |
| F-8 | EPO/EPC clawback exposure unrepresented | `done` 2026-08-04 — register + the refi-alert self-attack guard |
| F-10 | Lock-extension fee had no payer attribution | `done` 2026-08-04 |
| F-11 | No cost side, unmetered vendor COGS, pull-through unmeasurable | `done` 2026-08-04 — `loan_cost_entries` + unit economics |
| F-12 | Reg Z Total Loan Amount stand-in erred permissive | `done` 2026-08-04 |
| F-13 | No contingent-liability register; reserve adequacy unassessable | `done` 2026-08-04 — `quantifiedFloor`, never called a total |
| F-15 | RESPA §8 discipline — referral spines carry no payout columns **by design** | `sound` — preserve verbatim; the pressure to add a partner payout field will arrive |
| F-16 | Asset-light structure is correct; no money movement anywhere | `sound` — re-verified 2026-08-12. **F-14 is the one thing that would invalidate it** |
| F-18 | QM constraint evaluated after its own remedy expired | `done` 2026-08-05 — evaluated at the compensation election |
| F-19 | Tax service fee counted in the QM denominator but not the numerator | `done` 2026-08-05 — one `PLATFORM_FINANCE_CHARGES` list feeds both |
| F-20 | "Confirmed" was a presence test, not a counterparty test — a lock against a fictional lender booked as the lender's obligation, and the register priced it at $0 | `done` 2026-08-12 |
| F-21 | Revenue ledger simulation-blind while the cost ledger beside it was simulation-aware — margin subtracted real cost from imaginary revenue | `done` 2026-08-12 |
| F-22 | Lender authorization writable through the generic PATCH, audited by field name only | `done` 2026-08-12 — audited approval endpoint; columns off the generic write path |
| F-23 | `epoClawbackDays` had no write surface, pinning the reserve to an assumed window | `done` 2026-08-12 — captured at approval, corrected via contract-terms; plus `/admin/lenders` |

## Standing signals — where findings keep coming from

Recorded because three audits found the same *shapes*, not the same bugs:

1. **A shared rule with exactly one consumer.** Every 2026-08-12 finding traced to
   `evaluateLenderSubmissionEligibility` having one caller while three other money paths
   re-derived counterparty truth permissively. When a rule is extracted, grep every
   surface that should consume it.
2. **The measurement fails in the same direction as the defect.** The lock-honor line
   reported $0 for exactly the exposed locks (F-20); the revenue roll-up counted the
   simulated fundings it existed to distinguish (F-21). Audit the register, not only
   the mechanism.
3. **A column written but never read.** `simulated` was populated correctly for a week
   and consumed by no financial computation (F-21). `grep` for readers, not writers.
4. **A capability with no surface.** The approval endpoint, and `epoClawbackDays`, existed
   with no UI — so the only way to use them was a direct DB write (F-22/F-23). See
   [UNCONSUMED_CAPABILITIES.md](../governance/UNCONSUMED_CAPABILITIES.md).
5. **Asymmetric discipline between siblings.** The cost ledger was scrupulous about
   simulation while the revenue ledger beside it was blind. When one module is careful,
   check its neighbour.

## The 2026-08-08 audit's findings (another session, merged) — do not re-discover

Recorded so this routine does not re-audit money the other session already walked. Ids are
**that audit's**, canonical on `main`.

| id (08-08) | summary | status |
|----|---------|--------|
| F-20 | `broker_commissions` — a live payout table reaching no margin figure, balance sheet or audit log, while `costLedger.ts` asserted commissions were "not captured anywhere". A declared gap and an unjoined table look identical in a margin figure and are entirely different problems | `done` — charged by lifecycle state; approved-but-unpaid booked as a payable; disbursed commission inside a live EPO window reported as loss *on top of* the clawback, not netted |
| F-21 | Payout struck as 0–10% of loan amount with no reference to the file's compensation and no funded gate — a $25,000 payable against $5,000 of revenue was permitted | `done` (`shared/commissionPayout.ts`) — but its **Reg Z §1026.36(d)(1) / RESPA §8 posture needs counsel**: ledger `regz-1026-36d1-referral-commission-payout`, roadmap 1.10, roadmap 3.7 blocked on it |
| F-22 | Borrower-paid platform fee income (~$2,000/file) absent from the revenue line — so with their F-20, **both sides of the margin were wrong in opposite directions** | `open` — policy decided 2026-08-08 (recognize on receipt); implementation is roadmap 3.14 |
| F-23 | Cash-conversion cycle computed nowhere despite every operand recorded, including `compensation_received_at` read by nothing | `done` — `daysToCash` measures funded → remittance and stays **null** rather than collapsing to the funding cycle when the lag is unmeasured |
| F-24 | Money-out routes unaudited: a $30 credit pull was audited, opening a payable worth up to 10% of the loan amount was not | `done` — four-eyes on disbursement left as a founder call (enforcing a second approver on a one-person company would block the only path to paying anyone) |

**Convergence worth noting:** their working-capital loop skips `simulated` cost entries for the
same reason the 08-12 pass excluded simulated revenue — two independent audits reached the same
rule. That agreement is evidence the rule is right, and it is why the two changes merged cleanly.

## Run log

| tick | base | mode | outcome |
|------|------|------|---------|
| 2026-08-12 t0 | `2444950` | audit + fix | 08-12 findings found, verified by execution, fixed under owner authorization; `/admin/lenders` built; routine installed |
| 2026-08-12 t1 | `3ba30c9` | refresh-only (R3) | **Branch was 15 commits behind** — refresh was the whole tick, exactly as R3 intends. Merged `origin/main`: 7 overlapping files, 3 conflicts (`costLedger.ts`, `submissions.ts`, KB README), all resolved additively — the two sessions' changes were complementary, not contradictory. `contingentLiabilityRegister.ts` auto-merged and was re-verified by hand (both `epoClawbackDays` and `simulated` present) because a silent auto-merge in a money path is not evidence. 3,079 tests green post-merge. **Found the id collision above** — the first thing the team-sync rail caught |
