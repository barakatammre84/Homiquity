# Feature Review — Domain Team Charters

Nine domain teams. Each charter lists: subsystems + primary files, client surfaces,
intended-use source docs, and owned tests. A `feature-reviewer` run takes ONE numbered charter
as its brief; team 9 runs `ux-reviewer` across all surfaces. Program rules: `CHARTER.md`.

Status ledger (updated by the orchestrator after each run):

| # | Domain | Last reviewed | Result |
|---|---|---|---|
| 1 | Public funnel & acquisition | — | not yet run |
| 2 | Application & intake | — | not yet run |
| 3 | Underwriting & decisioning | — | not yet run |
| 4 | Pricing & disclosures | — | not yet run |
| 5 | GSE delivery & compliance export | — | not yet run |
| 6 | AUS & lender submission | — | not yet run |
| 7 | Staff, partner & pipeline ops | — | not yet run |
| 8 | Security, PII & cross-cutting | — | not yet run |
| 9 | UI/UX & friction (all surfaces) | — | not yet run |

---

## 1. Public funnel & acquisition

- **Server**: `server/routes/leads.ts`, `server/services/leadNotifications.ts`,
  `server/routes/calculators.ts`, `server/routes/rate-sheets.ts`, rates via
  `server/services/rateService.ts`, education content routes.
- **Client**: `pages/public/` (Landing, Refinance, VALoans, SelfEmployed, FirstTimeBuyer,
  Waitlist, AffordabilityCheck, legal pages), `pages/rates/*`, `pages/calculators/*`,
  `pages/education/*` (LearningCenter, DownPaymentWizard, FirstTimeBuyerHub, Glossary, FAQ),
  prelaunch gate `client/src/lib/prelaunch.ts`, referral landings
  (`pages/agent-broker/ReferralLanding.tsx`, `PartnerLanding.tsx`, `ApplyInvite.tsx`).
- **Intended use**: persona-siloed conversion pages feeding the application funnel;
  prelaunch/waitlist gating of transaction-soliciting routes; calculators as lead tools.
- **Source docs**: `kb/` landing-page conversion research + GTM battlecards,
  borrower-acquisition playbook docs, `PRODUCT_SPINE.md` (Calculators/Education modules),
  `kb/app-guide/01-start-here.md`.
- **Owned tests**: `tests/leads*` (integration: `leads`), calculator/APR-adjacent units where
  rates are displayed. Note: public pages showing rates/payments carry Reg Z trigger-term risk
  → compliance flag.

## 2. Application & intake

- **Server**: intake portions of `server/routes/lending.ts`, `server/services/trid.ts`
  (six-piece trigger, sole writer of `tridTriggeredAt`), `server/consentGate.ts`,
  `server/routes/documents.ts`, `server/integrations/object_storage/`, `server/plaid.ts`,
  `server/services/verification.ts`, `server/extractionService.ts` (Gemini extraction),
  `server/services/preUnderwriting.ts` (intake-completion hook).
- **Client**: `pages/lending/PreApproval.tsx` + `client/src/funnel/*` (preApprovalMachine,
  autosave), `pages/borrower/URLAForm.tsx` + `pages/borrower/urla/*`, `Documents.tsx` +
  `UploadDocumentDialog`, `Verification.tsx`, `IdentityVerification.tsx`, consent pages
  (`CreditConsent`, `EConsent`, `HmdaDemographics`), `OnboardingJourney.tsx`.
- **Intended use**: guided pre-approval intake with autosave; URLA completeness; uploads via
  presigned GCS URLs only; consents gate electronic delivery and credit pulls; TRID clock
  starts exactly at six pieces.
- **Source docs**: `kb/app-guide/05-data-flow.md` ("A Loan's Journey"),
  `DEVELOPER_PLAYBOOK.md` §2.1–2.2, `PRODUCT_SPINE.md` (Borrower Package),
  `docs/fannie-mae/` URLA documents.
- **Owned tests**: `tests/preApprovalMachine*`, `tests/trid*`, `tests/uploadsPresignedOnly*`,
  document/extraction units, `tests/taxInsight*`.

