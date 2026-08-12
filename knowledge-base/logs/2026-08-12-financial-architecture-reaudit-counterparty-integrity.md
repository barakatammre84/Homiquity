# Financial Architecture Re-Audit — Counterparty Integrity — 2026-08-12

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md)
— capital flow, risk/liability, unit economics, balance sheet — re-run against HEAD one week
later.

**Method:** verify the prior gates still hold at HEAD, then audit the money paths that changed
since. Every finding below was confirmed by **executing the repository's own functions**, not by
reading the docs. Where code and doc disagree, the code wins.

**Bottom line.** The 2026-08-04 and 2026-08-05 remediation **holds** — 2,782 tests green (up from
2,106), the delivery-stack freeze sits exactly at baseline, the QM gates are intact, and the
asset-light structure is unchanged and still correct. **No prior finding regressed.**

But the week's largest refactor — **#417, "make the database the single source of truth for
lenders"** — moved the counterparty from a hardcoded array into a table, and introduced two new
columns (`approvalStatus`, `isDemo`) that are the gate on transmitting borrower PII and on all
revenue. That refactor was done carefully: the migration is fail-closed, and
`evaluateLenderSubmissionEligibility` is a clean, pure, well-tested rule.

**The defect is that only one of the four money paths that depend on that rule was taught it.**
`evaluateLenderSubmissionEligibility` has exactly **one** consumer in the repository
(`server/services/lenderSubmission.ts:152`, verified by grep across `server/`, `client/`,
`shared/`). Rate locks, the revenue ledger, and the clawback register each re-derive counterparty
truth themselves, and each gets it wrong in the permissive direction.

That is this audit's finding, in four parts.

---

## Severity-ordered summary

| # | Finding | Area | Severity |
|---|---|---|---|
| F-20 | "Confirmed" is a presence test over four columns, not a counterparty test — a lock against a fictional lender is classified as a real lender obligation, and the liability register therefore prices it at $0 | Capital flow / Balance sheet | **High** |
| F-21 | The revenue ledger is simulation-blind, while the cost ledger beside it is simulation-aware — gross margin subtracts de-simulated cost from contaminated revenue | Unit economics | **High** |
| F-22 | The control that authorizes PII transmission and unblocks all revenue has the weakest audit trail of the three admin money surfaces | Risk / Liability | **Medium-High** |
| F-23 | `epoClawbackDays` has no write surface, so the clawback reserve rests on an assumed window permanently, by construction | Balance sheet | Medium |
| — | F-1…F-13, F-17, F-18, F-19 remediation holds at HEAD | all | ✅ verified |
| — | F-9 fee values · F-14 channel decision · minimum net worth | — | ⚠️ still open, unchanged |

---

## 1. Capital Flow & Liquidity

### F-20 — A lock against a fictional counterparty is classified as a real lender obligation (High)

**The architectural problem.** F-3 established the right invariant: *no lock without a lender
commitment.* The implementation of "commitment", though, is
`isLenderConfirmed()` (`shared/rateLockConfirmation.ts:47-54`) — a **presence test over four
columns**: `lenderId`, `lockConfirmationNumber`, `confirmedRate`, `confirmedExpiresAt` all
non-empty.

It asks whether the fields are *filled in*. It never asks whether the lender behind them is a real,
approved counterparty. Note that the module's own `LenderLockConfirmation` interface declares
`simulated: boolean` — and `isLenderConfirmed()` does not read it.

Three things follow, and they compound:

**(a) The lock route never blocks a demo lender.** `POST /api/rate-locks`
(`server/routes/borrower/rateLocks.ts:62-69`) rejects only an *unknown* `lenderId`. The three
seeded demo lenders — Summit, BlueRiver, Atlas (`server/seedMarketPricing.ts:60,88,111`,
`isDemo: true`) — are known rows, and they are the **only** lenders in the system carrying comp
plans, so they are the natural ones for staff to select. `evaluateLenderSubmissionEligibility`
blocks them in *every* environment with *"Files can never be submitted to it"*. The lock path
never calls it.

