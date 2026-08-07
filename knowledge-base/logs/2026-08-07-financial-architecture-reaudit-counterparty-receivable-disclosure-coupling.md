# Financial Architecture Re-Audit — 2026-08-07

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md)
— capital flow/liquidity, risk/liability, unit economics, balance sheet — re-run against HEAD
(`33adbc8`) after the 08-05→08-06 wave (25 commits, PRs #403–#465).

**Method:** read the money-bearing code paths directly. Every claim cites a file and line and was
verified against the code, not against the docs. Where code and a doc disagree, the code wins
(`L1_VISION_AND_SCOPE.md` §7).

**Reviewer framing (unchanged and re-verified):** Homiquity is a **mortgage broker**
(`shared/businessChannel.ts:51`). It holds no notes, runs no warehouse line, and moves no borrower
money — there is still no payment processor, no trust account and no operating-account separation
anywhere in the codebase, and for this channel that remains the *correct* answer, not a gap. The
real exposures are contingent and fee-side. That is again where everything below sits.

**Bottom line.** The prior two waves hold. The three findings in this pass share one shape, and it
is the shape worth naming: **every money-bearing control the platform has built is enforced at the
end of its funnel, and the economics are decided at the beginning.** The counterparty gate fires at
submission but not at the quote that priced the file (F-20). The compensation control fires at
funding but has no state for the weeks between funding and the wire (F-21). The good-faith-cure
control fires when a revised Loan Estimate is re-evaluated, but the staff action that moves the
disclosed number has no gate at all (F-22). In each case the platform *measures* a liability it had
the information to *prevent* one step earlier.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-20 | The counterparty gate does not exist at price formation — quotes, `lenderCount` and the anti-steering option set are built from any live lender row | Capital flow / Risk | **High** |
| F-21 | Funding and payment are one event, so broker compensation has no receivable — and the short-pay control defeats itself | Capital flow / Unit economics | **High** |
| F-22 | A staff-keyed cost entry silently re-prices four zero-tolerance TRID lines with no changed-circumstance gate | Risk / Margin leakage | **High** |
| F-23 | The contingent-liability register has no denominator — company capital is represented nowhere, so "adequate" is uncomputable by construction | Balance sheet | Medium |
| — | F-1…F-19 remediation holds at HEAD | all | ✅ verified by reading |
| — | F-9 fee values, F-14 channel decision | — | ⚠️ still open, unchanged |
| — | Asset-light structure, no money movement, RESPA §8 posture (F-15/F-16) | — | ✅ still sound |

---

## 1. Capital Flow & Liquidity

### F-20 — The counterparty gate is absent at price formation (High)

**The architectural problem.** `computeOffers` — the single pricing engine behind the borrower's
loan options, the LO-2 scenario simulator, the marketing rate surfaces and the anti-steering option
set — selects its lenders with exactly one filter:

```ts
// server/services/pricingAdapter.ts:120
const activeLenders = await storage.getWholesaleLenders({ status: "ACTIVE" });
```

`status` is row liveness. The schema says so, in the same file that defines the real gate:

> `status` answers "is this row live?"; it does **not** answer "do we have a signed broker
> agreement?". Only `approvalStatus` does, and it is the gate on transmitting a borrower's file to
> a third party. — `shared/schema/lendingWholesale.ts:66-71`

The pricing path reads neither `approvalStatus` nor `isDemo`. Nothing downstream of it does either:
the borrower-facing offers route derives the count it shows from the raw offer set
(`server/routes/lending/pricing.ts:525`, `new Set(offers.map(o => o.lenderId)).size`), and
`deriveAntiSteeringOptions` computes `creditorsQuoted` and `singleCreditor` over the same unfiltered
set (`server/services/antiSteeringOptions.ts:174`).

**Why this is live, not theoretical.** The five **real** Target-5 counterparties are seeded
`status: "ACTIVE"`, `approvalStatus: "target"`, `isDemo: false`
(`server/seedWholesaleLenders.ts:47-60`) — where "target" means, in that file's own words, *"we want
to broker to them and they have never heard of us."* They are invisible to pricing today only
because nobody has attached a rate sheet to them yet. Attaching one is a single admin action on the
lender screen, and it is precisely what the F11 pricing-engine work will do. On that day a named
lender with no executed agreement enters the borrower's quote set, and no code anywhere notices.

This is **not** the demo-lender case, which is deliberate and disclosed: the three fictional
`isDemo` lenders exist "so pricing and the beta walkthrough have something to quote"
(`shared/schema/lendingWholesale.ts:74-77`), the pricing layer is labeled simulated, and the
submission gate hard-blocks them. The defect is that the quote layer has **no notion of counterparty
status at all** — it cannot exclude a non-counterparty, and it cannot label one either.

**Quantified.** A file quoted and disclosed against a `target` lender is worked to the submission
gate and then blocked there (the F-5 fix, working as designed). At that point the file carries a
full cost load and no realizable revenue: on a $400k loan at the seeded 200 bps lender-paid plan,
**$8,000 of expected compensation is unrealizable** and the direct spend on the file
(`credit_report` at $30 for a tri-merge, plus any appraisal advance) is sunk. Worse, the remedy —
re-quote the borrower to a lender we can actually submit to — moves disclosed charges after an LE
has issued, which is the F-22 cure generator below. And the anti-steering safe harbor is asserted
from an option set whose `singleCreditor` flag was computed over creditors we do not, in
§1026.36(e)(3)(i)'s words, "regularly do business with" — the one flag that module exists to
provide.

**Structural fix.** One filter, and one field.
1. `computeOffers` takes an explicit counterparty scope. Default it to `approvedWholesaleLenders()`
   (`shared/wholesaleLenders.ts`), with an opt-in `includeUnapproved` used only by the marketing and
   demo surfaces that legitimately need something to quote.
2. Every `ComputedOffer` carries `counterpartyApproved: boolean`, so the LE builder, the comp
   snapshot and `deriveAntiSteeringOptions` can each decide rather than assume. `creditorsQuoted`
   should count approved creditors only; `singleCreditor` should be true when the approved subset is
   ≤ 1 however many demo rows padded the list.
3. The borrower-facing `lenderCount` counts what is deliverable, not what is priceable.

### F-21 — Funding and payment are the same event, so compensation has no receivable (High)

**The architectural problem.** A broker is paid by wire *after* a loan funds — commonly one to
fifteen days after, on the lender's remittance cycle. The status machine does not model that gap. It
refuses the `funded` transition unless the remittance figure is supplied in the same call
(`server/services/lenderSubmission.ts:346-355`), and then stamps the receipt with the funding date:

```ts
// server/services/lenderSubmission.ts:356-367
const fundedAt = funding.fundedAt ?? new Date();
...
compensationReceivedAmount: funding.compensationReceivedAmount.toFixed(2),
compensationReceivedAt: fundedAt,
```

`compensationReceivedAmount` has exactly one writer — that transition
(`server/routes/underwriting/submissions.ts:284-304`). There is no later "record the remittance"
action anywhere in the API.

**Why this defeats its own control.** The comp ledger's entire purpose is the two-sided check:
EXPECTED snapshotted at submission, RECEIVED recorded at funding, VARIANCE as "the only thing that
can surface a short-pay" (`shared/compensationLedger.ts:14-23`). But an operator marking a file
funded on the day it funds does not yet know the received amount. Their two options are to withhold
the `funded` status until the wire lands — which corrupts pull-through and cycle time, the metrics
`shared/cycleTimeReport.ts` exists to produce — or to key the expected figure as received. The
second is frictionless, invisible, and makes every variance evaluate `as_expected` forever.
`shortPaidCount` then reports a permanent zero that reads as "no lender has ever short-paid us."

The model already knows the state the writer forbids: `awaitingRemittanceCount`
(`shared/compensationLedger.ts:167,200`) counts funded loans with no remittance recorded, and the
contingent-liability register carries the matching `indeterminateCount`. **Neither can ever be
non-zero**, because the only path that sets `status = funded` also sets the remittance. A ledger
modeling a receivable, over a status machine that forbids one.

**Quantified.** At 200 bps on a $400k average loan, each funded file is an **$8,000 receivable**;
a 24-file month is **$192k in flight** with no aging, no days-outstanding, and no independent
confirmation. A systematic 25 bps under-remittance — the exact failure the ledger was built to
catch — is $1,000 per file, **~$288k/year**, and is undetectable under the workflow the status
machine forces.

**Structural fix.** Split the event, which is what it is in the real world.
1. `funded` requires `fundedLoanAmount` + `fundedAt` only. The file is funded when the loan closes.
2. A separate audited action — `PATCH /api/lender-submissions/:id/compensation` — records the actual
   remittance (`compensationReceivedAmount`, `compensationReceivedAt`, `compensationRecordedBy`),
   which is where the variance evaluation belongs.
3. Age the receivable from `fundedAt`. Surface funded-unremitted files past a threshold (15 days is
   the sensible default until an executed broker agreement supplies the real cycle) as a **collectible
   receivable** in the contingent-liability register — where it currently contributes $0 — and on the
   financial reports surface.

---

## 2. Risk & Liability

### F-22 — A staff cost entry re-prices four zero-tolerance TRID lines, ungated (High)

**The architectural problem.** The cost ledger is not only a cost ledger. It is the *disclosure
source* for the borrower's third-party charges: `resolveActualFeesFor`
(`server/services/loanEstimate.ts:194-207`) reads `loan_cost_entries` for the file, maps four
categories onto disclosed fee ids, and **sums** them per category:

```ts
// server/services/loanEstimate.ts:168-173
const COST_CATEGORY_TO_FEE_ID: Record<string, string> = {
  appraisal: "appraisal",
  credit_report: "credit_report",
  flood: "flood_determination",
  title: "title_insurance",
};
```

All four land in the **zero-tolerance** bucket (`shared/compliance/feeTolerance.ts:97-105`), where an
increase against the issued Loan Estimate without a valid changed circumstance is a dollar-for-dollar
good-faith cure, refundable within 60 days of consummation (§1026.19(f)(2)(v)).

The endpoint that writes those rows applies no such check
(`server/routes/underwriting/submissions.ts:486-534`). It validates the shape — category enum,
finite amount, optional vendor/description — and then writes with `simulated: false` hardcoded. It
does not ask whether a Loan Estimate has already issued, does not require a change-of-circumstance
reference, and does not warn that the row it is about to insert will raise a number already
disclosed to the borrower. Because entries sum, a routine second credit pull, a supplemental
appraisal invoice, or a re-quoted title figure each mechanically increases a disclosed
zero-tolerance charge.

**The control already exists, one module over.** The rate-lock extension path — the F-10 fix —
takes `extensionFeePaidBy`, refuses a borrower-paid fee without an `extensionFeeCocId`
(`server/routes/borrower/rateLocks.ts:239-251`), and then verifies that the cited
change-of-circumstance record exists, belongs to this application, and is not voided
(`server/routes/borrower/rateLocks.ts:283-298`). That is exactly the missing gate, already written,
already tested, applied to a fee line that is *smaller and rarer* than the four this endpoint moves.

Downstream, `evaluateTolerance` will correctly return `cure_required`
(`shared/compliance/feeTolerance.ts:245-257`) and the register will correctly book the exposure — but
only when a revised LE is generated and re-evaluated, which is **after** the liability exists. The
platform measures the cure it just manufactured.

**Quantified.** Typical post-LE third-party movements: a supplemental appraisal or re-inspection
$150–$250; a second tri-merge credit pull $30; a title re-quote in the low hundreds. Each dollar over
the disclosed baseline with no COC on file is owed. At a 40-file month with even a 20% incidence of a
$200 supplement, that is **~$1,600/month of self-inflicted cures** — and every one of them is paid out
of the $8,000 compensation on that file, so it is margin leakage and a compliance finding at the same
time. The population is unbounded upward: nothing caps how many entries a category can accumulate.

**Structural fix.**
1. Gate the write. When a Loan Estimate has issued for the file and the entry's category maps to a
   disclosed fee id, require a `changeOfCircumstanceId` and validate it the way `rateLocks.ts`
   already does (exists, same application, not voided).
2. Return the consequence in the response. The endpoint should tell the staff member what this row
   does to the disclosed figure and what the resulting tolerance verdict is — the evaluator is pure
   and can be called inline.
3. Separate the two meanings of a cost row. `loan_cost_entries` currently answers both "what did we
   pay?" and "what is the borrower charged?" A `disclosable: boolean` (or an explicit
   `borrowerChargeable` flag defaulting to false for staff-keyed rows) makes an accrual, an internal
   re-pull, and a genuine invoice distinguishable — today they are the same row.

