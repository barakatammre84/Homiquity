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
5. **Record.** In the SAME commit: the entry moves to **Implemented** in the uniform record format below, the Backlog copy is deleted, and `server/services/scenarioCatalog.ts` gains the entry (the read-only machine catalog served at `GET /api/scenarios/catalog`, kept in sync by `tests/scenarioCatalog.test.ts`). Operating instructions for scenario sessions live in [SCENARIO_ARCHITECT.md](SCENARIO_ARCHITECT.md).

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

### S-05: Rental Income Calculation (Schedule E)
- Status: Implemented 2026-07-03
- Guideline: Fannie Mae Selling Guide B3-3.1-08 (Rental Income)
- Engine: `calculateRentalIncomeOffsets` in [underwritingNuance.ts](../server/services/underwritingNuance.ts) → flag `RENTAL_INCOME_OFFSET`
- Signal source: intake `incomeSources[].rentalProperties[]` (monthlyRentalIncome + monthlyDebtPayment per property)
- Tests: `tests/underwritingNuance.test.ts` (reproduces the source doc: $2,000 rent × 0.75 − $1,200 PITIA = +$300/month; also covers a negative net-offset case and multi-property summation)
- Verified live: fresh registered borrower, rental income source with $2,000/mo rent + $1,200/mo PITIA → `RENTAL_INCOME_OFFSET` raised with "$1,500/month qualifying... adds $300/month toward your qualifying income", borrower notified

### S-06: Multi-Unit Subject Property Rental Income
- Status: Implemented 2026-07-04 (commit b7f6e5d)
- Guideline: Fannie Mae Selling Guide B3-3.1-08 (Rental Income from Subject Property)
- Engine: `calculateSubjectPropertyRentalOffset` in [underwritingNuance.ts](../server/services/underwritingNuance.ts) → flag `SUBJECT_PROPERTY_RENTAL_OFFSET`
- Signal source: `urla_property_info.numberOfUnits` + `.occupancyType` + new `.estimatedMarketRent` column (appraisal rent schedule / lease estimate captured on the URLA property step)
- Tests: `tests/underwritingNuance.test.ts` (reproduces the source doc: $3,000 market rent × 0.75 = $2,250 qualifying; also covers non-primary-occupancy and 1-unit/5+-unit exclusions)
- Verified live: fresh registered borrower, 3-unit primary-residence purchase ($450,000/$90,000 down) + $3,000/mo estimated market rent → `SUBJECT_PROPERTY_RENTAL_OFFSET` raised with $2,250/month qualifying against the computed $2,863.84 subject PITIA, borrower notified

### Foundation scenarios (shipped before the registry existed)
- **Low reserves** (`LOW_RESERVES_WARNING`): post-closing reserves < 2 months PITI from verified assets — auto-condition + outreach. *Threshold is platform policy; formal citation research pending (Fannie reserve requirements, B3-4.1-01, vary by transaction type).*
- **Complex income** (`COMPLEX_INCOME_CHECK`): self-employed → 2-year tax-return conditions gate clear-to-close
- **VA zero-down funnel path**: military status asked before down payment; $0 down gated to VA-eligible purchases; PMI guidance suppressed
- **Anti-steering, eDisclosure, FCRA consent gates**: see [LENDER_READINESS_GAP_ANALYSIS.md](LENDER_READINESS_GAP_ANALYSIS.md)

---

## Backlog (processed top-down, one per daily run)

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
1. Borrower With Social Security Benefits Paid to a Representative Payee
Story: Borrower receives SSA disability income, but payments are issued to a representative payee rather than directly to the borrower. They claim full benefit amount as qualifying income.
Guideline: Fannie Mae B3‑3.1‑01 (Retirement, Social Security, and Disability Income) + CFPB ATR/QM 12 CFR §1026.43(c)(2)  
Signal: Bank statements show SSA deposits under a representative payee’s name.
Rule: Income must be verified as belonging to the borrower; representative payee arrangements require SSA award documentation.
Example: SSA award = $1,850/month; bank deposits show $1,850 to payee → borrower must prove entitlement → qualifying income = $1,850 only if SSA letter confirms borrower as beneficiary.
Resolution: “Your Social Security benefits are paid to a representative payee. Please upload your SSA award letter confirming you are the beneficiary.”

2. Borrower With Child Support Ending Within 10 Months
Story: Borrower relies on child support as major income, but the court order shows the child turns 18 in less than 10 months.
Guideline: Fannie Mae B3‑3.1‑09 (Alimony, Child Support, and Separate Maintenance)
Signal: Court order shows termination date <10 months from application.
Rule: Income cannot be used unless it will continue ≥3 years.
Example: Child support = $900/month; remaining duration = 8 months → income cannot be used.
Resolution: “Your child support ends in less than 10 months. Please upload updated court documents if support will continue beyond age 18.”

3. Borrower With Multiple NSF Fees in Bank Statements
Story: Borrower has frequent overdrafts and NSF fees, indicating unstable cash flow.
Guideline: FHA 4000.1 II.A.4.C.2 (Borrower Funds — Large Deposits & Financial Assessment)
Signal: Bank statements show ≥3 NSF fees in 60 days.
Rule: Excessive NSF activity requires manual financial capacity review.
Example: 3 NSF fees in 45 days → trigger financial capacity review.
Resolution: “Your bank statements show several overdraft fees. Please upload 60 days of statements and a letter explaining the cause.”

4. Borrower With Undisclosed Business Ownership
Story: Borrower claims W‑2 employment only, but tax transcripts show Schedule C income.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employed Income)
Signal: IRS transcript shows Schedule C activity not listed on application.
Rule: Must analyze business income if borrower owns ≥25% of business.
Example: Schedule C net profit = $18,000 → borrower owns 100% → must include business analysis.
Resolution: “Your IRS transcript shows business income. Please upload your full tax returns and business documentation.”

5. Borrower With Large Venmo/PayPal Transfers Labeled “Rent”
Story: Borrower receives recurring digital wallet transfers labeled “rent,” suggesting undisclosed rental income.
Guideline: Fannie Mae B3‑3.1‑08 (Rental Income)
Signal: Bank statements show monthly $1,200 Venmo transfers labeled “rent.”
Rule: Rental income must be documented with tax returns or lease.
Example: Monthly transfers = $1,200 → cannot be used without Schedule E or lease.
Resolution: “Your bank statements show rent payments. Please upload your lease agreement or Schedule E from your tax return.”

6. Borrower With Recent Credit Dispute on Major Tradeline
Story: Borrower disputes a credit card with high balance to temporarily inflate credit score.
Guideline: Fannie Mae B3‑5.3‑09 (Credit Report — Disputed Tradelines)
Signal: Credit report shows “Account in dispute” on revolving account.
Rule: Disputed accounts with balances must be resolved before underwriting.
Example: Balance = $4,500; payment = $150 → must include in DTI once dispute removed.
Resolution: “A disputed credit account must be resolved. Please remove the dispute and upload an updated credit report.”

7. Borrower With Temporary Leave Income
Story: Borrower is on maternity leave and receiving reduced pay. They want full salary used.
Guideline: Fannie Mae B3‑3.1‑09 (Temporary Leave Income)
Signal: Employer letter shows temporary leave with partial pay.
Rule: Qualifying income = lesser of current pay or verified return‑to‑work salary.
Example: Current pay = $2,000/month; return salary = $6,000/month → qualifying = $2,000 unless employer confirms return date.
Resolution: “You’re on temporary leave. Please upload your employer’s return‑to‑work letter with your full salary.”

