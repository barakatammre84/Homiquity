# Financial Architecture Re-Audit — 2026-08-10

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md) —
capital flow/liquidity, risk/liability, unit economics, balance sheet — re-run against HEAD
`2444950`, five days and ~50 merges later.

**Method:** verify the prior fixes still hold, then look at what the intervening work changed
about the money paths. Every figure below was produced by executing the repository's own functions
(`buildContingentLiabilityRegister`, `isLenderConfirmed`, `rateLockDescription`), not estimated.
Where code and doc disagree, the code wins (`L1_VISION_AND_SCOPE.md` §7).

**Bottom line.** The F-1…F-19 remediation holds, and the #417 lender refactor made the F-5
counterparty gate *stronger* than the audit that created it. But that refactor established a fact
the rest of the financial model never absorbed: **whether a counterparty is real is now a
first-class, per-row property — and only the submission path asks.** The rate-lock path, the
contingent-liability register, and the borrower-facing lock copy all still treat "a confirmation
number exists" as equivalent to "a lender is on the hook." Since every lender in the catalog is
`target` and three are `isDemo`, that equivalence is false for **every lock the platform can
create today**, and it understates the one reserve figure the company has by an order of
magnitude.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-20 | A simulated confirmation counts as the lender's obligation — honor exposure reports $0 | Balance sheet / Capital flow | **High** |
| F-21 | The rate-lock route accepts fictional demo lenders that the submission path hard-blocks | Risk / Counterparty | **High** |
| F-22 | There is no implemented path to approve a lender — the revenue switch does not exist | Capital flow / Ops | Medium |
| F-23 | Two surfaces compute EPO exposure over different windows | Balance sheet | Medium |
| F-24 | Over-paid compensation is booked as revenue and carried as no liability | Unit economics / Balance sheet | Medium |
| F-25 | Working capital is unmeasured — the cost and revenue ledgers are never joined on time | Capital flow / Liquidity | Medium |
| — | F-1…F-19 remediation holds at HEAD | all | ✅ verified |
| — | F-9 fee values, F-14 channel decision, F-17 comp-plan lever | — | ⚠️ still open, unchanged |

---

## 1. Capital Flow & Liquidity

### F-20 — A simulated confirmation is counted as the lender's obligation (High)

**The architectural problem.** F-3 closed the phantom lock by making lender confirmation
mandatory at creation. The #417 refactor then added a second, independent fact about a
counterparty: `approvalStatus` (is there an executed broker agreement?) and `isDemo` (is this
company fictional?). `POST /api/rate-locks` records that fact —
`simulated: lender.approvalStatus !== "approved"` (`server/routes/borrower/rateLocks.ts:128`) —
and **nothing downstream ever reads it.**

`isLenderConfirmed()` (`shared/rateLockConfirmation.ts:47-54`) tests four fields: `lenderId`,
`lockConfirmationNumber`, `confirmedRate`, `confirmedExpiresAt`. `simulated` is declared on the
`LenderLockConfirmation` interface one screen above (line 26) and is not among them. So:

```
isLenderConfirmed(simulated lock): true
kind:                              confirmed_lock
borrower noun:                     rate lock
activity copy:                     "Rate locked at 6.5% for 30 days, confirmed by the lender (SIM-123)."
```

That is the platform's own output, executed. The economics follow it:
`server/services/contingentLiabilityRegister.ts:95` routes every `isLenderConfirmed` row past the
honor-exposure bucket into the extension bucket, and the register's shipped note asserts the
premise outright — *"a confirmed lock is the lender's obligation, not ours."*

**It is not.** A confirmation keyed off a portal or a phone call with a company that has no broker
agreement with Homiquity binds nobody. The `simulated` flag exists precisely to say so; the
balance sheet does not consult it.

**Quantified — executed against `buildContingentLiabilityRegister`.** A 20-lock pipeline at
$300k average ($6.0M):

| Classification | Honor exposure | Extension exposure | `quantifiedFloor` |
|---|---|---|---|
| As shipped (`confirmed_lock`) | **$0** | $13,500 | **$13,500** |
| Treated as unenforceable | $120,000 | $0 | **$120,000** |

