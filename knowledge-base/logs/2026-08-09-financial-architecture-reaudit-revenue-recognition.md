# Financial Architecture Re-Audit — 2026-08-09

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md)
— capital flow, risk/liability, unit economics, balance sheet — re-run against HEAD
(`2444950`, 2026-08-08).

**Method:** read the money-bearing code paths at HEAD, then compute every figure by executing
the repository's own functions (`computeClosingCosts`, `compensationAmount`,
`summarizeCompensation`, `computeUnitEconomics`) rather than estimating. Where a doc and the code
disagree, the code wins (`L1_VISION_AND_SCOPE.md` §7).

**Bottom line.** The prior two waves hold at HEAD — the lender-confirmation gate on rate locks,
the counterparty approval gate, the QM election pre-flight and the contingent-liability register
are all intact, and the QM/compensation tests are green. This pass looked at the one seam both
prior audits treated as settled: **what the platform books as revenue.** Both audits reasoned
about compensation as though it were the whole of it. It is not. The platform charges the
borrower $2,000 in its own flat fees on **every** file regardless of who pays the originator,
and those dollars are absent from the revenue ledger while being present in the QM
points-and-fees numerator. The same $2,000 is treated as originator-side money for the cap that
refuses business and as not-originator-side money for the bar that governs who may pay us.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-20 | Consumer-paid platform fees ride alongside lender-paid compensation; the §1026.36(d)(2) guard covers the origination fee only | Risk | **High** — ⚠️ flagged, escalated (Reg Z text unverifiable in-session) |
| F-21 | Revenue representation is single-channel: 20–31.5% of a funded loan's revenue is invisible, and a borrower-paid file reports negative margin | Unit economics | **High** |
| F-22 | Under a borrower-paid election, compensation *recorded* and compensation *charged* are two independent numbers | Unit economics / Risk | Medium |
| F-23 | No receivable side: the cost ledger is debit-only and no cash-conversion figure exists | Capital flow / Balance sheet | Medium |
| — | F-1…F-13, F-17…F-19 remediation holds at HEAD | all | ✅ verified |
| — | F-9 fee values, F-14 channel decision | — | ⚠️ still open, unchanged |
| — | Asset-light structure, lock discipline, counterparty gate, contingent register | Balance sheet | ✅ Sound |

---

## 1. Risk & Liability

### F-20 — The dual-compensation guard is applied to one fee out of three (High)

**The architectural problem.** `computeClosingCosts` (`server/services/loanCosts.ts:619-660`)
gates exactly one charge on the compensation model:

```
const originationFee = borrowerPaidOriginationAllowed(compensation.model)
  ? loanAmount * schedule.originationFeeRate
  : 0;
```

Two lines later the application fee and underwriting fee are charged **unconditionally**, taken
from `resolvePlatformFinanceCharges` with no reference to the compensation model at all. Under a
lender-paid election the borrower therefore pays Homiquity $2,000 while Homiquity is
simultaneously paid 175–225 bps by the lender on the same transaction.

**Computed from the repo's own functions** (`computeClosingCosts`, seeded comp plans,
2026 note date):

| Loan amount | Comp plan | Borrower → broker | Lender → broker |
|---|---|---|---|
| $200,000 | BlueRiver 175 bps | **$2,000.00** | $3,500.00 |
| $200,000 | Summit 200 bps (default) | **$1,840.00** | $4,000.00 |
| $200,000 | Atlas 225 bps | **$1,356.00** | $4,500.00 |
| $300,000 | Summit 200 bps | **$2,000.00** | $6,000.00 |
| $400,000 | Summit 200 bps | **$2,000.00** | $8,000.00 |

The origination fee is $0.00 in every row — the F-1 fix is working exactly as designed. The
$2,000 beside it is the part no guard touches.

