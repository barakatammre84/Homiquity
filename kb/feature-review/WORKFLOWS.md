# Feature Review — End-to-End Workflow Scripts

The core end-to-end workflows that must function correctly, scripted as
`step → action → expected observable` for the `workflow-verifier` agent. Verified live against
the worktree dev server (port 5002). Program rules: `CHARTER.md`.

Steps marked **[gate]** are negative checks: the workflow must *refuse* correctly.
Vendor steps run against the deterministic simulations (flagged in code) — a simulated response
is expected locally; an unhandled error is a finding.

> **Wiring status (2026-07-08 audit):** the census found **~14 end-to-end workflows total — 8
> fully wired, 4 partial, 2 broken-from-UI.** The 7 scripted below are the core lending flows;
> the additional ~7 (public acquisition funnel, AI-Coach package, agent/broker referral,
> analytics feedback loop, etc.) are lower-priority and scripted on demand. The **Wiring** column
> records the audit verdict so the verifier knows which flows it can prove live vs which are
> broken (a broken flow is a finding to confirm, not a "verification").

Status ledger:

| # | Workflow | Wiring (audit) | Last run | Verdict |
|---|---|---|---|---|
| 1 | Pre-approval / instant decision | FULLY (via cascade, N-002) | — | not yet run |
| 2 | Intake → AUS → lender package → wholesale submission | PARTIAL — AUS leg broken-from-UI (F-003); wholesale submission wired | — | not yet run |
| 3 | GSE loan-delivery readiness | FULLY — **but 2 P0 export bugs (F-018/F-019)** | — | not yet run |
| 4 | Document upload → extraction → qualification | FULLY | — | not yet run |
| 5 | Credit consent → pull → denial → adverse action | PARTIAL — adverse-action *generation* has no UI trigger (F-004) | — | not yet run |
| 6 | Verification-driven provenance promotion | FULLY (via cascade) | — | not yet run |
| 7 | Lifecycle / evergreen re-engagement | PARTIAL — lifecycle sweep is cron-only | — | not yet run |
| + | Analytics feedback loop (outcomes → predictive) | **BROKEN — `loanOutcomes` never written (F-002)** | — | not yet run |

