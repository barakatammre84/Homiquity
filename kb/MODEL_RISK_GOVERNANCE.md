# Model Risk Governance & AI/ML Compliance Documentation

**Status:** DRAFT for institutional compliance reporting — prepared 2026-07-03 as part of the production-readiness security & governance audit.
**Frameworks referenced:** Fannie Mae AI/ML lender guidance, FHFA AB 2022-02 (Artificial Intelligence/Machine Learning Risk Management), SR 11-7 (Model Risk Management), NIST AI RMF 1.0, ECOA/Reg B, FCRA.

---

## 1. Model Inventory

| # | Model / System | Type | Purpose | Decision role | Code location |
|---|----------------|------|---------|---------------|---------------|
| M-1 | Gemini document extraction (`gemini-2.0-flash`) | Third-party generative LLM (vision) | Extract structured fields from W-2s, pay stubs, tax returns, bank statements, leases | **Input generation only** — never makes approve/deny decisions | `server/extractionService.ts` |
| M-2 | ConsolidatedUnderwritingEngine | Deterministic rules engine (no ML) | LTV/DTI/reserves/residual-income evaluation → APPROVED / REJECTED / MANUAL_REVIEW | **Primary decisioning** — thresholds resolved at runtime from Postgres lookup matrices | `server/underwritingEngine.ts` |
| M-3 | Instant Decision Orchestrator | Deterministic composition layer | Aggregates URLA line items, prices loan, invokes M-2, tags provenance | Orchestration; persists immutable decision snapshots | `server/services/decisionEngine.ts` |
| M-4 | Credit pipeline (simulated vendor) | Simulation (`Math.random`) pending bureau contracts | Tri-merge scores + liability lines | Feeds `representativeScore` into M-2 | `server/services/creditService.ts` |
| M-5 | Predictive/coaching engines | Heuristic scoring | Borrower nudges, readiness | **Non-decisioning** (education/UX only) | `server/services/predictiveEngine.ts`, `coachingService.ts` |

**Architectural control (key claim for examiners):** credit decisioning is intentionally **AI-free**. The LLM (M-1) sits outside the approval path; M-2 is deterministic and matrix-driven, which supports Fair Lending / Reg B consistency and full explainability of adverse outcomes.

## 2. How an automated approval / referral is determined

1. **Data assembly** (`decisionEngine.aggregateBorrowerFinancials`): qualifying income and debts summed across all borrowers from URLA line items (`incomeBasis: "urla_line_items"`), falling back to application summary (`"application_summary"`). The basis used is recorded in every decision.
2. **Completeness gate**: missing income / credit score / purchase price / down payment / property state ⇒ `NEEDS_MORE_INFO` with the exact missing items (no silent denial).
3. **Pricing**: PITI from `generateLoanEstimate` (TRID-shaped Loan Estimate service).
4. **Deterministic evaluation** (M-2): LTV = loan / min(contract price, appraisal); DTI vs. matrix-resolved caps; asset haircuts (stock/retirement) for reserves; VA residual-income path for veterans. Every rejection appends a human-readable reason string.
5. **Provenance qualifier** (`shared/dataProvenance.ts`): self-reported data ⇒ `PRELIMINARY`; only when income + assets + credit are each verified by an authorized human (`markDimensionVerified`, role-gated to admin/LO/LOA/processor/underwriter on the deal team) does the application promote to `VERIFIED` (binding-grade).
6. **Snapshotting**: every recalculation persists an immutable row in `decision_snapshots` (trigger, decision, qualifier, DTI/LTV, income basis, reasons, missing items) — a time-ordered decision history per application.
7. **Adverse action**: denials/counteroffers generate FCRA notices with ECOA-compatible principal reasons and bureau-specific reason codes (`creditService.generateAdverseAction`), backed by a hash-chained, tamper-evident credit audit log (`credit_audit_log` with `entryHash`/`previousEntryHash` chain verification).

## 3. Controls currently in place (verified in code)

- **Human-in-the-loop for binding outcomes**: AI extraction cannot promote provenance to `VERIFIED`; only role-gated staff verification does (`server/services/verification.ts`, `server/routes/lending.ts` verify route).
- **Tamper-evident audit**: SHA-256 hash chain over credit actions with `verifyAuditLogIntegrity` and exportable audit packages (JSON/CSV).
- **Adverse-action explainability**: enumerated reason taxonomy with Experian/Equifax/TransUnion/FICO reason codes; free-text reasons are rejected (`validateAdverseActionReason`).
- **Data retention policies** codified with legal basis and regulatory references (FCRA §604(b)(3), 12 CFR 1002.12, GLBA).
- **Extraction degradation**: when Gemini is unconfigured or parsing fails, extraction returns `confidence: "low"` with warnings rather than fabricated values; low-confidence extractions raise `DOCUMENT_OCR_ISSUE` tasks for human review.
- **Fair-lending isolation**: no LLM output feeds M-2 inputs directly; credit score enters only via the (currently simulated) credit-pull pipeline under FCRA consent gating.