**The internal contradiction is the finding, and it does not depend on a regulatory reading.**
Note the $200,000 rows: the borrower-paid total falls to $1,840 and $1,356 rather than staying at
$2,000. That is the F-17 trim-to-fit logic reducing the platform's own fees so they fit under the
QM points-and-fees cap. The code therefore already treats these dollars as **originator-side
charges** in the §1026.32(b)(1) numerator — they shrink the cap, they refuse loan sizes, they
were the subject of the F-19 correction — while treating them as **not** originator compensation
for the §1026.36(d)(2) test one function away. One of those two treatments is wrong. The code
should not be able to hold both.

**Quantified.** $2,000 per funded file. TILA §130 liability for §1026.36 violations attaches per
transaction (actual damages plus statutory damages, plus costs and fees), so it scales linearly
with volume from the first funded loan — the same exposure shape F-1 was rated Critical for, at
half the dollar size.

**What this audit does NOT assert.** Whether a flat application or underwriting fee retained by a
broker is "compensation" under §1026.36(a)(3) — and therefore whether this is a (d)(2) violation
or a permissible bona-fide charge — is a Regulation Z reading. `docs/reg-z/` holds no
authoritative source text and every authoritative host (`ecfr.gov`, `consumerfinance.gov`,
`govinfo.gov`, `law.cornell.edu`) is blocked from this environment, so per `CLAUDE.md` this is
**flagged, never asserted**. Ledger entry: `regz-1026-36d2-consumer-paid-platform-fees`.

**Structural fix.** Two steps, in this order:

1. **Make the classification explicit and single-sourced.** `PLATFORM_FINANCE_CHARGES` already
   declares which of our charges are §1026.4 finance charges. Add the second axis it is missing —
   whether each charge is *retained by the originator* — so the QM numerator and the (d)(2) gate
   read the same field instead of disagreeing implicitly. This is a refactor with no behavior
   change and can ship now.
2. **Then decide the behavior with counsel.** If retained flat fees are consumer-paid
   compensation, `borrowerPaidOriginationAllowed` must gate all three charges, not one — under
   lender-paid, borrower-paid platform fees go to zero (conservative, removes a borrower charge,
   permitted to ship ahead of verification per the `CLAUDE.md` Reg Z rule). If they are not, the
   F-19 decision to count them in the points-and-fees numerator needs re-examining, because it is
   currently refusing $10–13k bands of loan amounts per comp plan on that basis.

Do not do step 2 in either direction without the confirmed text. The two outcomes move business
in opposite directions.

---

## 2. Unit Economics & Margin Leakage

### F-21 — Revenue is single-channel; a profitable file can report a negative margin (High)

**The architectural problem.** `summarizeCompensation` (`shared/compensationLedger.ts:179`) reads
`compensationExpectedAmount` / `compensationReceivedAmount` off `lender_submissions` — the
lender's remittance, and nothing else. `computeUnitEconomics` (`shared/costLedger.ts:142`) takes
that figure as `revenue`. The platform's own flat fees are revenue on every funded file and
appear in neither.

**Computed** (`summarizeCompensation` + `computeUnitEconomics`, Summit 200 bps, lender-paid):

| Loan amount | Ledger revenue | Actual revenue | Understated by |
|---|---|---|---|
| $200,000 | $4,000.00 | $5,840.00 | **$1,840.00 (31.5%)** |
| $300,000 | $6,000.00 | $8,000.00 | **$2,000.00 (25.0%)** |
| $400,000 | $8,000.00 | $10,000.00 | **$2,000.00 (20.0%)** |

**The borrower-paid case is worse than an understatement — it is wrong-signed.** A funded
$300,000 file at a borrower-paid 200 bps election, with $650 of booked appraisal cost, rolls up as:

```
summarizeCompensation → receivedCompensation: 0, compensationVariance: -6000, shortPaidCount: 1
computeUnitEconomics  → revenue: 0, grossMargin: -650, marginPerFundedLoan: -650
```

