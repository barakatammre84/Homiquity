# 2026-08-23 — LO submission-to-closing walkthrough (HTTP lane) + parked register rows

Dated record — immutable per TEAM_PRACTICES §2; corrections go in a banner, not a rewrite.
Companion to [`../../compliance/LO_SUBMISSION_TO_CLOSING_REVIEW.md`](../../compliance/LO_SUBMISSION_TO_CLOSING_REVIEW.md)
(the standing review this walk evidences).

## Why this is an HTTP lane, not an S1/S4 browser walk

The S1 (loan officer) and S4 (closer) browser walks were **attempted and BLOCKED**: this
session has no browser tooling (`mcp__Claude_Browser__*` absent), and
`scripts/browser-probe.cjs` has no cookie/auth option, so no authenticated surface can be
driven or screenshotted. Per the charter rule that a walk driven over HTTP is not a walk,
S1 and S4 remain **not yet run** in the walkability ledger — with this record noted as the
closest evidence so far. Everything below is API-level truth captured against a live local
server, plus one public-surface render
(`browser-probe` on `/`: 0 unlabeled interactive elements).

## Server identity (WORKFLOWS row-37 standard)

- `bash scripts/dev-up.sh` cold stand-up: local Postgres `127.0.0.1:5433/homiquity_local`,
  `.env` generated, migrations applied, seeds run.
- Server PID 31999, `cwd -> /home/user/Homiquity`, started 18:13:59Z; `GET /api/health` →
  `{"status":"ok","commit":null}` — `commit: null` **is** the local-dev signature.
- Seats via `POST /api/test-login`: `lo@`, `processor@`, `underwriter@`, `closer@`,
  `admin@test.com` (roles rewritten on login by design).
- Walk file: `server/scripts/seedDemoFile.ts` → `DEMO_APP_ID=58e8175f-7727-4c97-ab8d-e2959bcadd6a`
  (Jordan Rivera), seeded complete with the AUS stage deliberately open.

## The trace (times 18:21–18:26Z; verbatim transcripts in the session scratchpad)