---

## 3. Unit Economics & Margin Leakage

Re-verified sound at HEAD: the two-sided comp ledger (`shared/compensationLedger.ts`), the cost
ledger with its simulated-spend quarantine (`shared/costLedger.ts`), both pull-through denominators
named and distinguished (`shared/cycleTimeReport.ts:124-137`), and — the part most systems get
wrong — `computeUnitEconomics` declaring `costSideIncomplete: true` on its face because loan-officer
compensation, processing labour and overhead are captured nowhere. That is an honest upper bound
rather than a flattering number, and it should stay labeled until an LO comp plan and an overhead
allocation exist.

The margin leakage found this pass is F-21 (revenue that cannot be verified) and F-22 (cures paid out
of compensation), both reported above. No new leakage in the cost model itself.

## 4. Balance Sheet Integrity

### F-23 — The register has no denominator (Medium)

`GET /api/reports/contingent-liabilities` computes a `quantifiedFloor` and refuses to call it a
total, carrying `unquantifiedCount` alongside so the number cannot be read as complete
(`shared/contingentLiabilities.ts:60-72`). That discipline is right and rare.

But the page it serves asks *"what could we owe, and is our reserve adequate?"* — and **adequacy is a
ratio**. Nothing in the platform represents the other operand: there is no company capital, net
worth, surety bond amount, or reserve target anywhere in the codebase. `CONTINGENT_LIABILITY_REGISTER.md`
correctly identifies minimum net worth as the line "where the whole page converges" and marks it
unquantified pending a human with the Illinois statute — but the gap is structural as well as
informational. Even once someone reads the statute, there is no field to put the answer in and no
computation that would consume it.