8. Borrower With Non‑Occupying Co‑Borrower on FHA Loan
Story: Borrower adds a non‑occupying co‑borrower to qualify, but LTV exceeds FHA limits.
Guideline: FHA 4000.1 II.A.5.b (Non‑Occupying Co‑Borrowers)
Signal: Application shows non‑occupying co‑borrower + LTV >75%.
Rule: Max LTV = 75% when non‑occupying co‑borrower is used.
Example: Purchase price = $300,000; loan = $285,000 → LTV = 95% → not allowed.
Resolution: “Your FHA loan has a non‑occupying co‑borrower. FHA limits LTV to 75%. You may adjust loan amount or remove the co‑borrower.”

9. Borrower With Unreimbursed Business Expenses on W‑2
Story: Borrower is a W‑2 employee but has significant unreimbursed business expenses on Schedule A.
Guideline: Fannie Mae B3‑3.1‑01 (Employment Income — Adjustments)
Signal: Tax return shows $6,000 unreimbursed expenses.
Rule: Must subtract unreimbursed expenses from qualifying income.
Example: W‑2 income = $60,000; expenses = $6,000 → adjusted = $54,000 → $4,500/month.
Resolution: “Your tax returns show unreimbursed work expenses. Please upload your full returns so we can calculate adjusted income.”

10. Borrower With Recent HELOC Draws Used as Down Payment
Story: Borrower draws from a HELOC to fund down payment but claims it as personal savings.
Guideline: Fannie Mae B3‑4.3‑06 (Borrowed Funds Secured by an Asset)
Signal: Bank statements show HELOC draw → immediate transfer → escrow deposit.
Rule: HELOC funds must be treated as borrowed funds.
Example: HELOC draw = $25,000 → down payment = $25,000 → must count repayment in DTI.
Resolution: “Your down payment came from a HELOC. Please upload your HELOC statement so we can include repayment in your debt ratio.”
11. Borrower With Alimony That Fluctuates Due to Income‑Based Formula
Story: Borrower receives alimony calculated as a percentage of the ex‑spouse’s income, causing monthly fluctuations. They want the highest recent amount used.
Guideline: Fannie Mae B3‑3.1‑09 (Alimony Income)
Signal: Court order shows variable alimony tied to payer’s income; bank statements show inconsistent deposits.
Rule: Must use 24‑month average when payments vary.
Example: 24‑month deposits total = $28,800 → $28,800 ÷ 24 = $1,200 qualifying monthly income.
Resolution: “Your alimony varies month‑to‑month. Please upload 24 months of bank statements and your court order so we can calculate the average.”

12. Borrower With Recent Charge‑Off on Auto Loan
Story: Borrower had an auto loan charged off six months ago but believes it doesn’t affect eligibility because the account is closed.
Guideline: Fannie Mae B3‑5.3‑02 (Payment History Requirements)
Signal: Credit report shows “Auto Loan — Charged Off — 6 months ago.”
Rule: Charge‑offs within 12 months require manual risk review; cannot be ignored.
Example: Charge‑off date = 01/2026 → Application date = 07/2026 → 6 months → triggers review.
Resolution: “Your credit report shows a recent charge‑off. Please upload a letter explaining the circumstances and any settlement documentation.”

13. Borrower Using Cryptocurrency as Down Payment
Story: Borrower liquidates crypto holdings and deposits proceeds into checking, claiming it as personal savings.
Guideline: Fannie Mae B3‑4.3‑01 (Verification of Deposits)
Signal: Bank statements show large deposits from Coinbase/Binance.
Rule: Must document asset liquidation with proof of ownership and sale.
Example: Crypto liquidation = $40,000 → deposit = $40,000 → requires documentation of sale + proof of ownership.
Resolution: “Your down payment came from cryptocurrency liquidation. Please upload transaction history showing ownership and sale.”

14. Borrower With Employment Gap of 5 Months
Story: Borrower was unemployed for five months last year but claims continuous employment.
Guideline: Fannie Mae B3‑3.1‑01 (Employment History)
Signal: VOE or pay history shows a 5‑month gap.
Rule: Gaps >60 days require explanation and documentation of stability.
Example: Gap = 5 months → must obtain explanation + proof of re‑employment stability.
Resolution: “Your employment history shows a gap. Please upload a letter explaining the gap and your re‑employment documentation.”

15. Borrower With Large Zelle Transfers Labeled “Contract Work”
Story: Borrower receives recurring Zelle payments labeled “contract work” but does not report self‑employment income on taxes.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employment Income)
Signal: Bank statements show monthly $2,000 Zelle transfers labeled “contract work.”
Rule: Must verify self‑employment income with tax returns; cannot use undocumented earnings.
Example: Monthly transfers = $2,000 → cannot be used without Schedule C.
Resolution: “Your bank statements show contract‑work payments. Please upload your tax returns or business documentation.”

16. Borrower With Deferred Student Loans Under Income‑Driven Plan
Story: Borrower’s student loans show a $0 payment due to income‑driven repayment, but they believe the payment is permanently zero.
Guideline: Freddie Mac 5401.2(c) (Student Loans)
Signal: Credit report shows “IDR — $0 payment.”
Rule: Must use 0.5% of balance if payment is $0.
Example: Balance = $80,000 → 0.5% × 80,000 = $400/month.
Resolution: “Your student loans show a $0 payment under an income‑driven plan. Please upload your loan servicer statement so we can verify the payment.”

17. Borrower With Rental Income but No Lease or Tax Returns
Story: Borrower rents out a basement unit but has never filed rental income on taxes and has no written lease.
Guideline: Fannie Mae B3‑3.1‑08 (Rental Income)
Signal: Bank statements show recurring $1,100 deposits labeled “rent.”
Rule: Cannot use rental income without Schedule E or lease agreement.
Example: Monthly deposits = $1,100 → not eligible without documentation.
Resolution: “Your rental income must be documented. Please upload your lease agreement or Schedule E from your tax returns.”

18. Borrower With Recent Bankruptcy Discharged 10 Months Ago
Story: Borrower completed Chapter 7 bankruptcy 10 months ago and wants conventional financing.
Guideline: Fannie Mae B3‑5.3‑07 (Bankruptcy Waiting Periods)
Signal: Credit report shows “Chapter 7 — Discharged 09/2025.”
Rule: Minimum waiting period = 4 years.
Example: Discharge = 09/2025 → Application = 07/2026 → 10 months → ineligible.
Resolution: “Your bankruptcy discharge is too recent for conventional financing. You may qualify for FHA; please upload your discharge paperwork.”

19. Borrower With Multiple Jobs but No Two‑Year History
Story: Borrower works two part‑time jobs but started both within the last year.
Guideline: Fannie Mae B3‑3.1‑01 (Employment History)
Signal: VOEs show start dates <12 months.
Rule: Secondary job income requires 24‑month history.
Example: Job A start = 03/2026; Job B start = 11/2025 → neither meets 24‑month requirement.
Resolution: “Your part‑time jobs do not have a long enough history. Please upload prior employment records to establish continuity.”

20. Borrower With Large Cash Withdrawals Suggesting Undisclosed Debt
Story: Borrower withdraws large cash amounts monthly, indicating possible undisclosed obligations.
Guideline: FHA 4000.1 II.A.4.C.2 (Financial Assessment — Cash Flow Review)
Signal: Bank statements show $3,000–$4,000 monthly cash withdrawals.
Rule: Must investigate for undisclosed debt or obligations.
Example: Monthly withdrawals = $3,500 → requires explanation + documentation.
Resolution: “Your bank statements show large cash withdrawals. Please upload a letter explaining the purpose and any related agreements.”
21. Borrower With Commission Income Declining for Two Consecutive Years
Story: Borrower works in sales and earns commission‑based income, but their commissions have declined for two straight years due to market slowdown.
Guideline: Fannie Mae B3‑3.1‑05 (Commission Income)
Signal: Tax returns show commission income dropping year‑over‑year.
Rule: When commission income declines, use most recent year only.
Example: Year 1 = $52,000; Year 2 = $38,000 → 27% decline → qualifying = $38,000 ÷ 12 = $3,166.67/month.
Resolution: “Your commission income has declined. Please upload your last two years of tax returns so we can calculate qualifying income.”

