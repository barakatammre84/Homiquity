# Feature Review — Domain Team Charters

Thirteen domain teams + one cross-cutting UX lens. Each charter lists: subsystems + primary
files, client surfaces, intended-use source docs, and owned tests. A `feature-reviewer` run
takes ONE numbered charter as its brief; the UX lens runs `ux-reviewer` across all surfaces.
Program rules: `CHARTER.md`.

> **Census (verified this session, supersedes the old "37 subsystems / 40 surfaces / 7
> workflows"):** ~**95 backend subsystems** · **88 routed client pages** (95 routes across 13
> nested `client/src/pages/` dirs) · ~**14 end-to-end workflows** (8 fully wired / 4 partial / 2
> broken-from-UI at the 07-08 audit — **both broken flows are wired as of 2026-07-12**, see the
> WORKFLOWS.md ledger). The prior 9-domain taxonomy left ~⅓ of the code unowned — the added domains
> (3 AI Coach/extraction, 4 Verification & credit, 9 Compliance analytics, 10 Borrower graph &
> data intelligence, 12 Property/listings/homeowner) close that gap.

Status ledger (updated by the orchestrator after each run):

| # | Domain | Last reviewed | Result |
|---|---|---|---|
| 1 | Public funnel, acquisition & education | 2026-08-05 | public-funnel-01/02 (P2) fixed `cef2890` + 1 refuted (ApprovalStrength SEO half) — see FINDINGS.md |
| 2 | Application & intake | 2026-08-05 | **intake-01 (P0, TRID) fixed `c27b01e`** + intake-03 same commit + intake-02 fixed `eafdb47` + intake-04 fixed `69104f9`. All Domain 2 findings closed except ux-11 (HMDA/Reg C, blocked on U-8 — regulatory source access). See FINDINGS.md |
| 3 | AI Coach, documents & extraction | — | not yet run |
| 4 | Verification & credit | — | not yet run |
| 5 | Underwriting & decisioning | — | not yet run |
| 6 | Pricing, rates & disclosures | — | not yet run |
| 7 | AUS & lender submission | — | not yet run |
| 8 | GSE delivery & compliance export | — | not yet run |
| 9 | Compliance analytics & adverse action | — | not yet run |
| 10 | Borrower graph & data intelligence | — | not yet run |
| 11 | Staff, partner & pipeline ops | — | not yet run |
| 12 | Property, listings & homeowner | — | not yet run |
| 13 | Security, PII & platform cross-cutting | — | not yet run |
| UX | UI/UX & friction (all surfaces) | 2026-08-05 (scoped: Domains 1–2 surfaces) | Domain 1: ux-06 (P2) fixed `ba7706a` + 1 unverified P3 candidate (LearningCenter no-CTA) + 1 refuted (FAQ dead-end). Domain 2: ux-07/08/09 (P2) fixed + ux-10/12 (P3) fixed — all four commits `b577553`/`73cf877`/`d2ed7dc`/`eb164ef`. Only ux-11 (P2, HMDA/Reg C) still open, blocked on U-8. The corroborated-but-unregistered `AuthGateOverlay` raw-`<a>` candidate (same file as ux-12) remains unverified — see FINDINGS.md; remaining domains 3–13 surfaces not yet run |

---

## 1. Public funnel, acquisition & education

- **Server**: `server/routes/leads.ts`, `server/services/leadNotifications.ts`,
  `server/routes/calculators.ts`, rates via `server/services/rateService.ts`, education content.
- **Client**: `pages/public/*` (Landing, persona LPs, Waitlist, AffordabilityCheck, legal),
  `pages/rates/*`, `pages/calculators/*`, `pages/education/*`, prelaunch gate
  `client/src/lib/prelaunch.ts`, referral landings (`pages/agent-broker/{ReferralLanding,PartnerLanding,ApplyInvite}.tsx`).
- **Intended use**: persona-siloed conversion pages feeding the funnel; prelaunch/waitlist
  gating of soliciting routes; calculators as lead tools.
- **Source docs**: `kb/` landing-page conversion research + GTM battlecards, borrower-acquisition
  playbook, `L1_VISION_AND_SCOPE.md` (was PRODUCT_SPINE), `knowledge-base/handbook/app-guide/01-start-here.md`.