**Structural fix.** A small `shared/companyCapital.ts` config — net worth as most recently
attested (with the attestation date), the surety bond amount and its expiry, the board-set reserve
target — read by the register endpoint to emit a `coverageRatio` and a `floorExceedsReserve` flag.
It must fail closed: with the values unset, the endpoint reports adequacy as **unknown**, never as
satisfied. That turns two ledger lines from "somebody should look this up" into a number the report
is visibly missing.

---

## What was verified sound and needs no action

- **No money movement.** No payment processor, no trust account, no operating-account separation
  anywhere (re-verified by search). For a broker that never touches borrower funds this is correct
  architecture, and it is the reason none of the classic fund-flow decoupling questions apply.
- **Asset-light (F-16) holds.** No notes held, no warehouse line, no loans held for sale, therefore
  no duration mismatch on assets. `holdsFundingRisk()` returns false and means it.
- **The lock gate (F-3) holds.** `rate_locks` cannot be confirmed without a lender confirmation
  number, and `server/routes/borrower/rateLocks.ts:128` derives its `simulated` flag from
  `approvalStatus` — proof the counterparty-status pattern exists in the codebase and that F-20 is a
  gap in one path, not an unknown idea.
- **The extension-fee gate (F-10) holds**, and is the template F-22 should be fixed against.
- **The delivery-stack freeze (F-14) holds** — `pnpm guard:channel` still binds. The business
  decision remains founder-owned and open; see [CHANNEL_DECISION.md](../governance/CHANNEL_DECISION.md).

## Still open from prior passes, unchanged

- **F-9** — every third-party fee constant is still `platform_estimate`; no entry has been upgraded
  to `cited`, because the Illinois sources remain unreachable from this environment and no schedule
  exists under `docs/`. The transfer-tax entry is still flagged `suspectedInaccurate`.
- **F-14** — the broker/correspondent decision. Nothing in this pass changes the recommendation to
  decide the business question rather than let the code keep asserting an answer by omission.
- **Surety bond and minimum net worth** — still unverified, now also structurally unstorable (F-23).

---

## Method notes

Verified by reading at `33adbc8`. The unit test suite was run from a fresh `pnpm install` in this
session and is green — **2,767 tests across 232 files** (2,352 server/shared + 415 client). None of
the four findings is a test failure: all four are properties of code that passes its tests, which is
the point. A gate that was never written cannot fail.