**(b) The `simulated` flag is computed by a hand-rolled check that drops half the rule.**
`rateLocks.ts:128` reads:

```ts
simulated: lender.approvalStatus !== "approved",
```

The shared rule is `isApprovedLender()` = `approvalStatus === "approved" && !isDemo`
(`shared/wholesaleLenders.ts:68`). Executed against a demo row marked approved:

```
isApprovedLender()            : false
submission allowed?           : false | "…is a seeded demo counterparty, not a real company."
rateLocks.ts:128 -> simulated : false      ← recorded as a REAL lender commitment
```

The invariant is already pinned at the rule layer — `tests/counterpartyAndCompensation.test.ts:81`
asserts a demo+approved row is disqualified. The rate-lock route simply does not use the rule it
is pinned on.

**(c) The liability register therefore prices the exposure at $0.** This is the part that matters
most. `server/services/contingentLiabilityRegister.ts:95` splits locks with the same
`isLenderConfirmed()` presence test, on the stated reasoning that *"a confirmed lock is the
lender's obligation; an unconfirmed row is ours."* A lock carrying a staff-typed confirmation
number against a company that does not exist passes the test, is booked as the lender's
obligation, and contributes **nothing** to the `lock_honor` exposure line.

So the register that exists to size lock-honor risk reports zero for precisely the locks that are
fully exposed. **The measurement instrument fails in the same direction as the defect.**

**Quantified.** Honor exposure is sized at `ASSUMED_RATE_SHOCK_POINTS = 2` points of price
(`shared/contingentLiabilities.ts:116`) — roughly a 50 bps adverse move. On a $400,000 loan that is
**$8,000 per file**, and it is understated as $0. Across a 40-file pipeline it is the six-figure
event the original F-3 finding named, with the register now actively reporting its absence. The
borrower-facing consequence is the same one F-3 was raised to stop: the platform says *"rate lock"*
(`rateLockNoun()` returns the confident noun for any row passing the presence test) about a rate
nobody is obliged to honor.

**Structural fix.** Make counterparty truth a property of the confirmation, not of the caller:

1. `isLenderConfirmed()` must take the lender row and require `isApprovedLender(lender)` — a
   confirmation from an unapproved or demo counterparty is **not** a confirmation. This single edit
   fixes the noun, the register, and the borrower copy at once, because they all already route
   through this one module.
2. Replace `rateLocks.ts:128`'s inline expression with `!isApprovedLender(lender)`.
3. Gate `POST /api/rate-locks` on `evaluateLenderSubmissionEligibility` the way
   `submitToWholesaleLender` is, so the two borrower-facing commitment surfaces share one rule.

The general principle: **`evaluateLenderSubmissionEligibility` should be the only way any surface
learns whether a lender may be transacted with.** One consumer today is the defect.

### Money movement — unchanged and still correct ✅

Verified again: no payment processor, no ACH rail, no trust/operating account separation, no
escrow handling anywhere in `server/` or `shared/`. For a broker this remains right — compensation
is wired by the lender at funding into an operating account outside the system, so there is no
fund-flow decoupling to manage and no cash-drag. Nobody bears funding-delay risk here because the
platform never holds funds. F-16 stands.

---

## 2. Risk & Liability

### F-22 — The highest-consequence control has the weakest audit trail (Medium-High)

**The architectural problem.** `approvalStatus` is, by the codebase's own description, the gate on
"transmitting a borrower's file to a third party" and the binding constraint on all revenue. It is
writable through `PATCH /api/wholesale-lenders/:id`
(`server/routes/rate-sheets.ts:63-77`), validated by
`insertWholesaleLenderSchema.partial()` — and `insertWholesaleLenderSchema` is
`createInsertSchema(wholesaleLenders).omit({ id, createdAt, updatedAt })`
(`shared/schema/lendingWholesale.ts:106-110`), so **every** business column is accepted, including
`approvalStatus` and `isDemo`.

The endpoint is `requireRole("admin")` gated and audited — but the audit entry records only field
**names**:

