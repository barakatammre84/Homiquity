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

> **Remediation status (2026-08-04, same day).** **F-1 through F-13 are FIXED** — see the
> §"Remediation" sections at the end of this document for what shipped, what is covered by
> tests, and the items deliberately left open rather than implemented on unverified regulatory
> text. **F-5's gate is a live behavior change in production** — read that section before the
> next deploy. Every other finding below is unaddressed.

| # | Finding | Area | Severity |
|---|---|---|---|
| F-1 | Fee schedule creates a dual-compensation transaction on every file (Reg Z §1026.36(d)(2)) | Risk | **Critical** — ✅ fixed |
| F-2 | QM points-and-fees cap is structurally unenforced — and the fee schedule breaches it | Risk | **Critical** — ✅ fixed |
| F-3 | "Phantom lock": rate commitments issued with no lender-side lock | Capital flow | **High** — ✅ fixed |
| F-4 | Zero-tolerance cure liability is unmodeled and untracked | Risk | **High** — ✅ fixed |
| F-5 | Counterparty capacity is zero and submission does not check for it | Risk | **High** — ✅ fixed |
| F-6 | No revenue, receivable, or comp representation anywhere in the system | Unit economics | **High** — ✅ fixed |
| F-7 | Loan Estimate Section A omits the largest fee line from its itemization | Risk | Medium — ✅ fixed |
| F-8 | EPO/EPC compensation clawback exposure is entirely unrepresented | Balance sheet | Medium — ✅ fixed |
| F-9 | Third-party fee constants are unsourced national guesses in a zero-tolerance bucket | Risk | Medium — ⚠️ partly fixed (architecture only; values still unverified) |
| F-10 | Lock-extension fee has no payer attribution | Capital flow | Medium — ✅ fixed |
| F-11 | No cost side: no cost-per-file, vendor cost ledger, or pull-through | Unit economics | Medium — ✅ fixed |
| F-12 | Reg Z Total Loan Amount stand-in errs permissive, and its comment says the opposite | Risk | Low — ✅ fixed |
| F-13 | Contingent-liability register does not exist; reserve adequacy is unassessable | Balance sheet | Medium — ✅ fixed |
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

---

## Remediation — F-1 and F-2 (2026-08-04)

Both criticals shared one root, so they shared one fix: **the closing-cost schedule now takes
the compensation model as a required input instead of being blind to it.**

### What shipped

| Change | File |
|---|---|
| Compensation model, dual-comp gate, points-and-fees floor | `shared/compliance/loCompensation.ts` (new) |
| Origination fee is `0` under a lender-paid plan; compensation carried separately; throws with no model | `server/services/loanCosts.ts` |
| LE fails closed without an election | `server/services/loanEstimate.ts` |
| Simulator lists a missing election as a named gap (`NEEDS_MORE_INFO`) rather than pricing blind | `server/services/scenarioSimulator.ts` |
| QM check falls back to the computed floor; **never returns "compliant" off missing evidence** | `server/services/mismoValidation.ts` |
| Staff election endpoint, assignment-scoped, audit-logged, frozen after LE issuance | `server/routes/lending/pricing.ts` |
| Two nullable columns, deliberately not backfilled | `shared/schema/lendingCore.ts`, `migrations/0038_lo_compensation_model.sql` |
| 22 new tests (`tests/loCompensation.test.ts` + 4 in `tests/mismoValidation.test.ts`) | suite 1443 green |

**F-1.** `computeClosingCosts` consults `borrowerPaidOriginationAllowed(model)`. Lender-paid ⇒
the borrower-paid origination fee is **zero**, and `lenderPaidCompensation` is reported on a
separate field that no borrower-facing total includes (property-tested: varying comp from 100 to
275 bps moves no number the borrower sees). There is no default model anywhere in the chain —
every entry point fails closed, because a guessed model *is* the violation.

**F-2.** The gate no longer reads a column nothing writes. Evidence is now two-tiered: the
authoritative `totalPointsAndFees` when present, otherwise a **computed lower bound** from the
platform's own charges plus compensation. The verdict is three-valued and the middle state is
the point — a floor under the cap returns `not_cleared` (a warning), never a pass. Only
`over_cap` blocks, and it blocks correctly: the audit's 275 bps / $400k case now produces a
critical error and `gseReady: false` where it previously passed silently.

### Why a floor and not the real figure