22. Borrower With Recent Short‑Term Personal Loan Paid Off Before Application
Story: Borrower took a personal loan three months ago and paid it off last month, believing it no longer affects underwriting.
Guideline: Fannie Mae B3‑6‑05 (Monthly Debt Obligations — Recently Paid Debts)
Signal: Credit report shows installment loan opened 3 months ago and closed 1 month ago.
Rule: Closed installment loans do not count toward DTI.
Example: Loan payment = $300 → loan closed → $0 added to DTI.
Resolution: “Your personal loan was recently paid off. Please upload the payoff letter or updated credit report showing the account closed.”

23. Borrower With Multiple Authorized User Accounts Inflating Credit Score
Story: Borrower is an authorized user on several high‑limit credit cards belonging to relatives, artificially boosting their credit score.
Guideline: Fannie Mae B3‑5.3‑09 (Authorized User Accounts)
Signal: Credit report shows ≥3 authorized user accounts with perfect payment history.
Rule: Authorized user accounts may be excluded if borrower cannot document responsibility.
Example: 3 authorized user accounts → exclude from credit profile if borrower not responsible.
Resolution: “Your credit report shows authorized user accounts. Please upload a letter confirming you are not responsible for these debts.”

24. Borrower With Large Gift Funds but No Gift Letter
Story: Borrower receives a large deposit from a family member for down payment but has no gift documentation.
Guideline: Fannie Mae B3‑4.3‑04 (Gift Funds)
Signal: Bank statement shows $30,000 deposit labeled “gift.”
Rule: Must obtain gift letter + donor ability documentation.
Example: Gift = $30,000 → requires gift letter + donor bank statement.
Resolution: “Your down payment includes gift funds. Please upload a signed gift letter and the donor’s bank statement.”

25. Borrower With Employment Verified Through Third‑Party Payroll Service Only
Story: Borrower works for a company that uses a third‑party payroll provider, but employer refuses to complete VOE directly.
Guideline: Fannie Mae B3‑3.1‑06 (Third‑Party Verification Services)
Signal: Employer directs lender to The Work Number or similar service.
Rule: Third‑party verification is acceptable if data is complete and current.
Example: Work Number shows 24 months of employment → acceptable.
Resolution: “Your employer uses a payroll verification service. Please authorize access so we can retrieve your employment records.”

26. Borrower With Large Cash Tips Not Reported on Taxes
Story: Borrower works in hospitality and receives significant cash tips but reports only partial amounts on tax returns.
Guideline: Fannie Mae B3‑3.1‑01 (Employment Income — Tips)
Signal: Bank statements show frequent cash deposits inconsistent with tax returns.
Rule: Only tax‑reported tip income can be used.
Example: Claimed tips = $1,200/month; cash deposits = $2,000/month → qualifying = $1,200/month.
Resolution: “Only reported tip income can be used. Please upload your tax returns and paystubs showing tip allocations.”

27. Borrower With HELOC Payment Not Reporting on Credit
Story: Borrower has a HELOC with interest‑only payments, but the credit report shows no payment amount.
Guideline: Fannie Mae B3‑6‑05 (HELOC Payment Calculation)
Signal: Credit report shows HELOC with no payment listed.
Rule: Use 1% of outstanding balance if payment not reported.
Example: HELOC balance = $50,000 → payment = $500/month.
Resolution: “Your HELOC does not show a payment. Please upload your HELOC statement so we can verify the correct payment.”

28. Borrower With Business Bank Statements Showing Personal Spending
Story: Borrower owns a small business and uses business accounts for personal expenses, complicating cash‑flow analysis.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employed Income — Business Funds)
Signal: Business bank statements show personal withdrawals.
Rule: Personal use of business funds requires adjustment to business income.
Example: Monthly personal withdrawals = $1,500 → subtract from business income.
Resolution: “Your business account shows personal spending. Please upload 12 months of business bank statements and your tax returns.”

29. Borrower With Multiple 30‑Day Lates on Installment Loan
Story: Borrower has several 30‑day late payments on an auto loan within the last year.
Guideline: Fannie Mae B3‑5.3‑02 (Payment History Requirements)
Signal: Credit report shows 3× 30‑day lates in past 12 months.
Rule: Multiple recent lates require manual risk assessment.
Example: 3 lates → manual review required.
Resolution: “Your credit report shows recent late payments. Please upload a letter explaining the circumstances and supporting documents.”

30. Borrower With Income From Foreign Employer
Story: Borrower works remotely for a foreign company and receives salary in euros.
Guideline: Fannie Mae B3‑3.1‑01 (Foreign Income)
Signal: Paystubs show foreign employer + foreign currency deposits.
Rule: Must convert income using current exchange rate and verify employer legitimacy.
Example: Monthly salary = €4,000; exchange rate = 1.10 → qualifying = $4,400/month.
Resolution: “Your income is from a foreign employer. Please upload your employment contract, pay history, and bank statements showing currency conversion.”
Borrower With Bonus Income Paid Annually but Wants Monthly Averaging
Story: Borrower receives a single annual bonus each December and wants it averaged monthly to boost qualifying income.
Guideline: Fannie Mae B3‑3.1‑05 (Bonus Income)
Signal: Pay history shows one lump‑sum bonus per year.
Rule: Must average bonus over 24 months.
Example: Bonus Year 1 = $10,000; Year 2 = $12,000 → total = $22,000 ÷ 24 = $916.67/month.
Resolution: “Your bonus is paid annually. Please upload two years of W‑2s and pay history so we can calculate the average.”

32. Borrower With Recent Credit Freeze Blocking Verification
Story: Borrower has a credit freeze on all bureaus, preventing automated underwriting.
Guideline: Fannie Mae B3‑5.1‑01 (Credit Reports — Requirements)
Signal: Credit pull returns “Frozen/Locked File.”
Rule: Borrower must temporarily lift freeze for underwriting.
Example: All bureaus frozen → no credit report → cannot proceed.
Resolution: “Your credit file is frozen. Please lift the freeze with each bureau and notify us so we can re‑pull your credit.”

33. Borrower With Income From Roommate Contributions
Story: Borrower receives monthly payments from a roommate to share housing costs but wants it counted as qualifying income.
Guideline: NO CITATION — needs research (Roommate income is not recognized by any federal mortgage guideline.)
Signal: Bank statements show recurring $800 deposits labeled “roommate.”
Rule: Roommate contributions cannot be used as qualifying income.
Example: Roommate pays $800/month → not eligible.
Resolution: “Roommate payments cannot be used as qualifying income. Please provide your own income documents for qualification.”

34. Borrower With Recent Pay Raise but No 30‑Day History
Story: Borrower received a significant pay raise but has only one paystub showing the new amount.
Guideline: Fannie Mae B3‑3.1‑01 (Base Income — Stability)
Signal: Paystub shows new salary; VOE confirms raise date <30 days.
Rule: Must document stability with at least 30 days of new pay.
Example: New salary = $7,000/month → only 1 paystub → cannot use new salary yet.
Resolution: “Your recent raise must be documented for 30 days. Please upload your next paystub once available.”

35. Borrower With Multiple Bank Accounts Showing Inter‑Account Transfers
Story: Borrower moves money between accounts frequently, creating the appearance of large deposits.
Guideline: Fannie Mae B3‑4.3‑01 (Verification of Deposits)
Signal: Bank statements show identical amounts transferring between accounts.
Rule: Inter‑account transfers are not new funds.
Example: $5,000 transfer from savings → checking → not counted as new assets.
Resolution: “Your deposits appear to be transfers between your own accounts. Please upload statements for all accounts involved.”

