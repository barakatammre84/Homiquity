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
>
> **Update 2026-07-12:** the money-path merge train (#135–#139) closed the wiring gaps — the
> AUS leg has a UI trigger (F-003), adverse-action generation is a blocking chokepoint on the
> deny seam (F-004), and the `loanOutcomes` writers are wired (F-002). Both former
> broken-from-UI flows are now wired; the F-018/F-019 P0 export bugs are fixed (residual
> XSD conformance = roadmap L6-fix). The founder walkthrough recorded in
> [BETA_GO_LIVE_READINESS.md](../runbooks/BETA_GO_LIVE_READINESS.md) §1 stands as the first
> live run of workflows 2, 4 and 5 (and most of 1).

Status ledger:

| # | Workflow | Wiring (audit) | Last run | Verdict |
|---|---|---|---|---|
| 1 | Pre-approval / instant decision | FULLY (via cascade, N-002) | **2026-08-05 verifier — all 8 steps incl. LE/APR + letter (first time)** | ❌ FAIL → same-day fixes: WF1-003 $0 letter + WF1-004 TRID address-last shipped (#395); WF1-002 intake decision dead-stop (post-1967dff compensation election) surfaced honestly in #395, root fix (pricing decoupling) open. Gates (TRID set-once, letter refusal seams, consent-gated LE, Appendix J APR) all held |
| 2 | Intake → AUS → lender package → wholesale submission | FULLY — AUS UI trigger + re-wired Submit-to-lender shipped in #135 (was PARTIAL, F-003) | **2026-08-05 verifier — full run incl. status machine to funded** | ✅ pass-with-findings — machinery sound (dual AUS, package hash == download, full transition table, audit chain); **WF2-F4 CLOSED — was already fixed when it was recorded** (re-verified 2026-08-12): the URLA section-4 write path landed in `6407119` (#400) on 2026-08-05, the same day this row was written. Chain on main: `urla/PropertySection.tsx:180,204` Selects → `URLAForm.tsx` `loanDetails` state → `buildPayload` → `server/routes/borrower/urla.ts:587` `urlaLoanDetailsSchema.safeParse` (400 on invalid — never a guessed value) → `updateLoanApplication` → `recalculateDecision`. Dated with `git log -S "loanDetailsChanged" -- server/routes/borrower/urla.ts`, which points only at `6407119`. **Date a standing claim before re-reporting it** ([routines/CHARTER.md](../routines/CHARTER.md) §1); WF2-F5 status-machine has no UI; TRID blind spot fixed #395 |
| 3 | GSE loan-delivery readiness | FULLY — F-018/F-019 fixed; remaining XSD baseline tracked as L6-fix/U-1 | — | not yet run |
| 4 | Document upload → extraction → qualification | FULLY | 2026-07-12 founder walkthrough (#139) | ✅ pass (presigned-only, magic-byte check, cross-borrower 403) |
| 5 | Credit consent → pull → denial → adverse action | FULLY — generation is a blocking deny-seam chokepoint (was PARTIAL, F-004) | **2026-08-05 verifier — all legs: consent evidence, audit chain (5 events verified), both deny seams, borrower read, PDF, mail delivery, 30-day watchdog + de-dup** | ✅ pass-with-findings — every gate held; **WF5-F2 adjudicated CONFIRMED-DEFECT (FCRA §615(a)): auto-generated notices never carry consumer-report attribution even with a completed pull on file** — three-branch chokepoint fix in flight (simulated pull ⇒ denial refuses) |
| 6 | Verification-driven provenance promotion | FULLY (via cascade) | — | not yet run |
| 7 | Lifecycle / evergreen re-engagement | PARTIAL — lifecycle sweep is cron-only | — | not yet run |
| + | Analytics feedback loop (outcomes → predictive) | WIRED — `loanOutcomes` writers wired in #136 (was BROKEN, F-002) | — | not yet run |

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

1. **[gate]** Credit pull refused with no FCRA consent — live contract is **HTTP 400** `{"error":"Valid consent required before credit pull"}` with no machine code field (server/routes/compliance.ts; the `CONSENT_REQUIRED` 403 convention used elsewhere does not apply here — WF5-F1, convergence optional).
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
same server as a regression baseline; failures are findings. *(The formerly-known
`lenderSubmission` determinism flake was fixed via an injectable generation clock —
`d5b8b54`, finding F-005 closed — so it is no longer an expected failure.)*
