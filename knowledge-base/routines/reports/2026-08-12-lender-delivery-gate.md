# Lender Delivery Gate — 2026-08-12

STATUS: WARN — the delivery gate passes and the organic write path for the **anti-steering acknowledgment** is proven end to end; but the XSD gate that certifies our MISMO 3.4 export was reporting PASS on machines without `xmllint`, and the §1.3 lender actions are now **30 days** old and unworked.

## ⛔ Human actions

**Target-5 execution — `CTO_ROADMAP.md` §1.3, unblocked 2026-07-13, age 30 days, zero actions taken.** F1 is cleared (`shared/companyIdentity.ts:16` → `nmlsId: "427468"`, verified this run). Outbound contact is founder-only; this routine has drafted nothing and contacted no one.

| # | Action | Age (days) |
|---|---|---|
| 1 | **Re-verify all five are still broker-friendly and NMLS-active** — the shortlist is a 2026-07-04 snapshot, now 39 days stale. Do this *before* the four below, or the calls are wasted. | 30 |
| 2 | **UWM** — AE / Director hotline (248-833-4602, per public listing): sandbox process, and whether BOLT exposes a PPE-consumable rate feed or is portal-only. | 30 |
| 3 | **Newrez** — Brigade contact for the sandbox path. | 30 |
| 4 | **Angel Oak + Newrez** — request the broker-approval checklists. | 30 |
| 5 | **Plaza** — manual read of the 82-page wholesale-broker guide PDF for net-worth / surety-bond minimums (automated fetch cannot parse it; it is the most detailed public doc of the five). | 30 |

Secondary: **`libxml2-utils` is not in the documented apt package set of the `ubuntu-latest` runner image** — decide whether to add an install step to the `gate` job (see Evidence 2). The fix in this PR makes the gap *visible* rather than silent; it does not close it.

## Summary

The delivery capability gate is green: 16 suites, 362 tests, exit 0, including the MISMO 3.4 XSD conformance baseline, which is **empty** — both the underwriting-purpose and loanDelivery-purpose exports validate clean against the official schema (L6-fix, closed 2026-08-05). This run's rotated organic-file field is the **Reg Z §1026.36(e)(3) anti-steering acknowledgment**, the hard blocker on submission stage 3; its write path is borrower-reachable and persists to the exact row the readiness check reads — it **clears**. The one defect found is in the gate itself: eight of the nineteen XSD tests early-`return`ed when `xmllint` was missing, which vitest reports as **passed**, so the only schema-truth check on our lender-facing export went green while asserting nothing. Fixed on a worktree branch with both directions of the behaviour demonstrated. Upstream, the Launch Gate and Sprint Blitz reports for today are absent.

## Evidence

### 1. Delivery capability gate — PASS

Suite globbed from `tests/` (not a fixed list), then run:

```
tests/{mismoExport,mismoMersMin,mismoValidation,mismoXsdValidation,loanDeliveryEdits,
       qmThresholds,brokerSubmissionReadiness,lenderSubmission,lenderApprovalControl,
       urlaLoanDetailsSave,urlaRowContent,urlaCoApplicantRemoval,adverseActionDelivery,
       autopilotAusFollowUps,nonQmProgramGate,compensationElectionQmGate}.test.ts

Test Files  16 passed (16)      Tests  362 passed (362)      exit 0
```

`tests/mismoExportAccess.test.ts` and `tests/lenderConditions.test.ts` were checked against the allowlist and are **correctly** classified — both are HTTP tests (`import { BASE_URL } from "./setup"`) and both are listed in `vitest.integration.config.ts:24,26`, not the node config. Not a coverage bug. Worth knowing, though: the **H8 role gate on `/mismo-export`** — the route that embeds full SSN + DOB — is covered *only* by that integration lane, which never runs in CI.

MISMO version confirmed 3.4 (`DataVersionIdentifier 3.4.0`); no 3.6 chase, no counterparty demand on record. No field name, enumeration, container path, edit code or SFC was invented or altered this run.

