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
| 7 | Lifecycle / evergreen re-engagement | **PARTIAL — re-graded 2026-08-19 (D-0819-02 CONFIRMED). The "cron-only" grade was wrong in BOTH directions.** It understated the wiring — a nav-reachable borrower surface consumes the output (`App.tsx:545`; `/api/homeowner/{profile,equity,refi-alerts}` have **7/3/5** hits in `client/src`), plus an automatic graduation hook (`pipelineEngine.ts:653`) and an admin manual trigger (`jobs.ts:35`) — and it overstated the product, because the borrower-initiated **write** half is 100% broken. Corrected grade: **borrower-wired + cron-registered (prod execution unverified); NO staff surface; the borrower-initiated write half is 100% broken (3/3 endpoints 500 on the shipped payloads) while the cron sweep's own writes succeed** | **2026-08-19 verifier — first run; FULL LIVE RUN against `:5001`** (PID 21657, re-verified identical at start **and** end; its 9 commits touch **no file on this workflow's path** — the only two server/shared files in the diff, `server/app.ts` and `shared/schema/lendingCore.ts`, are **comment-only** "AI Coach"→"Homi" renames — so live results are sound. The `:5002` listener is the **14-day-old orphan** and was **not contacted**). Executed: 2 admin sweeps, 3 sessions, 11 authenticated probes, 5 in-process probes, 7 test files / **94 assertions** green | ❌ **FAIL — 2 of 4 steps fail and both `[gate]`s pass vacuously.** **Step 1 PASSES on the value that matters** — equity reconciles (`377766−300000=77766`, `20.59%`, LTV `79.4%`), the AVM is deterministic and `simulated:true`, the second sweep reports `snapshotsCreated:0` (idempotent), `errors:0` — **but the borrower's own entry point does not**: `POST /api/homeowner/profile` **500s on BOTH shipped payload shapes**, root-caused live to `TypeError: value.toISOString is not a function` because the route bypasses `insertHomeownerProfileSchema` (**F-0819-03**). **Step 2 half-passes**: the alert row and its math are right and the borrower GETs return them, but **all three write buttons 500 unconditionally** and the panel's read-state is computed from `readAt`, a column `notifications` **does not have** — proven live (`status` flipped to `read`, badge 2→1, `clientIsUnread` still `true`; **F-0819-10**, program-scale). **Step 4 FAILS structurally**: `StaffSignal.type` has no lifecycle member and `SIGNAL_ACTIVE_STATUSES` excludes terminal `funded` by construction — the exact population this workflow serves (**F-0819-19**); live feed 40 signals, 0 matching. ⚠️ **Step 3 is the D-014 / D-0818-03 pattern, THIRD occurrence: both TCPA `[gate]`s are unreachable.** `evaluateOutboundSms` has **zero call sites**, there is **no Twilio sender anywhere in `server/`**, and `emailService.ts` has zero suppression checks — so a STOP suppresses nothing this workflow emits, and a green run would prove nothing. The one leg that *could* be executed **failed**: the unknown-ZIP fail-safe returns `allowed:true` with the reason *"inside calling window across all US zones"* at **04:00 Pacific/Guam** and **21:00 America/Puerto_Rico** — two zones its **own** ZIP table maps (**F-0819-12**, merged with the domain-9 finding; an exhaustive 2026 sweep counts **1,587 violating instants/yr**). New: **F-0819-03 (P1)**, F-0819-08/09/10 (P2), F-0819-12/14/15/16/17/19/21 (P3), **D-0819-02**. **1 REFUTED** (the AVM confidence band — the adapter's `confidence`/`valueLow`/`valueHigh` are **hash outputs of the same address seed**, so consuming them would propagate simulated noise; the durable half, `equity_snapshots` having no provenance column, is F-0819-16). 🚨 **Do not run the old outline** — steps 3 and 4 assert against surfaces the product does not have. **§7 below has been replaced with an expanded executable script.** |
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

> **Expanded and corrected 2026-08-19 (first run).** The previous four-line outline was itself a
> finding — the D-014 / D-0818-03 pattern, **third occurrence**. Three corrections a runner must carry:
>
> - **There is no outbound SMS or dialer in this product.** `evaluateOutboundSms`
>   (`server/services/smsCompliance.ts:60`) has **zero call sites** — 2 comment mentions and 5 test
>   references — and `grep -rln "twilio|sendSms" server/` returns only *inbound* handlers. The old
>   step 3 asserted two `[gate]`s on a path that does not exist; run as written they pass
>   **vacuously**. They are kept below **relabelled as unit-level assertions on the guard itself**,
>   plus an explicit reachability assertion that must FAIL until an outbound leg is built.
> - **There is no staff surface for this module.** `StaffSignal.type`
>   (`server/services/signalEngine.ts:32-48`) is a closed six-member union with no lifecycle member,
>   and `SIGNAL_ACTIVE_STATUSES` (`:122-129`) filters out terminal `funded` — the exact population
>   this workflow serves. Old step 4 is not a check, it is a feature request (F-0819-19).
> - **The sweep writes to EVERY homeowner profile in the database.** `runLifecycleSweep`
>   (`lifecycleEngine.ts:589`) does `db.select().from(homeownerProfiles)` with no scope. On the
>   shared dev DB, record the pre-run count and confirm every affected row is a test fixture
>   **before** firing it.

**Preconditions.** A borrower session (`wfqa+wf7@test.local`) and an **admin** session
(`POST /api/test-login {email:"admin@test.com", password:$DEV_TEST_PASSWORD}` — `admin` is the only
role `jobs.ts:46` admits). `CRON_SECRET` is unset locally, so `isCronRequest` (`jobs.ts:28-32`) is
permanently false and the cron leg cannot be exercised locally — assert that, do not work around it.
Send `X-Forwarded-Proto: https` on login **and** every authenticated call.

1. **Create the homeowner file — and prove which of the two creation paths actually works.**
   - 1a. `POST /api/auth/register {email,password,firstName,lastName}` -> 200 + cookie.
   - 1b. **The graduation path** (`lifecycleEngine.ts:632`). `POST /api/jobs/graduate/:applicationId`
     (admin, `jobs.ts:295`). **[gate - ADDED]** It must **refuse** a non-`funded` application. Today it
     does not: it 200s on a `pre_approved` file and notifies the borrower *"Congratulations on
     closing!"* (**F-0819-15**). Assert `loan_applications.status === "funded"` before accepting the 200.
   - 1c. **The self-serve path.** `POST /api/homeowner/profile` with the **exact `SetupForm.tsx`
     payload** — all nine fields as strings, dates in `<input type="date">` form (`"2024-01-15"`), and
     **again with both blank (`""`)**, the component's default state. **Both must 201.** Today both
     **500** (**F-0819-03**).
   - 1d. `GET /api/homeowner/profile` -> the row, `interestRate` and `currentLoanBalance` non-null
     (the sweep skips a profile lacking them: `lifecycleEngine.ts:442`).
   - **Choose the fixture deliberately:** `interestRate >= market + 0.25` (`REFI_ALERT_RATE_DROP`,
     `:45`) or step 3 cannot fire, and **set `loanCloseDate`** — a null one silently disables the EPO
     clawback guard (**F-0819-14**).

2. **Run the sweep — and assert the ARITHMETIC, not the counters.**
   - Pre-flight (read-only SQL): `select count(*) from homeowner_profiles`; confirm every row is a
     test fixture. The sweep is global.
   - **[gate]** `GET /api/jobs/lifecycle` unauthenticated -> **401**; borrower session -> **403**;
     `Authorization: Bearer <wrong>` -> **401** (it falls through to the role gate; it does not 403).
   - `GET /api/jobs/lifecycle` (admin) -> 200 with the full counter set. **`errors` must be 0** — the
     sweep swallows per-profile throws (`:593-598`), so a non-zero count is the only signal that
     something died.
   - **Assert the snapshot reconciles**, not that a row exists: `equityAmount === estimatedValue -
     loanBalance`; `equityPercent === equityAmount / estimatedValue * 100` (2 dp); and the LTV in the
     PMI notification body `=== loanBalance / estimatedValue * 100` (1 dp).
   - **AVM is a deterministic sim** (`server/mcp/vendors.ts:169`) — call twice, assert byte-identical
     output plus `simulated:true`. A simulated value is **expected**; an unhandled throw is the finding.
     ⚠️ Do **not** file the discarded `confidence`/`valueLow`/`valueHigh` as a defect — they are hash
     outputs of the same address seed (`:179-181`), i.e. simulated noise (REFUTED, `WF7-F9-r1`).
   - **[gate - ADDED]** Re-run the sweep immediately: `snapshotsCreated:0, pmiAlerts:0,
     refiAlertsCreated:0` (idempotency, `:451-461`).

3. **Refi alert — assert the alert is TRUE, not merely present.**
   - `GET /api/homeowner/refi-alerts/:profileId` -> the row; `currentRate === profile.interestRate`;
     `marketRate === getMarketRate30YrFixed()`.
   - **[gate - ADDED; the leg that makes this step meaningful] Assert `marketRate` came from a
     CONVENTIONAL 30-year program.** `getMarketRate30YrFixed` (`lifecycleEngine.ts:147-163`) filters
     only on `termYears===30 && !isAdjustable` — **FHA and VA rows qualify** — and both production
     sync functions stamp every program with an identical `effectiveDate` (`rateService.ts:99,250`
     hoist `const now` outside the loop), so the tie is the designed steady state and `ORDER BY
     effective_date DESC LIMIT 1` has no defined winner. Assert the joined
     `mortgage_rate_programs.id`, not just the number (**F-0819-08**).
   - `potentialSavingsMonthly === computeRefiSavings(...).monthlySavings`, recomputed independently.
   - **[gate - ADDED]** `potentialSavingsLifetime` must be projected over the **remaining** term:
     assert `remainingMonths < 360` for any seasoned loan. With `loanCloseDate` null, `monthsElapsed`
     defaults to `0` and the claim is projected over a fresh full term (**F-0819-14**).
   - **[gate]** EPO clawback: on a file funded **inside** the window, `refiAlertsCreated` must not
     increment and `refiAlertsSuppressedByClawback` must. On a file with **no** `loanCloseDate` the
     guard currently clears the loan for solicitation — assert the direction the module documents
     (`:50-54`), which is suppression.
   - **[gate - ADDED]** `POST /api/homeowner/refi-alerts {homeownerProfileId}` and
     `POST /api/homeowner/equity {homeownerProfileId}` — the **exact** payloads
     `RefiAlertsSection.tsx:22` and `EquitySection.tsx:21` send. Both must 201. Today both **500**
     (**F-0819-03**); note no JSON payload can satisfy the equity endpoint at all.

4. **Borrower surface — assert what the page RENDERS, not what the API returns.**
   - `GET /api/notifications` -> a `refi_opportunity` row (`entityType:"homeowner_profile"`) and, if
     the threshold was crossed, an `equity_milestone` row.
   - **[gate - ADDED]** `PATCH /api/notifications/:id/read`, then re-`GET`. `status` must flip to
     `"read"` **and the field the client reads must change.** `NotificationsPanel.tsx:156` computes
     `isUnread: !n.readAt` from a column `notifications` does not have, so it stays `true` forever
     (**F-0819-10**). Assert `readAt` exists at all — do not assert on `status` alone, which is
     exactly how this passed before.
   - **[gate - ADDED]** `GET /api/homeowner/equity/:profileId` on a profile with >=2 snapshots ->
     assert `response[response.length-1]` is the **newest**. Storage orders `desc(createdAt)`
     (`realtorHomeowner.ts:367`) while `EquitySection.tsx:99` labels that element "Latest"
     (**F-0819-09**).
   - **[gate - ADDED]** Assert the notification is reachable: `NotificationsPanel.tsx:138-145` has no
     `homeowner_profile` mapping, so *"See your Homeowner Hub"* navigates to `/dashboard`, and the Hub
     tile there renders only for a `funded` application (`Dashboard.tsx:194`) — see **ux-24**.

5. **TCPA guards — unit-level, plus one reachability assertion that is SUPPOSED to fail today.**
   - `POST /api/webhooks/sms` (form-encoded; unsigned is accepted in dev when `TWILIO_AUTH_TOKEN` is
     unset, `twilioSignature.ts:191-196`) with `Body=STOP` -> `{"ok":true,"action":"opted_out"}` and an
     `sms_opt_outs` row. **[gate - ADDED]** Also send `Body=opt out` (with the space, as
     47 CFR §64.1200(a)(10) spells it) — it currently classifies as `unknown` and writes **nothing**
     (**F-0819-13**).
   - `evaluateOutboundSms({optedOut:true, ...})` -> `canSend:false` regardless of hour.
   - `isContactAllowed({zip:"62704", now})` at the boundaries: local hour 7 blocked, 8 allowed,
     20 allowed, 21 blocked (`quietHours.ts:16-18`).
   - **[gate - REWRITTEN] The unknown-ZIP fail-safe must be safe for every zone
     `ZIP_PREFIX_TIMEZONES` maps — not just the two it brackets against.** For an instant where
     `isContactAllowed({zip:"ZZZZZ"})` returns `allowed:true`, assert `isWithinCallingWindow` in
     **all** of `America/New_York`, `Pacific/Honolulu`, `America/Anchorage`, `America/Puerto_Rico`
     and **`Pacific/Guam`**. Today Guam fails 1,460 h/yr (local 04:00-07:00) and Puerto Rico 127 h/yr
     (local 21:00, winter) while the reason string claims *"across all US zones"* (**F-0819-12**).
     ⚠️ `tests/quietHours.test.ts:82-85` currently **asserts one of those violating instants as
     correct** (**F-0819-17**) — fix the assertion, do not merely add a test.
   - **[gate - ADDED; the reachability leg] Assert the guard is on the ONLY path out.**
     `grep -rn "evaluateOutboundSms" server/ | grep -v "smsCompliance.ts"` must return **>=1 call
     site**. It returns **0** — so every suppression assertion above is a unit test of an unreachable
     function. **Until this leg passes, step 5's `[gate]`s are recorded as VACUOUS, never as PASS.**

6. **Staff feed — currently a documented absence, not a check.**
   - `GET /api/staff/signals` (`cockpit.ts:78`; roles admin|lo|loa|processor|underwriter|closer).
   - **This step cannot pass and the reason is structural** (**F-0819-19**), not a bug to hunt.
     Record it as a wiring verdict and move on; do not write tests against it.

---

## Baseline

Alongside workflow runs, `pnpm test:integration` (73 tests as of 07-04) runs against the
same server as a regression baseline; failures are findings. *(The formerly-known
`lenderSubmission` determinism flake was fixed via an injectable generation clock —
`d5b8b54`, finding F-005 closed — so it is no longer an expected failure.)*
