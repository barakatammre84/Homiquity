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
5. **Record.** In the SAME commit, the entry moves to **Implemented** in the uniform record format below. The Backlog copy is deleted.

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
- Guideline: Fannie Mae Selling Guide B3-3.2 (24-month seasoning; 12–24 conditional)
- Engine: `assessIncomeSeasoning` + `incomeDiscrepancyPct` in [underwritingNuance.ts](../server/services/underwritingNuance.ts) → flag `INCOME_SEASONING` (blocking <12mo, warning 12–24mo)
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

### Foundation scenarios (shipped before the registry existed)
- **Low reserves** (`LOW_RESERVES_WARNING`): post-closing reserves < 2 months PITI from verified assets — auto-condition + outreach. *Threshold is platform policy; formal citation research pending (Fannie reserve requirements, B3-4.1-01, vary by transaction type).*
- **Complex income** (`COMPLEX_INCOME_CHECK`): self-employed → 2-year tax-return conditions gate clear-to-close
- **VA zero-down funnel path**: military status asked before down payment; $0 down gated to VA-eligible purchases; PMI guidance suppressed
- **Anti-steering, eDisclosure, FCRA consent gates**: see [LENDER_READINESS_GAP_ANALYSIS.md](LENDER_READINESS_GAP_ANALYSIS.md)

---

## Backlog (processed top-down, one per daily run)

### S-05: Rental Income Calculation (Schedule E)
Status: Proposed
Story: The borrower owns a rental property with an executed lease and wants the rental income to offset the property's debt for DTI purposes.
Guideline: Fannie Mae Selling Guide B3-3.1-08 (Rental Income)
Signal: Schedule E (Form 1040) rental income and an executed lease agreement; intake already captures rental income sources with per-property rent.
Rule: Qualifying rental income = (Gross Monthly Rent × 0.75) − property PITIA. Example: rent $2,000 × 0.75 = $1,500; PITIA $1,200 → +$300/month qualifying income.
Resolution: "We applied a 25% vacancy/expense factor to your reported rent ($300/month qualifying). Please upload the executed lease agreement and your most recent Schedule E to document rental history."

### S-06: Multi-Unit Subject Property Rental Income
Status: Proposed
Story: The borrower is buying a 2–4 unit property, will occupy one unit, and wants projected rent from the other units to qualify.
Guideline: Fannie Mae Selling Guide B3-3.1-08 (Rental Income from Subject Property)
Signal: application propertyType = multi_family + occupancy = primary residence; market rent from appraisal/rent schedule.
Rule: Qualifying rental income = Gross Monthly Market Rent × 0.75, applied against subject PITIA. Example: market rent $3,000 × 0.75 = $2,250 offset.
Resolution: "We applied a 25% vacancy/expense factor to the projected market rent ($2,250/month). Please upload the appraisal rent schedule or executed leases to confirm market rent."

### S-07: Rental Income Conversion (retaining current primary as a rental)
Status: Proposed
Story: The borrower is converting their current primary residence to an investment property and wants its projected rent to offset that property's PITIA on the new application.
Guideline: Fannie Mae Selling Guide B3-3.1-08
Signal: application field for current-property disposition = "retain as rental" with no 12-month rental history on tax returns. *(Note: intake doesn't collect this disposition field yet — implementation includes adding it.)*
Rule: Offset = (Gross Market Rent × 0.75) − retained property PITIA; a negative result adds to DTI. Example: rent $2,000 × 0.75 = $1,500; PITIA $1,800 → −$300/month (net debt).
Resolution: "We applied a 25% vacancy factor to your estimated market rent per investor guidelines. Please upload a rental appraisal or executed lease to verify these figures."

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

## Needs Clarification

### NC-01: Student-loan $0-payment factor — 1% (implemented) vs 0.5% (proposed)
Multiple generated submissions cite Fannie Mae B3-6-05 with a **0.5%** factor for $0-payment/IDR student loans. The implemented engine (S-03) uses **1%**, matching the original cited source doc and the historical Fannie rule; **0.5% is the FHA figure (Handbook 4000.1)**. This is regulated math — it will not be changed silently. Open questions for Amr:
1. Keep Fannie conventional treatment at 1% of balance (current implementation)?
2. Add a loan-type branch: FHA applications use 0.5% per Handbook 4000.1?
3. Should a *documented* IDR payment amount override the calculated figure (Fannie permits documented IDR payments, including $0, with evidence)?
Answer here or in chat and the guardian implements the update with citations and tests.