### 2. ⚠️ The XSD gate reported PASS with no validator — fixed

`tests/mismoXsdValidation.test.ts` is the only check that our generated MISMO 3.4 XML is *schema*-valid rather than valid-per-our-own-rules. Eight of its nineteen cases were guarded by `if (!xmllintInstalled) return;`. An early `return` is a **passing** test in vitest, not a skipped one — so with libxml2 absent the whole conformance gate went green while executing no assertion.

Not hypothetical: the `ubuntu-latest` (24.04) runner image's documented apt package list contains no `libxml2-utils` (fetched via `gh api repos/actions/runner-images/contents/images/ubuntu/Ubuntu2404-Readme.md`; 331 lines, zero matches for `xml`), and `.github/workflows/*.yml` installs nothing (`grep -n "xmllint\|libxml"` → no matches). Whether the binary is present transitively on the runner is **unverified** — and that is the point: today nothing would tell us either way.

Demonstrated in both directions, running with a PATH sandbox that contains `node`/`sh` but no `xmllint`:

| | xmllint present | xmllint absent |
|---|---|---|
| `main` (`adaa826`) | 19 passed | **19 passed** ← the lie |
| this branch | 18 passed \| 1 skipped | **11 passed \| 8 skipped** |

The single skip in the xmllint-present column is the inverse contract case ("returns skipped:true when xmllint is unavailable"), which now declares itself with `it.skipIf(xmllintInstalled)` instead of early-returning. Detection moved from `beforeAll` to module scope because `skipIf` is evaluated at collection time. No assertion was added, removed, or weakened; the baseline stays empty.

`shared/mismo.ts`, `server/mismo.ts` and every product path are untouched — the change is confined to one test file.

### 3. Organic-file question — **anti-steering acknowledgment CLEARS**

Rotated field this run: `borrower_consents.consent_type = "anti_steering"` (Reg Z §1026.36(e)(3)). Chosen because it is a **hard blocker**, not a warning: `brokerSubmissionReadiness.ts:198` pushes `"Anti-steering loan-options disclosure … has not been acknowledged"` into `pkgBlockers`, so stage 3 never reaches `readyToSubmitToLender` without it. If only the demo seed could write it, no organic file could ever reach a wholesale lender.

The seed does write it — `server/scripts/seedDemoFile.ts:146` loops `["anti_steering", "e_disclosure"]` — which is exactly the shape that hides a missing product path. It is not missing. Chain traced in code:

1. `client/src/App.tsx:420` — `/loan-options/:id` renders inside `<BorrowerPage>`; borrower-reachable, not staff-only.
2. `client/src/pages/lending/LoanOptions.tsx:175-185` — when `!steeringAcknowledged`, renders `<ConsentGateCard applicationId={id} consentType="anti_steering">`. Gated on the page's `data` loading, not on any option existing.
3. `client/src/components/ConsentGateCard.tsx:52-59` — `POST /api/consents` with `{ applicationId, templateId, templateVersion, consentType, consentGiven: true, consentMethod: "click" }`.
4. `server/routes/borrower/consents.ts:71-125` — `isAuthenticated`; rejects 403 unless `application.userId === user.id` (staff cannot forge a borrower consent); persists via `createBorrowerConsent` **with `applicationId`**, plus IP, UA and a SHA-256 content hash.
5. `server/storage/locksAndConsents.ts:160-172` — `getConsentByTypeAndApplication` matches on `consentType` **and** `applicationId` and `isRevoked = false`, newest first.
6. `server/consentGate.ts:31-35` → `hasBorrowerConsent("anti_steering", applicationId)` → `brokerSubmissionReadiness.ts:271-273` → `consents.antiSteering`.

