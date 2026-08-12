# Financial Architecture Audit — Revenue Representation & the QM Revenue Ceiling — 2026-08-11

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md) —
capital flow, risk/liability, unit economics, balance sheet — re-run against HEAD six days later.

**Method:** verify the prior remediation still holds, then audit the surfaces those passes
*created* rather than the ones they replaced. Every figure below was computed by executing the
repository's own functions (`resolvePlatformFinanceCharges`, the 2026 QM threshold tables) at the
default published schedule, not estimated. Every claim cites a file and line.

**Framing (unchanged and still correct).** Homiquity is a mortgage broker
(`shared/businessChannel.ts:50`). There is no warehouse line, no loans held for sale, no servicing
asset and no duration risk on assets, because there are no assets. The exposures are contingent
and fee-side. What this pass adds is that the *revenue* side is now the weakest part of the
financial architecture — not because it is missing (2026-08-04 fixed that) but because what was
built models **one of the two revenue streams** and is blind to the mechanism that actually sets
the size of both.

---

## Bottom line

The 2026-08-05 re-audit closed by declaring the fee lever spent: *"Fees are no longer the
constraint at any loan size. What remains is the comp-plan ceiling — and that is a negotiation,
not a code change."*

**That remaining lever is worth approximately zero in the segment the product targets.** Computed
at $1 granularity through the platform's own fee-fit function: raising compensation from 175 bps
to 200 bps on a $120,000 file changes total revenue per file by **$0.00**. Total revenue at
$120,000 is **$4,038 at every comp plan from 175 through 275 bps.** Because compensation and the
platform's own fees consume the same QM points-and-fees cap, and the F-17 remedy makes our fees
the shock absorber, above roughly 200 bps every additional basis point of lender compensation is
paid for one-for-one out of our own fee revenue.

The QM cap — not the market, not the comp negotiation — sets revenue per file below ~$250,000.
And none of it is visible: the fee revenue it consumes is not modeled as revenue anywhere.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-20 | Total revenue per file is pinned by the QM cap; the comp lever is worth ~$0 under $250k | Unit economics | **High** |
| F-21 | The QM fee trim is an unbudgeted, unrecorded revenue concession | Margin leakage | **High** |
| F-22 | Revenue is modeled as lender compensation only — the platform's own fees are revenue nowhere | Unit economics | **High** |
| F-23 | The only receivable a broker has cannot be represented: funding and remittance are forced to be one event | Capital flow / balance sheet | Medium-High |
| F-24 | The comp ledger is blind to the compensation model, so every borrower-paid file reads as a lender short-pay | Risk / unit economics | Medium |
| F-25 | The cost ledger has no payer or recovery dimension — pass-throughs are indistinguishable from absorbed spend | Balance sheet | Medium |
| F-26 | No file records which fee-schedule version priced it, and the pricing fallback is silent | Balance sheet integrity | Low-Medium |
| — | F-1…F-19 remediation holds at HEAD (182 money-path tests green) | all | ✅ verified |
| — | F-9 values, F-14 channel decision, surety bond / net worth | — | ⚠️ still open, now **live** |

---

## 1. Unit Economics & Margin Leakage

### F-20 — Revenue per file is set by the QM cap, not by pricing (High)

**The architectural problem.** After the F-17 remedy, three numbers compete for one budget: the
QM points-and-fees cap (§1026.43(e), tiered — 5%, then a flat $4,139, then 3%), the lender's
compensation in basis points, and the platform's own borrower-paid charges. When the first is
binding, `resolvePlatformFinanceCharges` (`server/services/loanCosts.ts:332`) trims *our* charges
to fit. The company therefore does not price its own product below the cap — the cap prices it,
and compensation decides how the capped amount is split between the lender's remittance and our
invoice.

**Quantified — computed from the repo's own functions**, default schedule, 2026 note date,
lender-paid:

*Our fee revenue after the trim (standard = $2,000; the $100 tax service fee is a pass-through and
is excluded):*

