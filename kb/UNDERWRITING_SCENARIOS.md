# Underwriting Scenarios Registry

**What this is:** the living catalog of borrower scenarios the platform handles deterministically — and the intake queue for new ones. Add a scenario to the **Backlog** below (any format — a story, a pasted strategy doc, a guideline reference) and the daily guardian run picks it up, implements it, tests it against your stated numbers, and moves it to **Implemented**.

**The compliance contract (non-negotiable, enforced by `tests/complianceInvariants.test.ts`):**
1. Every rule must cite its governing guideline (Fannie/Freddie Selling Guide section, VA Pamphlet chapter, CFPB regulation). **No citation → not implemented** (it goes to *Needs Clarification* instead).
2. All decision math is **deterministic and server-side** — pure functions in `server/services/underwritingNuance.ts` (or a sibling module), unit-tested against the scenario's own numbers. AI never computes an approval, denial, rate, or ratio (Reg B / ECOA).
3. Flags surface through the existing signal fabric: `pre_uw_flags` → borrower chip + "Strengthen your file" action + staff badges + LO signals queue. New scenarios extend `PreUwFlagCode`, never bypass it.
4. Resolutions are borrower-first: the flag's reason names the exact numbers and the exact documents/actions that resolve it.
5. Credit pulls stay FCRA-consent-gated; disclosures stay ESIGN/Reg-Z-gated; nothing weakens an existing gate.

---

## Generating scenarios with an LLM (Gemini/other)

Paste this prompt into the generating model so its output arrives implementation-ready:

```
You are a Senior Mortgage Credit Underwriter documenting borrower scenarios
for a deterministic underwriting engine. Output ONLY scenario specifications
in exactly this format — no code, no file names, no architecture advice:

### <Scenario Name>
Story: <2-3 sentences: who the borrower is and what makes them non-standard>
Guideline: <the exact governing citation — Fannie Mae Selling Guide section
  (e.g. B3-6-05), Freddie Mac Guide section, VA Pamphlet 26-7 chapter,
  FHA Handbook 4000.1 section, or CFPB regulation (e.g. 12 CFR §1026.43).
  If no citation exists, say "NO CITATION — needs research" instead of guessing.>
Signal: <what data reveals this — an application answer, credit report
  tradeline attribute, bank transaction pattern, or employment record>
Rule: <the deterministic threshold or formula, with ONE fully worked numeric
  example (inputs → calculation → result). This example becomes the unit test.>
Resolution: <the exact borrower-facing message and the specific documents or
  actions that resolve it>

Rules: never invent guideline citations; flag uncertainty explicitly. Prefer
scenarios where the trigger is machine-detectable from application data,
credit tradelines, or bank transactions.
```

Why these fields: the **Guideline** is the compliance gate (no citation → Needs
Clarification, never code); the **Rule's worked example** becomes the literal
unit test; the **Signal** maps to our data spine (intake answers,
`credit_pulls.liabilities`, `verification_reports.raw_payload` transactions);
code/architecture output from the generating model is discarded — the
engineering pattern lives here, not in the scenario.

## Scenario template (copy for new entries)

```
### S-XX: <Name>
Status: Proposed
Story: <who the borrower is and what makes them non-standard>
Guideline: <e.g., Fannie Mae Selling Guide B3-x.x / VA 26-7 Ch. 4 / 12 CFR §1026.xx>
Signal: <what data reveals it — intake field, credit tradeline, asset transaction, webhook>
Rule: <the deterministic math or threshold, with worked numbers if possible>
Resolution: <the exact borrower-facing message / document request / what-if>
```

---

## Implemented