The lender owes us nothing on a borrower-paid file, so the $6,000 "short-pay" is an artifact, and
the file that actually earned $5,000 from the borrower reports **−$650**. If staff instead leave
the remittance unrecorded (the honest thing to do — there is no remittance), the file lands in
`awaitingRemittanceCount` forever.

**This breaks the module's own stated invariant.** `computeUnitEconomics` returns
`costSideIncomplete: true` and documents that gross margin is therefore an **upper bound**. With
20–31.5% of revenue omitted the sign of the error is unknown, and in the borrower-paid case the
figure is a *lower* bound. A number labeled "upper bound" that is actually a lower bound is the
class of error the ledger modules were written to prevent.

**Structural fix.** Revenue is two-sided for a broker and the ledger has to be too. Book
borrower-paid platform fees as a revenue line at Loan Estimate issuance (expected) and at closing
disbursement (received), on the same expected/received/variance shape the compensation ledger
already uses — the arithmetic exists, it just has one input. Then make `UnitEconomicsInput` take
`{ lenderPaidCompensation, borrowerPaidRevenue }` rather than a single scalar, so the roll-up
cannot silently represent one channel as the whole. Gate the `short_paid` verdict on
`compensationModel === "lender_paid"`: a borrower-paid file has no lender remittance to compare
against and must report `not_applicable`, not a discrepancy.

### F-22 — Recorded compensation and charged compensation are independent numbers (Medium)

Under a borrower-paid election the platform records `compensationExpectedAmount =
loanAmount × electedBps` (`server/services/lenderSubmission.ts:275`) and charges the borrower
`loanAmount × schedule.originationFeeRate` (`loanCosts.ts:639`). Those are two unrelated fields:
`bps` is elected per file (`PATCH /api/loan-applications/:id/compensation`, free over
0…`MAX_ELECTABLE_COMPENSATION_BPS`), while `originationFeeRate` is a schedule-level constant
(1%). At a 200 bps borrower-paid election on $300,000 the platform records **$6,000** of expected
compensation and charges the borrower **$3,000**.

`shared/compliance/loCompensation.ts:174-176` states the opposite as fact — *"The fee schedule
derives one from the other"* — and `pointsAndFeesFloor` takes `Math.max(originationFee, comp)` to
avoid double-counting dollars it believes are the same dollars. They are not the same dollars, so
the QM floor is scoring a borrower-paid file at a compensation figure the borrower will never be
charged: conservative against the cap, but it refuses loan amounts on a number that does not
exist.

**Structural fix.** Under `borrower_paid`, derive the origination fee from the elected bps
(`loanAmount × bps / 10_000`) so the comment becomes true, and keep `originationFeeRate` as the
default for the election rather than an independent charge. If the two must stay separable, the
`Math.max` in `pointsAndFeesFloor` has to become a sum and the comment must be corrected.

---

## 3. Capital Flow & Liquidity

### F-23 — The ledger has a debit side and no credit side (Medium)

`loan_cost_entries` meters what a file *costs* — credit pulls book automatically
(`server/services/creditPulls.ts:115`), broker-paid lock extensions book automatically
(`rateLocks.ts`), and everything else is staff-entered. There is no counterpart for what a file
*owes us*: no receivable, no collection event, no reconciliation between a disclosed borrower
charge and a dollar received. `resolveFeeAmount` can pull an appraisal *invoice* into the
disclosure, so the platform models paying a vendor and does not model being paid.

For a broker this is *mostly* correct — borrower charges settle on the closing statement, not
through us, and F-6 was right that the absence of money movement is not itself a defect. Two
consequences are real anyway:

