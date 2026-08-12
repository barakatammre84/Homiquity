# Financial Architecture Re-Audit — 2026-08-06

**Scope:** the same four areas as the [2026-08-04 audit](./2026-08-04-financial-architecture-capital-structure-audit.md)
and the [2026-08-05 re-audit](./2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md)
— capital flow, risk/liability, unit economics, balance sheet — re-run against HEAD
(`6731403`) after the 08-05 remediation wave and the #385 pricing-policy change landed.

**Method:** verify the prior fixes still hold, then audit the money-bearing code that is *new
since the last pass*. Every figure below was produced by executing the repository's own
functions (`computeClosingCosts`, `buildDisclosureSnapshot`, `evaluateTolerance`), not
estimated.

**Numbering.** This series (`F-1`…`F-19`) collides with the feature-review register's
`F-001`…`F-048`. New findings here are prefixed **`FA-`** (financial audit) to end the
ambiguity.

---

## Bottom line

The prior two waves hold — **158 tests green** across the ten financial suites, both
capital-flow gates intact, the asset-light broker structure still correct and still the right
answer. Nothing in capital flow, unit economics, or balance sheet integrity has regressed.

The new debt is all in one place: **#385 made the platform fee schedule editable at runtime and
thereby created a financial control plane that did not exist before.** The fee schedule feeds
four *zero-tolerance* Loan Estimate lines. Editing it is therefore not a pricing action — it is
a disclosure action against every file already in flight, and the new surface treats it as a
pricing action.

| # | Finding | Area | Severity |
|---|---|---|---|
| FA-20 | Publishing a fee schedule manufactures TRID cure liability across in-flight files; the publish surface quantifies none of it | Risk / Margin leakage | **High** |
| FA-21 | Any open change-of-circumstance authorizes *every* increase, laundering a platform fee hike into a reset baseline | Risk | **High** |
| — | F-1…F-19 remediation holds at HEAD (158 tests) | all | ✅ verified |
| — | F-9 fee values, F-14 channel decision | — | ⚠️ still open, unchanged |

---

## FA-20 — A fee-schedule publish silently creates cure liability on every in-flight file (High)

### The architectural problem

`server/routes/admin/pricingPolicy.ts` lets an admin publish a new
`applicationFee` / `underwritingFee` / `taxServiceFee` / `originationFeeRate`. All four land in
the **zero-tolerance** bucket — `shared/compliance/feeTolerance.ts:91-100` classifies
`origination_fee`, `application_fee`, `underwriting_fee` and `tax_service` as
`bucket: "zero"`, i.e. cured dollar-for-dollar on any increase (§1026.19(e)(3)(i)).

Every consumer resolves the schedule **late**, at call time — `loanEstimate.ts:425`,
`mismoValidation.ts:723`, `pricing.ts:240,329`, `scenarioSimulator.ts:402` all call
`activeFeeSchedule()`. Nothing pins a version to a file: **`feeScheduleVersion` appears nowhere
in the codebase.** So the instant a schedule is published, every in-flight file's *recomputed*
LE carries the new, higher zero-tolerance lines while its *issued baseline* still carries the
old ones.

Crucially, **a creditor raising its own fees is not a valid changed circumstance.** The catalog
in `shared/compliance/changeOfCircumstance.ts:15-22` is the six §1026.19(e)(3)(iv)(A)–(F)
reasons — extraordinary event, eligibility change, borrower request, rate lock, LE expiration,
construction delay. A platform re-price is none of them. So `reconcileDisclosure`
(`leDisclosureBaseline.ts:262`) correctly routes those files to `blocked_no_coc`: the borrower
keeps the disclosed LE and **the delta becomes a cure the originator owes at closing**.

That behavior is right. The gap is that nothing tells the person clicking Publish.

### Quantified — computed from the repo's own functions

A modest, entirely plausible post-negotiation re-price — underwriting fee $1,500 → $1,800,
origination rate 1.00% → 1.25% — evaluated against the issued baseline:

| Loan amount | Cure per file (lender-paid comp) | Cure per file (borrower-paid comp) |
|---|---|---|
| $200,000 | $60 | **$546** |
| $300,000 | $300 | **$1,050** |
| $400,000 | $300 | **$1,300** |

Every dollar is zero-tolerance, so it is a direct, unrecoverable hit to revenue per loan — and
it lands on files already sold, priced, and disclosed.

**Two structural details make this worse than the table looks:**

1. **The preview is blind to the population where the biggest dial acts.** `previewSchedule()`
   (`pricingPolicy.ts:66-79`) hardcodes `{ model: "lender_paid", bps: 200 }`. Under lender-paid
   comp, `borrowerPaidOriginationAllowed()` forces the origination fee to **zero**
   (`loanCosts.ts:639-640`) — the F-1 dual-compensation fix. So `originationFeeRate`, the one
   dial that *scales with loan size*, shows **no effect at all** in the preview. The admin sees
   the $60–$300 column and none of the $546–$1,300 column.
