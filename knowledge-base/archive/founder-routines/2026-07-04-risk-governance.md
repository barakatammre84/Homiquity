# Risk & Model Governance — 2026-07-04 (midmorning run)

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**STATUS: FAIL** — carried forward from this morning's run: the live VA residual-income calculation still contradicts its own cited source and still applies an uncited 5% discount. No code in the decision path changed since the 06:49 report; this is the standing, unresolved blocker, not a new discovery. Everything checked fresh this run (test suite, audit chain, model inventory, a new threshold sample) is clean.

## ⛔ Human actions

1. **⛔ Still open — decide what the VA path should actually do.** Unchanged since this morning: `server/underwritingEngine.ts:438` computes VA residual income with an uncited 18% tax-withholding estimate and an uncited 5% "Active-Duty Commissary Facility Discount" (lines 462–470), while the tested/cited reference implementation (`underwritingNuance.ts` `computeVaResidualIncome`, `RESIDUAL_TAX_RATE = 0.22`) is not the code path `decisionEngine.ts` actually calls. Verified again this run: **no commit has touched either file since the 06:49 report** (`git log --since="2026-07-04 06:49:36" -- server/underwritingEngine.ts server/services/underwritingNuance.ts` returns nothing), so this is confirmed still-live, not stale. Roadmap ticket #29 (added this morning) is still open `[ ]`. No new information to add — see this morning's analysis in the git history of this file / ticket #29 for the full two-question decision framing. Still not fixed here: regulated math, human call needed first, then route through the guardian/scenario lane.
2. No production intake pause recommended — no live borrower traffic (pre-launch; drill/seed-data review, not an active-harm incident). No real VA loan should be decisioned until #1 resolves. Runbook on file: production intake pause = `INTAKE_PAUSED=true` in Vercel env + redeploy (`server/services/maintenanceMode.ts`); rollback = `git revert <sha>` + push. Not executed.

## Summary

This is the second risk-governance pass today (first ran 06:49 AM, committed `139681b`); a lot shipped between the two runs (S-06 rental income, intake kill switch, AAN email auto-fire, LO Command Center, Fannie Mae reference-doc scaffold) so every check was re-run fresh rather than assumed unchanged. The full regression suite grew from 66→72 tests and the audit-chain suite from 15→16, both still 100% green. The credit_audit_log hash chain re-verified clean against all 16 dev-DB application chains (23 entries total) plus the 4-entry agent chain. A second call site into the `ensureAdverseActionForDenial` chokepoint was found this run (`server/routes/underwriting.ts:598`, the stage-advance-to-denied path) that didn't exist or wasn't documented in this morning's report — traced it and confirmed it correctly gates through the same chokepoint before persisting "denied," so this is a documentation update, not a bypass. Rotated today's threshold sample to the next batch (seasoning months, deferred-student-loan factor, significant-deposit factor, conforming loan limit, and the conventional DTI/LTV/FICO/haircut policy scalars) and found a new, real gap: six DB-seeded policy scalars that gate every conventional approval (`CONVENTIONAL_DTI_CAP`, `CONVENTIONAL_STRETCH_DTI`, `CONVENTIONAL_LTV_CAP`, `CONVENTIONAL_FICO_FLOOR`, and the two asset haircuts) have no `kb/regulatory-ledger.json` citation — only a plain-English description in the seed script. AI model inventory unchanged (still exactly two AI-SDK files, both unmodified since 06:49) and still behaviorally advisory. Fraud/input-integrity posture unchanged — still no duplicate-application/identity-mismatch detection, still F3/F4-gated on live vendor data for real coverage.

## Checks run → results → evidence

### 1. Threshold citation audit (rotated sample)
This morning's report already sampled `INCOME_DISCREPANCY_THRESHOLD_PCT`, `NEW_TRADELINE_WINDOW_DAYS`, VA `RESIDUAL_TAX_RATE`, `RENTAL_INCOME_VACANCY_FACTOR`, `ASSUMED_ANNUAL_RATE`/`TAX_INSURANCE_ANNUAL_PCT` and suggested rotating to seasoning/deposit/deferred-loan/conventional-cap constants next — done this run.

