# Financial Architecture Re-Audit — The Order That Costs Nothing — 2026-08-18

**Scope:** the standing four areas — capital flow & liquidity, risk & liability, unit economics,
balance sheet — re-run against HEAD (`a846325`), four days after the
[2026-08-14 propagation pass](./2026-08-14-financial-architecture-reaudit-revenue-fix-propagation.md)
and two after the
[2026-08-16 lock-lapse pass](https://github.com/barakatammre84/Homiquity/pull/521) (PR #521, still
open — its `F-0816-*` findings are **not** re-derived here).

**Method:** diff-driven first, then the ledger's own
[standing signals](../financial-audit/LEDGER.md#standing-signals--where-findings-keep-coming-from).
Both findings were confirmed by **executing the repository's own functions** against constructed
rows (rail R6). Ids are date-qualified: `F-0818-01`, `F-0818-02`.

**Bottom line.** The structure is still sound — asset-light, no payment rail, no warehouse line,
no custody, so there is no duration mismatch to hedge and F-16 holds. What this pass found is not
in the money math either. It is that **the platform has two surfaces for one economic act**: the
screen that orders a vendor service and the screen that books what a vendor service cost are
different pages, called by different roles, joined by nothing. Ordering a $650 appraisal through
the live `/partner-services` page creates a real obligation to an AMC and moves **no financial
figure at all**.

The consequence is the one direction an audit most wants to catch: **gross margin is overstated
and the working-capital requirement understated.** As built, the repo's own unit-economics
function reports a **99.5% gross margin** on a funded file — a number no mortgage brokerage has
ever earned, and the tell that the cost side is not merely incomplete (which
`costSideIncomplete: true` already discloses) but is missing its largest *vendor* line.

---

## Severity-ordered summary

| id | Finding | Area | Severity |
|---|---|---|---|
| `F-0818-01` | `POST /api/partner-orders` — the surface that actually orders appraisals, title, flood, VOE/VOI/VOA and credit — stamps `partner_orders.fee` and writes **no `loan_cost_entries` row**. Vendor spend reaches the margin only if a *different* staff member keys the same invoice again on a *different* page. Executed: gross margin **99.5% vs 89.5%** on one file; committed working capital **$600 vs $12,600** at 20 files/mo | Unit economics / Capital flow | **High** |
| `F-0818-02` | The same route carries **none of the controls the other cost writer accumulated**: no TRID cure evaluation (`disclosureImpact`, one consumer), no audit-log entry on a money-out act, and `partner_orders.fee_paid_by_borrower` — the column that decides whether the charge is our cost at all — has **no writer and no reader anywhere in the repo** | Risk & liability | Medium |
| `F-0814-01` · `F-0814-02` · `F-0814-04` | Re-verified **still open at HEAD**, unchanged | — | ⚠️ confirmed |
| — | Tax-service-fee revenue classification — hypothesised contradiction between `PLATFORM_FINANCE_CHARGES` and `PLATFORM_REVENUE_FEE_IDS` | Unit economics | ❌ refuted |
| — | Rent reporting carries no billing hook, price surface, or payment processor, and says so | Unit economics / Risk | ✅ sound |
| — | F-16 asset-light structure; no duration mismatch, no custody, no warehouse line | Capital flow / Balance sheet | ✅ re-verified sound |
| — | F-9 fee values · F-14 channel decision · `F-0812-05` minimum net worth | — | ⚠️ unchanged, owner-blocked |

---

## `F-0818-01` — the order that costs nothing

**Area:** unit economics / capital flow · **Severity:** High

### The architectural problem

There are two vendor-spend tables and they were never joined.

`partner_orders` (`shared/schema/admin.ts:293`) is the operational record: one row per ordered
third-party service, `serviceType` drawn from `PARTNER_SERVICE_TYPES` — `credit_report`,
`title_search`, `appraisal`, `flood_cert`, three verification types, `tax_transcripts`,
`homeowners_insurance` — with a `fee` column stamped from the provider's `baseFee`.

`loan_cost_entries` (`shared/schema/compliance.ts:902`) is the financial record, and it is the
**only** table any margin, cost-per-loan or working-capital figure reads.

`POST /api/partner-orders` (`server/routes/borrower/partnerOrders.ts:108-114`) writes the first
and never the second:

```ts
const order = await storage.createPartnerOrder({
  ...result.data,
  status: "pending",
  orderedBy: user.id,
  orderedAt: new Date(),
  fee: provider.baseFee,          // a real obligation to a real vendor
});
// …then a deal activity. No createLoanCostEntry. No audit log.
```

This is not dead code. `/partner-services` is a routed, live staff page
(`client/src/App.tsx:495-496` → `client/src/pages/agent-broker/PartnerServices.tsx:99`) and the
route is assignment-scoped and role-gated, i.e. built to be used.

`createLoanCostEntry` has exactly three call sites in the whole server
(`server/services/creditPulls.ts:42`, `server/routes/borrower/rateLocks.ts:360`,
`server/routes/underwriting/submissions.ts:611`). Two of them are narrow automatics — a credit
pull at $5/$15/$30, and a **broker-paid** lock-extension fee. The third is a manual form on an
unrelated page (`client/src/pages/staff/borrowerFile/FinancialsTab.tsx:103`). So the appraisal —
the largest single vendor line on a file, and the one the platform discloses to the borrower at
**$650** (`server/services/loanCosts.ts:666`) — enters the books only when somebody remembers to
type it in twice.

`costLedger.ts` already discloses that its cost side is incomplete, but it names the gap
precisely: *"processing labour, loan-officer salary and overhead are not captured, so gross margin
is an upper bound"*. Vendor spend is **not** on that list. The reader of
`unitEconomics.costSideIncomplete` is told the missing pieces are labour and overhead, and is
entitled to believe direct vendor spend is complete. It is not.

### Executed evidence

Ran the repository's own `summarizeCosts` → `computeUnitEconomics` and
`computeWorkingCapitalPosition` → `projectWorkingCapital` against a constructed $400k borrower-paid
file. Revenue is what `recognizeRevenue` actually returns for it (`platformFees: 6000`,
`lenderCompensation: 0`, both channels, remittance recorded), so only the cost side varies:

| cost entries present | `directCost` | `grossMargin` | `grossMarginPct` |
|---|---|---|---|
| **AS BUILT** — credit pull only | $30 | $5,970 | **99.5%** |
| + appraisal ($600 AMC `baseFee`) | $630 | $5,370 | 89.5% |
| + appraisal + title ($900) | $1,530 | $4,470 | 74.5% |

And on the liquidity figure, 20 files a month with a 30-day median / 45-day p90 days-to-cash:

| | `committed` | `costPerUnrecoveredFile` | Little's-Law projection @p90 |
|---|---|---|---|
| **AS BUILT** | $600 | $30 | $900 |
| with the appraisal booked | **$12,600** | $630 | **$18,900** |

A **21× understatement** of the cash the business has committed to files in flight, and an
$18,000 error in the only figure that exists to tell the owner how much headroom to hold. Both
directions are the dangerous ones: margin looks better than it is, and the cash requirement looks
smaller than it is.

Two honest caveats on the size, neither of which changes the finding:

1. Whether the title leg is company-borne is genuinely uncertain — which is `F-0818-02`'s point.
   The $630 row is the defensible floor.
2. `costPerFundedLoan` correctly absorbs dead-file cost into the funded denominator, so the
   pull-through arithmetic is right; it is right about a base that is missing its largest term.

### The shape, for the ledger

This is standing signal #3 (*a column written but never read*) and the `F-0808-01` precedent —
**"a live payout table reaching no margin figure"** — repeating exactly, with `partner_orders`
in the place `broker_commissions` occupied on 2026-08-08. That log's own sentence still applies
verbatim: *a declared gap and an unjoined table look identical in a margin figure and are entirely
different problems.*

### Structural fix

Accrue the obligation where it is incurred, the way `creditPulls.ts` already does:

1. `createPartnerOrder` books a `loan_cost_entries` row — `amount: provider.baseFee`,
   `automatic: true`, `simulated: provider.isTestMode` (the flag already defaults to `true`, so
   test-mode orders segregate exactly as simulated vendor legs do today), `category` mapped from
   `serviceType` (`appraisal`→`appraisal`, `title_search`→`title`, `flood_cert`→`flood`, the three
   `verification_*`→`verification`, `credit_report`→`credit_report`, the remaining two→`other`).
2. **Reconcile, do not double-count.** The manual `POST /api/loan-applications/:id/costs` entry must
   supersede the accrual for the same order rather than add to it — the negative-amount reversal
   row the schema already permits is the mechanism (`compliance.ts:910`).
3. Book **nothing** when the borrower pays the vendor directly — which requires `F-0818-02` first.
4. Extend `costLedger.ts`'s incompleteness note only *after* this lands; today it under-declares
   what is missing.

---

## `F-0818-02` — the controls stopped at the other writer

**Area:** risk & liability · **Severity:** Medium

Three controls exist on the manual cost route and on none of the ordering route. Each was added by
a prior audit, and each has exactly one consumer.

**1. The TRID cure evaluation.** `F-0807-03` established that a staff-keyed cost entry silently
creates **zero-tolerance** cure liability, and the remediation computes `disclosureImpact` at the
moment of booking (`server/routes/underwriting/submissions.ts:631-655`). `grep` returns that
identifier in exactly one file. Ordering an appraisal at a provider `baseFee` that differs from the
$650 on the issued Loan Estimate is the *same act* — a real third-party charge diverging from a
disclosed zero-tolerance line — and it is evaluated nowhere. Standing signal #1, verbatim.

**2. The money-out audit trail.** `F-0808-05` closed on the rule that *"a $30 credit pull was
audited, opening a payable worth up to 10% of the loan amount was not"*. `partnerOrders.ts`
contains no `auditLog` call at all — it writes a `deal_activity`, which is a timeline entry, not
the immutable trail. Ordering a $2,000 title policy on a borrower's file is a money-out act with no
audit record.

**3. The payer, which decides whether it is our cost at all.**
`partner_orders.fee_paid_by_borrower` (`shared/schema/admin.ts:309`) defaults to `true` and appears
**exactly once in the repository — its own declaration.** No writer, no reader, no route field, no
UI. Standing signal #3 in its purest form: not merely a column nothing reads, but a column nothing
has ever written.

This matters because the codebase has already decided the principle and applied it once.
`server/routes/borrower/rateLocks.ts:356` books a lock-extension fee as cost **only** when
`extensionFeePaidBy === "broker"`, with the comment: *"Borrower- and lender-paid fees are not our
cost and are deliberately not booked."* `revenueRecognition.ts:55-61` states the mirror rule on the
revenue side: Section B/C charges are *"the borrower's money moving to a vendor, never ours"*. The
discipline is written down twice and reaches the ordering surface neither time — so the platform
cannot answer, for any appraisal it has ever ordered, whether the money was its own.

### Structural fix

Require the payer at order time — `feePaidByBorrower` moves into the `POST /api/partner-orders`
Zod schema as a required field, not a defaulted one, since a default of `true` on a column nothing
sets is an assumption wearing the clothes of a record. Then `F-0818-01`'s accrual reads it, the
`disclosureImpact` evaluation is called on the same body it already accepts elsewhere, and the
order gets an audit entry beside its deal activity.

---

## Confirmed still open at HEAD

Re-verified by direct read this tick, not carried forward from the log that raised them:

| id | verified |
|---|---|
| `F-0814-01` | `server/routes/underwriting/submissions.ts:378` and `server/services/lenderSubmission.ts:357` both still call `evaluateCompensationVariance` with `expectedAmount`/`receivedAmount` only — no `compensationModel`. 2 of 3 call sites still wrong |
| `F-0814-02` | `server/storage/stats.ts:89-101` still selects seven columns, `compensationModel` not among them, and still calls `summarizeCompensation` rather than `recognizeRevenue` |
| `F-0814-04` | `server/services/lenderSubmission.ts:365` still stamps `compensationReceivedAt: fundedAt` — the same instant |
| `F-0816-01` · `F-0816-02` · `F-0816-03` | Raised by the 08-16 pass, **on the unmerged PR #521**. Not re-derived here. `F-0816-02` and `F-0818-01` compound: one excludes funded-but-unremitted files from committed capital, the other excludes the appraisal from every file |

## Refuted

**Hypothesis:** `PLATFORM_REVENUE_FEE_IDS` (`shared/revenueRecognition.ts:62`) excludes the tax
service fee as a third-party pass-through, while `PLATFORM_FINANCE_CHARGES`
(`server/services/loanCosts.ts:132-140`) counts it as the platform's own charge and the *platform
fee schedule* sets its price — so the platform would be charging a fee it books as nobody's
revenue.

**Refuted.** `platformFinanceCharges()` classifies it explicitly and consistently:
`{ id: "tax_service", …, reducible: false }`, with the comment *"The tax service fee is a vendor's
charge passed through — we cannot discount somebody else's fee, so it is not reducible."* Being in
the Reg Z finance-charge list (which is a §1026.4 disclosure question) and being platform revenue
(which is a whose-money question) are different memberships, and the code already keeps them
apart. Recorded so a later tick does not re-raise it.

## Verified sound

**Rent reporting carries no revenue path, deliberately.** The only money-adjacent code in the diff
since the last audit was the rent/lease work (`server/routes/borrower/leases.ts`,
`server/storage/leases.ts`, `server/services/rentFurnishing.ts`, `shared/leaseView.ts`).
`RENT_REPORTING_BILLING_ENABLED = false` (`rentFurnishing.ts:47`) is a constant, not a flag, and
its comment records both why (charging monthly for reporting that is not occurring is a
deceptive-practice exposure; the CROA advance-payment question at 15 U.S.C. §1679b(b) is open with
counsel) and the structural guard: *"There is no billing hook, no payment processor, and no price
surface anywhere in the product. Flipping this constant is therefore not sufficient to charge
anyone."* Recorded as `sound` so a later unit-economics pass does not read the absent revenue line
as a defect.

**F-16 asset-light.** Re-verified: no payment rail, no warehouse line, no custodial or trust
account, no loans held for sale. No duration mismatch, no borrower funds in custody, no
operational-account separation question to answer. F-14 (broker vs. mini-correspondent) remains
the single decision that would invalidate all of it.

---

## What this pass did not do

No fix. No ledger row was at `authorized` when the tick started (rail R7) — discovery is not
permission. Both findings enter the ledger at `open` for the owner to promote.
