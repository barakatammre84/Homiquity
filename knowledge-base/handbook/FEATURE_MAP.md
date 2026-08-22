# Feature map — what Homiquity has built, and who owns it

**Every shipped feature area, with the agent that owns it.** This is the inventory answer to "what
have we built", and it is the roster for the `hq-*-owner` agents in `.claude/agents/`.

Two things this file is **not**. It is not a roadmap — open work lives in `CTO_ROADMAP.md`. And it is
not the claim lock: `knowledge-base/routines/REGISTER.md` still decides who may write a file today,
and a file in another session's open PR is claimed no matter who owns it.

## How ownership works here

Each area has exactly one owner agent. Invoke it by name when you want work done in that area — it
carries the area's file list, its authority chain, its owned tests and its known traps, so it does not
re-derive them. Owners **implement and open a PR; they never merge.**

The rails every owner obeys live in one place, `.claude/agents/_OWNER_RAILS.md`, rather than being
restated 41 times — so there is nothing to drift.

Some areas own files that sit on the charter's always-off-limits list (the PII vault, auth, the
underwriting engines, object storage, outbound messaging, the amortization module, the furnishing
gate). Those files are marked **hand-back** in the agent: it diagnoses precisely and a human applies
the change. That is deliberate — the off-limits list is inherited exactly as `CHARTER.md` §6 writes it,
and relaxing it is a founder decision, not an agent's.

The **Also writes here** column names the scheduled routines whose write territory overlaps the area,
so you can check whether one may be mid-flight. The Primary Engineer's lane is company-wide and is
therefore omitted from every row rather than repeated on all of them.

## The roster