- **Owned tests**: `tests/leads*`, calculator/APR-adjacent units. **Reg Z trigger-term risk** on
  any rate/payment displayed → compliance flag.
- **Wiring note (audit):** #61 Approval Strength + #63 Buying Power/SEO land here (MVP).

## 2. Application & intake

- **Server**: intake portions of `server/routes/lending/` (applications, statusDecisions) + `server/routes/borrower/`
  (URLA save), `server/services/trid.ts` (six-piece trigger, sole writer of `tridTriggeredAt`),
  `server/consentGate.ts`, `server/services/preUnderwriting.ts`, `shared/stageRequirements.ts`,
  `server/services/nextAction.ts`.
- **Client**: `pages/lending/PreApproval.tsx` + `client/src/funnel/*` (preApprovalMachine,
  autosave), `pages/borrower/URLAForm.tsx` + `pages/borrower/urla/*`, consent pages
  (`CreditConsent`, `EConsent`, `HmdaDemographics`), `OnboardingJourney.tsx`.
- **Intended use**: guided pre-approval intake with autosave; URLA completeness; consents gate
  electronic delivery and credit pulls; TRID clock starts exactly at six pieces. **Decisioning
  runs as a server cascade on `POST /api/loan-applications`** (N-002) — assert on the cascade
  outputs, not the dead `instant-decision`/`calculate-*`/`advance-stage` endpoints.
- **Source docs**: `knowledge-base/handbook/app-guide/05-data-flow.md`, `DEVELOPER_PLAYBOOK.md` §2.1–2.2,
  `L1_VISION_AND_SCOPE.md` (was PRODUCT_SPINE), `docs/fannie-mae/` URLA documents.
- **Owned tests**: `tests/preApprovalMachine*`, `tests/trid*`, `tests/intakeSchema*`,
  `tests/stageRequirements*`. **Coverage gap (F-015):** `loanAnalysis.finalizeIntake` (the ECOA
  decision locus) is grep-only, never executed.

## 3. AI Coach, documents & extraction

- **Server**: `server/services/coachingService.ts` + `coachIntake.ts` + `server/routes/coach.ts`,
  `server/extractionService.ts` (Gemini OCR/extraction), `server/services/documentConfidence.ts`,
  `server/routes/documents.ts`, `server/integrations/object_storage/*`.
- **Client**: `pages/education/AICoach.tsx`, `Documents.tsx` + `UploadDocumentDialog`.
- **Intended use**: conversational homebuyer coaching + document extraction feeding
  qualification; uploads via presigned GCS URLs only; **AI never decides** (P1 of
  `AI_GOVERNANCE_POLICY`) — extracted values must pass a human/confidence gate before they
  influence a regulated outcome; sensitive extracted values encrypted; unconfigured Gemini is a
  safe no-op.
- **Source docs**: `knowledge-base/governance/AI_GOVERNANCE_POLICY.md`, `knowledge-base/governance/MODEL_RISK_GOVERNANCE.md`, tax-insight
  pipeline docs (§7216), `knowledge-base/handbook/app-guide/08-services.md`.
- **Owned tests**: `tests/uploadsPresignedOnly*`, `tests/taxInsight*`. **Coverage gap:**
  `coachingService`/`coachIntake`/`extractionService`/`documentConfidence` have **zero tests**.
- **Compliance**: AI-in-decision-path invariant, IRC §7216 (tax info), RESPA §8 (no steering),
  prompt-injection via uploaded documents.

## 4. Verification & credit

- **Server**: `server/plaid.ts` + `server/services/verification.ts` + `server/routes/webhooks.ts`
  (VOA/VOIE), `server/services/creditService.ts` + `server/routes/compliance.ts` (FCRA consent,
  pulls, hash-chained credit audit log), `server/mcp/*` credit tools, `server/consentGate.ts`.
- **Client**: `Verification.tsx`, `IdentityVerification.tsx`, `CreditConsent.tsx`.
- **Intended use**: Day-1-Certainty provenance promotion (three dimensions → VERIFIED →
  decision recalc); FCRA consent required before any pull; credit sim refuses in prod unless
  `CREDIT_VENDOR_MODE=simulation`; raw responses encrypted, never in a response.
