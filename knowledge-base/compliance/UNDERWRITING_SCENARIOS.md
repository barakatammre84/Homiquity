# Underwriting Scenarios Registry

**What this is:** the living catalog of borrower scenarios the platform handles deterministically — and the intake queue for new ones. Every scenario in the system lives here, in exactly one of three states: **Backlog** (proposed), **Needs Clarification** (blocked on a question), or **Implemented** (in code, tested, verified).

**The compliance contract (non-negotiable, enforced by `tests/complianceInvariants.test.ts`):**
1. Every rule must cite its governing guideline (Fannie/Freddie Selling Guide section, VA Pamphlet chapter, FHA Handbook section, CFPB regulation). **No citation → not implemented.**
2. All decision math is **deterministic and server-side** — pure functions in `server/services/underwritingNuance.ts` (or a sibling module), unit-tested against the scenario's own worked numbers. AI never computes an approval, denial, rate, or ratio (Reg B / ECOA).
3. Flags surface through the existing signal fabric: `pre_uw_flags` → borrower chip + "Strengthen your file" action + staff badges + LO signals queue. New scenarios extend `PreUwFlagCode`, never bypass it.
4. Resolutions are borrower-first: the flag's reason names the exact numbers and the exact documents/actions that resolve it.
5. Credit pulls stay FCRA-consent-gated; disclosures stay ESIGN/Reg-Z-gated; nothing weakens an existing gate.

---

## The process (uniform, in order)

1. **Generate.** Use the LLM prompt below (or write by hand). One scenario = the six template fields, nothing else.
2. **Intake.** Paste new scenarios at the END of the **Backlog** section. Assign the next sequential ID (`S-XX`) and `Status: Proposed`. Don't renumber existing entries — IDs are permanent.
3. **Triage** (done by Claude/the daily guardian before any implementation):
   - **Dedupe:** if it matches an Implemented or Backlog entry, it's dropped (noted in the run report). A re-submission of an implemented scenario is only acted on if labeled **`Correction to S-XX`** with a citation — corrections to regulated math never happen silently.
   - **Citation check:** missing/uncited/conflicting guideline → moved to **Needs Clarification** with an `NC-XX` ID and the specific open questions.
4. **Implement** (at most one per daily run; immediately if pasted in chat): pure cited function → flag → unit tests reproducing the scenario's worked example → simulated-vendor extension if new data is needed → schema to local+prod before code → live verification in dev.
5. **Record.** In the SAME commit: the entry moves to **Implemented** in the uniform record format below, the Backlog copy is deleted, and `server/services/scenarioCatalog.ts` gains the entry (the read-only machine catalog served at `GET /api/scenarios/catalog`, kept in sync by `tests/scenarioCatalog.test.ts`). Operating instructions for scenario sessions live in [SCENARIO_ARCHITECT.md](./SCENARIO_ARCHITECT.md).

**LLM generation prompt** (paste into Gemini; its output drops straight into Backlog):

```
You are a Senior Mortgage Credit Underwriter documenting borrower scenarios
for a deterministic underwriting engine. Output ONLY scenario specifications
in exactly this format — no code, no file names, no architecture advice:

### S-XX: <Scenario Name>
Status: Proposed
Story: <2-3 sentences: who the borrower is and what makes them non-standard>
Guideline: <the exact governing citation — Fannie Mae Selling Guide section
  (e.g. B3-6-05), Freddie Mac Guide section, VA Pamphlet 26-7 chapter,
  FHA Handbook 4000.1 section, or CFPB regulation (e.g. 12 CFR §1026.43).
  If unsure, write "NO CITATION — needs research" instead of guessing.>
Signal: <what data reveals this — an application answer, credit report
  tradeline attribute, bank transaction pattern, or property/public record>
Rule: <the deterministic threshold or formula, with ONE fully worked numeric
  example (inputs → calculation → result). This example becomes the unit test.>
Risk impact: <what goes wrong if this scenario is undetected>
Workflow: <loan officer actions / borrower actions / what the automation
  engine should do (flag, condition, route change, outreach)>
Resolution: <the exact borrower-facing message and the specific documents or
  actions that resolve it>

Rules: never invent guideline citations; flag uncertainty explicitly; do not
restate scenarios you have produced before; prefer triggers machine-detectable
from application data, credit tradelines, bank transactions, or public records.
```