## 3. Underwriting & decisioning

- **Server**: `server/underwritingEngine.ts`, `server/underwriting.ts`,
  `server/services/decisionEngine.ts`, `server/services/ruleEngine.ts` +
  `server/routes/underwriting-rules.ts`, `server/services/underwritingNuance.ts`,
  `server/services/preUnderwriting.ts`, `server/services/scenarioCatalog.ts`,
  `server/services/loanAnalysis.ts`, `server/routes/underwriting.ts`,
  `shared/dataProvenance.ts`, `shared/stageRequirements.ts`.
- **Client**: `pages/realtor-engine/ScenarioDesk.tsx`, staff `PolicyOps.tsx`, decision
  surfaces in borrower dashboard / `ApplicationSummary`.
- **Intended use**: deterministic, AI-free decisioning (same inputs → same outcome), typed
  error classification routing to humans; PRELIMINARY vs VERIFIED provenance gating binding
  outcomes; every nuance rule cites its guideline; never auto-deny (ECOA adverse-action path).
- **Source docs**: `kb/UNDERWRITING_SCENARIOS.md` (scenario catalog), scenario-engine
  invariants, `kb/app-guide/08-services.md`, `DEVELOPER_PLAYBOOK.md` §2.3.
- **Owned tests**: `tests/underwriting*` (nuance, edge cases, pre-underwriting),
  `tests/scenarioCatalog.test.ts`, `tests/runUnderwritingTestSuite.ts`,
  `tests/complianceInvariants*`, `tests/borrowerStateMachine*` (decision-adjacent),
  integration `pricingUnderwriting`.
- **Compliance**: Fannie Selling Guide cites, ECOA/Reg B. Determinism is itself an invariant —
  any nondeterminism or vendor call inside the engine is a P0.

## 4. Pricing & disclosures

- **Server**: `server/pricing.ts` (LLPA/PMI matrices), `server/services/pricingAdapter.ts`,
  `server/services/rateService.ts`, `server/services/loanEstimate.ts`,
  `server/services/apr.ts` (Appendix J actuarial solver — the ONLY allowed APR source),
  `server/services/trid.ts` + `server/services/businessDays.ts` (LE 3-business-day clock),
  `server/routes/rate-sheets.ts`, `server/seedLendingGrids.ts`,
  `server/services/lookupResolver.ts` + `server/routes/lookup-matrix.ts`.
- **Client**: `pages/lending/LoanEstimate.tsx`, `pages/staff/PricingMatrices.tsx`,
  `pages/lending/LoanOptions.tsx`, `BorrowerDealComparison.tsx`.
- **Intended use**: versioned policy matrices (no hardcoded rate cards); APR from the solver
  only (flat spreads = TILA violation); LE generated within the TRID clock; QM thresholds by
  note-date (`shared/fannieMae/qmThresholds.ts`).
- **Source docs**: `DEVELOPER_PLAYBOOK.md` §2.4, `kb/app-guide/08-services.md`, CFPB/Fannie QM
  job aid in `docs/fannie-mae/`.
- **Owned tests**: `tests/apr*`, `tests/qmThresholds*`, `tests/lookupResolver*`, integration
  `pricingUnderwriting`, `lookupMatrixLifecycle`, `lookupMatrixCoverageGap`.
- **Compliance**: TILA/Reg Z §1026.22 + Appendix J, TRID.

## 5. GSE delivery & compliance export — *compliance-auditor mandatory on every finding*

- **Server/shared**: `server/mismo.ts` (ULDD Phase 5 XML), `shared/mismo.ts` (types/enums),
  `server/services/mismoValidation.ts` (URLA gating + QM points-and-fees),
  `server/services/loanDeliveryReadiness.ts`, `shared/fannieMae/loanDeliveryEdits.ts`,
  `shared/fannieMae/specialFeatureCodes.ts`, `shared/fannieMae/ucdFeeEnumerations.ts`,
  `shared/schema/delivery.ts`.
