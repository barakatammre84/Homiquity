# Homiquity — Compliance & Logic (L2)

> **This is L2 — the regulatory and financial guardrails.** It **overrides L1 scope ideas and
> every L3 feature spec** when they conflict. It is an **index/overlay**, not a rewrite: each
> invariant below names the *authoritative document* that owns the detail and the *code* that
> enforces it. When two sources disagree, the order is **L1 `VISION_AND_SCOPE.md` → L2 (this
> doc) → L3 `[Feature]_SPECS.md`**, and **code wins over any doc on a stale fact** (that's a
> doc-drift bug to fix).

---

## 1. The overriding rule (why this doc sits above features)

**A mortgage is a regulated financial product. A feature that is delightful but non-compliant
is not shippable — it is a liability that can cost the license, the loan sale, or a borrower.**
So compliance is not a review step at the end; it is a *veto* that sits above product decisions:

> **Any regulatory or financial guardrail below beats any UX, growth, or feature idea. When a
> requirement is ambiguous or a source can't be verified, STOP and escalate to the Principal —
> never interpret, never guess, never invent.** The Fannie Mae *Selling/Servicing Guide* and
> state statutes control over job aids; when sources disagree, escalate rather than pick.

This is the single most important sentence in the repo's doctrine. Everything else here is the
enumerated form of it.

## 2. The non-negotiable invariants

Each row: the invariant · the authority that owns the detail · the code that enforces it · a
live example from the 2026-07-08 audit (see `knowledge-base/feature-review/FINDINGS.md`).

