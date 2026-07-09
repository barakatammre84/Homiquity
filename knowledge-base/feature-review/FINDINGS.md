# Feature Review — Findings Register

The single register for all verified findings from the feature-review program. Rules and
lifecycle: `CHARTER.md`. Only findings that survived `finding-verifier` (and, where flagged,
`compliance-auditor`) may be added. REFUTED findings are recorded too, so they are not
re-discovered on re-runs.

**Id convention**: audit ids are canonical — `F-###` (product/code), `D-###` (documentation),
`ux-##` (UI/UX), `N-###` (corrections), `U-#` (escalations). Domain column maps to `DOMAINS.md`.

> **Seeded 2026-07-08 from a 9-dimension read-only audit** (existence, wiring, tests,
> gating/data-model, workflows, security, compliance-math, documentation ×2, static UI/UX). These
> are *pre-verified* entries; a domain re-run confirms/closes them. Baseline: security posture
> **strong** (no P0/IDOR); numeric compliance tables **verified correct** (N-003).

## Open findings

| id | domain | type | sev | compliance | summary | evidence | status |
|---|---|---|---|---|---|---|---|
| F-018 | 8 | defect | **P0** | yes (ULDD) | MISMO core points mis-nested under `LOAN_DETAIL` vs `TERMS_OF_LOAN`/`AMORTIZATION_RULE` → XSD-invalid, delivery rejected | `server/mismo.ts:617-668`, `shared/mismo.ts:1126` vs local ULDD XSD + golden UCD samples | open |
| F-019 | 8 | defect | **P0** | yes (ULDD) | Invalid `LoanPurposeType` enums (`CashOutRefinance`/`ConstructionToPermanent`); should be `Refinance` + `RefinanceCashOutDeterminationType` → every refi/construction loan | `server/mismo.ts:157-160` | open |
| F-002 | 10 | defect | P1 | no | Analytics/predictive dashboards render off an empty `loanOutcomes` — its writers are never called | `outcomeTracker.ts:113,146` have zero callers | open |
| F-003 | 7 | defect | P1 | no | AUS DU/LPA dual-submission has no UI trigger (workflow #9 broken-from-UI) | `server/routes/aus.ts:134` zero client callers | open |
| F-004 | 9 | defect | P1 | yes (ECOA) | Adverse-action *generation* has no UI trigger — only cron watchdog + reader wired; launch-gate if the MVP can deny | `server/routes/compliance.ts:827` | open |
| F-005 | 7/8 | defect | P1 | no | MISMO XML non-deterministic (ms `CreatedDatetime` stamped into hashed XML) — root cause of the lenderSubmission flake; = PRs #64/#65 | `server/mismo.ts:1034,989` | open |
| F-020 | 8 | defect | P1 | yes (MISMO) | Invalid `LiabilityType` enums (`Mortgage`→`MortgageLoan`, `Other`→`OtherLiability`; child-support/alimony aren't `LiabilityType`) | `server/mismo.ts:208-216` | open |
| F-021 | 8 | defect | P1 | yes (MISMO) | `MortgageType` `USDA`→`USDARuralHousing` (see U-3) | `server/mismo.ts:148` | open |
| F-022 | 8 | defect | P1 | yes (MISMO) | `AssetType` `Other`→`OtherLiquidAssets`/`OtherNonLiquidAssets` | `server/mismo.ts:196,198` | open |
| F-023 | 8 | defect | P1 | yes (ULAD) | URLA §5 declaration data-point names drift (13 of 19) vs ULAD Map v1.8 (see U-4) | `server/mismo.ts:335-366` | open |
| F-024 | 6/8 | defect | P1 | yes (TRID) | CD "3 business days before consummation" uses the general (Sat-excluded) def; §1026.19(f)(1)(ii) uses the precise def (Sat counts) | `server/services/mismoValidation.ts:667` | open |
| F-014 | 5 | coverage-gap | P1 | yes (multi) | `complianceInvariants.test.ts` is 100% source-grep — passes on wrong logic, breaks on renames (false confidence) | `tests/complianceInvariants.test.ts` | open |
| F-008 | 9 | defect | P1* | yes (TCPA) | SMS webhook has no signature verification → forged START re-subscribes an opted-out number; *blocker only if SMS live at launch* | `server/routes/webhooks.ts:21` | open |
| ux-01 | UX | ux-refinement | P1 | no | 41/68 data pages don't handle query-*error* state → server failure renders a misleading "empty" screen | `lending/ApplicationSummary.tsx:49`, `borrower/Documents.tsx:163` | open |
| F-025 | 8 | coverage-gap | P2 | yes (ULDD) | In-app MISMO "validation" is a substring check — can't catch enum/xpath errors; add an XSD gate (= roadmap L6) | `server/mismo.ts:1073-1118` | open |
| F-026 | 6 | defect | P2 | yes (Reg Z) | APR solver omits Appendix J odd-first-period handling (fine for estimates, not a final TILA APR) | `server/services/apr.ts:57-94` | open |
| F-006 | 13 | defect | P2 | yes (audit) | SSN/account-number *writes* aren't audited (reveal is) — violates "every PII mutation gets an audit entry" | `server/routes/borrower.ts:419`, `server/storage.ts:1461,1600+` | open |
| F-007 | 13 | defect | P2 | no | `GET /api/admin/users` serializes `passwordHash` (admin-gated, but should project columns) | `server/routes/admin.ts:47`, `server/storage.ts:1007` | open |
| F-009 | 13 | defect | P2 | yes (PII) | `stripEncryptedFields` doesn't strip a legacy plaintext `ssn` column; verify prod backfill ran | `server/services/piiVault.ts:69` | open |
| F-010 | 13 | defect | P2 | no | Presigned-upload endpoint trusts client-declared type/size; skips type check when omitted | `server/routes/documents.ts:43` | open |
| F-011 | 4/13 | defect | P2 | no | Plaid webhook compares a static shared secret, not Plaid's JWT/HMAC (fails closed in prod — OK for sim phase) | `server/routes/aus.ts:46` | open |
| F-012 | 4 | defect | P2 | no | Credit-pull responses return raw ciphertext columns (inconsistent with URLA stripping; not a plaintext leak) | `server/routes/compliance.ts:648,666` | open |
| F-013 | 11 | coverage-gap | P2 | no | `maintenanceMode.test.ts` runs in NEITHER vitest config → 0 executed despite a green-looking file | `tests/maintenanceMode.test.ts`, both vitest configs | open |
| F-015 | 8/2 | coverage-gap | P2 | yes (multi) | Leaf-tested/caller-untested: `loanDeliveryReadiness`, `loanAnalysis.finalizeIntake` (ECOA locus), `pipelineEngine.updatePipelineStage` are grep-only | those files + their callers | open |
| F-016 | UX | coverage-gap | P2 | no | Zero frontend/e2e test harness — 88 UI surfaces unverified; tooling not even a dependency | `package.json`, `tests/` | open |
| D-008 | 4 | defect | P2 | no | `creditService` credit sim uses `Math.random` — violates the deterministic-simulation ground rule | `server/services/creditService.ts:666` | open |
| ux-02 | UX | ux-refinement | P2 | no | Design-token guard blind spot: 157 `text-white`/`bg-white`/`bg-black` literals bypass the shade-only regex; guard not in CI | `scripts/design-token-guard.cjs:32`, 27 client files | open |
| ux-03 | UX | ux-refinement | P2 | no | `PageShell`/`PageHeader` at 7/99 adoption; 40 pages hand-roll `min-h-screen` → header/spacing drift | `client/src/components/PageShell.tsx` + callers | in progress (branch `claude/pageshell-convergence`: shell hardened w/ icon/eyebrow/headerLead/headerMeta slots; 10 borrower pages converged + live-verified; staff/dashboard pages remaining) |
| ux-04 | UX | ux-refinement | P2 | no | 12/14 property/street-view `<img>` lack `alt` (a11y + SEO) | `pages/property/*`, `BuyerProperties.tsx:441` | open |
| ux-05 | UX/1 | ux-refinement | P2 | yes (Reg Z) | Rate-advertising disclosure is thin; confirm §1026.24(d)(2) completeness (legal review, not asserted violation) | `pages/rates/PurchaseRates.tsx:200-203` | open |

## Refuted / downgraded (do not re-report)

| id | proposed by | verdict | reasoning (short) |
|---|---|---|---|
| N-001 | wiring audit | REFUTED | `GET /api/compliance/dashboard` is NOT under-gated — handler enforces `isInternalStaffRole` at `server/routes/underwriting.ts:1087` |
| N-002 | wiring audit | REFUTED | The dead `instant-decision`/`calculate-*`/`advance-stage` endpoints are *redundant*, not a broken workflow — decisioning runs via a server cascade on `POST /api/loan-applications` |
| N-003 | — | VERIFIED-CORRECT | QM points-and-fees + APR-APOR spreads (2024–26), SFC catalog, VA residual figures, TRID six-pieces, holiday calendar all match the 2026 QM Job Aid + SFC PDF — do not re-audit the values |

## Escalations — need founder/source confirmation before any fix (compliance-first)

| id | item | evidence |
|---|---|---|
| U-1 | AUS data-point names `UnderwritingMethodType`/`UnderwritingDecisionType`/`AutomatedUnderwritingResultType` not in any local schema (MISMO's is `AutomatedUnderwritingRecommendationDescription`) | `server/mismo.ts:698-711` |
| U-2 | `DataVersionIdentifier="3.4.0"` for the delivery leg (golden UCD uses `UCD2.0`) | `server/mismo.ts:1035` |
| U-3 | USDA token `USDARuralHousing` (base MISMO) vs `USDARuralDevelopment` (comment) | `shared/fannieMae/loanDeliveryEdits.ts:118` |
| U-4 | Exact ULAD v1.8 names for the 13 F-023 declaration indicators | ULAD mapping workbook |
| U-5 | UCD 3xxx edit IDs not in the local Critical-Edits matrix | job aids |
| U-6 | Underwriting constants (VA 26-7 residual table, 1% deferred-student-loan, 43% DTI) cited but the Selling Guide / VA Pamphlet 26-7 PDFs aren't in `docs/fannie-mae/` — add them | `underwritingNuance.ts` |

## Closed

| id | fixed in (PR) | re-verified |
|---|---|---|
| D-001 | `d421c42` (docs: kill the db:push landmine across 7 docs) | 2026-07-08 md-organization pass — grep of all 7 flagged docs shows every `db:push` mention is now a **"never `db:push`"** warning; no positive prod-`db:push` instruction remains |
| D-002 | 2026-07-08 md-organization pass (`06-auth-security-secrets.md`) | Role model rewritten from authoritative `shared/roles.ts`: 8 staff + 2 client + `cpa` partner; adds the `isStaffRole()` vs `isInternalStaffRole()` authz distinction the finding flagged |
| D-003 | `d421c42` | `10-deploy-ops.md` now reads `npm run check … (currently clean — 0 errors)`; `tsc` = 0 confirmed |
| D-004 | 2026-07-08 md-organization pass (indirect) | The three assessments already carry `TEAM_PRACTICES §2` supersession banners (immutable snapshots — not rewritten); their pointer target `CTO_ROADMAP.md` was reconciled to current reality this pass, so the banners' "trust the roadmap" guidance now resolves correctly |
| D-005 | 2026-07-08 md-organization pass | `ARMED_LAUNCH_CHARTER` status → "target met — armed launch executed" + dated-charter banner; `COMPLIANCE_COUNSEL_REVIEW` given a 2026-07-08 freshness banner |
| D-006 | 2026-07-08 md-organization pass (`README.md`) | Root README Tier map now lists `SAFE_MLO_COMPLIANCE_MAP`, `COMPLIANCE_COUNSEL_REVIEW`, `docs/nmls/`, `docs/nmls-safe/` (Tier 2) and the `ARMED_LAUNCH_CHARTER` (Tier 4) |
| D-007 | 2026-07-08 md-organization pass | `threat_model.md` deleted-`replit_integrations` ref corrected to `server/integrations/auth/`; `LOCAL_DEV.md` Node "20+" → pinned "24.x"; the table-count conflict (`02-architecture` 158 vs `03-database` 160) reconciled to the verified **168 tables / 17 schema files** |
| F-001 | 2026-07-08 md-organization pass (`08-services.md`); completed corpus-wide 2026-07-08 bloat pass | Deleted `documentEngine.ts`/`aiGateway.ts` rows removed; table now reflects `extractionService.ts` owning its own Gemini client + `taxInsightService.ts`. The bloat pass caught 4 residual dead refs the first pass missed (`01-start-here`, `05-data-flow` ×2, `06-auth-security-secrets`, `09-integrations`) — the removed "pluggable AI gateway (Gemini⇄Claude)" module and its `AI_GATEWAY_*`/`ANTHROPIC_API_KEY` env vars are gone from code; docs now cite `extractionService.ts` + `GEMINI_API_KEY`/`EXTRACTION_SIMULATE` only |