2. **The exposure is latent, so the register under-reports it.**
   `contingentLiabilityRegister.ts:57-65` sums only disclosures whose **persisted**
   `toleranceEvaluation` already reads `cure_required`. That evaluation is written when a file's
   LE is next reconciled. Until each borrower happens to retrieve their LE, a freshly-created
   cure is invisible to the very register built to measure it. The register will report the
   liability rising for weeks after the decision that caused it, with no link back to the cause.

The F-17 trim mechanism partially absorbs increases (at $200k lender-paid, a $300 nominal rise
charged only $60, because the QM ceiling already binds) — a real mitigation, but it is
incidental, unmeasured, and disappears on borrower-paid files.

### Structural fix

1. **Pin the version.** Persist `feeScheduleVersion` on the application at first LE issuance and
   resolve fees by that version for the life of the file. This makes the append-only table
   deliver the reproducibility its own header comment already claims, and reduces a re-price to
   what it should be: a change that affects *new* files only.
2. **Make the publish route price its own decision.** Before writing, count in-flight files with
   an issued baseline, run `evaluateTolerance` for each against the candidate schedule, and
   return the aggregate cure. Publishing should surface "this creates $X of cure across N
   files" and require explicit acknowledgement of that number.
3. **Preview both comp models.** `previewSchedule` must cover borrower-paid, or the origination
   dial is untestable through the surface that sets it.

---

## FA-21 — An unrelated change-of-circumstance authorizes every increase (High)

### The architectural problem

`evaluateTolerance(baseline, revised, hasChangeOfCircumstance)` takes a **boolean**
(`feeTolerance.ts:178-182`), and `reconcileDisclosure` supplies it as
`openCocs[0] ?? null` → `!!coc` (`leDisclosureBaseline.ts:236-239`) — the *first arbitrary open
CoC on the file*. The `change_of_circumstances` table (`shared/schema/compliance.ts:755-777`)
stores `reasonType` and a free-text `description` but has **no field scoping which charges the
circumstance affects**.

Reg Z is narrower than that. §1026.19(e)(3)(iv) permits a revised estimate to reset good faith
only for the charges *affected by* the changed circumstance. A blanket boolean makes any open
CoC a universal authorization.

The consequence is not cosmetic, because the two verdicts take different branches:
`cure_required` → `blocked_no_coc`, baseline unmoved, cure recorded. `increase_justified` + a
CoC → a **new baseline is persisted** at the higher figures (`leDisclosureBaseline.ts:249-259`).

So: a borrower locks their rate (a legitimate `rate_lock` CoC, affecting rate-dependent charges
only). Meanwhile the platform published a fee increase. On the borrower's next LE retrieval, the
unrelated rate-lock CoC flips the platform's own fee hike from `cure_required` to
`increase_justified`, the higher fees become the new disclosed baseline, and the cure the
originator genuinely owed **vanishes from the register**, which counts only `cure_required`.

### Quantified

Same inputs as FA-20, borrower-paid, $300,000:

- no CoC → `cure_required`, cure **$1,050**
- **any** open CoC → `increase_justified`, same $1,050 in increases, **baseline reset, $0 recorded**

The verdict flips on the mere existence of an unrelated record. The dollar figure is identical;
only whether the platform owes it changes.

### Structural fix

Scope the authorization to the charges the circumstance actually touches: add an affected-fee-id
set to `change_of_circumstances`, and change `evaluateTolerance`'s third parameter from `boolean`
to that set, justifying only matching lines and leaving the rest to cure. Nothing in the
platform's own fee schedule should ever be in that set.

**Escalate rather than implement.** Which charges each of the six reasons may reset is a
regulatory reading, and this repo has already routed exactly that question to counsel —
`changeOfCircumstance.ts:10-12`: *"Fee-tolerance / good-faith cure math is deliberately NOT
automated: every recorded change of circumstance routes to manual review."* The **unscoped
boolean is a defect regardless of that reading** and can be fixed structurally; the mapping
requires counsel.

---

## Verified — the prior remediation holds at HEAD

`feeTolerance` · `leDisclosureBaseline` · `platformFeeSchedule` · `contingentLiabilities` ·
`compensationElectionQmGate` · `compensationClawback` · `counterpartyAndCompensation` ·
`changeOfCircumstance` · `loCompensation` · `businessChannel` — **10 files, 158 tests, all
green.**

Spot-checked and still sound:

- **Balance sheet / capital structure.** `BUSINESS_CHANNEL = "broker"` unchanged; no warehouse
  line, no loans held for sale, no duration mismatch, because there are no assets. Correct for
  the model (F-16). The delivery-stack freeze guard still holds the line.
- **Capital flow.** The F-3 phantom-lock gate and F-5 counterparty capacity check are intact;
  unconfirmed locks are still segregated from lender-confirmed ones in the register.