### S-01: Hybrid W-2 / Self-Employed Creator (income seasoning)
- **Status:** Implemented 2026-07-03 (commit 1e189b2)
- **Guideline:** Fannie Mae Selling Guide B3-3.2 (24-month seasoning; 12–24 conditional)
- **Engine:** `assessIncomeSeasoning` + `incomeDiscrepancyPct` in [underwritingNuance.ts](../server/services/underwritingNuance.ts) → flag `INCOME_SEASONING` (blocking <12mo, warning 12–24mo)
- **Signal source:** intake `incomeSources[].yearsInRole`; discrepancy delta armed for verified income when Truv/Argyle lands
- **Tests:** `tests/underwritingNuance.test.ts` (14-month conditional case matches the source doc)
- **Verified live:** 14-month self-employment consulting income → warning flag with 1040s resolution path

### S-02: Relocating Military Veteran (VA residual income)
- **Status:** Implemented 2026-07-03 — engine complete; wired at URLA/AUS stage (needs sqft + household size, which intake doesn't collect)
- **Guideline:** VA Pamphlet 26-7 Chapter 4 (residual matrix; $0.14/sqft utilities; 120% cushion when DTI >41%)
- **Engine:** `computeVaResidualIncome`, `vaResidualBaseline`, `VA_RESIDUAL_MATRIX` in underwritingNuance.ts
- **Tests:** reproduce the source doc exactly (South/family-of-4 = $1,003 baseline; 2,500 sqft = $350 utilities; cushion target $1,203.60)
- **Related:** VA zero-down funnel path + PMI suppression shipped earlier (funnel machine `vaZeroDown`)

### S-03: The "Sleeper Debt" Trap (undisclosed liabilities)
- **Status:** Implemented 2026-07-03 (commit 1e189b2)
- **Guideline:** Fannie Mae Selling Guide B3-6-05 (deferred student loans at 1% of balance; new tradelines counted)
- **Engine:** `adjustLiabilities` + `computeWhatIfPayoff` → flag `VERIFIED_DEBT_DTI` with the smallest-single-payoff coaching suggestion
- **Signal source:** `credit_pulls.liabilities` (machine-readable ledger written by every pull)
- **Tests:** reproduce the source doc ($200 + 1% × $60,000 + $50 = $850; DTI 32% → 46%)
- **Verified live:** fresh retail line → DTI 43.4% flag with "pay off $2,380 Wayfair balance → 42.7%" what-if

### S-04: The "Mattress Money" Gift Fund (asset sourcing)
- **Status:** Implemented 2026-07-03 (commit 1e189b2)
- **Guideline:** Fannie Mae Selling Guide B3-4.3-04 (single deposits >50% of monthly qualifying income must be sourced)
- **Engine:** `detectSignificantDeposits` → flag `LARGE_DEPOSIT_SOURCING` with gift-letter/sourcing resolution
- **Signal source:** `verification_reports.raw_payload.transactions` (VOA depository transactions)
- **Tests:** reproduce the source doc ($12,000 deposit vs $3,000 threshold at $6,000/mo income)
- **Verified live:** $9,482 simulated deposit vs $5,000 threshold → flag raised through the webhook path
- **Future depth:** automated e-sign gift-letter generation with donor link (blocked on e-signature provider + SendGrid)

### Foundation scenarios (shipped before the registry existed)
- **Low reserves** (`LOW_RESERVES_WARNING`): post-closing reserves < 2 months PITI from verified assets — auto-condition + outreach
- **Complex income** (`COMPLEX_INCOME_CHECK`): self-employed → 2-year tax-return conditions gate clear-to-close
- **VA zero-down funnel path**: military status asked before down payment; $0 down gated to VA-eligible purchases; PMI guidance suppressed
- **Anti-steering, eDisclosure, FCRA consent gates**: see [LENDER_READINESS_GAP_ANALYSIS.md](LENDER_READINESS_GAP_ANALYSIS.md)

---

## Backlog (add new scenarios here — the daily guardian processes them)

*(empty — paste the next scenario using the template above; a citation-free story is fine to paste, but it will land in Needs Clarification with specific questions rather than being implemented)*

---

## Needs Clarification

*(scenarios the guardian declined to implement pending answers — each entry lists the specific missing pieces, typically the guideline citation or the deterministic threshold)*