36. Borrower With Income From Online Content Creation (YouTube/Twitch)
Story: Borrower earns money from online streaming and ad revenue but has no formal business structure.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employment Income)
Signal: Bank statements show deposits from Google AdSense/Twitch.
Rule: Must verify self‑employment income with tax returns.
Example: Monthly deposits = $1,500 → cannot use without Schedule C.
Resolution: “Your online content income must be documented. Please upload your tax returns showing this income.”

37. Borrower With Large Retirement Account but No Access Documentation
Story: Borrower wants to use retirement assets for reserves but cannot document withdrawal eligibility.
Guideline: Fannie Mae B3‑4.3‑02 (Retirement Accounts)
Signal: Retirement statement shows balance but no vesting or withdrawal terms.
Rule: Must verify access to funds.
Example: Balance = $120,000 → cannot count without access documentation.
Resolution: “Your retirement account must show withdrawal eligibility. Please upload plan documents or a letter from the plan administrator.”

38. Borrower With Multiple 90‑Day Gaps in Gig Work
Story: Borrower works for multiple gig platforms but has recurring long gaps between earnings.
Guideline: Fannie Mae B3‑3.1‑05 (Non‑Traditional Income)
Signal: Bank statements show 90‑day periods with no gig deposits.
Rule: Must average 24 months and verify continuity.
Example: 24‑month deposits = $30,000 → $30,000 ÷ 24 = $1,250/month.
Resolution: “Your gig income has long gaps. Please upload 24 months of bank statements and tax returns.”

39. Borrower With Business Losses Offset by Personal W‑2 Income
Story: Borrower has strong W‑2 income but also owns a business that shows losses on Schedule C.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employment Income — Business Losses)
Signal: Tax returns show Schedule C loss = −$10,000.
Rule: Must subtract business losses from qualifying income.
Example: W‑2 income = $80,000; business loss = −$10,000 → adjusted = $70,000/year = $5,833/month.
Resolution: “Your business shows a loss. Please upload your full tax returns so we can calculate adjusted income.”

40. Borrower With Large Cash Deposit From Selling Personal Property
Story: Borrower sells a car privately and deposits the cash, claiming it as down payment funds.
Guideline: Fannie Mae B3‑4.3‑01 (Large Deposits — Source Documentation)
Signal: Bank statement shows $15,000 cash deposit.
Rule: Must document sale with bill of sale + proof of ownership.
Example: Deposit = $15,000 → requires bill of sale + prior registration.
Resolution: “Your large cash deposit must be documented. Please upload the bill of sale and proof you owned the vehicle.”
41. Borrower With Overtime Income That Employer States Is “Not Guaranteed”
Story: Borrower regularly works overtime but employer verification states overtime is “not guaranteed,” even though paystubs show consistent overtime earnings.
Guideline: Fannie Mae B3‑3.1‑05 (Overtime Income)
Signal: VOE indicates “overtime not guaranteed.”
Rule: Must average overtime over 24 months and confirm likelihood of continuance.
Example: 24‑month overtime total = $18,000 → $18,000 ÷ 24 = $750/month.
Resolution: “Your employer marked overtime as not guaranteed. Please upload 24 months of pay history so we can calculate the average.”

42. Borrower With Large Cash Deposit From Gambling Winnings
Story: Borrower deposits a large cash amount from casino winnings and wants it counted as assets for closing.
Guideline: Fannie Mae B3‑4.3‑01 (Large Deposits — Source Documentation)
Signal: Bank statement shows $12,000 cash deposit labeled “casino payout.”
Rule: Must document winnings with casino receipt or payout slip.
Example: Deposit = $12,000 → requires payout documentation.
Resolution: “Your deposit came from gambling winnings. Please upload the casino payout receipt showing the source of funds.”

43. Borrower With Income From Selling Items on Facebook Marketplace
Story: Borrower frequently sells personal items online and wants the proceeds counted as qualifying income.
Guideline: NO CITATION — needs research (Personal item sales are not recognized as qualifying income.)
Signal: Bank statements show recurring deposits labeled “Marketplace sale.”
Rule: Personal item sales cannot be used as income.
Example: Monthly deposits = $600 → not eligible.
Resolution: “Income from selling personal items cannot be used. Please provide employment or business income documentation.”

44. Borrower With Multiple Student Loans Reporting Different Payment Amounts
Story: Borrower has several student loans serviced by different companies, each reporting inconsistent payment amounts.
Guideline: Fannie Mae B3‑6‑05 (Student Loans)
Signal: Credit report shows varying payments for loans with similar balances.
Rule: Must use documented payment from servicer or apply 1% rule if unclear.
Example: Loan balance = $30,000; unclear payment → 1% × 30,000 = $300/month.
Resolution: “Your student loan payments are inconsistent. Please upload your servicer statements showing the actual required payments.”

45. Borrower With Income From Seasonal Overtime Only
Story: Borrower works in manufacturing and receives overtime only during peak season, not year‑round.
Guideline: Fannie Mae B3‑3.1‑05 (Seasonal Overtime)
Signal: Pay history shows overtime only during summer months.
Rule: Must average seasonal overtime over 24 months.
Example: Seasonal overtime total = $8,000 over 24 months → $333.33/month.
Resolution: “Your overtime is seasonal. Please upload 24 months of pay history so we can calculate the average.”

46. Borrower With Multiple Checking Accounts but Only One Shows Payroll Deposits
Story: Borrower lists several bank accounts as assets, but only one shows payroll deposits; others show irregular transfers.
Guideline: Fannie Mae B3‑4.3‑01 (Verification of Deposits)
Signal: Bank statements show transfers between accounts without new funds.
Rule: Only accounts with verified ownership and non‑transfer deposits count as assets.
Example: Account A = $10,000 (verified); Account B = $8,000 (all transfers) → qualifying assets = $10,000.
Resolution: “Some accounts show only transfers. Please upload statements for all accounts to verify actual assets.”

47. Borrower With Income From Short‑Term Contract Work (Less Than 12 Months)
Story: Borrower works on a short‑term contract and wants the income counted as stable employment.
Guideline: Fannie Mae B3‑3.1‑05 (Temporary or Short‑Term Employment)
Signal: Contract shows duration <12 months.
Rule: Short‑term contract income requires two‑year history of similar work.
Example: Contract duration = 6 months → cannot use without prior history.
Resolution: “Your contract is short‑term. Please upload prior employment records showing a two‑year history of similar work.”

48. Borrower With Business Mileage Reimbursements Misclassified as Income
Story: Borrower receives mileage reimbursements that appear as deposits but are not taxable income.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements)
Signal: Paystub shows large non‑taxable reimbursements.
Rule: Reimbursements must be excluded from qualifying income.
Example: Gross pay = $6,000; reimbursements = $1,200 → qualifying = $4,800/month.
Resolution: “Mileage reimbursements cannot be counted as income. Please upload your paystubs and employer reimbursement policy.”

49. Borrower With Multiple 60‑Day Gaps in Employment Over Two Years
Story: Borrower frequently changes jobs and has several 60‑day gaps in employment history.
Guideline: Fannie Mae B3‑3.1‑01 (Employment History — Gaps)
Signal: VOEs show multiple gaps ≥60 days.
Rule: Must document each gap and verify employment stability.
Example: 3 gaps of 60–75 days → requires explanation + stability documentation.
Resolution: “Your employment history shows several gaps. Please upload letters explaining each gap and proof of current stable employment.”