- **Unit economics.** `shared/costLedger.ts` still reports cost-per-file *and* cost-per-funded-loan
  separately, with the pull-through gap named rather than hidden.

## Still open, unchanged

- **F-9** — third-party fee constants remain unsourced national estimates in a zero-tolerance
  bucket. The architecture to replace them per-file (`resolveActualFeesFor`) exists and is wired
  into the LE; the *values* are still working figures.
- **F-14** — the channel decision remains founder-owned. Nothing here changes it.

---

# Remediation — 2026-08-06

Landed the same day, in the scope the founder authorized: **the FA-20 version pin, and the
structural half of FA-21.** The regulatory reading FA-21 depends on was deliberately not
invented — see "What is deliberately NOT fixed" below.

**Verification:** typecheck clean · **2,143 unit tests green** (159 files) · `guard:schema`,
`guard:migrations`, `guard:channel`, `guard:querykeys`, `guard:kb`, `guard:docs` all OK.

## FA-20 — fixed at the root

The file is now **pinned** to the fee schedule it was disclosed under.

- `loan_estimate_disclosures.fee_schedule_version` (migration `0053`) records the pin at first
  issuance. Tri-state and documented on the column: `NULL` = issued before pinning existed
  (an honest gap, never backfilled with a guess), `0` = the compiled-in baseline, `N` = published
  version N.
- `resolveFeeScheduleForApplication()` (`server/services/platformFeeSchedule.ts`) resolves the
  governing schedule per file rather than globally. `loanEstimate.ts` no longer calls
  `activeFeeSchedule()` at all.
- `reconcileDisclosure` persists the pin on version 1 and **carries it forward on redisclosure** —
  a borrower's changed circumstance is not a reason to adopt a fee schedule the file was never
  disclosed under.

**The consequence:** publishing a new schedule now affects new files only. The $546–$1,300
per-file cure the audit measured can no longer be created by a re-price.

Chose the same failure posture the module already had: an unreadable pin logs loudly and falls
back to the active schedule rather than hard-failing, because pricing must not break when a
config table is unreachable — and the disclosure baseline is the backstop that keeps the
borrower on the issued figures regardless.

## FA-21 — structurally fixed; the mapping stays a counsel item

- `evaluateTolerance`'s third parameter is no longer a boolean. It takes a
  `ToleranceAuthorization` — "is there a record, and **which charges** does it reach?" — and
  every increase now carries an `authorized` flag.
- `cureAmount` now means **what is actually owed** (the unauthorized subset).
  `zeroToleranceIncrease` keeps reporting the gross figure, and
  `unauthorizedZeroToleranceIncrease` was added, so partial coverage produces a partial cure
  instead of an all-or-nothing verdict.
- `PLATFORM_SCHEDULE_FEE_IDS` (application, underwriting, tax service) can be authorized by **no**
  circumstance, however it is scoped. These are flat dollars that only a platform re-price can
  move, and a creditor re-pricing itself is not one of the six §1026.19(e)(3)(iv) reasons. That
  much needs no interpretation. `origination_fee` is deliberately **excluded** from that set — it
  is a rate on the loan amount, so a borrower-requested increase in loan size raises it
  legitimately.
- `change_of_circumstances.affected_charge_ids` (migration `0053`) carries the scope when it is
  known.

## What is deliberately NOT fixed

- **The per-reason charge mapping.** Which charges each of the six reasons may reset is a
  regulatory reading, and this repo already routes exactly that question to counsel
  (`shared/compliance/changeOfCircumstance.ts:10-12`). `affected_charge_ids` defaults to `NULL`
  = unscoped, which **preserves today's behaviour** for non-platform charges. So an unrelated
  circumstance can still authorize an unrelated third-party increase until the sets are
  populated. **FA-21 is therefore half-closed, not closed.** What is closed is the leg that
  needed no reading: no circumstance can launder the platform's own fixed fees.
- **The publish-time exposure preview** (FA-20 structural fix #2) and **previewing both
  compensation models** (#3). Pinning removes the liability those were meant to surface, so they
  drop from mitigations to diagnostics. The admin preview is still hardcoded to `lender_paid`,
  where `borrowerPaidOriginationAllowed()` forces origination to zero — so the origination-rate
  dial still shows no effect in the surface that sets it. Worth fixing; no longer urgent.

## Coverage

`tests/feeTolerance.test.ts` (+4) pins the FA-21 behaviour: no circumstance authorizes a platform
fixed fee **even when it is named explicitly**; a rate-lock scope does not justify an appraisal
overrun; a circumstance that genuinely reaches a charge authorizes it; and partial coverage cures
only the remainder ($850 gross → $300 owed).

`tests/platformFeeSchedule.test.ts` (+3) pins FA-20's wiring: a re-price really does move
zero-tolerance lines (the exposure the pin prevents), `loanEstimate.ts` resolves per application
and no longer calls `activeFeeSchedule()`, both disclosure write paths persist the pin, and
`evaluateTolerance` is never handed a bare boolean again.
