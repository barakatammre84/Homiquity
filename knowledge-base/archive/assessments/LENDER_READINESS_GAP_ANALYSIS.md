# Lender-Readiness Gap Analysis

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**Date:** 2026-07-03 · **Lens:** what a wholesale lender's technical/compliance review would find
**Companion docs:** [STATE_OF_THE_PLATFORM.md](./STATE_OF_THE_PLATFORM.md) (general platform assessment) · [CTO_ROADMAP.md](../../../CTO_ROADMAP.md) (the living checklist — items L1–L5 added from this analysis)

> **⚠️ PARTIALLY SUPERSEDED (2026-07-03):** the H1/H2/H3 "recommended sprint" below **has since shipped** — funnel consent persisted (L1), `requireConsent` gate wired + tested (L2), anti-steering disclosure built (L3), plus upload→condition matching (L4/M1) and borrower LLPA transparency (L5/M5). Commits `4d3cc29`, `3211e09`. **For current status, trust [CTO_ROADMAP.md](../../../CTO_ROADMAP.md), not this doc.** **2026-07-04 update:** every "does not exist" claim in the body below is superseded — anti-steering lives in `server/consentGate.ts`, uploads went presigned-only (PR #44). The remaining P0s are ops-only: GCS/SendGrid env vars in Vercel (LS-2).

## Scorecard: the "vendor-ready" pillars vs. reality

| Pillar | Status | Evidence |
|---|---|---|
| MISMO 3.4 export | ✅ **Built & verified** | `generateMISMO34XML` (server/mismo.ts): MERS MIN w/ Luhn check digit, ULDD validator, `BorrowerSSNIdentifier` from URLA data, namespaced XML verified well-formed via parser; one-click staff download in BorrowerFile; per-application deal-team access control; export audit-logged |
| Pre-underwriting validator | ✅ **Built (2026-07-03)** | `server/services/preUnderwriting.ts` — verified-asset reserves check, complex-income flags, auto conditions, hash-deduplicated borrower outreach; runs at intake + VOA arrival |
| LLPA engine | ✅ Server-side / ⚠️ borrower display | `calculateLLPA` (server/pricing.ts) returns full component breakdown (base matrix, property type, condo, occupancy, FTHB waiver, fee amount). **Not surfaced to the borrower** on LoanOptions |
| ESIGN consent ledger | ✅ Infrastructure / ⚠️ enforcement | `consent_templates` (versioned, state-specific, regulatory refs) + `borrower_consents` (IP, user agent, browser fingerprint, **SHA-256 content hash**, revocation) + endpoints incl. `GET /api/consents/check/:applicationId/:consentType`. FCRA credit consent flow separately complete (`credit_consents` + CreditConsent page). **Gaps: nothing enforces the check; funnel's soft-pull checkbox isn't persisted to the ledger** |
| Secure document vault | ✅ Architecture / ❌ credentials | Presigned-URL flow keeps PII bytes off the server (and out of server logs — only object keys are logged); GCS bucket/credentials **not configured anywhere**, legacy multer path still present |
| Anti-steering disclosure | ❌ **Does not exist** | Zero references in the codebase |
| Verified-over-self-reported | ✅ As provenance gating | Better than silent overwrite: `financialDataProvenance` auto-promotes to "verified" when income+assets+credit all verify (`server/services/verification.ts`), and approval-grade stages are hard-blocked on it (`assertVerifiedForDecisioning`). Original self-reported values preserved for audit |
| Deterministic underwriting | ✅ By design | Pricing/LLPA/AUS/pre-UW are all deterministic lookups and formulas; AI is confined to coaching/extraction, never decisioning |

---

## [HIGH] Critical compliance / demo blockers

**H1. The funnel's FCRA soft-pull acknowledgment is not persisted.** The consent checkbox added to the PreApproval final step gates submission client-side only — no `borrower_consents`/`credit_consents` row with IP/UA/timestamp/hash is written at submit. A lender auditor asking "prove this borrower authorized the soft pull" gets UI code, not evidence. *Fix (small):* on submit, POST the acknowledgment through the existing consent machinery with the disclosure text shown. Files: `client/src/pages/lending/PreApproval.tsx` (handleNext final), `server/routes/lending.ts` (application create), existing `/api/consents`.

**H2. Nothing enforces consent checks.** `GET /api/consents/check/:applicationId/:consentType` exists but has zero callers — there is no `requireConsent`-style gate in front of electronic disclosure delivery (Loan Estimate generation, commitment letter return). The seeded eDisclosure/ESIGN template is never required. *Fix (small):* a `requireConsent(consentType)` middleware wrapping LE/commitment endpoints, plus a consent prompt at first disclosure delivery.

**H3. Anti-steering disclosure is entirely absent.** Required (Reg Z loan-originator comp rules) when presenting loan options to show the borrower saw lowest-rate / lowest-cost alternatives. The natural seam exists: LoanOptions already presents multiple priced options. *Fix (medium):* new consent template + presentation record at LoanOptions view, acknowledged through the borrower_consents ledger.

**H4. Vault credentials (CTO_ROADMAP #1)** — presigned flow is dead in production without a GCS bucket + service account (user action), then delete the multer disk path. A lender will test the document upload during diligence.

**H5. Email provider (CTO_ROADMAP #3)** — the entire automated outreach layer (pre-UW document requests, notifications) currently logs to console in production.

**H6. Simulated pathways that must be disclosed or replaced before a live-data demo** (all deliberately flagged `simulated: true`; each becomes a small adapter ticket when its contract lands):
| Pathway | File | Unlock |
|---|---|---|
| Tri-bureau soft pull (CRS/iSoftpull) | `server/mcp/vendors.ts` | `CRS_API_KEY` (F3) |
| AVM valuation (HouseCanary) | `server/mcp/vendors.ts` | `HOUSECANARY_API_KEY` (F7) |
| Fannie DU submission | `server/services/ausSubmission.ts` | `FANNIE_DU_API_KEY` (F6) |
| Plaid asset-report parsing | `server/services/ausSubmission.ts` (Link/exchange path is real, gated on `PLAID_CLIENT_ID`/`SECRET`) | Plaid production keys (F4) |
| Truv VOIE | slot in `verification_reports` only | Truv contract (F5) |
| Rate sheets in production | none loaded — pricing returns "no products" | Seed a marked demo sheet or build staff upload (roadmap #11) |
| NMLS identity | `server/config/company.ts` = `"PENDING"`, shown in the funnel footer | Licensing (F1) |

---

## [MEDIUM] Manual friction points (the "zero-touch" audit)

**M1. Document upload does not touch conditions.** A borrower uploads a W-2 and… a human must notice. No matching of uploaded `documentType` against `loan_conditions.requiredDocumentTypes`, no auto-transition to "submitted for review," no staff notification. *Proposed:* upload event → match outstanding conditions → mark `submitted` (never auto-`cleared` — clearing is underwriter judgment) → notify assigned staff → when `checkPipelineProgress.readyForNextStage`, either auto-advance or queue a one-click advance.

**M2. AUS submission is a manual staff action.** Could auto-trigger when `financialDataProvenance` flips to "verified" (the event already exists in `verification.ts`).

**M3. No LO/staff assignment engine (roadmap F8).** Every file needs a manual deal-team add; unassigned staff can't even export (correct security, missing workflow). This is also where the NMLS state-routing gate (F2) must live.

**M4. Task engine over-generation (roadmap #6).** 56 borrower tasks = manual triage by borrowers; the opposite of frictionless.

**M5. LLPA transparency not borrower-facing.** `LLPAResult` already carries the exact `{ base, adjustments, total }` decomposition — LoanOptions should render "why this rate" (Prompt 9's transparency payload is one endpoint + one card away).

**M6. No stated-vs-verified reconciliation view.** Provenance gating works, but staff can't see a side-by-side of self-reported vs. Plaid/bureau values on BorrowerFile.

**M7. Prod demo data** — rate sheets (H6) and a scripted demo file with clean data would make lender demos deterministic.

---

## [LOW] Optimization / UI polish

- Phase 4 palette sweep, empty states, a11y, dark-mode decision (roadmap #12–23) — matters for the "bank-grade aesthetics" pitch but nothing blocks a technical review.
- MISMO ASSETS/LIABILITIES nodes are conditional on data; enrich liabilities from `credit_pulls` tradelines when present for fuller files.
- Readiness-score unification (roadmap #14).

---

## Recommended sprint (per the "lender-ready" priority)

1. **H1 + H2** — persist the funnel consent, add `requireConsent` (one day, pure wiring of existing infrastructure).
2. **H3** — anti-steering disclosure at LoanOptions (rides the same ledger).
3. **H4 + H5** — GCS bucket + SendGrid key (user actions; code follows same day).
4. **M1** — upload→condition matching (the single biggest zero-touch win).
5. Vendor keys (H6) as contracts land — each is a pre-built adapter swap.