| Loan | 150 bps | 175 bps | 200 bps | 225 bps | 250 bps | 275 bps |
|---|---|---|---|---|---|---|
| $100k | $2,000 | $2,000 | $2,000 | $1,788 | $1,538 | $1,288 |
| $120k | $2,000 | $1,938 | $1,638 | $1,338 | $1,038 | $738 |
| $150k | $2,000 | $1,720 | $1,356 | $992 | $628 | $264 |
| $200k | $2,000 | $2,000 | $1,840 | $1,356 | $869 | $384 |
| $300k | $2,000 | $2,000 | $2,000 | $2,000 | $1,356 | $628 |
| $500k | $2,000 | $2,000 | $2,000 | $2,000 | $2,000 | $1,112 |

*Marginal revenue of +25 bps of compensation, in dollars per file:*

| Loan | 150→175 | 175→200 | 200→225 | 225→250 | 250→275 |
|---|---|---|---|---|---|
| $100k | $250 | $250 | **$38** | **$0** | **$0** |
| $120k | $238 | **$0** | **$0** | **$0** | **$0** |
| $150k | $95 | **$11** | **$11** | **$11** | **$11** |
| $200k | $500 | $340 | **$16** | **$13** | **$15** |
| $250k | $625 | $625 | $345 | **$17** | **$18** |
| $400k | $1,000 | $1,000 | $1,000 | $840 | **$29** |

**What this means for the business model.**

1. **The comp negotiation is not a lever in the target segment.** Total revenue at $120,000 is
   $4,038 at 175, 200, 225, 250 and 275 bps alike. The 2026-08-05 conclusion that the comp plan is
   the one surviving lever is true only above ~$250,000.
2. **A richer comp plan is worse than neutral for the company, not better.** The displaced dollars
   move from an invoice we control (borrower-paid fees, collected at closing) to a remittance a
   counterparty controls (F-23: no aging, no collections), at par.
3. **The real revenue driver is loan-size mix, and nothing in the funnel selects for it.** Revenue
   per file is flat at ~$4,038 from roughly $110k to $130k and then climbs with loan size; the
   acquisition surfaces (IL DPA directory, renter incubator, buying-power tools) are pointed at the
   flat part of that curve.
4. **The cost side is not flat.** Cost-to-originate is broadly invariant to loan size, and labor is
   not captured at all (`shared/costLedger.ts:132-137` says so). A $4,038 revenue file and a
   $12,000 revenue file consume the same underwriter.

**Structural fix.** This is a business decision the code can only make visible — but it must be
made visible, because today it is not computed anywhere:

- Add a **revenue-per-file curve** to the admin pricing-policy preview
  (`server/routes/admin/pricingPolicy.ts` already resolves the trim per loan size — it shows what
  the *borrower* is charged and not what *we* earn). Show total revenue and marginal revenue per
  25 bps, so a comp negotiation is entered with the number in hand.
- Set the standing comp plan at the **knee of the curve** (~200 bps at the current schedule), not
  at the maximum the lender will grant — above the knee, the extra bps are funded by our own fee
  line.
- Treat **minimum economic loan amount** as a marketing-targeting parameter, not a gate. The QM
  dead band is gone (F-17); what replaced it is a revenue plateau, and a plateau is a targeting
  problem, not an eligibility one.

### F-21 — The QM fee trim is an unbudgeted, unrecorded revenue concession (High)

**The architectural problem.** `resolvePlatformFinanceCharges` returns `standardTotal`, `total`
and `reduced` (`server/services/loanCosts.ts:307-320`). The difference — what the file gave up to
clear the cap — is used to price the Loan Estimate and then discarded. It is:

- **not in the cost ledger** (`shared/costLedger.ts`) — it is not a cost;
- **not in the compensation ledger** (`shared/compensationLedger.ts`) — that models lender comp only (F-22);
- **not in the contingent-liability register** (`shared/contingentLiabilities.ts`) — it is not contingent;
- **not persisted on the file at all** — no column carries `reduced` or `standardTotal`.

So the single largest recurring reduction in platform revenue leaves no trace, and no report can
answer "how much fee revenue did we give up to the QM cap last month?"

**Quantified.** Swept at $500 granularity, 2026 note date, Summit's default 200 bps lender-paid:
**every file from $20,000 through $216,000 is trimmed.** That is the whole target segment, not an
edge. Representative concessions against the $2,000 standard: $120k → $1,638 (**$362**, 18%);
$150k → $1,356 (**$644**, 32%); $200k → $1,840 ($160, 8%). The deepest point in the sweep is
$700 retained at $28,000 (a **$1,300**, 65% concession). At 275 bps a $150k file retains **$264 of
$2,000 — an 87% concession** — and nothing in the system says so.