| # | Invariant (MUST) | Authority | Code enforcement | Live example |
|---|---|---|---|---|
| **I1** | **AI never decides.** No AI output sits in the credit-decision path or produces approve/deny/counteroffer. Decisioning is deterministic, matrix-driven, reproducible. AI output stays provisional until a human verifies (no AI promotion to `VERIFIED`). | `knowledge-base/governance/AI_GOVERNANCE_POLICY.md` P1–P6 · `knowledge-base/governance/MODEL_RISK_GOVERNANCE.md` | `server/services/decisionEngine.ts` + `server/underwritingEngine.ts` + `ruleEngine.ts` (AI-free); `shared/dataProvenance.ts` (human-gated promotion); CI: `tests/complianceInvariants.test.ts` | F-014: `complianceInvariants` is grep-only — a green run there ≠ proven determinism; strengthen it |
| **I2** | **No citation, no regulated-math change.** Every threshold, rate, factor, or enumeration that drives a regulated outcome carries a `data/regulatory/regulatory-ledger.json` citation *in the same commit*. No source → the value is not implemented. | `knowledge-base/compliance/UNDERWRITING_SCENARIOS.md` (no-citation contract) · `data/regulatory/regulatory-ledger.json` · `TEAM_PRACTICES.md` §5.5 | `server/services/underwritingNuance.ts`, `shared/fannieMae/*` (each constant cited); `scripts/regulatory-freshness.cjs` | N-003: QM/APR/SFC/VA/TRID tables verified correct — cited & current |
| **I3** | **GSE delivery must be standards-valid.** MISMO 3.4 / ULDD Phase 5 data-point names, enumerations, container paths, edit codes, and SFCs come only from `docs/fannie-mae/` (schemas + job aid) — **never from memory.** An out-of-enum or mis-nested value is rejected at the lender. | `CLAUDE.md` compliance-first · `docs/fannie-mae/` (XSDs, golden samples, Loan Delivery job aid) | `server/mismo.ts`, `shared/mismo.ts`, `server/services/mismoValidation.ts`, `shared/fannieMae/{loanDeliveryEdits,specialFeatureCodes,ucdFeeEnumerations,qmThresholds}.ts` | **F-018/F-019 (P0):** container mis-nesting + invalid `LoanPurposeType` → delivery rejection. Escalations **U-1…U-6** await source confirmation |
| **I4** | **PII through the vault, always audited.** SSNs/accounts are ciphertext + last4 only; decrypted solely at the delivery seam or an audited staff reveal; never in an API response; every PII mutation writes an audit entry. | `CLAUDE.md` (PII rule) · `knowledge-base/handbook/app-guide/06-auth-security-secrets.md` | `server/services/{ssnVault,piiVault,encryptionService}.ts`; `server/auditLog.ts`; single write path `server/storage.ts` | Posture STRONG (N-001, no IDOR). F-006: SSN/account *writes* not yet audited (reveal is) |
| **I5** | **TRID timing is exact.** The LE clock starts at the six §1026.2(a)(3) pieces — no sooner, no later — and runs on the correct business-day definition per disclosure. APR comes only from the Reg Z Appendix J actuarial solver (a flat spread is a TILA violation). | `docs/fannie-mae/` QM job aid · Reg Z (12 CFR 1026) | `server/services/{trid,businessDays,apr,loanEstimate}.ts` | F-024: CD clock uses the wrong business-day def; F-026: APR solver omits odd-first-period (OK for estimates) |
| **I6** | **Credit & adverse action follow FCRA/ECOA.** No credit pull without versioned FCRA consent; denial reasons come from the enumerated ECOA/bureau taxonomy (no free text); adverse-action notices meet the 30-day deadline; the platform never auto-denies from intake. | `knowledge-base/governance/AI_GOVERNANCE_POLICY.md` P4 · FCRA / ECOA (Reg B) | `server/services/creditService.ts` (`generateAdverseAction`, `validateAdverseActionReason`), `consentGate.ts`, `adverseActionDelivery.ts`, `server/routes/jobs.ts` (watchdog) | **F-004:** adverse-action *generation* has no UI trigger — resolve before launch if the MVP can deny |
| **I7** | **Outbound messaging is TCPA-gated.** Every outbound SMS passes opt-out (STOP) + quiet-hours (8am–9pm recipient-local, fail-safe on unknown ZIP); webhooks verify signatures. | FCRA/TCPA · `TEAM_PRACTICES.md` §9 | `server/services/{smsCompliance,quietHours}.ts`; `/api/webhooks/*` | **F-008\*:** SMS webhook has no signature verification — blocker only if SMS is live at launch |
| **I8** | **Fair lending is monitored.** No prohibited-basis variable (or proxy) is a model input; disparate-impact (four-fifths) is tested quarterly and retained 5 years. | `knowledge-base/governance/AI_GOVERNANCE_POLICY.md` §8 · ECOA/Reg B, HMDA | `server/services/fairLendingAnalysis.ts`; `GET /api/compliance/fair-lending/disparate-impact` | — |
| **I9** | **NMLS licensing gates solicitation.** Company/branch/MLO licensure, sponsorship, Temporary Authority, and the pre-license gate control which surfaces may solicit. Answer NMLS policy from `docs/nmls/`, never memory; state law controls. | `CLAUDE.md` (NMLS source of truth) · `docs/nmls/`, `docs/nmls-safe/`, `knowledge-base/compliance/SAFE_MLO_COMPLIANCE_MAP.md` | `server/services/prelaunchGate.ts` (pre-license gate) | Launch gate — see L1 §5 definition of "launched" |
| **I10** | **Simulations never ground a real decision.** Vendor output is flagged `simulated`/`is_simulated` and hard-throws in production unless explicitly enabled; the intentional throw on a real GSE key is a *guardrail*, not a bug. | `knowledge-base/governance/AI_GOVERNANCE_POLICY.md` P5 · `knowledge-base/governance/MODEL_RISK_GOVERNANCE.md` · `CLAUDE.md` (vendor-adapter rule) | `server/mcp/vendors.ts`; `ausSubmission.ts`; `creditService.simulateCreditPullCompletion` guard | N-002/Reality Map: don't file simulated determinism as a defect. D-008: `creditService` uses `Math.random` — fix |