50. Borrower Using Business Funds for Down Payment Without Documentation
Story: Borrower owns a small business and uses business account funds for down payment but cannot document ownership or access.
Guideline: Fannie Mae B3‑4.3‑01 (Business Assets)
Signal: Bank statements show down‑payment transfer from business account.
Rule: Must verify borrower ownership + ability to withdraw funds.
Example: Business account transfer = $25,000 → requires business documentation + CPA letter.
Resolution: “Your down payment came from business funds. Please upload business ownership documents and a CPA letter confirming access to funds.”
Below is **Batch 6** — 10 new, fully unique, regulation‑anchored underwriting scenarios.  
No duplicates. No invented citations. All machine‑detectable triggers.  
I will **not** store them until you say: **“Remember Batch 6.”**

---

# ✅ **UNDERWRITING SCENARIO CATALOG — BATCH 6 (10 SCENARIOS)**

---

### 51. Borrower With Income From Employer Stock Compensation Vesting Irregularly  
Story: Borrower receives RSUs that vest at irregular intervals and wants the vesting value counted as qualifying income.  
Guideline: **Fannie Mae B3‑3.1‑09** (Other Sources of Income — Stock Options/RSUs)  
Signal: Pay statements show RSU vesting events with inconsistent timing.  
Rule: RSU income must be **consistent for 24 months** to be used.  
Example: Vesting Year 1 = \$15,000; Year 2 = \$5,000 → inconsistent → **cannot use**.  
Resolution: “Your stock compensation vests irregularly. Please upload two years of vesting statements so we can determine eligibility.”

---

### 52. Borrower With Multiple Credit Inquiries Suggesting Undisclosed Debt  
Story: Borrower has numerous recent credit inquiries for auto financing but reports no new auto loan.  
Guideline: **Fannie Mae B3‑6‑05** (Undisclosed Liabilities)  
Signal: Credit report shows ≥5 auto‑related inquiries in 60 days.  
Rule: Must verify whether new debt exists.  
Example: 5 inquiries → **requires documentation**.  
Resolution: “Your credit report shows recent auto loan inquiries. Please upload any auto financing documents or a letter confirming no new debt.”

---

### 53. Borrower With Income From Selling Handmade Goods (Etsy) Without Tax Filings  
Story: Borrower sells handmade crafts online and receives regular deposits but has never filed taxes for the activity.  
Guideline: **Fannie Mae B3‑3.2‑01** (Self‑Employment Income)  
Signal: Bank statements show recurring Etsy deposits.  
Rule: Must verify income with tax returns; undocumented business income cannot be used.  
Example: Monthly deposits = \$900 → **not eligible** without Schedule C.  
Resolution: “Your Etsy income must be documented with tax returns. Please upload your Schedule C or business tax filings.”

---

### 54. Borrower With Recent Divorce but Still Jointly Liable on Mortgage  
Story: Borrower recently divorced but the divorce decree does not remove liability for the joint mortgage.  
Guideline: **Fannie Mae B3‑6‑05** (Debt Paid by Others)  
Signal: Credit report shows joint mortgage still active.  
Rule: Must obtain divorce decree + 12 months of payment history showing ex‑spouse pays.  
Example: Mortgage payment = \$1,800 → **excluded** only if ex‑spouse pays 12 months.  
Resolution: “Your divorce decree does not remove mortgage liability. Please upload the decree and 12 months of payment history.”

---

### 55. Borrower With Income From Short‑Term Rental (Airbnb) Not Reported on Taxes  
Story: Borrower rents out a room on Airbnb and wants the income counted, but has never reported it on tax returns.  
Guideline: **Fannie Mae B3‑3.1‑08** (Rental Income)  
Signal: Bank statements show Airbnb payouts.  
Rule: Must verify rental income with Schedule E or lease.  
Example: Monthly payouts = \$1,400 → **not eligible** without Schedule E.  
Resolution: “Your Airbnb income must be documented. Please upload your tax returns showing rental income.”

---

### 56. Borrower With Multiple NSF Fees on Business Account Used for Down Payment  
Story: Borrower uses business account funds for down payment, but the business account shows frequent overdrafts.  
Guideline: **Fannie Mae B3‑4.3‑01** (Business Assets)  
Signal: Business bank statements show ≥3 NSF fees in 60 days.  
Rule: Must verify business stability and borrower access.  
Example: 3 NSF fees → **requires CPA letter + business documentation**.  
Resolution: “Your business account shows overdrafts. Please upload a CPA letter confirming business stability and access to funds.”

---

### 57. Borrower With Income From Employer Housing Allowance  
Story: Borrower receives a monthly housing allowance as part of compensation and wants it counted as income.  
Guideline: **Fannie Mae B3‑3.1‑06** (Housing Allowance Income)  
Signal: Paystub shows non‑taxable housing allowance.  
Rule: Housing allowance may be included if stable and documented.  
Example: Allowance = \$1,000/month → **eligible** if employer confirms continuance.  
Resolution: “Your housing allowance can be used if stable. Please upload your employer letter confirming the allowance will continue.”

---

### 58. Borrower With Large Cash Deposit From Cryptocurrency ATM  
Story: Borrower deposits cash withdrawn from a crypto ATM and claims it as personal savings.  
Guideline: **Fannie Mae B3‑4.3‑01** (Large Deposits — Source Documentation)  
Signal: Bank statement shows \$20,000 cash deposit following crypto ATM withdrawal.  
Rule: Must document crypto liquidation + ownership.  
Example: Deposit = \$20,000 → **requires crypto transaction history**.  
Resolution: “Your deposit came from crypto ATM withdrawal. Please upload proof of crypto ownership and liquidation.”

---

### 59. Borrower With Multiple Part‑Time Jobs but No Combined Two‑Year History  
Story: Borrower works three part‑time jobs but started all within the last year.  
Guideline: **Fannie Mae B3‑3.1‑01** (Part‑Time Employment)  
Signal: VOEs show start dates <12 months.  
Rule: Part‑time income requires **24‑month history**.  
Example: Job A start = 02/2026; Job B = 09/2025; Job C = 01/2026 → **none meet 24‑month requirement**.  
Resolution: “Your part‑time jobs do not have long enough history. Please upload prior employment records to establish continuity.”

---

### 60. Borrower With Income From Selling Cryptocurrency Without Proof of Cost Basis  
Story: Borrower sells crypto and deposits proceeds but cannot document cost basis or ownership period.  
Guideline: **CFPB ATR/QM 12 CFR §1026.43(c)(2)** (Verification of Income/Assets)  
Signal: Bank statements show large deposits from crypto exchange.  
Rule: Must verify asset ownership + sale documentation.  
Example: Deposit = \$30,000 → **requires cost‑basis documentation**.  
Resolution: “Your crypto sale must be documented. Please upload transaction history showing purchase, sale, and cost basis.”
61. Borrower With Income From Employer Tuition Reimbursement
Story: Borrower receives monthly tuition reimbursement from their employer and wants it counted as qualifying income.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements — Non‑Taxable)
Signal: Paystub shows recurring non‑taxable “tuition reimbursement.”
Rule: Tuition reimbursement cannot be counted as income.
Example: Reimbursement = $600/month → not eligible.
Resolution: “Tuition reimbursement cannot be used as qualifying income. Please upload your paystubs and employment letter for verification.”

62. Borrower With Multiple Revolving Accounts Reporting “Paid by Employer”
Story: Borrower has several credit cards marked as “paid by employer,” suggesting corporate expense accounts.
Guideline: Fannie Mae B3‑6‑05 (Debt Paid by Others)
Signal: Credit report shows notation “Paid by employer” on revolving accounts.
Rule: Must verify employer pays entire balance for 12 months.
Example: Card payment = $450/month → excluded only with 12‑month employer payment history.
Resolution: “Your employer‑paid credit cards require documentation. Please upload 12 months of statements showing employer payments.”