1. **Nothing reconciles the disclosed charge against the received dollar.** A TRID zero-tolerance
   bucket is enforced against what was *disclosed* (F-4's baselines), but a fee collected at a
   different amount than the one that cleared tolerance is invisible to the platform.
2. **The cash-conversion cycle is unrepresented.** Costs land at file open, compensation arrives
   at funding, and it stays reclaimable for a further ~180 days (`DEFAULT_EPO_CLAWBACK_DAYS`).
   At the pull-through the cost ledger already reasons about, every funded loan carries the
   metered cost of the dead files beside it, financed out of working capital that has no figure
   anywhere in the system. `costPerFundedLoan` answers "how much" and nothing answers "for how
   long".

**Structural fix.** Add a `collected` counterpart to the fee-provenance model: disclosed →
expected → received, per borrower charge, so (1) becomes a reconciliation the platform can
compute. For (2), extend the cycle-time report (`server/services/cycleTimeReport.ts` — it already
measures the days) with a cost-weighted view: days-from-first-cost-to-remittance is the working
capital number, and the register already knows the clawback tail. Neither needs company financials
in the system; both are computable from data already persisted.

---

## 4. Balance Sheet Integrity — sound, and worth restating

The 2026-08-04 conclusion holds at HEAD and re-verifying it was most of this pass:

- **Asset-light is the right structure and is intact.** No loans held, no warehouse line, no
  servicing asset, therefore no duration mismatch on assets and no asset-liability matching
  problem. The declared channel is still `broker` (`shared/businessChannel.ts`), the
  seller/servicer stack is still frozen behind `scripts/delivery-stack-freeze-guard.cjs`, and
  F-14's decision remains founder-owned and open.
- **The contingent register is the balance sheet, and it exists.**
  `GET /api/reports/contingent-liabilities` reports a `quantifiedFloor` with an
  `unquantifiedCount` beside it and never a "total" — the surety bond, minimum net worth and TILA
  damages are named as unquantified rather than summed as zero. That discipline is what makes
  F-20 above reportable rather than alarming: it has a place to sit.
- **Duration risk on rate commitments is closed.** `POST /api/rate-locks` requires a lender
  confirmation number, a known approved lender, and a future lender-confirmed expiry; an
  unconfirmed row is an indicative quote and cannot be extended. F-3's honor exposure now only
  exists on rows written before that gate.
- **Counterparty capacity is gated at the right seam.** `evaluateLenderSubmissionEligibility`
  refuses demo rows in every environment and unapproved lenders in production;
  `approvedLenderCount` surfaces the binding constraint. Concentration is not *measured* (with
  zero approved counterparties there is nothing to measure yet), but the gate that makes
  concentration a choice rather than an accident is in place.

**One thing to watch:** reserve adequacy is assessable and unassessed. The register computes what
could be reclaimed; nothing states what is held against it. That is a founder input, not a code
gap — but the first funded loan starts a 180-day clawback tail against a reserve figure that
currently exists nowhere.

---

## Verification

- Typecheck and the compensation/QM suites green at HEAD
  (`tests/compensationElectionQmGate.test.ts`, `tests/lenderSubmission.test.ts` — 56 tests).
- Every dollar figure above was produced by executing the repository's own functions against the
  seeded comp plans, not estimated.
- `scripts/regulatory-freshness.cjs` and `scripts/doc-freshness-guard.cjs` both pass; three Reg Z
  entries come due 2026-08-18 and remain verbatim-unverified for the same blocked-network reason
  documented in their notes.

## Ownership

| Finding | Next step | Owner |
|---|---|---|
| F-20 | Confirm §1026.36(a)(3)/(d)(2) text against a real source; then gate all three charges or re-examine F-19 | **Founder + counsel** |
| F-20 step 1 | Single-source the "retained by originator" classification (no behavior change) | Engineering |
| F-21 | Two-channel revenue in the ledger; `not_applicable` variance on borrower-paid files | Engineering |
| F-22 | Derive the borrower-paid origination fee from the elected bps | Engineering |
| F-23 | Collected-side provenance; cost-weighted cycle time | Engineering |
| Reserve | State a reserve against `totalAtRisk` before the first funded loan | **Founder** |