The complete §1026.32(b)(1) inclusion list could not be verified: this environment's network
policy blocked `ecfr.gov`, `law.cornell.edu`, `consumerfinance.gov`, and `govinfo.gov` (all
CONNECT 403), the local Loan Delivery job aid defines the field only as *"calculated in
accordance with Regulation Z"*, and `docs/` holds no Reg Z copy. Per the repo's
no-citation-no-implementation rule, the code therefore does not claim to produce the Regulation Z
figure.

Its correctness rests on **monotonicity, not completeness**: every item the real definition adds
can only raise the total, so `floor > cap` is sound and `floor ≤ cap` proves nothing. That is
exactly what the three-valued verdict encodes. The design can over-flag; it cannot under-flag.

### Deliberately left open — needs a human with the regulation

1. **Verbatim verification of §1026.36(d)(2) and §1026.32(b)(1)(ii).** Ledger entries
   `regz-1026-36d2-dual-compensation` and `regz-1026-32b1-points-and-fees-floor` carry a
   **14-day** review interval (vs. the usual 90–180) so `pnpm checkup` goes loud if this is
   forgotten. Both record precisely what was and was not verified. Shipping ahead of
   verification is safe in one direction only — both changes are conservative (they remove a
   borrower charge and add a warning), so neither can create the violation it guards.
2. **§1026.4(a)(3) — is lender-paid broker compensation a finance charge?** If it is, it belongs
   in `prepaidFinanceCharges` and changes every lender-paid APR. The APR math was left
   **unchanged** rather than altered on an unverified reading; the open item is flagged in
   `loanCosts.ts` at the `prepaidFinanceCharges` computation.
3. **Fee re-baselining is a business decision, not an engineering one.** The fix makes the
   constraint visible; it does not resolve it. $2,000 of fixed platform fees consumes a third of
   the QM cap on a $200k loan, and at the seeded comp plans the QM-safe ceiling is 147 bps at
   $400k and 95 bps at $200k. Someone has to decide whether the fee schedule or the target comp
   plan moves. See §3's note on the implicit minimum viable loan amount.
4. **No client UI for the election.** The endpoint exists and is the only writer; wiring it into
   the staff BorrowerFile surface is follow-on work.

### Migration note

`0038` is expand-only and idempotent (`ADD COLUMN IF NOT EXISTS`), and **deliberately does not
backfill**. The compensation model is a fact about how a transaction was papered; inventing one
for existing rows would falsify a compliance record — the same principle as the standing rule
against backfilling guessed values on provenance columns. Existing files read as "not elected"
and fail closed until staff elect a model, which is the correct outcome rather than a gap.

---

## Remediation — F-3 and F-4 (2026-08-04)

### F-3 — a lock now requires a lender

**What shipped.** `rate_locks` gained the fields that make a lock a commitment — `lenderId`,
`lockConfirmationNumber`, `confirmedRate`, `confirmedExpiresAt`, `confirmedBy`/`confirmedAt`, and
a `simulated` flag mirroring `lender_submissions` (migration `0039`).
`POST /api/rate-locks` now **requires all four confirmation fields**, validates the lender
against the `shared/wholesaleLenders.ts` catalog, and rejects an already-expired confirmation.

Three consequences worth naming:

- **The lender's confirmed expiration is authoritative.** `expiresAt` is no longer
  `now + lockPeriodDays`; local math describes what we *asked* for, never what we got.
- **The lock carries the lender's rate**, not the quoted loan option's. When they differ the
  activity log records `rateDriftFromQuote` — a lender confirming a different rate is a
  redisclosure trigger, and it now feeds F-4's tolerance evaluation instead of vanishing.
- **Extension needs its own confirmation.** `POST /api/rate-locks/:id/extend` previously read
  `additionalDays` and `extensionFee` straight off `req.body` with no validation and extended the
  expiry by local arithmetic — manufacturing a longer commitment nobody had granted. It is now
  Zod-validated, requires a confirmation number and the lender's confirmed expiration, must move
  the expiry forward, and refuses outright to extend an unconfirmed row.

**Legacy rows are not backfilled.** `shared/rateLockConfirmation.ts` is the single place that
answers "is this a real commitment?", and rows written before `0039` resolve to
`unconfirmed_quote` — which is what they always were. Inventing a confirmation number to make
them look like locks would repeat the original error in the database. The list endpoint annotates
every row with `kind` / `lenderConfirmed` / `label`, and the borrower-facing copy for an
unconfirmed row says *"NOT a lender-confirmed lock"* rather than the old
`Rate locked at X% for N days` — a test pins that the old claim cannot reappear.