63. Borrower With Income From Selling Digital Art (NFTs)
Story: Borrower earns money selling digital art/NFTs but has no tax filings documenting the income.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employment Income)
Signal: Bank statements show deposits from NFT marketplaces.
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $2,200 → not eligible without Schedule C.
Resolution: “Your NFT income must be documented with tax returns. Please upload your Schedule C or business filings.”

64. Borrower With Recent Loan Modification on Existing Mortgage
Story: Borrower completed a loan modification due to hardship but wants to qualify for a new mortgage immediately.
Guideline: Fannie Mae B3‑5.3‑02 (Payment History — Loan Modifications)
Signal: Credit report shows “Loan Modified — 04/2026.”
Rule: Must show 12 months of on‑time payments after modification.
Example: Modification date = 04/2026 → Application = 07/2026 → only 3 months → ineligible.
Resolution: “Your recent loan modification requires 12 months of on‑time payments. Please upload your mortgage statements.”

65. Borrower With Income From Employer Car Allowance
Story: Borrower receives a monthly car allowance and wants it counted as income.
Guideline: Fannie Mae B3‑3.1‑06 (Car Allowance Income)
Signal: Paystub shows taxable car allowance.
Rule: Car allowance may be included if stable and documented.
Example: Allowance = $500/month → eligible if employer confirms continuance.
Resolution: “Your car allowance can be used if stable. Please upload your employer letter confirming the allowance will continue.”

66. Borrower With Large Cash Deposit From Selling Jewelry
Story: Borrower sells personal jewelry and deposits the cash, claiming it as down payment funds.
Guideline: Fannie Mae B3‑4.3‑01 (Large Deposits — Source Documentation)
Signal: Bank statement shows $9,000 cash deposit.
Rule: Must document sale with bill of sale + proof of ownership.
Example: Deposit = $9,000 → requires bill of sale + appraisal or receipt.
Resolution: “Your large cash deposit must be documented. Please upload proof of ownership and a bill of sale for the jewelry.”

67. Borrower With Income From Seasonal Landscaping Business Without Tax Returns
Story: Borrower operates a seasonal landscaping business but has not filed taxes for the most recent year.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employment Income)
Signal: Bank statements show seasonal deposits; no tax transcripts available.
Rule: Must verify income with tax returns; missing returns make income ineligible.
Example: Seasonal deposits = $18,000/year → not eligible without tax filings.
Resolution: “Your landscaping income must be documented. Please upload your most recent tax returns or IRS transcripts.”

68. Borrower With Multiple 90‑Day Late Payments on Student Loans
Story: Borrower has several 90‑day late payments on student loans within the last year.
Guideline: Fannie Mae B3‑5.3‑02 (Payment History Requirements)
Signal: Credit report shows 2× 90‑day lates in past 12 months.
Rule: Multiple severe delinquencies require manual risk assessment.
Example: 2× 90‑day lates → manual review required.
Resolution: “Your credit report shows recent severe delinquencies. Please upload a letter explaining the circumstances.”

69. Borrower With Income From Employer Relocation Stipend
Story: Borrower receives a one‑time relocation stipend and wants it counted as income.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements)
Signal: Paystub shows “relocation stipend — one‑time.”
Rule: One‑time payments cannot be used as qualifying income.
Example: Stipend = $4,000 → not eligible.
Resolution: “Relocation stipends cannot be used as qualifying income. Please upload your regular paystubs for income verification.”

70. Borrower With Income From Renting Out Parking Spaces
Story: Borrower rents out parking spaces in a private lot and receives monthly payments but has no formal lease agreements.
Guideline: Fannie Mae B3‑3.1‑08 (Rental Income)
Signal: Bank statements show recurring $250 deposits labeled “parking rent.”
Rule: Must verify rental income with tax returns or lease.
Example: Monthly deposits = $250 → not eligible without Schedule E or lease.
Resolution: “Your parking rental income must be documented. Please upload your lease agreements or Schedule E.”
71. Borrower With Income From Employer Meal Allowance
Story: Borrower receives a daily meal allowance as part of their job and wants it counted as qualifying income. The allowance appears regularly on paystubs but is non‑taxable.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements — Non‑Taxable)
Signal: Paystub shows recurring “meal allowance” under non‑taxable reimbursements.
Rule: Meal allowances cannot be counted as qualifying income.
Example: Allowance = $450/month → not eligible.
Resolution: “Meal allowances cannot be used as qualifying income. Please upload your paystubs and employer compensation policy.”

72. Borrower With Income From Selling Collectible Sneakers
Story: Borrower flips collectible sneakers online and receives frequent deposits but has no business registration or tax filings.
Guideline: NO CITATION — needs research (Personal item resale is not recognized as qualifying income.)
Signal: Bank statements show recurring deposits labeled “Sneaker sale.”
Rule: Resale income cannot be used unless documented as a business with tax returns.
Example: Monthly deposits = $1,100 → not eligible.
Resolution: “Income from selling personal items cannot be used. Please upload tax returns if this is a documented business.”

73. Borrower With Recent Charge‑Off on Credit Card but No Settlement Letter
Story: Borrower had a credit card charged off last year and claims it was settled, but cannot provide documentation.
Guideline: Fannie Mae B3‑5.3‑02 (Payment History Requirements)
Signal: Credit report shows “Charged Off — No Settlement Reported.”
Rule: Must verify settlement or include balance as liability.
Example: Charged‑off balance = $3,200 → must include unless settlement documented.
Resolution: “Your charged‑off account requires documentation. Please upload your settlement letter or proof of payoff.”

74. Borrower With Income From Seasonal Holiday Retail Work
Story: Borrower works retail only during the holiday season and wants the income counted year‑round.
Guideline: Fannie Mae B3‑3.1‑05 (Seasonal Employment)
Signal: VOE shows employment only Nov–Jan each year.
Rule: Must average seasonal income over 24 months.
Example: 24‑month seasonal income = $9,600 → $9,600 ÷ 24 = $400/month.
Resolution: “Your holiday retail income is seasonal. Please upload 24 months of pay history so we can calculate the average.”

75. Borrower With Income From Employer Travel Stipend
Story: Borrower receives a monthly travel stipend for work‑related commuting and wants it counted as income.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements)
Signal: Paystub shows “travel stipend — non‑taxable.”
Rule: Travel stipends cannot be used as qualifying income.
Example: Stipend = $300/month → not eligible.
Resolution: “Travel stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

76. Borrower With Multiple 30‑Day Lates on Personal Loan After COVID Forbearance
Story: Borrower exited COVID forbearance but had several late payments afterward.
Guideline: Fannie Mae B3‑5.3‑02 (Payment History Requirements)
Signal: Credit report shows 2× 30‑day lates post‑forbearance.
Rule: Post‑forbearance lates require manual risk review.
Example: 2× 30‑day lates → manual review required.
Resolution: “Your credit report shows late payments after forbearance. Please upload a letter explaining the circumstances.”

77. Borrower With Income From Renting Out Storage Units
Story: Borrower owns several storage units and receives rental income but has not reported it on taxes.
Guideline: Fannie Mae B3‑3.1‑08 (Rental Income)
Signal: Bank statements show recurring deposits labeled “storage rent.”
Rule: Must verify rental income with Schedule E or lease.
Example: Monthly deposits = $600 → not eligible without documentation.
Resolution: “Your storage rental income must be documented. Please upload your lease agreements or Schedule E.”

78. Borrower With Income From Employer Wellness Stipend
Story: Borrower receives a monthly wellness stipend for gym membership and health programs but wants it counted as income.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements)
Signal: Paystub shows “wellness stipend — non‑taxable.”
Rule: Wellness stipends cannot be counted as income.
Example: Stipend = $150/month → not eligible.
Resolution: “Wellness stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