At 40 files/month averaging a $400 concession, this is **~$192,000/year** of revenue that the P&L
will show as never having existed.

**Structural fix.** Persist the resolution with the disclosure, then report it:

1. Stamp `platform_fee_standard_total`, `platform_fee_charged_total` and `platform_fee_reduced` on
   the issued Loan Estimate row at the moment the LE is generated (`server/services/loanEstimate.ts:449`
   already resolves both halves).
2. Add `feeConcession` to the unit-economics roll-up (`computeUnitEconomics`,
   `shared/costLedger.ts:139`) as a named revenue reduction, not a missing number.
3. Alert when the concession exceeds a policy threshold (e.g. >40% of the reducible schedule) —
   that is the signal that the comp plan, not the fee schedule, is out of position (F-20).

### F-22 — Revenue is modeled as lender compensation only (High)

**The architectural problem.** `UnitEconomicsInput` takes exactly one revenue input —
`receivedCompensation` (`shared/costLedger.ts:106`) — and `computeUnitEconomics` sets
`revenue = round2(input.receivedCompensation)` (`shared/costLedger.ts:143`). The platform's own
borrower-paid charges are absent: the $500 application fee, the $1,500 underwriting fee
(`server/services/loanCosts.ts:46-48`), and — under a borrower-paid election — the 1%-of-loan
origination fee that *is* the entire compensation for the file.

Every derived figure inherits the omission: `grossMargin`, `grossMarginPct`, `marginPerFundedLoan`
and the admin dashboard's compensation summary (`server/storage/stats.ts:99`).

**Quantified.** On a $200,000 lender-paid file at 200 bps, actual gross revenue is $5,840
($4,000 comp + $1,840 trimmed fees). The platform records **$4,000 — a 31% understatement.** The
error is not constant: it is the trimmed fee line, which by F-20/F-21 varies from $2,000 down to
$264 depending on loan size and comp plan. So the recorded revenue series is wrong by a
loan-size-dependent amount, which makes it useless for exactly the comparison it exists to
support.

The module already states that gross margin is an **upper bound** because labor is uncaptured
(`shared/costLedger.ts:132-137`). It is simultaneously a **lower bound** because a whole revenue
stream is uncaptured. A figure that is bounded in both directions by unmeasured quantities is not
a margin.

**Structural fix.** Make revenue two-sided, mirroring the two payers:

- `lenderCompensation` — remitted by the counterparty (already modeled).
- `borrowerPaidRevenue` — the platform's own charges *as actually charged after the trim*, plus
  borrower-paid origination where elected, collected through the settlement agent at closing.

Both belong in `UnitEconomicsInput`; `grossMargin` should sum them. The tax service fee stays out
of revenue — it is a pass-through, and it is already flagged `reducible: false` for that reason
(`server/services/loanCosts.ts:120-131`).

---

## 2. Capital Flow & Liquidity

### F-23 — The only receivable a broker has cannot be represented (Medium-High)

**The architectural problem.** A submission cannot enter `funded` without a remittance figure:
the route refuses it (`server/routes/underwriting/submissions.ts:284-300`) and the service refuses
it again (`server/services/lenderSubmission.ts:346-353`, and the column comment at
`shared/schema/delivery.ts:169` — *"Required to mark a submission funded"*). Worse, when the
transition succeeds the service writes `compensationReceivedAt = fundedAt`
(`server/services/lenderSubmission.ts:356-366`) — the two dates are equal **by construction**.

The intent is right and was the correct fix for F-6: revenue is realized at funding, so capture it
there. The consequence is that the real-world sequence — the loan funds, the broker's wire arrives
days to weeks later — has no representation:

- **There is no `funded, awaiting remittance` state.** DSO is structurally zero and cannot be
  measured; there is no aging bucket, no collections queue, and no report that answers "what are we
  owed and how old is it?"
- **The available workaround is worse than the gap.** Staff who do not yet have a remittance figure
  must either enter a false one (a $0 entry reads as a 100% short-pay through
  `evaluateCompensationVariance`) or leave the submission un-funded — which also keeps the loan out
  of funded volume, out of the EPO clawback window (which runs from *funding*), and therefore out
  of the contingent-liability register (`server/services/contingentLiabilityRegister.ts:67`).