**Not done:** `lock_requests` (the dormant request→response table) stays dormant. Its `NOT NULL`
FKs point at `lender_offers` and `underwriting_snapshots`, and nothing creates lender offers
(F-6), so wiring it would have meant resurrecting three dead tables to hold one confirmation
number. Recording the confirmation on the lock itself enforces the same invariant — no lock
without a lender commitment — without that. Revisit when a lender API actually lands (F-5).

### F-4 — the Loan Estimate now has a baseline

**The real defect was worse than "cure math isn't automated."** `generateLoanEstimate()` builds
the LE from live file data on every fetch and nothing was persisted, so the figures a borrower
saw on day one silently became different figures on day ten. No tolerance comparison was possible
because **the baseline did not exist anywhere**.

**What shipped.** A new immutable `loan_estimate_disclosures` table (migration `0040`) — one row
per issued disclosure, holding the tolerance-bucketed fee snapshot, and linking any revision to
the change-of-circumstance record that authorized it. Plus a pure tolerance engine
(`shared/compliance/feeTolerance.ts`) and the IO seam around it
(`server/services/leDisclosureBaseline.ts`).

The rule now enforced on borrower delivery:

| Situation | Behavior |
|---|---|
| First delivery | Persist version 1. That is the baseline. |
| Nothing increased | Baseline stands; serve it. |
| Increases **with** an open CoC | Redisclose: persist version n+1 linked to that CoC, resetting the baseline. |
| Increases **with no** CoC | **Do not redisclose.** Serve the disclosed figures; record the delta as a cure. |

That last row is the fix. Silently regenerating a higher LE is not a disclosure — it is the
tolerance violation, hidden. `applyDisclosedFees()` overlays the disclosed fees back onto the LE
and recomputes every dependent total, so the borrower sees the document that was issued rather
than whatever the fee model produces today. Staff previews never create or reset a baseline;
only borrower delivery does.

`GET /api/loan-applications/:id/le-tolerance` (internal staff) answers "what would this file owe
in cures if it closed on today's numbers?" without writing anything, and every
redisclosure/blocked event writes a `trid.tolerance_evaluated` audit entry carrying the cure
amount.

**Bucket classification, and the one judgment call.** Section A + Section B + transfer taxes are
zero-tolerance; recording fees are the 10% cumulative tier; prepaids and escrows carry no numeric
tolerance. **LE Section C (shoppable services) is classified zero-tolerance, not ten-percent** —
the 10% tier is conditioned on the consumer picking a provider from the creditor's written list
(§1026.19(e)(1)(vi)), and this platform has no written-list feature at all, so no consumer can
satisfy that condition. That is both the conservative and the likely-correct reading; it errs
toward flagging more, never less. Recorded in ledger entry `trid-1026-19e3-fee-tolerance` with
the same 14-day interval and the same honest verification status as F-1/F-2 — the network block
described above applied to this work too.

**Scope boundary:** this raises a redisclosure gate and quantifies exposure. It does not decide a
legal cure, and the figure must not be used to pay or decline one until the tier composition is
verified against the regulation.

### Combined verification

Typecheck clean · **1,473 unit tests green** (up from 1,421 at audit time; +52 across
`loCompensation`, `feeTolerance`, `rateLockConfirmation`, `leDisclosureBaseline`, and 4 added to
`mismoValidation`) · schema-migration guard, design-token ratchet, regulatory-freshness gate and
production build all pass. Migrations `0038`–`0040` are expand-only and idempotent; none
backfills.

---

## Remediation — F-5 and F-6 (2026-08-04)

### F-5 — submission now requires a counterparty

**⚠️ This changes production behavior. Read before the next deploy.**

`submitToWholesaleLender` never checked `approvalStatus` — the string appeared nowhere in
`server/`. It now consults `evaluateLenderSubmissionEligibility`
(`shared/wholesaleLenders.ts`) before anything else:

| Lender state | Environment | Outcome |
|---|---|---|
| `approved` | any | Allowed, real (`simulated: false`) |
| anything else | **production** | **BLOCKED** — `SubmissionBlockedError` with remediation steps |
| anything else | dev / preview | Allowed, recorded as a simulation, logged loudly |