**Implemented record format** (what an entry looks like after step 5):

```
### S-XX: <Name>
- Status: Implemented <date> (commit <sha>)
- Guideline: <citation>
- Engine: <function(s)> in <module> → flag <PREUW_FLAG_CODE>
- Signal source: <table/field or intake path>
- Tests: <test file> (<what the worked example verifies>)
- Verified live: <what was exercised and the observed result>
```

---

## Implemented

### S-01: Hybrid W-2 / Self-Employed Creator (income seasoning)
- Status: Implemented 2026-07-03 (commit 1e189b2)
- Guideline: Fannie Mae Selling Guide B3-3.5-01, "Length of Self-Employment" (two-year history; under two years only where the most recent returns reflect a full 12 months from the current business **and** prior income at the same or greater level in the same field is separately documented)
- Engine: `assessIncomeSeasoning` + `incomeDiscrepancyPct` in [underwritingNuance.ts](../../server/services/underwritingNuance.ts) → flag `INCOME_SEASONING` (blocking <12mo, warning 12–24mo)
- Signal source: intake `incomeSources[].yearsInRole`; discrepancy delta armed for verified income when Truv/Argyle lands
- Tests: `tests/underwritingNuance.test.ts` (14-month conditional case matches the source doc)
- Verified live: 14-month self-employment consulting income → warning flag with 1040s resolution path

