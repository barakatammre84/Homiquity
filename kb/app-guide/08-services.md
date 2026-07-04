# 08 — Service Catalog

Business logic lives in [`server/services/`](../../server/services/) plus a few
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

## Documents & AI

| Service | Does |
|---------|------|
| `documentEngine.ts` | Document lifecycle: classification, status |
| `../extractionService.ts` | Runs AI extraction on uploaded docs (paystub/W-2/bank statement/tax return) — owns its own Gemini client |
| `documentConfidence.ts` | Scores extraction trustworthiness |
| `aiGateway.ts` | Provider-pluggable AI gateway (Gemini default; Claude via `AI_GATEWAY_PROVIDER` + `ANTHROPIC_API_KEY`) |
| `coachingService.ts` | AI Homebuyer Coach (OpenAI) |

## Compliance & security

| Service | Does |
|---------|------|
| `creditService.ts` | FCRA chain: consent capture, credit pulls (soft/hard), adverse action, hash-chained audit log. Denial via the status route auto-generates the Reg B notice (reasons mapped from the HMDA list) |
| `trid.ts` | TRID six-piece trigger (§1026.2(a)(3)): sole writer of `tridTriggeredAt`, starts the 3-business-day LE clock, hard-stops forward status/stage moves when the LE is overdue |
| `businessDays.ts` | Shared TRID business-day math (weekends + federal holidays) — never reimplement with calendar arithmetic |
| `encryptionService.ts` | Field encryption, PII hashing, audit hash-chaining |
| `mismoValidation.ts` + `../mismo.ts` | MISMO 3.4 XML export + GSE/ULDD validation |
| `../auditLog.ts` | General audit logging |
| `verification.ts` | Plaid-driven income/employment/asset verification |
| `../plaid.ts` | Plaid API client |
| `ausSubmission.ts` | GSE leg: Plaid asset-report parsing, DU 12.1 casefile submission (simulated until Fannie onboarding), Day 1 Certainty parsing, commitment letter builder |

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

## Reading tips

- Start with `borrowerGraph.ts` and `ruleEngine.ts` — they encode the two big
  ideas (unified trust-tiered profile; deterministic decisions).
- `storage.ts` is huge but mechanical — search it for the entity you care
  about rather than reading linearly.
- `server/integrations/` contains the platform adapters: `auth/` (Postgres
  sessions + Passport wiring) and `object_storage/` (GCS with signed URLs).
