---
name: seo-content
description: Use when creating or editing public marketing/SEO surfaces — persona landing pages, education/blog articles, glossary, affordability/buying-power tools, sitemap, or page metadata. Covers the advertising-compliance rails (Reg Z trigger terms, Reg N no-approval language, TCPA lead consent) and the pre-license gate.
---

# Public SEO / marketing content

Fast-start router. **Authoritative reference:** [`kb/L2_COMPLIANCE_AND_LOGIC.md`](../../../knowledge-base/L2_COMPLIANCE_AND_LOGIC.md) (advertising guardrails), [`kb/research/gtm/`](../../../knowledge-base/research/gtm/) (positioning), [`app-guide/07-frontend.md`](../../../knowledge-base/handbook/app-guide/07-frontend.md), and design rules in [`design_guidelines.md`](../../../knowledge-base/handbook/design/design_guidelines.md). Those win on conflict.

## Non-negotiables (advertising compliance — hard stops)
- **Reg Z trigger terms:** a rate, payment amount, term length, or "as low as X%" on a public page triggers required TILA disclosures. If you can't attach the full disclosure, **don't state the number** — use ranges/qualitative framing.
- **Reg N / UDAAP:** never present tool output as an approval, pre-approval, or guarantee. Tools produce **estimates** and **strength readouts**, not decisions (e.g. Approval Strength, Buying Power).
- **TCPA at capture:** lead forms require consent evidence (TrustedForm) and go through `POST /api/leads` (rate-limited). The `leads` table stores **no SSN/DOB**.
- **Pre-license gate:** every soliciting surface renders behind `server/services/prelaunchGate.ts` until F1 (NMLS licensing). Don't remove or bypass the gate. The separate front-door beta gate is `server/middleware/betaGate.ts` — in-process Express middleware (it replaced the platform edge middleware in the Railway migration), so both gates are now plain server code, not hosting config.
- **Copy tripwires:** follow the discipline in `tests/leadNotifications.test.ts` — zero rate/APR/payment figures and zero approval language in acknowledgements and auto-copy.

## Where it lives
- **Persona LPs:** `client/src/pages/public/{Refinance,VALoans,SelfEmployed,FirstTimeBuyer,ApprovalStrength,AffordabilityCheck}.tsx` (wordmark-only, no global nav).
- **Education / blog:** `client/src/pages/education/` (LearningCenter, ArticleDetail, Glossary, DownPaymentWizard, FAQ, Resources).
- **SEO infra:** `client/src/components/SEOHead.tsx` (per-page meta); sitemap is **DB-driven** via `server/routes/seo.ts` (#91 — there is no static `client/public/sitemap.xml`); JSON-LD lives in the same route family, and bot prerender/head-injection is in-process Express middleware at `server/prerender.ts`. Gotcha: there is **no rewrite/CDN/edge layer** to configure — one Node process serves the API and the static client (`express.static` + SPA catch-all), so a public page is only as reachable as that server's routing. A DB-backed surface can 500 while `/api/health` still returns 200 (its `SELECT 1` can succeed against the wrong database — 2026-08-06); check `/sitemap.xml` and an article route directly after any deploy that touches content.
- **Data moat (content backing):** [`kb/specs/FREE_DATA_MOAT.md`](../../../knowledge-base/specs/FREE_DATA_MOAT.md).