**Every lender in the catalog is currently `target`, so this blocks all production submissions.**
That is the finding, enforced rather than described: transmitting a borrower's file to a company
with no broker agreement is not a thing the system should be able to do quietly. The gated-beta
walkthrough still works in dev/preview, where the `simulated` column already says what it is.

Authorization lives in the **catalog data, not in code** — flipping a lender to `approved` in
`shared/wholesaleLenders.ts` when the agreement is signed is what unblocks production. No env
var, no backdoor.

Two supporting pieces:

- **`approvedLenderCount()` is now a reported metric**, surfaced on `getAdminStats()` and the new
  compensation report. It is the binding constraint on revenue and belongs on a dashboard rather
  than implicit in an array.
- **Anti-steering now flags `singleCreditor`** (`server/services/antiSteeringOptions.ts`). The
  §1026.36(e)(3)(i) safe harbor needs options from "a significant number of the creditors" — what
  counts as significant is a counsel determination, so the flag deliberately asserts only the case
  needing no interpretation: one creditor is not several. With one approved lender, every option
  set the platform can produce is single-creditor.

### F-6 — revenue now exists

**What shipped.** A two-sided compensation lifecycle on `lender_submissions` (migration `0041`)
plus a pure ledger module (`shared/compensationLedger.ts`):

- **Expected** is snapshotted at submission from the comp plan elected on the application (F-1's
  columns) × the loan amount. Snapshotted, not derived on read — a later plan edit must not
  rewrite what we believed we were owed on a loan already in flight.
- **Received** is recorded at funding.
- **Variance** is `received − expected`, classified `as_expected` / `short_paid` / `over_paid` /
  `pending`, with a $1 rounding tolerance so lender-vs-our rounding noise doesn't bury real
  discrepancies.

**Funding now requires the money.** `updateSubmissionStatus` refuses the transition to `funded`
without `fundedLoanAmount` and `compensationReceivedAmount`. Revenue capture is structural rather
than a matter of discipline — marking a loan funded without recording what the lender paid is
precisely how the platform ended up unable to state its own revenue.

**The dashboard no longer implies pipeline volume is revenue.** `getAdminStats()` keeps
`totalLoanVolume` (now explicitly commented as pipeline volume) and adds a `compensation` block:
funded count and volume, expected vs. received compensation, variance, short-paid count, loans
funded with no remittance recorded, **pull-through**, and the approved-lender count.

Pull-through is computed over **resolved** submissions only (funded vs. denied/withdrawn), so the
metric tracks performance rather than drifting with pipeline size, and returns `null` rather than
a fake `0%` when nothing has resolved.

`GET /api/reports/compensation` (admin-only) returns the same roll-up plus a per-loan discrepancy
list: every funded submission that was short-paid, over-paid, or funded with no remittance.

**What this does not do.** It captures the revenue side only. The cost side (F-11) is still
absent — no cost-per-file, no vendor cost ledger, no LO commission — so gross margin per loan
remains uncomputable. Pull-through, previously unmeasurable, now is.

### Verification

Typecheck clean · **1,489 unit tests green** (+16) · schema guard, design-token ratchet,
regulatory-freshness gate and production build all pass. Migration `0041` is expand-only,
idempotent, and does not backfill: submissions predating it have no captured expectation, and
computing one retroactively from today's comp plan would invent a revenue record. They report as
`pending` — an honest gap.

---

## Remediation — F-7 and F-8 (2026-08-04)

### F-7 — the origination fee has a name now

`originationFee` is an itemized line in `closingCostDetails.loanCosts.originationCharges`
(`server/services/loanEstimate.ts`) and renders as **"Origination Fee"** above Points,
Application Fee and Underwriting Fee on the borrower's disclosure
(`client/src/pages/lending/LoanEstimate.tsx`).

The client was showing the defect literally: four `CostLineItem` rows and a `Subtotal` that
exceeded them by 1% of the loan amount — $4,000 unlabeled on a $400k loan, against
§1026.37(f)(1)'s requirement that each origination charge be itemized by name and amount.

`snapshotFromLoanEstimate` no longer reconstructs the fee by subtracting the itemized lines from
the section total; it reads the field. Tests pin the invariant that Section A's total equals the
sum of its named lines, so the gap cannot silently reopen.

