# Financial Architecture Re-Audit — 2026-08-08

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md)
— capital flow, risk/liability, unit economics, balance sheet — re-run against HEAD three days
later, across ~50 commits including the go-live prep wave.

**Method:** verify the prior remediation still holds, then look for money paths the earlier passes
did not walk. Every claim below cites a file and was verified against the code.

**What changed since the last pass, and why it matters.** The company is now **licensed**
(NMLS 427468, `shared/companyIdentity.ts`), has a real creditor address on its adverse-action
notices, and the lender catalog moved from a hardcoded array to the database
(`shared/wholesaleLenders.ts`). The platform is no longer pre-production; the exposures below are
live ones, not hypotheticals.

**Bottom line.** The F-1…F-19 remediation holds — **2,782 unit tests green at HEAD**, both
capital-flow gates intact. But the two prior passes both audited the money coming *in* — lender compensation,
the fee schedule, the QM cap. Neither walked the money going *out*. There is a live payout table,
`broker_commissions`, that pays a percentage of the loan amount to a referring broker on a funded
file, and **no financial view in the platform read it**: not the margin figure, not the balance
sheet, not the audit log. The unit-economics module asserted in a comment that commissions "are
not captured anywhere". They were captured — in a table nothing joined.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-20 | Commission payouts are a per-loan cost that no margin figure counted | Unit economics / Balance sheet | **High** — ✅ fixed |
| F-21 | The commission payout has no relationship to the revenue it is a share of, and no funded gate | Risk / Margin leakage | **High** — ✅ bounded in code; regulatory posture still needs counsel |
| F-22 | Revenue recognition covers one of the platform's two revenue streams | Unit economics | Medium — ⚠️ open; **policy decided: recognize on receipt** |
| F-23 | Every operand of the cash-conversion cycle is recorded; the figure is never computed | Capital flow / Liquidity | Medium — ✅ fixed |
| F-24 | The only cash-disbursement path on the platform had no audit trail | Operational integrity | Medium — ✅ fixed (trail); SoD remains a policy call |
| — | The live liability register ignored contracted EPO windows | Balance sheet | Low — ✅ fixed |
| — | F-1…F-19 remediation holds at HEAD | all | ✅ verified |
| — | F-9 values, F-14 channel decision, surety bond / net worth | — | ⚠️ still open, unchanged |

---

## 1. Unit Economics & Margin Leakage

### F-20 — Commission payouts were a cost the margin figure did not count (High) — ✅ fixed

#### The architectural problem

The F-11 remediation built a cost side: `loan_cost_entries` books vendor spend (credit pulls,
appraisals, AVM, lock extensions) and `computeUnitEconomics` divides it by the **funded** count
rather than by files touched — correct, and the harder of the two arithmetics to get right.

It was not the only money leaving the company per loan. `broker_commissions`
(`shared/schema/admin.ts:161`) records a payout to a referring broker on a funded file, with a
four-state lifecycle (`pending → approved → paid`, or `rejected`), a `paidAt`/`paidBy`/
`paymentReference` disbursement record, and two live write paths:

- `POST /api/broker/commissions` (`server/routes/agent-broker/profileBroker.ts:134`, admin-gated),
- `calculateAgentCommission` (`server/services/optimizationEngine.ts:688`), currently uncalled but
  scheduled for wiring by roadmap item 3.7.

A grep for `brokerCommissions` across `server/` and `client/` returns the storage layer and the
optimization engine, and **nothing financial**. Not `computeUnitEconomics`. Not
`buildLiveContingentLiabilityRegister`. Not the compensation report at
`GET /api/reports/compensation`.

The consequence is precise and was stated, wrongly, in the code itself. `shared/costLedger.ts`
declared `costSideIncomplete: true` with the note *"loan-officer compensation, processing labour
and overhead are not captured"* — an honest disclosure about data the platform did not have. But
for commissions that was **not true**: the platform had the rows, the amounts and the statuses. It
simply never joined them. A declared gap and an unjoined table look identical in a margin figure
and are entirely different problems: one needs a business process, the other needs a query.

#### Quantified