- **Source docs**: `DEVELOPER_PLAYBOOK.md` §2.1, `knowledge-base/handbook/app-guide/09-integrations.md`,
  `docs/fannie-mae/` (D1C), FCRA references.
- **Owned tests**: `tests/adverseActionNotice*`, `tests/mcpAudit*`, integration `authRecovery`.
  **Note (D-008):** `creditService.ts:666` uses `Math.random` — violates the deterministic-sim
  ground rule.
- **Compliance**: FCRA, GLBA-style PII.

## 5. Underwriting & decisioning

- **Server**: `server/services/decisionEngine.ts` + `server/underwritingEngine.ts` (**the LIVE
  decision path**), `server/services/ruleEngine.ts` + `server/routes/underwriting-rules.ts`,
  `underwritingNuance.ts`, `preUnderwriting.ts`, `scenarioCatalog.ts`, `loanAnalysis.ts`,
  `shared/dataProvenance.ts`, `shared/stageRequirements.ts`.
  **Trap (audit):** `server/underwriting.ts` *looks* like the engine (its header says so) but is
  a superseded helper — audit `decisionEngine.ts → underwritingEngine.ts`, not it.
- **Client**: `pages/realtor-engine/ScenarioDesk.tsx`, staff `PolicyOps.tsx`, decision surfaces
  in `ApplicationSummary`.
- **Intended use**: deterministic, AI-free decisioning; typed error → human routing; PRELIMINARY
  vs VERIFIED provenance gating; every nuance rule cites its guideline; never auto-deny.
- **Source docs**: `knowledge-base/compliance/UNDERWRITING_SCENARIOS.md`, scenario-engine invariants,
  `DEVELOPER_PLAYBOOK.md` §2.3.
- **Owned tests**: `tests/underwriting*`, `tests/scenarioCatalog*`, `tests/complianceInvariants*`
  (**F-014: this is grep-only, executes nothing — false confidence**), integration
  `pricingUnderwriting`. **Zero-coverage:** `ruleEngine.ts`.
- **Compliance**: Fannie Selling Guide, ECOA/Reg B. Determinism is itself an invariant (any
  nondeterminism/vendor call inside the engine = P0).

## 6. Pricing, rates & disclosures

- **Server**: `server/pricing.ts` (LLPA/PMI), `server/services/pricingAdapter.ts`, `rateService.ts`,
  `loanEstimate.ts`, `apr.ts` (Appendix J solver — the ONLY allowed APR source), `trid.ts` +
  `businessDays.ts`, `server/routes/{rate-sheets,market-data}.ts`, `marketDataParsers.ts`,
  `lookupResolver.ts` + `server/routes/lookup-matrix.ts`, `shared/fannieMae/qmThresholds.ts`.
- **Client**: `pages/lending/{LoanEstimate,LoanOptions,BorrowerDealComparison}.tsx`,
  `pages/staff/PricingMatrices.tsx`.
- **Intended use**: versioned policy matrices (no hardcoded rate cards); APR from the solver
  only; LE within the TRID clock; QM thresholds by note-date.
- **Source docs**: `DEVELOPER_PLAYBOOK.md` §2.4, `docs/fannie-mae/` QM job aid.
- **Owned tests**: `tests/apr*`, `tests/qmThresholds*`, `tests/lookupResolver*`, integration
  `pricingUnderwriting`, `lookupMatrix*`. **✓ verified correct (N-003):** QM P&F + APR-APOR
  tables 2024–26. **F-026:** APR solver omits Appendix J odd-first-period (fine for estimates).
- **Compliance**: TILA/Reg Z §1026.22 + Appendix J, TRID.

## 7. AUS & lender submission

- **Server/shared**: `server/services/ausSubmission.ts` + `server/routes/aus.ts` (DU + LPA,
  env-gated sims that intentionally throw on a real key), `brokerSubmissionReadiness.ts`
  (4-stage), `lenderSubmission.ts` + `shared/wholesaleLenders.ts` (Target-5), `lenderMatchingEngine.ts`.
- **Client**: `SubmissionReadinessDialog.tsx`, submission surfaces in `LoCommandCenter`/`BorrowerFile`,
  `pages/lending/LoanPipeline.tsx`.
