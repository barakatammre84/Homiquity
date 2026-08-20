# Financial Architecture Re-Audit — The Receivable That Cannot Exist — 2026-08-13

**Freshness:** written 2026-08-13 · owner: `/financial-audit` routine · review interval: 30 days

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
— capital flow & liquidity, risk & liability, unit economics, balance sheet — re-run against HEAD
(`1f520b1`) one day after the 08-12 pass.

**Method.** The diff-driven pass came back **empty**: nothing under `shared/` or `server/` changed
between the last financial tick (`4cadbc9`) and HEAD — the intervening merges (#504, #508, #510,
#516) were client and knowledge-base only. So this pass ran the other two methods from the skill:
*ask who else reads the rule*, and *check the measurement, not only the mechanism*. Every finding
below was confirmed by **executing the repository's own functions** against rows shaped exactly as
the write path produces them, not by reading. 2,714 tests green at HEAD (191 files); no prior
finding regressed.

---

## Severity-ordered summary

| id | finding | area | severity |
|---|---|---|---|
| `F-0813-01` | Funding and remittance are one atomic event, so the broker's only receivable has no state — and the 08-12 revenue-recognition trigger was built on top of the timestamp that defect pins to zero | Capital flow / Balance sheet | **High** |
| `F-0813-02` | Three of the 21 findings in the 2026-08-12 triage were silently dropped — including, twice, the defect above | Governance / routine memory | **Medium** |
| `F-0813-03` | Counterparty concentration is *counted*, never *measured*: no surface computes exposure per lender, and the liability register has no concentration entry | Risk / Liability | Low |
| — | F-1…F-19, `F-0812-01`…`F-0812-04` remediation holds at HEAD | all | ✅ verified |
| — | F-9 · F-14 · F-17 · `F-0812-05`…`F-0812-08` · ranks 4–6 | — | ⚠️ open, unchanged |

---

## 1. Capital Flow & Liquidity

### `F-0813-01` — The receivable cannot exist, and revenue recognition was built on top of that (High)

**The architectural problem.** A broker is paid by wire *after* a loan funds — commonly 1–15 days
later, on the lender's remittance cycle. That gap is the company's entire liquidity risk: it is the
one interval where money has gone out (vendor spend, at application) and not yet come back. The
status machine does not model the gap. It **refuses** the `funded` transition unless the remittance
figure is supplied in the same call, then stamps the receipt with the funding date:

```ts
// server/services/lenderSubmission.ts:356-367  — the ONLY writer of compensationReceivedAt
const fundedAt = funding.fundedAt ?? new Date();
fundingUpdate = {
  fundedLoanAmount: funding.fundedLoanAmount.toFixed(2),
  fundedAt,
  compensationReceivedAmount: funding.compensationReceivedAmount.toFixed(2),
  compensationReceivedAt: fundedAt,          // <-- the same instant, always
  compensationRecordedBy: performedBy,
};
```

The requirement is enforced one layer up (`server/routes/underwriting/submissions.ts:291-306`:
`funding.compensationReceivedAmount` is a required `z.number().min(0)`), and `grep` across
`server/routes/`, `server/storage/` and `server/services/` finds **no other writer** of either
column. So for every file originated through the application, `compensationReceivedAt === fundedAt`
by construction, and `compensationReceivedAmount` is never null.

**This is not a new discovery — it is a rediscovery, twice over.** The 08-07 audit raised it as its
F-21 (`F-0807-02`, **High**) and the 08-11 audit raised it independently as its F-23
(`F-0811-04`, Medium-High). Both landed on `main` in #489. Neither appears anywhere in
`financial-audit/LEDGER.md` — see `F-0813-02`. This pass found it a third time, from the opposite
direction: by auditing what the 08-12 fix *created*.

**What is new since 08-07/08-11, and why the severity went up.** On 2026-08-12 the routine built
`shared/revenueRecognition.ts` and named the recognition trigger:

> RECOGNITION TRIGGER: the lender's remittance advice … `lender_submissions.compensationReceivedAt`
> is that event — it is stamped when staff record what the lender actually paid. **Nothing is
> recognized before it, on either channel.**
> … Recognizing both at the remittance advice is therefore CONSERVATIVE in timing — it never
> recognizes revenue earlier than it was received, only later.

Both sentences are false at HEAD, because the trigger is stamped by the funding transition itself.
Executed (`recognizeRevenue`, real non-simulated funded file, $8,000 comp + $2,000 platform fees):

```
=== recognizeRevenue at the instant of funding ===
recognized : true          <- 'nothing is recognized before the remittance advice'
total      : 10000
unrecognizedPlatformFees : 0
```

The stated conservative direction is **inverted**: revenue is recognized at funding, which is
*earlier* than it is received, not later. The owner's 2026-08-08 policy decision ("recognize on
receipt") is implemented as "recognize on funding" — not through a coding error, but because the
event the policy names has no independent representation to bind to.

**The measurement fails in the same direction as the defect** (standing signal #2). The cash-drag
window is measured by `shared/cycleTimeReport.ts`, whose own docstring states the premise:

> Funding is not the moment cash arrives — the lender wires compensation some days later, and THAT
> lag is the pure cash-drag window.

and which carries an explicit guard against reporting the lag as zero:

> "No remittance has been timed yet, so days-to-cash is unknown rather than equal to the funding
> cycle — the lender's wire lag is not zero, it is unmeasured."

That guard is **unreachable**. It fires only when the timestamp is absent, and the writer guarantees
it is present. Executed against two funded files (24-day origination cycle), rows shaped as the
writer produces them versus a truthful 12-day wire lag:

```
=== AS THE WRITER PRODUCES IT (receivedAt := fundedAt) ===
remittanceLag.measuredCount : 2
remittanceLag.medianDays    : 0
remittanceLag.unmeasured    : 0
daysToCash.medianDays       : 24
guard note present?         : false

=== IF THE REAL WIRE LAG (12d) WERE RECORDED ===
remittanceLag.medianDays    : 12
daysToCash.medianDays       : 36
```

`daysToCash` reports 24 — exactly "equal to the funding cycle", the outcome the module was written
to refuse — and reports it as *measured*, with `unmeasuredFundedCount: 0`, so no consumer can tell
the lag is fiction.

**Quantification.** `daysToCash` is the multiplicand in the capital projection
(`shared/costLedger.ts:268-283`, Little's Law):

```
projectWorkingCapital = filesStartedPerMonth × costPerFile × (daysToCash / 30)
```

The projection is **linear** in `daysToCash`, so the working-capital requirement is understated by
`lag / (cycle + lag)` — **33% at a 12-day lag on a 24-day cycle**, and 38% at 15 days. Illustrative
only, since the platform holds no real cost-per-file (vendor spend is still simulated): at 40
files/month and $900/file, planning would call for $28,800 against a true $43,200 — a **$14,400**
hole in the one figure whose entire purpose is planning headroom. *(Note: `projectWorkingCapital`
currently has **zero callers** — standing signal #4, a capability with no surface. It cannot mislead
anyone today; it will the moment it is wired to a page.)*

**The whole "have we actually been paid?" indicator family is structurally dead.** Each of these was
written to distinguish *unpaid* from *paid*, and each is pinned to the "paid" answer because the
funding transition supplies both operands. Executed on the same row:

```
summarizeCompensation.awaitingRemittanceCount : 0   <- 'revenue we cannot confirm'
clawbackRegister.indeterminateCount           : 0   <- 'exposure unknown, not zero'
```

So: no aged receivable, no short-pay detection window (a lender that never wires is
indistinguishable from one that wired in full, because the amount staff typed *is* the record of
receipt), no cash-conversion truth, and a revenue figure recognized against an event that has not
occurred.

**Who bears the risk during the delay.** The company does, unhedged and unmeasured — which is the
correct answer for a broker and is *not* the finding. The finding is that the platform cannot see
it: the exposure has no state, so it cannot be aged, reserved against, or reported.

**Structural fix (proposed — NOT applied; this is a new finding, R7).** Split the two events, which
the schema already permits (both columns are nullable, `shared/schema/delivery.ts:170-171`):

1. The `funded` transition records `fundedAt` + `fundedLoanAmount` + the *expected* compensation,
   and stops writing `compensationReceivedAt`/`compensationReceivedAmount`.
2. A separate, audited "record remittance" action stamps the receipt columns when the wire actually
   lands — the same shape as the `/admin/lenders` contract-terms path built on 08-12.
3. Funded-with-no-remittance then becomes a real state, which lights up `awaitingRemittanceCount`,
   the clawback `indeterminateCount`, the `remittanceLag` guard, and honest revenue recognition —
   all four already exist and need no new code.

**Owner decision required before this is authorized**, because step 1 *relaxes* a gate: today the
status machine refuses to fund without a compensation figure, and that refusal is what F-6 installed
to stop the platform being unable to state its own revenue. The replacement must keep an equivalent
requirement (expected compensation, not received) so the fix does not reopen F-6. Under R8 this is
the one part of the change that moves in the permissive direction and it must not ship unattended.

---

## 2. Risk & Liability

### `F-0813-03` — Counterparty concentration is counted, never measured (Low)

`approvedLenderCount` (`shared/wholesaleLenders.ts:76`) returns a **cardinality** and is the only
counterparty aggregate in the repository. Nothing computes exposure *per* lender — not locked
volume, not in-flight submission volume, not compensation receivable — and
`shared/contingentLiabilities.ts` has no concentration category among its eight.

Severity is Low **today** and only because the denominator is zero: with no approved counterparty
there is no concentration to measure, which the revenue report already surfaces as the binding
constraint (`submissions.ts:508`). It is recorded now because concentration is the exposure that
becomes material at exactly the moment the business starts working — the first approved lender is
100% concentration by definition, and the register would report nothing.

**Structural fix.** A per-lender roll-up over `lender_submissions` (in-flight volume, funded volume,
compensation outstanding) plus a `counterparty_concentration` entry in the register, `basis:
"computed"`, expressed as a share of the book rather than a dollar amount.

### Verified sound at HEAD (recorded so a regression reads as a change)

- **The four 08-12 fixes hold.** `isLenderConfirmed` still requires `simulated === false`
  (`shared/rateLockConfirmation.ts:75-83`); the register consumes it rather than re-deriving
  (`contingentLiabilityRegister.ts:125`).
- **Rate-lock expiry math is on the lender's date, not the platform's.** Both the create path
  (`rateLocks.ts:124`) and the extend path (`rateLocks.ts:341-342`) set `expiresAt :=
  confirmedExpiresAt`, so the register's 21-day extension-risk window cannot drift from the
  commitment it prices. Checked because `confirmedExpiresAt` is read *only* as a presence test in
  `isLenderConfirmed` — the divergence was plausible and is not there.
- **Simulation segregation is symmetric.** `summarizeCompensation` branches on provenance before any
  accumulator (`compensationLedger.ts:254-266`), so no simulated amount reaches a real figure by any
  path; `recognizeRevenue` mirrors it.

---

## 3. Unit Economics

**No new finding.** The 08-12 two-channel revenue work is wired correctly end to end: the route
passes `revenue.total` — lender compensation *plus* recognized platform fees — into
`computeUnitEconomics` (`submissions.ts:466-474`), and the de-simulation contract holds
(`receivedCompensation` arrives already clean from `summarizeCompensation`; `simulatedRevenue` is
note-only by design, `costLedger.ts:295-301`).

Carried forward unchanged, and still the honest headline: **gross margin is an upper bound**
(`F-0812-08`) — loan-officer compensation, processing labour and overhead allocation are modeled
nowhere, so the only cost lines are direct vendor spend and committed commission payouts. Ranks 4–6
of the 08-12 triage remain open and were re-verified as open at HEAD: over-paid compensation is
still classified in the comp ledger and carried as no liability (`F-0810-05` — confirmed: no
`over_paid` reference in either register file); the QM fee trim is still an unrecorded concession
(`F-0811-02`); the pricing fallback is still silent (`F-0811-07`).

---

## 4. Balance Sheet Integrity

**Asset-liability matching remains structurally correct and is not at issue.** Homiquity holds no
loans (F-16, re-verified `sound`), so there is no duration mismatch and nothing to fund — the
asset-light posture is right, and F-14 (broker vs. mini-correspondent) remains the single decision
that would invalidate it.

What `F-0813-01` costs the balance sheet is the *current-asset* side: compensation earned but not
yet wired is a receivable that the data model cannot represent, so it appears in no aging, no
reserve, and no working-capital figure. Reserve adequacy remains unanswerable for the reason
recorded as `F-0812-05` — minimum net worth and the surety bond require the Illinois statute, and
every authoritative host is blocked from this environment.

---

## `F-0813-02` — Three of the 21 triaged findings were dropped (Medium)

The 2026-08-12 tick-2 triage in `financial-audit/LEDGER.md` states it worked "21 findings across
08-07, 08-09, 08-10 and 08-11" and sorts them into closed (7), ranked-open (6) and escalations (3).
That is **16**, plus `F-0808-03` which belongs to the 08-08 audit, not the 21. Reconciling every
minted id against the triage:

| audit | minted | accounted for in triage | dropped |
|---|---|---|---|
| 08-07 | `-01`…`-04` | `-01` closed, `-03` rank 3, `-04` escalation | **`F-0807-02`** |
| 08-09 | `-01`…`-04` | all four | — |
| 08-10 | `-01`…`-06` | all six | — |
| 08-11 | `-01`…`-07` | `-01` esc., `-02` rank 5, `-03` rank 1, `-05` rank 2, `-07` rank 6 | **`F-0811-04`**, **`F-0811-06`** |

`grep -rn "F-0807-02\|F-0811-04\|F-0811-06" knowledge-base/` returns **nothing**. Three findings —
one rated High, one Medium-High, one Medium — were minted, landed on `main`, and are tracked in no
register. Two of them (`F-0807-02`, `F-0811-04`) are the same defect this pass rediscovered from
scratch, at the cost of a full audit tick.

`F-0811-06` (the cost ledger has no payer or recovery dimension — pass-throughs indistinguishable
from absorbed spend) is untriaged and unverified; it is carried into the ledger at `open` for a
future tick to verify against HEAD rather than assumed.

**Why it happened.** The triage was written from the four logs' *severity tables*, and the mapping
from each log's local `F-2x` numbering to the date-qualified scheme was done by hand in the same
sitting the scheme was invented. A hand mapping of 21 ids across four documents with a collided
namespace has no checksum, so a dropped row is invisible.

**Structural fix.** The ledger should carry a completeness assertion: every minted `F-<MMDD>-<NN>`
must appear exactly once in some status table, and the reconciliation above should be a table in the
ledger rather than an exercise repeated per tick. Cheap and mechanical — the audit logs enumerate
their own findings in a severity table, so the id set is derivable.

---

## Bottom line

The remediation from nine prior audits holds; nothing regressed; 2,714 tests green. The
asset-light structure is still correct and still the right answer.

The one material gap is that **the business has no representation of being owed money.** Funding and
payment are recorded as a single atomic event, so the broker's only receivable has no state, its
aging cannot exist, the cash-conversion cycle reports the wire lag as a measured zero, and — new
since 08-12 — the revenue-recognition trigger the owner chose is bound to a timestamp that is
written before the event it names. Three audits have now found this. Two of those three findings
were dropped in triage, which is the second finding.