Worth noting what this also fixed: the platform's **largest single revenue line** previously had
no name anywhere on the document that discloses it. F-6 made revenue visible internally; this
makes it visible to the borrower, which is the part the regulation is about.

### F-8 — the clawback register exists

**What shipped.** `shared/compensationClawback.ts` — a pure exposure model — plus surfacing on
the admin stats and the compensation report. No migration: it reads the `fundedAt` /
`compensationReceivedAmount` columns F-6 added.

Per funded loan it answers: is the compensation still reclaimable, how much, until when, and is
the window **contracted or assumed**. The register rolls that into `atRiskCount`, `totalAtRisk`
(the reserve figure), `indeterminateCount`, `nextExpiry`, and `usesAssumedWindow`.

Three deliberate choices:

- **The window is a flagged assumption, not an invented fact.** `DEFAULT_EPO_CLAWBACK_DAYS = 180`
  is labelled a PLATFORM ASSUMPTION in code and in ledger entry `platform-epo-clawback-window`.
  `WholesaleLender.epoClawbackDays` is where a real contracted term goes — `undefined` means *no
  agreement exists yet*, not *no clawback*. Every exposure computed from the default carries
  `windowSource: "assumed"`, and the register raises `usesAssumedWindow` so **no reserve figure
  can silently rest on a guess**. Fill the term in from each signed agreement, alongside flipping
  `approvalStatus` (F-5).
- **Unknown ≠ zero.** A funded loan inside its window with no remittance recorded is `atRisk`
  with `amountAtRisk: 0` *and* `indeterminate: true`. It is counted as an unknown rather than
  summed into the reserve as nothing.
- **`nextExpiry` is reported** — the register is a cash-planning tool, not just a total.

**The interaction that mattered most.** `lifecycleEngine.ts` raises a refi alert whenever market
rates sit 25 bps below a homeowner's rate. Pointed at a loan Homiquity funded six weeks ago, that
feature solicits the exact early payoff that triggers our own clawback — paying the lender back
the entire commission for the privilege of originating the refinance. The sweep now consults
`resolveClawbackForHomeowner` and withholds the alert while the window is open, counting
suppressions in the sweep summary.

That guard is **deliberately asymmetric**: when the funding lender cannot be resolved, or the
lookup fails, it falls back to the profile's close date and the assumed window — i.e. it
suppresses. A missed refi lead costs a lead; a solicited early payoff costs the whole commission.

**What this does not do.** It quantifies the exposure; it does not reserve against it, and it
does not cover EPD (early-payment-default) repurchase provisions, surety-bond or minimum-net-worth
requirements — the rest of F-13's register. Nor does it monitor for actual payoffs: nothing tells
the platform a loan paid off, so `totalAtRisk` is exposure, not realized loss.

### Verification

Typecheck clean · **1,505 unit tests green** (+16) · schema guard, design-token ratchet,
regulatory-freshness gate and production build all pass. No migration — F-8 reads columns
migration `0041` already added.

---

## Remediation — F-9 and F-11 (2026-08-04)

### F-9 — ⚠️ architecture fixed, values still unverified

**Read this before treating F-9 as closed.** The audit said these constants need "a cited
state/county/municipal table verified against current statute." **That did not happen, and could
not:** this environment's network policy blocked `ilga.gov`, `tax.illinois.gov` and `chicago.gov`
exactly as it blocked every federal regulatory host, and no Illinois fee schedule exists under
`docs/`. Inventing statutory rates would have been worse than leaving them flagged.

So this pass fixed **the thing that made F-9 systemic** — nothing distinguished a verified number
from a guess — and left the numbers themselves untouched and labelled:

- **`shared/compliance/feeProvenance.ts`** gives every third-party charge a provenance tier:
  `actual` (a real quote for this file) → `cited` (a published schedule with a source) →
  `platform_estimate`. All ten entries are currently `platform_estimate`, which is now *visible*
  rather than implied.
- **Transfer taxes carry `suspectedInaccurate: true`** — a single national 0.1%-of-price constant
  applied to an Illinois-only footprint where transfer tax is levied at state, county *and*
  municipal level. It is a zero-tolerance charge, so an understatement is a dollar-for-dollar cure.
- **`reportFeeProvenance()`** answers the question the audit actually asked: how much of this
  file's disclosure rests on guesses, and how many of those sit in the zero-tolerance bucket.
- Ledger entry `platform-closing-cost-fee-schedule` carries a **30-day** review interval so the
  gap stays loud.

