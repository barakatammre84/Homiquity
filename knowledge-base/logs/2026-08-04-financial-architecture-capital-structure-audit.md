# Financial Architecture & Capital Structure Audit — 2026-08-04

**Scope:** the financial wiring, capital structure, and operational integrity of the business
model as *implemented in code* — capital flow, risk/liability, unit economics, balance sheet.
Not a code-quality review; every finding is an architectural property of the business model.

**Method:** read the money-bearing code paths directly. Every claim below cites a file and line
and was verified against the code, not against the docs. Where the code and a doc disagree, the
code wins (per `L1_VISION_AND_SCOPE.md` §7).

**Reviewer framing:** Homiquity is a **mortgage broker** (`L1_VISION_AND_SCOPE.md` §2) — the
spine is borrower ↔ wholesale lender, and the lender funds. That single fact determines which
questions are real. There is no warehouse line, no loans held for sale, no servicing asset, and
no duration mismatch on assets, **because there are no assets**. That is the correct architecture
for a broker and it should be actively defended (see F-14, which pulls against it).

The real financial exposures for this model are *contingent* and *fee-side*, and that is exactly
where the debt has accumulated.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-1 | Fee schedule creates a dual-compensation transaction on every file (Reg Z §1026.36(d)(2)) | Risk | **Critical** |
| F-2 | QM points-and-fees cap is structurally unenforced — and the fee schedule breaches it | Risk | **Critical** |
| F-3 | "Phantom lock": rate commitments issued with no lender-side lock | Capital flow | **High** |
| F-4 | Zero-tolerance cure liability is unmodeled and untracked | Risk | **High** |
| F-5 | Counterparty capacity is zero and submission does not check for it | Risk | **High** |
| F-6 | No revenue, receivable, or comp representation anywhere in the system | Unit economics | **High** |
| F-7 | Loan Estimate Section A omits the largest fee line from its itemization | Risk | Medium |
| F-8 | EPO/EPC compensation clawback exposure is entirely unrepresented | Balance sheet | Medium |
| F-9 | Third-party fee constants are unsourced national guesses in a zero-tolerance bucket | Risk | Medium |
| F-10 | Lock-extension fee has no payer attribution | Capital flow | Medium |
| F-11 | No cost side: no cost-per-file, vendor cost ledger, or pull-through | Unit economics | Medium |
| F-12 | Reg Z Total Loan Amount stand-in errs permissive, and its comment says the opposite | Risk | Low |
| F-13 | Contingent-liability register does not exist; reserve adequacy is unassessable | Balance sheet | Medium |
| F-14 | Seller/servicer delivery infrastructure built for a business that will never deliver | Capital efficiency | **Escalation** |
| F-15 | RESPA §8 handled correctly and deliberately | Risk | ✅ Sound |
| F-16 | Asset-light structure is correct | Balance sheet | ✅ Sound |

---

## 1. Capital Flow & Liquidity

### F-3 — "Phantom lock": the platform issues rate commitments against nothing (High)

**The architectural problem.** `POST /api/rate-locks`
(`server/routes/borrower/rateLocks.ts:23-100`) creates a rate lock entirely from an internal
`loan_options` row. It writes `rate_locks` with a 15–90 day term (line 33), sets
`status: "active"`, logs a `rate_locked` deal activity reading *"Rate locked at X% for N days"*
(line 90) — and never contacts a lender, records a confirmation number, or references a
lender-side commitment.

The schema that models the real thing is **dead**. `lock_requests`
(`shared/schema/lendingWholesale.ts:295-350`) carries exactly the right fields —
`lenderResponse.confirmationNumber`, `confirmedRate`, `confirmedLockExpiration`,
`clientAttestation`, `cocCheckResult` — and has **zero references anywhere outside the schema
file** (verified). `lender_offers.lockConfirmationNumber` (line 265) is likewise never written.

So the system holds two lock concepts: a live one that commits nothing, and a dormant one that
would commit correctly.

**This is the duration mismatch.** A broker has exactly one place where it takes duration risk,
and this is it: a rate commitment made to a borrower for 15–90 days with no offsetting lender
commitment behind it. The gap is not theoretical — the platform quotes off self-refreshing demo
rate sheets (`server/seedMarketPricing.ts:243-260`, `version = "1.0-demo"`), whose expiry is
rolled forward on every boot, so the natural staleness circuit-breaker has been deliberately
removed.

