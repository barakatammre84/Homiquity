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
> | 08-07 | F-20…F-23 | `main` ([#489](https://github.com/barakatammre84/Homiquity/pull/489)) | counterparty gate absent at price formation; no receivable; ungated TRID re-pricing; register has no denominator |
> | 08-08 | F-20…F-24 | **`main` (merged)** | commission payouts as cost; payout unbounded by revenue; platform fees absent from revenue; cash-conversion; money-out audit |
> | 08-09 | F-20…F-23 | `main` (#489) | dual-comp guard covers one fee of three; revenue single-channel; recorded vs charged comp; debit-only ledger |
> | 08-10 | F-20…F-25 | `main` (#489) | **near-duplicate of 08-12 — see below** |
> | 08-11 | F-20…F-26 | `main` (#489) | revenue pinned by the QM cap; fee trim as unrecorded concession; platform fees not revenue |
> | 08-12 | F-20…F-23 | this branch | confirmation is a presence test; revenue simulation-blind; authorization audit trail; no EPO write surface |
>
> ### The duplication this cost, stated plainly
>
> **The 08-10 audit found what the 08-12 audit found, two days earlier**, and sat unmerged on a
> branch with no PR for three days — invisible to `gh pr list` and to every other session:
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
> ### RESOLVED — date-qualified ids, adopted 2026-08-12
>
> **Scheme:** `F-<MMDD>-<NN>` — the date of the audit that minted the finding, then a
> two-digit ordinal within that audit. `F-0810-01` is the 08-10 audit's first finding.
>
> Chosen over a central register because it is **unique by construction, with zero
> coordination**: a session that cannot see `main` can still mint a correct id. A central
> register reintroduces the exact dependency that broke here — it requires visibility before
> you can name a finding, and visibility is what fails.
>
> **`F-1` … `F-19` are NOT renumbered.** They have a single origin (08-04, 08-05), are
> unambiguous, and are cited throughout the code, the roadmap and the governance docs.
> Requalifying them would be churn against zero collision risk. The scheme applies from the
> collided `F-2x` space onward.
>
> **Cross-reference for the six collided sets** — old cite → new id. Published logs keep their
> original text (TEAM_PRACTICES §2 forbids rewriting a log in place); each carries a
> supersession banner pointing here.
>
> | audit | old | new |
> |---|---|---|
> | 08-07 | F-20 … F-23 | `F-0807-01` … `F-0807-04` |
> | 08-08 | F-20 … F-24 | `F-0808-01` … `F-0808-05` |
> | 08-09 | F-20 … F-23 | `F-0809-01` … `F-0809-04` |
> | 08-10 | F-20 … F-25 | `F-0810-01` … `F-0810-06` |
> | 08-11 | F-20 … F-26 | `F-0811-01` … `F-0811-07` |
> | 08-12 | F-20 … F-23 | `F-0812-01` … `F-0812-04` |
>
> Ordinals follow each log's own severity table, top to bottom.
>
> ### Allocation rule, effective now
>
> Mint `F-<MMDD>-<NN>` using **your audit's date**, and never a bare next-free integer. No
> lookup, no register, no coordination — which is the point.

Seeded 2026-08-12; **corrected the same day** after tick 1 discovered six further audits. Not three —
nine. **Eight are now on `main`** — 08-04 … 08-11, after [#489](https://github.com/barakatammre84/Homiquity/pull/489)
landed the four that had been stranded on branches *with no pull request at all* (08-07, 08-09,
08-10, 08-11 — invisible to `gh pr list`, one of them for six days). 08-12 is on this branch.
**When those four were stranded, a tick reading only `main` saw barely half the audit history** —
which is why Phase 0.4 reads open PRs *and* recent branches, not just `main`.

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
| `F-0812-05` | balance sheet | Medium | **Minimum net worth and surety bond are unquantified**, so reserve adequacy cannot be answered — every contingent exposure is a claim against exactly the net worth the licence requires be maintained. Verified 2026-08-12 that the local NMLS guidebook (Ch. VII, pp. 120/122) is filing mechanics only and defers the amount to state law. Structural note: the requirement is the **most stringent state in the footprint**, so multi-state expansion moves the floor *discontinuously* — an expansion plan's licensing line is a `max()`, not a sum | `blocked-human`: needs the Illinois RMLA statute | [CONTINGENT_LIABILITY_REGISTER.md](../governance/CONTINGENT_LIABILITY_REGISTER.md) §2 |
| `F-0812-06` | risk | Low | Reg Z readings shipped ahead of verification (dual compensation §1026.36(d)(2), points-and-fees §1026.32(b)(1)(ii), the §1026.4(a)(3) finance-charge question, the tax-service-fee classification, LE Section C tolerance tier). All are conservative in one direction only, and all carry short review intervals so `pnpm checkup` goes loud | `blocked-human`: `docs/reg-z/` holds no authoritative source text; every federal host is blocked | `data/regulatory/regulatory-ledger.json`; [docs/reg-z/README.md](../../docs/reg-z/README.md) |
| `F-0812-07` | balance sheet | Low | The clawback register quantifies exposure but **does not monitor for actual payoffs** — nothing tells the platform a loan paid off, so `totalAtRisk` is exposure, never realized loss. EPD (early-payment-default) repurchase provisions are also unmodeled | `open` | `shared/compensationClawback.ts`; noted in the F-8 remediation |
| `F-0812-08` | unit economics | Medium | Gross margin is an **upper bound** and says so: loan-officer compensation, processing labour and overhead allocation are modeled nowhere, so the cost side is direct vendor spend only | `open` | `shared/costLedger.ts` `computeUnitEconomics` notes |
| `F-0816-01` | balance sheet | High | **A confirmed lock past its expiry, on a file that has not closed, is dropped from the contingent-liability register.** `contingentLiabilityRegister.ts:123` skips it as carrying "no forward commitment" — true of the lender's obligation, false of ours. Expiry is computed not stored, so lapsed rows still read `active`; the alert sweep is future-only and dedups to one notification per lock, so nothing else is watching either. Executed: a book with 2 of 3 locks lapsed reports **$900**, the healthy book **$2,700**. Same loop has no lifecycle input, so it also counts locks on files that already funded (conservative direction). Floor of **$900 per $400k of lapsed unclosed volume**; true cost is higher (post-expiry re-lock is worse-case priced) but unquantifiable without an executed broker agreement | `open` | [2026-08-16 log](../logs/2026-08-16-financial-architecture-reaudit-lock-lapse-and-remittance-float.md) `F-0816-01`; `server/services/contingentLiabilityRegister.ts:123`; `shared/statusVocabularies.ts:17-21` |
| `F-0816-02` | capital flow | High | **Committed working capital excludes every funded-but-unremitted file** — the exact cohort it exists to size. `costLedger.ts:220` specifies "files that have not reached cash"; the only caller (`submissions.ts:486-497`) filters on `status === "funded"`. Executed: ~**47% understatement** on a steady-state book. Also makes the Little's-Law projection internally inconsistent — `daysToCash` explicitly spans through the wire (`cycleTimeReport.ts:88-95`) while the cost base excludes that period. **Conceals and is concealed by `F-0814-04`**: fixing that one alone makes this worse | `open` | [2026-08-16 log](../logs/2026-08-16-financial-architecture-reaudit-lock-lapse-and-remittance-float.md) `F-0816-02` |
| `F-0816-03` | risk | Medium | **Counterparty concentration has no dollar measure.** `lenderId` is carried on every submission and clawback entry; nothing aggregates exposure, funded volume or revenue by it. The register presents every lender's obligations as one undifferentiated pool, so "if our largest counterparty exits, what fraction of the book moves?" is unanswerable. Concentration is visible only as two *counts*, both at the compliance layer (`approvedLenderCount`, anti-steering `singleCreditor`). **Verified by exhaustive grep — absence, not execution** | `open` | [2026-08-16 log](../logs/2026-08-16-financial-architecture-reaudit-lock-lapse-and-remittance-float.md) `F-0816-03` |

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
| `F-0812-01` | "Confirmed" was a presence test, not a counterparty test — a lock against a fictional lender booked as the lender's obligation, and the register priced it at $0 | `done` 2026-08-12 |
| `F-0812-02` | Revenue ledger simulation-blind while the cost ledger beside it was simulation-aware — margin subtracted real cost from imaginary revenue | `done` 2026-08-12 |
| `F-0812-03` | Lender authorization writable through the generic PATCH, audited by field name only | `done` 2026-08-12 — audited approval endpoint; columns off the generic write path |
| `F-0812-04` | `epoClawbackDays` had no write surface, pinning the reserve to an assumed window | `done` 2026-08-12 — captured at approval, corrected via contract-terms; plus `/admin/lenders` |

## Triage of the four landed audits (2026-08-12 tick 2)

21 findings across 08-07, 08-09, 08-10 and 08-11 — four audits of the **same codebase**, so most
are duplicates of each other or already closed by later work. Every status below was **verified
against HEAD**, not taken from the log that raised it. Date-qualified per the scheme above.

### Closed — do not re-raise

| id | finding | closed by |
|----|---------|-----------|
| `F-0810-01` | A simulated confirmation counts as the lender's obligation; honor exposure $0 | `F-0812-01` — verified: `isLenderConfirmed` requires `simulated === false` |
| `F-0810-02` | The rate-lock route accepts fictional demo lenders | `F-0812-01` — verified: route consumes `evaluateLenderLockEligibility` |
| `F-0810-03` | No implemented path to approve a lender — the revenue switch does not exist | `F-0812-03` + `/admin/lenders` — verified: approval endpoint + UI |
| `F-0810-04` | Two surfaces compute EPO exposure over different windows | 08-08 (#469) passed `epoClawbackDays` into the live register; `F-0812-04` gave it a write path |
| `F-0810-06` | Working capital unmeasured — the ledgers never joined on time | 08-08 (#469) — verified: `computeWorkingCapitalPosition` + `daysToCash` |
| `F-0809-04` | No cash-conversion figure | same as above |
| `F-0807-01` | **The counterparty gate does not exist at price formation** | **fixed this tick** — see below |

### Open, ranked

| rank | id(s) | finding | why it is ranked here |
|------|-------|---------|----------------------|
| ~~1~~ ✅ | `F-0809-02` · `F-0811-03` · `F-0808-03` | **FIXED 2026-08-12.** Revenue is single-channel: the platform's own ~$2,000/file is revenue nowhere.** 20–31.5% of a funded loan's revenue is invisible and a borrower-paid file reports a *negative* margin | Three audits found it independently. Policy already decided 2026-08-08 (**recognize on receipt**); roadmap 3.14. **Blocked on a real question:** there is no payment rail (F-16 — deliberately), so no receipt event exists to recognize against. Owner named the receipt event 2026-08-12: **the lender's remittance advice** (`compensationReceivedAt`). `shared/revenueRecognition.ts` |
| ~~2~~ ✅ | `F-0811-05` · `F-0809-03` | **FIXED 2026-08-12.** The comp ledger is blind to the compensation model, so **every borrower-paid file reads as a lender short-pay** | Verified open: no `compensationModel` in `compensationLedger.ts`. Same root as rank 1 and should land with it — fixing revenue without this just moves the wrong number |
| ~~3~~ ✅ | `F-0807-03` | **FIXED 2026-08-12, and reframed.** A staff-keyed cost entry silently re-prices four **zero-tolerance** TRID lines. F-4's baseline already holds the borrower's *number*, so the real consequence is that a bookkeeping action silently creates **cure liability** | The impact is now computed at the moment of booking and returned + audited (`disclosureImpact`), never blocking — a real invoice is a real invoice. Same principle as evaluating the QM cap at the election rather than at submission |
| 4 | `F-0810-05` | Over-paid compensation is booked as revenue and carried as no liability | Verified open: `over_paid` is classified in the comp ledger but appears nowhere in `contingentLiabilities.ts`. Lenders reclaim overpayments |
| 5 | `F-0811-02` | The QM fee trim is an unbudgeted, unrecorded revenue concession | The trim (08-05 F-17 resolution) reduces our own fees to fit the cap and records nothing, so the concession is invisible in margin |
| 6 | `F-0811-07` | No file records which fee-schedule version priced it; the pricing fallback is silent | **Partly closed** — `feeScheduleVersion` exists on `loan_estimate_disclosures` and is written by `leDisclosureBaseline`. Residual is the silent fallback |

### Not code — escalations carried forward

| id(s) | why |
|-------|-----|
| `F-0811-01` | Revenue per file is pinned by the QM cap; the comp lever is worth ~$0 under $250k. Analysis, and the same business lever as F-17 — a comp-plan negotiation, not a change |
| `F-0809-01` | The §1026.36(d)(2) guard covers the origination fee only. **Flagged, never asserted** — Reg Z text unverifiable in-session (`F-0812-06`) |
| `F-0807-04` | The register has no denominator: company capital is represented nowhere, so "adequate" is uncomputable | Same item as `F-0812-05` (minimum net worth) — needs the Illinois statute |

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

Recorded so this routine does not re-audit money the other session already walked.
Date-qualified per the scheme above; the log itself still reads `F-20`…`F-24`.

| id | summary | status |
|----|---------|--------|
| `F-0808-01` | `broker_commissions` — a live payout table reaching no margin figure, balance sheet or audit log, while `costLedger.ts` asserted commissions were "not captured anywhere". A declared gap and an unjoined table look identical in a margin figure and are entirely different problems | `done` — charged by lifecycle state; approved-but-unpaid booked as a payable; disbursed commission inside a live EPO window reported as loss *on top of* the clawback, not netted |
| `F-0808-02` | Payout struck as 0–10% of loan amount with no reference to the file's compensation and no funded gate — a $25,000 payable against $5,000 of revenue was permitted | `done` (`shared/commissionPayout.ts`) — but its **Reg Z §1026.36(d)(1) / RESPA §8 posture needs counsel**: ledger `regz-1026-36d1-referral-commission-payout`, roadmap 1.10, roadmap 3.7 blocked on it |
| `F-0808-03` | Borrower-paid platform fee income (~$2,000/file) absent from the revenue line — so with `F-0808-01`, **both sides of the margin were wrong in opposite directions** | `open` — policy decided 2026-08-08 (recognize on receipt); implementation is roadmap 3.14 |
| `F-0808-04` | Cash-conversion cycle computed nowhere despite every operand recorded, including `compensation_received_at` read by nothing | `done` — `daysToCash` measures funded → remittance and stays **null** rather than collapsing to the funding cycle when the lag is unmeasured |
| `F-0808-05` | Money-out routes unaudited: a $30 credit pull was audited, opening a payable worth up to 10% of the loan amount was not | `done` — four-eyes on disbursement left as a founder call (enforcing a second approver on a one-person company would block the only path to paying anyone) |

**Convergence worth noting:** their working-capital loop skips `simulated` cost entries for the
same reason the 08-12 pass excluded simulated revenue — two independent audits reached the same
rule. That agreement is evidence the rule is right, and it is why the two changes merged cleanly.

## Run log

| tick | base | mode | outcome |
|------|------|------|---------|
| 2026-08-12 t0 | `2444950` | audit + fix | 08-12 findings found, verified by execution, fixed under owner authorization; `/admin/lenders` built; routine installed |
| 2026-08-12 t1 | `3ba30c9` | refresh-only (R3) | **Branch was 15 commits behind** — refresh was the whole tick, exactly as R3 intends. Merged `origin/main`: 7 overlapping files, 3 conflicts (`costLedger.ts`, `submissions.ts`, KB README), all resolved additively — the two sessions' changes were complementary, not contradictory. `contingentLiabilityRegister.ts` auto-merged and was re-verified by hand (both `epoClawbackDays` and `simulated` present) because a silent auto-merge in a money path is not evidence. 3,079 tests green post-merge. **Found the id collision above** — the first thing the team-sync rail caught |
| 2026-08-12 t1b | `10329fa` | coordination | Read open PRs, not just `main` — found **PR #489 carrying four further audits** (08-07, 08-09, 08-10, 08-11). The real chain is nine audits, one per day; this ledger had claimed three. Six had minted `F-20`. Coordinated by comment on #489 rather than editing another session's branch. **Date-qualified ids adopted**; cron moved hourly → weekly on the evidence that the queue is not draining |
| 2026-08-12 t1c | `2bef0b2` | refresh-only (R3) | **#489 merged by the owner** minutes after the coordination comment, landing all four stranded audits. Eight of nine audits are now on `main` — the audit history is shared memory for the first time. Refreshed onto it: one conflict, `knowledge-base/README.md`, the exact serial-append pattern both this board and #489's own description had predicted; resolved by keeping both sides in date order. Ledger corrected from "stranded" to landed |
| 2026-08-12 t2 | `4789008` | audit + fix | Worked the four landed audits. Triaged 21 findings against HEAD: **7 already closed**, 6 open and ranked, 3 escalations. Fixed `F-0807-01` — the anti-steering option set counted fictional creditors toward the §1026.36(e)(3)(i) sufficiency number, reporting `creditorsQuoted: 3 / singleCreditor: false` when the true count of creditors we do business with is **zero** |
| 2026-08-12 t3 | `4789008` | fix | Ranks 1+2 fixed together on the owner's receipt-event decision (**the lender's remittance advice**). New `shared/revenueRecognition.ts`: platform fees are a second channel, sourced from the file's **issued** LE rather than a recompute of today's schedule, recognized only once the remittance lands, and never on a simulated funding. Borrower-paid comp is captured exactly once — under that election it IS the Section A origination fee, so counting Section A picks it up and the expected *lender* remittance is zero. A borrower-paid $400k file goes from **$0 revenue (negative margin)** to $6,000, and stops reading as a short-pay |
| 2026-08-16 t0 | `1f520b1` | audit | **`main` had not moved since the 08-14 audit branched from it**, so the diff-driven pass had an empty input and the tick ran on a question no prior audit had asked: what the platform believes *after* a deadline passes. Two High findings, one root — the measurement stops at exactly the point the exposure becomes real (standing signal #2, third audit running). `F-0816-01` lapsed locks dropped from the register; `F-0816-02` working capital excludes the remittance float it exists to size. Plus `F-0816-03`, counterparty concentration unmeasured in dollars. Audit-only: **no ledger row was at `authorized`** (R7). Verified sound: the reports route passes both revenue channels into `computeUnitEconomics` — the 08-14 fix does complete the circuit on the surface it reached |
| 2026-08-12 t4 | `4789008` | fix | `F-0807-03`. Verified first that F-4's baseline already protects the borrower's number on both LE routes, which **reframed** the finding rather than closing it: the residual harm is cure liability created as a side effect of bookkeeping and discovered in a report read at closing. Now evaluated against the disclosed baseline at booking time, returned on the response and written into the `loan_cost.recorded` audit so a cure has a traceable cause. Non-blocking by design |