**The practical half, which does change outcomes.** `ClosingCostInputs.actualFees` lets a file
disclose a *real* charge instead of the estimate, and `generateLoanEstimate` now populates it from
the F-11 cost ledger: an appraisal invoice booked against the file becomes the disclosed appraisal
fee. That matters because the appraisal is the largest single zero-tolerance variance and is
usually known before the LE has to go out — disclosing $1,200 up front **removes** the $550 cure
rather than measuring it after the fact.

**Still open:** upgrading each fee to `cited`, starting with transfer taxes. That is a
human-with-a-statute task, not an engineering one.

### F-11 — the cost side exists

**What shipped.** `loan_cost_entries` (migration `0042`) — append-only, one row per cost incurred
against a file — plus a pure roll-up in `shared/costLedger.ts`.

**Credit pulls are metered automatically.** `requestCreditPull` books a cost entry at the moment
it incurs one. This was the audit's specific example: the task engine deliberately re-runs pulls
via `CRD_EXPIRED`, so a stalled file silently accumulated spend that no surface reported. Entries
are flagged `simulated` while the credit adapter is a simulation, so demo spend can never land in
a real margin figure. Booking is non-fatal — a ledger failure must not block a credit pull.
Unit costs are a flagged platform assumption (`platform-credit-pull-unit-cost`), replaceable when
the F3 vendor contract lands.

**Staff record everything else** through `GET`/`POST /api/loan-applications/:id/costs`.
Append-only by design: a correction is a negative reversal row, never an edit, so the ledger stays
auditable. Negative amounts are therefore explicitly permitted.

**The metric that matters is cost per FUNDED loan.** Costs are incurred on every file; revenue
arrives only on the ones that close. `computeUnitEconomics` reports both `costPerFundedLoan` and
`costPerFileTouched` and names which is which — dividing by files touched flatters the business by
exactly the pull-through gap. With $710 of cost across three files and one funded, a closing costs
$710, not $237.

`/api/reports/compensation` now returns revenue, cost, gross margin, margin per funded loan, and
the cost breakdown largest-first alongside the F-6 revenue roll-up and the F-8 clawback register.

**Gross margin is explicitly an upper bound**, and the payload says so in `notes`: this ledger
captures direct vendor spend only. Loan-officer compensation, processing labour and overhead are
modeled nowhere, so the real margin is lower by whatever those cost. Reporting it as complete
would be the same class of error as reporting pipeline volume as revenue.

### Verification

Typecheck clean · **1,521 unit tests green** (+16) · schema guard, design-token ratchet,
regulatory-freshness gate and production build all pass. Migration `0042` is expand-only and
idempotent.

---

## Remediation — F-10 and F-12 (2026-08-04)

### F-10 — the extension fee now has a payer

`rate_locks` gained `extensionFeePaidBy` (`borrower` | `broker` | `lender`) and
`extensionFeeCocId` (migration `0043`). The extend endpoint enforces two rules:

1. **A fee requires a payer.** Any `extensionFee > 0` must name who bears it. An amount with no
   payer cannot distinguish a cost we absorbed from a charge we passed through — which was the
   entire economic content of the transaction, unrecorded.
2. **A borrower-paid fee requires a change of circumstance.** Passing the fee through increases a
   disclosed charge, so it must cite a §1026.19(e)(3)(iv) record — and the route verifies the
   record exists, belongs to *this* application, and is not voided, so the citation cannot be
   decoration. A rate lock is itself an enumerated changed-circumstance reason
   (`rate_lock` in the COC catalog), so the record should genuinely exist.

**Broker-paid fees are booked as costs.** When `paidBy === "broker"` the extension writes a
`rate_lock_extension` entry to the F-11 cost ledger, so it reaches the margin figures instead of
sitting inert on the lock row. Borrower- and lender-paid fees are not our cost and are
deliberately not booked. This is where F-10 and F-11 meet: the finding was that the fee lands
*somewhere*, and now the ledger says where.

(The Zod validation the audit also asked for landed earlier, with F-3.)

### F-12 — the Reg Z basis no longer flatters the file

`evaluatePointsAndFees` passed the **note amount** as the Regulation Z Total Loan Amount. The
real figure (§1026.32(b)(4)) is the amount financed less the financed points and fees — always
*lower* — so the percentage cap computed from the note amount is **larger** than the true one.
The check was permissive, and the comment claimed it "errs conservative-high," which was the
opposite of what the code did.