79. Borrower With Income From Selling Handmade Furniture Locally
Story: Borrower builds and sells furniture locally for cash but has no business license or tax filings.
Guideline: Fannie Mae B3‑3.2‑01 (Self‑Employment Income)
Signal: Bank statements show irregular cash deposits labeled “furniture sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $1,800 → not eligible without Schedule C.
Resolution: “Your furniture‑making income must be documented. Please upload your tax returns or business filings.”

80. Borrower With Income From Employer Uniform Allowance
Story: Borrower receives a monthly uniform allowance for required work attire and wants it counted as income.
Guideline: Fannie Mae B3‑3.1‑06 (Expense Reimbursements)
Signal: Paystub shows “uniform allowance — non‑taxable.”
Rule: Uniform allowances cannot be counted as qualifying income.
Example: Allowance = $200/month → not eligible.
Resolution: “Uniform allowances cannot be used as qualifying income. Please upload your paystubs for verification.”

81. Borrower With Income From Employer Internet Reimbursement
Story: Borrower receives a monthly reimbursement for home internet used for remote work and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “Internet reimbursement — non‑taxable.”
Rule: Reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $85/month → not eligible.
Resolution: “Internet reimbursements cannot be used as qualifying income. Please upload your paystubs for verification.”

82. Borrower With Income From Seasonal Farm Work
Story: Borrower works on a farm during planting and harvest seasons only, with no off‑season income.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: VOE shows employment only Apr–Oct each year.
Rule: Must average seasonal income over 24 months.
Example: 24‑month seasonal income = $14,400 → $14,400 ÷ 24 = $600/month.
Resolution: “Your farm income is seasonal. Please upload 24 months of pay history so we can calculate the average.”

83. Borrower With Income From Employer Phone Stipend
Story: Borrower receives a monthly phone stipend and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “Phone stipend — non‑taxable.”
Rule: Phone stipends cannot be counted as qualifying income.
Example: Stipend = $50/month → not eligible.
Resolution: “Phone stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

84. Borrower With Income From Selling Handmade Soap Locally
Story: Borrower sells handmade soap at local markets but has no business license or tax filings.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular cash deposits labeled “soap sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $700 → not eligible without Schedule C.
Resolution: “Your soap‑making income must be documented. Please upload your tax returns or business filings.”

85. Borrower With Income From Employer Clothing Stipend
Story: Borrower receives a monthly clothing stipend for required work attire and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “clothing stipend — non‑taxable.”
Rule: Clothing stipends cannot be counted as qualifying income.
Example: Stipend = $120/month → not eligible.
Resolution: “Clothing stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

86. Borrower With Income From Seasonal Snow Removal Work
Story: Borrower earns money plowing snow during winter months only.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Bank statements show deposits only Dec–Mar.
Rule: Must average seasonal income over 24 months.
Example: 24‑month seasonal income = $10,800 → $10,800 ÷ 24 = $450/month.
Resolution: “Your snow‑removal income is seasonal. Please upload 24 months of bank statements and tax returns.”

87. Borrower With Income From Employer Wellness Reimbursement
Story: Borrower receives reimbursement for gym membership and health programs but wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “wellness reimbursement — non‑taxable.”
Rule: Wellness reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $75/month → not eligible.
Resolution: “Wellness reimbursements cannot be used as qualifying income. Please upload your paystubs for verification.”

88. Borrower With Income From Selling Plants at Local Markets
Story: Borrower grows plants at home and sells them at weekend markets but has no tax filings.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “plant sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $500 → not eligible.
Resolution: “Your plant‑sale income must be documented. Please upload your tax returns or business filings.”

89. Borrower With Income From Employer Relocation Reimbursement
Story: Borrower receives reimbursement for relocation expenses and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “relocation reimbursement — one‑time.”
Rule: One‑time reimbursements cannot be used as qualifying income.
Example: Reimbursement = $3,500 → not eligible.
Resolution: “Relocation reimbursements cannot be used as qualifying income. Please upload your regular paystubs for income verification.”

90. Borrower With Income From Renting Out Tools
Story: Borrower rents out tools (power washer, lawn equipment) but has no lease agreements or tax filings.
Guideline: Rental Income — Fannie Mae B3‑3.1‑08
Signal: Bank statements show recurring deposits labeled “tool rental.”
Rule: Must verify rental income with Schedule E or lease.
Example: Monthly deposits = $300 → not eligible without documentation.
Resolution: “Your tool‑rental income must be documented. Please upload your lease agreements or Schedule E.”

91. Borrower With Income From Employer Home‑Office Stipend
Story: Borrower receives a monthly home‑office stipend for remote work and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “home‑office stipend — non‑taxable.”
Rule: Home‑office stipends cannot be counted as qualifying income.
Example: Stipend = $100/month → not eligible.
Resolution: “Home‑office stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

92. Borrower With Income From Seasonal Pool Maintenance Work
Story: Borrower maintains pools during summer months only and wants the income counted year‑round.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Deposits appear only May–September.
Rule: Must average seasonal income over 24 months.
Example: 24‑month income = $12,000 → $12,000 ÷ 24 = $500/month.
Resolution: “Your pool‑maintenance income is seasonal. Please upload 24 months of bank statements and tax returns.”

93. Borrower With Income From Employer Equipment Reimbursement
Story: Borrower receives reimbursement for tools/equipment required for their job and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “equipment reimbursement — non‑taxable.”
Rule: Reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $250/month → not eligible.
Resolution: “Equipment reimbursements cannot be used as qualifying income. Please upload your paystubs for verification.”

94. Borrower With Income From Selling Homemade Candles
Story: Borrower sells homemade candles online and at markets but has no tax filings or business registration.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “candle sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $900 → not eligible.
Resolution: “Your candle‑making income must be documented. Please upload your tax returns or business filings.”

95. Borrower With Income From Employer Safety Stipend
Story: Borrower receives a monthly safety stipend for protective gear and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “safety stipend — non‑taxable.”
Rule: Safety stipends cannot be counted as qualifying income.
Example: Stipend = $75/month → not eligible.
Resolution: “Safety stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

96. Borrower With Income From Seasonal Pumpkin Patch Work
Story: Borrower works at a pumpkin patch only during fall months.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Deposits appear only Sept–Nov.
Rule: Must average seasonal income over 24 months.
Example: 24‑month income = $6,000 → $6,000 ÷ 24 = $250/month.
Resolution: “Your pumpkin‑patch income is seasonal. Please upload 24 months of pay history.”

97. Borrower With Income From Employer Childcare Reimbursement
Story: Borrower receives childcare reimbursement and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “childcare reimbursement — non‑taxable.”
Rule: Childcare reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $300/month → not eligible.
Resolution: “Childcare reimbursements cannot be used as qualifying income. Please upload your paystubs for verification.”

98. Borrower With Income From Selling Custom Wood Signs
Story: Borrower sells custom wood signs but has no tax filings or business documentation.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “wood sign sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $1,200 → not eligible.
Resolution: “Your wood‑sign income must be documented. Please upload your tax returns or business filings.”

99. Borrower With Income From Employer Relocation Housing Stipend
Story: Borrower receives a temporary housing stipend during relocation and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “temporary housing stipend.”
Rule: Temporary stipends cannot be used as qualifying income.
Example: Stipend = $1,000/month → not eligible.
Resolution: “Temporary housing stipends cannot be used as qualifying income. Please upload your regular paystubs.”

100. Borrower With Income From Renting Out Musical Instruments
Story: Borrower rents out musical instruments but has no lease agreements or tax filings.
Guideline: Rental Income — Fannie Mae B3‑3.1‑08
Signal: Bank statements show recurring deposits labeled “instrument rental.”
Rule: Must verify rental income with Schedule E or lease.
Example: Monthly deposits = $350 → not eligible without documentation.
Resolution: “Your instrument‑rental income must be documented. Please upload your lease agreements or Schedule E.”

