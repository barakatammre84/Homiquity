# 08 — Service Catalog

Business logic lives in [`server/services/`](../../../server/services/) plus a few
root-level `server/*.ts` modules. One line each — read the file when you need
depth.

## Core loan-processing

| Service | Does |
|---------|------|
| `borrowerGraph.ts` | **The** read layer: aggregates all borrower data into one profile with 3-tier trust (self-reported → documented → verified) |
| `borrowerStateMachine.ts` | Tracks/advances a borrower's journey stage; writes state history |
| `decisionEngine.ts` | Instant-decision orchestrator: completeness → pricing → deterministic underwrite; stamps immutable decision snapshots on every recalc trigger |
| `loanAnalysis.ts` | Deterministic intake analysis (replaced the retired Gemini path): engine decision + rule-cited analysis strings + illustrative scenarios; never sets `denied` (ECOA locus) |
| `ruleEngine.ts` | Evaluates the deterministic underwriting rules DSL |
| `../underwritingEngine.ts` | Fannie/Freddie-aligned underwriting evaluation |
| `../underwriting.ts` | Underwriting orchestration/entry |
| `../pricing.ts` | LLPA (loan-level price adjustment) math |
| `pricingAdapter.ts` | Composes offers: base rate + LLPA + lock term + lender adjustments across rate sheets |
| `rateService.ts` | Fetches/refreshes market mortgage rates (RapidAPI); advertised APRs come from `apr.ts`, never flat spreads |
| `apr.ts` | Actuarial APR solver (Reg Z §1026.22 / Appendix J) — every displayed APR (ads, LE) must come from here; includes the representative fee model for advertised rates |
| `loanEstimate.ts` | Loan estimate calculations; APR via `apr.ts`, TRID timing via `businessDays.ts` anchored to `tridTriggeredAt` |
| `lenderMatchingEngine.ts` | Matches borrowers to lender products |
| `../pipelineEngine.ts` | Loan pipeline stage logic for staff views; `PipelineSummary` carries `daysIdle` + `fileHealth` for the LO Command Center |
| `fileHealth.ts` | Pure, deterministic green/yellow/red "No-Stall" light per file (48h-idle stall, 30-day pipeline age, stage-amount coherence, condition pile-up); Reg B — no model input |

## Income engine (UAL P1–P6, merged 2026-07-11)

