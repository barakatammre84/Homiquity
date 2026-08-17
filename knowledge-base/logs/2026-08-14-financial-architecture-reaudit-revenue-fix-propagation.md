# Financial Architecture Re-Audit — Did the Revenue Fix Reach the Other Surfaces? — 2026-08-14

**Scope:** the standing four areas — capital flow & liquidity, risk & liability, unit economics,
balance sheet — re-run against HEAD (`1f520b1`) two days after the
[2026-08-12 counterparty-integrity pass](./2026-08-12-financial-architecture-reaudit-counterparty-integrity.md)
and the revenue-recognition work that followed it.

**Method:** diff-driven first, then the ledger's own
[standing signals](../financial-audit/LEDGER.md#standing-signals--where-findings-keep-coming-from).
Every finding below was confirmed by **executing the repository's own functions** against
constructed rows, not by reading the code or the docs. Ids are date-qualified per the scheme
adopted 2026-08-12: `F-0814-01` … `F-0814-04`.

**Bottom line.** The structure is sound and no prior finding regressed. The asset-light broker
model was re-verified directly: no payment rail, no warehouse line, no custodial or trust
account, no loans held for sale anywhere in `server/` or `shared/`. Under the broker channel
there is **no duration mismatch to hedge and no borrower funds in our custody** — F-16 holds, and
F-14 (broker vs. mini-correspondent) remains the one decision that would invalidate it.

The defect this pass found is not in the money math. It is that **the 08-12 remediation landed on
one consumer of each rule and the sibling surfaces were never taught it** — the exact shape the
ledger records as standing signal #1, repeating two days after it was written down.

---

## Severity-ordered summary

| id | Finding | Area | Severity |
|---|---|---|---|
| `F-0814-01` | The borrower-paid compensation rule reaches **1 of its 3 call sites**. The staff discrepancy worklist and the funding status-machine both still book every borrower-paid funded file as a lender short-pay for the full compensation amount | Unit economics / Risk | **High** |
| `F-0814-02` | The admin dashboard never selects `compensationModel` and never calls `recognizeRevenue` — so the 08-12 two-channel revenue fix reached the reports route only. The company's headline financial panel is still single-channel *and* carries the phantom short-pay | Unit economics | **High** |
| `F-0814-03` | Lender **over-payment is recognized as revenue in full**, carried as no liability, and not even counted — the function that classifies it warns "lenders claw back overpayments" and the roll-up beside it recognizes it anyway | Balance sheet | Medium |
| `F-0814-04` | `compensationReceivedAt` is stamped **equal to `fundedAt`** by its only writer, so the remittance lag is a fabricated zero and days-to-cash collapses to the funding cycle — defeating the guard `cycleTimeReport.ts` was built to raise | Capital flow / Liquidity | Medium |
| — | F-16 asset-light structure; no duration mismatch, no custody, no warehouse line | Capital flow / Balance sheet | ✅ re-verified sound |
| — | F-9 fee values · F-14 channel decision · `F-0812-05` minimum net worth | — | ⚠️ unchanged, owner-blocked |

---

## `F-0814-01` — the borrower-paid rule reaches one of three call sites

**Area:** unit economics / risk · **Severity:** High

`evaluateCompensationVariance` documents its own failure mode in the source
(`shared/compensationLedger.ts:67-76`):

> Omitting this reads every borrower-paid file as a lender short-pay (F-0811-05).

There are exactly three call sites in the repository. **One passes `compensationModel`.**

| call site | passes the model? | what it drives |
|---|---|---|
| `shared/compensationLedger.ts:284` (inside `summarizeCompensation`) | ✅ yes | the internal roll-up counter |
| `server/routes/underwriting/submissions.ts:378` | ❌ **no** | the staff-facing **discrepancy worklist** |
| `server/services/lenderSubmission.ts:357` | ❌ **no** | the variance computed **at funding**, in the status machine |

The 08-12 fix (`F-0811-05`) was applied to the roll-up. The two surfaces a human actually acts on
were not.

**Executed evidence** — same $400k borrower-paid file, both call shapes:

```
roll-up path (passes model)      -> as_expected
discrepancy path (omits model)   -> short_paid  variance=-8000
  "Short-paid by $8000.00 — expected $8000.00, received $0.00.
   Reconcile against the lender's remittance advice."
```

**Why it matters.** Under a borrower-paid election the lender remits nothing *by design* — the
consumer pays the originator. The worklist at `submissions.ts:383` filters to
`short_paid | over_paid | pending` and hands the result to staff as money to chase. So every
borrower-paid funded file appears on the collections list at its full compensation amount, and
staff are dispatched to reconcile a remittance against a lender that owes nothing. The roll-up
says $0 variance while the worklist beside it says $8,000 owed, from the same row, in the same
HTTP response.

**Quantification:** the phantom receivable is the file's full compensation — $8,000 on a $400k
file at 200 bps — times every borrower-paid funded file. It is 100% of that cohort, not a sampling
error, and it is wrong in the direction that invents an asset.

**Structural fix.** Pass `compensationModel` at both sites. Better: make it non-optional on the
input type so the compiler enumerates the call sites — the rule has now been fixed once and
re-derived wrongly twice, which is what an optional field on a money predicate buys.

---

## `F-0814-02` — the revenue fix reached one of the two revenue surfaces

**Area:** unit economics · **Severity:** High

`GET /api/reports/compensation` (`submissions.ts:410-446`) correctly imports `recognizeRevenue`,
sources platform fees from the file's **issued** Loan Estimate, and reports a two-channel revenue
figure. `getAdminStats` (`server/storage/stats.ts:89-134`) — the panel behind the admin
dashboard's financial numbers — does neither.

Its `select` at `stats.ts:90-101` lists six columns. **`compensationModel` is not among them**,
and `recognizeRevenue` is never called anywhere in the file.

**Executed evidence** — the admin dashboard's exact row shape vs. the correct one:

```
admin dashboard : expected=8000 received=0 variance=-8000 shortPaid=1
correct         : expected=0    received=0 variance=0     shortPaid=0
```

Two consequences, both in the permissive-looking direction:

1. **The phantom short-pay of `F-0814-01`, at portfolio scale.** `expectedCompensation` on the
   dashboard sums borrower-paid compensation as though a lender owed it, so
   `compensationVariance` reports the whole borrower-paid book as money owed to the company.
2. **Revenue is still single-channel here.** The ~$2,000/file platform-fee channel — the finding
   three separate audits raised (`F-0808-03`, `F-0809-02`, `F-0811-03`) and 08-12 fixed — is
   absent from the dashboard entirely. `summarizeCompensation`'s output has no `platformFees`
   key and no recognition trigger; that is what `stats.ts` returns.

So the fix exists, is tested, and does not reach the screen the company looks at. On a
borrower-paid file the dashboard still shows the pre-fix picture: $0 revenue against real cost.

**Structural fix.** `getAdminStats` should consume the same recognition path as the reports route
rather than a second, thinner derivation of revenue. The durable version is one function that
returns the recognized figure and two callers, not two roll-ups that agree only when someone
remembers to change both.

---

## `F-0814-03` — over-payment is recognized as revenue and carried as no liability

**Area:** balance sheet · **Severity:** Medium
*(Confirmed and extended from `F-0810-05`, previously ranked 4 and unverified at HEAD.)*

`evaluateCompensationVariance` classifies an over-payment and says exactly what it is
(`compensationLedger.ts:144-147`):

> `Over-paid by $4000.00 ... Confirm before recognizing it; lenders claw back overpayments.`

Then every figure downstream recognizes it in full.

**Executed evidence** — a lender wires $12,000 against an $8,000 comp plan:

```
variance                     -> over_paid   (warns: lenders claw back overpayments)
roll-up receivedCompensation = 12000   (expected 8000)
recognizeRevenue             -> lenderCompensation=12000  total=12500  recognized=true
summary count keys           : inFlightCount, fundedCount, deadCount,
                               shortPaidCount, awaitingRemittanceCount
```

Three distinct gaps, and the third is the one that hides the other two:

- `summarizeCompensation` (`compensationLedger.ts:279`) adds the full received amount to
  `receivedCompensation`. The $4,000 the lender can reclaim is revenue.
- `recognizeRevenue` (`revenueRecognition.ts:170`) does the same. **This module was written on
  08-12, after `F-0810-05` was raised**, and inherited the behaviour.
- There is **no `overPaidCount`**. `shortPaidCount` exists; its mirror does not. `over_paid` appears
  in `contingentLiabilities.ts` nowhere at all (grep: 4 hits repo-wide, none in the register).

This is standing signal #2 in its purest form — the measurement fails in the same direction as
the defect. An over-payment is a payable to the lender dressed as income, and the only place it
surfaces is a per-row badge on a screen.

**Structural fix.** Recognize `min(received, expected)` as revenue and book the excess as an
exposure category in `contingentLiabilityRegister.ts`, alongside the EPO clawback it resembles.
Add `overPaidCount` so the roll-up can be reconciled against the register. This is conservative in
the permitted direction (R8): it removes revenue and adds a liability.

---

## `F-0814-04` — the remittance lag is a fabricated zero

**Area:** capital flow & liquidity · **Severity:** Medium

`shared/cycleTimeReport.ts` goes to real trouble to avoid reporting a working-capital cycle it
has not measured. Its own note, at line 210:

> "No remittance has been timed yet, so days-to-cash is unknown rather than equal to the funding
> cycle — the lender's wire lag is not zero, it is unmeasured."

The only writer of `compensationReceivedAt` defeats that guard. `server/services/lenderSubmission.ts:356-366`:

```ts
const fundedAt = funding.fundedAt ?? new Date();
fundingUpdate = {
  fundedAt,
  compensationReceivedAt: fundedAt,   // <-- the same instant
  ...
};
```

The lag filter accepts `receivedAt >= fundedAt`, so an identical timestamp is not rejected as
corrupt — it is recorded as a same-day wire.

**Executed evidence** — `computeCycleTimeReport` over a 30-day funding cycle, three input shapes:

| input | `remittanceLag.medianDays` | `daysToCash.medianDays` | guard note fires? |
|---|---|---|---|
| **as written by `lenderSubmission.ts:365`** | **0** (measured=2) | **30** | **NO** |
| realistic (lender wires 12–14 days later) | 13 | 43 | no |
| column left NULL (the honest unmeasured case) | null | null | **YES** |

The honest case degrades loudly, exactly as designed. The case the code actually produces reports
a precise, confident, wrong zero — and because it counts as *measured*, the protective note never
fires and nothing on the screen indicates the number is fictional.

**Why it matters.** For an asset-light broker with no warehouse line, the remittance float **is**
the working-capital requirement: the company pays its vendor costs on every file and carries each
funded loan until the lender wires compensation. Wholesale remittance typically runs two to four
weeks after funding. Reporting that as zero says the business needs no working capital between
closing and cash, which is the one liquidity question the broker channel actually has.

**Quantification:** the understatement is the entire remittance float — roughly one remittance
cycle of funded compensation. At 20 files/month and $8,000 average compensation, a 14-day lag is
on the order of **$75k–$110k of working capital reported as $0**. The figure is directional; the
zero is not.

**Structural fix.** Stop writing `compensationReceivedAt` at funding. It is the remittance-advice
timestamp — the recognition trigger named by the owner on 08-12 — and the status machine that
marks a loan funded does not know it. Leave it NULL until the remittance is recorded, which is the
state `cycleTimeReport.ts` already handles correctly and loudly. Note that this interacts with
recognition: today `recognizeRevenue` gates on `compensationReceivedAt`, so making it honest means
funding alone no longer recognizes revenue — which is the conservative direction, and is what
"recognize on receipt" was decided to mean.

---

## Re-verified sound

- **F-16 — asset-light structure.** Direct re-verification at HEAD: no payment rail (Stripe,
  Dwolla, ACH, transfers), no warehouse line or funding facility, no escrow/trust/custodial
  account, no loans held for sale in `server/` or `shared/`. Every grep hit was a false positive
  (`stripEncryptedFields`, sample bank-statement text, an SEO description of HELOC rates).
  **No borrower or investor funds pass through the platform**, so there is no fund-flow
  decoupling, no operational-account separation requirement, and no funding-delay risk borne by
  the company. `shared/businessChannel.ts` states this deliberately.
- **The clawback register** correctly keys off `compensationReceivedAmount`, so a borrower-paid
  file (where the lender remitted nothing) creates no phantom EPO exposure. Checked because
  `F-0814-01`/`02` made it a plausible fourth victim of the same root; it is not.
- **No prior finding regressed.** The 08-12 remediation holds at HEAD.

## Unchanged and owner-blocked

`F-9` (Illinois transfer-tax values), `F-14` (broker vs. mini-correspondent — the decision that
would make duration mismatch real), `F-17` (comp plan vs. the QM cap), `F-0812-05` (minimum net
worth and surety bond, needing the Illinois RMLA statute), `F-0812-06` (Reg Z readings shipped
ahead of verification — every authoritative host is blocked from this environment).

## The pattern, stated once

All four findings are one shape: **a money rule was corrected in the place the audit was looking,
and its siblings kept the old behaviour.** `evaluateCompensationVariance` — 1 of 3 call sites.
`recognizeRevenue` — 1 of 2 revenue surfaces. Over-payment — classified in one module, recognized
in two others, registered in none. The remittance trigger — guarded in the reader, fabricated by
the writer.

The ledger already names this as standing signal #1, written on 08-12. It recurred within two
days, which suggests the signal needs to be an action rather than a note: **when a money predicate
gains a parameter, the same change must enumerate its call sites** — and an optional parameter on
a financial rule is a defect waiting for the next caller.