**An 8.9× understatement of the only reserve number the company produces** — and it is not a
tail scenario, it is the state of every lock the platform can create today, because
`approvedLenderCount()` is zero.

Two aggravating properties:

1. **The borrower-facing copy is the F-3 string, restored.** F-3's remediation replaced *"Rate
   locked at X% for N days"* with an explicit *"NOT a lender-confirmed lock"* for unconfirmed
   rows, and `tests/rateLockConfirmation.test.ts` pins that the old claim cannot reappear for
   *those* rows. It reappears intact for simulated-confirmed ones.
2. **The register self-reports as complete on this line.** `lock_honor` is `basis: "computed"`
   with `action: null` when the count is zero, so the page shows no gap. F-13's whole design
   principle — *never a total that looks complete and is not* — is defeated here not by omission
   but by misclassification.

**Structural fix.** Enforceability is two questions, not one. Keep `isLenderConfirmed` as the
structural test (are the fields present?) and add `isLenderEnforceable(lock) = isLenderConfirmed(lock)
&& !lock.simulated` as the economic one. Then:

- `rateLockKind` gains a third value — `simulated_confirmation` — and `rateLockNoun` /
  `rateLockDescription` stop calling it a rate lock in borrower copy.
- `contingentLiabilityRegister.ts` routes simulated-confirmed volume into `unconfirmedLoanVolume`
  (or a fourth bucket), and the `lock_honor` note drops the false premise.
- Pin it the way F-3 was pinned: a test asserting that a lock with `simulated: true` never
  produces the word "locked" in borrower copy and never reports $0 honor exposure.

### F-25 — Working capital is unmeasured: the two ledgers are never joined on time (Medium)

**The architectural problem.** For a broker with no balance sheet, the entire capital requirement
*is* working capital: cost goes out at credit-pull / appraisal / labour time, compensation arrives
at funding 30–45 days later, and files that die never repay theirs. F-6 built the revenue side and
F-11 built the cost side — but **neither carries a date into the roll-up.**

- `loan_cost_entries.incurredAt` exists (`shared/schema/compliance.ts:873`) and is even indexed
  with `applicationId` (line 889).
- `lender_submissions.fundedAt` exists (migration `0042`).
- `CostEntryLike` (`shared/costLedger.ts:28-32`) carries `applicationId`, `category`, `amount`,
  `simulated` — **no timestamp**. `computeUnitEconomics` takes no dates at all.

So the system can state cost-per-funded-loan and gross margin, and cannot state **how much cash
the pipeline is holding, or for how long.** The G-C cycle-time report
(`server/services/cycleTimeReport.ts`) measures application-created → funded, which is a
throughput metric; nothing measures cost-incurred → comp-received, which is the cash one.

**Why this is architectural and not a missing chart.** It is the same shape as F-13 on the
contingent side: the question *"how much cash does this business need to run its pipeline?"* has
no operands, so it has no answer — not a hard answer, no answer. And it is the question that binds
first, because a broker fails on working capital long before it fails on any exposure in the
register.

**Quantified with the platform's own numbers.** From the F-11 worked example ($710 of direct
vendor cost across three files, one funded) and a 60–80% pull-through: a 40-file in-flight
pipeline carries roughly **$28k of cash outstanding at any moment, of which 20–40% is spent on
files that will never repay it** — before loan-officer and processing labour, which
`computeUnitEconomics` already flags as uncaptured. Modest in absolute terms at pre-launch volume;
the point is that it is the only cash number the business has and it is uncomputed.

**Structural fix.** Add `incurredAt` to `CostEntryLike` and one function beside
`computeUnitEconomics`: for each application, cost outstanding and days since first cost, split by
in-flight / funded / dead. Three numbers fall out — **cash deployed in the pipeline**, **average
days from first cost to remittance** (the cash conversion cycle), and **cumulative cost written
off on dead files**. All three come from data already persisted; this is a wiring change over two
existing tables, exactly like F-18.

---

## 2. Risk & Liability