The largest variable cost a brokerage carries is the share it pays the person who brought the loan.
At the seeded Summit lender-paid plan (200 bps, `server/seedMarketPricing.ts:97`) on a $250,000
loan, revenue is **$5,000**. The `calculateAgentCommission` formula pays **25% of that** — $1,250,
or a quarter of gross revenue on the file. The admin route permits far more (see F-21).

Against a vendor cost side that runs $30–$710 per file on the repository's own booked figures
(`platform-credit-pull-unit-cost`: $5/$15/$30 per pull; appraisal $650 in the test fixtures), the
uncounted commission is **larger than everything the cost ledger did count**. A margin figure that
omits it is not slightly optimistic; it is wrong about which line dominates.

#### Structural fix — shipped

**The lifecycle is modeled rather than summed flat**, because a flat sum would be wrong in both
directions:

- `summarizeCommissionCosts()` (`shared/costLedger.ts`) splits the rows by status. `approved + paid`
  is `committedAmount` — what the book owes or has spent. `pending` is **excluded**: it can still be
  rejected, and counting a payout that may never be owed as cost overstates spend. `rejected`
  contributes to nothing at all.
- `computeUnitEconomics` charges `committedAmount` against gross margin and now reports `vendorCost`
  and `commissionCost` as separate lines, so the reader can see which side moved.