```ts
await logAudit(req, "WHOLESALE_LENDER_UPDATED", "wholesale_lender", routeParam(req, "id"), {
  updatedFields: Object.keys(data),
});
```

Compare the two sibling money surfaces added the same week:

| Surface | Trail |
|---|---|
| Platform fee schedule publish | Append-only, **versioned**, **reason required**, values audited |
| Wholesale comp bands (`admin/pricingPolicy.ts:235`) | `previous` and `next` values audited |
| **Lender approval / demo status** | **Field names only. No values, no reason, no evidence.** |

So the question *"who approved this counterparty, when, and on the strength of what executed
agreement?"* is unanswerable beyond "somebody wrote to `approvalStatus` at time T". The two
surfaces that move **numbers** are better controlled than the one that moves **authorization**.

**The `isDemo` half is the sharper edge.** The comment at `shared/wholesaleLenders.ts:106-110`
states demo rows "must never receive a borrower file, regardless of status or approvalStatus" and
that the check "deliberately precedes the approval check so that no combination of column values
can open the path." That guarantee is true at the *rule* layer and false at the *data* layer: one
PATCH clearing `isDemo` converts a fictional seeded company into a submittable counterparty, and
nothing records that it happened.

**Quantified.** The failure is not financial-per-file; it is that the company cannot evidence its
own counterparty authorization. In a state exam or a PII-transmission incident, the control record
is the deliverable, and here it is a field name. It also silently disarms F-20(b) and F-23.

**Structural fix.** Counterparty approval is not a field edit; it is a **business event**. Give it
its own endpoint — `POST /api/wholesale-lenders/:id/approval` — that:

- takes the new status, a **required reason**, and a reference to the executed broker agreement;
- requires `epoClawbackDays` when moving to `approved` (F-23);
- refuses `approved` on any row with `isDemo = true`, rather than letting the two be set together;
- audits previous → next **values**, matching the fee-schedule surface next door.

Then **omit `approvalStatus` and `isDemo` from the generic PATCH's schema**, so the only path to
authorization is the audited one. `.omit()` on the insert schema is the whole change.

---

## 3. Unit Economics & Margin Leakage

### F-21 — The revenue ledger is simulation-blind; the cost ledger beside it is not (High)

**The architectural problem.** `lender_submissions.simulated` (`shared/schema/delivery.ts:132`)
is `notNull().default(true)` — every row is a simulation unless proven otherwise — and it is
written correctly by the F-5 gate.

**No financial computation reads it.** Verified by grep: the string `simulated` does not appear
anywhere in `shared/compensationLedger.ts` or `shared/compensationClawback.ts`. Both roll-up
call sites select the funding columns and omit `simulated` entirely
(`server/storage/stats.ts:88-97`; `/api/reports/compensation` via
`storage.getAllLenderSubmissions()`).

Now contrast the cost side. `shared/costLedger.ts` is **thoroughly** simulation-aware: `simulated`
is a first-class input (line 32), `simulatedCost` is segregated (line 52), real spend excludes it
(line 95), and `computeUnitEconomics` emits an explicit note when simulated spend exists (line
150). PR #351 went further and fixed exactly this leak on the disclosure path — *"a $5 simulated
credit-pull ledger row could replace a real disclosed zero-tolerance fee on the LE"*.

**So the team already recognizes this defect class and has fixed it once — on the cost side only.**

The consequence is arithmetic:

```
gross margin = (revenue that may include simulated funding)
             − (cost carefully stripped of simulated spend)
```

Every figure on the admin `FinancialReports` surface inherits it: `fundedCount`, `fundedVolume`,
expected vs. received compensation, the short-pay variance list, **pull-through**, margin per
funded loan — and `clawbackExposure.totalAtRisk`, which the contingent-liability register presents
as a **reserve figure**.

**Quantified.** There are currently **zero approved lenders**, and the column defaults to `true`,
so **100% of the revenue ledger's contents today are simulated** and the dashboard presents them
with no discriminator. PR #426 ("staff can advance a lender submission") makes reaching `funded` a
staff action, and `updateSubmissionStatus` requires `fundedLoanAmount` and
`compensationReceivedAmount` to get there — so a gated-beta walkthrough writes a fully-formed
revenue record. At the seeded 200 bps on a $400k file that is **$8,000 of phantom revenue and
$8,000 of phantom clawback reserve** per walkthrough run, indistinguishable from the real thing.