- **Client**: MISMO export from `pages/staff/LoCommandCenter.tsx`, delivery-readiness surfaces
  in `BorrowerFile.tsx`.
- **Intended use**: generate valid ULDD Phase 5 MISMO 3.4 XML; single delivery-readiness
  report (URLA completeness → ULDD shape → edit mirror → SFC derivation); SSN decrypted only
  at the delivery seam.
- **Source docs**: `docs/fannie-mae/` (spec PDFs + XSD schemas + golden samples — validate
  against the XSDs where possible), Loan Delivery job aid (fetch), `CLAUDE.md` compliance
  section.
- **Owned tests**: `tests/mismo*` (validation, export, MERS MIN, XSD validation),
  `tests/loanDeliveryEdits*`, `tests/specialFeatureCodes*`, integration `mismoExportAccess`.

## 6. AUS & lender submission

- **Server/shared**: `server/services/ausSubmission.ts` + `server/routes/aus.ts` (DU + LPA,
  env-gated sims), `server/services/brokerSubmissionReadiness.ts` (4-stage derivation),
  `server/services/lenderSubmission.ts` + `shared/wholesaleLenders.ts` (Target-5, status
  machine, readiness snapshot audit), `server/services/lenderMatchingEngine.ts` +
  `server/services/borrowerGraph.ts`.
- **Client**: submission surfaces in `LoCommandCenter.tsx` / `BorrowerFile.tsx`,
  `SubmissionReadinessDialog.tsx`, `pages/lending/LoanPipeline.tsx`.
- **Intended use**: broker-model flow — intake gates (URLA/TRID/e-disclosure) → AUS gate →
  lender package (MISMO validity, docs, QM pre-flight, Reg Z anti-steering §1026.36(e)(3)) →
  informational delivery preflight; submission blocked until stages 1–3 clean; one adapter
  seam per lender portal; simulations clearly flagged until broker agreements exist.
- **Source docs**: broker/MISMO/PPE strategy docs in `kb/`, `DEVELOPER_PLAYBOOK.md` §2.3,
  wholesale-lender catalog rationale.
- **Owned tests**: `tests/lenderSubmission*` (known pre-existing determinism flake — do not
  re-report as new), `tests/brokerSubmissionReadiness*`, AUS units.
- **Compliance**: Reg Z anti-steering, TRID, Fannie DU.

## 7. Staff, partner & pipeline ops