- Pending commission does not vanish — it becomes a **note** on the figure (*"$X of commission is
  pending admin sign-off and is excluded until approved; cost will rise by that much if it is"*),
  because an amount that is neither owed nor not-owed is an unresolved decision, not a zero.
- `costSideIncomplete` stays unconditionally `true`. Counting one more cost line must never be
  mistaken for completing the cost side: processing labour, loan-officer salary and overhead
  allocation are still modeled nowhere, so gross margin remains an upper bound. The note was
  rewritten to say exactly which two lines are counted and which are not.

**On the balance sheet**, an approved-but-unpaid commission is now a register entry
(`shared/contingentLiabilities.ts`, category `commission_payable`). It is the only *certain*
liability on a register otherwise made of contingencies, and it belongs there precisely for that
reason: the register is the platform's only balance-sheet artifact, and omitting the one thing the
company definitely owes from a list of things it might owe inverts the reader's picture.

**The EPO interaction is reported, not netted.** When a lender reclaims its compensation on an
early payoff, the `epo_clawback` entry sizes the loss at the comp we return. A commission already
**disbursed** against that same loan is not recoverable from the lender and generally not from the
payee — so the true cash loss on an EPO is the clawback **plus** the commission already paid. The
register now computes that second amount off the clawback register's own at-risk application set
(so the two entries cannot disagree about which loans are inside a window) and states it on the
`commission_payable` note. Netting the two would have understated the loss.

---

### F-21 — The payout has no relationship to the revenue it is a share of (High) — ⚠️ flagged

#### The architectural problem

`POST /api/broker/commissions` computes the payable as
`loanAmount × commissionRate`, where `commissionRate` is **supplied per file by an admin** and
validated only as `0 < rate ≤ 0.1` (`profileBroker.ts:144-147`). The route does three things it
should not, and the third is the structural one:

1. **It never reads the compensation on the file.** `lender_submissions` carries
   `compensationExpectedAmount` and `compensationReceivedAmount` (`shared/schema/delivery.ts:168`).
   The commission route consults neither. A payout that is economically a *share of revenue* is
   computed as a *percentage of loan size*, and the two are only loosely related.
2. **It never checks that the loan funded.** It derives the loan amount from `purchasePrice −
   downPayment`, falling back to `preApprovalAmount`, and does not look at
   `application.status`. A payable can be opened against a file that is still in processing, or
   denied, or withdrawn.
3. **The percentage is chosen per transaction rather than set by a schedule.** That is the fact
   with regulatory weight, and it is why this finding is flagged rather than fixed — see below.

`calculateAgentCommission` has the mirror-image defect. It looks up the matched lender's comp plan
and falls back to `brokerCompBps = 275` when it cannot find one
(`optimizationEngine.ts:658`) — **275 is the top of the seeded range**, not the middle and not the
default (Summit's default is 200). So the fallback path pays 25% of a basis that is 37.5% higher
than the actual plan: $1,719 instead of $1,250 on a $250,000 loan. A fallback in a payout
calculation should round *down*, toward paying less than owed and correcting upward, not the
reverse.

#### Quantified

At the seeded Summit lender-paid plan on a $250,000 loan:

| | Amount | As % of the $5,000 revenue |
|---|---|---|
| Revenue (200 bps lender comp) | $5,000 | 100% |
| `calculateAgentCommission` at 25% | $1,250 | 25% |
| Same, on the 275 bps fallback basis | $1,719 | 34% |
| Admin route at a plausible 1% of loan amount | $2,500 | 50% |
| **Admin route at its permitted maximum (10%)** | **$25,000** | **500%** |

The 10% ceiling is not a hypothetical bound the code merely permits — it is the *only* bound. There
is no second check anywhere between an admin's keystroke and a payable five times the revenue on
the file. F-17's resolution sharpens this further: platform fees are now **trimmed** on small loans
to fit under the QM cap, so revenue per file varies downward with loan size while a commission
struck as a flat percentage of loan amount does not move with it. The two compress margin from
opposite ends on exactly the small-loan segment the product targets.

#### Structural fix — engineering half shipped, regulatory half open

**Shipped.** The rules moved out of the route into `shared/commissionPayout.ts`, pure, for the same
reason the QM floor moved into `loanCosts.ts` under F-18: a constraint living inside one endpoint is
a constraint no other surface can consult, and a staff UI that cannot ask *"what is the most I may
pay on this file?"* will discover the answer by tripping a 422.

1. **The payout is bounded by the revenue it shares.** `evaluateCommissionPayout` refuses any amount
   exceeding the file's compensation, preferring the **recorded remittance** over the snapshotted
   expectation — if the lender short-paid, the payout is bounded by what actually arrived, not by
   what we hoped for. Neither figure present is a **refusal** (`no_revenue_basis`), not a pass: an
   unknown must never be treated as "no limit", which is the whole hole this closes.
2. **A payout belongs to a funded file.** The gate is the *funded lender submission*, not the
   application status, and the basis is `fundedLoanAmount` — the amount compensation is actually paid
   on — rather than `purchasePrice − downPayment`. An application marked funded whose submissions are
   not gets its own message, because that is a data problem and reporting it as an ordinary refusal
   would bury it.
3. **The suggested ceiling is rounded down.** `maxRate` floors to the column's 4-decimal precision:
   rounding up would hand back a rate the very next evaluation refuses.
4. **`calculateAgentCommission`'s two defects are fixed.** The 275 bps fallback — the *top* of the
   seeded range — is now a `null` sentinel that refuses rather than a default that overpays. And the
   dead `"agent"` role check was **removed rather than repaired by adding a role**: widening that
   gate to the realtor/CPA personas is the answer to the open RESPA §8 question, not a typo fix.
5. **Refusals are audited**, not only successes (`broker_commission.refused`). A blocked payout is
   the interesting event — an admin trying to pay more than the file earned, or paying on a file
   that has not funded — and the accepted path records the revenue basis it was bounded against, so
   the trail shows what the ceiling was at the moment the payable was opened.
6. **A read side exists so the ceiling is learnable before the refusal:**
   `GET /api/broker/commissions/quote/:applicationId`, scoring off the same evaluator the POST
   refuses with, so the two cannot disagree about a file.

**The other half is not an engineering decision and must not be made in a session.** Two questions
go to counsel before either path carries a live file, and both are recorded in ledger entry
`regz-1026-36d1-referral-commission-payout` on a 14-day review interval so `pnpm checkup` goes loud
until they are answered:

- **Reg Z §1026.36(d)(1).** Loan-originator compensation may not be based on a term of a
  transaction; a *fixed percentage of the amount of credit extended* is permitted. Is a
  **per-file discretionary** percentage a fixed percentage? The `calculateAgentCommission` variant
  is the sharper case, since 25% of lender comp varies with the lender and product chosen — which
  are transaction terms.
- **RESPA §8.** If the payee is a referral source rather than a loan originator, does the payment
  survive at all? This one has a specific edge: `shared/schema/partners.ts:21` and
  `shared/schema/cpaPartners.ts:21` both carry a deliberate design note — *"no compensation tracked
  anywhere (RESPA §8: this table has no fee/commission columns by design, charter §5-C1)"*. The
  partner tables were built fee-free **on purpose, for this exact reason**, and `broker_commissions`
  is that column set sitting on the same referral edge.

One mitigating fact, verified and worth stating because it is load-bearing: `calculateAgentCommission`
gates on `referrer.role === "agent" || "broker"`, and **`"agent"` is not a role** — it appears
nowhere in `ALL_ROLES` (`shared/roles.ts`). Only `broker`, a staff role, can satisfy the gate. The
self-registering `realtor` and `cpa` partner personas — the actual referral sources, and the ones
RESPA §8 would bite on — cannot reach it. That is the safe posture. It also appears to be
**incidental rather than designed**, which is the risk: roadmap item 3.7 schedules wiring this
function up, and the obvious way to "fix" a role check that never matches is to add the roles that
were deliberately excluded.

**Neither the code nor this document asserts a regulatory conclusion.** Per CLAUDE.md, Reg Z cannot
be verified from inside a session — `ecfr.gov`, `consumerfinance.gov`, `govinfo.gov` and
`law.cornell.edu` are all blocked and `docs/reg-z/` holds no source text. Reg X is likewise absent
from `docs/`. What is asserted here is only what the code does.

---

### F-22 — Revenue covers one of two revenue streams (Medium) — ⚠️ open

`computeUnitEconomics` takes `receivedCompensation`, which
`summarizeCompensation` (`shared/compensationLedger.ts:197`) builds **solely** from
`lender_submissions.compensationReceivedAmount` — the lender's remittance.

Homiquity has a second revenue stream. The application fee ($500) and underwriting fee ($1,500) are
the platform's **own** charges (`server/services/loanCosts.ts:47-48`), and unlike the borrower-paid
origination fee they are **not** gated on the compensation model — `platformFinanceCharges()` returns
all three unconditionally, so they are charged under lender-paid and borrower-paid alike. (The $100
tax service fee is a vendor pass-through and is correctly not our revenue; it is the one charge
marked `reducible: false` for exactly that reason.)

So **up to $2,000 per file of fee income is invisible to the revenue line** — around 40% of the
$5,000 lender comp on a $250,000 file at the seeded default. Nothing anywhere records that the fee
was collected at settlement; a grep for any fee-receipt concept returns nothing.

This is the same class of gap F-6 closed for lender compensation, one stream over: the money is
disclosed to the borrower, computed correctly, and never recognized. Combined with F-20, **both
sides of the margin were wrong in opposite directions** — cost understated by the commission, revenue
understated by the fee income — which is worse than either alone, because the errors partly cancel
and make the resulting margin look plausible.

**Structural fix.** Mirror the compensation lifecycle: snapshot the fee schedule actually charged at
Loan Estimate issuance (the versioned `platform_fee_schedules` table already makes that
reproducible), and record collection at settlement alongside `compensationReceivedAt`. Then revenue
is `lender comp + platform fees collected`, and the variance between charged and collected becomes
visible the same way lender short-pay became visible under F-6.

**Policy decided 2026-08-08: recognize on receipt.** That settles the basis question with it — you
recognize what actually arrived, and the amount *charged* becomes the expected side for variance,
exactly mirroring the compensation lifecycle F-6 built (`expected` snapshotted, `received` recorded,
the difference the only thing that can surface a short-pay). The charged snapshot is therefore the
**actually charged** figure — the trimmed post-F-17 amount, which is what the Loan Estimate disclosed
and what the borrower will pay — not the standard schedule.

Implementation is roadmap 3.14 and is now unblocked. Recognition on receipt also keeps this
consistent with how the platform already treats lender compensation, so the revenue line will have
one rule rather than two.

---

## 2. Capital Flow & Liquidity

### F-23 — The cash-conversion cycle has every operand and is never computed (Medium) — ⚠️ open

#### The architectural problem

F-16 established, correctly, that an asset-light broker has no duration mismatch on assets because
it has no assets. That disposes of the *balance-sheet* liquidity question and leaves the only
liquidity risk a broker actually carries: **working capital**. Costs are incurred at application;
revenue arrives after funding. The company funds that gap out of its own cash for as long as the gap
lasts, and nothing in the platform says how long that is or how much it ties up.

What makes this a finding rather than a wish is that **every operand already exists**, in four
places, and no view joins them:

| Operand | Where it lives |
|---|---|
| Cost incurrence date | `loan_cost_entries.incurred_at` |
| Application → funding interval | `computeCycleTimeReport` — `medianDays`, `p90Days` |
| Funding date | `lender_submissions.funded_at` |
| **Remittance date** | `lender_submissions.compensation_received_at` |

That last column is the one that surprises. The funding→remittance lag — the days between a loan
closing and the lender wiring our compensation, which is the pure cash-drag window for a broker and
the answer to *"who bears risk during funding delays?"* — is **already recorded on every funded
submission** and is read by nothing. `summarizeCompensation` reads the amount and ignores the
timestamp.

#### Quantified — the shape, not the number

With no funded loans yet the figure is currently undefined, and it should be reported as undefined
rather than as zero (the same discipline `computeUnitEconomics` already applies to per-funded
figures).

> **Correction (2026-08-08, same day).** This section originally gave the projection as
> `in-flight file count × cost per file × days / 365`. That is **circular**: an in-flight count is
> *already* the product of an arrival rate and the time in system, so multiplying by the days again
> counts them twice. The correct statement uses an arrival rate **or** an in-flight count, never
> both. `tests/feeProvenanceAndCosts.test.ts` now pins the identity that catches it.

There are two figures here and they are different kinds of thing — conflating them is what produced
the error above:

```
committed  (MEASURED)   = Σ cost booked against files with no funded submission
projected  (Little's Law) = files started per month × cost per file × days to cash / 30
```

At the repository's own cost figures — $710 of vendor spend on a file that took an appraisal — 20
files a month at a 45-day cash cycle ties up **$21,300**. That is the number that determines whether
origination volume can grow without an outside facility, and it is the one financial figure on this
platform that gets *worse* as the business succeeds, which is why it should exist before volume does
rather than after.

#### Structural fix — shipped

- **`buildCycleTimeReport` gained the second interval.** `remittanceLag` is measured from
  `funded_at → compensation_received_at` on the submission row — read off a recorded fact rather than
  inferred from a status change, unlike the funding transition — and `daysToCash` sums the two.
- **Null propagates, deliberately.** With the lag unmeasured, `daysToCash` is **null**, not the
  funding cycle alone. Reporting the half we have as though it were the whole would understate
  exactly the window this exists to surface, so the report says so in a note: *"the lender's wire lag
  is not zero, it is unmeasured."*
- **A remittance dated before funding is corrupt data, not a same-day wire** — excluded and counted,
  the same rule cycle time already applied to a funding transition earlier than creation.
- **The lag is scoped to the window's cohort**, so both intervals describe the same files.
- **`computeWorkingCapitalPosition`** reports `committed` off the ledger (simulated spend excluded —
  a cash requirement must never be sized by money nobody paid), and **`projectWorkingCapital`**
  refuses to return a partial number when any operand is missing.
- `GET /api/reports/compensation` carries the position, calling `buildCycleTimeReport` rather than
  reimplementing the interval, so the two surfaces cannot disagree about a definition only one owns.

---

## 3. Operational Integrity

### F-24 — The only cash-disbursement path had no audit trail (Medium) — ✅ fixed

Recording a $30 credit-pull cost writes an audit entry (`loan_cost.recorded`,
`server/routes/underwriting/submissions.ts`). Creating a commission payable worth up to 10% of the
loan amount, and later marking it `paid`, wrote **none** — a grep for `logAudit` across
`server/routes/agent-broker/profileBroker.ts` returned nothing.

So the one path on the platform that moves money *out* of the company was the one path with no
record of who opened it or who released it. Both are now audited:
`broker_commission.created` and `broker_commission.status_changed`, the latter carrying the previous
and new status and the amount. Notes edits are deliberately not audited — a note is not a financial
event.

**What the fix does not solve, and is a policy decision.** Both the create and the `paid` transition
are `requireRole("admin")`. **The same admin can open a payable and release it**, with no second
approver. For a company with one admin that is unavoidable and the audit trail is the entire
control; at the point there are two, a four-eyes rule on the `approved → paid` transition costs
almost nothing and is the standard control for exactly this. Flagged for the founder rather than
implemented, because enforcing a second approver on a one-person company would block the only path
to paying anyone.

---

## 4. Balance Sheet Integrity

### Fixed alongside F-20 — the live register ignored contracted EPO windows

`buildLiveContingentLiabilityRegister` built its clawback register **without passing
`epoClawbackDays`**, so every exposure fell back to the 180-day platform assumption — while the
compensation report at `GET /api/reports/compensation` *did* pass it
(`submissions.ts:388`). Two views of the same loans could therefore report different windows and
different at-risk sets. The register now reads the lender rows and passes the contracted window, so
the two agree. Today this changes nothing numerically, because no executed broker agreement supplies
a term and every window is still `assumed` — which is why it went unnoticed, and why it was worth
fixing before an agreement lands and makes the divergence real.

### Still open, unchanged and correctly so

- **Surety bond and minimum net worth** remain `policy_unquantified` on the register. The company is
  now licensed, which makes these live obligations rather than prospective ones, and they still
  cannot be sized from this codebase: the amounts come from the Illinois statute, and per CLAUDE.md
  NMLS policy questions are not answered from memory. The register says so rather than guessing,
  which is the correct behaviour. **This is now the largest unquantified item on the balance sheet
  and it needs a human with the statute.**
- **F-9** — fee provenance architecture shipped; all ten constants remain `platform_estimate`.
- **F-14** — the broker/correspondent channel decision remains founder-owned.
- **Counterparty concentration** — unchanged: with zero executed broker agreements, concentration is
  100% on whichever lender signs first. The move to a database-backed lender catalog
  (`shared/wholesaleLenders.ts`) preserved the gate and *hardened* it: `isApprovedLender` now also
  refuses any row flagged `isDemo`, so a seeded fictional counterparty cannot be approved into the
  submission path by any combination of column values.

---

## Verified — the prior remediation holds at HEAD

Re-checked directly, not taken from the log:

- **Test suite green at HEAD:** 173 server test files / 2,367 tests, plus 60 client files / 415
  tests — **2,782 passing, 0 failing.** After this pass's changes and their **10 new tests**:
  **2,792 passing, 0 failing.** Typecheck clean both times.
- **`pnpm guard:security`** reports no TEAM_PRACTICES §9 trigger across the 10 changed files —
  run against the diff *content*, not filenames, per the 2026-08-05 correction.
- **F-3 (phantom lock)** holds — rate locks still require a lender confirmation.
- **F-5 (counterparty)** holds and is stronger, per the demo-row gate above.
- **F-17/F-18 (QM fit and the election-time gate)** hold: `evaluateFileQmFloor` still scores the file
  as it would actually be charged, and the compensation election still refuses `over_cap` before it
  writes.
- **F-19's invariant** holds: numerator and denominator still draw on the same
  `PLATFORM_FINANCE_CHARGES` list, pinned for any admin-published schedule.
- **Regulatory ledger:** 54 entries, none overdue; 3 due within 14 days (the three Reg Z entries
  whose verbatim text still cannot be fetched).

---

## Recommended sequence

1. ~~**F-21's engineering half**~~ — ✅ done. The payout is bounded by the file's compensation, gated
   on a funded submission, and the 275 bps fallback refuses instead of overpaying.
2. **F-21's counsel half, before any commission is paid on a live file.** ⚠️ **Still the top open
   item.** The ledger entry goes loud in 14 days; roadmap 3.7 must not ship until it is answered.
   Bounding the arithmetic was correct whatever counsel says — it is not a substitute for asking.
3. ~~**F-23**~~ — ✅ done. `daysToCash` and the working-capital position now exist.
4. **F-22** — ✅ policy decided (on receipt); implementation is roadmap 3.14 and now unblocked.
5. **The surety bond and net worth figures.** Now that the license is live these are real, ongoing
   capital requirements and they are the largest unpriced items on the register. **With F-21's
   arithmetic bounded and F-23 computed, this is the largest remaining gap in this audit's scope.**

---

## Security review — TEAM_PRACTICES §9 (2026-08-08)

The F-21 remediation adds `GET /api/broker/commissions/quote/:applicationId` behind
`requireRole("admin")`, which is a §9 **role/permission gate** trigger. `pnpm guard:security` fired
on it (run against the diff *content*, per the 2026-08-05 correction). Structured pass run before
merge; outcome recorded here and in the PR body per §9. **No CRITICAL or HIGH findings.**

**Authorization.** The new endpoint carries the same gate as the sibling `POST` it quotes for —
`requireRole("admin")`, no wider. Commission figures are company financial data, not borrower data,
and admin is the role that already reads the compensation report. Both routes resolve the
application with `storage.getLoanApplication` rather than the assignment-scoped
`getLoanApplicationWithAccess`; that is the pre-existing convention for admin-only routes in this
file (8 `requireRole` gates, unchanged in count and scope by this diff) and the new endpoint neither
widens nor narrows it. No new route is unauthenticated.

**Injection.** Every new query is Drizzle-parameterized: `getAllBrokerCommissions`,
`getLenderSubmissionsByApplication`, and the `lenderSubmissions.status = 'funded'` select in the
cycle-time service. No raw SQL fragment was added.

**Input validation.** The path param is coerced with `String()`; `?rate` goes through
`firstQueryValue` then `Number()`, and a non-finite result is refused by
`evaluateCommissionPayout`'s first branch — which runs *before* anything touches the file, so a bad
rate can never surface as a data-shaped error. The POST reads exactly three named body fields and
derives every persisted value server-side; after this change the amount and the loan basis come from
the evaluation rather than from the request or the application, which is strictly less client
influence than before.

**Mass assignment / privilege.** No new column is writable from a body. `status` is still
server-set to `pending` at creation, and `paidAt`/`paidBy` remain server-derived on the transition.

**CSRF.** Unchanged posture: session cookies are `sameSite: "lax"`
(`server/integrations/auth/session.ts:47`), which blocks cross-site mutating requests. The one route
added here is a **GET with no side effects** — no audit write, no persistence — so it is safe under
`lax` and does not need to be, and must not become, a mutating endpoint.

**Data exposure.** The new audit metadata (`broker_commission.created` / `.refused`) carries
`brokerId`, `loanAmount`, `commissionAmount`, `revenueBasis` and an opaque application uuid — company
financial figures, **no borrower PII**. `RESPONSE_BODY_LOG_ALLOWLIST` is untouched (verified by grep
over the staged diff).

**The two triggers the guard cannot see, confirmed absent by inspection:** no `shared/schema/` column
holding PII — this diff contains **no schema file and no migration at all** — and no new PII
sub-processor.

**One observation, not a finding.** `POST /api/broker/commissions` does not verify that `brokerId`
names a user with the `broker` role; a malformed id fails on the foreign key rather than on a check.
This is pre-existing, is reachable only by an admin (who is already the highest privilege in the
system), and is therefore not a privilege-escalation path — but a role check would make the failure
legible instead of a 500, and belongs with roadmap 3.7's pass over this surface.

---

## Provenance

Re-audit run 2026-08-08 against HEAD `2eb3af2`. Findings verified by reading the money-bearing code
paths directly; the quantified figures are computed from the repository's own constants
(`server/seedMarketPricing.ts` comp plans, `server/services/loanCosts.ts` fee schedule,
`CREDIT_PULL_UNIT_COST`) rather than estimated.

Regulatory readings are flagged rather than asserted, per the CLAUDE.md rule against answering
compliance questions from memory. F-21's Reg Z §1026.36(d)(1) and RESPA §8 questions both need
counsel and are recorded in `data/regulatory/regulatory-ledger.json` under
`regz-1026-36d1-referral-commission-payout`.