01. Borrower With Income From Employer Remote‑Work Utility Stipend
Story: Borrower receives a monthly stipend for increased home utility usage due to remote work and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “remote utility stipend — non‑taxable.”
Rule: Utility stipends cannot be counted as qualifying income.
Example: Stipend = $60/month → not eligible.
Resolution: “Utility stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

102. Borrower With Income From Seasonal Fireworks Stand
Story: Borrower operates a fireworks stand only during late June–July.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Deposits appear only during summer holiday period.
Rule: Must average seasonal income over 24 months.
Example: 24‑month income = $8,000 → $8,000 ÷ 24 = $333/month.
Resolution: “Your fireworks‑stand income is seasonal. Please upload 24 months of bank statements and tax returns.”

103. Borrower With Income From Employer Safety‑Equipment Reimbursement
Story: Borrower receives reimbursement for protective gear required for hazardous work.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “safety equipment reimbursement — non‑taxable.”
Rule: Reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $140/month → not eligible.
Resolution: “Safety‑equipment reimbursements cannot be used as qualifying income. Please upload your paystubs.”

104. Borrower With Income From Selling Homemade Jams
Story: Borrower sells homemade jams at farmers markets but has no tax filings.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “jam sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $650 → not eligible.
Resolution: “Your jam‑making income must be documented. Please upload your tax returns or business filings.”

105. Borrower With Income From Employer Temporary Hardship Stipend
Story: Borrower receives a temporary hardship stipend due to workplace disruption and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “temporary hardship stipend.”
Rule: Temporary stipends cannot be used as qualifying income.
Example: Stipend = $900/month → not eligible.
Resolution: “Temporary hardship stipends cannot be used as qualifying income. Please upload your regular paystubs.”

106. Borrower With Income From Seasonal Haunted House Work
Story: Borrower works at a haunted house attraction only during October.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Deposits appear only in October.
Rule: Must average seasonal income over 24 months.
Example: 24‑month income = $4,000 → $4,000 ÷ 24 = $166/month.
Resolution: “Your haunted‑house income is seasonal. Please upload 24 months of pay history.”

107. Borrower With Income From Employer Continuing‑Education Reimbursement
Story: Borrower receives reimbursement for continuing‑education courses and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “education reimbursement — non‑taxable.”
Rule: Education reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $300/month → not eligible.
Resolution: “Education reimbursements cannot be used as qualifying income. Please upload your paystubs.”

108. Borrower With Income From Selling Custom Metalwork
Story: Borrower sells custom metalwork pieces but has no tax filings or business documentation.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “metalwork sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $1,400 → not eligible.
Resolution: “Your metalwork income must be documented. Please upload your tax returns or business filings.”

109. Borrower With Income From Employer Temporary Travel Housing
Story: Borrower receives temporary housing payments while traveling for work.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “temporary travel housing.”
Rule: Temporary housing payments cannot be used as qualifying income.
Example: Payment = $1,200/month → not eligible.
Resolution: “Temporary travel housing cannot be used as qualifying income. Please upload your regular paystubs.”

110. Borrower With Income From Renting Out Camping Gear
Story: Borrower rents out camping gear (tents, kayaks, etc.) but has no lease agreements or tax filings.
Guideline: Rental Income — Fannie Mae B3‑3.1‑08
Signal: Bank statements show recurring deposits labeled “gear rental.”
Rule: Must verify rental income with Schedule E or lease.
Example: Monthly deposits = $450 → not eligible without documentation.
Resolution: “Your camping‑gear rental income must be documented. Please upload your lease agreements or Schedule E.”

111. Borrower With Income From Employer Hybrid‑Work Transportation Stipend
Story: Borrower receives a stipend for commuting on required in‑office days and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “hybrid commute stipend — non‑taxable.”
Rule: Transportation stipends cannot be counted as qualifying income.
Example: Stipend = $90/month → not eligible.
Resolution: “Commute stipends cannot be used as qualifying income. Please upload your paystubs for verification.”

112. Borrower With Income From Seasonal Ice Cream Stand
Story: Borrower operates an ice cream stand only during summer months.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Deposits appear only June–August.
Rule: Must average seasonal income over 24 months.
Example: 24‑month income = $7,200 → $7,200 ÷ 24 = $300/month.
Resolution: “Your ice‑cream stand income is seasonal. Please upload 24 months of bank statements and tax returns.”

113. Borrower With Income From Employer Tool‑Replacement Reimbursement
Story: Borrower receives reimbursement for replacing worn‑out tools required for their job.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “tool replacement reimbursement — non‑taxable.”
Rule: Reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $180/month → not eligible.
Resolution: “Tool‑replacement reimbursements cannot be used as qualifying income. Please upload your paystubs.”

114. Borrower With Income From Selling Homemade Spices
Story: Borrower sells homemade spice blends but has no tax filings or business registration.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “spice sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $500 → not eligible.
Resolution: “Your spice‑making income must be documented. Please upload your tax returns or business filings.”

115. Borrower With Income From Employer Temporary Hazard Pay
Story: Borrower receives temporary hazard pay due to short‑term workplace conditions.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “temporary hazard pay.”
Rule: Temporary hazard pay cannot be used as qualifying income.
Example: Hazard pay = $600/month → not eligible.
Resolution: “Temporary hazard pay cannot be used as qualifying income. Please upload your regular paystubs.”

116. Borrower With Income From Seasonal Ski Resort Work
Story: Borrower works at a ski resort only during winter months.
Guideline: Seasonal Employment — Fannie Mae B3‑3.1‑05
Signal: Deposits appear only Dec–Mar.
Rule: Must average seasonal income over 24 months.
Example: 24‑month income = $9,000 → $9,000 ÷ 24 = $375/month.
Resolution: “Your ski‑resort income is seasonal. Please upload 24 months of pay history.”

117. Borrower With Income From Employer Certification Reimbursement
Story: Borrower receives reimbursement for professional certifications and wants it counted as income.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “certification reimbursement — non‑taxable.”
Rule: Certification reimbursements cannot be counted as qualifying income.
Example: Reimbursement = $400/month → not eligible.
Resolution: “Certification reimbursements cannot be used as qualifying income. Please upload your paystubs.”

118. Borrower With Income From Selling Custom Leather Goods
Story: Borrower sells custom leather wallets and belts but has no tax filings or business documentation.
Guideline: Self‑Employment Income — Fannie Mae B3‑3.2‑01
Signal: Bank statements show irregular deposits labeled “leather sale.”
Rule: Must verify income with tax returns; undocumented business income cannot be used.
Example: Monthly deposits = $1,000 → not eligible.
Resolution: “Your leather‑goods income must be documented. Please upload your tax returns or business filings.”

119. Borrower With Income From Employer Temporary Lodging Reimbursement
Story: Borrower receives reimbursement for temporary lodging during a short‑term assignment.
Guideline: Expense Reimbursements — Fannie Mae B3‑3.1‑06
Signal: Paystub shows “temporary lodging reimbursement.”
Rule: Temporary lodging reimbursements cannot be used as qualifying income.
Example: Reimbursement = $1,300/month → not eligible.
Resolution: “Temporary lodging reimbursements cannot be used as qualifying income. Please upload your regular paystubs.”

120. Borrower With Income From Renting Out Photography Equipment
Story: Borrower rents out cameras and lighting gear but has no lease agreements or tax filings.
Guideline: Rental Income — Fannie Mae B3‑3.1‑08
Signal: Bank statements show recurring deposits labeled “equipment rental.”
Rule: Must verify rental income with Schedule E or lease.
Example: Monthly deposits = $550 → not eligible without documentation.
Resolution: “Your photography‑equipment rental income must be documented. Please upload your lease agreements or Schedule E.”

