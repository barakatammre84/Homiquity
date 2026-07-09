---
name: mortgage-calculations
description: Use when building or changing mortgage math — affordability, payment/PITI, rent-vs-buy, refinance, DTI, credit-tier, LLPA/pricing, or any underwriting-decision calculation. Covers the determinism and compliance-citation rules and where the calculators, pricing, and underwriting engines live.
---

# Mortgage calculations & the decision engines

Fast-start router. **Authoritative reference:** [`kb/compliance/UNDERWRITING_SCENARIOS.md`](../../../knowledge-base/compliance/UNDERWRITING_SCENARIOS.md) (scenario catalog + the no-citation-no-implementation contract), [`app-guide/08-services.md`](../../../knowledge-base/handbook/app-guide/08-services.md), and CLAUDE.md's compliance-first section. Those win on conflict.

## Non-negotiables
- **Determinism:** the engines (`server/underwritingEngine.ts`, `server/services/decisionEngine.ts`, `server/services/ruleEngine.ts`) are pure — same inputs, same outcome, typed error classification. No randomness, no vendor calls, no AI inside them. Keep it that way.
- **No citation, no implementation:** every regulated calculation cites its source (Fannie B-guideline, VA Pamphlet 26-7, QM threshold). **Never invent** thresholds, MISMO names, or enumerations — verify against [`docs/fannie-mae/`](../../../docs/fannie-mae/) + the Loan Delivery job aid, and use `shared/fannieMae/qmThresholds.ts` for QM points-and-fees / APR-APOR spreads.
- **Reg B:** calculation math **never** touches an AI service.
- **Vendors through adapters only:** credit scores / AVM values arrive via their adapter functions (deterministic simulations until contracts). Never call a vendor outside its adapter.

## Where it lives
- **Client:** `client/src/hooks/useAffordability.ts`; `client/src/pages/calculators/{AffordabilityCalculator,MortgageCalculator,RentVsBuyCalculator,RentToOwnReadiness}.tsx`.
- **Server routes:** `server/routes/calculators.ts` (`GET /api/calculators/credit-tiers`, `POST /api/calculators/extract-lease`).
- **Pricing / LLPA:** `server/pricing.ts` (`calculateLLPA`), seam at `server/services/pricingAdapter.ts` (never price around it).
- **Underwriting:** `server/underwritingEngine.ts` + `services/decisionEngine.ts`, `ruleEngine.ts`.
- **QM thresholds:** `shared/fannieMae/qmThresholds.ts`.

Guard the determinism with a vitest test — same inputs must produce the same outcome.
