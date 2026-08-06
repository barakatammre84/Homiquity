# Model Risk Governance & AI/ML Compliance Documentation

**Status:** **DRAFT — content is code-accurate as of 2026-08-06; formal adoption is a founder signature**, tracked as a CTO_ROADMAP §1.7 counsel gate. Prepared 2026-07-03 for the production-readiness security & governance audit. ⚠️ It sat marked DRAFT for five weeks while both the root [README](../../README.md) and the [KB index](../README.md) cited it as a governance authority — if you are relying on it, know that it is unratified.
**Frameworks referenced:** Fannie Mae AI/ML lender guidance, FHFA AB 2022-02 (Artificial Intelligence/Machine Learning Risk Management), SR 11-7 (Model Risk Management), NIST AI RMF 1.0, ECOA/Reg B, FCRA.
**Governing policy:** [AI_GOVERNANCE_POLICY.md](./AI_GOVERNANCE_POLICY.md) (adopted 2026-07-04) — this document is the model inventory and control evidence under that policy; the policy controls on conflict.

---

## 1. Model Inventory

| # | Model / System | Type | Purpose | Decision role | Code location |
|---|----------------|------|---------|---------------|---------------|
| M-1 | Claude document extraction (`claude-sonnet-5` single-doc; `claude-opus-4-8` tax package — Anthropic API; row updated 2026-07-17, Gemini engine retired with the Anthropic migration) | Third-party generative LLM (vision) | Extract structured fields from W-2s, pay stubs, tax returns, bank statements, leases | **Input generation only** — never makes approve/deny decisions; Zod-clamped, confidence-capped, human-review threshold | `server/extraction*.ts` family (split #209; shim `extractionService.ts`) |
| M-2 | ConsolidatedUnderwritingEngine | Deterministic rules engine (no ML) | LTV/DTI/reserves/residual-income evaluation → APPROVED / REJECTED / MANUAL_REVIEW | **Primary decisioning** — thresholds resolved at runtime from Postgres lookup matrices | `server/underwritingEngine.ts` |
| M-3 | Instant Decision Orchestrator | Deterministic composition layer | Aggregates URLA line items, prices loan, invokes M-2, tags provenance | Orchestration; persists immutable decision snapshots | `server/services/decisionEngine.ts` |
| M-4 | Credit pipeline (simulated vendor) | Simulation (`Math.random`) pending bureau contracts | Tri-merge scores + liability lines | Feeds `representativeScore` into M-2 | `server/services/credit*.ts` family (split #196; shim `creditService.ts`) |
| M-5 | Predictive/coaching engines | Heuristic scoring (predictive) + **generative LLM chat** — Claude Sonnet 5 (`claude-sonnet-5`, Anthropic API) for the AI Coach | Borrower nudges, readiness, AI Coach intake chat + draft-application writeback | **Non-decisioning** (education/UX only). Coach controls: deterministic `loCommsLint` hard-block post-filter on every reply (Reg N approval-guarantee language replaced; Reg Z trigger terms audit-logged); per-call `ai_interactions` logging (classification `borrower_facing_guardrailed`, prompt version `coach-2.0.0`); chat-captured intake lands `self_reported` on DRAFT applications only and never touches provenance/verification flags or `status` (CI-enforced in `tests/complianceInvariants.test.ts`); offline mode is explicitly labeled when unconfigured | `server/services/predictiveEngine.ts`, the `coaching*.ts` family (split #204; shim `coachingService.ts`), `coachTools.ts`, `coachProfileSync.ts`, `aiInteractionLog.ts` |
| M-6 | MCP tool surface (stdio) | Deterministic tools exposed to external LLM agents | Soft credit pull, best-execution pricing, AVM lookup callable by AI agents | Tools are deterministic; the **consuming LLM agent** is the AI system — in LL-2026-04 scope; advisory only, consent-gated (FCRA), simulation-flagged | `server/mcp/index.ts`, `server/mcp/vendors.ts` |
| M-7 | AI file risk brief (roadmap A4) | Third-party generative LLM — Claude Sonnet 5 (`claude-sonnet-5`, Anthropic API) | Staff-facing advisory NARRATION of the deterministic risk outputs (instant decision, pre-UW flags, submission readiness, predictive factors, situation profile) on the borrower-file view | **Non-decisioning** (staff advisory only; never borrower-facing in v1). Controls: echo-only number validation — any figure not present in the deterministic facts discards the narrative for the labeled deterministic template; Zod-validated model output; per-call `ai_interactions` logging (classification `internal_only`, prompt version `risk-brief-1.0.0`, facts fingerprint); env kill switch `RISK_BRIEF_DISABLED`; CI invariants keep it out of the decision path AND the adverse-action path (`tests/complianceInvariants.test.ts`) | `server/services/riskBrief.ts`, `shared/riskBrief.ts` |

**Architectural control (key claim for examiners):** credit decisioning is intentionally **AI-free**. The LLMs (M-1 document extraction, M-5 coach chat) sit outside the approval path — CI fails the build if any decision-path module imports an AI service (`tests/complianceInvariants.test.ts`); M-2 is deterministic and matrix-driven, which supports Fair Lending / Reg B consistency and full explainability of adverse outcomes.

## 2. How an automated approval / referral is determined

1. **Data assembly** (`decisionEngine.aggregateBorrowerFinancials`): qualifying income and debts summed across all borrowers from URLA line items (`incomeBasis: "urla_line_items"`), falling back to application summary (`"application_summary"`). The basis used is recorded in every decision.
2. **Completeness gate**: missing income / credit score / purchase price / down payment / property state ⇒ `NEEDS_MORE_INFO` with the exact missing items (no silent denial).
3. **Pricing**: PITI from `generateLoanEstimate` (TRID-shaped Loan Estimate service).
4. **Deterministic evaluation** (M-2): LTV = loan / min(contract price, appraisal); DTI vs. matrix-resolved caps; asset haircuts (stock/retirement) for reserves; VA residual-income path for veterans. Every rejection appends a human-readable reason string.
5. **Provenance qualifier** (`shared/dataProvenance.ts`): self-reported data ⇒ `PRELIMINARY`; only when income + assets + credit are each verified by an authorized human (`markDimensionVerified`, role-gated to admin/LO/LOA/processor/underwriter on the deal team) does the application promote to `VERIFIED` (binding-grade).
6. **Snapshotting**: every recalculation persists an immutable row in `decision_snapshots` (trigger, decision, qualifier, DTI/LTV, income basis, reasons, missing items) — a time-ordered decision history per application.
7. **Adverse action**: denials/counteroffers generate FCRA notices with ECOA-compatible principal reasons and bureau-specific reason codes (`creditService.generateAdverseAction`), backed by a hash-chained, tamper-evident credit audit log (`credit_audit_log` with `entryHash`/`previousEntryHash` chain verification).

## 3. Controls currently in place (verified in code)

- **Human-in-the-loop for binding outcomes**: AI extraction cannot promote provenance to `VERIFIED`; only role-gated staff verification does (`server/services/verification.ts`, the verify routes in `server/routes/lending/statusDecisions.ts`).
- **Tamper-evident audit**: SHA-256 hash chain over credit actions with `verifyAuditLogIntegrity` and exportable audit packages (JSON/CSV).
- **Adverse-action explainability**: enumerated reason taxonomy with Experian/Equifax/TransUnion/FICO reason codes; free-text reasons are rejected (`validateAdverseActionReason`).
- **Data retention policies** codified with legal basis and regulatory references (FCRA §604(b)(3), 12 CFR 1002.12, GLBA).
- **Extraction degradation**: when the Anthropic key is unconfigured or parsing fails, extraction returns `confidence: "low"` with warnings rather than fabricated values; low-confidence extractions raise `DOCUMENT_OCR_ISSUE` tasks for human review.
- **Fair-lending isolation**: no LLM output feeds M-2 inputs directly; credit score enters only via the (currently simulated) credit-pull pipeline under FCRA consent gating.

## 4. Identified model-risk gaps and remediation status

Status legend: ✅ remediated in this hardening pass · ◑ partially addressed · ⬜ open.

| ID | Gap | Risk | Status / Remediation |
|----|-----|------|----------------------|
| MR-1 | LLM output was `JSON.parse(...)` cast without schema validation, bounds checks, or cross-field consistency checks | Hallucinated/absurd values enter readiness data; document-borne prompt injection can steer output | ✅ **Done.** Every extractor now validates against a strict Zod schema (`server/extractionValidation.ts`): numerics clamped to document ranges (out-of-range values dropped), account numbers reduced to last-4, cross-field consistency checks (netPay ≤ grossPay, balances reconcile, etc.) cap the model's self-reported confidence, and structurally invalid output degrades to `confidence: "low"` with a warning instead of flowing downstream. |
| MR-2 | Model self-reported `confidence === "high"` auto-set document `status: "verified"` | An uploaded document containing adversarial instructions could mark itself "verified"; conflated model confidence with institutional verification | ✅ **Done.** High confidence now advances a doc only to `"verifying"`. `"verified"` is reachable **only** via the new human-review route `POST /api/documents/:id/verify` (role-gated to admin/LO/LOA/processor/underwriter + deal-team, audit-logged). |
| MR-3 | No model/prompt lineage persisted: extraction stored field names only | Cannot reconstruct *why* a value was extracted | ✅ **Done.** Model ID + prompt version stamped on every extraction; on success the SHA-256 of the raw model response and the **encrypted** raw response are persisted on the `documents` row (`extraction_response_hash`, `extraction_raw_encrypted/_iv/_key_id`) — mirroring the credit-pull vendor-response pattern. Ciphertext is never returned to clients (`publicExtraction`). |
| MR-4 | Decision snapshots omit policy/matrix versions; lookup matrices are mutable and resolved live | A past decision cannot be exactly reproduced after a matrix update | ✅ **Done.** The engine returns a `ResolvedPolicy` (dtiCap, stretchDti, ltvCap, asset haircuts, resolved PMI/LLPA cells, VA residual) with a SHA-256 fingerprint; both are persisted per `decision_snapshots` row (`resolved_policy`, `policy_fingerprint`). A decision is now reproducible from the exact thresholds it used, even after a later matrix edit. |
| MR-5 | Simulated credit pull (`Math.random` scores) wrote `creditScore` via a production-reachable route | Simulation data could ground a real decision if deployed unchanged | ✅ **Done.** `simulateCreditPullCompletion` hard-throws in production unless `CREDIT_VENDOR_MODE=simulation`. The pull row now carries a queryable `is_simulated` flag, surfaced as a warning badge in the staff Borrower File. |
| MR-6 | No periodic model performance monitoring (extraction accuracy vs. human-corrected ground truth) | Silent drift in extraction quality | ✅ **Done.** `getExtractionAccuracyReport()` compares each document type's human-verified accuracy against its target and emits drift **alerts** when it falls below; exposed at `GET /api/documents/confidence/accuracy-report` (staff-gated). Run it on a monthly cadence (or wire to the scheduled-jobs runner). |
| MR-7 | No documented fair-lending testing of the deterministic engine outputs | Reg B / fair-lending exam exposure even for rules-based systems | ✅ **Done.** `runDisparateImpactAnalysis()` applies the four-fifths rule to APPROVED/REJECTED outcomes across race, ethnicity, sex, and age (62+) from `hmda_demographics`; exposed at `GET /api/compliance/fair-lending/disparate-impact` (admin-gated, access audit-logged). Output is aggregate-only and flags groups with an adverse-impact ratio < 0.80 for investigation. Run quarterly and retain results 5 years. |

## 4a. Risk acceptance — credit-score column encryption (audit finding #8)

**Decision requested of:** CISO / Compliance Officer (sign-off required — this is a
risk-acceptance, not an engineering task).

**Finding:** credit scores (`credit_pulls.experianScore/equifaxScore/transunionScore/representativeScore`,
`loan_applications.creditScore`) are stored in plaintext integer columns while the
stated data-classification policy calls for individually-encrypted sensitive fields.

**Assessment (why encrypting the columns is *not* recommended):**
- The **authoritative** source — the full raw bureau response, which contains the
  scores plus tradelines and PII — is **already encrypted at rest**
  (`credit_pulls.encrypted_raw_response`, AES-256-GCM). The integer columns are a
  denormalized, queryable convenience copy of already-protected data.
- A credit score is a 3-digit number, **not a direct identifier**; it is not
  re-identifying on its own, and the identity linkage that would make it sensitive
  (SSN) is now encrypted (§ data protection).
- `creditScore` is read at ~97 sites and is **functionally required in cleartext**
  by the AI-free deterministic underwriting engine, the pricing/LLPA/PMI lookups,
  the pipeline eligibility rules, and SQL overlay conditions. Encrypting it would
  force decrypt-on-read everywhere, remove SQL filterability/ordering, and inject
  real regression risk into the deterministic decisioning path — a poor trade for
  data whose authoritative form is already encrypted.

**Compensating controls (already in place):**
- Raw bureau response encrypted at rest; scores never leave the server for
  external-partner roles (stripped in `credit/summary`).
- Access to credit data is role-gated and every credit action is written to the
  tamper-evident, hash-chained `credit_audit_log`.
- Identity data (SSN, account numbers) is encrypted; a score alone is not PII.

**Recommendation:** accept the residual risk of plaintext score columns with the
compensating controls above, OR — if policy strictly forbids it — encrypt only the
per-bureau columns on `credit_pulls` (display-only) while keeping
`loan_applications.creditScore` cleartext for decisioning, and denormalize a coarse
band (e.g. `700-739`) for any filtering. Pending sign-off, the columns remain
cleartext.

## 5. Third-party model dependency (Anthropic)

> Corrected 2026-08-05. This section previously described Google/Gemini
> (`@google/genai`, `gemini-2.0-flash`). That was stale from the 2026-07-17 migration:
> §1's M-1 row was updated then, this section was not, leaving the document
> self-contradictory for ~3 weeks. **The vendor changed; the obligation below did not.**

- Provider: Anthropic (`@anthropic-ai/sdk`), models pinned in code at
  `server/extractionCore.ts` — `claude-sonnet-5` (single document),
  `claude-opus-4-8` (tax package). Key: `AI_INTEGRATIONS_ANTHROPIC_API_KEY`.
  There is no Gemini code path and no `GEMINI_API_KEY` in the repo.
- **Scope is wider than extraction.** Three inventory rows send borrower data to
  Anthropic: **M-1** (document extraction), **M-5** (AI Coach generative chat —
  borrower-facing, writes back to draft applications), **M-7** (AI file risk brief).
  Any contractual remedy must cover all three, not extraction alone.
- Data sent: borrower document images/PDFs (full PII), coach chat content, borrower-file
  facts. **Action still required before production traffic:** execute a DPA with a
  no-training clause and document sub-processor locations for GLBA/state privacy notices.
  Tracked as **AG-3**, which re-scopes to Anthropic and remains **OPEN** — retiring Gemini
  extinguished Google's exposure, not the requirement (`AI_GOVERNANCE_POLICY.md` §6 attaches
  it to "any third-party model," not to a named vendor).
- ⚠ **The "vendor register" this section and §7 direct findings into does not exist**
  anywhere in the repo. `security/ASSET_REGISTER.md` is not it — its Anthropic row defers
  governance back to `AI_GOVERNANCE_POLICY.md`, whose §7 scope named Gemini, so the pointer
  chain dead-ended at a vendor that processes nothing. Either create the register or
  re-point both references at a real destination.
- Fallback behavior: graceful degradation to manual processing (documented above).
- ⚠ **§5.5 golden-set review was structurally unmeetable for this migration.** A
  model-version change of this size requires a documented golden-set accuracy review; AG-4
  concedes no such harness exists in `tests/`. The version-constant half was satisfied
  (`EXTRACTION_PROMPT_VERSION`, both model ids stamped); the accuracy half was not. Do not
  read this correction as evidence the swap cleared §5.5.
- ⚠ **§5.6 decommissioning may be incomplete.** `AI_INTEGRATIONS_GEMINI_API_KEY` is still
  recorded as provisioned in `knowledge-base/archive/INFRASTRUCTURE_RISKS.md` and
  `LAUNCH_READINESS_CHECKLIST.md`. §5.6 requires credential removal at decommissioning. The
  hosting platform that held that variable (Vercel) was retired in the 2026-08 move to Railway
  and its project deleted, so the platform-side copy is gone with it — but **deleting a variable
  is not revoking a credential.** Revocation at Google AI Studio, and confirmation that no
  Gemini key was carried into the Railway service variables, are env actions not visible from
  the repo. Env action, not a doc edit.

## 6. Change management

- Prompt or model-version changes must increment `EXTRACTION_PROMPT_VERSION` / `EXTRACTION_MODEL_ID` (`server/extractionCore.ts`); those ids are stamped on every extraction. Changes should still be accompanied by a documented accuracy review on a golden-set of test documents (`tests/` harness to be extended — see MR-6).
- Lookup-matrix (policy) changes remain runtime-mutable, but each decision now records the resolved thresholds it used plus a fingerprint (MR-4), so a past decision is reproducible from its `decision_snapshots.resolved_policy` regardless of later matrix edits.