**Quantified.** A 50 bps adverse move on a $400,000 loan is roughly 2 points of price ≈ **$8,000
per file** to honor the quote — or the quote is broken and the borrower is repriced, which is the
reputational and UDAAP version of the same loss. Across a 40-file pipeline with a 30-day average
lock, a single rate shock is a **six-figure** event with no budget line.

**Structural fix.** Make `rate_locks` unconstructable without a `lock_requests` row in a
`CONFIRMED` state. Until a lender lock API exists, require staff to key the portal confirmation
number — the schema already has the column. Anything without a lender confirmation must be
labeled a **quote**, never a lock, in the borrower-facing string at line 90.

### F-10 — Lock-extension fee has no payer attribution (Medium)

`POST /api/rate-locks/:id/extend` (`rateLocks.ts:148-201`) takes `extensionFee` raw from
`req.body` with **no Zod validation** (line 156 — note the create endpoint one screen above
validates properly, so this is an inconsistency, not a convention), stores it on the lock, and
records **no field for who pays it**. `rate_locks` has `extensionFee` (`lendingRatesOps.ts:155`)
and no `paidBy`.

In the wholesale model the lender charges the *broker* for the extension (commonly ~1–2 bps/day,
so **$250–$500 per 15-day extension on a $400k loan**). Whether that lands on the borrower or on
Homiquity's P&L is the entire economic content of the transaction, and the system does not record
it. Worse, passing it to the borrower without a documented changed circumstance is a tolerance
violation (F-4).

**Fix.** Add `paidBy: 'borrower' | 'broker' | 'lender'` and a required FK to a change-of-
circumstance record when `paidBy = 'borrower'`; Zod the endpoint body.

### F-6 — No revenue, receivable, or compensation representation (High)

There is **no money movement and no revenue model anywhere in the platform**. Verified: no
payment processor, no ledger, no receivable, no trust or operating account separation, no
reconciliation.

For a broker, the absence of *money movement* is largely correct — comp is wired by the lender at
funding into an operating account outside the system. The absence of *revenue representation* is
not. Specifically:

- `lender_offers.brokerCompensationBps` / `brokerCompensationAmount`
  (`shared/schema/lendingWholesale.ts:255-256`) are **never written or read**. `createLenderOffer`
  (`server/storage/pricingPolicy.ts:527`) has **zero callers**.
- The comp plans *do* exist as seed data on the wholesale lenders
  (`server/seedMarketPricing.ts:77, 97, 117`): Summit `LENDER_PAID` 200 bps default (100–275),
  BlueRiver `EITHER` 175 (100–250), Atlas `LENDER_PAID` 225 (150–275). The only code that reads
  them is `server/services/optimizationEngine.ts:945` — a subsystem L1 lists as dead, with no
  registered route and no client callers (verified).
- The **only** financial metric the platform produces is `getAdminStats().totalLoanVolume`
  (`server/storage/stats.ts:59-63`), which sums purchase price / pre-approval amount across
  *amount-bearing statuses* — i.e. **pipeline volume of pending applications**. It is not funded
  volume and it is not revenue, but it is the number on the admin dashboard.

**Consequence.** The business cannot compute revenue per loan, cannot reconcile comp received at
funding against comp expected at lock, and **cannot detect a lender underpaying it**. A 25 bps
short-pay on a $400k loan is $1,000 that nothing in the system would ever surface.

**Fix.** Three columns close most of this: `compExpectedBps` + `compExpectedAmount` written at
lock, `compReceivedAmount` + `fundedAt` written at funding, and a variance report. That also
unlocks F-11.

### F-11 — No cost side, and unmetered vendor COGS (Medium)

There is no cost-per-file, no vendor invoice tracking, no LO commission model, and no CAC. Credit
pulls — the one recurring hard cost the platform actually triggers — have **no cost, quota, or
budget concept anywhere** in `server/services/creditPulls.ts` (verified), while the task engine
defines a `CRD_EXPIRED` "Credit report re-pull" task type
(`server/seedData/taskEngineSla.ts:70`) that generates repeat pulls by design. Tri-merge pulls
run roughly $15–$50 each; at 3 pulls per stalled file across a 100-file pipeline that is a
four-figure monthly line item that no surface in the system reports.