- **Intended use**: broker flow — intake/AUS/lenderPackage/deliveryPreflight gates → submission
  blocked until stages 1–3 clean; one adapter seam per lender; sims flagged.
- **Wiring note:** ~~F-003 — AUS DU/LPA submission has no UI trigger~~ **fixed in #135**
  (`SubmissionReadinessDialog.tsx` → `POST /api/underwrite/submit-gse`; Run-DU/LPA verified in
  the 07-12 walkthrough). Still open: confirm with Target-5 lenders whether a DU casefile is
  required at submission.
- **Source docs**: broker/MISMO/PPE strategy docs, `DEVELOPER_PLAYBOOK.md` §2.3.
- **Owned tests**: `tests/lenderSubmission*` (**F-005: determinism flake is a real product bug —
  `mismo.ts:1034` ms timestamp in hashed XML; = PRs #64/#65**), `tests/brokerSubmissionReadiness*`.
- **Compliance**: Reg Z anti-steering §1026.36, TRID, Fannie DU.

## 8. GSE delivery & compliance export — *compliance-auditor mandatory on every finding*

- **Server/shared**: `server/mismo.ts` (ULDD Phase 5 XML), `shared/mismo.ts` (types/enums),
  `mismoValidation.ts`, `loanDeliveryReadiness.ts`, `shared/fannieMae/{loanDeliveryEdits,specialFeatureCodes,ucdFeeEnumerations}.ts`,
  `shared/schema/delivery.ts`.
- **Client**: MISMO export from `LoCommandCenter.tsx`, delivery-readiness in `BorrowerFile.tsx`.
- **Intended use**: valid ULDD Phase 5 MISMO 3.4 XML; single delivery-readiness report; SSN
  decrypted only at the delivery seam.
- **Status (2026-07-12):** the two audit P0s are **fixed** — F-018 container nesting
  (`723cc7d`) and F-019 `LoanPurposeType` enums (`21c4a4b`); F-025's asked-for XSD gate exists
  (baseline test + non-blocking conformance recording at submission, #135). **Still open here:**
  F-020/021/022 enum corrections, F-023 URLA §5 names, and the L6-fix baseline remediation.
  Escalations **U-1…U-7** need founder source confirmation.
- **Source docs**: `docs/fannie-mae/` (spec PDFs + XSDs + golden samples — validate against the
  XSDs), Loan Delivery job aid, `CLAUDE.md` compliance section.
- **Owned tests**: `tests/mismo*`, `tests/loanDeliveryEdits*`, `tests/specialFeatureCodes*`,
  integration `mismoExportAccess`. **F-015:** `loanDeliveryReadiness` (the caller of the tested
  edit engines) has zero tests.

## 9. Compliance analytics & adverse action

- **Server**: `server/services/fairLendingAnalysis.ts`, `hmdaIngestService.ts`,
  `adverseActionDelivery.ts` + `pdfLetterGenerator.ts` + `server/routes/jobs.ts` (30-day
  watchdog cron), `smsCompliance.ts` + `quietHours.ts`, `server/routes/compliance.ts` (HMDA,
  disparate-impact).
- **Client**: `AdverseActionNotice.tsx`, `HmdaDemographics.tsx`.
- **Intended use**: adverse-action sweep meets ECOA 30-day; STOP/quiet-hours gate all outbound
  SMS; fair-lending/HMDA analytics.
- **Launch-critical:** ~~F-004 — adverse-action generation has no UI trigger~~ **closed
  2026-07-12** — generation is a blocking chokepoint on the deny seam
  (`ensureAdverseActionForDenial`; a denial cannot proceed without a compliant notice) plus the
  #123 staff delivery card. **F-008\*** stays open: SMS webhook has no signature verification
  (blocker only if SMS is live — TCPA).
- **Source docs**: `docs/nmls/`, `knowledge-base/governance/TEAM_PRACTICES.md` §9, FCRA/ECOA/TCPA references.
- **Owned tests**: `tests/adverseAction*`, `tests/fairLendingAnalysis*`, `tests/smsCompliance*`,
  `tests/quietHours*`.
- **Compliance**: ECOA/Reg B, FCRA, TCPA, HMDA, fair lending.

## 10. Borrower graph & data intelligence

- **Server**: `server/services/borrowerGraph.ts` (docs call it the single most important
  service), `signalEngine.ts`, `intentTracker.ts`, `activitySummary.ts`, `analyticsEventPipeline.ts`,
  `outcomeTracker.ts`, `predictiveEngine.ts`, `optimizationEngine.ts`, `frictionLog.ts`,
  `server/routes/{data-intelligence,intelligence,optimizations}.ts`.
- **Client**: `pages/staff/IntelligenceTab.tsx`, `PredictionInsights` surfaces.
- **Intended use**: unified 3-tier-trust borrower profile; staff attention-priority feed;
  closed-loop outcomes → predictions/optimizations.
- **Wiring note:** ~~F-002 — `loanOutcomes` writers never called~~ **fixed in #136** (writers
  wired from `pipelineEngine`/`lending`/`underwriting`/`data-intelligence`/`loanAnalysis`).
  Still true (re-verified 2026-07-12): most of `intelligence.ts`/`optimizations.ts` (35+
  endpoints) are dead (no client caller) — decide wire/defer/delete per the dead-surface map;
  the wired client surface (`IntelligenceTab.tsx`) reads `data-intelligence.ts` endpoints.
- **Source docs**: `knowledge-base/handbook/app-guide/08-services.md`, `MODEL_RISK_GOVERNANCE.md`.
- **Owned tests**: **zero** across this cluster (QA priority).

## 11. Staff, partner & pipeline ops

- **Server**: `server/pipelineEngine.ts` (status ladder, conditions, file health),
  `server/services/taskEngine.ts` + `server/routes/task-engine.ts` (SLA, escalation,
  role-scoped access), `borrowerStateMachine.ts`, `lifecycleEngine.ts`, `server/routes/jobs.ts`
  (lifecycle sweeps), CPA-channel routes, admin/staff-invite routes, `emailService.ts` +
  `server/routes/notifications.ts`.
- **Client**: `pages/staff/*`, `pages/agent-broker/*`, `pages/admin/*`,
  `pages/realtor-engine/*`, `pages/borrower/{Tasks,TaskDetail,Messages}.tsx`, deal-team components.
- **Intended use**: LO start-of-day prioritization; pipeline transitions validated with
  materialized conditions; SLA tasks escalate; two staff scoping models (internal-unrestricted
  vs team-scoped); **client gates must match server gates** (`isInternalStaffRole` vs
  `isStaffRole` — D-002 closed 2026-07-08; #119 enforced the separation app-wide).
- **Source docs**: `knowledge-base/handbook/app-guide/08-services.md`, `knowledge-base/logs/lo-audit/*`, access-control notes,
  `knowledge-base/runbooks/support-playbooks/`.
- **Owned tests**: integration `loCommandCenter`, `tests/borrowerStateMachine*`,
  `tests/lifecycleEngine*`, `tests/statusVocabulary*`, `tests/accessControl*`. **F-013:**
  `maintenanceMode.test.ts` runs in neither config. **Coverage:** `pipelineEngine.updatePipelineStage`
  is grep-only.

## 12. Property, listings & homeowner

- **Server**: `server/propertyAnalyzer.ts`, `server/services/valueEstimate.ts` (AVM parse),
  `server/routes/{property,listings,geocode}.ts`, refi/equity in `lifecycleEngine.ts`,
  `shared/schema/property.ts`.
- **Client**: `pages/property/*` (Properties, PropertyDetail, LivePropertyDetail, PropertyForm),
  `pages/borrower/BuyerProperties.tsx`, `pages/homeowner/HomeownerDashboard.tsx`,
  `pages/realtor-engine/*`.
- **Intended use**: property search/affordability; AVM via the `RAPIDAPI_KEY` realty-us adapter
  (unset → simulated/no live value locally); closed-loan graduation → Homeowner Hub with equity
  snapshot + refi alerts (TCPA-gated).
- **Source docs**: property-data-vendor notes, lifecycle-architecture (Incubator/Engine/Portfolio
  separation), `knowledge-base/handbook/app-guide/09-integrations.md`.
- **Owned tests**: `tests/valueEstimate*`, `tests/marketDataParsers*`. **Zero-coverage:**
  `propertyAnalyzer.ts`, property routes.

## 13. Security, PII & platform cross-cutting

- **Server**: `server/services/encryptionService.ts` (KMS envelope, rotation, fails closed),
  `ssnVault.ts` + `piiVault.ts`, `server/auditLog.ts`, `server/auth.ts` + `server/integrations/auth/*`
  + `socialAuth.ts`, `loginLockout.ts` + `accountRecovery.ts`, `rateLimitPolicy.ts`,
  `maintenanceMode.ts` + `prelaunchGate.ts`, `server/services/errorMonitoring.ts` +
  `server/routes/monitoring.ts`, `server/storage.ts` (~5,600-line sole PII write path — concentration
  risk), `server/mcp/*` (AG-1 audit chain, AG-2 identity), `shared/roles.ts`.
- **Client**: auth pages, role-gated layout wrappers (`PrivateLayout` requiredRoles vs server gates).
- **Intended use**: SSNs/accounts ciphertext + last4 only, decryption only at MISMO/AUS seams +
  audited staff reveal; sessions rolling; lockout; consent gate 403s unconsented delivery; MCP
  fails closed in prod; **never add a self-registerable role to STAFF_ROLES** (HIGH escalation,
  commit ae06fd4).
- **Posture (audit): STRONG — no P0, no IDOR, PII-at-rest sound (N-001).** Hardening: **F-006**
  SSN/account *writes* unaudited; **F-007** `/api/admin/users` returns `passwordHash`; **F-009**
  legacy plaintext `ssn` not stripped (verify prod backfill); **F-010** presigned upload trusts
  client type/size; **F-011** Plaid webhook static secret.
- **Source docs**: `knowledge-base/governance/TEAM_PRACTICES.md` §9, `knowledge-base/governance/AI_GOVERNANCE_POLICY.md`,
  `knowledge-base/handbook/app-guide/06-auth-security-secrets.md`.
- **Owned tests**: `tests/accessControl*`, `tests/ssnVault*`, `tests/encryptionRotation*`,
  `tests/loginLockout*`, `tests/adversarialPersonas*`, `tests/mcp*`, integration `authRecovery`.
  **Zero-coverage:** `piiVault.ts`, `auditLog.ts` (general), `socialAuth.ts`.
- **Compliance**: GLBA-style PII, FCRA, ECOA/Reg B.

## UX. UI/UX & friction — cross-cutting, ALL client surfaces (`ux-reviewer`)

Runs over every surface from teams 1–12, on three axes:

- **Uniformity**: design-system conformance (tokens in `client/src/index.css` /
  `tailwind.config.ts`; guard `scripts/design-token-guard.cjs` — anything it flags is a finding),
  consistent shadcn/ui usage, nav/shell coherence, spacing/type drift, responsive
  (375px/tablet/desktop). The live design system is **Royal Blue Emerald** (2026-07-08 repaint,
  #93). ~~Guard blind spot: 157 white/black literals bypass the regex~~ — fixed: the guard now
  ratchets a `whiteBlackLiterals` metric (#112, baseline 97; ux-02 narrowed to the no-CI leg).
- **Friction & psychology**: funnel drop-off, CTA clarity, **loading/empty/error states —
  ux-01, partially addressed** (QueryBoundary error+retry #93/#95 batch 1 + PageShell #131;
  residual count unmeasured — re-count on the next UX run), trust signals near sensitive asks,
  reassurance at anxiety moments, dashboard speed-to-value.
  `PageShell` adoption: 32 pages converged (#131, ux-03 closed); deliberate exceptions in
  `app-guide/07-frontend.md`.
- **Compliance rails on copy**: Reg Z trigger terms (flag to compliance-auditor), no consent
  dark patterns (**audit: consent UX is exemplary — 0 pre-checked boxes**), Reg B denial tone.
- **Builds on the standing system**: cross-reference `knowledge-base/logs/ux-audit/page-audit.md` ids; use
  `psychology-patterns.md` as the copy standard; `component-inventory.csv` for the census.
- **Source docs**: `design_guidelines.md`, `knowledge-base/logs/ux-audit/*`, landing-page research, design skills
  under `.agents/skills/`.
- **Owned checks**: `node scripts/design-token-guard.cjs` (via `npm run checkup`), preview
  screenshots/inspects per surface group. **A11y:** 12/14 property `<img>` lack `alt`.