| Constant | Location | Ledger/scenario citation | Result |
|---|---|---|---|
| `SEASONING_FULL_MONTHS` (24) / `SEASONING_CONDITIONAL_MONTHS` (12) | `underwritingNuance.ts:32-33` | `regulatory-ledger.json` id `fnma-b3-3-2-income-seasoning`, cites Fannie B3-3.2, verified 2026-07-03 | OK — traced. |
| `DEFERRED_STUDENT_LOAN_FACTOR` (0.01) | `underwritingNuance.ts:87` | ledger id `fnma-b3-6-05-deferred-student-loan`, cites Fannie B3-6-05, verified 2026-07-03 | OK — traced. |
| `SIGNIFICANT_DEPOSIT_INCOME_FACTOR` (0.5) | `underwritingNuance.ts:270` | ledger id `fnma-b3-4-2-02-large-deposit`, cites Fannie B3-4.2-02, verified 2026-07-03 | OK — traced. |
| `CONFORMING_LOAN_LIMIT_2026` (806,500) | `shared/lendingLimits.ts:16`, seeded into DB policy scalar `CONFORMING_LOAN_LIMIT`, resolved live in `underwritingEngine.ts:345` | Well-documented inline as "FHFA 2026 conforming loan limit, one-unit baseline" but **no entry in `kb/regulatory-ledger.json`** | WARN (minor) — real, correct, and traceable in-code, but the central ledger is supposed to be the authoritative registry per its own header comment and this one isn't in it. |
| `CONVENTIONAL_DTI_CAP` (43.0), `CONVENTIONAL_STRETCH_DTI` (50.0), `CONVENTIONAL_LTV_CAP` (95.0), `CONVENTIONAL_FICO_FLOOR` (620.0), `HAIRCUT_STOCK_INVESTMENT` (60.0), `HAIRCUT_RETIREMENT` (70.0) | `server/scripts/seedLendingGrids.ts:39-46` — DB-seeded policy scalars, resolved live via `this.resolver.getPolicyScalar(...)` in `underwritingEngine.ts:246-250,334,345` | **None of these six appear in `kb/regulatory-ledger.json` or `kb/UNDERWRITING_SCENARIOS.md`** — only a one-line `desc` field in the seed script (e.g. `"Baseline DTI ratio ceiling for standard approvals"`) | **WARN — six untraceable numbers actively gating every conventional pass/fail decision.** These are exactly the kind of live, regulated-adjacent thresholds the ledger exists to cover. Ticketed as roadmap #30. |