The two ways this class of defect usually hides were both checked: the consent is written **application-scoped**, not user-scoped (a `null` applicationId would make step 5 miss it permanently while the seed passed), and the disclosure template is guaranteed to exist — `ensureComplianceTemplates()` is called unconditionally at `server/routes.ts:107`, and rolls a stale version forward rather than only inserting-if-missing (`server/consentGate.ts:125-174`). Without a template, `ConsentGateCard` renders "Disclosure unavailable" and there would be no way to acknowledge.

**Verdict: real product write path. Field cleared.**

**Cleared-field ledger** (so coverage accumulates across runs — future runs append, never re-check):

| Run | Field / section | Verdict |
|---|---|---|
| 2026-08-05 (#400, recorded by wiring audit 2026-08-12) | `preferredLoanType` / `amortizationType` (URLA §4) — the former WF2-F4 | cleared |
| **2026-08-12 (this run)** | **`anti_steering` acknowledgment (Reg Z §1026.36(e)(3)) — submission stage 3 blocker** | **cleared** |

Next rotations, ranked by blast radius (all are stage blockers): the `e_disclosure` consent; `urla_property_info.occupancy_type` (feeds `mapPropertyUsage` → ULDD `PropertyUsageType`); the AUS casefile + recommendation pair (`aus.casefileId` — stage 2 hard blocker); the change-of-circumstance records driving the revised-LE gate.

### 4. Delivery build status — read from code this run, not memory

- **Lender submission adapter** (`server/services/lenderSubmission.ts`, 397 lines) — real status machine, not a stub: `isValidSubmissionTransition` rejects illegal moves (`:330`), `LENDER_SUBMISSION_STATUSES` membership is validated rather than cast (`:322`), `ACTIVE_STATUSES` blocks a duplicate live submission to the same lender (`:166`), and `approvalStatus` is validated so a file cannot transmit to a company that was never approved (`:95-103`). A `funded` transition has its own guard (`:346`).
- **XSD validation** — exists, wired, and **passing with an empty baseline**. Every structural violation is cleared, including escalation U-1 (the AUS names, resolved 2026-08-05 by extracting `MISMO_3_0.xsd` content models and re-running xmllint — verified, never guessed). Both schemas are tracked in git (`git ls-files docs/fannie-mae/schemas/uldd-phase5-extension/`), so CI has the inputs. Per this routine's standing instruction, it is now permanently in the step-2 suite.
- **`loanDeliveryReadiness.ts`** — no functional gap found; its design point is that uncaptured data reports as *"not evaluated"*, never as a pass (`:1-13`). Correct posture. Note `channelApplicability`: in the broker channel GSE delivery is the **wholesale lender's** obligation, so this report is a data-quality pre-flight and must never read as a gate we are subject to (F-14).
- **`brokerSubmissionReadiness.ts`** — the real gate. Stages 1–3 block; stage 4 (delivery pre-flight) is informational by design. AUS quality deliberately does not block: `refer` / `approve_ineligible` files stay placeable by a human (L1 routes ambiguity to people).
- **Dual-AUS** (`server/services/ausSubmission.ts`, 349 lines) — both legs present. DU is 12.1-shaped with Day 1 Certainty parsing; the LPA leg (`submitToLPA`, `:225`) is a deterministic simulation that **throws on purpose** if `FREDDIE_LPA_API_KEY` is set (`:226-228`), so a real key can never silently produce fake findings. DU-only casefiles are flagged as a warning, not a blocker.

### 5. Scenario intake — not triggered

`knowledge-base/compliance/UNDERWRITING_SCENARIOS.md` last changed **2026-08-07** (`git log -1 --format=%cs`), outside the 24 h window. Step 6 correctly skipped.

### 6. Sync, register, and gate output

`git pull --rebase origin main` → `adaa826`; `pnpm install --frozen-lockfile` re-run after the rebase (CHARTER §5.1). `ListAgents` → three peer sessions live (`pensive-noether-5232f2-ce`, `homiquity-88`, `homiquity-37`) — none claiming this target. `REGISTER.md` Active claims was empty.

**Deviation, stated plainly:** the register row was written at commit time rather than before the edit (CHARTER §5.4 wants it first). Low risk here — Active claims was empty, the target is a single test file, and no peer touched it — but it is a deviation, not a judgement call, and the next run should claim first.

Branch `routine/lender-gate-2026-08-12`, rebased on `adaa826`, reinstalled after the rebase:

```
pnpm check   exit 0
pnpm test    node   188 files, 2666 passed | 1 skipped (2667)
             client  67 files,  485 passed (485)
```

The one node-lane skip is the intentional inverse case from Evidence 2.

**Not verified:** no browser or dev-server check — dev servers do not start in an unattended run (CHARTER §10). This is test-and-typecheck evidence only. Nothing was pushed to `main`, no PR merged, no auto-merge armed, no production variable touched, and no lender contacted.

### 7. Upstream reports — WARN

CHARTER §4 makes reading peers mandatory. Present for today: `2026-08-12-wiring-audit.md` (read; its WF2-F4 closure is consistent with this run's ledger). **Absent: `launch-gate` (07:48) and `sprint-blitz` (09:53).**

Not treated as "nothing happened", and the two are **not** the same case:

- **Sprint Blitz ran and is still in flight.** Branch `routine/sprint-blitz-2026-08-12` exists with its own commit `24dbb36` *"chore(register): sprint-blitz claims CTO_ROADMAP §3.2 (the last N+1 loop)"*, in worktree `.claude/worktrees/blitz-0812`. `git rev-list --count main..` → 4 (one its own, three already merged). The branch is **local-only** — `git ls-remote --heads origin routine/sprint-blitz-2026-08-12` returns nothing — and has no PR (`gh pr list`), so it is invisible to every peer that checks the usual way. No missing-report escalation is warranted; a **claim recorded only on an unpushed branch is not a lock**, which is worth Evening Triage's attention on its own.
- **Launch Gate** has no branch, no worktree and no report. The reports directory itself was created today (`README.md`, 15:48), so a newly-rebuilt suite is the plausible cause rather than a failure — but that determination is Evening Triage's under §4, not this routine's.

Side note from the same sweep: the **primary checkout** is currently on `routine/qa-sweep-2026-08-12`, not `main` — it was on `main` when this run started. Concurrent peers move it mid-session; this run wrote only inside its own worktree, so nothing crossed.

## Proposed tickets

1. **Install `libxml2-utils` in the CI `gate` job** — one `apt-get` step, no job-`name:` change (the required-check string is matched verbatim). Without it the eight XSD cases now report as *skipped* and the schema-conformance gate on our lender-facing export is decorative. Alternatively assert presence under `process.env.CI` and let it fail loudly — deliberately not done here, because if the binary is genuinely absent that reds every PR at once, and that is the founder's call, not a routine's.
2. **Promote the H8 MISMO-export role gate into the node lane.** `tests/mismoExportAccess.test.ts` guards a route that emits full SSN + DOB to whoever passes the gate, and it lives only in the integration lane, which never runs in CI. A static role-gate assertion (the `routeGates.test.ts` shape) would cover the regression without needing a server.
3. **Re-verify the Target-5 shortlist before any outreach** (§1.3 item 1). At 39 days, "still broker-friendly and NMLS-active" is an assumption, and the other four actions are wasted if it is wrong.
4. **Rotate the next organic-field check to `e_disclosure`**, then `occupancy_type`. Ledger in Evidence 3.
5. **A register claim on an unpushed branch is not a lock.** Sprint Blitz's §3.2 claim (`24dbb36`) exists only on a local branch with no PR, so no peer can see it by the documented means — CHARTER §5.4 says "commit the claim on your branch so peers can see it", which is only true once the branch is pushed. Either require a push, or move the register to a shared location that does not depend on one.

STATUS: WARN
