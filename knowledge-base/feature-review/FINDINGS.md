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

> Status pass 2026-07-12 (docs-hygiene session): nine findings verified fixed in code and
> moved to **Closed** below (F-002/003/004/005/007/018/019/025, ux-03); every remaining row
> below was re-confirmed still-open against `main` @ `e3604d8`.

| id | domain | type | sev | compliance | summary | evidence | status |
|---|---|---|---|---|---|---|---|
| F-020 | 8 | defect | P1 | yes (MISMO) | Invalid `LiabilityType` enums (`Mortgage`→`MortgageLoan`, `Other`→`OtherLiability`; child-support/alimony aren't `LiabilityType`) | `server/mismo.ts:208-216` (re-verified 2026-07-12) | open |
| F-021 | 8 | defect | P1 | yes (MISMO) | `MortgageType` `USDA`→`USDARuralHousing` (see U-3) | `server/mismo.ts:148` (re-verified 2026-07-12) | open |
| F-022 | 8 | defect | P1 | yes (MISMO) | `AssetType` `Other`→`OtherLiquidAssets`/`OtherNonLiquidAssets` | `server/mismo.ts:196,198` | open |
| F-023 | 8 | defect | P1 | yes (ULAD) | URLA §5 declaration data-point names drift (13 of 19) vs ULAD Map v1.8 (see U-4) | `server/mismo.ts:335-366` | open |
| F-024 | 6/8 | defect | P1 | yes (TRID) | CD "3 business days before consummation" uses the general (Sat-excluded) def; §1026.19(f)(1)(ii) uses the precise def (Sat counts) | `server/services/mismoValidation.ts:667` | open |
| F-014 | 5 | coverage-gap | P1 | yes (multi) | `complianceInvariants.test.ts` is 100% source-grep — passes on wrong logic, breaks on renames (false confidence) | `tests/complianceInvariants.test.ts` | open |
| F-008 | 9 | defect | P1* | yes (TCPA) | SMS webhook has no signature verification → forged START re-subscribes an opted-out number; *blocker only if SMS live at launch* | `server/routes/webhooks.ts:21` | open |
| ux-01 | UX | ux-refinement | P1 | no | Data pages without query-*error* handling render a misleading "empty" screen on server failure (was 41/68 at audit) | `lending/ApplicationSummary.tsx:49`, `borrower/Documents.tsx:163` | open — partially addressed (QueryBoundary error+retry rollout #93/#95 batch 1; PageShell restructure #131); residual count unmeasured, re-count on next UX run |
| F-026 | 6 | defect | P2 | yes (Reg Z) | APR solver omits Appendix J odd-first-period handling (fine for estimates, not a final TILA APR) | `server/services/apr.ts:57-94` | open |
| F-006 | 13 | defect | P2 | yes (audit) | SSN/account-number *writes* aren't audited (reveal is) — violates "every PII mutation gets an audit entry" | `server/routes/borrower.ts:419`, `server/storage.ts:1461,1600+` | open |
| F-009 | 13 | defect | P2 | yes (PII) | `stripEncryptedFields` doesn't strip a legacy plaintext `ssn` column; verify prod backfill ran | `server/services/piiVault.ts:69` | open |
| F-010 | 13 | defect | P2 | no | Presigned-upload endpoint trusts client-declared type/size; skips type check when omitted | `server/routes/documents.ts:43` | open |
| F-011 | 4/13 | defect | P2 | no | Plaid webhook compares a static shared secret, not Plaid's JWT/HMAC (fails closed in prod — OK for sim phase) | `server/routes/aus.ts:46` | open |
| F-012 | 4 | defect | P2 | no | Credit-pull responses return raw ciphertext columns (inconsistent with URLA stripping; not a plaintext leak) | `server/routes/compliance.ts:648,666` | open |
| F-013 | 11 | coverage-gap | P2 | no | `maintenanceMode.test.ts` runs in NEITHER vitest config → 0 executed despite a green-looking file | `tests/maintenanceMode.test.ts`, both vitest configs (re-verified 2026-07-12) | open |
| F-015 | 8/2 | coverage-gap | P2 | yes (multi) | Leaf-tested/caller-untested: `loanDeliveryReadiness`, `loanAnalysis.finalizeIntake` (ECOA locus), `pipelineEngine.updatePipelineStage` are grep-only | those files + their callers (`determineDocumentRequirements` got a unit file; the rest unchanged) | open |
| F-016 | UX | coverage-gap | P2 | no | Zero frontend/e2e test harness — 88 UI surfaces unverified; tooling not even a dependency | `package.json`, `tests/` | open |
| D-008 | 4 | defect | P2 | no | `creditService` credit sim uses `Math.random` — violates the deterministic-simulation ground rule | `server/services/creditService.ts:666` | open |
| ux-02 | UX | ux-refinement | P2 | no | Design-token guard: the white/black-literal blind spot is FIXED — `whiteBlackLiterals` is now a ratcheted guard metric (#112; baseline 97). Remaining leg: the guard runs in `npm run checkup` only, not CI (CI itself = roadmap #5) | `scripts/design-token-guard.cjs`, `scripts/design-token-baseline.json` | open — narrowed 2026-07-12 |
| ux-04 | UX | ux-refinement | P2 | no | 12/14 property/street-view `<img>` lack `alt` (a11y + SEO) | `pages/property/*`, `BuyerProperties.tsx:441` | open |
| ux-05 | UX/1 | ux-refinement | P2 | yes (Reg Z) | Rate-advertising disclosure is thin; confirm §1026.24(d)(2) completeness (legal review, not asserted violation) | `pages/rates/PurchaseRates.tsx:200-203` | open |

## Refuted / downgraded (do not re-report)

| id | proposed by | verdict | reasoning (short) |
|---|---|---|---|
| N-001 | wiring audit | REFUTED | `GET /api/compliance/dashboard` is NOT under-gated — handler enforces `isInternalStaffRole` at `server/routes/underwriting.ts:1087` |
| N-002 | wiring audit | REFUTED | The dead `instant-decision`/`calculate-*`/`advance-stage` endpoints are *redundant*, not a broken workflow — decisioning runs via a server cascade on `POST /api/loan-applications` |
| N-003 | — | VERIFIED-CORRECT | QM points-and-fees + APR-APOR spreads (2024–26), SFC catalog, VA residual figures, TRID six-pieces, holiday calendar all match the 2026 QM Job Aid + SFC PDF — do not re-audit the values |
| — | UX review (2026-08-05) | REFUTED | `FAQ.tsx` is NOT a conversion dead-end — `PublicLayout` wraps every public route (incl. `/faq`) in `Navigation`, which renders a persistent "Get Pre-Approved" → `/apply` CTA gated by the same `PRELAUNCH_GATED` flag as sibling pages' inline CTAs; FAQ tracks its siblings exactly regardless of gate state |
| public-funnel-04 (partial) | Domain 1 review (2026-08-05) | REFUTED | The `ApprovalStrength.tsx` missing-`SEOHead`/sitemap-entry half of this finding is false-premise: the route is deliberately `<Gated>` per `ARMED_LAUNCH_CHARTER_2026-07-07.md` §2 (approval-language surfaces barred pre-F1-license), consistent with the same documented exclusion policy that already covers `/rates/*` and `/apply` — not an oversight |

## Escalations — need founder/source confirmation before any fix (compliance-first)

| id | item | evidence |
|---|---|---|
| U-1 | AUS data-point names `UnderwritingMethodType`/`UnderwritingDecisionType`/`AutomatedUnderwritingResultType` not in any local schema (MISMO's is `AutomatedUnderwritingRecommendationDescription`) | `server/mismo.ts:698-711` |
| U-2 | `DataVersionIdentifier="3.4.0"` for the delivery leg (golden UCD uses `UCD2.0`) | `server/mismo.ts:1035` |
| U-3 | USDA token `USDARuralHousing` (base MISMO) vs `USDARuralDevelopment` (comment) | `shared/fannieMae/loanDeliveryEdits.ts:118` |
| U-4 | Exact ULAD v1.8 names for the 13 F-023 declaration indicators | ULAD mapping workbook |
| U-5 | UCD 3xxx edit IDs not in the local Critical-Edits matrix | job aids |
| U-6 | Underwriting constants (VA 26-7 residual table, 1% deferred-student-loan, 43% DTI) cited but the Selling Guide / VA Pamphlet 26-7 PDFs aren't in `docs/fannie-mae/` — add them | `underwritingNuance.ts` |
| U-7 | Base ULDD XSD has no `Construction` LoanPurposeType value — the generator now fails loud on construction loans until the correct mapping is source-confirmed (added with the F-019 fix) | `server/mismo.ts` `mapLoanPurpose` |

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
| F-018 (was P0) | `723cc7d` + follow-through `68467de` | 2026-07-12 hygiene pass — `LOAN_DETAIL`/`LOAN_IDENTIFIERS` violations no longer in the XSD baseline (`tests/mismoXsdValidation.test.ts` records the fix and the newly unmasked UNDERWRITING names → escalation U-1); residual conformance = roadmap **L6-fix** |
| F-019 (was P0) | `21c4a4b` (ledger `uldd-loanpurposetype-enum`) | 2026-07-12 — `mapLoanPurpose` emits only valid ULDD enums; cash-out variants → `Refinance` (the `RefinanceCashOutDeterminationType` container is a tracked follow-up under L6-fix); construction fails loud (escalation U-7) |
| F-002 | [#136](https://github.com/barakatammre84/MortgageStream/pull/136) | 2026-07-12 — `outcomeTracker` writers now called from `pipelineEngine`, `lending`, `underwriting`, `data-intelligence`, `loanAnalysis` |
| F-003 | [#135](https://github.com/barakatammre84/MortgageStream/pull/135) | 2026-07-12 — `SubmissionReadinessDialog.tsx` → `POST /api/underwrite/submit-gse` (Run-DU/LPA); verified live in the beta walkthrough (`BETA_GO_LIVE_READINESS.md` §1) |
| F-004 | pre-existing `ensureAdverseActionForDenial` chokepoint + [#123](https://github.com/barakatammre84/MortgageStream/pull/123) delivery card; close recorded by the #135–#139 walkthrough | 2026-07-12 — a denial is **blocked** unless a compliant notice generates (`server/routes/lending.ts` deny seam + underwriting advance-stage path); staff BorrowerFile card delivers/mails the PDF; 30-day watchdog de-dups |
| F-005 | `d5b8b54` | Injectable generation clock — `CreatedDatetime` no longer stamps wall-clock ms into hashed XML; lenderSubmission determinism flake gone |
| F-007 | [#136](https://github.com/barakatammre84/MortgageStream/pull/136) | 2026-07-12 — `server/routes/admin.ts:50` projects `passwordHash` out of `/api/admin/users` |
| F-025 | L6 harness (2026-07-06) + [#135](https://github.com/barakatammre84/MortgageStream/pull/135) | The asked-for XSD gate exists: `tests/mismoXsdValidation.test.ts` known-violations baseline + non-blocking XSD-conformance **recording** at lender submission; remediating the remaining baseline = roadmap **L6-fix** |
| ux-03 | [#131](https://github.com/barakatammre84/MortgageStream/pull/131) | 2026-07-11 — 32 pages converged on `PageShell`; deliberate exceptions documented in `app-guide/07-frontend.md` (hero dashboards, Messages chat, PreApproval funnel, marketing heroes, LO-1 three-pane cockpit) |
| ux-06 | `ba7706a` | 2026-08-05 — 9 calculator pages + `Resources.tsx` + shared `ConversionCTA` now check `PRELAUNCH_GATED` and swap to an honest "Join the Waitlist" → `/` action instead of bouncing through `/apply`/`/refinance`/`/rates`, matching the `Glossary`/`ArticleDetail`/`DownPaymentWizard`/`CalculatorsHub` pattern; `tsc`, `design-token-guard` green. `RentToOwnReadiness.tsx` intentionally untouched — its route is already `<Gated>` in `App.tsx`, unreachable while gated |
| public-funnel-01 | `cef2890` | 2026-08-05 — all 8 ungated calculator sub-routes added to `SITEMAP_STATIC_PATHS` + `STATIC_ROUTE_META` in `shared/seo/routeMeta.ts`, mirroring each page's actual `<SEOHead>` copy; `/calculators/rent-to-own` correctly stays excluded (still `<Gated>`) |
| public-funnel-02 | `cef2890` | 2026-08-05 — `MortgageCalculator.tsx` and `RentVsBuyCalculator.tsx` now render `<SEOHead>` with calculator-specific title/description, matching the other 6 calculators |