| # | Area | Owner agent | Review domain | Last reviewed | Also writes here |
|---|---|---|---|---|---|
| 1 | [URLA / borrower application (Form 1003)](#1-urla-borrower-application-form-1003) | `hq-urla-owner` | 2 — Application & intake | 2026-08-05 | Backend Data Engineer · Wiring Audit · UI Conformance Sweep · Refactor Radar |
| 2 | [Pre-approval funnel and lead intake](#2-pre-approval-funnel-and-lead-intake) | `hq-intake-funnel-owner` | 2 — Application & intake | 2026-08-05 | Backend Data Engineer · Wiring Audit · UI Conformance Sweep · Refactor Radar |
| 3 | [Pricing and rate engine](#3-pricing-and-rate-engine) | `hq-pricing-owner` | 6 — Pricing, rates & disclosures | 2026-08-17 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar · Financial Audit |
| 4 | [Rate locks](#4-rate-locks) | `hq-rate-locks-owner` | 6 — Pricing, rates & disclosures | 2026-08-17 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 5 | [Underwriting and decisioning](#5-underwriting-and-decisioning) | `hq-underwriting-owner` | 5 — Underwriting & decisioning | 2026-08-12 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 6 | [Income analysis across the five qualifying paths](#6-income-analysis-across-the-five-qualifying-paths) | `hq-income-owner` | 5 — Underwriting & decisioning | 2026-08-12 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 7 | [Credit pulls, FCRA consent and adverse action](#7-credit-pulls-fcra-consent-and-adverse-action) | `hq-credit-fcra-owner` | 4 — Verification & credit | 2026-08-05 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 8 | [GSE delivery and MISMO export](#8-gse-delivery-and-mismo-export) | `hq-gse-delivery-owner` | 8 — GSE delivery & compliance export | 2026-08-17 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 9 | [AUS submission and the autopilot orchestrator](#9-aus-submission-and-the-autopilot-orchestrator) | `hq-aus-autopilot-owner` | 7 — AUS & lender submission | 2026-08-18 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 10 | [TRID, disclosures and the Loan Estimate](#10-trid-disclosures-and-the-loan-estimate) | `hq-trid-disclosures-owner` | 6 — Pricing, rates & disclosures | 2026-08-17 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar · Financial Audit |
| 11 | [Documents, uploads and extraction](#11-documents-uploads-and-extraction) | `hq-documents-owner` | 3 — AI Coach, documents & extraction | 2026-08-05 | Backend Data Engineer · Wiring Audit · UI Conformance Sweep · Refactor Radar |
| 12 | [Tax document intelligence](#12-tax-document-intelligence) | `hq-tax-intel-owner` | 3 — AI Coach, documents & extraction | 2026-08-05 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 13 | [Rent reporting and the lease ledger](#13-rent-reporting-and-the-lease-ledger) | `hq-rent-reporting-owner` | unmapped | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 14 | [Verifications — Plaid, KYC/AML, KBA and identity](#14-verifications-plaid-kycaml-kba-and-identity) | `hq-verifications-owner` | 4 — Verification & credit | 2026-08-05 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 15 | [Task engine and SLA operations](#15-task-engine-and-sla-operations) | `hq-task-engine-owner` | 11 — Staff, partner & pipeline ops | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 16 | [Loan pipeline and the staff LO cockpit](#16-loan-pipeline-and-the-staff-lo-cockpit) | `hq-pipeline-owner` | 11 — Staff, partner & pipeline ops | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 17 | [Pre-approval and pre-qualification letters](#17-pre-approval-and-pre-qualification-letters) | `hq-letters-owner` | 11 — Staff, partner & pipeline ops | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 18 | [Offer comparison and anti-steering](#18-offer-comparison-and-anti-steering) | `hq-offers-owner` | 6 — Pricing, rates & disclosures | 2026-08-17 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 19 | [Borrower dashboard and journey](#19-borrower-dashboard-and-journey) | `hq-borrower-journey-owner` | 10 — Borrower graph & data intelligence | **never** | Backend Data Engineer · Wiring Audit · UI Conformance Sweep · Refactor Radar |
| 20 | [Messaging and notifications](#20-messaging-and-notifications) | `hq-messaging-owner` | 13 — Security, PII & platform cross-cutting | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 21 | [AI coach](#21-ai-coach) | `hq-ai-coach-owner` | 3 — AI Coach, documents & extraction | 2026-08-05 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 22 | [Homebuyer accelerator program](#22-homebuyer-accelerator-program) | `hq-accelerator-owner` | 12 — Property, listings & homeowner | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 23 | [Property search, listings and valuation](#23-property-search-listings-and-valuation) | `hq-property-owner` | 12 — Property, listings & homeowner | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 24 | [Multi-property applications](#24-multi-property-applications) | `hq-multi-property-owner` | 2 — Application & intake | 2026-08-05 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 25 | [Public calculators and affordability tools](#25-public-calculators-and-affordability-tools) | `hq-calculators-owner` | 1 — Public funnel, acquisition & education | 2026-08-08 | Backend Data Engineer · Wiring Audit · UI Conformance Sweep · Refactor Radar |
| 26 | [Broker portal and wholesale channel](#26-broker-portal-and-wholesale-channel) | `hq-broker-portal-owner` | 11 — Staff, partner & pipeline ops | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar · Financial Audit |
| 27 | [Partner, referral and CPA network](#27-partner-referral-and-cpa-network) | `hq-partners-owner` | 11 — Staff, partner & pipeline ops | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 28 | [Realtor engine](#28-realtor-engine) | `hq-realtor-engine-owner` | 12 — Property, listings & homeowner | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 29 | [Homeowner and post-close retention surface](#29-homeowner-and-post-close-retention-surface) | `hq-homeowner-owner` | 12 — Property, listings & homeowner | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 30 | [Admin console](#30-admin-console) | `hq-admin-console-owner` | 11 — Staff, partner & pipeline ops | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 31 | [Financial reporting and compensation](#31-financial-reporting-and-compensation) | `hq-compensation-owner` | 11 — Staff, partner & pipeline ops | **never** | UI Conformance Sweep · Refactor Radar · Financial Audit |
| 32 | [Compliance analytics, HMDA and fair lending](#32-compliance-analytics-hmda-and-fair-lending) | `hq-hmda-fairlending-owner` | 9 — Compliance analytics & adverse action | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 33 | [Authentication, sessions and account security](#33-authentication-sessions-and-account-security) | `hq-auth-owner` | 13 — Security, PII & platform cross-cutting | **never** | UI Conformance Sweep · Refactor Radar |
| 34 | [PII protection, encryption and the audit log](#34-pii-protection-encryption-and-the-audit-log) | `hq-pii-vault-owner` | 13 — Security, PII & platform cross-cutting | **never** | Backend Data Engineer |
| 35 | [Marketing, SEO and education content](#35-marketing-seo-and-education-content) | `hq-seo-content-owner` | 1 — Public funnel, acquisition & education | 2026-08-08 | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 36 | [Data intelligence and analytics](#36-data-intelligence-and-analytics) | `hq-data-intel-owner` | 10 — Borrower graph & data intelligence | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 37 | [Market data and competitive intelligence](#37-market-data-and-competitive-intelligence) | `hq-market-data-owner` | unmapped | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 38 | [MCP server (the agent tool surface)](#38-mcp-server-the-agent-tool-surface) | `hq-mcp-owner` | 13 — Security, PII & platform cross-cutting | **never** | Backend Data Engineer |
| 39 | [Background jobs and scheduled sweeps](#39-background-jobs-and-scheduled-sweeps) | `hq-jobs-cron-owner` | 13 — Security, PII & platform cross-cutting | **never** | Backend Data Engineer |
| 40 | [Observability, error monitoring and request-level operations](#40-observability-error-monitoring-and-request-level-operations) | `hq-observability-owner` | 13 — Security, PII & platform cross-cutting | **never** | Backend Data Engineer · UI Conformance Sweep · Refactor Radar |
| 41 | [CI, the guard fleet and repository tooling](#41-ci-the-guard-fleet-and-repository-tooling) | `hq-ci-guards-owner` | 13 — Security, PII & platform cross-cutting | **never** | — |

**23 of 41 areas have never had a feature review.** Review domains 9 through 13 in
`knowledge-base/feature-review/DOMAINS.md` have not been run, and two areas — market data and rent
reporting — map to no review domain at all. Treat "it works" in those rows as unverified.

---

## The areas

### 1. URLA / borrower application (Form 1003)

**Owner:** `hq-urla-owner`

What it does:

- Capture the full Form 1003 with **section-level save**, so a borrower can leave and return without losing an answer.
- **Never enforce a validation rule by dropping data.** Report the problem; keep what the borrower typed. This is the root cause of the repo's dominant defect class.
- Support the three wire states end to end — field absent, field has a value, field explicitly `null` meaning *clear*. `null` never becomes `""`.

- **Server** — `server/routes/borrower/urla.ts`, `server/routes/urlaValidation.ts`, `server/storage/urla.ts`, `server/storage/urlaBatch.ts`
- **Client** — `client/src/pages/borrower/URLAForm.tsx`, `client/src/pages/borrower/urla/`
- **Shared / schema** — `shared/schema/lendingUrla.ts`, `shared/lib/urlaRowContent.ts`, `shared/preApprovalForm.ts`, `shared/intakeClearable.ts`
- **Owned tests** — 5 files, listed in the agent

### 2. Pre-approval funnel and lead intake

**Owner:** `hq-intake-funnel-owner`

What it does:

- A borrower can abandon any step and return to exactly what they typed — the server holds the draft, not the browser.
- **The funnel never denies anybody.** It captures; the engine decides later. A credit band or income shape must not bounce someone out of the flow.
- A clear is committed as a **transition**, never as a state: the form starts blank while the draft may be full, so "empty means clear" would null the whole draft.

- **Server** — `server/routes/lending/applications.ts`, `server/routes/leads.ts`, `server/routes/borrower/scenariosWaitlist.ts`, `server/services/leadNotifications.ts`, `server/services/worksheetPrefill.ts`
- **Client** — `client/src/pages/lending/PreApproval.tsx`, `client/src/pages/lending/preApproval/`, `client/src/funnel/`
- **Shared / schema** — `shared/schema/leads.ts`, `shared/schema/lendingCore.ts`
- **Owned tests** — 8 files, listed in the agent

### 3. Pricing and rate engine

**Owner:** `hq-pricing-owner`

What it does:

- **Every policy number resolves from a versioned, effective-dated Postgres matrix.** No hardcoded rate cards, no inline PMI tables.
- `resolveMatrixValue` **throws** when a band is missing on a decisioning path — that is a Fair Lending property, not a rough edge. `tryResolveMatrixValue` returning null is for display only.
- **One figure per fact.** The MI, rate and payment a borrower sees are the same numbers the decision engine used. Two surfaces disagreeing about one loan is this area's defining defect.

- **Server** — `server/pricing.ts`, `server/routes/lending/pricing.ts`, `server/routes/rate-sheets.ts`, `server/routes/lookup-matrix.ts`, `server/routes/admin/pricingPolicy.ts`, `server/services/rateService.ts`, `server/services/pricingAdapter.ts`, `server/services/competitorRateService.ts`, `server/services/mortgageInsurance.ts`, `server/services/lookupResolver.ts`, `server/services/platformFeeSchedule.ts`, `server/storage/pricingPolicy.ts`, `server/seedMarketPricing.ts`
- **Client** — `client/src/pages/lending/LoanOptions.tsx`, `client/src/pages/lending/loanOptions/`, `client/src/pages/staff/PricingMatrices.tsx`, `client/src/pages/staff/pricingMatrices/`, `client/src/pages/admin/PricingPolicy.tsx`, `client/src/pages/admin/AdminRates.tsx`, `client/src/pages/rates/`
- **Shared / schema** — `shared/schema/lendingRatesOps.ts`, `shared/schema/lendingWholesale.ts`, `shared/schema/lookup.ts`, `shared/rateLoanTypes.ts`, `shared/wholesaleLenders.ts`
- **Hand-back only** — `shared/lib/amortization.ts`
- **Owned tests** — 9 files, listed in the agent

### 4. Rate locks

**Owner:** `hq-rate-locks-owner`

What it does:

- A lock records the exact pricing inputs that produced it — a lock that cannot reconstruct its own rate is not a lock.
- Expiry is swept on a schedule, and an expiring lock reaches the borrower before it lapses, not after.
- An extension fee has a stated Reg Z basis. No fee appears without one.

- **Server** — `server/routes/borrower/rateLocks.ts`, `server/services/rateLockAlerts.ts`
- **Client** — `client/src/components/RateLockDialog.tsx`
- **Shared / schema** — `shared/rateLockConfirmation.ts`
- **Owned tests** — 3 files, listed in the agent

### 5. Underwriting and decisioning

**Owner:** `hq-underwriting-owner`

What it does:

- **Deterministic: same inputs, same outcome**, with typed error classification. No randomness, no wall clock inside an outcome, no vendor call, no AI.
- Every rule carries a guideline citation. **No citation and no deterministic rule means Needs Clarification — never an implementation on vibes.**
- The rule DSL is versioned, approved and retired through a workflow, and the applied policy version is recoverable for every decision (ECOA).

- **Server** — `server/routes/underwriting/`, `server/routes/underwriting-rules.ts`, `server/routes/policy-ops.ts`, `server/routes/scenarios.ts`, `server/services/preUnderwriting.ts`, `server/services/underwritingNuance.ts`, `server/services/riskBrief.ts`, `server/services/scenarioSimulator.ts`, `server/services/scenarioCatalog.ts`, `server/services/optimizationEngine.ts`
- **Client** — `client/src/pages/staff/PolicyOps.tsx`, `client/src/pages/staff/policyOps/`, `client/src/components/staff/RiskBriefPanel.tsx`, `client/src/components/ScenarioSimulatorDialog.tsx`
- **Shared / schema** — `shared/schema/underwritingCore.ts`, `shared/schema/underwritingConditions.ts`, `shared/schema/underwritingPolicy.ts`, `shared/schema/underwritingFinancials.ts`, `shared/schema/decisions.ts`, `shared/schema/scenarioRuns.ts`, `shared/riskBrief.ts`, `shared/stageRequirements.ts`, `shared/lendingLimits.ts`, `shared/contingentLiabilities.ts`
- **Hand-back only** — `server/underwritingEngine.ts`, `server/services/decisionEngine.ts`, `server/services/ruleEngine.ts`
- **Owned tests** — 11 files, listed in the agent

### 6. Income analysis across the five qualifying paths

**Owner:** `hq-income-owner`

What it does:

- Five qualifying-income paths evaluate **in parallel** against the same borrower, and the orchestrator picks — a path that cannot qualify says so rather than returning zero.
- Every computed income figure traces to a guideline citation and a source document.
- Review triage exists so an uncertain path becomes a human question, not a silent assumption.

- **Server** — `server/services/income/`, `server/services/incomeAnalysisPackage.ts`, `server/services/selfEmploymentIncome.ts`, `server/routes/lending/incomeSummary.ts`
- **Client** — `client/src/components/borrower/IncomeSummaryCard.tsx`, `client/src/pages/borrower/urla/SelfEmploymentIncomeWorksheet.tsx`
- **Shared / schema** — `shared/incomePackage.ts`, `shared/incomePaths.ts`, `shared/schema/incomePathEvaluations.ts`, `shared/schema/review.ts`
- **Owned tests** — 7 files, listed in the agent

### 7. Credit pulls, FCRA consent and adverse action

**Owner:** `hq-credit-fcra-owner`

What it does:

- **No pull without a recorded permissible purpose.** The consent gate fails closed, always.
- Consent is revocable, and revocation is as durable as the grant.
- The credit audit log is **hash-chained** — an entry cannot be edited without breaking the chain, and the chain tip is observable.

- **Server** — `server/routes/compliance.ts`, `server/services/creditService.ts`, `server/services/creditPulls.ts`, `server/services/creditConsents.ts`, `server/services/creditConsentDrafts.ts`, `server/services/creditAdverseActions.ts`, `server/services/creditAudit.ts`, `server/services/creditAuditChain.ts`, `server/services/creditRetention.ts`, `server/services/creditMonitoring.ts`, `server/services/creditCatalogs.ts`, `server/services/adverseActionDelivery.ts`
- **Client** — `client/src/pages/borrower/CreditConsent.tsx`, `client/src/pages/borrower/AdverseActionNotice.tsx`, `client/src/pages/staff/borrowerFile/CreditTab.tsx`, `client/src/pages/staff/staffDashboard/AuditChainStatusTiles.tsx`
- **Shared / schema** — `shared/schema/compliance.ts`, `shared/creditConsentCopy.ts`
- **Owned tests** — 13 files, listed in the agent

### 8. GSE delivery and MISMO export

**Owner:** `hq-gse-delivery-owner`

What it does:

- The exported package is **valid against the shipped XSDs** and carries a negative control proving the validator can fail.
- **Never invent** a data-point name, enumeration, container path, edit code or Special Feature Code. Unverifiable means stop and flag — a schema mismatch means **drop the field**.
- Readiness scoring names what is missing, specifically enough to act on.

- **Server** — `server/mismo.ts`, `server/services/mismoValidation.ts`, `server/services/mismoXsdValidation.ts`, `server/services/loanDeliveryReadiness.ts`, `server/services/structureTranslation.ts`, `server/services/lenderIdentifiers.ts`, `server/services/lenderSubmission.ts`, `server/services/brokerSubmissionReadiness.ts`, `server/routes/lending/delivery.ts`
- **Client** — `client/src/components/SubmissionReadinessDialog.tsx`, `client/src/components/SubmissionLifecycleControl.tsx`, `client/src/components/PackageConformanceBadge.tsx`, `client/src/components/BorrowerPackageView.tsx`
- **Shared / schema** — `shared/mismo.ts`, `shared/schema/delivery.ts`, `shared/fannieMae/`
- **Owned tests** — 13 files, listed in the agent

### 9. AUS submission and the autopilot orchestrator

**Owner:** `hq-aus-autopilot-owner`

What it does:

- **LLM perception, deterministic cognition — never one model doing both.** That split is the Reg B firewall.
- Homiquity never decides; the lender does. Autopilot relays and prepares, it does not adjudicate.
- The kill switch defaults **off** and fails closed.

- **Server** — `server/routes/aus.ts`, `server/services/ausSubmission.ts`, `server/routes/autopilot.ts`, `server/routes/autopilotAdmin.ts`, `server/services/autopilot/`
- **Client** — `client/src/pages/admin/AutopilotConsole.tsx`, `client/src/components/AutopilotBanner.tsx`, `client/src/hooks/useAutopilotStatus.ts`
- **Shared / schema** — `shared/schema/autopilot.ts`, `shared/autopilotStatus.ts`
- **Owned tests** — 6 files, listed in the agent

### 10. TRID, disclosures and the Loan Estimate

**Owner:** `hq-trid-disclosures-owner`

What it does:

- **`server/services/trid.ts` is the sole writer of the TRID trigger timestamp.** One writer, one clock.
- **APR comes from the Appendix J solver in `server/services/apr.ts` and nowhere else.** Any other APR figure on any surface is a bug.
- QM thresholds are selected **by note date** from the dated tables — never a current-year constant.

- **Server** — `server/services/trid.ts`, `server/services/loanEstimate.ts`, `server/services/leDisclosureBaseline.ts`, `server/services/loanCosts.ts`, `server/services/changeOfCircumstance.ts`, `server/services/apr.ts`, `server/consentGate.ts`, `server/routes/underwriting/delivery.ts`
- **Client** — `client/src/pages/lending/LoanEstimate.tsx`, `client/src/pages/borrower/EConsent.tsx`, `client/src/components/staff/ChangeOfCircumstancePanel.tsx`, `client/src/components/ConsentGateCard.tsx`
- **Shared / schema** — `shared/compliance/changeOfCircumstance.ts`, `shared/compliance/feeTolerance.ts`, `shared/compliance/feeProvenance.ts`, `shared/fannieMae/qmThresholds.ts`
- **Hand-back only** — `shared/lib/amortization.ts`
- **Owned tests** — 12 files, listed in the agent

### 11. Documents, uploads and extraction

**Owner:** `hq-documents-owner`

What it does:

- Pages classify into **logical documents**, and a field carries an extraction confidence the reviewer can act on.
- The checklist is personalised to the borrower's actual situation, not a static list.
- Uploads fail **honestly** — when storage is unconfigured the copy says so rather than pretending the file landed.

- **Server** — `server/routes/documents.ts`, `server/routes/lending/documents.ts`, `server/extractionCore.ts`, `server/extractionDocuments.ts`, `server/extractionValidation.ts`, `server/routes/borrower/documentPackages.ts`, `server/services/documentChecklist.ts`, `server/services/documentConfidence.ts`, `server/services/documentFacts.ts`, `server/services/extractionPersistence.ts`, `server/services/docRequestDraft.ts`, `server/services/fileHealth.ts`
- **Client** — `client/src/pages/borrower/Documents.tsx`, `client/src/pages/borrower/documents/`, `client/src/components/DocumentDropzone.tsx`, `client/src/components/UploadDocumentDialog.tsx`, `client/src/components/staff/DocumentReviewPanel.tsx`, `client/src/components/staff/DocumentViewer.tsx`, `client/src/components/staff/ReviewWorkbenchPanel.tsx`
- **Shared / schema** — `shared/schema/documents.ts`, `shared/uploads.ts`, `shared/documentTypes.ts`, `shared/documentStatus.ts`, `shared/borrowerDocumentView.ts`, `shared/dataProvenance.ts`
- **Hand-back only** — `server/integrations/object_storage/`
- **Owned tests** — 17 files, listed in the agent

> `server/routes/lending/documents.ts` — `POST /api/documents/upload`, the route a **borrower**
> actually uploads through — was absent from this row until 2026-08-20. Its omission was not
> cosmetic: extraction reaches a document from there *and* from `routes/documents.ts`, and the two
> implementations drifted for as long as only one of them was owned (the borrower's path extracted
> pay stubs and discarded the values). The post-extraction behaviour now lives once, in
> `server/services/extractionPersistence.ts`.

### 12. Tax document intelligence

**Owner:** `hq-tax-intel-owner`

What it does:

- Extract IRS form values, **reconcile them against each other**, and surface the disagreement rather than silently picking one.
- Classify the borrower's tax situation so the checklist and the income path can adapt to it.
- A drafted self-employment worksheet is a **draft** — a human confirms it before it qualifies anyone.

- **Server** — `server/routes/taxIntelligence.ts`, `server/routes/taxInsights.ts`, `server/services/taxDocumentIntelligence.ts`, `server/services/taxInsightService.ts`, `server/services/taxReconciliation.ts`, `server/services/situationClassifier.ts`, `server/extractionTaxIntel.ts`
- **Client** — `client/src/components/staff/TaxIntelligencePanel.tsx`, `client/src/components/TaxReturnInsightCard.tsx`
- **Shared / schema** — `shared/taxFormExtraction.ts`, `shared/situationProfile.ts`, `shared/schema/taxInsights.ts`
- **Owned tests** — 5 files, listed in the agent

### 13. Rent reporting and the lease ledger

**Owner:** `hq-rent-reporting-owner`

What it does:

- **This is the only place Homiquity would ever WRITE to a consumer's credit file.** Every gate fails closed, and the default is not to furnish.
- Only `platform_processed` provenance is furnishable. `bank_observed` is excluded **because** a keyword match would furnish a MISSED payment for somebody who actually paid.
- A furnished lease can be **suppressed, never deleted** — the record of what was reported is itself a consumer protection.

- **Server** — `server/routes/borrower/leases.ts`
- **Client** — `client/src/pages/borrower/MyLease.tsx`, `client/src/pages/borrower/myLease/`, `client/src/pages/borrower/RenterHome.tsx`, `client/src/pages/public/RentReporting.tsx`
- **Shared / schema** — `shared/schema/rent.ts`, `shared/leaseView.ts`
- **Hand-back only** — `server/services/rentFurnishing.ts`, `shared/lib/metro2/`
- **Owned tests** — 5 files, listed in the agent

### 14. Verifications — Plaid, KYC/AML, KBA and identity

**Owner:** `hq-verifications-owner`

What it does:

- A verified fact is **promoted in provenance** — the point of verification is that a downstream consumer can tell verified from self-attested.
- A staff override is possible but must require evidence and leave a record. An override needing no evidence is not a verification.
- Plaid is environment-gated on purpose; the environment decision is deferred deliberately, not forgotten.

- **Server** — `server/plaid.ts`, `server/services/verification.ts`, `server/routes/borrower/onboarding.ts`
- **Client** — `client/src/pages/borrower/Verification.tsx`, `client/src/pages/borrower/IdentityVerification.tsx`, `client/src/components/PlaidConnectButton.tsx`, `client/src/funnel/VerificationPulse.tsx`, `client/src/pages/staff/staffDashboard/KycReviewQueue.tsx`
- **Shared / schema** — `shared/schema/lendingComms.ts`
- **Owned tests** — 4 files, listed in the agent

### 15. Task engine and SLA operations

**Owner:** `hq-task-engine-owner`

What it does:

- **Two axes, two columns: lifecycle in `status`, verdict in `verificationStatus`.** One column holding two vocabularies is what made an SLA sweep miss over a thousand rows.
- **Tasks are never hard-deleted.** The delete route is an audited cancel that lands the row in a terminal state.
- An SLA class is configuration, not a constant — the mapping from task type to class is data.

- **Server** — `server/routes/task-engine.ts`, `server/services/taskEngine.ts`, `server/services/taskEventEmitter.ts`, `server/seedData/taskEngineSla.ts`
- **Client** — `client/src/pages/borrower/Tasks.tsx`, `client/src/pages/borrower/TaskDetail.tsx`, `client/src/pages/staff/TaskOperations.tsx`, `client/src/pages/staff/taskOperations/`, `client/src/components/patterns/TaskProgress.tsx`
- **Shared / schema** — `shared/schema/underwritingTasks.ts`, `shared/borrowerTaskView.ts`
- **Owned tests** — 4 files, listed in the agent

### 16. Loan pipeline and the staff LO cockpit

**Owner:** `hq-pipeline-owner`

What it does:

- Stage advance enforces its requirements — an ECOA denial path and a TRID hard stop are gates, not warnings.
- Staff see the **narrowest actionable next step**, not a wall of state.
- Cockpit data is scoped to what that staff member may see. Scoping is a security property.

- **Server** — `server/pipelineEngine.ts`, `server/routes/cockpit.ts`, `server/routes/comms.ts`, `server/storage/pipeline.ts`, `server/services/nextAction.ts`, `server/services/lifecycleEngine.ts`, `server/services/cycleTimeReport.ts`, `server/services/frictionLog.ts`, `server/services/activitySummary.ts`, `server/routes/lending/statusDecisions.ts`, `server/routes/borrower/dealTeam.ts` *(provisional, assigned 2026-08-22 by the staff-journey PR — was unowned; move if a better home exists)*
- **Client** — `client/src/pages/lending/LoanPipeline.tsx`, `client/src/pages/lending/loanPipeline/`, `client/src/pages/staff/LoCommandCenter.tsx`, `client/src/pages/staff/loCommandCenter/`, `client/src/pages/staff/StaffDashboard.tsx`, `client/src/pages/staff/staffDashboard/`, `client/src/pages/staff/BorrowerFile.tsx`, `client/src/pages/staff/borrowerFile/`, `client/src/components/StaffSignalsPanel.tsx`
- **Shared / schema** — `shared/loanApplicationStatus.ts`, `shared/statusVocabularies.ts`, `shared/cycleTimeReport.ts`, `shared/borrowerActivityView.ts`, `shared/compliance/loCommsLint.ts`
- **Owned tests** — 10 files, listed in the agent

### 17. Pre-approval and pre-qualification letters

**Owner:** `hq-letters-owner`

What it does:

- A letter states only what the file actually supports, with the **disclaimer version that was in force when it was issued**.
- Letters expire, and expiry is enforced rather than displayed.
- **No machine-issued financial attestation to a third party** beyond what the letter template and its disclaimers allow.

- **Server** — `server/routes/lending/letters.ts`, `server/services/pdfLetterGenerator.ts`, `server/services/letterExpiry.ts`
- **Client** — `client/src/pages/borrower/borrowerDashboard/PreQualLetterCard.tsx`, `client/src/pages/staff/borrowerFile/PreApprovalLetterCard.tsx`, `client/src/pages/lending/loanOptions/LoanLetterButton.tsx`
- **Shared / schema** — `shared/schema/lendingLetters.ts`, `shared/letters.ts`
- **Owned tests** — 2 files, listed in the agent

### 18. Offer comparison and anti-steering

**Owner:** `hq-offers-owner`

What it does:

- The option set satisfies the anti-steering requirement — the borrower sees a genuine range, not a curated one.
- **Wholesale lender identity is never surfaced to a borrower.** The comparison is by terms, not by counterparty.
- A selection is an event with a record: what was shown, what was chosen, when.

- **Server** — `server/services/antiSteeringOptions.ts`
- **Client** — `client/src/pages/lending/BorrowerDealComparison.tsx`, `client/src/pages/lending/borrowerDealComparison/`, `client/src/components/LoanComparisonMatrix.tsx`
- **Shared / schema** — `shared/borrowerOfferView.ts`
- **Owned tests** — 2 files, listed in the agent

### 19. Borrower dashboard and journey

**Owner:** `hq-borrower-journey-owner`

What it does:

- A borrower always knows **the single next thing to do** and why it matters.
- The state machine is the truth about where somebody is; the dashboard renders it rather than deriving its own.
- Readiness is reconciled from real signals, never self-reported alone.

- **Server** — `server/routes/lending/dashboard.ts`, `server/routes/borrower/journeyGoals.ts`, `server/routes/shell.ts`, `server/storage/journey.ts`, `server/services/borrowerStateMachine.ts`, `server/services/readinessSync.ts`
- **Client** — `client/src/pages/borrower/Dashboard.tsx`, `client/src/pages/borrower/borrowerDashboard/`, `client/src/pages/borrower/OnboardingJourney.tsx`, `client/src/pages/borrower/GapCalculator.tsx`, `client/src/pages/borrower/gapCalculator/`, `client/src/components/JourneyTracker.tsx`, `client/src/components/HomeReadinessPassport.tsx`, `client/src/hooks/useShellBadges.ts`
- **Shared / schema** — `shared/borrowerJourney.ts`, `shared/readinessMapping.ts`
- **Owned tests** — 4 files, listed in the agent

### 20. Messaging and notifications

**Owner:** `hq-messaging-owner`

What it does:

- In-app threads are the durable record; SMS and email are transports over it.
- **A webhook receiver authenticates its caller.** An unsigned POST must be refused — a 403 rather than a 503 is how you know the token is live.
- Quiet hours and the STOP opt-out ledger are enforced before send, not after.

- **Server** — `server/routes/borrower/messaging.ts`, `server/routes/notifications.ts`, `server/routes/webhooks.ts`, `server/storage/messaging.ts`, `server/storage/notificationsOps.ts`, `server/services/quietHours.ts`, `server/services/twilioMessageStatus.ts`, `server/services/twilioSignature.ts`
- **Client** — `client/src/pages/borrower/Messages.tsx`, `client/src/pages/borrower/messages/`, `client/src/components/NotificationsPanel.tsx`, `client/src/components/BorrowerRequests.tsx`
- **Shared / schema** — `shared/schema/admin.ts`
- **Hand-back only** — `server/services/emailService.ts`, `server/services/smsCompliance.ts`
- **Owned tests** — 7 files, listed in the agent

### 21. AI coach

**Owner:** `hq-ai-coach-owner`

What it does:

- **The coach extracts and explains. It never decides.** No qualification verdict, no rate quote, no approval language.
- **The coach can never emit a clear.** It may propose a value; it may not null a borrower's answer.
- Every turn is logged as an AI interaction, and the compliance lint runs on output before the borrower sees it.

- **Server** — `server/routes/coach.ts`, `server/services/coachingService.ts`, `server/services/coachingClient.ts`, `server/services/coachingContext.ts`, `server/services/coachingPrompt.ts`, `server/services/coachingTurn.ts`, `server/services/coachingLint.ts`, `server/services/coachIntake.ts`, `server/services/coachProfileSync.ts`, `server/services/coachTools.ts`, `server/services/aiInteractionLog.ts`, `server/services/sensitiveInputGuard.ts`, `server/sse.ts`
- **Client** — `client/src/pages/education/AICoach.tsx`, `client/src/components/coach/`
- **Shared / schema** — `shared/schema/coach.ts`, `shared/schema/ai.ts`
- **Owned tests** — 6 files, listed in the agent

### 22. Homebuyer accelerator program

**Owner:** `hq-accelerator-owner`

What it does:

- Enrollment, milestones and coaching sessions are a **program**, not a marketing page — state persists and progress is real.
- A scheduled session is a commitment on both sides, with a record.
- The financial snapshot is the borrower's own data, not an estimate dressed as one.

- **Server** — `server/routes/borrower/realtorPrograms.ts`
- **Client** — `client/src/pages/education/AcceleratorProgram.tsx`, `client/src/pages/education/acceleratorProgram/`

### 23. Property search, listings and valuation

**Owner:** `hq-property-owner`

What it does:

- Address entry resolves to a real, validated address before anything downstream depends on it.
- Listing and valuation vendors sit behind adapters and are **deterministic simulations** until real contracts exist.
- Property analysis surfaces eligibility signals (including special assessments) rather than making the eligibility call.

- **Server** — `server/routes/property.ts`, `server/routes/listings.ts`, `server/routes/geocode.ts`, `server/propertyAnalyzer.ts`, `server/services/valueEstimate.ts`, `server/storage/properties.ts`
- **Client** — `client/src/pages/property/`, `client/src/pages/borrower/BuyerProperties.tsx`, `client/src/components/PropertyMap.tsx`, `client/src/components/StreetView.tsx`, `client/src/components/AddressInput.tsx`
- **Shared / schema** — `shared/schema/property.ts`
- **Owned tests** — 2 files, listed in the agent

### 24. Multi-property applications

**Owner:** `hq-multi-property-owner`

What it does:

- A borrower can pursue more than one property without losing work already done on the file.
- Switching the active property is explicit and recorded — never inferred.
- A deal that falls through is a **state**, not a deletion; the history stays.

- **Server** — `server/routes/borrower/applicationProperties.ts`
- **Client** — `client/src/components/ApplicationSwitcher.tsx`, `client/src/hooks/useActiveApplication.ts`, `client/src/pages/lending/loanPipeline/PropertyManagementCard.tsx`
- **Owned tests** — 1 files, listed in the agent

### 25. Public calculators and affordability tools

**Owner:** `hq-calculators-owner`

What it does:

- **Every payment figure comes from `shared/lib/amortization.ts`.** Grep before writing any payment formula — there must never be a twenty-fifth copy.
- The two entry points — percent (`6.5`) and fraction (`0.065`) — exist **on purpose and must never be merged.**
- A calculator is an estimate and says so. It never quotes a rate the borrower could rely on and never implies approval.

- **Server** — `server/routes/calculators.ts`, `server/routes/borrower/calculators.ts`
- **Client** — `client/src/pages/calculators/`, `client/src/pages/public/AffordabilityCheck.tsx`, `client/src/pages/public/ApprovalStrength.tsx`, `client/src/components/BuyingPowerEstimator.tsx`, `client/src/components/AffordabilityBadge.tsx`, `client/src/pages/education/DownPaymentWizard.tsx`
- **Shared / schema** — `client/src/lib/affordabilityEstimate.ts`, `client/src/lib/approvalStrength.ts`, `client/src/lib/buyingPowerScenario.ts`, `client/src/lib/rentVsBuyEstimate.ts`, `client/src/lib/amortizationEstimate.ts`, `client/src/lib/dualUnitMath.ts`
- **Hand-back only** — `shared/lib/amortization.ts`
- **Owned tests** — 4 files, listed in the agent

### 26. Broker portal and wholesale channel

**Owner:** `hq-broker-portal-owner`

What it does:

- **Broker and lender are separate personas.** The lender persona is deferred and unbuilt — its endpoints stay admin-only.
- **Never build a lender-facing surface without asking first.** That is a founder-gated decision.
- An invite carries attribution that survives the borrower's whole journey.

- **Server** — `server/routes/agent-broker/`, `server/services/lenderMatchingEngine.ts`
- **Client** — `client/src/pages/agent-broker/BrokerDashboard.tsx`, `client/src/pages/agent-broker/InviteGenerator.tsx`, `client/src/pages/agent-broker/inviteGenerator/`, `client/src/pages/agent-broker/AgentPipeline.tsx`, `client/src/pages/agent-broker/AgentDashboard.tsx`, `client/src/pages/agent-broker/AgentEdit.tsx`, `client/src/pages/agent-broker/AgentCoBranding.tsx`, `client/src/pages/agent-broker/PartnerServices.tsx`, `client/src/pages/agent-broker/ApplyInvite.tsx` *(provisional, assigned 2026-08-22 by the staff-journey PR — was unowned; move if a better home exists)*
- **Shared / schema** — `shared/businessChannel.ts`
- **Owned tests** — 2 files, listed in the agent

### 27. Partner, referral and CPA network

**Owner:** `hq-partners-owner`

What it does:

- A partner's licence is reviewed before their public page exists — an unreviewed partner has no landing page.
- Attribution survives the gap between clicking a referral link and creating an account.
- **Progress shared with a referring partner requires the borrower's consent**, and the consent is scoped.

- **Server** — `server/routes/partners.ts`, `server/routes/cpaPartners.ts`, `server/routes/borrower/partnerOrders.ts`, `server/routes/staff-invites.ts`
- **Client** — `client/src/pages/agent-broker/PartnersHub.tsx`, `client/src/pages/agent-broker/PartnersJoin.tsx`, `client/src/pages/agent-broker/PartnerLanding.tsx`, `client/src/pages/agent-broker/ReferralLanding.tsx`, `client/src/pages/agent-broker/FindAnAgent.tsx`, `client/src/pages/agent-broker/CpaPortal.tsx`, `client/src/pages/public/PartnerWaitlist.tsx`, `client/src/pages/public/RedeemInvite.tsx`, `client/src/components/ReferralLink.tsx`, `client/src/lib/pendingAttribution.ts`
- **Shared / schema** — `shared/schema/partners.ts`, `shared/schema/cpaPartners.ts`
- **Owned tests** — 5 files, listed in the agent

### 28. Realtor engine

**Owner:** `hq-realtor-engine-owner`

What it does:

- Give an agent a fast, honest read on whether a deal can be saved — and say plainly when it cannot.
- A closing guarantee is a commitment with conditions; the conditions must be visible wherever the guarantee is.
- Nothing here is a peripheral that may block a funded loan.

- **Server** — `server/routes/borrower/guaranteesHomeowner.ts`
- **Client** — `client/src/pages/realtor-engine/`

### 29. Homeowner and post-close retention surface

**Owner:** `hq-homeowner-owner`

What it does:

- A closed borrower keeps a reason to come back — equity, a rate change, an annual review.
- A refi alert is triggered by real pricing movement, never by a schedule pretending to be one.
- An equity figure is an estimate and is labelled as one.

- **Server** — `server/storage/realtorHomeowner.ts`
- **Client** — `client/src/pages/homeowner/HomeownerDashboard.tsx`, `client/src/pages/homeowner/homeownerDashboard/`

### 30. Admin console

**Owner:** `hq-admin-console-owner`

What it does:

- **Role gates mirror exactly** between `shared/roles.ts`, the server `requireRole` and the client route gate. A client-only gate is not a gate.
- A role change is an audited event.
- The pre-launch gate swaps the public surface for a waitlist and **fails closed** — a misconfigured gate must hide the app, not reveal it.

- **Server** — `server/routes/admin.ts`, `server/storage/users.ts`, `server/storage/content.ts`, `server/storage/stats.ts`, `server/services/maintenanceMode.ts`, `server/services/prelaunchGate.ts`, `server/middleware/betaGate.ts`
- **Client** — `client/src/pages/admin/AdminDashboard.tsx`, `client/src/pages/admin/AdminUsers.tsx`, `client/src/pages/admin/AdminContent.tsx`, `client/src/pages/admin/adminContent/`, `client/src/pages/admin/AdminPartners.tsx`, `client/src/pages/admin/AdminPartnerWaitlist.tsx`, `client/src/pages/admin/Lenders.tsx`, `client/src/pages/admin/AdminCharts.tsx`, `client/src/pages/admin/AdminEntityDialog.tsx`
- **Shared / schema** — `shared/roles.ts`, `shared/companyIdentity.ts`
- **Owned tests** — 5 files, listed in the agent

### 31. Financial reporting and compensation

**Owner:** `hq-compensation-owner`

What it does:

- **LO compensation may not vary with a term of the transaction.** That is the rule the whole area exists to enforce.
- The compensation election interacts with the QM points-and-fees cap — the gate between them is deterministic.
- Commission arithmetic is bounded: no unbounded multiplier, no hardcoded fallback rate.

- **Client** — `client/src/pages/admin/FinancialReports.tsx`, `client/src/pages/staff/borrowerFile/CompensationCard.tsx`
- **Shared / schema** — `shared/compensationLedger.ts`, `shared/compensationClawback.ts`, `shared/commissionPayout.ts`, `shared/revenueRecognition.ts`, `shared/costLedger.ts`, `shared/compliance/loCompensation.ts`
- **Owned tests** — 5 files, listed in the agent

### 32. Compliance analytics, HMDA and fair lending

**Owner:** `hq-hmda-fairlending-owner`

What it does:

- Demographic collection carries **the required disclosure**, and declining to answer is a first-class outcome.
- **Demographics never influence a decision.** They are collected for Reg C and analysed after the fact.
- Disparity analysis compares against real ingested peer data, not an internal assumption.

- **Server** — `server/routes/underwriting/compliance.ts`, `server/services/fairLendingAnalysis.ts`, `server/services/hmdaIngestService.ts`, `server/services/complaintEscalation.ts`
- **Client** — `client/src/pages/borrower/HmdaDemographics.tsx`, `client/src/pages/borrower/hmda/`, `client/src/pages/staff/staffDashboard/ComplianceTab.tsx`
- **Shared / schema** — `shared/compliance/complaintEscalation.ts`
- **Owned tests** — 3 files, listed in the agent

### 33. Authentication, sessions and account security

**Owner:** `hq-auth-owner`

What it does:

- **This area is almost entirely hand-back.** Its server files are on the always-off-limits list; you diagnose precisely and a human applies the change. That is the design, not a limitation to work around.
- Client route gates and the sidebar read from **one** source, so a gate cannot drift between them.
- A client gate is a convenience. The server gate is the security boundary, and both must agree.

- **Client** — `client/src/pages/public/Login.tsx`, `client/src/pages/public/Signup.tsx`, `client/src/pages/public/ForgotPassword.tsx`, `client/src/pages/public/ResetPassword.tsx`, `client/src/pages/public/VerifyEmail.tsx`, `client/src/pages/profile/Profile.tsx`, `client/src/components/SocialLoginButtons.tsx`, `client/src/hooks/useAuth.ts`, `client/src/hooks/useAuthGuard.ts`, `client/src/lib/roleRoutes.ts`, `client/src/lib/routeGates.ts`, `client/src/lib/logout.ts`, `client/src/components/app-sidebar.tsx` *(provisional, assigned 2026-08-22 by the staff-journey PR — was unowned; move if a better home exists; it renders the role gates this area owns)*
- **Hand-back only** — `server/auth.ts`, `server/socialAuth.ts`, `server/integrations/auth/`, `server/services/accountRecovery.ts`, `server/services/loginLockout.ts`, `server/clientIp.ts`, `server/trustProxy.ts`
- **Owned tests** — 8 files, listed in the agent

### 34. PII protection, encryption and the audit log

**Owner:** `hq-pii-vault-owner`

What it does:

- **This area is almost entirely hand-back.** The vault files are off limits; you diagnose and a human applies.
- Anything touching borrower PII goes through the encryption service, and **every access gets an audit entry**.
- A call site that encrypts or decrypts is as much a security surface as the vault itself — that is why callers are their own §9 trigger.

- **Server** — `server/auditLog.ts`
- **Hand-back only** — `server/services/encryptionService.ts`, `server/services/ssnVault.ts`, `server/services/piiVault.ts`
- **Owned tests** — 2 files, listed in the agent

### 35. Marketing, SEO and education content

**Owner:** `hq-seo-content-owner`

What it does:

- **Reg Z trigger terms** — quoting a rate, a payment, a term or a down payment obliges the full disclosure on the same page.
- **Reg N: never represent an approval that has not happened.** No "get approved", no "you qualify".
- TCPA consent is captured with provenance on every lead form.

- **Server** — `server/routes/seo.ts`, `server/prerender.ts`, `server/spaCatchAll.ts`, `server/middleware/httpCache.ts`, `server/seedData/educationContent.ts`
- **Client** — `client/src/pages/public/Landing.tsx`, `client/src/pages/public/Refinance.tsx`, `client/src/pages/public/VALoans.tsx`, `client/src/pages/public/SelfEmployed.tsx`, `client/src/pages/public/FirstTimeBuyer.tsx`, `client/src/pages/public/Waitlist.tsx`, `client/src/pages/public/Privacy.tsx`, `client/src/pages/public/Terms.tsx`, `client/src/pages/public/Disclosures.tsx`, `client/src/pages/education/`, `client/src/components/SEOHead.tsx`, `client/src/components/EmailCaptureModal.tsx`, `client/src/components/ConversionCTA.tsx`, `client/src/components/PresalesDisclaimer.tsx`, `client/src/lib/structuredData.ts`, `client/src/lib/glossary.ts`, `client/src/lib/prelaunch.ts`
- **Shared / schema** — `shared/seo/`
- **Owned tests** — 4 files, listed in the agent

### 36. Data intelligence and analytics

**Owner:** `hq-data-intel-owner`

What it does:

- Outcomes feed back into prediction, so accuracy is measured rather than assumed.
- **A prediction is never a decision.** It ranks attention; it does not qualify anybody.
- Analytics events are anonymised where they describe a borrower, and the anonymisation is real.

- **Server** — `server/routes/data-intelligence.ts`, `server/routes/intelligence.ts`, `server/services/analyticsEventPipeline.ts`, `server/services/outcomeTracker.ts`, `server/services/intentTracker.ts`, `server/services/predictiveEngine.ts`, `server/services/signalEngine.ts`, `server/services/borrowerGraph.ts`, `server/services/borrowerEntityResolution.ts`
- **Client** — `client/src/pages/staff/IntelligenceTab.tsx`, `client/src/components/borrower/PredictionInsights.tsx`, `client/src/hooks/useActivityTracker.ts`
- **Shared / schema** — `shared/schema/intelligence.ts`
- **Owned tests** — 2 files, listed in the agent

### 37. Market data and competitive intelligence

**Owner:** `hq-market-data-owner`

What it does:

- A benchmark states its source and its date. An undated comparison is not intelligence.
- An undercut quote is a staff tool, not a borrower-facing offer.
- Ingested peer data is treated as untrusted input and parsed defensively.

- **Server** — `server/routes/market-data.ts`, `server/services/marketDataParsers.ts`
- **Client** — `client/src/pages/staff/PricingIntelligence.tsx`
- **Shared / schema** — `shared/schema/marketData.ts`
- **Owned tests** — 1 files, listed in the agent

### 38. MCP server (the agent tool surface)

**Owner:** `hq-mcp-owner`

What it does:

- **Agent identity is enforced before any tool runs.** An unidentified caller gets nothing.
- **A bad agent token is fatal, never a downgrade.** There is no reduced-capability fallback.
- The soft-pull gate enforces permissible purpose exactly as the product path does — an agent is not a bypass.

- **Server** — `server/mcp/`
- **Owned tests** — 3 files, listed in the agent

### 39. Background jobs and scheduled sweeps

**Owner:** `hq-jobs-cron-owner`

What it does:

- Every job is **authenticated by a shared secret** — an unauthenticated sweep endpoint is an open door into production state.
- A job is idempotent: running it twice does not double anything.
- The schedule in the workflow file and the routes here agree; a job that exists on only one side is invisible.

- **Server** — `server/routes/jobs.ts`
- **Owned tests** — 1 files, listed in the agent

### 40. Observability, error monitoring and request-level operations

**Owner:** `hq-observability-owner`

What it does:

- **An error the user sees says something true and actionable**, and the detail reaches monitoring rather than the browser.
- Rate limits are policy, in one place, and the auth limiter is separate from the general one.
- Every request crossing the trust boundary is validated with Zod before anything touches it.

- **Server** — `server/routes/monitoring.ts`, `server/services/errorMonitoring.ts`, `server/services/rateLimitPolicy.ts`, `server/http/dbErrors.ts`, `server/http/routeParams.ts`, `server/routes/validate.ts`, `server/routes/queryParams.ts`, `server/app.ts`
- **Client** — `client/src/components/AppErrorBoundary.tsx`, `client/src/lib/errorReporter.ts`
- **Owned tests** — 10 files, listed in the agent

### 41. CI, the guard fleet and repository tooling

**Owner:** `hq-ci-guards-owner`

What it does:

- **A ratchet only ever moves down.** Raising a baseline to make a build pass defeats the whole mechanism — move the bytes, fix the violation.
- **A guard only answers its own question.** When a guard misses something, the fix is usually a new question, not a wider glob.
- The gate must be fast enough that a PR survives one CI cycle.

- **Owned tests** — 8 files, listed in the agent

---

## Keeping this file true

- An owner that gains or loses a file fixes its row **in the same PR**. `pnpm guard:citations` fails on a
  path that stopped resolving, so a silent drift here becomes a red gate rather than a stale document.
- Adding or retiring an owner means editing the agent file and this table together. A definition that
  nothing records is the same failure shape as a routine that nothing registers.
- `knowledge-base/feature-review/DOMAINS.md` partitions the same code into 13 **review** domains. These 41
  areas are a refinement of that partition, not a rival taxonomy — when the two disagree, one of them is
  wrong and it is worth finding out which.

---

## For routines: dispatching a fix to the area that owns it

The daily build lanes — **Workflow Completion Engine** (09:53) and **Feature Completion Engine**
(12:30) — each pick a target, find one gap, and fix it. Before this map existed they had to
rediscover, every run, which files an area spans, which document is authoritative for it, which
tests own it, and which traps have already cost somebody a day. All of that is written down here
and in the owner agent for that area.

> **Both ends of this are wired.** The dispatch block was added to
> `feature-completion-engine/SKILL.md` and `workflow-completion-engine/SKILL.md` on 2026-08-20.
> Those definitions live in `~/.claude/scheduled-tasks/`, not in this repo, so this paragraph is
> the only in-repo record that the wiring exists — and per CHARTER §11 the in-repo contract wins
> if the two ever disagree. Both engines gate the behaviour on the existence check below, so until
> this file reaches `origin/main` they run exactly as they did before.

**The rule: walk it yourself, then hand the fix to the owner.**

1. Identify the area the gap actually sits in — the roster table above maps every server file,
   client page and shared module to exactly one owner.
2. Invoke that `hq-*-owner` agent with the gap, the evidence, and the file you believe is wrong.
3. It returns the hand-back block in its §7. Land that as your PR.

The owner arrives already knowing its authority chain, its owned tests, the guards it trips, and
its dated traps. You keep the walking, the evidence and the PR; it removes the orientation.

**Three things this must not become.**

- **Not an excuse to skip your own rails.** The owner inherits `.claude/agents/_OWNER_RAILS.md`;
  your routine's rails still bind you. Where they differ, the stricter one wins.
- **Not a way around a hand-back.** Some areas own files on the always-off-limits list — the PII
  vault, auth, the three underwriting engines, object storage, outbound messaging,
  `shared/lib/amortization.ts`, the furnishing gate. When an owner says hand-back, that is the
  answer. Ship the failing test and the proposal; do not fix it yourself because the owner
  declined. **An owner refusing to edit is the control working, not an obstacle.**
- **Not a claim you skipped.** `knowledge-base/routines/REGISTER.md` still decides who may write a
  file today. A file in another session's open PR is claimed no matter who owns it.

**If this file is not on `origin/main` yet, none of the above applies** — check with
`git cat-file -e origin/main:knowledge-base/handbook/FEATURE_MAP.md` and fall back to your existing
`DOMAINS.md` or `WORKFLOWS.md` rotation. A routine that reads a file which does not exist has not
degraded gracefully; it has failed silently, which is the defect this codebase produces most.

### Coverage, so the rotation can be honest

The live record is `knowledge-base/routines/feature-coverage/LEDGER.md` — one row per area,
seeded with **23 of 41 at `never`**. The **Last reviewed** column below is a *domain* date inherited
from `DOMAINS.md` and is deliberately not treated as an area walk; the ledger explains why.


The roster's **Last reviewed** column is the rotation's oldest-first input. As of 2026-08-19,
**23 of 41 areas had never been reviewed at all** — review domains 9 through 13 have never run, and
market data and rent reporting map to no review domain. Those are not low-priority rows; they are
unmeasured ones. Prefer them when nothing else is urgent, and update the column when you touch one.