## 3. The escalation rule (what to do at the boundary)

When you hit any of these, **stop and escalate to the Principal — do not proceed on a guess:**

- A MISMO/ULDD/UCD/SFC/edit-code name or enumeration you cannot verify in `docs/fannie-mae/`
  or the Loan Delivery job aid (the U-1…U-6 escalations are the current open set).
- A regulated threshold/factor with no `data/regulatory/regulatory-ledger.json` citation.
- An NMLS/SAFE policy question not answerable from `docs/nmls/`.
- Any conflict between a job aid and the Selling/Servicing Guide, or between a doc and state
  statute (the higher authority controls; if unclear, escalate).
- Anything that would move an AI system *toward* the decision path (violates I1 as written —
  requires a version change to `AI_GOVERNANCE_POLICY.md`, not a code workaround).

## 4. Security-review triggers (the merge gate — `TEAM_PRACTICES.md` §9, binding)

Any PR touching one of these runs `/security-review` (or an equivalent structured pass)
**before merge**; unresolved CRITICAL findings block the merge; the outcome is recorded in the
PR body. Same contract as I2 ("no review, no merge"):

- **PII vault / field encryption** — `ssnVault.ts`, `piiVault.ts`, `encryptionService.ts`, any `shared/schema/` PII column.
- **Auth & sessions** — `server/auth.ts`, `socialAuth.ts`, `server/integrations/auth/`.
- **Role/permission gates** — `requireRole`/`isAdmin`/staff scoping + per-resource ownership on borrower data.
- **Uploads / object storage** — `server/integrations/object_storage/`, `shared/uploads.ts`.
- **Outbound messaging** — `emailService.ts`, `smsCompliance.ts`, `/api/webhooks/*`.
- **Logging near PII** — any widening of `RESPONSE_BODY_LOG_ALLOWLIST` in `server/app.ts`.

## 5. The binding-authority map (where each guardrail's detail lives)

| Authority doc | Governs |
|---|---|
| `CLAUDE.md` (compliance-first + architecture ground rules) | The top-level "verify, never invent" doctrine + the code-location table for every GSE/PII/underwriting concern |
| `knowledge-base/governance/AI_GOVERNANCE_POLICY.md` | AI lifecycle, P1–P6, model inventory, vendor AI oversight (LL-2026-04, SR 11-7, NIST AI RMF) |
| `knowledge-base/governance/MODEL_RISK_GOVERNANCE.md` | The living model inventory + technical-control evidence (M-1…M-6) |
| `knowledge-base/compliance/UNDERWRITING_SCENARIOS.md` + `knowledge-base/compliance/SCENARIO_ARCHITECT.md` | The scenario catalog + the no-citation-no-implementation contract |
| `data/regulatory/regulatory-ledger.json` | The machine-readable citation register for every regulated constant |
| `docs/fannie-mae/` | ULDD/UCD/URLA/MISMO/QM/SFC source-of-truth (spec PDFs, XSDs, golden samples, job aids) |
| `docs/nmls/`, `docs/nmls-safe/`, `knowledge-base/compliance/SAFE_MLO_COMPLIANCE_MAP.md` | NMLS licensing + SAFE MLO policy source-of-truth |
| `knowledge-base/compliance/REGULATORY_MONITORING.md` | How regulatory drift is surfaced and re-verified |
| `knowledge-base/governance/TEAM_PRACTICES.md` §5.5, §9 | The regulated-math citation gate + the security-review trigger gate |
| `threat_model.md` | Security guarantees + threat surfaces |

## 6. How L3 feature specs cite this doc

Every `L3 [Feature]_SPECS.md` opens with: Business-Intent → "Serves L1 loop: ⟨link⟩" → **"Bound
by L2: I‹n›, I‹n›" (the specific invariants above it must obey)** → execution → acceptance test.
A spec that touches a §4 trigger surface names the required security review. No L3 merges
without citing its L1 loop and its L2 invariants.