**Quantified.** At 40 funded files/month and $8,000 average comp, a 15-day average remittance lag
is **~$120,000 of receivable that the balance sheet cannot show**, against a company whose
licensing minimum net worth is still unquantified (see §4). A lender that simply never remits is
detectable only by someone remembering.

**Structural fix.** Small, and the columns mostly exist:

1. Allow `funded` with `compensationReceivedAmount` null; keep `fundedLoanAmount` required.
2. Stop coupling the dates — `compensationReceivedAt` is already a separate nullable column
   (`shared/schema/delivery.ts:171`); set it only when a remittance is recorded.
3. Add a `POST .../remittance` transition that records the amount, sets the date, and runs the
   existing variance evaluation.
4. Report aging (0–15 / 16–30 / 30+ days) off `fundedAt` where `compensationReceivedAt is null`,
   next to the contingent-liability register — the receivable and the clawback are the same book.

### F-24 — The comp ledger is blind to the compensation model (Medium)

**The architectural problem.** `compensationAmount()` returns `loanAmount × bps / 10_000` for
**both** models (`shared/compliance/loCompensation.ts:65-67`), and `submitToLender` writes that as
`compensationExpectedAmount` on every submission regardless of election
(`server/services/lenderSubmission.ts:265-276`). Under a **borrower-paid** election the lender
remits nothing — that money is collected from the borrower as the origination fee, through the
settlement agent.

`evaluateCompensationVariance` never receives the model
(`shared/compensationLedger.ts:60-64`), and `compensationModel` — which *is* persisted
(`shared/schema/delivery.ts:165`) — has **zero readers** in `shared/compensationLedger.ts`,
`server/routes/underwriting/submissions.ts` or `server/storage/stats.ts` (verified by grep).

**Quantified.** A borrower-paid $300,000 file at 200 bps records an expectation of $6,000 against a
counterparty that owes $0. At funding, staff record the lender's actual remittance — $0 — and the
ledger reports **`short_paid` by $6,000** with the message *"Reconcile against the lender's
remittance advice."* Meanwhile the file's real revenue (a $3,000 origination fee plus the trimmed
platform fees) is recorded nowhere (F-22). The variance detector, whose entire purpose is to make a
real short-pay visible, emits a false one on every borrower-paid file.

**Structural fix.** Pass the model into the variance evaluation and branch on it:
`lender_paid` → expect a remittance and reconcile it; `borrower_paid` → expect **$0** from the
lender, and carry the borrower-paid origination as `borrowerPaidRevenue` (F-22) reconciled against
the closing disclosure instead. The election is already frozen at LE issuance
(`server/routes/lending/pricing.ts`), so the snapshot is safe to trust.

---

## 3. Balance Sheet Integrity

### F-25 — The cost ledger has no payer or recovery dimension (Medium)

`loan_cost_entries` carries `category`, `vendor`, `amount`, `incurredAt`, `automatic`, `simulated`
(`shared/schema/compliance.ts:862-889`) — and nothing that says **who ultimately paid** or
**whether it was recovered**. Every row is treated as unrecovered platform spend by
`summarizeCosts` (`shared/costLedger.ts:59`).

Several categories in the enum (`appraisal`, `title`, `flood`, `verification`) are ordinarily
**borrower charges disclosed on the Loan Estimate** and settled at closing. Booking one is
therefore ambiguous: it may be money the company absorbed, money it fronted and recovered, or a
charge that never touched the company's cash at all. The same appraisal can appear as a borrower
charge on the LE and as a cost against gross margin in the same month.

Direction of the error is unknowable, which is the problem: gross margin is documented as an upper
bound (labor missing) while being understated by any pass-through booked as ours. Two unmeasured
errors of opposite sign do not cancel — they make the figure unusable.

**Structural fix.** Add `payer` (`platform` | `borrower` | `lender`) and `recoverable` /
`recoveredAt` to `loan_cost_entries`; default `payer = 'platform'` so existing rows keep their
current meaning. Report **unrecovered platform cost** as the margin input and pass-throughs
separately. Only the three automatic writers need touching
(`server/services/creditPulls.ts:42`, `server/routes/borrower/rateLocks.ts:335`,
`server/routes/underwriting/submissions.ts:510`).