### F-21 — The rate-lock route accepts fictional lenders the submission path hard-blocks (High)

**The architectural problem.** `evaluateLenderSubmissionEligibility`
(`shared/wholesaleLenders.ts:111`) blocks `isDemo` rows **in every environment, ahead of the
approval check** — the #417 commit says why in terms worth repeating: *"so the PII path never
depends on remembering."*

`POST /api/rate-locks` performs no such check. Its only counterparty test is that the row exists:

```ts
const lender = await storage.getWholesaleLenderByLenderId(lenderId);
if (!lender) { /* 400 unknown_lender */ }
```

(`server/routes/borrower/rateLocks.ts:62-68`). It then reads `approvalStatus` solely to *label*
the row (line 128) and never to refuse it. The three fictional counterparties seeded by
`server/seedMarketPricing.ts` — Summit, BlueRiver, Atlas, all `isDemo: true`, all with
`.example` domains — are therefore valid backing for a rate lock, which per F-20 is then
presented to the borrower as *"Rate locked at 6.5%, confirmed by the lender."*

**Note which lenders those are.** They are the same three whose comp plans the entire QM
points-and-fees model (F-17/F-18/F-19) is calibrated against. A staff member reading the pricing
screen sees them as the lender set; nothing in the lock flow tells them otherwise.

**Quantified.** The exposure per file is F-20's: ~$8,000 on a $400k lock at the register's own
2-points-of-price scenario, sitting on Homiquity with no counterparty at all. The compliance
exposure is separate and harder to bound — a rate commitment naming a company that does not exist
is a UDAAP problem before it is a P&L problem.

**Structural fix.** One import. `POST /api/rate-locks` and the extend endpoint should call
`evaluateLenderSubmissionEligibility` (or a shared sibling with the same demo rule) and apply the
same three-way outcome the submission path already uses: demo blocked everywhere; non-approved
blocked in production; non-approved outside production allowed **only** as a labelled simulation
that F-20's fix keeps out of borrower lock copy. One eligibility rule, every money path — the same
"two surfaces, one schedule" argument that put the QM basis in `loanCosts.ts`.

### F-22 — There is no implemented path to approve a lender (Medium)

**The architectural problem.** `approvalStatus` is the binding constraint on all revenue (F-5),
and **nothing in the application writes it.** Verified across `server/`, `client/src/` and
`migrations/`: the only writers are the `DEFAULT 'target'` in migration `0051` and
`server/seedWholesaleLenders.ts:55`, which seeds `"target"` explicitly. Every read site
(`lenderSubmission.ts`, `stats.ts`, `rateLocks.ts`) consumes it; no route sets it.

The admin surface that exists — `PATCH /api/admin/pricing-policy/lenders/:id`
(`server/routes/admin/pricingPolicy.ts:211-253`) — validates and writes `brokerCompensation` and
nothing else. `epoClawbackDays` is in the same position: `seedWholesaleLenders.ts:33` calls it
"operator-owned", and no operator surface can set it.

Meanwhile two places instruct staff to use a screen that does not exist:

- the F-5 block message — *"Set the lender's approval status to `approved` on the admin lender
  screen"* (`shared/wholesaleLenders.ts:139`);
- the #417 commit body — *"they stay in the table and get retired from the admin screen at
  go-live."*

**Consequence.** This is fail-closed, so it creates no risk of harm — that is why it is Medium and
not High. What it creates is a **launch blocker disguised as a completed control**. On the day the
first broker agreement is signed, turning on revenue requires a hand-run `UPDATE` against
production, which `CLAUDE.md`'s database rules forbid ("never hand-apply, never `db:push` to
prod"). The single most consequential business-state transition the company will make has no
supported path, and the error message says it does.

The downstream effect on the balance sheet is F-23's: because `epoClawbackDays` can never be
recorded, the clawback reserve is permanently `usesAssumedWindow: true` no matter how many
agreements get signed.

**Structural fix.** Extend the admin lender endpoint to `approvalStatus` and `epoClawbackDays`,
with the controls the transition deserves given what it unlocks: a required reason, an audit entry
(the sibling comp update already writes one), and a refusal to move an `isDemo` row to `approved`
at all. Then correct the two instruction strings.

