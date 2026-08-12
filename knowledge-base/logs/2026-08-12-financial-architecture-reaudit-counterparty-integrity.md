# Financial Architecture Re-Audit — Counterparty Integrity — 2026-08-12

> **⚠️ ID SUPERSESSION (2026-08-12).** The `F-20`…`F-23` used throughout this document are
> **date-qualified** as of the same day, because six of the nine financial audits run between
> 08-04 and 08-12 independently minted ids starting at `F-20`:
>
> | in this document | canonical id |
> |---|---|
> | F-20 | `F-0812-01` |
> | F-21 | `F-0812-02` |
> | F-22 | `F-0812-03` |
> | F-23 | `F-0812-04` |
>
> The body is left as written (TEAM_PRACTICES §2 — a log is history, never rewritten in place).
> **Cite the canonical ids.** Note also that the 08-10 audit — stranded unmerged on
> PR [#489](https://github.com/barakatammre84/Homiquity/pull/489) until 08-12 — had already found
> four of these findings two days earlier; this pass fixed them, but the analysis was duplicated.
> Full chain and scheme: [financial-audit/LEDGER.md](../financial-audit/LEDGER.md).

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
| F-20 | "Confirmed" is a presence test over four columns, not a counterparty test — a lock against a fictional lender is classified as a real lender obligation, and the liability register therefore prices it at $0 | Capital flow / Balance sheet | **High** — ✅ fixed |
| F-21 | The revenue ledger is simulation-blind, while the cost ledger beside it is simulation-aware — gross margin subtracts de-simulated cost from contaminated revenue | Unit economics | **High** — ✅ fixed |
| F-22 | The control that authorizes PII transmission and unblocks all revenue has the weakest audit trail of the three admin money surfaces | Risk / Liability | **Medium-High** — ✅ fixed |
| F-23 | `epoClawbackDays` has no write surface, so the clawback reserve rests on an assumed window permanently, by construction | Balance sheet | Medium — ✅ fixed |
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

This began as an audit: findings, quantification, and structural fixes, with no remediation
applied, because all four change behavior on money or PII paths and the decision to change what
the platform refuses belongs to a human.

**All four findings were subsequently authorized and are now fixed** — see the remediation
sections below. The F-23 work also closed the gap that made the others hard to operate: there was
no user interface for onboarding a real counterparty at all, so every fix above was reachable only
by hand.

---

## Remediation — F-20 (2026-08-12)

**Confirmation is now a counterparty test.**

The fix went into `isLenderConfirmed()` rather than into its callers, because the register, the
borrower-facing noun, the activity-log copy and the extend-guard all already route through that
one function. Repairing the definition repaired all four at once — which is the same argument that
put the QM basis in `loanCosts.ts` under F-18.

### What shipped

| Change | File |
|---|---|
| `isLenderConfirmed()` additionally requires `simulated === false` | `shared/rateLockConfirmation.ts` |
| `evaluateLenderLockEligibility()` — the counterparty rule for locks | `shared/wholesaleLenders.ts` |
| Route consumes the shared rule; hand-rolled check deleted | `server/routes/borrower/rateLocks.ts` |
| 8 new tests (4 F-20 confirmation, 4 lock eligibility) | `tests/rateLockConfirmation.test.ts`, `tests/counterpartyAndCompensation.test.ts` |

**The counterparty fact is read from the row, not from a live lender lookup.** `simulated` is
derived at lock time from `isApprovedLender()` and stored. That avoids an N+1 in the register and
— more importantly — is the correct semantics in both directions: a lock taken before an agreement
existed does not retroactively become a real commitment when the agreement is signed, and a lock
taken while the lender was approved stays the lender's obligation if their status later lapses.
A missing `simulated` resolves to unconfirmed; missing evidence is not evidence of a commitment.

**The lock rule is deliberately weaker than the submission rule**, and the asymmetry is the
reasoning, not an oversight. Submission transmits a borrower's file to a third party, so an
unapproved counterparty is refused outright. A lock is an internal record — no PII leaves the
system — and the harm is *misrepresentation*: telling a borrower their rate is committed when
nobody is obliged to honor it. So the lock rule **classifies rather than blocks**: staff may still
record what they have pre-launch, it is simply not a lock. The single refusal is a demo row on a
production file, which should not exist at all once the demo rows are retired at go-live.

Reusing `evaluateLenderSubmissionEligibility` unchanged would have blocked demo lenders in every
environment and broken the gated-beta walkthrough, since the three seeded demo lenders are the only
lenders carrying comp plans.

### What this changes in production

**Every existing lock becomes an indicative quote**, because no lender is approved yet and
`simulated` defaults to `true`. That is not a regression — it is the true position stated out loud,
and it is the same call F-3 made for pre-`0040` rows. Two visible consequences:

- Borrower- and staff-facing copy reads *"indicative quote (not locked)"* rather than *"rate
  lock"*, and `POST /api/rate-locks/:id/extend` refuses these rows with `lock_not_confirmed` —
  correctly, since there is nothing to extend.
- The contingent-liability register's `lock_honor` line **stops reporting $0** and begins carrying
  the real exposure at `ASSUMED_RATE_SHOCK_POINTS` (2 points of price ≈ $8,000 per $400k file).
  The reserve number will go **up**. That is the finding being measured rather than hidden.

No migration: the fix reads the `simulated` column migration `0040` already added.

### Test re-base, and why it is the fix

Two existing assertions in `tests/rateLockConfirmation.test.ts` failed on the first run — the
`CONFIRMED` fixture predates the counterparty requirement and carried no `simulated`. They were
re-based (the fixture now states `simulated: false`, which is *what makes it confirmed*), exactly
as F-12's three boundary tests were re-based when the Reg Z cap tightened. **That shift is the
fix.** Four new tests pin the new invariant, including that the counterparty test is *additional*
to the presence test rather than a replacement for it.

---

## Remediation — F-22 (2026-08-12)

**Approving a counterparty is now a business event with evidence, and the generic write path can
no longer express one.**

### What shipped

| Change | File |
|---|---|
| `writeWholesaleLenderSchema` — omits the authorization columns | `shared/schema/lendingWholesale.ts` |
| `POST /api/wholesale-lenders/:id/approval` — audited, evidence-bearing | `server/routes/rate-sheets.ts` |
| Create and update routes repointed at the restricted schema | `server/routes/rate-sheets.ts` |
| 11 new tests | `tests/lenderApprovalControl.test.ts` (new) |

**The boundary is enforced at the schema, not in the handler.** `LENDER_AUTHORIZATION_COLUMNS`
names `approvalStatus` and `isDemo`, and `writeWholesaleLenderSchema` omits them, so Zod strips
them from any create or update body. A route using that schema *cannot* apply an authorization
change even if someone adds a field later — as opposed to a handler check somebody can forget.
`insertWholesaleLenderSchema` is untouched, so seeds and storage typing are unaffected; the
restriction is on the route surface, not on the table. Creation is likewise restricted: a new
lender lands at the DB defaults (`target` / `false`), so it is fail-closed and cannot be born
approved.

**The approval endpoint records the evidence, not just the fact.** It requires a `reason` in every
direction (de-authorizing matters as much as approving), a `brokerAgreementReference` to assert
`approved`, and it audits `previousApprovalStatus → nextApprovalStatus` as **values** —
matching the fee-schedule publish and comp-band surfaces, which were both better controlled than
the authorization surface before this. It refuses `approved` on a demo row outright
(`cannot_approve_demo_lender`) rather than relying on `isApprovedLender()` filtering it
downstream: a record asserting a broker agreement with a company that does not exist should not
be creatable.

**The F-23 fold-in.** `epoClawbackDays` is required on the transition to `approved`. This is the
one part of F-23 that belongs here rather than in its own change: nothing else in the system can
write that column, and the moment an agreement is executed is the only moment its term is honestly
knowable. The rest of F-23 — that the register still has no way to *correct* a window later —
remains open.

No migration: both columns already exist.

---

## Remediation — F-21 (2026-08-12)

**The revenue ledger now reads the column it was ignoring, and the cost side's discipline is
mirrored rather than re-invented.**

### What shipped

| Change | File |
|---|---|
| `simulated` on `CompensationRecord`; every figure real-only; `simulated` block segregated | `shared/compensationLedger.ts` |
| Simulated fundings excluded from the reserve; `simulatedExcludedCount` reported | `shared/compensationClawback.ts` |
| `simulatedRevenue` note, beside the existing simulated-cost note | `shared/costLedger.ts` |
| Column selected / passed through at all four call sites | `server/storage/stats.ts`, `server/services/contingentLiabilityRegister.ts`, `server/routes/underwriting/submissions.ts` |
| Banner + clawback badge so nothing is excluded silently | `client/src/pages/admin/FinancialReports.tsx` |
| 16 new tests | `tests/counterpartyAndCompensation.test.ts`, `tests/compensationClawback.test.ts`, `client/.../FinancialReports.test.tsx` |

**The branch on provenance happens first**, before any accumulator is touched, so no simulated
amount can reach a real total by any path through the block. **Pull-through was the subtlest
one:** a walkthrough drives files to `funded` on demand, so mixing simulated rows in would have
reported a pull-through describing the demo script rather than the business — it is now computed
over real resolved submissions only, and returns `null` rather than a fake `0%` when nothing real
has resolved.

**Excluded, never dropped.** `summarizeCompensation` reports a `simulated` block, the clawback
register reports `simulatedExcludedCount`, and `computeUnitEconomics` emits a note naming the
excluded dollars — matching what the cost side has always done with `simulatedCost`. A figure that
quietly discards rows is the same defect as one that quietly includes them.

**A missing flag counts as real**, matching `costLedger.ts`'s `if (entry.simulated)`. The column
is `notNull` so this only arises for hand-built objects, but the two ledgers must agree.

### Measured, on today's actual position

Executed against a two-submission book — the state a gated-beta walkthrough produces, with real
vendor cost incurred and no approved lender:

| Figure | Before | After |
|---|---|---|
| Revenue | $16,000 | **$0** |
| Pull-through | 100% | **null** (nothing *real* resolved) |
| Clawback reserve | $16,000 | **$0** (2 excluded) |
| **Gross margin** | **+$15,290** | **−$710** |

The margin line is the finding in one number: real cost was being subtracted from imaginary
revenue, and the true position is that the business has spent $710 and earned nothing yet.

### The client change is load-bearing, not decoration

With zero approved lenders every submission is simulated, so the revenue cards now read `$0` and
pull-through reads `—`. Unexplained, that looks like a broken dashboard, and the tempting "fix" is
to count the simulated rows — which is precisely the defect being closed. The banner states what
was excluded and why, so the zero reads as accurate rather than broken.

### What this does not do

It does not make the revenue figures *complete* — it makes them *real*. The cost side is still
direct vendor spend only (labour and overhead are modeled nowhere), so `grossMargin` remains the
upper bound `computeUnitEconomics` has always declared it to be.

No migration: the fix reads the `simulated` column migration `0042`'s table already carried.

---

## Remediation — F-23, and the counterparty onboarding surface (2026-08-12)

**The clawback window can now be corrected, and there is finally a UI for getting real
counterparty data into the system.**

### F-23 — the correction path

F-22's endpoint captured `epoClawbackDays` at approval, which is the moment it first becomes
knowable. It could not be changed afterwards, so a mis-keyed or renegotiated term would have sat
in the reserve forever.

`PATCH /api/wholesale-lenders/:id/contract-terms` (admin, audited, reason required) is that path.
Three deliberate properties:

- **Separate from approval.** Correcting a term is not an approval decision. Routing it through
  the approval endpoint would either manufacture spurious approval-change audit entries or
  discourage the correction — and a correction nobody makes is the actual failure mode.
- **`null` is a meaningful value, not a missing one.** Clearing the term records *"no agreement
  term is on file"*, returning the register to its flagged platform assumption. That is the honest
  state for a lapsed agreement, and it is why the field is nullable rather than optional.
- **A contracted term requires an agreement.** Recording one against a non-approved lender is
  refused (`no_agreement_for_terms`) — otherwise the register would show a `contracted` window
  with no contract behind it, which is precisely the false precision the
  `assumed`/`contracted` split exists to prevent.

`epoClawbackDays` also moved **off** the generic write path
(`LENDER_CONTRACT_TERM_COLUMNS`), for the same reason the authorization columns did: it is an
input to a balance-sheet figure, so it should not be silently editable as an ordinary attribute.

### The onboarding surface — `/admin/lenders`

**Everything the platform can earn runs through a signed broker agreement, and the columns
recording one had no user interface at all.** `POST`/`PATCH /api/wholesale-lenders` had zero
client callers, and F-22's audited approval endpoint was reachable only by hand. Onboarding a real
lender at go-live meant writing to the database directly — which is exactly how an unaudited
authorization change happens.

The page is built around three rules, none cosmetic:

1. **Approved-lender count is the headline**, not a column. It is the binding constraint on
   revenue (F-5): at zero, production submissions are blocked and no rate lock can be a real
   commitment (F-20). The banner says so, and nudges toward the three-lender best-execution
   target.
2. **Approval is evidence, not a toggle.** The dialog asks for the broker-agreement reference and
   the contracted EPO window because the server requires them, and it explains *why* the EPO term
   is being asked for — it is the largest contingent liability on the balance sheet.
3. **An assumed window never renders as a contracted number.** A lender with no term shows
   *"Not on record — reserve assumes 180 days"*, never `180`.

A demo row cannot be approved and the action is disabled rather than offered-and-refused; a new
lender is created as a `target` with the create form carrying no authorization control at all.

**Also linked `/admin/pricing-policy` in the sidebar.** It shipped with the F-17 work and was
never added to the navigation, so the wholesale comp bands — which are lender data too — were
reachable only by typing the URL.

### A shadowed route found while wiring the page

`GET /api/wholesale-lenders` had **two** handlers: one in `routes/underwriting/submissions.ts`
(broader staff roles, `apiConfig` stripped) and one in `routes/rate-sheets.ts` (admin-only, full
row). `registerUnderwritingRoutes` runs first, so the underwriting one wins and the rate-sheets
copy was dead code.

Harmless today, and a trap in two directions: a fix applied to the dead handler would have had no
effect, and reordering the registrars would have silently swapped in a response carrying
`apiConfig` — integration endpoints and auth shape — now that a browser page consumes this
endpoint. The shadowed handler is removed and a test pins that the path has exactly one
registration.

### What was deliberately NOT built

**Company identity and licensing stay compile-time.** `shared/companyIdentity.ts` holds the NMLS
id, the Illinois license number, and the licensed-state footprint, and it is founder-maintained by
design: `companyNmlsDisplay()` returns null rather than a placeholder, `isCompanyNmlsPending()`
gates the whole pre-license launch, and the file states *"Add a state here ONLY when its license
is issued and verifiable on NMLS Consumer Access — never speculatively."*

Putting that behind an admin form would convert a compliance control reviewed in a pull request
into a text box, on data where an invented value is itself a violation (SAFE Act 12 CFR 1008
unique-identifier requirements). A deploy is the correct friction for a value that changes once a
year and gates market entry. Recorded here so the absence reads as a decision rather than an
oversight.

### Verification

Typecheck clean · **2,834 tests green** (2,406 server / 428 client) · 10 new component tests for
the page, 7 new server tests · zod snapshot re-recorded, and every one of its 8 deltas is the same
single fact (`epoClawbackDays` no longer faults on `writeWholesaleLenderSchema`) — no other schema
and no URLA/compliance payload changed · design-token, KB-index, doc-freshness, schema-migration
and delivery-stack guards all pass. No migration.

---

## Security review — TEAM_PRACTICES §9 (2026-08-12)

The F-22 endpoint adds a `requireRole("admin")` gate, which is a §9 **role/permission gate**
trigger. Structured pass run; recorded here per §9 (and to be carried into the PR body if one is
opened). **One MEDIUM finding, found and fixed within this change; no other findings.**

**MEDIUM — pre-authorization information disclosure on `POST /api/rate-locks` (fixed).** The F-20
eligibility check was initially placed where the lender lookup already sat, which is *before*
`verifyInternalStaffApplicationAccess`. That would have let any internal-staff user — including one
not assigned to the file — probe each wholesale lender's approval and demo status through the 422
response. It also revealed a pre-existing instance of the same defect: the `unknown_lender` 400
already leaked lender-id existence to unassigned staff. **Both are closed**: assignment scoping now
runs before any lender lookup. No borrower PII was reachable either way, which is why this is
MEDIUM and not HIGH.

Also covered:

- **Authorization.** The new approval endpoint is `requireRole("admin")`, matching every sibling
  lender route in the file; pinned by a source guard so it cannot be dropped silently. The
  rate-lock route's existing gates (`isAuthenticated` → `isInternalStaffRole` → assignment scope)
  are unchanged in substance and now strictly earlier.
- **Mass assignment.** This is the change's own subject and it moves in the safe direction: the
  authorization columns are removed from the generic write schema, and the approval handler builds
  its update object explicitly rather than spreading a request body.
- **SQL injection.** Drizzle-parameterized throughout; no raw fragments added.
- **CSRF.** The new route is a normal `POST` under the global protection; the only carve-out
  remains `/api/webhooks/`.
- **Data exposure / logging.** The endpoint returns lender name and status — no PII. The audit
  payload carries a business reason and an agreement reference, neither of which is PII, and the
  route is not on `RESPONSE_BODY_LOG_ALLOWLIST`.
- **Fail-closed behavior.** `toCounterparty()` maps an unrecognized `approvalStatus` to `target`;
  `isLenderConfirmed()` treats a missing counterparty fact as unconfirmed.

Confirmed by inspection that neither trigger the guard cannot see is present: no `shared/schema/`
column holding PII was added, and no new PII sub-processor.

**Second pass — the F-23 endpoint and the admin page (same day).** `PATCH
/api/wholesale-lenders/:id/contract-terms` adds another `requireRole("admin")` gate, so §9 fired
again. **No HIGH or MEDIUM findings.** The handler builds its update object explicitly rather than
spreading a body; the payload holds no PII; the new page is admin-only through the same
`AdminPage` wrapper as its siblings, with every endpoint it calls independently server-gated
(a client route guard is UX, never the control).

One LOW, fixed rather than accepted: surfacing the lender catalog in a browser meant checking what
that endpoint returns. `GET /api/wholesale-lenders` had two registrations, and the shadowed one
returned `apiConfig` — integration endpoints and auth shape — which the live one strips
deliberately. Nothing was exposed, because the stripping route registers first, but the duplicate
made that a matter of registrar ordering rather than of design. Removed, and pinned by a test.

### Verification

Covers F-20 and F-22. F-21 adds no §9 trigger: it changes ledger arithmetic, a report payload and
an admin page, touching no auth, role gate, PII column, upload path or messaging surface. The
report route's existing `requireRole("admin")` is unchanged.

Typecheck clean · **2,817 tests green** (2,399 server / 418 client, +35 across all three
findings) · zod-schema-semantics
snapshot re-recorded and **purely additive** — 20 insertions, 0 deletions, so no existing schema
changed what it accepts or rejects · KB index and doc-freshness guards pass. No migration.

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