- **Server**: `server/pipelineEngine.ts` (status ladder, conditions, file health),
  `server/services/taskEngine.ts` + `server/routes/task-engine.ts` (SLA classes, escalation,
  role-scoped access), `server/services/borrowerStateMachine.ts`,
  `server/services/lifecycleEngine.ts` + `nextAction.ts`, `server/services/signalEngine.ts` +
  `fileHealth.ts` (staff prioritization), CPA-channel routes (PR #66), admin routes.
- **Client**: `pages/staff/*` (StaffDashboard, LoCommandCenter, BorrowerFile, TaskOperations,
  PolicyOps, IntelligenceTab), `pages/agent-broker/*` (BrokerDashboard, AgentDashboard/Edit/
  Pipeline, InviteGenerator, AgentCoBranding, PartnerServices, FindAnAgent),
  `pages/admin/*`, `pages/realtor-engine/*` (DealRescue, StrategySessions, ClosingGuarantee),
  `pages/borrower/Tasks.tsx`/`TaskDetail.tsx`, `Messages.tsx`, deal-team components.
- **Intended use**: LO start-of-day prioritization (File Health, signals); pipeline
  transitions validated with materialized conditions; SLA tasks escalate; two staff scoping
  models — internal-unrestricted vs team-scoped (broker/lender scoped to referred apps);
  client gates must match server gates (`isInternalStaff` vs `isStaff` distinction).
- **Source docs**: `kb/app-guide/08-services.md`, LO-audit docs (`kb/lo-audit/`),
  LO-partner GTM docs, access-control model notes, `kb/support-playbooks/`.
- **Owned tests**: integration `loCommandCenter`, `tests/borrowerStateMachine*`,
  `tests/lifecycleEngine*`, `tests/stageRequirements*`, `tests/statusVocabulary*`,
  task-engine units, `tests/accessControl*` (shared with team 8).

## 8. Security, PII & cross-cutting

- **Server**: `server/services/encryptionService.ts` (KMS envelope, rotation, fails closed),
  `server/services/ssnVault.ts` + `piiVault.ts`, `server/auditLog.ts` (+ hash-chained credit
  audit log), `server/auth.ts` + `server/integrations/auth/*` + `server/socialAuth.ts`,
  `server/services/loginLockout.ts` + `accountRecovery.ts`, `server/consentGate.ts`,
  `server/services/creditService.ts` + `server/routes/compliance.ts`,
  `server/services/adverseActionDelivery.ts` + `pdfLetterGenerator.ts` +
  `server/routes/jobs.ts` (30-day watchdog cron), `server/services/smsCompliance.ts` +
  `quietHours.ts`, `server/services/fairLendingAnalysis.ts`, `server/mcp/*` (AG-1 audit
  chain, AG-2 identity, vendor adapters), `shared/roles.ts`.
- **Client**: auth pages, `AdverseActionNotice.tsx`, role-gated layout wrappers
  (`PrivateLayout` requiredRoles vs server gates).
- **Intended use**: SSNs/accounts ciphertext + last4 only, decryption only at MISMO/AUS seams
  + audited staff reveal; sessions 12h rolling; lockout; consent gate 403s unconsented
  delivery; adverse-action sweep meets ECOA 30-day; STOP/quiet-hours gate all outbound SMS;
  MCP fails closed in prod; **never add a self-registerable role to STAFF_ROLES** (HIGH
  escalation precedent, commit ae06fd4).
- **Source docs**: `kb/TEAM_PRACTICES.md` §9 (security-review triggers),
  `kb/AI_GOVERNANCE_POLICY.md`, `kb/MODEL_RISK_GOVERNANCE.md`,
  `kb/app-guide/06-auth-security-secrets.md`.
- **Owned tests**: `tests/accessControl*`, `tests/ssnVault*`, `tests/encryptionRotation*`,
  `tests/loginLockout*`, `tests/adversarialPersonas*`, `tests/mcpAudit*`,
  `tests/mcpAgentIdentity*`, `tests/smsCompliance*`, `tests/quietHours*`,
  `tests/adverseAction*`, `tests/fairLendingAnalysis*`, integration `authRecovery`.
- **Compliance**: GLBA-style PII, FCRA, ECOA/Reg B, TCPA, fair lending.

## 9. UI/UX & friction — cross-cutting, ALL client surfaces (`ux-reviewer`)

Runs over every surface from teams 1–8, on three axes:

- **Uniformity**: Charcoal Emerald conformance (tokens in `client/src/index.css` /
  `tailwind.config.ts`; guard `scripts/design-token-guard.cjs` — anything it flags is a
  finding), layer rules, AA contrast pairs, consistent shadcn/ui usage, nav/shell coherence,
  spacing/type drift, responsive (375px/tablet/desktop) + dark mode.
- **Friction & psychology**: funnel drop-off (form length vs progressive profiling), CTA
  clarity, loading/empty/error states, trust signals near sensitive asks (SSN, credit
  consent, uploads), defaults, reassurance at anxiety moments (credit pull, denial,
  underwriting wait), dashboard speed-to-value.
- **Compliance rails on copy**: Reg Z trigger terms on rate/payment claims (flag to
  compliance-auditor), no consent dark patterns (ESIGN), Reg B-consistent denial tone.
- **Builds on the standing system — does not duplicate it**: cross-reference
  `kb/ux-audit/page-audit.md` issue ids; use `kb/ux-audit/psychology-patterns.md` copy
  patterns as the reference standard; `component-inventory.csv` for component census.
- **Source docs**: `design_guidelines.md`, `kb/ux-audit/*`, landing-page conversion research,
  design skills under `.agents/skills/`.
- **Owned checks**: `node scripts/design-token-guard.cjs` (via `npm run checkup`), preview
  screenshots/inspects per surface group.