This is the precise error the 2026-08-04 audit named in its opening: presenting a number that is
not revenue as revenue. F-6 fixed it for *pipeline volume* and left the *simulation* axis open.

**Structural fix.** Mirror `costLedger.ts` exactly — the pattern is already written and tested:

1. Add `simulated` to `CompensationSubmission` and to the clawback register's input, and pass the
   column through at both call sites.
2. Segregate rather than silently drop: report `simulatedFundedCount` / `simulatedCompensation`
   beside the real figures, and exclude simulated rows from `receivedCompensation`,
   `pullThrough`, and `totalAtRisk`.
3. Emit the same style of note `computeUnitEconomics` already emits, so a reader cannot see the
   margin without seeing what was excluded.
4. Pin it with the invariant test the cost side has: **no simulated row may contribute to a real
   financial total.**

---

## 4. Balance Sheet Integrity

### F-23 — The clawback window has no write surface, so the reserve rests on an assumption permanently (Medium)

**The architectural problem.** `epoClawbackDays` is modeled correctly and deliberately: NULL means
*no agreement exists yet*, never *no clawback*, and `clawbackWindowFor()` resolves NULL to
`DEFAULT_EPO_CLAWBACK_DAYS = 180` while flagging `source: "assumed"`
(`shared/compensationClawback.ts:62-66`). The register raises `usesAssumedWindow` so no reserve
figure silently rests on a guess. That design is right.

**But nothing can ever write the column.** Verified: the only occurrences in `server/` are the
seed (`seedWholesaleLenders.ts:56`, writing `null`) and two reads. No route, no admin surface, no
storage method sets it. Executed:

```
clawbackWindowFor(no agreement) : {"days":180,"source":"assumed"}
```

So the moment a broker agreement is actually executed — the moment the contracted EPO term becomes
a known fact — there is **no supported way to record it** short of a direct DB write. The register
is architecturally pinned to `usesAssumedWindow: true` forever.

**Quantified.** The assumption is load-bearing on the reserve. Wholesale EPO clauses commonly run
180 days, but 12-month terms are ordinary. At 10 files/month and $8,000–$11,000 of comp per file:

| Contracted window | Rolling clawback-exposed revenue |
|---|---|
| 180 days (the assumption) | ~$480k – $660k |
| 365 days (a common term) | ~$973k – $1.34M |

A **~2× understatement** of the single largest contingent liability on an asset-light balance
sheet, and — per the contingent-liability register's own convergence argument — a direct
overstatement of how much net worth survives to satisfy the licensing minimum.

**Structural fix.** Fold it into F-22's approval endpoint. Approving a lender and recording its
EPO term are the same business event (both are facts established by the executed agreement), so
require `epoClawbackDays` on the transition to `approved`. That makes the register's
`usesAssumedWindow` flag mean what it was designed to mean — *we have no agreement yet* — instead
of *we have no way to tell you*.

### Reserve adequacy — still blocked, and now precisely characterized

The minimum-net-worth line has blocked reserve adequacy through all three audits. This pass
checked whether the local corpus can close it. **It cannot, and the reason is now citable.**

The NMLS Policy Guidebook (2026-03-31 edition) Chapter VII, "Financial Statement & Net Worth
Filing," is **filing mechanics only**. It states plainly (p. 120) that companies *"should consult
the financial statement and net worth requirements for each license"* and (p. 122) that a licensee
must *"meet the net worth requirement that satisfies the highest, or most stringent, standard among
all NMLS states in which they are licensed."* The amount is set by state law, which the
[`docs/nmls/README.md`](../../docs/nmls/README.md) hierarchy says controls. So the register's
"unverified" status is **correct and not closable from this repository** — it needs the Illinois
RMLA statute.