## 4. Identified model-risk gaps and remediation status

Status legend: ✅ remediated in this hardening pass · ◑ partially addressed · ⬜ open.

| ID | Gap | Risk | Status / Remediation |
|----|-----|------|----------------------|
| MR-1 | LLM output was `JSON.parse(...)` cast without schema validation, bounds checks, or cross-field consistency checks | Hallucinated/absurd values enter readiness data; document-borne prompt injection can steer output | ✅ **Done.** Every extractor now validates against a strict Zod schema (`server/extractionService.ts`): numerics clamped to document ranges (out-of-range values dropped), account numbers reduced to last-4, cross-field consistency checks (netPay ≤ grossPay, balances reconcile, etc.) cap the model's self-reported confidence, and structurally invalid output degrades to `confidence: "low"` with a warning instead of flowing downstream. |
| MR-2 | Model self-reported `confidence === "high"` auto-set document `status: "verified"` | An uploaded document containing adversarial instructions could mark itself "verified"; conflated model confidence with institutional verification | ✅ **Done.** High confidence now advances a doc only to `"verifying"`. `"verified"` is reachable **only** via the new human-review route `POST /api/documents/:id/verify` (role-gated to admin/LO/LOA/processor/underwriter + deal-team, audit-logged). |
| MR-3 | No model/prompt lineage persisted: extraction stored field names only | Cannot reconstruct *why* a value was extracted | ✅ **Done.** Model ID + prompt version stamped on every extraction; on success the SHA-256 of the raw model response and the **encrypted** raw response are persisted on the `documents` row (`extraction_response_hash`, `extraction_raw_encrypted/_iv/_key_id`) — mirroring the credit-pull vendor-response pattern. Ciphertext is never returned to clients (`publicExtraction`). |
| MR-4 | Decision snapshots omit policy/matrix versions; lookup matrices are mutable and resolved live | A past decision cannot be exactly reproduced after a matrix update | ✅ **Done.** The engine returns a `ResolvedPolicy` (dtiCap, stretchDti, ltvCap, asset haircuts, resolved PMI/LLPA cells, VA residual) with a SHA-256 fingerprint; both are persisted per `decision_snapshots` row (`resolved_policy`, `policy_fingerprint`). A decision is now reproducible from the exact thresholds it used, even after a later matrix edit. |
| MR-5 | Simulated credit pull (`Math.random` scores) wrote `creditScore` via a production-reachable route | Simulation data could ground a real decision if deployed unchanged | ✅ **Done.** `simulateCreditPullCompletion` hard-throws in production unless `CREDIT_VENDOR_MODE=simulation`. The pull row now carries a queryable `is_simulated` flag, surfaced as a warning badge in the staff Borrower File. |
| MR-6 | No periodic model performance monitoring (extraction accuracy vs. human-corrected ground truth) | Silent drift in extraction quality | ⬜ **Open.** `documentConfidence.recordHumanReview` already captures corrections; still need a monthly accuracy report per document type with threshold alerts. |
| MR-7 | No documented fair-lending testing of the deterministic engine outputs | Reg B / fair-lending exam exposure even for rules-based systems | ⬜ **Open.** Quarterly disparate-impact analysis using `hmda_demographics`, results retained 5 years. |

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

## 5. Third-party model dependency (Gemini)

- Provider: Google (`@google/genai`), model pinned in code to `gemini-2.0-flash`.
- Data sent: borrower document images/PDFs (full PII). **Action required before production:** confirm the Google API tier in use contractually excludes training on submitted data, execute a DPA, and record it in the vendor register; document sub-processor location for GLBA/state privacy notices.
- Fallback behavior: graceful degradation to manual processing (documented above).

## 6. Change management

- Prompt or model-version changes must increment `EXTRACTION_PROMPT_VERSION` / `EXTRACTION_MODEL_ID` (`server/extractionService.ts`); those ids are stamped on every extraction. Changes should still be accompanied by a documented accuracy review on a golden-set of test documents (`tests/` harness to be extended — see MR-6).
- Lookup-matrix (policy) changes remain runtime-mutable, but each decision now records the resolved thresholds it used plus a fingerprint (MR-4), so a past decision is reproducible from its `decision_snapshots.resolved_policy` regardless of later matrix edits.