---

## 3. Unit Economics & Margin Leakage

### F-24 — Over-paid compensation is booked as revenue and carried as no liability (Medium)

**The architectural problem.** `summarizeCompensation` (`shared/compensationLedger.ts:196-198`)
adds every recorded remittance into `receivedCompensation` regardless of variance status.
`computeUnitEconomics` (`shared/costLedger.ts:143`) then takes that figure verbatim as `revenue`,
and gross margin follows from it.

The module knows better one screen up. The `over_paid` branch (line 131) reads:

> *"Over-paid by $X — expected $Y, received $Z. **Confirm before recognizing it; lenders claw back
> overpayments.**"*

So the code states in prose that an over-payment is not revenue, and books it as revenue anyway.
`EXPOSURE_CATEGORIES` (`shared/contingentLiabilities.ts:31-38`) carries seven entries and none of
them is this one.

**Quantified.** A 25 bps over-remittance on a $400k loan is $1,000 booked as margin that the
lender will reclaim; the register shows $0 against it. The dollars are small at current volume —
the architectural point is the asymmetry: the platform built a careful two-sided ledger
specifically so a **short**-pay could never hide, and the mirror case flows straight into the
margin figure unexamined.

**Structural fix.** `summarizeCompensation` already computes the classification. Return
`overPaidAmount` alongside `shortPaidCount`, subtract it from the revenue figure
`computeUnitEconomics` consumes (or report `recognizedCompensation` separately from
`receivedCompensation`), and add an eighth register category — *unearned compensation subject to
reclaim* — on the same `computed` basis as EPO clawback. It is the same exposure with a shorter
window.

### The unit-economics picture, restated

Unchanged from 2026-08-05 in structure. What this pass adds is that **two of the three cash
questions a CFO would ask still have no operands**:

| Question | Status |
|---|---|
| What does a funded loan earn? | ✅ F-6 — modulo F-24's over-payment leak |
| What does a file cost to produce? | ✅ F-11 — direct vendor spend only; labour still uncaptured |
| How much cash is tied up in the pipeline, and for how long? | ❌ **F-25 — unmeasured** |
| What could we owe? | ✅ F-13 — modulo F-20's misclassification and F-24's missing category |

---

## 4. Balance Sheet Integrity

### F-23 — Two surfaces compute EPO exposure over different windows (Medium)

`/api/reports/compensation` builds its clawback register **with** the contracted term:

```ts
epoClawbackDays: lenderByKey.get(s.lenderId)?.epoClawbackDays,
```
(`server/routes/underwriting/submissions.ts:388`)

`/api/reports/contingent-liabilities` — the reserve page — builds the same register **without**
it (`server/services/contingentLiabilityRegister.ts:68-78` maps `submissionId`, `applicationId`,
`status`, `lenderId`, `fundedAt`, `compensationReceivedAmount`, and omits the field). It therefore
resolves `clawbackWindowFor(undefined)` → the 180-day platform assumption, always.

**Today the two agree**, because no lender carries a contracted term (and per F-22, none can).
That is exactly what makes it worth fixing now: it is invisible until the first agreement lands,
and then it diverges silently. If a signed EPO window is longer than 180 days — 12-month clauses
are common — **the reserve page understates the exposure while the revenue report states it
correctly**, and the page that understates is the one labelled "balance sheet."

The second-order effect is the F-22 one: the register hard-codes itself into
`usesAssumedWindow: true` forever, so the flag stops carrying information the moment it should
start.

**Structural fix.** One line — pass `epoClawbackDays` through in
`contingentLiabilityRegister.ts`, the way the sibling report already does. Add a test asserting
the two endpoints produce the same `totalAtRisk` for the same submissions; that is the invariant,
and it is the one the F-19 fix established as the house pattern (two surfaces, one basis).

### F-16 still holds ✅

Asset-light remains correct. No warehouse line, no loans held for sale, no servicing asset, no
duration mismatch on assets, because there are no assets. The one place a broker takes duration
risk is the rate commitment — and F-20/F-21 are that risk reappearing not as a new mismatch but as
a **measurement** failure: the commitment is real, the counterparty behind it is not, and the
register scores it as though it were.