**Pull-through — the defining broker unit-economics metric — is unmeasurable.**
`lender_submissions` reaches a `funded` terminal status (`shared/wholesaleLenders.ts:52) but
nothing joins that state to comp or to file-level cost. At 60% vs 80% pull-through, cost per
funded loan differs by a third, and the business currently cannot tell which it is running.

**Fix.** A per-application cost ledger (vendor, purpose, amount, incurred-at) plus F-6's comp
columns yields revenue per loan, gross margin per loan, and pull-through from data the system
already generates.

### Cash-out-of-pocket items with no collection rail

The fee schedule discloses a $650 appraisal (`server/services/loanCosts.ts:114`) but the platform
has **no appraisal ordering workflow, no AMC integration, and no way to collect the fee**
(verified). In the wholesale model this is usually resolved by the lender's AMC billing the
borrower directly — which is fine, but it is an unstated dependency: until a lender relationship
exists (F-5), there is no AMC, and any appraisal ordered is fronted by Homiquity. Decide and
document which model applies before the first file.

---

## 2. Risk & Liability

### F-1 — Every file is architecturally a dual-compensation transaction (Critical)

**The architectural problem.** `computeClosingCosts` (`server/services/loanCosts.ts:110`)
**unconditionally** charges the borrower `originationFee = loanAmount * 0.01` — 1% of the loan
amount, on every file, with no input, flag, or branch for the compensation model. Meanwhile the
seeded comp plans are `LENDER_PAID` by default on two of three lenders and `EITHER` on the third
(`seedMarketPricing.ts:77, 97, 117`), and **nothing anywhere in the system records which
compensation model was elected for a given transaction** (verified — no field exists).

Reg Z §1026.36(d)(2) prohibits a loan originator from receiving compensation from *both* the
consumer and any other person on the same transaction. A borrower-paid 1% origination fee
combined with lender-paid comp is the textbook violation, and the fee model makes it the default
rather than an accident.

**Quantified.** On a $400,000 loan: $4,000 borrower-paid origination alongside $8,000 of
lender-paid comp at the seeded 200 bps default. TILA §130 civil liability for §1026.36 violations
runs to actual damages plus statutory damages (up to $4,000 per individual action on a closed-end
mortgage), plus costs and fees — and it attaches **per transaction**, so it scales linearly with
volume from the first funded file.

**Structural fix.** `ClosingCostInputs` must take the compensation model as a required input.
When comp is lender-paid, `originationFee` must be zero and the lender-paid amount must be
carried separately (disclosed on the LE but not charged to the borrower). Elect the model per
application, persist it, and make the fee schedule a pure function of it. Fail closed: no
compensation model on the file → no Loan Estimate.

### F-2 — The QM points-and-fees cap is unenforced, and the fee schedule breaches it (Critical)

**The architectural problem.** The QM check exists and is well-built:
`evaluateCoveredPointsAndFees` (`shared/fannieMae/qmThresholds.ts`) carries properly cited
note-date tables. But its caller, `evaluatePointsAndFees`
(`server/services/mismoValidation.ts:410-450`), reads `application.totalPointsAndFees` — a column
(`shared/schema/lendingCore.ts:386`) that **no production code path ever writes**. Verified: the
only writers in the repo are test fixtures.

When it is null the function returns `{ qmStatus: "Unknown", compliant: true }` (line 421-423) —
it **fails open**. So in production the gate silently passes every file.

That would be merely dormant if the underlying numbers were fine. They are not.

**Quantified — using the platform's own constants.** Points and fees for a broker transaction
include *all* compensation paid by the creditor to the broker, even though the borrower never
sees it (§1026.32(b)(1)(ii)). Platform-charged fees that count: origination (1%) + $500
application + $1,500 underwriting + $100 tax service.

| Loan amount | 2026 QM cap (3%) | Platform fees | Headroom for comp | Max comp that stays QM |
|---|---|---|---|---|
| $400,000 | $12,000 | $6,100 | $5,900 | **147 bps** |
| $200,000 | $6,000 | $4,100 | $1,900 | **95 bps** |

Against the seeded comp plans (minimums 100 / 100 / 150 bps; defaults 175 / 200 / 225):

- **$400,000 at the 200 bps default:** $6,100 + $8,000 = **$14,100 vs a $12,000 cap — 17.5%
  over. Non-QM.** At Atlas's 225 default it is $14,600; at the 275 max, $17,100 — **42.5% over**.
- **$200,000: no seeded lender can produce a QM loan at all.** The 95 bps of headroom is below
  every lender's *minimum* comp.
- Atlas (150 bps minimum) cannot produce a QM loan at $400,000 either.

The loss of QM status is not a paperwork problem: it forfeits the ATR safe harbor, makes the loan
undeliverable to Fannie/Freddie through the wholesale channel, and exposes the originator to ATR
defense-to-foreclosure liability for the life of the loan. Practically, the lender's own QM edit
rejects the file at submission — after the borrower has paid for an appraisal and Homiquity has
worked the file. **This is a pull-through killer disguised as a compliance gap.**

**Structural fix.**
1. Compute points and fees from `computeClosingCosts` output plus the elected comp plan
   (F-1) — never from a hand-keyed column.
2. Change the null branch at `mismoValidation.ts:421` to return `qmStatus: "Unknown",
   compliant: **false**` with a "manual review required" issue. A financial guardrail must fail
   closed; this one currently fails open.
3. Run the check at *pricing* time, not just at validation time, so an over-cap combination is
   never quoted.
4. Re-baseline the platform fee schedule against the comp plans. $500 application + $1,500
   underwriting is $2,000 of fixed fee that consumes a third of the cap on a $200k loan; at
   Illinois-market loan sizes that is a structural constraint on the entire product, not a
   pricing detail.

### F-4 — Zero-tolerance cure liability is unmodeled (High)

`server/services/changeOfCircumstance.ts:12` states it plainly: *"Fee-tolerance / good-faith cure
math is NOT automated — every recorded [change] routes to manual review"* (line 92). There is no
persisted baseline of the first-issued Loan Estimate, so nothing can compute a bucket delta at
reissue even manually.

**Quantified per file** (from the platform's own schedule on a $400,000 loan). Zero-tolerance
categories under §1026.19(e)(3)(i) — charges paid to the creditor/broker and services the
borrower cannot shop for:

- Section A origination charges: **$6,000** (origination $4,000 + application $500 +
  underwriting $1,500)
- Section B, services you cannot shop for (`loanEstimate.ts:331-337`): appraisal $650 + credit
  report $75 + flood determination $25 + tax service $100 = **$850**

**$6,850 per file of dollar-for-dollar cure exposure**, plus the §1026.19(f)(2)(v) 60-day
post-closing refund obligation, plus the 10%-cumulative bucket on recording fees and shoppable
services taken from the written list. Every LE reissued without a documented changed circumstance
converts directly into a cure paid at closing out of Homiquity's comp.

**Fix.** Persist the issued-LE fee baseline at first issuance; on every reissue compute per-bucket
deltas; block reissue of an increased zero-tolerance charge unless a `change_of_circumstance`
record is attached. The manual-review posture is defensible at zero volume and indefensible at
ten files a month.

### F-5 — Counterparty capacity is zero, and submission does not check (High)

All five wholesale lenders carry `approvalStatus: "target"` (`shared/wholesaleLenders.ts:26-32`)
— **none is credentialed**, and `submitToLenderPortal` (`server/services/lenderSubmission.ts:66-76`)
returns a deterministic simulation for every one of them. This is honestly documented
(`ASSUMPTIONS.md` §1) and is the intended pre-contract posture.

The architectural gap: **`submitToWholesaleLender` never checks `approvalStatus`** — the string
does not appear anywhere in `server/` (verified). The system will record a `submitted`
`lender_submissions` row, advance the status machine, and show staff a live submission against a
lender that has no relationship with the company.

Concentration itself is the deeper issue: revenue capacity is a step function of the number of
*signed* broker agreements, and it is currently **zero**. One agreement is not diversification
either — a single-lender broker inherits that lender's pricing, turn times, overlays, and comp
plan wholesale, with no ability to shop, which also undercuts the §1026.36(e) anti-steering
option set that `antiSteeringOptions.ts` carefully constructs (it needs multiple *creditors*
quoted; `creditorsQuoted` is a field on the result but nothing enforces a floor).

**Fix.** Gate `submitToWholesaleLender` on `approvalStatus === "approved"`. Track "count of
approved wholesale lenders" as the top launch KPI — it is the binding constraint on revenue, more
so than any engineering item on the roadmap. Target three minimum for genuine best-execution.

### F-7 — Loan Estimate Section A omits its largest line from the itemization (Medium)

`server/services/loanEstimate.ts:325-330` builds Section A as:

```
originationCharges: {
  points, applicationFee, underwritingFee,
  total: originationFee + points + applicationFee + underwritingFee,   // line 329
}
```

The `total` **includes** the 1% origination fee; the itemized lines **do not**. On a $400,000
loan the borrower sees Origination Charges of $6,000 above line items summing to $2,000 — **$4,000
unlabeled**. §1026.37(f)(1) requires each origination charge itemized by name and amount.

Note what this means commercially as well as legally: **the single largest revenue line of the
business has no name anywhere in the disclosure it appears on.** F-6's invisibility of revenue and
this itemization gap are the same defect seen from two directions.

**Fix.** Add `originationFee` as a named line in the Section A structure, the interface at
lines 43-48, and any client renderer.

### F-9 — Third-party fee constants are unsourced guesses in a zero-tolerance bucket (Medium)

`loanCosts.ts:110-123` hardcodes fifteen fee constants with no citation, no state awareness, and
no provenance — in a repository that otherwise enforces a strict "no citation, no
implementation" rule for policy scalars (`CLAUDE.md`; `ASSUMPTIONS.md` §3). Four of them
($650 appraisal, $75 credit, $25 flood, $100 tax service) land in the **zero-tolerance** bucket,
so every dollar of error is a cure Homiquity pays.

Two specifics for an Illinois-only footprint (`A5`, `LICENSED_STATES`):

- **Appraisal $650 flat.** Plausible for a conforming SFR; complex, rural, and 2–4 unit
  assignments commonly run $900–$1,500. That $250–$850 delta is not recoverable — it is a cure.
- **Transfer taxes at 0.1% of purchase price** (line 123). Illinois state and county transfer
  taxes together, and Chicago's municipal transfer tax on top, appear to exceed this materially.
  **Do not take my figures as authority** — this needs the same treatment `qmThresholds.ts`
  received: a cited state/county/municipal table verified against current statute, not a single
  national constant.

**Fix.** Move the fee schedule into a cited, state-scoped table with provenance comments, the way
`shared/fannieMae/qmThresholds.ts` handles its thresholds. Add a per-file override so a known
appraisal quote replaces the estimate before the LE issues.

### F-12 — The Reg Z Total Loan Amount stand-in errs permissive (Low)

`mismoValidation.ts:429-434` passes `loanAmount` as the Regulation Z Total Loan Amount, with a
comment claiming this "errs conservative-high." It errs **permissive**. The Reg Z Total Loan
Amount is the amount financed *minus* financed points and fees, so it is lower than the loan
amount — meaning the real 3% cap is *smaller* than the one computed. On a $400,000 loan with
$6,100 of prepaid finance charges the true cap is roughly $11,817, not $12,000: **$183 of false
headroom**, in the direction of passing a loan that should fail.

**Fix.** Use `prepaidFinanceCharges` — already computed and returned by
`computeClosingCosts` (`loanCosts.ts:152-154`) — to derive the Reg Z Total Loan Amount, and
correct the comment.

### F-15 — RESPA §8 is handled correctly ✅

Worth stating explicitly: the partner and CPA referral spines carry **no fee, commission, or
payout columns by design**, and the schema documents *why* (`shared/schema/partners.ts:20`,
`shared/schema/cpaPartners.ts:20-21`, `server/routes/partners.ts:22`,
`server/routes/cpaPartners.ts:18`). Building a referral network with the compensation columns
deliberately absent — and the reasoning written down where the next engineer will hit it — is the
best-architected financial control in the repository. Preserve it verbatim; the pressure to add a
partner payout field will arrive with the first realtor who asks.

---

## 3. Unit Economics & Margin Leakage

The findings above (F-6, F-11) mean the honest answer to "what are the unit economics?" is that
**the system cannot produce them**. What can be said from the constants in the code, on a $400,000
loan:

| Line | Amount | Source |
|---|---|---|
| Revenue — lender-paid comp @ 200 bps | $8,000 | `seedMarketPricing.ts:77` |
| Revenue — borrower-paid origination @ 1% | $4,000 | `loanCosts.ts:110` — **must be $0 if comp is lender-paid (F-1)** |
| Platform fee revenue (application + underwriting) | $2,000 | `loanCosts.ts:112-113` |
| Disclosed third-party pass-through (zero-tolerance) | $850 | `loanCosts.ts:114-117` |
| Direct vendor COGS (credit pulls, re-pulls) | **untracked** | F-11 |
| Labor / cost to originate | **untracked** | F-11 |
| Contingent: cure exposure | up to $6,850/file | F-4 |
| Contingent: EPO clawback | $8,000–$11,000/file | F-8 |

Two structural observations:

1. **The $2,000 fixed platform fee is the margin lever and the QM constraint simultaneously.** It
   is pure revenue at $400k and it is a third of the entire QM cap at $200k (F-2). Fixed fees on
   a broker's fee schedule scale inversely with loan size, which means the product has an
   implicit minimum viable loan amount that nobody has calculated. **Calculate it.**
2. **Pull-through is the whole business** and it is unmeasured (F-11). Cost is incurred on every
   file; revenue arrives only on funded files. Every finding above that causes a late-stage
   rejection — non-QM at submission (F-2), a broken lock (F-3), a cure at closing (F-4) —
   converts a fully-costed file into zero revenue. These are not four compliance issues; they are
   four independent paths to the same margin leak.

### F-14 — Seller/servicer infrastructure built for a business that will never deliver (Escalation)

**The architectural observation.** A substantial share of this codebase implements Fannie Mae
**loan delivery**: `server/services/loanDeliveryReadiness.ts`,
`shared/fannieMae/loanDeliveryEdits.ts` (the Loan Delivery / UCD / EarlyCheck pre-delivery edit
mirror), `shared/fannieMae/specialFeatureCodes.ts`, `shared/fannieMae/ucdFeeEnumerations.ts`, the
`loan_delivery_data` table, and a `mersOrgId` pursued in `server/config/company.ts:9`.

**A broker never delivers a loan to Fannie Mae.** The wholesale lender is the seller/servicer: it
owns ULDD delivery, the UCD, the EarlyCheck edits, the Special Feature Codes, and MERS
registration. MISMO 3.4 *export to the lender* is essential and correctly built
(`buildLenderPackage`, LS-10 slice 2). The Fannie Mae *delivery-readiness* stack sitting on top of
it is work performed on behalf of a counterparty that will perform it again itself.

The MERS org ID is the clearest tell: MERS membership registers *notes you hold*. A broker holds
none. Pursuing an org ID is an annual fee for a registry with nothing to register.

**Two readings, and they have opposite capital consequences:**

- **It is overhead.** Then this is the single largest allocation of engineering capital to a
  function outside the business model, and it should be frozen — the maintenance burden alone
  (ULDD spec updates, annual QM threshold tables, SFC catalog drift) is a recurring cost against
  zero revenue.
- **The real plan is mini-correspondent** — closing loans in Homiquity's own name and selling
  them. Then the delivery stack is prescient and **the entire capital picture in this audit
  changes**: a warehouse line becomes necessary, duration mismatch becomes real, dwell time
  between funding and purchase becomes a financing cost, minimum net worth and warehouse
  covenants bind, and early-payment-default repurchase risk lands on the balance sheet.
  Nothing in `L1_VISION_AND_SCOPE.md`, `CTO_ROADMAP.md`, or `ASSUMPTIONS.md` reflects any of
  this.

**This is a founder decision, not an engineering one, and it should be answered before more is
built on either interpretation.** Per `CLAUDE.md`, escalating rather than picking an
interpretation.

---

## 4. Balance Sheet Integrity

### F-16 — Asset-light structure is correct ✅

No warehouse line, no loans held for sale, no servicing asset, no rate-lock pipeline hedge, no
TBA position. For a pure broker this is right: there are no assets to mismatch against
liabilities, no capital tied up in loans awaiting purchase, and no hedge P&L. Capital efficiency
in this model is a function of pull-through and cost per file, not of balance-sheet velocity.
Confirming this as sound — and noting that F-14 is the one thing that would invalidate it.

### F-8 — EPO / EPC compensation clawback is entirely unrepresented (Medium)

Every wholesale broker agreement contains an early-payoff clause — typically requiring **full
return of broker compensation** if the loan pays off within 6 months (some run 180 days, some
12 months) — and early-payment-default provisions on top. A grep for `EPO`, `early payoff`,
`clawback`, `repurchase`, `surety`, and `net worth` across `server/`, `shared/`, and
`knowledge-base/` returns **nothing** (verified).

**Quantified.** At the seeded 200–225 bps comp on a $400,000 loan, each funded file carries an
**$8,000–$11,000 contingent liability, live for six months after funding**. A broker running 10
files a month carries a rolling ~$500k–$650k of clawback-exposed revenue with no register of it.
Refi-boom churn is precisely when this fires — and `lifecycleEngine.ts:32` actively *scans for
refi opportunities at 25 bps of improvement*, meaning the platform has a feature that, pointed at
its own recently-funded book, would trigger its own clawbacks. That interaction is worth an
explicit guard.

**Fix.** Record `fundedAt` and the comp amount per submission; carry a clawback-exposure register
(sum of comp on loans funded within the clawback window); exclude own-book loans inside the EPO
window from refi-alert targeting.

### F-13 — No contingent-liability register; reserve adequacy is unassessable (Medium)

For an asset-light broker, the contingent liabilities **are** the balance sheet. Four are
identified in this audit and none is represented anywhere in the system or the knowledge base:

| Exposure | Per-file | Window |
|---|---|---|
| TRID zero-tolerance cures (F-4) | up to $6,850 | per closing |
| EPO comp clawback (F-8) | $8,000–$11,000 | 6 months post-funding |
| Lock-honor gap (F-3) | ~$8,000 per 50 bps move | duration of lock |
| Reg Z §1026.36 / ATR liability (F-1, F-2) | statutory + actual | life of loan |

Add to these the licensing-side capital requirements — Illinois Residential Mortgage License Act
minimum net worth and surety bond — which appear nowhere in the code or the NMLS knowledge base
(`docs/nmls/`), despite `A5` establishing an Illinois-only footprint.

**"Is the reserve adequate?" cannot be answered, because the exposures have never been
enumerated.** That is the finding.

**Fix.** One page: each exposure, its per-file cap, its window, and the pipeline count it
multiplies against. That product is the reserve number. It belongs in
`knowledge-base/governance/` next to `ASSUMPTIONS.md`, and it should be reviewed at the same
cadence.

---

## Recommended sequence

1. **F-1 + F-2 together** — they share one root (the fee schedule is blind to the compensation
   model) and one fix. Nothing else matters if the first funded loan is a dual-compensation,
   non-QM file. **Blocks go-live.**
2. **F-5** — gate submission on `approvalStatus`, and treat signed broker agreements as the
   binding launch constraint. **Blocks revenue.**
3. **F-3** — bind `rate_locks` to a confirmed `lock_requests` row, or stop calling it a lock.
   **Blocks the first rate shock.**
4. **F-4 + F-7 + F-9** — the disclosure/cure cluster; all three are edits to two files.
5. **F-6 + F-11** — the comp/cost columns. Small change, and it is the difference between having
   unit economics and guessing at them.
6. **F-14** — founder decision. Answer it before the next line of delivery code.
7. **F-8 + F-13** — the exposure register, once F-6 gives it data.

**Not found wanting:** RESPA §8 discipline (F-15), the asset-light structure (F-16), the
determinism of the underwriting engine, and the honesty of `ASSUMPTIONS.md` — which correctly
flags every simulated vendor leg and is why this audit could be conducted at all.
