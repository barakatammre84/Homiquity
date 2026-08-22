---
name: mortgage-calculations
description: Use when building or changing mortgage math — affordability, payment/PITI, rent-vs-buy, refinance, DTI, credit-tier, LLPA/pricing, or any underwriting-decision calculation. Covers the determinism and compliance-citation rules and where the calculators, pricing, and underwriting engines live.
---

# Mortgage calculations & the decision engines

Fast-start router. **Authoritative reference:** [`knowledge-base/compliance/UNDERWRITING_SCENARIOS.md`](../../../knowledge-base/compliance/UNDERWRITING_SCENARIOS.md) (scenario catalog + the no-citation-no-implementation contract), [`app-guide/08-services.md`](../../../knowledge-base/handbook/app-guide/08-services.md), and CLAUDE.md's compliance-first section. Those win on conflict. **The Selling Guide governs Fannie policy** — edition 08-05-2026 at [`docs/fannie-mae/selling-guide/`](../../../docs/fannie-mae/selling-guide/); it controls over every job aid, and a section id that does not resolve in `section-index.tsv` is a wrong cite, not an old one. Cite the section for every eligibility, income, credit, DTI or reserve rule you touch.

## Working alongside other sessions
Other sessions (and the owner) edit this repo concurrently. Before you pick a file: `git fetch origin`, read what merged since you last looked, and treat **any file in another session's open PR as claimed** — pick something else rather than planning to rebase. Open PRs from a base ≤2 commits behind `main`. When work is already in flight, prefer helping it land — fix a red CI, verify an unreviewed PR, supply a missing test — over opening another. Authoritative contract: [`routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md) (claim lock §5, honesty rails §10). Standing rule for this domain: extract calculator math to a pure `client/src/lib/<name>Estimate.ts` with a colocated test, characterization-test-first.

## Non-negotiables
- **Determinism:** the engines (`server/underwritingEngine.ts`, `server/services/decisionEngine.ts`, `server/services/ruleEngine.ts`) are pure — same inputs, same outcome, typed error classification. No randomness, no vendor calls, no AI inside them. Keep it that way.
- **No citation, no implementation:** every regulated calculation cites its source (Fannie B-guideline, VA Pamphlet 26-7, QM threshold). **Never invent** thresholds, MISMO names, or enumerations — verify the policy against the committed Selling Guide (`grep -n "B3-6-05" docs/fannie-mae/selling-guide/section-index.tsv` for the page, then read it out of `selling-guide-text.txt`) and MISMO/delivery mechanics against the job aids in [`docs/fannie-mae/`](../../../docs/fannie-mae/) — the online Loan Delivery job aid returns 403, so treat it as unavailable rather than as a step you can run. 🚨 A value read out of a **table** is unverified until you open the PDF page. Also and use `shared/fannieMae/qmThresholds.ts` for QM points-and-fees / APR-APOR spreads.
- **Reg B:** calculation math **never** touches an AI service.
- **Vendors through adapters only:** credit scores / AVM values arrive via their adapter functions (deterministic simulations until contracts). Never call a vendor outside its adapter.
- **Public / pre-launch surface (BUILD-1):** the calculators render **even in gated pre-launch mode** (`client/src/components/Navigation.tsx`, `client/src/pages/public/Waitlist.tsx`), so they sit under the advertising rails — free *estimate* calculators are fine, but **priced calculators and apply CTAs stay off the pre-license surface** (Reg Z trigger terms). See the `seo-content` skill for the full rail set.

## Where it lives
- **Client (mostly pure, client-side math):** hub at `client/src/pages/calculators/CalculatorsHub.tsx` (`/calculators`) fronting 9 public calculators (`/calculators/*`, wrapped in `PageShell`) — Affordability, Mortgage, Amortization, MortgagePayoff, DownPayment, HomeEquity, RentVsBuy, RentToOwnReadiness, plus military BAH; shared inputs via `client/src/hooks/useAffordability.ts`.
  - **House shape — math out of the page component.** A calculator's math belongs in a pure `client/src/lib/<name>Estimate.ts` (exported inputs/results types + `defaultInputs` + one pure function), with a colocated `*.test.ts` pinning values to the cent; the `.tsx` keeps only JSX, state, and mutations. Done: `affordabilityEstimate.ts`, `rentVsBuyEstimate.ts` (#481). **Still inline (candidates, largest first):** Amortization, Mortgage, MortgagePayoff, Bah, DownPayment, HomeEquity. When extracting, write the characterization test against the *current* inline location and see it green BEFORE moving — that is what makes the move provably behavior-preserving.
- **Server routes:** `server/routes/calculators.ts` — only `GET /api/calculators/credit-tiers` and `POST /api/calculators/extract-lease` (the calculator pages themselves add no server endpoints; the math is client-side).
- **Pricing / LLPA:** `server/pricing.ts` (`calculateLLPA`), seam at `server/services/pricingAdapter.ts` (never price around it).
- **Underwriting:** `server/underwritingEngine.ts` + `services/decisionEngine.ts`, `ruleEngine.ts`.
- **QM thresholds:** `shared/fannieMae/qmThresholds.ts`.

Guard the determinism with a vitest test — same inputs must produce the same outcome.