---

## Verified — the prior remediation holds at HEAD

Re-checked directly against `2444950`, not taken from the logs:

- **F-5 survived the #417 lender refactor and got stronger.** Repointing submission at the
  `wholesale_lenders` table could have read `status = 'ACTIVE'` as approved and transmitted
  borrower PII to companies that have never heard of us. Migration `0051` added
  `approval_status DEFAULT 'target' NOT NULL`, so every pre-existing row landed fail-closed, and
  `isDemo` was added as an independent hard block ahead of the approval check. The gate is better
  than the audit that created it asked for. **That work is the reference standard the rate-lock
  path (F-21) should be held to.**
- **F-1/F-2/F-17/F-18/F-19 hold.** `loanCosts.ts` still requires a compensation model and throws
  without one; `PLATFORM_FINANCE_CHARGES` is still the single classification both the QM numerator
  and denominator read; `resolvePlatformFinanceCharges` still trims to fit.
- **F-3 holds at the creation seam** — all four confirmation fields required, unknown lender and
  expired confirmation both refused. It is the *classification* seam that leaks (F-20).
- **F-13's discipline holds** — `quantifiedFloor` never called a total, `unquantifiedCount`
  travelling with it, surety bond and minimum net worth carried as `policy_unquantified` with
  `amount: null` rather than `0`.
- **F-15 (RESPA §8) holds** — the partner and CPA spines still carry no fee, commission or payout
  column, with the reasoning still written where the next engineer hits it.

**Still open and correctly so:** F-9 fee values (needs a human with the Illinois statute), F-14
channel decision (founder-owned; `BUSINESS_CHANNEL` still reads `broker` and the freeze guard is
in the CI gate), F-17's residual comp-plan ceiling (a negotiation, not a code change).

### Counterparty concentration — unchanged

Zero executed broker agreements, so concentration is 100% on whichever lender signs first. The
code models this honestly (`approvedLenderCount()` reported as a metric, `singleCreditor` flagged
in anti-steering). F-22 adds one thing to the picture: **there is currently no way to record the
first signature even after it happens.**

---

## Recommended sequence

1. **F-20 + F-21 together** — one root (the money paths disagree about what makes a counterparty
   real) and effectively one fix (thread `simulated`/`isDemo` through the lock path and the
   register). Until then the reserve figure is wrong by ~9× and borrower copy claims a lock nobody
   made. **Do this before any lock is created against a demo lender.**
2. **F-23** — one line, and it must land before the first broker agreement, not after.
3. **F-22** — needed on the day an agreement is signed; the work is an afternoon and the
   alternative is a forbidden hand-edit to production.
4. **F-24** — small, and it closes the last asymmetry in a ledger built to be symmetric.
5. **F-25** — the largest of the five and the only one that is new analysis rather than a
   plumbing gap. It answers the question a broker actually fails on first.

**Not found wanting:** the #417 counterparty gate, the asset-light structure (F-16), RESPA §8
discipline (F-15), the append-only fee schedule and its audit trail, and the register's refusal to
print a total it cannot stand behind.

---

## Verification & provenance

**Suite green at HEAD:** 173 server test files / 2,367 tests, plus 60 client files / 415 tests —
**2,782 passing, 0 failing**. No regression in any prior remediation.

Re-audit run 2026-08-10 against HEAD `2444950`. F-20's figures were produced by executing
`isLenderConfirmed`, `rateLockDescription` and `buildContingentLiabilityRegister` from this
repository against a simulated-confirmed lock and a 20-lock / $6.0M book; the output is quoted
verbatim in that section. Every other claim cites a file and line verified at HEAD.

Regulatory readings are flagged rather than asserted, per the `CLAUDE.md` rule — F-21's UDAAP
characterisation and F-24's revenue-recognition treatment both name a concern without asserting a
legal conclusion, and neither is relied on by any recommended fix.

**No code was changed by this audit.** All six findings are reported, not remediated.
