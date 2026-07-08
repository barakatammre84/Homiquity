# Midday LO Edge-Case Mining — 2026-07-04

**STATUS: WARN** — No edge case silently produced a wrong regulated outcome today, but two friction-telemetry signal types are declared and never fired (a real capture gap), and the known S-05/S-06 rental-income advisory-vs-decision gap remains open. One concrete edge case was found, fixed, tested, and shipped as a PR today.

---

## 1. Human checklist — for the founder's LO sit-down (late morning)

**PRE-LAUNCH HONESTY: there is no live LO traffic on the platform yet** (verified — no seeded/named LO users found in `server/seed.ts`, no friction/edge-case history predating today). The interview script below is the standing artifact to run once founding LOs are on the platform; today's findings were mined from code paths and seed data as a drill, per the routine's own instructions — nothing here is a fabricated anecdote.

Interview script — one line per LO, to be filled in by the founder:

> Since yesterday: (1) any file the engine handled wrong or didn't handle? (2) any manual workaround you did? (3) any borrower answer the intake had no field for? (4) any doc the system rejected that you could read fine?

| LO | (1) Mishandled file | (2) Manual workaround | (3) No-field borrower answer | (4) Wrongly-rejected doc |
|----|---|---|---|---|
| _(name)_ | | | | |
| _(name)_ | | | | |

⛔ Nothing blocking here — no LOs to interview yet. Re-run this section for real once the first founding LO is onboarded.

---

## 2. Summary