The basis is now derived from `knownPrepaidFinanceCharges()`: the platform's own origination-side
charges, which are known before closing. On a $400k file with no compensation elected that is
$2,100, so the basis is $397,900 and the cap **$11,937 — not $12,000**.

The direction is what matters. This still **under**-counts the true prepaid finance charges
(prepaid interest and prepaid MI need a closing date), so the result remains an upper bound on
the true Total Loan Amount and the cap it yields is still slightly permissive — but strictly
tighter than the note amount, **never looser**. Same monotone discipline as F-2's floor: it can
only over-flag.

A test pins the file the old cap waved through: $11,950 of points and fees fit under the
discarded $12,000 and does not fit under the real one. Three existing boundary tests encoded the
old permissive cap and were updated — that shift *is* the fix.

### Verification

Typecheck clean · **1,529 unit tests green** (+8, plus 3 boundary tests re-based) · schema guard,
design-token ratchet, regulatory-freshness gate and production build all pass. Migration `0043`
is expand-only, idempotent, and does not backfill — existing locks genuinely have no recorded
payer, and guessing one would falsify a fee record.

---

## Remediation — F-13 (2026-08-04)

The audit asked for "one page: each exposure, its per-file cap, its window, and the pipeline count
it multiplies against." That page now exists as
[CONTINGENT_LIABILITY_REGISTER.md](../governance/CONTINGENT_LIABILITY_REGISTER.md), backed by a
live endpoint — `GET /api/reports/contingent-liabilities` (admin) — rather than a static table
that would go stale the day after it was written.

**This finding was only fixable because the others were fixed first.** Every measurable exposure
became measurable through an earlier repair:

| Exposure | Measurable because |
|---|---|
| TRID good-faith cures | F-4 persisted the Loan Estimate baselines — there was nothing to diff against before |
| EPO clawback | F-8 modeled the window over F-6's funding columns |
| Honor exposure on unconfirmed quotes | F-3 made lender confirmation a recorded fact, so an unconfirmed row is now *distinguishable* from a real lock |
| Lock-extension cost | F-3's confirmed expirations + F-10's payer attribution |

**The rule the module enforces.** Some exposures can be measured; others are real, potentially
unbounded, and cannot be quantified without a statute or counsel — TILA damages, the surety bond,
minimum net worth. A register that silently omitted the second kind would produce a total that
*looks complete and is not*, which is worse than no total at all. So:

- the sum is named **`quantifiedFloor`**, never "total";
- `unquantifiedCount` and `incomplete` travel with it, so a consumer cannot read the number
  without also reading how much is missing from it;
- an exposure that cannot be priced carries `amount: null`, **never `0`** — a zero would read as
  "no exposure", which is a lie. A test asserts this per entry.

**Two judgment calls worth stating.**

*Reg Z / ATR liability is counted, not priced.* The register reports how many funded loans carry a
known defect and refuses to attach a dollar figure — TILA statutory and actual damages need the
statute and counsel, and inventing a multiplier would put a fabricated number on the balance
sheet. The count is the honest deliverable; the multiplier is a counsel input.

*The lock exposure changed shape because F-3 changed the risk.* The original finding sized it as a
rate-shock gap on locks the platform had invented. With confirmation now mandatory, a confirmed
lock is the lender's obligation — so the register splits it: **honor exposure** on legacy
unconfirmed rows (shrinking to zero as they are confirmed or withdrawn) and **extension cost** on
confirmed locks nearing expiry. That is a more accurate description of the residual risk than the
audit's own framing.

**What this does not do.** It does not set a reserve. The floor is the part of the reserve number
we can currently see; the governance page states plainly that the reserve must cover the floor
*plus* a counsel estimate for the unquantified set *plus* the licensing minimum that has to
survive both. And the minimum-net-worth line is where the whole page converges — every contingent
exposure is a claim against exactly the net worth the licence requires be maintained, so reserve
adequacy is not "can we pay this?" but "can we pay this and still clear the minimum?". That
question stays unanswerable until someone with the state statute fills that line in.

### Verification

Typecheck clean · **1,544 unit tests green** (+15) · schema guard, design-token ratchet, KB index
guard, regulatory-freshness gate and production build all pass. No migration — the register reads
tables migrations `0040`–`0043` already added.