### S-02: Relocating Military Veteran (VA residual income)
- Status: Implemented 2026-07-03 — engine complete; wired at URLA/AUS stage (needs sqft + household size, which intake doesn't collect)
- Guideline: VA Pamphlet 26-7 Chapter 4 (residual matrix; $0.14/sqft utilities as an income deduction; cushion = baseline × 1.2 when DTI > 41%)
- Engine: `computeVaResidualIncome`, `vaResidualBaseline`, `VA_RESIDUAL_MATRIX` in underwritingNuance.ts
- Tests: reproduce the source doc exactly (South/family-of-4 = $1,003 baseline; 2,500 sqft = $350 utilities; cushion target $1,203.60)
- Related: VA zero-down funnel path + PMI suppression (funnel machine `vaZeroDown`)
- Note: a later generated variant added utilities to the residual *target* instead of deducting them from income; rejected — Ch. 4 treats utilities as a maintenance/utility expense against income, and the cushion applies to the baseline only.
- **Correction to S-02 — 2026-07-04 (resolves roadmap #29; verified against the official 26-7 handbook text, Ch. 4 Topics 9–10):** three divergences between the live engine (`underwritingEngine.ts`) and this scenario's cited implementation, fixed together:
  1. *Tax estimate unified.* The engine carried a forked, uncited inline 18%; VA Items 32–34 prescribe IRS/state **tax-table estimates** on documented income — neither 18% nor 22% is a VA figure. Both paths now share `RESIDUAL_TAX_RATE` (0.22, conservative, the tested value), ledgered as `platform-va-residual-tax-estimate` with the tax-table method noted for when real income docs flow (F3/F5).
  2. *5% reduction cited and gate corrected.* The engine's "Active-Duty Commissary Facility Discount" IS sourceable — Ch. 4, Topic 9, Item 43 "Reducing the Residual Income Figures" — but the conditions are **disjunctive** (active-duty OR retired serviceperson, OR clear indication of military-facility benefits: Guard/Reserve retirees, 100%-disabled Veterans and family, Medal of Honor recipients). The engine's `&&` gate under-applied it; now `VA_RESIDUAL_REDUCTION_FACTOR` with an OR gate in the engine and an opt-in flag in `computeVaResidualIncome`. Ledgered as `va-26-7-ch4-residual-reduction`.
  3. *Family-size cap added.* The +$80/member addition applies only "up to a family of seven" — the handbook's own example (family of 8, Georgia, $150k) yields $1,199 and states "The eighth person will not be considered." Both paths previously added uncapped (over-requiring for large families); now `VA_EXTRA_MEMBER_FAMILY_CAP = 7`, with the handbook example as a unit test.
  - Invariant coverage extended: `tests/complianceInvariants.test.ts` now also reads `underwritingEngine.ts` (the citation checks previously only read this module — forked regulated math was invisible).
  - Known remaining band gap (unchanged, conservative): the ≤ $79,999 residual table (lower figures, +$75/member) is not implemented; sub-$80k loans over-require.

### S-03: The "Sleeper Debt" Trap (undisclosed liabilities)
- Status: Implemented 2026-07-03 (commit 1e189b2)
- Guideline: Fannie Mae Selling Guide B3-6-05 (deferred student loans at 1% of balance; new tradelines counted) — see NC-01 for the 0.5%/FHA question
- Engine: `adjustLiabilities` + `computeWhatIfPayoff` → flag `VERIFIED_DEBT_DTI` with the smallest-single-payoff coaching suggestion
- Signal source: `credit_pulls.liabilities` (machine-readable ledger written by every pull)
- Tests: reproduce the source doc ($200 + 1% × $60,000 + $50 = $850; DTI 32% → 46%)
- Verified live: fresh retail line → DTI 43.4% flag with "pay off $2,380 Wayfair balance → 42.7%" what-if

### S-04: The "Mattress Money" Gift Fund (large-deposit sourcing)
- Status: Implemented 2026-07-03 (commit 1e189b2); citation refined 2026-07-03
- Guideline: Fannie Mae Selling Guide B3-4.2-02 (Depository Accounts — large-deposit sourcing, >50% of monthly qualifying income); B3-4.3-04 governs the gift-funds resolution path
- Engine: `detectSignificantDeposits` → flag `LARGE_DEPOSIT_SOURCING` with gift-letter/sourcing resolution
- Signal source: `verification_reports.raw_payload.transactions` (VOA depository transactions)
- Tests: reproduce the source doc ($12,000 deposit vs $3,000 threshold at $6,000/mo income)
- Verified live: $9,482 simulated deposit vs $5,000 threshold → flag raised through the webhook path
- Future depth: automated e-sign gift-letter generation with donor link (blocked on e-signature provider + SendGrid)

### S-05: Rental Income Calculation (Schedule E)
- Status: Implemented 2026-07-03; **applied to DTI 2026-07-17** (non-W2 plan §3.1 — previously advisory-only)
- Guideline: Fannie Mae Selling Guide **B3-3.8-01** (Rental Income, 10/08/2025) — *renumbered from B3-3.1-08 in the Income Assessment reorganization; verified live 2026-07-17.* Transcription: [docs/fannie-mae/rental-income-reference.md](../../docs/fannie-mae/rental-income-reference.md)
- Engine: `calculateRentalIncomeOffsets` in [underwritingNuance.ts](../../server/services/underwritingNuance.ts) → flag `RENTAL_INCOME_OFFSET`; **DTI application** via `computeRentalPath` → orchestrator (positive → qualifying income) + `decisionEngine.aggregateBorrowerFinancials` (net loss → monthly obligations), per the guide's verbatim positive/negative treatment (ledger `fnma-b3-3-8-01-rental-offset-dti`)
- Application gates (PLATFORM POLICY, ledger `platform-rental-preliminary-asymmetry`): positive offsets apply only at decision-grade `financialDataProvenance`; a net loss applies always (can only under-state). Applied offsets coexisting with mortgage-type URLA liability rows flag manual review (the guide bars counting the PITIA separately — double-count guard)
- Signal source: intake `incomeSources[].rentalProperties[]` (monthlyRentalIncome + monthlyDebtPayment per property)
- Tests: `tests/underwritingNuance.test.ts` (source-doc math) + `tests/incomeOrchestrator.test.ts` "rental DTI application" (gate asymmetry, loss-to-liability, double-count guard, fingerprint sensitivity)
- Verified live: fresh registered borrower, rental income source with $2,000/mo rent + $1,200/mo PITIA → `RENTAL_INCOME_OFFSET` raised with "$1,500/month qualifying... adds $300/month toward your qualifying income", borrower notified

### S-06: Multi-Unit Subject Property Rental Income
- Status: Implemented 2026-07-04 (commit b7f6e5d); **applied to DTI 2026-07-17** (income-side)
- Guideline: Fannie Mae Selling Guide **B3-3.8-01** (Rental Income, 10/08/2025; formerly B3-3.1-08). **Applied treatment verified live 2026-07-17:** qualifying rent from the non-occupied unit(s) is **added to total monthly income** while the **full subject PITIA stays in monthly obligations** — never netted (ledger `fnma-b3-3-8-01-subject-rental-income`). The earlier net-of-PITIA framing survives only as advisory display context in `calculateSubjectPropertyRentalOffset`
- Engine: `calculateSubjectPropertyQualifyingRent` in [underwritingNuance.ts](../../server/services/underwritingNuance.ts) → orchestrator `subjectRentalIncomeApplied` (2–4 unit + primary-residence eligibility gate, decision-grade provenance gate shared with S-05); borrower flag `SUBJECT_PROPERTY_RENTAL_OFFSET` reports the income-side figure
- Signal source: `urla_property_info.numberOfUnits` + `.occupancyType` + `.estimatedMarketRent` column (appraisal rent schedule / lease estimate captured on the URLA property step)
- Tests: `tests/underwritingNuance.test.ts` (source-doc math + exclusions) + `tests/incomeOrchestrator.test.ts` (income-side application, eligibility + provenance gating)
- Verified live: fresh registered borrower, 3-unit primary-residence purchase ($450,000/$90,000 down) + $3,000/mo estimated market rent → `SUBJECT_PROPERTY_RENTAL_OFFSET` raised with $2,250/month qualifying against the computed $2,863.84 subject PITIA, borrower notified

### S-07: Rental Income Conversion (departing residence)
- Status: Implemented 2026-07-17 (non-W2 plan §3.4; migration `0037` adds the intake fields). *Registry record moved from Backlog + catalog entry added 2026-08-04 — the original sync test scanned only this section, so the misplacement passed vacuously; both directions are now test-enforced (`tests/scenarioCatalog.test.ts`).*
- Guideline: Fannie Mae Selling Guide **B3-3.8-01** (Rental Income, 10/08/2025; formerly B3-3.1-08) — the current text has **no equity requirement and no prior-rental-history restriction** for a departing residence (verified live 2026-07-17; the 30%-equity / 1-year-management rules circulating in older sources are stale — see the non-W2 plan Appendix A.3). Recently converted properties need the most recent Schedule E confirming no prior rental activity; conversions also see B3-6-06.
- Engine: `departingResidenceInput` (orchestrator IO gate) → synthesized entry in `computeRentalPath` ([income/paths/rental.ts](../../server/services/income/paths/rental.ts)); borrower flag `RENTAL_CONVERSION_OFFSET` in [preUnderwriting.ts](../../server/services/preUnderwriting.ts)
- Rule: the departing residence joins the **per-property** B3-3.8-01 offset set (75% × projected market rent − retained PITIA; positive → qualifying income at decision-grade provenance, negative → monthly obligations always — same gates as S-05). Because the rent is **projected**, the rental path flags manual review whenever a departing residence is included (PLATFORM POLICY, ledger `platform-s07-departing-projected-rent-review`), and it never enters the DSCR portfolio.
- Signal source: `loan_applications.current_property_disposition = "converted_to_rental"` + `departing_residence` jsonb (`{ address?, estimatedMarketRent, monthlyPitia }`), validated by `departingResidenceSchema`
- Tests: `tests/incomeOrchestrator.test.ts` (departing gain gated / loss always / review note), `tests/preUnderwriting.test.ts` flag coverage
- Resolution: "We applied a 25% vacancy factor to your estimated market rent per investor guidelines. Please upload a rental appraisal or executed lease to verify these figures."

### Foundation scenarios (shipped before the registry existed)
- **Low reserves** (`LOW_RESERVES_WARNING`): post-closing reserves < 2 months PITI from verified assets — auto-condition + outreach. *Threshold is platform policy; formal citation research pending (Fannie reserve requirements, B3-4.1-01, vary by transaction type).*
- **Complex income** (`COMPLEX_INCOME_CHECK`): self-employed → 2-year tax-return conditions gate clear-to-close
- **VA zero-down funnel path**: military status asked before down payment; $0 down gated to VA-eligible purchases; PMI guidance suppressed
- **Anti-steering, eDisclosure, FCRA consent gates**: these are live compliance controls, so read them from the code and the invariants that pin them — `tests/complianceInvariants.test.ts`, plus [L2_COMPLIANCE_AND_LOGIC.md](../L2_COMPLIANCE_AND_LOGIC.md) and the standing bindings in [LAUNCH_COUNSEL_PACKET.md](./LAUNCH_COUNSEL_PACKET.md). *(This line used to point at `archive/assessments/LENDER_READINESS_GAP_ANALYSIS.md`, a file banner-marked "do not act on this document" — a compliance doc must not route a reader into the quarantine for three regulatory gates.)*

---

## Backlog (processed top-down, one per daily run)

### S-08: Self-Employed Declining Income Trend
Status: Proposed
Story: A self-employed borrower's most recent tax year shows lower net profit than the prior year, signaling potential income instability.
Guideline: Fannie Mae Selling Guide B3-3.3-01 (Analyzing Self-Employment Income)
Signal: two consecutive years of Schedule C/K-1 net profit (extractable from tax-return documents; extraction service already parses tax returns).
Rule: If current-year net profit < prior-year → qualifying income = the lesser amount, unless a written explanation + YTD P&L documents stability. Example: 2024 = $100,000, 2025 = $80,000 → qualify at $80,000.
Resolution: "Income decline detected between 2024 and 2025. Please provide a written explanation and a year-to-date Profit & Loss statement to document income stability."

### S-09: Employment Gap Verification
Status: Proposed
Story: The borrower's employment history shows a gap longer than six months, requiring stability verification.
Guideline: Fannie Mae Selling Guide B3-3.1-09 (Employment Gaps) *(triage note: verify the exact section reference during implementation — gaps are addressed in B3-3.1; cite precisely in code)*
Signal: employment history end/start dates. *(Note: intake captures only current-employment tenure — implementation includes adding prior-employment dates to the URLA/intake path.)*
Rule: If gap > 6 months → require ≥6 months tenure with the current employer plus a written explanation. Example: prior job ended 2025-01-01, current started 2025-08-01 → 7-month gap → verification triggered.
Resolution: "We identified a 7-month employment gap. Please provide a written explanation and documentation of your current start date (offer letter or paystubs covering 6+ months)."

### S-10: Non-Arm's-Length Transaction
Status: Proposed
Story: The borrower is purchasing from a family member, raising straw-buyer and undisclosed-agreement risk.
Guideline: Fannie Mae Selling Guide B2-2-05 (Non-Arm's-Length Transactions) *(triage note: verify exact section at implementation; commonly cited as B2-1.2/B2-2 family)*
Signal: application "relationship to seller" field. *(Note: not collected yet — implementation adds it to the purchase-contract intake step.)*
Rule: Relationship ∈ {parent, sibling, other relative} → flag; require signed Non-Arm's-Length Affidavit + full source-of-funds documentation.
Resolution: "This transaction is flagged as non-arm's-length. Please upload a signed Non-Arm's-Length Affidavit and proof of your down-payment source."

### S-11: Property Flipping Holding Period
Status: Proposed
Story: The subject property was acquired by the seller fewer than 90 days before the purchase agreement — potentially ineligible as a flip.
Guideline: Fannie Mae Selling Guide B2-2-03 *(triage note: verify — property-flip seasoning is primarily an FHA rule (Handbook 4000.1: <90-day resales ineligible); Fannie handles it through appraisal/value scrutiny. Confirm the intended citation before coding an eligibility block.)*
Signal: public-record seller acquisition date vs purchase agreement date (needs a property-records data source — currently only simulatable).
Rule: (Purchase agreement date − seller acquisition date) < 90 days → ineligible. Example: acquired 2026-06-01, agreement 2026-07-01 → 30 days → ineligible.
Resolution: "The property was acquired by the seller fewer than 90 days ago, which does not meet investor requirements for this financing type. Please consult your agent about alternatives."

---

## Needs Clarification · Batch intake

Moved to **[UNDERWRITING_SCENARIO_INTAKE.md](./UNDERWRITING_SCENARIO_INTAKE.md)** on
2026-08-06 — the unadjudicated queue was ~85% of this file and buried the registry above.
Scenarios still arrive there and move here only with a citation and a deterministic rule.