The engine's document-requirements config has a real dead end: borrowers who select employment type **"other"** (1099 contractors, trust/pension income — a valid schema value) silently fell through to the "employed" bucket and were asked for a W-2 they cannot produce, per `server/pipelineEngine.ts`. This is exactly the class of defect this routine hunts for — a file the engine "handled wrong" that an LO would otherwise have to notice and route around by hand. It's fixed, unit-tested, and shipped as [PR #37](https://github.com/barakatammre84/MortgageStream/pull/37) today (see §7). Separately, the friction-telemetry module (`frictionLog.ts`) declares five signal types but only three are ever fired in the codebase — `credit_pull_blocked` and `rate_limited` are dead, meaning a real borrower hitting a credit-pull consent wall today would produce **no durable signal at all**, only a thrown `Error`. The known S-05/S-06 gap (rental-income advisory copy that never reaches `decisionEngine.ts`'s actual DTI, flagged by last night's LO audit as H9) remains open and is carried forward, not re-litigated here.

---

## 3. Checks run → results → evidence

### 3a. Mined edge cases

| Source | Symptom | Classification | Evidence |
|---|---|---|---|
| `pipelineEngine.ts` document requirements | `employmentType: "other"` (1099/trust/pension) silently mapped to the "employed" bucket → asked for a W-2 | **AUTOMATE — fixed today** | [`server/pipelineEngine.ts:71-138`](../../server/pipelineEngine.ts) (`EMPLOYMENT_RULES`), [`shared/schema/lending.ts:943-946`](../../shared/schema/lending.ts) (enum includes `"other"`) |
| `creditService.ts` credit-pull consent gate | Missing/invalid consent throws a bare `Error("Valid consent required before credit pull")` — never calls `logFriction` | **TELEMETRY** (§3b) | [`server/services/creditService.ts:590-603`](../../server/services/creditService.ts) |
| `preUnderwriting.ts` / `decisionEngine.ts` | S-05/S-06 rental-income offsets compute an LO-facing advisory (`"this adds $450/month toward your qualifying income"`) that `aggregateBorrowerFinancials()` never reads — the binding DTI/decision excludes it | **HUMAN-UW / carried, not new** — verified still open: `aggregateBorrowerFinancials` (`decisionEngine.ts:137-224`) has zero references to `preUwFlags`, `subjectProperty`, or the rental-offset helpers | [`server/services/decisionEngine.ts:137-224`](../../server/services/decisionEngine.ts), [`server/services/preUnderwriting.ts:305-338`](../../server/services/preUnderwriting.ts) |
| `pipelineEngine.ts` property-based requirements | `propertyType === "condo"` captured on the profile but never triggers an HOA-cert/condo-questionnaire requirement (matches last night's lo-audit L10) | **AUTOMATE — backlog, not today's pick** | [`server/pipelineEngine.ts:176-207`](../../server/pipelineEngine.ts) (`PROPERTY_REQUIREMENTS` has no `propertyType` branch) |
| `extractionService.ts` schema-validation failures | Structurally-unusable model output returns `confidence: "low"` + a warning, which **does** flow into `recordExtractionConfidence`/human-review queue | **Verified clean, not a gap** — H6 (last night's lo-audit) already wired doc-confidence gates everywhere | [`server/extractionService.ts:428-458`](../../server/extractionService.ts), [`server/services/documentConfidence.ts:16-68`](../../server/services/documentConfidence.ts) |

### 3b. Telemetry-gap audit

The platform's only two durable signal stores for this loop are `frictionLog.ts` → `intent_events` (via `trackIntent`) and `document_confidence_scores` (via `documentConfidence.ts`). Checked each declared signal type against actual call sites:

| Signal | Declared? | Actually fired? | Where it would persist if fired | Gap |
|---|---|---|---|---|
| `consent_gate_blocked` | Yes | Yes — `consentGate.ts:149` | `intent_events` (`friction_event`) | None |
| `anti_steering_blocked` | Yes | Yes — `lending.ts:827` | `intent_events` | None |
| `document_upload_failed` | Yes | Yes — `lending.ts:1198` | `intent_events` | None |
| `credit_pull_blocked` | Yes | **No** — `creditService.ts:602` throws a bare `Error` instead | Nowhere | **Missing-telemetry ticket** (below) |
| `rate_limited` | Yes | **No call sites found** anywhere in `server/` | Nowhere | **Missing-telemetry ticket** (below) |
| Document extraction confidence | N/A (separate store) | Yes — every extraction route calls `recordExtractionConfidence`/`recordCoarseExtraction` | `document_confidence_scores` + `analyticsEventPipeline` | None (verified H6 fix holds) |

**Missing-telemetry ticket T1 — `credit_pull_blocked` never fires.** When `requestCreditPull` rejects a stale/invalid consent (`creditService.ts:601-603`), it throws instead of calling `logFriction("credit_pull_blocked", { applicationId, detail: "consent id mismatch or expired" })` before/alongside the throw. Fields: `applicationId`, `userId` (requestedBy), `detail` (reason: no consent vs. id mismatch). No PII (no SSN/DOB/credit content) — safe to log. Persist via the existing `logFriction` → `intent_events` path, no new store needed.

**Missing-telemetry ticket T2 — `rate_limited` never fires.** Declared in the `FrictionPoint` union but zero call sites. Either wire it into the actual rate-limiter middleware (auth/test-login limiters referenced in the type's own comment) or remove the dead union member — right now it's aspirational, not real. Fields: `userId` (if authenticated), `detail` (which limiter), no PII.

### 3c. Yesterday's 24-hour pick

Not applicable — this is the **first run** of this scheduled routine (no prior `kb/founder-routines/*-lo-edgecases.md` report exists).

---

## 4. Corrections table

| Prior claim | Source | Correction |
|---|---|---|
| "S-06... uncommitted, no `scenarioCatalog.ts` entry — will fail `tests/scenarioCatalog.test.ts` the moment it's committed" | `kb/lo-audit/2026-07-04.md` H9 | **Stale.** S-06 was committed since that report (`b7f6e5d "feat: implement S-06 multi-unit subject property rental income"`), and `scenarioCatalog.ts:146-165` already has a full `S-06` entry. `tests/scenarioCatalog.test.ts` passes today (5/5). The core H9 finding — that `decisionEngine.ts` never reads the rental-offset flags — is **still true**, independently re-verified today at `decisionEngine.ts:137-224`. |
| My task file's H9 framing implied a migration file was also still missing | `kb/lo-audit/2026-07-04.md` H9 | Not independently re-checked today (out of this routine's scope); flagging that it may also be stale given S-06 landed — worth a quick check by whoever picks up the DTI-wiring fix. |

---

## 5. Remediation tickets

| Ticket | Owner | Est. | Notes |
|---|---|---|---|
| **Fix "other"-employment doc requirements** | Claude | Done | Shipped today — [PR #37](https://github.com/barakatammre84/MortgageStream/pull/37), not yet merged (never pushed to `main` directly, per rule). |
| **T1 — wire `credit_pull_blocked` friction logging** | Claude | 0.5h | `creditService.ts:601-603`; call `logFriction` before the throw, same pattern as `consentGate.ts:149`. |
| **T2 — wire or remove `rate_limited` friction logging** | Claude | 0.5h | Decide with Amr: real limiter integration (~1h) vs. deleting the dead union member (~5 min). Recommend the real integration — rate-limit walls are exactly the "friction the borrower silently hit" signal this loop exists to catch. |
| **L10 — condo/1099/trust-income document branches (carried from lo-audit)** | Claude | 2h | `pipelineEngine.ts` `PROPERTY_REQUIREMENTS` needs a `propertyType === "condo"` branch (HOA cert / condo questionnaire); today's fix covers the 1099/trust-income *employment*-type half specifically, condo half remains. |
| **H9 / S-05-S-06 DTI wiring (carried, cross-cutting)** | Amr (needs a product decision first) | 3h once decided | Either fold the rental net-offset into `aggregateBorrowerFinancials`, or soften the advisory copy so it stops implying the offset already changed the decision. Do not patch directly — route through the scenario/guardian lane per this repo's compliance-first rule. |

No genuinely new P0/P1 items met the bar for CTO_ROADMAP.md today — T1/T2 are sub-hour instrumentation fixes better tracked here than as roadmap noise, and H9/S-05-S-06 is already carried in memory (`scenario-engine.md`) and in last night's lo-audit report rather than duplicated into the roadmap.

---

## 6. The 24-hour pick

**Picked (already done today, not deferred):** the `employmentType: "other"` document-requirements fix.

- **Files touched:** [`server/pipelineEngine.ts`](../../server/pipelineEngine.ts) (added an `other` bucket to `EMPLOYMENT_RULES`), [`tests/pipelineEngineDocumentRequirements.test.ts`](../../tests/pipelineEngineDocumentRequirements.test.ts) (new), [`vitest.config.ts`](../../vitest.config.ts) (registered the new test file in the explicit `include` list).
- **Test added:** 3 cases — "other" no longer receives `w2`; "other" receives a 2-year `tax_return` requirement instead; "employed" is unaffected (regression guard). All pass; `tests/scenarioCatalog.test.ts` (5/5) and `npx tsc --noEmit` also clean.
- **Acceptance criterion:** a loan application with `employmentType: "other"` never has `w2` in its generated document requirements, and does have a 2-year `tax_return` requirement — met.
- **Shipped as:** [PR #37](https://github.com/barakatammre84/MortgageStream/pull/37) (branch `claude/lo-edgecase-other-employment`, isolated worktree, not pushed to `main`).

**Tomorrow's carry-forward pick (not done today, next in line):** wire `credit_pull_blocked` (T1 above) — smallest, cleanest telemetry fix, same pattern as the three already-working friction points, 30 minutes.

---

STATUS: WARN