### 2. Scenario regression
`npx vitest run tests/underwritingNuance.test.ts tests/scenarioCatalog.test.ts tests/complianceInvariants.test.ts` → **3 files, 72 tests, all passed** (was 66 this morning — 6 new tests landed with today's other work). Standing flag, unchanged: S-05/S-06 rental-income offsets remain LO-facing advisory only, never reach `decisionEngine`'s actual DTI.

### 3. Model inventory vs reality
`git log --since="2026-07-04 06:49:36" -- server/extractionService.ts server/services/coachingService.ts server/services/documentConfidence.ts kb/AI_GOVERNANCE_POLICY.md kb/MODEL_RISK_GOVERNANCE.md` → no commits. Re-ran the SDK grep fresh anyway: `grep -rln 'from "openai"|GoogleGenerativeAI|@anthropic-ai/sdk' server/` still returns exactly `server/extractionService.ts` and `server/services/coachingService.ts`. No drift, no new model IDs, no new prompt surfaces. Behavioral boundary unchanged from this morning's verification (advisory-only; Zod-validated outputs; low-confidence routing to human review).

### 4. Decision audit trail
Re-ran the chain verifier read-only against the current dev DB (temporary script, written/executed/deleted, not committed): **16/16 per-application chains valid, 23 entries total** (was "1-7 per app" counts this morning, no total given — entry count grew as expected since new activity happened between runs); **agent chain valid, 4 entries** (unchanged). `npx vitest run tests/mcpAudit.test.ts tests/auditReanchor.test.ts` → 2 files, **16 tests, all passed** (was 15 this morning). Chokepoint re-check: `grep -rn '"denied"'` across routes/services now shows the stage-advance path in `server/routes/underwriting.ts:598` also sets "denied" — a second call site not documented in this morning's report. Traced it: `underwriting.ts:598-616` explicitly calls `creditService.ensureAdverseActionForDenial(...)` (with an inline comment citing ECOA/Reg B §1002.9 + FCRA §615) *before* `updatePipelineStage` persists the "denied" stage, and blocks the transition (422) if adverse-action generation fails. Confirmed no bypass — both denial-setting paths (`lending.ts:1333/1402` and `underwriting.ts:598`) route through the same audited chokepoint.

### 5. Fraud & input-integrity posture
Unchanged from this morning: low-confidence document routing exists (`documentConfidence.ts`, `<0.7` → human review), Zod validation at intake, simulated-vendor trust flags (`isSimulated`/`simulated: true` in `creditService.ts`, `simulateCreditPullCompletion` hard-throws outside `CREDIT_VENDOR_MODE=simulation`). `grep -rn "duplicate.*application|identity.*mismatch" server/` still returns nothing — no duplicate-application or identity-mismatch detection exists anywhere. Real fraud coverage on live vendor data remains ⛔ F3/F4-gated, unchanged.

## Corrections table

| Doctrine/prompt/prior-report said | Verified reality |
|---|---|
| This morning's report: "exactly one place sets `status = 'denied'`" (`lending.ts:1333/1402`) | There is a **second** call site: `server/routes/underwriting.ts:598` (the stage-advance-to-denied path). It is correctly gated through `ensureAdverseActionForDenial` before persisting — not a bypass, just an undocumented second entry point. Update mental model: 2 call sites into the denial chokepoint, both audited. |
| Implicit assumption that today's threshold rotation would only need to look at `underwritingNuance.ts` constants | The next batch (per this morning's own rotation note) surfaced a citation gap in a different file entirely — `server/scripts/seedLendingGrids.ts`'s DB-seeded policy scalars. The ledger-citation gap isn't confined to hardcoded literals in the nuance file; DB-resolved policy scalars need the same rigor. |

## Remediation tickets

- **P0 (unchanged, still open) — roadmap #29, VA residual-income tax rate/discount.** Owner: Amr (decision) then Claude (fix via guardian/scenario lane). No new action this run — confirmed still unresolved, no code changed.
- **P1 (added to CTO_ROADMAP.md #30, this commit) — six conventional-loan policy scalars in `seedLendingGrids.ts` have no regulatory citation.** Owner: Claude. Est. 2h — add ledger entries citing Fannie Selling Guide eligibility matrix / DU messaging (or an explicit internal-policy citation where a value is deliberately conservative), or correct values that don't match the actual guideline.
- **P1 (added to CTO_ROADMAP.md #31, this commit — backfilled; this morning's report drafted this ticket but never appended it to the roadmap) — `INCOME_DISCREPANCY_THRESHOLD_PCT` declared, uncited, never used.** Owner: Claude. Est. 1h.
- **P1 (added to CTO_ROADMAP.md #32, this commit — same backfill) — `NEW_TRADELINE_WINDOW_DAYS = 90` live but uncited.** Owner: Claude. Est. 1h.
- **P2 (not re-appended — already logged this morning, unchanged) — no duplicate-application/identity-mismatch detection.** Owner: Amr (define "duplicate") + Claude (implement once scoped). Real teeth blocked on F3 live credit data regardless.

Roadmap tickets #30, #31, #32 appended to `CTO_ROADMAP.md` "Do next" in this commit (grepped first for existing entries on these constants — none found; #31/#32 were drafted but never actually committed to the roadmap in the 06:49 run, so this closes that process gap).

---
STATUS: FAIL