One structural consequence worth recording, which the register does not currently capture: because
the requirement is the **most stringent state in the footprint**, multi-state expansion moves the
net-worth floor **discontinuously**. Adding one state with a high minimum re-prices the reserve for
the whole company. Expansion is not linear in capital, and the licensing-cost line of any expansion
plan should be a max() across the target footprint, not a sum.

### Asset-light structure — still correct ✅

No warehouse line, no loans held for sale, no servicing asset, no TBA position, no money movement.
`BUSINESS_CHANNEL` still reads `"broker"` and the delivery-stack freeze guard reports **1,482 lines
across 4 files (baseline 1,482) — frozen, no growth**, so the channel decision is not being made by
accretion while it sits open. F-16 stands; F-14 remains the one thing that would invalidate it.

---

## Verified — prior remediation holds at HEAD

Re-checked directly, not taken from the logs:

- **2,782 tests green** — 2,367 server (173 files) + 415 client (60 files), 0 failing. Up from
  2,106 at the 2026-08-05 audit.
- **F-5 (counterparty gate) holds** and was strengthened by #417: migration 0051 defaults
  `approval_status` to `target`, so every pre-existing row is fail-closed, and `isDemo` hard-blocks
  ahead of the approval check.
- **F-3's confirmation requirement holds** at the route — all four confirmation fields are still
  required, unknown lenders and expired confirmations still rejected. (F-20 is about what
  "confirmed" *means*, not about the requirement being dropped.)
- **F-17/F-18/F-19 (QM fit, election-time gate, finance-charge symmetry) hold** — the fee schedule
  still trims to fit, and the election still refuses `over_cap`.
- **F-14 freeze guard** passes at exactly baseline.

**Still open, unchanged and correctly so:** F-9 fee values (needs a human with the Illinois
statute), F-14 channel decision (founder-owned), minimum net worth / surety bond (needs the state
statute, per the citation above).

---

## Recommended sequence

1. **F-20 first** — it is the only finding that reaches a borrower. Fixing `isLenderConfirmed()`
   to require an approved counterparty repairs the noun, the register, and the borrower copy in one
   edit, because all three already route through that module. **Blocks the first real lock.**
2. **F-22 with it** — the approval endpoint is what makes F-20's fix meaningful and F-23's fix
   possible, and it removes `isDemo` from the generic PATCH. **Do before any lender is approved**,
   which per §1.3 of the roadmap is imminent.
3. **F-23 folds into F-22** — one required field on the approval transition.
4. **F-21** — mirror `costLedger.ts`. Self-contained, no migration, and the pattern is already
   written and tested one file over. **Do before the first funded loan**, after which the ledger
   contains a mix nobody can separate retroactively.

**Not found wanting:** the asset-light structure, the absence of money movement, the purity and
test coverage of the counterparty rules themselves, the fail-closed migration in #417, the
cost-ledger simulation discipline (which is the model the revenue side should copy), and the
honesty of the contingent-liability register — which flags its own assumptions loudly enough that
F-23 was findable at all.

---

## Scope note

This is an audit, as requested: findings, quantification, and structural fixes. **No remediation
was applied.** All four findings change behavior on money or PII paths — refusing locks, refusing
submissions, restructuring an authorization endpoint, and altering the figures on the admin
financial dashboard — and the first three would take effect in production. They are specified
precisely enough to implement directly, but the decision to change what the platform refuses
belongs to a human.

---

## Provenance

Re-audit run 2026-08-12 against HEAD `2444950`. Findings F-20 and F-23 were confirmed by executing
`isApprovedLender`, `evaluateLenderSubmissionEligibility` and `clawbackWindowFor` against a
seeded-demo lender row; F-21 and F-22 by direct inspection of the roll-up call sites, the Zod
schema derivation, and the audit-log payloads, each cross-checked by grep across `server/`,
`shared/` and `client/`. The NMLS citations were read from the local guidebook PDF (pp. 120–125),
not from memory, per the CLAUDE.md rule.

Regulatory readings are flagged rather than asserted throughout. No new compliance interpretation
is made by this document.