| # | Actor | Action | Result |
|---|---|---|---|
| 1 | lo | `GET …/submission-readiness` | `readyToSubmitToLender:false`; stage 2 blocked "No AUS run recorded —…" |
| 2 | lo | `POST /api/underwrite/submit-gse` | `sim-du-a34f919bf7`, `approve_eligible`, DTI .3366 / LTV .80 / credit 744; D1C relief withheld ×3 ("No validated … report"); simulated commitment letter HCL-2026-D6F80C15 |
| 3 | lo | readiness again | `readyToSubmitToLender:true` (stages 3–4 attention, 0 blockers) |
| 4 | lo | `GET /api/loan-applications/:id` | full findings in payload (messages, `lpa: accept/eligible`, casefile id) — **zero client surfaces render any of it** (PF-1) |
| 5 | lo | `GET /api/wholesale-lenders` | Target-5 all `approvalStatus:"target"` + 3 SAMPLE-* rows; `apiConfig` withheld |
| 6 | lo | `POST …/lender-submissions {uwm}` | 201-path: `status:"submitted"`, `simulated:true`, XML withheld from response; **`xsdConformance:{valid:false, offendingElements:["QUALIFICATION_DETAIL"]}`** (PF-3) |
| 7 | lo | same again | **422** "An active submission to United Wholesale Mortgage already exists" |
| 7b | lo | `POST …/lender-submissions {SAMPLE-ATLAS-001}` | **422** "…seeded demo counterparty… Files can never be submitted to it." |
| 8 | lo | `POST …/:sid/conditions` ×2 | `lender_condition` rows: W-2 (`prior_to_docs`), insurance binder (`prior_to_funding`), `sourceRule lender:uwm` |
| 9a | lo | `PATCH submission → funded` from `submitted` | **422** "Cannot move a submission from "submitted" to "funded"" |
| 9b | lo | → acknowledged → in_underwriting → conditions_issued | 200 ×3 |
| 9c | lo | `PATCH /api/conditions/:id {cleared}` | **403** "Only underwriters, processors, closers, and admins can clear conditions" — while `ConditionsTab` renders the button for every staff role (GATES; fix in this PR) |
| 9d | processor | same, before team-add | **403** "Access denied to this application" — no verb had put the file on the desk (S2 theme, lived) |
| 9d2 | admin | `POST …/team` ×3 | processor/underwriter/closer added — the only assignment verb, admin-only |
| 9d3 | processor | clear W-2 condition | 200 |
| 9e | lo | submission → conditions_cleared → clear_to_close | 200 ×2 — **machine trusts the operator**: insurance-binder condition still outstanding |
| 9f | lo | → funded without figures / with figures | **400** requires `funding.fundedLoanAmount` + `compensationReceivedAmount` → then 200, `510000.00 / 10200.00` |
| 10 | underwriter | app `PATCH status` → doc_collection → processing → underwriting | 200 ×3 |
| 10 | underwriter | → clear_to_close (provenance self_reported) | **422** "Cannot use self_reported data … Verify the borrower's figures against documentation first." — **CLEAN: the provenance chokepoint works** |
| 10c | underwriter | `POST …/verify-financials` (one click, no evidence — F-0818-01) then → clear_to_close | 200 · **status clear_to_close with 1 outstanding `prior_to_funding` condition** (SG-C-A leg 1) |
| 11 | closer | census | reads 200; `POST submit-gse` **403** while the button renders (F-0818-13); `PATCH → funded` **403** "Only underwriters or admins may set approval or denial outcomes"; `PATCH → closing` **200** (the seat's one verb); `/api/staff/signals` → 0 signals for the file at the handoff |
| 12 | underwriter | `PATCH → funded` from closing | **200 with the condition still outstanding** (SG-C-A leg 2 — no `closing` branch in `checkPipelineProgress`); `hmdaActionTaken:"1"` |
| 13 | — | DB: `homeowner_profiles` for the borrower | 1 row — graduation fired |

## GATES (offered vs permitted, observed)

- `ConditionsTab` offers Clear/Waive/N-A to all staff; server verdict lists exclude `lo`
  entirely and the route gate excludes `loa` (9c) → fixed UI-side in this PR (server gates
  untouched).
- `Run DU / LPA` renders for `closer`; `POST /api/underwrite/submit-gse` excludes the role
  (11) → F-0818-13, already registered, not re-minted.

## RESIDUE

Throwaway local DB only: partial app `f7a329d7…` (first seed run, failed at
`assignLoanOfficer` before `test-lo` existed), demo file `58e8175f…` driven to `funded`,
submission `0db09ff3…` funded. Left as found; nothing touches shared infrastructure.

## CLEAN (checked, conforming — see review doc §4 for the full list)

Readiness refusal pre-AUS · D1C withholding reasons · demo-counterparty refusal ·
duplicate-active refusal · illegal-transition refusals with exact messages · funding-figures
gate · provenance chokepoint 422 · deal-team 403 before team-add · HMDA stamp on funding ·
graduation on funding.

## Parked register rows (FINDINGS.md claim-locked by open PRs #698/#710 — fold in and delete this section when the register frees)

> Each row passed the adversarial verifier this session; verdicts recorded below.

| Park id | Proposed row | Severity/type/compliance | Verifier verdict |
|---|---|---|---|
| PF-0 (headline) | Condition gate unreachable: the only client-called status route never consults `checkPipelineProgress`, and the function has no `closing` branch — clear_to_close/closing/funded granted with conditions outstanding (trace 10c, 12). Guide: B3-2-05 p.308, B3-2-01 p.291, D1-3-02 p.1066 (adopted-by-choice framing). **Fixed in this PR** (gate on target statuses under the engine's current-stage semantics + the `closing` branch; admin `force` audited). | P1 · defect · yes (Selling Guide, adopted-by-choice) | **CONFIRMED** — one row, two mutually-load-bearing legs; every refutation attack failed (no compensating gate anywhere; the codebase asserts the OPPOSITE intent — `preUnderwriting.ts:22-28` claims verbatim the status route "refuses advancement while checkPipelineProgress reports blockers," false as written and corrected in this PR). Precision: the gate keys on the CURRENT stage, so the designed semantics let `prior_to_funding` conditions ride into clear_to_close (branch 2 checks approval/docs priorities only) — the reachable-path divergences are `clear_to_close→closing` (designed branch 3 would block; got 200) and `closing→funded` (ungated everywhere). Fix-together: **F-0820-63** (branches 1-2 exempt only cleared\|waived, so a `not_applicable` condition would false-block once the gate goes live — normalized to `SETTLED_CONDITION_STATUSES` in the same commit). Also answers CTO_ROADMAP §3.6's open question ("does checkPipelineProgress actually enforce?" — it didn't, anywhere reachable); chains with F-0818-01 (one-click evidence-free verify immediately unlocked CTC, trace 10c); zero tests mentioned `checkPipelineProgress`/`stage_blocked` before this PR. All three Guide citations verified verbatim against the captured corpus. **compliance-auditor: SUPPORTED** — adopted-by-choice framing correct (the Guide is the seller's contract; A3-3-01), tighten-only safe under the Standing rule, no ECOA/HMDA interaction (gate never touches denial/withdrawal; action-taken stamps only on completed transitions). Residual to carry: the gate is only as complete as `loan_conditions` (structural AUS messages deliberately not materialized; live lender stips must be transcribed) — a green gate is not proof of condition completeness. |
| PF-1 | DU findings persisted with zero renderers for the messages, casefile id, riskAssessment, D1C detail, and the entire LPA leg (trace 4; the recommendation alone does leak into a readiness *warning* on non-approve files — the verifier's precision). B3-2-11 / B3-2-01 p.290 / B3-2-04 p.306 (B1-1-01 p.169 retains the *Analysis* report — a different artifact; Findings-report retention is B3-2-04's alone, per the compliance-auditor's correction). **Fixed in this PR** (findings panel). NOTE on this row, not a separate id: the borrower reads their own application row incl. raw `ausFindings` via the same GET — same root cause (no application-row view model; every sibling `shared/borrower*View.ts` exists for exactly this doctrine), no lender identity or staff free text inside, so no ruled violation; split out only if the compliance-auditor rules DU-findings-to-consumer a regulated disclosure. | P2 · defect · yes (B3-2-11, flagged) | **CONFIRMED** — cross-refs F-0818-15 (snapshot omits `simulated`) and F-0818-11 (`riskAssessment` zero consumers); this row IS the adversarial verification the 2026-08-18 qa-sweep parked its "no AUS findings surface" queue item for. **compliance-auditor: SUPPORTED-WITH-CORRECTIONS** — retention duty does not bind today (broker channel + a labeled simulation is not the Guide's artifact; the panel is forward-looking seam discipline); borrower access to their own findings: **no local rule requires gating it** (searched: the corpus has no such provision; no local ECOA/Reg B capture exists; FCRA text locally UNVERIFIABLE), with three carried cautions — a raw refer recommendation is never a §1002.9/§615 notice (the denial chokepoint stays the only notice path), borrower-facing framing is Reg N-sensitive, and when real DU lands, A3-4-01 (Confidentiality, pp.137-139) must be reviewed before raw genuine findings reach consumers. |
| PF-2 | Submission machine and loan pipeline share `clear_to_close`/`funded` vocabulary, never reconciled — `updateSubmissionStatus` writes only the submission row + a deal activity, and **even the autopilot decisionRelay never writes application status** (stronger than filed); pipeline chokepoints and the signal engine are all submission-blind. Trace: submission funded while app `pre_approved`. Remediation shape: a divergence *flag* — auto-sync would be WRONG, not just missing (application `funded`/CTC are PROTECTED_CREDIT_DECISION_STATUSES for underwriter/admin while the submission PATCH admits six roles, and the broker doctrine is "relays the lender's decision; makes none"). | P2 · defect · no | **CONFIRMED** — novel (no register row); not a deliberate cut (roadmap/ASSUMPTIONS/app-guide document the machinery, never bless the non-reconciliation). |
| PF-3 | Live package XSD-non-conformant on `QUALIFICATION_DETAIL` (trace 6) — reproduced mechanically with a matched control through the repo's own generator+xmllint: `server/mismo.ts:981-984` wraps `DebtIncomeRatioPercent`/`LoanToValueRatioPercent` in `QUALIFICATION_DETAIL`, and **none of the three names exists in either local XSD** (3.0's are `TotalDebtExpenseRatioPercent` and `LTVRatioPercent`-in-`LTV`); fixing the wrapper alone will unmask the two inner offenders (libxml2 stops a container at its first failure — F-049's own documented behavior). Fixture blindness: `baseDto()` omits `dtiRatio`/`ltvRatio`, so the container never validates in CI — violating the test file's own stated rule, the exact F-049-correction class. | **P1** · defect · yes (MISMO/ULDD, flagged; P1 per the F-049 precedent — same class, live outbound packages) | **CONFIRMED, new row** — the WF3-F10 duplicate logic fails here (`QUALIFICATION_DETAIL` is in no registered offender row); cross-ref F-025/L6 (the non-blocking posture) and U-14/E-1. **compliance-auditor: SUPPORTED-WITH-CORRECTIONS — severity P1** (F-049 graded the identical class P1; recording-not-blocking did not earn it a P2), and **the remediation is resolvable now, not blocked on U-14**: the failing artifact is the `loanDelivery` purpose, which U-14's own text assigns to MISMO 3.0 — schema-true homes exist for both values (`LOAN > QUALIFICATION > TotalDebtExpenseRatioPercent` for the DTI; `LOAN > LTV > LTVRatioPercent`, adding `LTV` to `LOAN_CHILD_ORDER` between LOAN_STATE and MERS), nothing needs dropping, and the fixture gains `dtiRatio`/`ltvRatio` per its own encoded rule. The 3.4-names question stays UNVERIFIABLE locally and stays with U-14. Deliberately NOT fixed in this PR (out of the approved review+build scope; `server/mismo.ts` is `hq-gse-delivery-owner`'s lane) — proposed as the immediate next fix wave. |
| PF-4 | STAFF_JOURNEYS.md: the S2 charter's "**no staff UI creates a condition** … (none exists — that absence is a recorded fact)" (:225-226, :233-234) is **wrong-at-birth, not drift** — the lender-condition transcription UI landed 2026-08-20 (#625), the charter was written 2026-08-22 — and its "Forbidden" phrasing steers the S2 walker away from a live writer (the D-014 hazard shape). Cite drift confirmed: `auth.ts` block +5 (`:354`→`:359` etc.), `statusDecisions.ts` +20 (`:127`→`:147`, closer-403 `:154-156`→`:174-175`). The proposed "`ActionsRail.tsx:62` label moved" leg is **REFUTED** — the line was already the dialog trigger at the doc's birth; file only as label-imprecision ("Submit to lender" is the rail trigger; the Run DU verb lives inside the dialog). **Corrected in this PR** (final line numbers stamped in the closing docs commit). | P3 · doc-drift · no | **CONFIRMED (a, b1, b2) / REFUTED (b3 as drift)** — birth-vs-drift settled by reading the cited files at the doc's own commit. |
| PF-5 | No server-side test POSTs `…/lender-submissions` or `/api/underwrite/submit-gse`; `PATCH /api/lender-submissions/:id` untested server-side; `evaluateDeliveryReadiness`'s `readyForDelivery` conjunction untested. | P2 · coverage-gap · no | **DUPLICATE-of F-0818-10 + F-015** — do not mint (CHARTER rule 6). Fold as updates: F-0818-10's "has no test at all" headline is stale (`SubmissionReadinessDialog.test.tsx` exists since #625, F-0818-09-scoped) while the server-side absence stands; add the `updateSubmissionStatus`/PATCH gap + integration include-list evidence there; add the `loanDeliveryReadiness.ts:244-249` conjunction cite to F-015. |
| PF-6 (auditor discovery) | Sibling of PF-3, same fabricated-name class, dormant: `server/mismo.ts:902-911` pushes `MERS_REGISTRATION` **directly under LOAN** where the XSD's child is the plural wrapper `MERS_REGISTRATIONS` (singular legal only inside it, `MISMO_3_0.xsd:11641`), and emits `MERSMINIdentifier` — **zero occurrences in both local XSDs**; the schema-true spelling `MERS_MINIdentifier` is already used correctly at `mismo.ts:840`. Dormant unless `mersMin` is set, and the conformance fixture never sets it — the identical fixture-blindness pattern one container over. | P2 · defect · yes (MISMO/ULDD, flagged) | **Handed up by the compliance-auditor during PF-3 verification** (schema lines cited); not independently re-verified by finding-verifier — run it through the verifier with PF-3's fix wave. |

## Post-fix addendum (same session, server restarted on the new code)

Fresh server (PID 17580, cwd the repo, `commit:null`), fresh seed
(`20569705-0d13-473a-a7e2-0d3dafd2830b`), same seats. The gate's designed current-stage
semantics, lived:

| Move | Conditions state | Pre-fix | Post-fix |
|---|---|---|---|
| underwriting → clear_to_close | `prior_to_funding` outstanding | 200 | **200** (correct — branch 2 checks approval/docs priorities; a funding condition may ride into CTC) |
| clear_to_close → closing | same condition outstanding | 200 | **422** `conditions_outstanding` — "Cannot set status to 'closing': 1 conditions still outstanding. Clear, waive, or mark the conditions not applicable first." |
| clear_to_close → closing | condition cleared | 200 | 200 |
| closing → funded | a NEW condition transcribed at closing, outstanding | 200 | **422** — "1 condition(s) must be settled before funding" (the new `closing` branch) |
| closing → funded | cleared | 200 | 200 — final status `funded`, **zero** outstanding conditions |

The two moves that funded a loan with an open condition in the morning walk now refuse with
the blocker list; the file that funds is clean. Route-wiring pins (422 contract,
exit-disposition exemption, admin-only audited force, non-admin force ignored):
`tests/statusConditionGate.test.ts` (7 tests). Engine-branch pins (closing branch,
`not_applicable` normalization, per-stage priority scope):
`tests/pipelineEngineStageTransitions.test.ts` (+6). Findings-panel pins against the
persisted fixture shape incl. the Simulated label and the empty state:
`client/src/components/SubmissionReadinessDialog.test.tsx` (+3). Condition-button
role-visibility pins driven by the same shared constant the route enforces:
`client/src/pages/staff/borrowerFile/ConditionsTab.test.tsx` (6). `BASELINE_INERT` 35 → 34
(ux-0818-01's button wired to `/loan-estimate/:id`).