The complex-borrower income engine: AI reads documents (provisional), deterministic
cited math qualifies, a human confirms before anything reaches a lender package.
Charter: [`specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md`](../../specs/) (PR #102).

| Service | Does |
|---------|------|
| `income/orchestrator.ts` | **The single income producer** (P3): pure `computeIncomePaths` core + IO loader; runs every applicable path in one pass; primary DTI income = sum of applied component paths; SHA-256 fingerprints persisted to `income_path_evaluations` |
| `income/paths/*` | One module per path: `agencyWage` (reconciles the two legacy income impls), `selfEmployment` (wraps the 1084 calculator), `rental` (cited, advisory — never auto-applied), `dscr` + `bankStatement` (non-QM; enabled only with `docs/lender-programs/` citations per the P4 gate; DSCR is ratio-only — no in-repo qualifying threshold) |
| `selfEmploymentIncome.ts` | Deterministic Fannie Form 1084 self-employment calculator (B3-3.5 / B3-3.6 cited): Schedule C add-backs, K-1 distribution/liquidity gate, 2-yr averaging with conservative declining/single-year handling (P1) |
| `situationClassifier.ts` | `SituationProfile` (P2c): deterministic structural FACTS over resolved entities + tie-outs — flags, income-path signals, document requests; append-only with an inputs fingerprint; a processing/readiness signal, **never** an underwriting input |
| `borrowerEntityResolution.ts` | Resolves the borrower's business entities across uploaded tax forms (P2b) |
| `taxReconciliation.ts` | Deterministic cross-form tie-out checks cited to `docs/irs-forms/` (P2b); tolerances are pure rounding bounds — no invented thresholds |
| `worksheetPrefill.ts` | Smart-fill drafts for the SE worksheet from document extractions with per-field provenance; confirm-only write path — a draft is never persisted as truth (P5) |
| `income/reviewTriage.ts` | Deterministic exception-triage tiers feeding the `review_items` workbench; confirmations stamp `humanVerified` + trigger recalc (P5) |
| `incomeAnalysisPackage.ts` | The cited income narrative shipped to wholesale lenders alongside the MISMO package (P6): per-path math + citations, confirmed worksheets, hash-only document manifest; per-lender non-QM shaping via `wholesaleLenders.nonQm` |

## Documents & AI

| Service | Does |
|---------|------|
| `../extractionService.ts` | Runs AI extraction on uploaded docs (paystub/W-2/bank statement/tax return) — **owns its own Anthropic (Claude) client**; there is no separate pluggable AI-gateway module (the old `aiGateway.ts` was removed) |
| `documentConfidence.ts` | Scores extraction trustworthiness |
| `taxInsightService.ts` | Derives readiness signals from consumer-uploaded tax returns (the §7216-safe consumer-direct path; routes in `server/routes/taxInsights.ts`) |
| `coachingService.ts` + `coachIntake.ts` | AI Homebuyer Coach (OpenAI) + its structured intake |

## Compliance & security

| Service | Does |
|---------|------|
| `creditService.ts` | FCRA chain: consent capture, credit pulls (soft/hard), adverse action, hash-chained audit log. Denial via the status route auto-generates the Reg B notice (reasons mapped from the HMDA list) |
| `trid.ts` | TRID six-piece trigger (§1026.2(a)(3)): sole writer of `tridTriggeredAt`, starts the 3-business-day LE clock, hard-stops forward status/stage moves when the LE is overdue |
| `businessDays.ts` | Shared TRID business-day math (weekends + federal holidays) — never reimplement with calendar arithmetic |
| `encryptionService.ts` | Field encryption, PII hashing, audit hash-chaining |
| `mismoValidation.ts` + `../mismo.ts` | MISMO 3.4 XML export + GSE/ULDD validation. ATR/QM points-and-fees uses the tiered Reg Z caps from `shared/fannieMae/qmThresholds.ts` (note-date-year tables) |
| `loanDeliveryReadiness.ts` | Fannie Mae delivery-readiness workflow: URLA gating + Loan Delivery/UCD/EarlyCheck edit mirror + SFC derivation, over the `loan_delivery_data` row. Pure rules live in `shared/fannieMae/` (`qmThresholds.ts`, `specialFeatureCodes.ts`, `loanDeliveryEdits.ts`, `ucdFeeEnumerations.ts`), all transcribed from `docs/fannie-mae/` job aids — never extend from memory. Routes: `GET /api/loan-applications/:id/delivery-readiness`, `PUT .../delivery-data` (internal staff) |
| `brokerSubmissionReadiness.ts` | Broker submission workflow: staged gate intake/TRID → DU → wholesale-lender package (MISMO validity, docs, QM pre-flight, anti-steering §1026.36(e)(3)) with the delivery edits as an informational lender's-eye pre-flight that never blocks. Pure stage derivation is unit-tested. Route: `GET /api/loan-applications/:id/submission-readiness` (internal staff) |
| `../auditLog.ts` | General audit logging |
| `verification.ts` | Plaid-driven income/employment/asset verification |
| `../plaid.ts` | Plaid API client |
| `ausSubmission.ts` | GSE leg: Plaid asset-report parsing, dual-AUS casefile submission — DU 12.1 + LPA (both simulated until GSE onboarding; LPA rides in `ausFindings.lpa`), Day 1 Certainty parsing, commitment letter builder |
| `lenderSubmission.ts` | Wholesale submit action: gated on submission-readiness (422 + blockers), one active submission per lender, deterministic simulated acknowledgment behind the per-lender portal seam; status machine in `shared/wholesaleLenders.ts` |

## Ops & intelligence

| Service | Does |
|---------|------|
| `taskEngine.ts` + `taskEventEmitter.ts` | Rules-driven staff task creation, assignment, SLA events |
| `emailService.ts` | Outbound email (SMTP/SendGrid; console fallback) |
| `pdfLetterGenerator.ts` | PDFKit pre-approval / pre-qualification letters |
| `analyticsEventPipeline.ts` | Product analytics event ingestion |
| `outcomeTracker.ts` | Closed-loop outcome tracking (did the loan close?) |
| `predictiveEngine.ts` | Predictions/benchmarks from tracked outcomes |
| `optimizationEngine.ts` | Recommendations engine |
| `intentTracker.ts` | Borrower intent signal capture |
| `lookupResolver.ts` | Lookup-matrix grid resolution (unit-tested) |
| `../propertyAnalyzer.ts` | Property affordability analysis |
| `../storage.ts` | The `IStorage` data-access layer (~4,700 lines) used by most routes |

## Pre-flight checklist — underwriting engine & regulated math

1. Determinism is a hard invariant: no vendor calls, clock reads, or randomness
   inside `underwritingEngine.ts` / `decisionEngine.ts` / `ruleEngine.ts` —
   same inputs → same outcome, typed error classification preserved
   ([CLAUDE.md](../../../CLAUDE.md) ground rules).
2. Regulated-math changes carry a `kb/regulatory-ledger.json` citation **in the
   same commit** — no citation, no code change
   ([TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md) §5.5).
3. `tests/complianceInvariants.test.ts` and `tests/scenarioCatalog.test.ts`
   stay green — they read the engine directly and exist to catch exactly this
   class of change.
4. Every displayed APR still comes from `apr.ts`; TRID timing from
   `businessDays.ts` — never reimplement either inline.

## Reading tips

- Start with `borrowerGraph.ts` and `ruleEngine.ts` — they encode the two big
  ideas (unified trust-tiered profile; deterministic decisions).
- `storage.ts` is huge but mechanical — search it for the entity you care
  about rather than reading linearly.
- `server/integrations/` contains the platform adapters: `auth/` (Postgres
  sessions + Passport wiring) and `object_storage/` (GCS with signed URLs).
