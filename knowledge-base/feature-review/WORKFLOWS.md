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
| 3 | GSE loan-delivery readiness | **PARTIAL — re-graded 2026-08-17 (D-011 CONFIRMED).** The "FULLY" grade was wrong: only the export leg is UI-wired (`BorrowerFile.tsx:126`, `LoCommandCenter.tsx:77`); readiness + delivery-data are **staff-API-only** — `grep client/src` for `delivery-readiness`/`delivery-data`/`readyForDelivery`/`specialFeatureCodes` → **0 hits**. `scripts/delivery-stack-freeze-guard.cjs:1-14` already records the no-UI state as a deliberate, documented cut, so the charter rows were the defect | **2026-08-17 verifier — static/code-trace half only; NO dev server** (the :5002 listener is a 12-day-old orphan from a deleted worktree, `/api/health` carries no `commit`; it was not contacted). Executed evidence: 6 test files, **224 passed / 1 skipped / 0 failed**, plus 6 read-only probes against the exported functions | ❌ **FAIL** — steps 2 and 5 fail on static evidence; steps 1, 3, 4 are PASS-on-trace / **NOT VERIFIED live**. **Step 2:** 2 of 4 scripted sections don't meet the script — the ULDD-shape component is **absent** (`loanDeliveryReadiness.ts:5` declares `validateULDDCompliance`; the file never imports it), and the URLA section is **count-only** (F-085). **Step 5:** both halves fail — the report can't name the offending field, and the `[gate]` **does not exist** (`routes/lending/delivery.ts:25-71` has no readiness call; F-084). **Step 3 PASSES on the evidence that matters:** XSD-clean on both purposes with an empty offending baseline, and the SSN appears **exactly once**, at `TaxpayerIdentifierValue`, dashes stripped. New: **F-080 (P1)** co-borrower dropped + employment misattributed; F-084/085/086 (P2), F-091/092 (P3). ⚠️ **D-014 — the script itself is the finding:** run as written it catches **3 of the 9 registered Domain 8 findings and misses the P0**, because every step-3 assertion is a *schema* assertion and F-051/054/055/069 are all **schema-valid falsehoods** that `xmllint` passes. **Do not re-run until the script gains an explicit "emitted value == stored value" leg** for `ausRecommendation`, `amortizationType`, occupancy, loan purpose and lien priority — without it a green run proves only that the package is well-formed, not that it is truthful |
| 4 | Document upload → extraction → qualification | FULLY | 2026-07-12 founder walkthrough (#139) | ✅ pass (presigned-only, magic-byte check, cross-borrower 403) |
| 5 | Credit consent → pull → denial → adverse action | FULLY — generation is a blocking deny-seam chokepoint (was PARTIAL, F-004) | **2026-08-05 verifier — all legs: consent evidence, audit chain (5 events verified), both deny seams, borrower read, PDF, mail delivery, 30-day watchdog + de-dup** | ✅ pass-with-findings — every gate held; **WF5-F2 adjudicated CONFIRMED-DEFECT (FCRA §615(a)): auto-generated notices never carry consumer-report attribution even with a completed pull on file** — three-branch chokepoint fix in flight (simulated pull ⇒ denial refuses) |
| 6 | Verification-driven provenance promotion | FULLY (via cascade) — ⚠️ **re-graded 2026-08-18: the grade was wrong.** The three-dimension gate is real but **`POST /:id/verify/:dimension` has zero client callers**; the only shipped path is the all-or-nothing `verify-financials` override | **2026-08-18 verifier — first run; static/code-trace half only, NO dev server** (the :5002 listener is the **13-day-old orphan** from the deleted `launch-hygiene` worktree — PID 20814, `ps` START Aug 5, `/api/health` missing the `commit`/`email` fields current code returns — and **was not contacted**). Executed evidence: 7 in-process probes against `markDimensionVerified` with mocked `storage`/`decisionEngine`, 3 against `dataProvenance`/`preUnderwriting`/`ausSubmission`, plus 16 test files / **219 assertions** green — **none of which touches this workflow** (`grep -rln "services/verification" tests client/src` → nothing) | ❌ **FAIL — the workflow as scripted does not exist in the product.** The gate itself at `verification.ts:23-47` is **real and correct** (probed four ways: 1 dim → no promotion, 2 → no promotion, the *same* dim ×3 → no promotion, the 3rd distinct → `verified` + stamps + `recalculateDecision(id,"verified")`). But the granular route has **zero client callers**, so the only reachable path is the `verify-financials` override, which writes the gate column directly with **no evidence requirement** and a swallowed fire-and-forget recalc — **F-0818-01 (P1)**, distinct from F-041 and citing it; the author's own commit `92d69508` says granular was built to *replace* that toggle. Step 2's `[gate]` **passes vacuously** — the VOA webhook sets no dimension at all. New: **F-0818-02 (P2)** two dimensions verified concurrently leave all three booleans TRUE while the file stays `self_reported` (reproduced twice, independently; **downgraded from P1** — it self-heals on a later third dimension and the stuck row renders its own one-click fix); **F-0818-03 (P2)** the borrower Verification Center starts verifications no UI can finish and none touch provenance. **1 REFUTED:** the proposed "`verification_reports` can only hold a VOA ⇒ all three dimensions structurally impossible ⇒ D1C relief always false" — `report_type` is a plain `varchar(30)` with the vocabulary in a *comment* (no enum, no CHECK), the finding conflated two mechanisms (the dimensions live on `loan_applications`; credit is deliberately out of that table's scope), and the D1C columns are **write-only** while the consumed object's `{relief:false}` is **truthful and produces correct behaviour**. Its one true half is **F-041 verbatim** — merged, plus the new fact that **nothing calls Plaid's `assetReportCreate`**, so the VOA chain has no initiator either. ⚠️ **D-0818-03 — the script itself was a finding** (the D-014 pattern, second occurrence): four of five steps went green on the override path, no step asserted a promotion is *backed by evidence*, step 4 never required the new snapshot to carry `trigger:"verified"`, step 5 named a table that structurally cannot answer it, and "PRELIMINARY provenance" **is not a value the column can hold** (`financialDataProvenance` ∈ `self_reported\|verified\|system_calculated`; `PRELIMINARY` is the decision-*snapshot* qualifier). **The outline below has been replaced with the expanded, executable script** — routes, payloads, and the four added assertion legs. Do not run the old one |
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

> **Rewritten 2026-08-18 (D-0818-03).** The previous outline was itself a finding: four of its five
> steps went green on the override path that makes the gate meaningless, no step asserted a
> promotion is *backed by evidence*, and it named a value the column cannot hold. Two corrections
> a runner must carry:
>
> - **There is no `PRELIMINARY` provenance.** `financialDataProvenance` ∈
>   `{self_reported | verified | system_calculated}` (`shared/dataProvenance.ts:16-22`; DB default
>   `self_reported`, `shared/schema/lendingCore.ts:35-37`). `PRELIMINARY` is the *decision-snapshot
>   qualifier* (`server/services/decisionEngine.ts:289-290`). Asserting `provenance === "PRELIMINARY"`
>   asserts against a field that never holds it.
> - **The "three dimensions" are `loanApplications.{income,assets,credit}Verified`**
>   (`lendingCore.ts:43-45`) — **not** rows in `verification_reports`, which is a different table with
>   a different vocabulary and no credit type at all.

Preconditions: a borrower session (`wfqa+wf6@test.local`) plus a staff session in
`FINANCIAL_VERIFICATION_ROLES` = admin|lo|loa|processor|underwriter
(`shared/loanApplicationStatus.ts:313-319`). Property state must be **IL**
(`shared/companyIdentity.ts:120`) or intake 422s on the footprint gate.

1. **Create the file and confirm the baseline.**
   - `POST /api/auth/register {email,password,firstName,lastName}` → 200 + session cookie.
   - `POST /api/loan-applications` (schema `shared/schema/lendingUrla.ts:600` → `shared/preApprovalForm.ts:117`; **all strings**)
     `{annualIncome:"120000", employmentType:"employed", employmentYears:"5", monthlyDebts:"600",
     creditScore:"720", loanPurpose:"purchase", propertyType:"single_family", purchasePrice:"400000",
     downPayment:"40000", isVeteran:false, isFirstTimeBuyer:true, propertyState:"IL"}` → 201.
     Server cascade: `finalizeIntake → analyzeIntake → recalculateDecision(id,"intake")`.
   - **Assert the VALUES, not just 2xx:** `GET /api/profile` → `financialDataProvenance === "self_reported"`
     **and** `incomeVerified === assetsVerified === creditVerified === false`.
   - `GET /api/loan-applications/:id/decision-history` (staff) → ≥1 row, newest
     `{trigger:"intake", qualifier:"PRELIMINARY"}` with a non-null `policyFingerprint`.
   - **[gate]** `POST /:id/generate-letter` → **422** (`letters.ts:75-84`).
   - **NOT a gate:** `POST /:id/generate-prequal` is deliberately ungated (`letters.ts:601-603`) and
     must **succeed**, with the PDF carrying *"Based on a preliminary review of self-reported
     financial information … not a commitment to lend"* (`pdfLetterGenerator.ts:415`).

2. **Assets leg — simulated Plaid VOA webhook.**
   `POST /api/webhooks/plaid-assets` (CSRF-exempt; `x-webhook-secret` only if `PLAID_WEBHOOK_SECRET`
   is set — 503 in production when unset, `aus.ts:47-62`)
   `{webhook_type:"ASSETS", webhook_code:"PRODUCT_READY", asset_report_token:"wfqa-wf6-voa-token",
   asset_report_id:"wfqa-wf6-voa", application_id:"<id>", days_requested:90}`
   - 200 `{received:true, matched:true, verificationReportId:<uuid>, simulated:true}`.
   - DB: one `verification_reports` row `{provider:"plaid", report_type:"voa", status:"completed",
     raw_payload.simulated === true}`.
   - `preUwFlags.trigger === "voa_received"` and the flag set **changed** vs step 1.
   - A `loan_conditions` row `sourceRule "PRE_UW_LOW_RESERVES"`, status `outstanding`.
   - **[gate]** provenance still `self_reported` …
   - **[gate — ADDED; the old script's blind spot]** … **and `assetsVerified` is STILL `false`.**
     The VOA webhook marks no dimension, so asserting only the roll-up passes for the *wrong reason*.

3. **Income leg, then credit leg.**
   - 3a. `POST /api/loan-applications/:id/verify/income` (staff, empty body) → 200.
     **[gate]** provenance still `self_reported`; `incomeVerified === true`.
     **Record that this route has ZERO client callers — it is API-only (F-0818-01).**
   - 3b. `POST /:id/credit/consent` (borrower) `{consentType:"hard_pull", borrowerFullName:"WFQA Six",
     borrowerSSNLast4:"9999", consentGiven:true}` → 201, then `POST /:id/credit/pull` (staff)
     `{pullType:"soft"}` → 201, which fires `markDimensionVerified(id,"credit")` fire-and-forget
     (`compliance.ts:686-689`).
   - `GET /api/profile` → `financialDataProvenance === "verified"`, all three booleans true.
   - DB: `financial_data_verified_at` non-null and ≥ 3b's timestamp; `financial_data_verified_by` === the staff user id.
   - **[gate — ADDED]** `credit_pulls.is_simulated` for the consumed pull is **true** in dev: assert the
     promoted record is still traceable to a **simulated** pull.
   - **NEGATIVE VARIANTS** (second scratch file): mark the **same** dimension three times → provenance
     must stay `self_reported`; and mark two dimensions **concurrently** on a file whose third is
     already true → records F-0818-02's stuck state.

4. **Promotion → recalc → binding outcomes.**
   - `GET /:id/decision-history` → a **new** row with `trigger === "verified"` (`verification.ts:43`) —
     **not merely "a snapshot exists"** — **and** `qualifier === "VERIFIED"`, **and**
     `createdAt > financial_data_verified_at`.
   - `POST /:id/generate-letter` now 200s — **note `letters.ts:58-60` is a SEPARATE gate the old outline
     never mentioned**: `status` must be `pre_approved`, so a verified file still in `under_review` 400s.
   - `PATCH /:id/status {status:"pre_approved"}` no longer 422s; `GET /:id/offers` → qualifier
     `VERIFIED`, `indicative:false`; `GET /:id/income-summary` flips from the "analyzing" view to figures.
   - **[gate — ADDED]** Re-run step 4 on a scratch file promoted via the **override**
     (`POST /:id/verify-financials`) instead, and assert whether a `trigger:"financials_verified"` row
     was actually written. That recalc is fire-and-forget and swallowed (`statusDecisions.ts:365-367`),
     and `recalculateDecision` itself returns `null` on any error (`decisionEngine.ts:500-503`) — so a
     promoted file with a stale PRELIMINARY snapshot is the expected failure mode.

5. **Per-dimension independence — and evidence linkage.**
   - `GET /api/profile` returns `incomeVerified`/`assetsVerified`/`creditVerified` independently
     (`profile.ts:79-82`). Assert all three, individually.
   - ⚠️ **`verification_reports` is NOT the per-dimension ledger** and cannot be: its `report_type`
     vocabulary is `voa|voi|voe|voie|transactions` (`shared/schema/compliance.ts:699`) with **no credit
     type**, it has exactly one writer (`aus.ts:84`) which only ever writes `"voa"`, and there is no read
     endpoint. Assert via DB only, and assert what it can actually hold.
   - **[gate — ADDED; the leg that makes this workflow meaningful]** For each `true` dimension, name the
     row that backs it: `credit_pulls` for credit, a `voa` `verification_reports` row for assets, a
     `voie` row or a reviewed document for income. **Two of those three cannot exist today** — that is
     F-041, and this leg is what makes the gap visible instead of green.

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

Alongside workflow runs, `pnpm test:integration` (73 tests as of 07-04) runs against the
same server as a regression baseline; failures are findings. *(The formerly-known
`lenderSubmission` determinism flake was fixed via an injectable generation clock —
`d5b8b54`, finding F-005 closed — so it is no longer an expected failure.)*