### F-26 — No file records which fee-schedule version priced it (Low-Medium)

`platform_fee_schedules` is append-only and versioned specifically so an issued Loan Estimate stays
reproducible (`server/services/platformFeeSchedule.ts:10-21`). But **no table stores the version
that priced a file** — `feeScheduleVersion` / `schedule_version` appears nowhere in `server/`,
`shared/`, `client/` or `migrations/` (verified by grep). The `version` field is read for display
in the admin panel and then dropped.

Compounding it, `getActiveFeeSchedule()` deliberately swallows a read failure and returns the
compiled-in baseline, logging to `console.error` (`server/services/platformFeeSchedule.ts:90-93`).
That choice is defensible — pricing must not hard-fail on a config table — but its consequence is
not recorded anywhere: a transient database blip during LE generation prices the file under the
baseline schedule, and nothing distinguishes that file afterward.

**Where the loss lands.** The LE baseline snapshot protects the borrower correctly — the disclosed
amounts are persisted and any later increase becomes a recorded cure
(`server/services/leDisclosureBaseline.ts:14-26`). So if the published schedule is *higher* than
the baseline, the shortfall is not a borrower problem; it is **our revenue, written off as a cure,
with no way to attribute it to the fallback that caused it.** With an admin free to publish any
schedule, the per-file magnitude is unbounded by design.

**Structural fix.** Stamp `fee_schedule_version` (nullable = compiled-in baseline) on the
`loan_estimate_disclosures` row at issuance, and promote the fallback from a `console.error` to a
counted error-monitoring event (`server/services/errorMonitoring.ts`) so a config outage is
visible as a pricing incident rather than a log line.

---

## 4. Verified sound, and what remains open

**The prior remediation holds at HEAD.** 12 money-path test files, **182 tests, 0 failures**
(`compensationClawback`, `compensationElectionQmGate`, `contingentLiabilities`,
`counterpartyAndCompensation`, `extensionFeeAndRegZBasis`, `feeProvenanceAndCosts`, `feeTolerance`,
`leDisclosedFeeProvenance`, `loCompensation`, `platformFeeSchedule`, `pricingUnderwriting`,
`qmThresholds`). Spot-verified directly:

- **F-3 (phantom lock)** — `rate_locks` still requires a lender confirmation.
- **F-10 (extension payer)** — `extensionFeePaidBy` is required whenever a fee is charged, and a
  borrower-paid extension requires a changed-circumstance id (`server/routes/borrower/rateLocks.ts:237-251`).
- **F-16 (asset-light)** — `BUSINESS_CHANNEL = "broker"` (`shared/businessChannel.ts:50`);
  `holdsFundingRisk()` is false; no warehouse line, no held-for-sale asset, no duration mismatch.
  Still the correct structure and still worth defending.

**Still open and unchanged:**

- **F-9** — the ten third-party fee constants remain `platform_estimate`; needs a human with the
  Illinois statute.
- **F-14** — the channel decision remains founder-owned; the delivery stack stays frozen.
- **Counterparty capacity is still zero.** Every seeded wholesale lender sits at
  `approvalStatus: "target"` (`server/seedWholesaleLenders.ts:55`), and `isApprovedLender` requires
  `"approved"`. Revenue capacity is $0 until a broker agreement is executed — which caps everything
  in this document at zero, and remains the binding constraint on the business.

**Newly live rather than newly found:** the company has held its Illinois licence since 2026-07-13.
The **surety bond** and **minimum net worth** lines in the
[Contingent Liability Register](../governance/CONTINGENT_LIABILITY_REGISTER.md) are therefore no
longer prospective obligations — they are current conditions of an active licence, and both still
carry no figure. F-23 sharpens why that matters: the receivable that would fund a cure or a
clawback is the one thing the balance sheet cannot currently show.

---

## Provenance

Third pass in the financial-architecture series
([2026-08-04](./2026-08-04-financial-architecture-capital-structure-audit.md) ·
[2026-08-05](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md)). Findings continue
that numbering at F-20. All quantification was produced by executing
`resolvePlatformFinanceCharges` from `server/services/loanCosts.ts` against
`DEFAULT_PLATFORM_FEE_SCHEDULE` with a 2026 note date; no figure here is an estimate.