> **Before first run:** the verifier expands each outline below into exact route + payload
> steps by reading the client code (the UI's actual requests are the spec) and records the
> expanded script back here. Outlines come from the subsystem census; routes/payloads must be
> confirmed against code, not assumed.

## 1. Pre-approval / instant decision

1. Sign up + log in as borrower (fresh `wfqa+wf1@test.local`) → 200, session cookie set.
2. Start application, submit intake short of six TRID pieces → decision may be PRELIMINARY;
   `tridTriggeredAt` **must remain unset** [gate].
3. Complete the six-piece set → `tridTriggeredAt` set exactly once, by `server/services/trid.ts`.
4. Instant decision runs → decision snapshot exists with policy fingerprint; provenance
   PRELIMINARY (self-reported).
5. **[gate]** Binding outcome (pre-approval letter) must be refused while provenance is
   PRELIMINARY.
6. Verify income/assets/credit (simulated Plaid/credit paths) → provenance promotes to
   VERIFIED, decision recalculates.
7. LE generated within the 3-business-day clock; APR present and produced by the Appendix J
   solver (not a flat spread).
8. Pre-approval letter renders (PDF) with NMLS identity fields.

## 2. Intake → AUS → lender package → wholesale submission

1. Borrower file with completed URLA (build on a wf1-style file).
2. Readiness report shows 4 stages (intake / aus / lenderPackage / deliveryPreflight) from
   `brokerSubmissionReadiness.deriveSubmissionStages`.
3. **[gate]** Submission to a wholesale lender is refused while stages 1–3 are not clean.
4. Intake stage: URLA gating + TRID clock + e-disclosure consent all satisfied → stage clean.
5. AUS: DU submission (simulated) returns findings; stage clean. LPA leg also recorded (dual).
6. Lender package: MISMO validity + docs + QM pre-flight + anti-steering check → stage clean.
7. Submit to a Target-5 lender → `lender_submissions` row with readiness snapshot; status
   machine advances; audit entry exists.
8. Delivery preflight is informational (does not block submission).

## 3. GSE loan-delivery readiness

1. Staff login (LO role). **[gate]** MISMO export refused for non-staff/borrower session.
2. Delivery-readiness report for a complete file: URLA sections 1a/4/5 gating, ULDD shape,
   edit mirror, SFC derivation — each section present with pass/fail detail.
3. Generate MISMO 3.4 XML → validates against the ULDD XSDs in `docs/fannie-mae/`
   (`tests/mismoXsdValidation.test.ts` path); `TaxpayerIdentifierValue` present (decrypted at
   the seam) and SSN appears NOWHERE else in the payload or logs.
4. SFC set: derived codes valid per catalog, ≤ 10, no invalid combinations.
5. Introduce a known defect on a scratch file (e.g. clear a required URLA field) → readiness
   report flags exactly that edit; export gated accordingly [gate].

## 4. Document upload → extraction → qualification

1. Borrower requests upload → presigned GCS URL returned; **[gate]** direct/unsigned upload
   path refused (`uploadsPresignedOnly` invariant).
2. Upload a fixture tax return (Form 1040/Schedule C) → document row created with ACL policy.
3. Extraction (Gemini, simulated/env-gated) → structured fields persisted with model + prompt
   lineage (`EXTRACTION_PROMPT_VERSION`); sensitive extracted values encrypted.
4. Self-employment income qualification consumes extraction → condition materialized or
   cleared in the pipeline; 2-year tax-return condition logic respected.
5. **[gate]** Another borrower's session cannot fetch the document (ACL check).

## 5. Credit consent → pull → denial → adverse action

1. **[gate]** Credit pull refused with no FCRA consent (403 with the consent-required shape).
2. Record consent (versioned template `FCRA-2025-v2`, IP/UA evidence) → pull allowed.
3. Soft pull (simulated adapter / MCP `run_soft_credit_pull`) → hash-chained `creditAuditLog`
   entry; chain verifies.
4. Force a denial-path decision → `ensureAdverseActionForDenial` creates the adverse action;
   letter renders with NMLS ids; **auto-deny must not occur from intake analysis** [gate —
   MANUAL_REVIEW/REJECTED route to under_review, not auto-denial].
5. Watchdog sweep (`/api/jobs/adverse-action-delivery`) classifies by 30-day deadline
   proximity and raises deduplicated staff tasks (run twice → no duplicate tasks).

## 6. Verification-driven provenance promotion

1. File with PRELIMINARY provenance; decision snapshot exists.
2. Verify assets (simulated Plaid VOA webhook) → `preUnderwriting` re-evaluates; flags/
   conditions update; provenance still PRELIMINARY (only one dimension) [gate].
3. Verify income, then credit → on the third, `financialDataProvenance` auto-promotes to
   VERIFIED.
4. Promotion triggers decision recalc → new snapshot; binding outcomes now permitted.
5. `verificationReports` reflects all three dimensions independently.

## 7. Lifecycle / evergreen re-engagement

1. Closed-loan/homeowner file → lifecycle engine produces equity snapshot (AVM via simulated
   adapter).
2. Rate/equity conditions met → refi alert generated; appears in signals/staff queue and
   borrower surface (HomeownerDashboard).
3. Outbound notification passes TCPA gates: **[gate]** suppressed for opted-out (STOP) number;
   **[gate]** deferred outside quiet hours (8am–9pm recipient-local; fail-safe on unknown ZIP).
4. Signal engine ranks the re-engagement item in the staff "needs attention" feed.

---

## Baseline

Alongside workflow runs, `npm run test:integration` (73 tests as of 07-04) runs against the
same server as a regression baseline; failures are findings unless already known
(`lenderSubmission` determinism flake is known/pre-existing).
