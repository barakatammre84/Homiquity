# Non-W2 Lending — Research Briefing: What Homiquity Has Already Built

> **Point-in-time snapshot: 2026-07-17, `main` @ `98a9674`.** Written for the outside
> research team studying how to make Homiquity the best platform for non-W2 borrowers
> (self-employed, 1099/contractor, K-1 partners, rental investors, complex income). It
> inventories what already exists — engines, data models, pipeline, surfaces — so research
> targets real gaps instead of re-deriving built capability.
>
> Per KB precedence ([README](../README.md)), **code wins over this document** the moment
> they disagree; treat every claim here as "true at the pinned commit." File paths are given
> in backticks so you can open or grep them directly. The live defect register is
> [feature-review/FINDINGS.md](../feature-review/FINDINGS.md); the live work queue is
> [CTO_ROADMAP.md](../../CTO_ROADMAP.md) (note: two roadmap sections were verified stale at
> the time of writing — see §11 footnotes).
>
> **2026-07-17 update — the research came back.** It was adjudicated against §1 and
> code-corrected per the returning-research protocol; the adopted, governing plan for the
> non-W2 program is now **[NON_W2_TECH_OPTIMIZATION_PLAN.md](NON_W2_TECH_OPTIMIZATION_PLAN.md)**
> (it supersedes conflicting prior framing; this document's §1 box still binds it).
>
> **2026-08-04 supersession note — four claims below are now stale** (verified against code,
> HEAD `eb26923`; details in the
> [sovereign-stack adjudication §3.3](../logs/2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md)):
> §3's `EXTRACTION_SIMULATE` "covers all four single-doc extractors" is wrong — the flag is
> **tax-only** (`extractionDocuments.ts:116`, `extractionTaxIntel.ts:460/:520`; pay-stub /
> bank-statement / lease return low-confidence without a key); rental's "hard-coded
> `appliedToDti: false`" (§2 path table, §10 master table, §11 gap #1) is **dynamic +
> provenance-gated since #241**; S-05/S-06 "advisory only" (§4) **apply to DTI since #241**;
> S-07 "deferred" (§4, §11 gap #7) **shipped in #246** (mig 0037) with its catalog entry +
> sync tests in #315.

---

## 0. How to read this document

- §1 is the **box**: the business model and the binding engineering/compliance doctrines any
  proposal must fit inside. Research that ignores §1 will be rejected on arrival, however
  good the idea.
- §2–§8 are the **inventory**: what is built, where it lives, how it works.
- §9 is the **AI surface map** — where models run today and the hard boundary they stop at.
- §10 is the **real-vs-simulated master table** — what is genuinely wired to the outside
  world vs. deterministically simulated behind an adapter seam.
- §11 is the **code-verified gap list** and §12 the **research questions we most want
  answered**. Start there if you only read two sections.

A recurring convention you must understand up front: **every vendor call is a deterministic
simulation behind an adapter until a real contract exists.** Simulated results are flagged
(`simulated: true` / `isSimulated`), seeded (reproducible), and the adapters *throw* if a
real API key is set without a real implementation — the seams are real and single-point,
the traffic is not. §10 maps each seam to the business event that makes it real.

## 1. The box: business model and binding doctrines

**Homiquity is a wholesale mortgage BROKER, not a lender.** It originates and packages;
a wholesale lender underwrites, decides, closes, funds, and (if selling to Fannie Mae)
runs real loan delivery. Internal "decisions" are pre-qualification and package-readiness
assessments, never credit decisions. This shapes everything: the GSE delivery stack (§7)
is a *predictive mirror* of the lender's checks, and the agentic layer's doctrine is
"it never decides — the lender does."

**Licensing footprint: Illinois only.** `shared/companyIdentity.ts` — company NMLS
**#427468** (live in code since PR #154, merged 2026-07-13), `LICENSED_STATES = ["IL"]`,
with helpers `isLicensedState()` / `isZipInLicensedStates()` (IL ZIP3 600–629) and a 422
`UNLICENSED_STATE` rejection wired at intake, application draft-PATCH, property
attach/switch/edit, the MCP pricing tool, and the funnel's state step. An *absent* state
never rejects (the funnel is deliberately address-last, a TRID application-definition
consideration). The commercial surface currently ships **dark** behind two layered gates —
a server+client prelaunch gate (`PRELAUNCH_GATED` / `VITE_PRELAUNCH_GATED`, production
defaults to gated as a fail-safe; `server/services/prelaunchGate.ts`,
`client/src/lib/prelaunch.ts`) in front of which sits a private-beta Edge cookie gate
(`BETA_ACCESS_CODE`, `middleware.ts`). Un-gating is a founder-held env flip, not a code
change.

**Binding doctrines** (each is enforced in code or CI, not aspiration — proposals must
design within them):

| Doctrine | Meaning | Enforcement |
|---|---|---|
| **Deterministic decisioning, AI-isolated (ECOA / Reg B)** | Anything that affects a qualification outcome is pure, rules-based, citation-backed math. No model output feeds a decision. | `server/underwritingEngine.ts` (header contract), `server/services/selfEmploymentIncome.ts` ("no IO, no AI, no discretion"), import boundaries |
| **No citation, no implementation** | Regulated math exists only when the authoritative source (Selling Guide section, CFR cite, lender program doc) is in-repo and cited. Gated capabilities return honest `unavailable` / `requiresManualReview`, never guessed numbers. | [compliance/UNDERWRITING_SCENARIOS.md](../compliance/UNDERWRITING_SCENARIOS.md) contract; `data/regulatory/regulatory-ledger.json` same-commit rule |
| **AI stages, humans verify (MR-2)** | Extraction may set a document at most to `verifying`; only the human `POST /api/documents/:id/verify` writes `verified`/`rejected`. Extracted fields land `needs_review`, never auto-verified. | `shared/documentStatus.ts`, `server/services/verification.ts` |
| **§7216 boundary** | Consumer-direct tax uploads sidestep IRC §7216 preparer rules; derived `tax_insights` are marketing/readiness signals ONLY and are import-boundary-banned from underwriting. | `server/services/taxInsightService.ts` |
| **Reg N / Reg Z comms lint** | Two-tier lexicon — Reg Z §1026.24(d) trigger terms + Reg N §1014.3 misrepresentations ("guaranteed approval" = hard block, negation-aware), each rule carrying its eCFR citation — applied to AI coach output (streaming), outbound comms, and marketing surfaces. | `shared/compliance/loCommsLint.ts`, `server/services/coachingLint.ts` |
| **FCRA consent gating** | No credit pull without an active consent record; consent re-acknowledged per session in the funnel and written to a consent ledger. | `server/services/creditConsents.ts`, `server/services/creditPulls.ts` |
| **Reproducibility fingerprints** | Income evaluations, resolved underwriting policy, situation profiles, and lender packages carry SHA-256 fingerprints over inputs/resolved values — same inputs, same outputs, same hash. | `server/services/income/orchestrator.ts`, `server/underwritingEngine.ts`, `server/services/incomeAnalysisPackage.ts` |
| **PII discipline** | Borrower PII flows through `server/services/encryptionService.ts` (SSNs via `server/services/ssnVault.ts`) with audit-log entries; extraction reduces account numbers to last-4. | `server/auditLog.ts`, `server/extractionValidation.ts` |

## 2. The non-W2 core: the UAL income engine (P1–P7)

The "Universal Adaptation Layer" program
([specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md](../specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md))
is the complex-borrower income engine — all seven phases merged, DB migrations
`0013`–`0019` + `0023`. It is the platform's answer to "the borrower's income doesn't fit
a W-2 box," and the most research-relevant subsystem in the codebase.

### P1 — Self-employment worksheet + Form 1084 calculator
`server/services/selfEmploymentIncome.ts` — a deterministic Fannie **Form 1084 Cash-Flow
Analysis** (Selling Guide B3-3.5 / B3-3.6, every rule cited; the in-repo authority is
[docs/fannie-mae/self-employment-income-reference.md](../../docs/fannie-mae/self-employment-income-reference.md),
which reflects the 2026-03-04 income-assessment reorganization):

- **Schedule C** (sole prop / SMLLC): net profit + add-backs (depreciation, depletion,
  amortization/casualty, business-use-of-home) − subtractions (meals exclusion,
  non-recurring income).
- **K-1 partnership / S-corp** (B3-3.6-07): guaranteed payments usable directly at 2+ years
  history; ordinary + rental income usable only if documented distributions cover it OR
  business liquidity passes (quick/current ratio ≥ 1); otherwise only distributed income
  counts.
- **C-corp**: explicitly *not* self-employment income (borrower qualifies on W-2 wages +
  dividends).
- **Two-year averaging with a conservative trend guard** (B3-3.5-01): single-year history,
  any loss year, or a declining trend all force `requiresManualReview`; a declining trend
  is never averaged up (the lower recent year is used).

Pure function — no IO, no AI, no discretion (Reg B). Input worksheet type lives on
`employment_history.self_employment_income` (jsonb, migration `0013`).

### P2a — Multi-form tax-package extraction ("tax document intelligence")
`server/extractionTaxIntel.ts` (adapter) + `server/services/taxDocumentIntelligence.ts`
(orchestration/persistence). Two passes: (1) classify every IRS form instance in an
uploaded package — type / tax year / entity / page range; (2) extract one instance's
fields as `{value, confidence}` pairs. Recognized forms: 1040, Schedules 1/B/C/D/E, K-1
(1065 and 1120-S variants), 1065, 1120-S, 1120, 8825, 4562, W-2, 1099-NEC, 1099-MISC.
Runs on a real Anthropic adapter (Claude Opus 4.8 for the tax package) or a deterministic
simulation (`EXTRACTION_SIMULATE`, the "Alex Simworth" multi-entity fixture) when no API
key is present. Output is always PROVISIONAL — persisted `needs_review`, never
auto-verified (MR-2). Tables: `tax_extraction_runs` + `logical_documents` /
`extracted_fields` (migration `0014`).

### P2b — Business-entity resolution + cross-form tie-out engine
- `server/services/borrowerEntityResolution.ts` reconstructs the borrower's businesses
  from extracted forms (three Schedule Cs = three sole props; K-1 + 1065 sharing an EIN =
  one partnership; same business across years = one entity). Matches on EIN-last4 then
  normalized name; purely structural, never computes income. Table
  `borrower_business_entities` (migration `0015`).
- `server/services/taxReconciliation.ts` — the accuracy layer: the tax package must
  reconcile against *itself*. Deterministic checks over transcribed IRS carry
  relationships C1–C10 ([docs/irs-forms/README.md](../../docs/irs-forms/README.md)):
  Sch C → Sch 1, Sch E → Sch 1, Sch 1 → 1040, 1040 total-income coverage, K-1s sum →
  1065, K-1 pro-rata share, 1065 internal identity, YoY trend. Variances become review
  flags, never auto-decisions. **Not yet implemented:** tie-outs for 1120-S/K-1, 8825,
  Sch B/D, 4562 (relationships not yet transcribed — a concrete, well-scoped gap).

### P2c — Situation classifier
`server/services/situationClassifier.ts` (+ `shared/situationProfile.ts`, table
`situation_profiles`, migration `0016`) — a deterministic "what kind of borrower is this"
profile: structural FACTS only (self-employed, multi-entity, K-1 present, rental present,
business loss, YoY decline, C-corp, W-2, cap gains, open variances) plus income-path
signals graded `applicable` / `candidate` / `not_indicated` — deliberately never
"eligible." Non-QM paths cap at `candidate` until program references are in-repo. Carries
the `halalNeed` routing signal (see P7).

### P3 — Multi-path income orchestrator (the single income producer)
`server/services/income/orchestrator.ts` + `server/services/income/paths/*.ts`, path
contracts in `shared/incomePaths.ts`. Computes **every applicable income path in one
deterministic pass** and compares them, rather than failing down a single lane:

| Path | Kind | Method | Status today |
|---|---|---|---|
| `agency_wage` | component (DTI) | reconciled W-2/wage math, B3-3.1 | executable |
| `self_employment` | component (DTI) | wraps the P1 Form 1084 calculator | executable |
| `rental` | component (DTI) | B3-3.1-08 75%-of-gross-rent net of PITIA | computed but **`appliedToDti: false`** — surfaced, not applied (§11 gap #1) |
| `dscr` | alternative (coverage ratio) | Angel Oak Investor Cash Flow, Rent ÷ PITIA | ratio computed; pass/fail threshold portal-gated |
| `bank_statement` | alternative (DTI) | Angel Oak: (eligible deposits ÷ months) × (1 − expense factor) | math built; deposit-eligibility scrubbing portal-gated |

**Primary DTI income = agency wage + self-employment only.** Alternatives are compared,
never summed; `recommendedPathId` stays null until an alternative lane is both enabled
and higher. Every evaluation is appended (never mutated) to `income_path_evaluations`
with a SHA-256 inputs fingerprint (migration `0017`).

### P4 — Non-QM program references (Angel Oak)
The two alternative lanes are transcribed from real wholesale program references held
in-repo: [docs/lender-programs/angel-oak/dscr-program-reference.md](../../docs/lender-programs/angel-oak/dscr-program-reference.md)
and [bank-statement-program-reference.md](../../docs/lender-programs/angel-oak/bank-statement-program-reference.md).
Deliberately NOT implemented (no-citation-no-implementation): the DSCR qualifying-minimum
matrix by LTV/FICO tier and the bank-statement deposit-eligibility scrubbing rules — both
live in lender AE portals, not public docs, so both paths always return
`requiresManualReview`. Expense factors that ARE citable are built: default 50%,
high-expense 70%, below-50% requires a third-party CPA statement.

### P5 — Income review workbench + worksheet prefill
`server/services/income/reviewTriage.ts` + `server/services/worksheetPrefill.ts`
(tables `review_items`, `bank_statement_analyses`, migration `0018`). Exception-only
triage into `one_click` (low-confidence < 0.7 fields, DSCR/bank-statement
acknowledgments) and `flagged` (tie-out variances, 1084 `requiresManualReview`,
low-confidence fields inside a variance). Auto-accepted data never becomes a review row.
Resolutions stamp `humanVerified` on `extracted_fields` — **the extraction-accuracy
ground-truth loop** (see §12, research question set C). Worksheet smart-fill drafts a
Form 1084 worksheet per entity from extractions; the borrower confirms field-by-field
before the calculator ever sees it (drafts are never persisted).

### P6 — Income analysis package
`server/services/incomeAnalysisPackage.ts` (columns on `lender_submissions`, migration
`0019`) — the broker's *cited income narrative* sent to a wholesale lender alongside the
MISMO 3.4 XML: per-path cited math, human-confirmed worksheets, and a hash-only document
manifest (the lender never sees raw model output). Immutable snapshot + SHA-256. Non-QM
path sections are stripped for agency-only lenders (per-lender shaping via the catalog's
`nonQm` flag, §7).

### P7 — Interest-avoiding financing (Islamic finance lane)
- Intake: "I require financing that avoids interest" → `avoidsInterestFinancing` on
  `loan_applications` (migration `0023`; UI in
  `client/src/pages/lending/preApproval/questions.ts`), flowing into
  `SituationProfile.halalNeed`. **Explicitly a funder-routing signal — never an
  underwriting input, never a faith classification.** No downstream funder/product
  selection consumes it yet.
- `server/services/structureTranslation.ts` — the contract-translation engine: maps
  diminishing **Musharaka**, **Ijara** lease-to-own, and **Murabaha** cost-plus into
  conventional quantities (an equivalent note rate solved with the same cited Reg Z
  Appendix J actuarial solver used everywhere else, plus a monthly qualifying obligation
  for DTI). Pure and deterministic.
- The broker-triage firewall (Homiquity never certifies Shariah compliance — that is the
  funder's obligation) is strategy, deliberately not code:
  [research/islamic-finance/](islamic-finance/). Channel activation is business-gated
  (two founder calls into the Ijara-CDC/CMG ecosystem + a counsel review) before any
  halal marketing.

## 3. Document intelligence pipeline

| Stage | What | Where | Real / simulated |
|---|---|---|---|
| Upload / storage | Presigned-upload flow, ACL policy layer, shared 10 MB cap | `server/integrations/object_storage/` (+ `shared/uploads.ts`) | **REAL** (Google Cloud Storage; local-fs alternative) |
| Single-doc extraction | Tax return (legacy single-pass), pay stub, bank statement, lease → Claude vision → Zod-validated `{fields, confidence}` | `server/extractionDocuments.ts`, `server/extractionValidation.ts` (`server/extractionService.ts` is a re-export shim) | **REAL** Anthropic (Claude Sonnet 5); deterministic sim on `EXTRACTION_SIMULATE` |
| Multi-form tax intelligence | P2a two-pass package extraction (§2) | `server/extractionTaxIntel.ts`, `server/services/taxDocumentIntelligence.ts` | **REAL** Anthropic (Claude Opus 4.8); same sim flag |
| Output hardening | Model JSON treated as **adversarial**: numeric clamping, out-of-range values dropped, account numbers reduced to last-4, cross-field consistency caps confidence, structurally invalid payload → low-confidence empty, safety refusals → "" | `server/extractionValidation.ts` | n/a (deterministic) |
| Confidence gate | Per-doc-type review thresholds (tax return 0.85, government ID 0.90, W-2/paystub/bank 0.80, …) — below threshold ⇒ `humanReviewRequired`; accuracy-drift report | `server/services/documentConfidence.ts` | n/a |
| Verification loop | `uploaded → verifying → verified/rejected`; AI may stage at most `verifying`; only the human verify endpoint writes terminal states (MR-2). Income/assets/credit verified independently; all three ⇒ `financialDataProvenance = "verified"` — the decision-grade gate | `shared/documentStatus.ts`, `server/services/verification.ts` (review-decision column: migration `0032`) | n/a |
| Personalized checklist | Per-application `loan_conditions.requiredDocumentTypes` → borrower checklist (self-employed → P&L + business returns; LTV > 80 → gift letter; …), alias-aware, latest-upload-wins | `server/services/documentChecklist.ts` | n/a |
| Tax-insight pipeline | Borrower-visible readiness signals (W-2 wages, AGI, Sch C net, Sch E rental, `selfEmployed`, `dscrCandidate`) from the legacy single-pass extraction. **Marketing/readiness only — import-boundary-banned from underwriting** (§7216) | `server/services/taxInsightService.ts`, `shared/schema/taxInsights.ts` (migration `0010`) | n/a |

`EXTRACTION_SIMULATE` semantics (exact): it takes effect only when the Anthropic client is
null (no `AI_INTEGRATIONS_ANTHROPIC_API_KEY` / `ANTHROPIC_API_KEY`), covers all four
single-doc extractors and both tax-intel passes, and produces internally consistent seeded
fixtures with `SIMULATED_MODEL_ID = "simulated"` lineage. It does **not** bypass Zod
validation or persistence — the whole downstream path runs on simulated data, which is how
the engine is exercised end-to-end without credentials.

Note there are **two parallel tax-extraction paths** by design: the newer multi-form P2a
intelligence (→ `extracted_fields`, feeds underwriting-adjacent flows) and the legacy
single-pass path (→ `tax_insights`, marketing/readiness only), with an enforced import
boundary between them.

## 4. Decisioning

**Engine of record — `server/underwritingEngine.ts` (`ConsolidatedUnderwritingEngine`).**
Deterministic and intentionally isolated from any AI path (Reg B). Every threshold, grid
value, and residual requirement resolves at runtime from dynamic lookup matrices in
Postgres (`LookupResolverService`) — no hardcoded fallbacks — and each evaluation emits a
`ResolvedPolicy` snapshot with a SHA-256 fingerprint so decisions are reproducible even
though matrices are mutable. Typed error classification routes outcomes honestly:
`INPUT_INCOMPLETE` → collect info, `INPUT_INVALID` → bad data, `POLICY_OUT_OF_BAND` →
human review (never a doc-chase loop); a missing/expired *matrix* throws a plain system
error rather than becoming a borrower outcome.

Two product paths today:
- **Conventional:** LTV ceiling, FICO floor enforced before any matrix lookup,
  conforming-limit awareness (jumbo → review, not decline), subject-property
  reconciliation (declared type/units vs. an optional observed descriptor →
  misrepresentation flag), occupancy × units max-LTV from the Fannie Eligibility Matrix,
  DTI 43 baseline → manual review / 50 stretch → decline, PMI grid, LLPA grid.
- **VA:** regional residual-income per Pamphlet 26-7 Table 4-2, square-footage utility
  rule, family-size clamp, active-duty/retired 5% reduction, and the 20% residual cushion
  when DTI > 41%.

**Orchestration — `server/services/decisionEngine.ts`.** Aggregates borrower financials,
calls the P3 income orchestrator (`totalMonthlyIncome = primaryMonthlyQualifyingIncome`),
parses accounting-style parenthesized negatives so a K-1 loss nets against income, and
returns a specific "self-employed income review required" gap when an SE file's net
qualifying income ≤ 0. Maps engine errors to `NEEDS_MORE_INFO` / `MANUAL_REVIEW`.

**Second engine — `server/underwriting.ts`** (display/affordability): `verifyAssets`
matrix haircuts, `assessLiabilities` (10-month rule; deferred student loans at 1% of
balance), `calculateDTI`, `checkPropertyEligibility` ("can I buy this house?" — hardcodes
a 6% P&I rate and 1.25% tax assumption). Its `qualifyIncome` is a deprecated adapter over
the orchestrator. Known duplication candidate.

**DB-driven rule DSL — `server/services/ruleEngine.ts`** (`UnderwritingRuleDsl`): nested
AND/OR condition groups, 12 operators, actions (`set_qualification_status`,
`log_explanation`, `flag_for_review`, `set_field`, `add_condition`), priority-ordered
with `stopOnMatch`, every execution logged to `RuleExecutionLog`. A configurable overlay
distinct from the consolidated engine.

**Underwriting scenario catalog (S-01…S-06).** Rules live in
`server/services/preUnderwriting.ts` + `server/services/underwritingNuance.ts`;
`server/services/scenarioCatalog.ts` is a machine-readable projection; the human registry
is [compliance/UNDERWRITING_SCENARIOS.md](../compliance/UNDERWRITING_SCENARIOS.md):

| ID | Models | Guideline |
|---|---|---|
| S-01 | Hybrid W-2/SE income seasoning (<12 mo unusable; 12–24 mo needs compensating factors) | B3-3.2 |
| S-02 | Relocating veteran — VA residual income | Pamphlet 26-7 |
| S-03 | "Sleeper debt trap" — undisclosed liabilities; deferred student loan at 1% of balance | B3-6-05 |
| S-04 | "Mattress money" — large-deposit sourcing (single deposit > 50% of monthly income) | B3-4.2-02 / B3-4.3-04 |
| S-05 | Rental income (Schedule E), 75% gross rent net of PITIA | B3-3.1-08 — **advisory only** |
| S-06 | Multi-unit subject-property rental (2–4 units, owner-occupied) | B3-3.1-08 — **advisory only** |

Plus foundation flags `F-LOW-RESERVES` (< 2 months) and `F-COMPLEX-INCOME` (SE 2-year tax
docs gate). **S-07** (rental-income conversion — retaining the current primary as a
rental) is specified in the registry but deferred: it needs a new property-disposition
intake field.

**What-if simulator (LO tooling)** — `server/services/scenarioSimulator.ts` (table
`scenario_runs`, migration `0020`): deterministic composer over pricing → qualification →
APR → cash-to-close, reading the *latest persisted* income evaluation (it never re-derives
income; absent one it stops with `NEEDS_INCOME_EVALUATION`). Every run is flagged
`simulated: true` while rate data is seeded (§5).

## 5. Products & pricing

**Product types** (`shared/schema/underwritingCore.ts`, `PRODUCT_TYPES`):
`conventional_conforming, conventional_jumbo, fha, va, usda, heloc, heloan,
dscr_investor, bank_statement, asset_depletion`. Non-QM reality check:

- **DSCR** — ratio calculator built and cited (§2 P4); qualifying minimums portal-gated;
  purchase-DSCR additionally blocked because intake doesn't capture expected market rent.
- **Bank statement** — expense-factor math built and cited; deposit-eligibility scrubbing
  portal-gated; there is also no borrower-facing bank-statement capture UI yet.
- **`asset_depletion`** — enum slot only; **no calculator exists anywhere**.
- **ITIN, P&L-only, stated/no-doc** — zero hits in the repo; not modeled at all.

**Pricing that is real (deterministic, matrix-driven):** `server/pricing.ts` — Fannie
LLPA base grid resolved from Postgres, occupancy/condo adjustment tiers, a
first-time-homebuyer LLPA waiver at ≤ 100% AMI (the AMI lookup is a stub returning a
90,000 default — HUD API integration pending), and PMI from the `CONVENTIONAL_PMI` matrix
(fails loud above the 80% LTV MI trigger). `server/services/pricingAdapter.ts`
`computeOffers` layers LLPA + lock-term + lender adjustments over active rate sheets and
labels `LOWEST_RATE` / `LOWEST_PAYMENT`; `rateService.syncBestExecutionRates` publishes
the lowest executable rate to advertised-rate surfaces (Reg Z: a real vendor sheet always
beats a survey number).

**Pricing that is simulated:** the rate sheets themselves are seeded
(`server/seedMarketPricing.ts`); the PPE integration (**Lender Price + Mortech**) is a
named future contract, not code. Scenario runs carry `SIMULATED_RATE_DATA = true`
provenance end-to-end into the UI.

**Anti-steering** — `server/services/antiSteeringOptions.ts`: the Reg Z
§1026.36(e)(2)-(3) safe-harbor option set (lowest rate / lowest without risky features /
lowest points-and-fees), verified verbatim against eCFR with a regulatory-ledger entry.
Notes in code: the simulated lender catalog carries no risky-feature flags until the PPE
adapter maps them.

**QM thresholds** — `shared/fannieMae/qmThresholds.ts`: points-and-fees and APR-APOR
spread limits by note-date year (2024/2025/2026 tables, transcribed from the Fannie QM
edits job aid); an uncovered year resolves to null and forces manual review rather than
borrowing an adjacent year's numbers.

## 6. Credit, AUS, and verification vendors

**Credit (8 modules under `server/services/credit*`; no real bureau contract yet):**
- `creditPulls.ts` — `soft | hard | tri_merge` pulls, FCRA consent enforced;
  the completion path is a simulation (`isSimulated: true`, disabled in production unless
  `CREDIT_VENDOR_MODE=simulation`) that fabricates 3-bureau scores + representative
  middle score, tradelines, and "sleeper debt" (deferred student loan ~40% of files,
  recent retail line ~30%) precisely to exercise S-03. Raw responses encrypted + hashed;
  120-day expiry.
- A second, *seeded* soft-pull simulation lives behind the MCP seam
  (`server/mcp/vendors.ts` `softPullCredit`, iSoftpull / CRS One-shaped, gated on
  `CRS_API_KEY` / `ISOFTPULL_API_KEY` — throws if a key is set). Consolidation candidate.
- The full compliance envelope around credit is real: consent lifecycle
  (`creditConsents.ts`), FCRA disclosure text + ECOA/Reg B adverse-action reason catalog
  (`creditCatalogs.ts` — carries a COUNSEL TODO on administering-agency wording),
  tamper-evident hash-chain audit (`creditAuditChain.ts`, `creditAudit.ts`),
  §1002.9 adverse-action notices with an `ensureAdverseActionForDenial` chokepoint
  (`creditAdverseActions.ts` — postal-mail PDF fallback shipped separately), and
  FCRA/ECOA retention policies (`creditRetention.ts`).

**AUS — dual-leg, both simulated** (`server/services/ausSubmission.ts`,
`server/routes/aus.ts`). Real DU/LPA requires GSE technology-provider onboarding, not
just an API key — the adapters throw if a key is present.
- **DU leg** ("12.1-shaped"): `approve_eligible | approve_ineligible | refer |
  refer_with_caution`; headline gates credit < 620 → refer, DTI > 50% → refer,
  LTV > 97% → approve_ineligible; Day 1 Certainty relief per validated verification
  reports (assets/income/employment).
- **LPA leg**: `riskClass accept | caution`, deliberately divergent (DTI 45–50% draws
  Caution where DU only refers above 50%) — modeling the realistic dual-AUS spread
  lenders exploit, so the product experience of "run both, compare" is exercised.
- `POST /api/underwrite/submit-gse` (role-gated): completeness gate → both legs in
  parallel → persisted `ausFindings` → structured commitment letter (30-day expiry).

**Asset verification (Plaid) — the one real-capable vendor path.** `server/plaid.ts` is a
real Plaid SDK client (link token by product — Income / Identity Verification / Assets —
token exchange, identity data, item management) that hard-gates on
`PLAID_CLIENT_ID`/`PLAID_SECRET` with **no internal simulation**; identity-verification
routes error without keys. Asset-report parsing (`parsePlaidAssetReport` in
`ausSubmission.ts`) calls real Plaid when keys exist, else returns a deterministic seeded
simulation (including a ~35% "mattress money" large-deposit injection to exercise S-04).
The webhook (`POST /api/webhooks/plaid-assets`) is CSRF-exempt and fail-closed in
production without `PLAID_WEBHOOK_SECRET`. Production keys are pending the vendor
clearance in progress (the security governance pack in
[governance/security/](../governance/security/) was drafted for it).

**Income/employment verification (VOIE):** nothing built; Truv is the named future
vendor (roadmap F5).

**Property valuation:** `server/mcp/vendors.ts` `fetchAvm` — HouseCanary-style,
simulated, surfaced through the MCP `retrieve_property_valuation` tool which persists
`avmValue/avmConfidence/avmProvider` onto `properties`. Separately
`server/propertyAnalyzer.ts` does deterministic property *analysis* (RESO feature
detection, Mello-Roos, PMI rate card) — not valuation.

## 7. Broker → lender → delivery

**Wholesale lender catalog** (`shared/wholesaleLenders.ts`) — the "Target-5", all
currently `approvalStatus: "target"` (no signed broker agreements, so submission resolves
to a simulation):

| Lender | Specialty | Non-QM |
|---|---|---|
| United Wholesale Mortgage | Conv/FHA/VA volume, fast turns | — |
| Rocket Pro TPO | Conv/FHA/VA + tech/pricing | — |
| Plaza Home Mortgage | Broad menu incl. renovation + manufactured | — |
| **Angel Oak Mortgage Solutions** | **Non-QM: bank statement, investor DSCR** | ✓ |
| **Newrez Wholesale** | Conv/gov + **non-QM overlay** | ✓ |

Two of five are the non-W2 beachhead lenders, and the P6 income package shapes itself per
lender via the catalog's `nonQm` flag (non-QM sections stripped for agency-only lenders).
Submission status machine: `submitted → acknowledged → in_underwriting →
conditions_issued ⇄ conditions_cleared → clear_to_close → funded`
(+ `denied/withdrawn/suspended`), transitions enforced.

**Readiness gating** (`server/services/brokerSubmissionReadiness.ts`) — four pure stages:
1. Intake & disclosures — URLA gating, TRID LE clock, e-disclosure,
   change-of-circumstance redisclosure.
2. AUS — no casefile blocks; DU-only warns ("re-run for dual view"); **refer/ineligible
   warns rather than blocks** — deliberately preserving manual/non-QM placement, which is
   exactly the non-W2 lane.
3. Wholesale lender package — MISMO validity, outstanding docs, QM points-and-fees,
   anti-steering disclosure, and the **P6 income-package gate for SE / non-agency files**.
4. GSE delivery pre-flight — informational, never blocks (the broker doesn't deliver).

**Submission** (`server/services/lenderSubmission.ts`): re-checks readiness server-side,
blocks duplicate active submissions per lender, builds an immutable MISMO 3.4 package
(structural validation hard gate + a non-blocking XSD diagnostic via xmllint — known
conformance gap L6/F-025), persists everything with SHA-256 hashes, then
`submitToLenderPortal` → deterministic simulated acknowledgment. That function is
explicitly "the single seam to replace" when broker agreements are signed.

**GSE delivery stack** (a *predictive mirror* of lender-side delivery checks — built so
files arrive delivery-clean):
- `shared/mismo.ts` — MISMO 3.4 reference-model type system (ULDD Phase 5, eff.
  2025-07-28).
- `server/mismo.ts` — MISMO 3.4 XML generation (MERS MIN with Luhn check digit,
  structural validation, `validateULDDCompliance` with phase-5 readiness flags).
- `server/services/mismoValidation.ts` — URLA completeness scoring per section
  (+ co-applicant), GSE hard-gating on sections 1a/4/5, TRID business-day clock, ATR/QM
  folds; produces the 422 payload for submit-gse.
- `shared/fannieMae/specialFeatureCodes.ts` — full SFC catalog (2026-05-06 publication),
  derivation + set validation (max 10, conjunction requirements, suspended flags).
- `shared/fannieMae/loanDeliveryEdits.ts` — deterministic mirror of Loan Delivery / UCD /
  EarlyCheck edits (QM C-series, UCD Phase 3 critical fee edits, Phase 4 LPQIRP,
  EarlyCheck ULAD), each tagged by source + severity, with anything not locally evaluable
  reported honestly in `notEvaluated`.
- `shared/fannieMae/ucdFeeEnumerations.ts` — UCD fee-type enumerations by CD section
  (fatal enforcement for sections A & E).
- `server/services/loanDeliveryReadiness.ts` — the orchestrator combining all of the
  above into one `DeliveryReadinessReport`; closing-stage data the broker never holds is
  reported "not evaluated," by design.

**Adjacent:** prequal/pre-approval letters (`shared/letters.ts` shares the eligible-status
gate between server and client so they can't drift; real PDFs via pdfkit; generation
provenance-gated by `assertVerifiedForDecisioning`); rate locks are internal
record-keeping only (`active | extended | cancelled`, a 7-day expiry alert sweep on a
cron — no lender-side lock, no worst-case repricing math).

## 8. Borrower & staff surfaces for non-W2 borrowers

**Acquisition & intake:**
- `/self-employed` persona landing page (`client/src/pages/public/SelfEmployed.tsx`) —
  well-developed: an income-shape pre-screen routes business-owner/1099 shapes into
  `/apply?type=self-employed` (prefilling `employmentType`) and W-2-plus shapes into the
  standard funnel; copy targets write-off/K-1/Schedule-C pain points. Three other persona
  LPs exist (refinance, VA, first-time buyer).
- The `/apply` funnel (`client/src/funnel/preApprovalMachine.ts`) computes its route as a
  pure function of answers; `employmentType === "self_employed"` or ≥ 2 rental properties
  sets a `complexIncome` flag that injects the `incomeSources` block — the funnel's
  non-W2 branch. FCRA soft-pull consent is re-acknowledged every session and written to
  the consent ledger at submit. Veteran files inject VA residual questions (38 CFR
  36.4340(e)).
- The Accelerator education program has a dedicated **Self-Employed track**
  (`client/src/pages/education/AcceleratorProgram.tsx`). Counterpoint: the seeded
  article corpus (`server/seedData/educationContent.ts`) contains **zero dedicated
  self-employed articles** — an acquisition-content gap (§11).
- Ten client-side educational calculators (affordability, mortgage, amortization, equity,
  payoff, down payment, rent-vs-buy, rent-to-own readiness, BAH, hub) run client math
  only — deliberately not personalized quotes (pre-launch Reg Z posture). The priced
  server surface is `/api/calculators/credit-tiers` (LLPA + PMI driven).

**In-flight (borrower):**
- AI coach (§9) with a guided in-chat document flow — the next action happens inline
  (connect a bank, upload a document) rather than punting to another page; per-document
  `plaidEligible` flags.
- Document portal — hand-rolled dropzone (type validation + shared 10 MB cap,
  presigned-URL only), the personalized checklist, upload → in-review → verified/rejected
  status surface.
- Lifecycle dashboards: RenterHome (readiness score /100 from a single server-computed
  borrower graph), Dashboard (JourneyTracker), HomeownerDashboard (post-close, via the
  `graduateClosedLoan` hook).

**Staff:**
- LO Command Center (`client/src/pages/staff/LoCommandCenter.tsx`) — signals panel,
  per-application cockpit, unassigned-pipeline claim queue, commitment-letter generation.
- BorrowerFile (`client/src/pages/staff/BorrowerFile.tsx`) — the staff review surface,
  including the **document-review workbench** (`client/src/components/staff/`
  `ReviewWorkbenchPanel.tsx`, `DocumentReviewPanel.tsx`, `DocumentViewer.tsx` with a
  pdfjs viewer, `TaxIntelligencePanel.tsx`) — the human half of the MR-2 verify loop and
  the P5 income-review triage.
- PolicyOps (`client/src/pages/staff/policyOps/`) — the policy-as-data console for the
  underwriting matrices, plus PricingMatrices admin.
- StaffSignalsPanel carries the AI risk brief (§9).

**Partners:** PartnerHub (one authenticated home per partner persona; inviter-only
doctrine — progress stages, never borrower financials), CPA portal (§7216 inviter-only
lane), agent co-branding + referral spine, realtor engine tools (ScenarioDesk,
DealRescue, StrategySessions, ClosingGuarantee).

## 9. Where AI runs today — and the boundary it stops at

For an AI-research audience this is the section to internalize: **models perceive and
narrate; deterministic engines decide.** The Reg B isolation is architectural, not a
policy memo — extraction output is adversarially validated, everything a model produces
is staged for human verification, and no model output is an input to a qualification
outcome.

| AI surface | Model | What it does | Guardrails |
|---|---|---|---|
| Single-doc extraction | Claude Sonnet 5 | Pay stub / bank statement / lease / legacy tax-return field extraction | Zod validation, numeric clamping, confidence caps, last-4 reduction, stages-never-verifies |
| Tax-package intelligence | Claude Opus 4.8 | Multi-form classification + per-instance field extraction (§2 P2a) | Same hardening; always `needs_review`; tie-out engine cross-checks the package against itself |
| AI coach | Claude Sonnet 5 (SSE streaming) | Borrower guidance + guided doc flow; 6 Zod-validated tools (`record_intake`, `update_readiness`, `set_action_plan`, `set_document_checklist`, `generate_borrower_package`, `suggest_next_steps`) | Reg N/Z streaming lint with hard-block + safe message; SSN/DOB input guard runs pre-persistence on both message endpoints (stored messages redacted); tiered data-trust (doc-verified > Plaid > chat-stated); prompt bans rate figures and approval language |
| Staff risk brief | (staff-only narration) | `internal_only` narrative over deterministic outputs — "LLM narrates, never decides"; disable flag `RISK_BRIEF_DISABLED` | Echo-only: it may restate engine outputs, not add conclusions |
| Autopilot (agentic origination — ships dark) | orchestrated | On each borrower upload: PERCEIVE (extract) → RECONCILE → COGNIZE → ACT (stage docs, mint guideline-cited follow-up conditions, recompute readiness) — detached, never throws | One-row config kill switch failing CLOSED; capability gates (`decisionRelayEnabled` **off by default** — Reg N/ECOA); LO allowlist pilot scoping; MR-2 stage-never-verify; "it never decides — the lender does" |
| Model A/B harness | — | `pnpm coach:ab` (`scripts/coachModelAb.ts`) — offline coach-model comparison harness | — |
| MCP server | — | 3 lending tools over stdio: `get_best_execution_rates`, `retrieve_property_valuation`, `run_soft_credit_pull` — the agent-facing seam into pricing/AVM/credit adapters, with FCRA consent enforcement and audit-chain persistence on the credit tool | Same adapters and gates as the app |

## 10. Real vs. simulated — master table

| External hop | Seam (file) | Today | Becomes real via |
|---|---|---|---|
| Document extraction (all types) | `server/extractionDocuments.ts` / `extractionTaxIntel.ts` | **REAL** (Anthropic) when key present; deterministic sim otherwise | already real in prod |
| Object storage | `server/integrations/object_storage/` | **REAL** (GCS) | — |
| Letter PDFs | `server/services/pdfLetterGenerator.ts` | **REAL** (pdfkit) | — |
| Asset verification (Plaid VOA) | `server/plaid.ts` + `parsePlaidAssetReport` | **REAL-capable**; sim fallback without keys | F4 — production keys (vendor clearance in progress) |
| Credit (soft/hard/tri-merge) | `server/services/creditPulls.ts` + `server/mcp/vendors.ts` | SIMULATED (two parallel sims) | F3 — bureau/reseller contract (CRS One / iSoftpull named) |
| VOIE (income/employment) | — none — | absent | F5 — Truv |
| AUS DU | `ausSubmission.ts` `submitToDU` | SIMULATED (12.1-shaped) | F6 — GSE technology-provider onboarding |
| AUS LPA | `ausSubmission.ts` `submitToLPA` | SIMULATED (deliberately divergent) | F6 |
| AVM | `server/mcp/vendors.ts` `fetchAvm` | SIMULATED (HouseCanary-style) | F7 — HouseCanary |
| Rate sheets / PPE | `server/services/pricingAdapter.ts` + seeded sheets | SIMULATED (`SIMULATED_RATE_DATA=true` provenance) | F11 — Lender Price + Mortech contract |
| AMI lookup (FTHB LLPA waiver) | `server/pricing.ts` `getAreaMedianIncome` | STUB (returns 90,000 default) | HUD API integration |
| Lender portal submission | `lenderSubmission.ts` `submitToLenderPortal` | SIMULATED acknowledgment | LS-10 slice 3 — signed broker agreements ("the single seam to replace") |
| GSE loan delivery | `shared/fannieMae/*` + `loanDeliveryReadiness.ts` | REAL deterministic **mirror** — informational by design | n/a (the lender delivers, not the broker) |

Everything in the left column that is simulated is *seeded and flagged* — the product
experience, data model, and downstream flows are fully exercised end-to-end today; the
missing ingredient is contracts, not code. This is a deliberate strategy: every vendor
flip is a one-seam replacement.

## 11. Known gaps — code-verified

Grouped; each is real at the pinned commit. Roadmap/feature-review IDs given where
tracked.

**Income-engine gaps (the beachhead core):**
1. **Rental income never reaches DTI.** The rental path computes the B3-3.1-08 offset but
   hard-codes `appliedToDti: false`; S-05/S-06 raise advisory `warning` flags with the
   computed numbers, and `decisionEngine.ts` sums wage + SE only. A borrower whose
   qualification depends on rental income under-qualifies in the instant decision.
2. **Non-QM lanes are calculators-without-thresholds.** DSCR pass/fail matrices and
   bank-statement deposit-eligibility scrubbing are AE-portal-gated
   (`PROGRAM_REFERENCE_NOT_IN_REPO`) — every alternative-path result is
   `requiresManualReview`, and `recommendedPathId` is permanently null today.
3. **`asset_depletion` is an enum with no engine; ITIN / P&L-only / 1099-only programs
   are absent entirely.**
4. **DSCR purchase files can't evaluate** — intake lacks an expected-market-rent field.
5. **No borrower-facing bank-statement capture UI** feeding `bank_statement_analyses`.
6. **Tie-out coverage gaps:** 1120-S/K-1, 8825, Sch B/D, and 4562 carry relationships not
   yet transcribed, so those packages don't self-reconcile.
7. **S-07** (departing-residence rental conversion) deferred on a property-disposition
   intake field.
8. **Reference corpus gaps:** the official Form 1084 worksheet PDF and business-return
   analysis subsections are not in `docs/fannie-mae/` (Cloudflare blocks scripted fetch)
   — so the SE calculator has no official worked examples as test fixtures.

**Pipeline gaps:**
9. All external verification hops simulated pending contracts (F3 credit, F5 VOIE, F6
   AUS, F7 AVM, F11 PPE) — §10. Medical-collections DTI treatment (FHA 4000.1) must ship
   together with F3 or FHA files compute DTI wrong.
10. Real lender hand-off blocked on broker agreements (LS-10 slice 3); MISMO 3.4 export
    carries known XSD structural violations (L6 / F-025, currently a non-blocking
    diagnostic).
11. Duplication candidates: two credit simulations; two underwriting engines
    (`underwritingEngine.ts` decision-of-record vs `underwriting.ts`
    display/affordability with hardcoded 6% P&I + 1.25% tax assumptions).
12. Observed/AVM property descriptor exists in the underwriting input but no AVM value is
    wired into subject-property reconciliation; HUD AMI stub (§5).

**Experience/acquisition gaps:**
13. Funnel "finish later" is localStorage-only — multi-session non-W2 applicants lose
    state across devices (roadmap A1).
14. Zero dedicated self-employed articles in the seeded education corpus; SE acquisition
    rests on the persona LP + accelerator track alone.
15. Funnel measurement for the SE segment isn't wired (agent-sourced lead tagging G-B,
    pull-through instrumentation G-C), so beachhead conversion can't be measured
    end-to-end yet.
16. Open roadmap singles: A2 (staff lineage view of lender identity for compliance), A3
    (retire the vestigial `active_buyer` role). Rate-advertising completeness on public
    rate pages is thin pending legal review (feature-review ux-05).

**Business-gated (not engineering):**
17. Halal lane (P7): funder-agnostic math only until two founder channel calls + counsel
    review; `halalNeed` currently has no downstream consumer.
18. Go-live itself: env un-gating is founder-held; adverse-action catalog carries a
    counsel-confirmation TODO (administering agency / Reg B Appendix A address).

> Roadmap-staleness footnotes (verified against code this date): CTO_ROADMAP.md still
> lists A6/A7/A8 as open — they shipped (#211 staff review workbench, #215 docs-ready
> signal, #214 missing-docs nudge) — and still shows `nmlsId: "PENDING"` — the code
> carries NMLS #427468 since #154 (2026-07-13). Trust the code citations above.

## 12. Research questions

Grouped by theme; ordered roughly by expected leverage. Constraint reminder: any proposal
that puts a model inside a qualification decision, invents uncited program math, or
requires an unlicensed-state footprint is dead on arrival (§1).

**A. Program coverage — turn the gated calculators into decisioning engines**
1. Obtain citable non-QM qualifying matrices: DSCR minimums by LTV/FICO tier and
   bank-statement deposit-eligibility + expense-factor rules — from Angel Oak / Newrez AE
   channels or comparable investors. What is publicly documentable vs. relationship-gated?
   (This single artifact class unblocks gap #2.)
2. Which additional non-QM wholesale investors best serve SE borrowers (candidates to
   evaluate: Deephaven, Acra, A&D Mortgage, Carrington, Oaktree, others) — program
   breadth, broker-agreement prerequisites, tech interface (portal vs API), and the
   guideline deltas that would matter to our automated readiness checks?
3. Asset-depletion / asset-utilization methodology: which investor programs, what
   calculation conventions (draw-down horizon, eligible-asset haircuts), and is there a
   citable reference sufficient to build the missing calculator (gap #3)?
4. P&L-only and 1099-only program landscape: who offers them, under what seasoning and
   CPA-attestation rules, and does demand justify a sixth income path?
5. ITIN lending: demand in the IL footprint, investor availability, and licensing/compliance
   implications for a broker.

**B. Income-methodology depth**
6. Transcribe the remaining IRS carry relationships (1120-S/K-1, 8825, Sch B/D, 4562) to
   finish the tie-out engine's coverage (gap #6) — is there a public, citable source for
   each relationship?
7. Source official Form 1084 worked examples (and the missing Fannie PDFs, gap #8) as
   golden-test fixtures for `selfEmploymentIncome.ts`.
8. Rental-income DTI wiring (gap #1): what verification standard (lease vs. Form 1007 vs.
   Schedule E history) should gate auto-application of the offset, and how do wholesale
   lenders actually treat it at underwrite? Same question for S-07 departing-residence
   conversion.
9. SE-specific compensating-factor modeling for the 12–24-month seasoning band (S-01):
   what factors do investors actually accept?

**C. Extraction & AI accuracy (the data-flywheel questions)**
10. Benchmark tax-package extraction accuracy using the `humanVerified` ground-truth loop
    (P5) — the labeled data accrues automatically; design the eval, the drift monitors,
    and the retraining/prompt-iteration cadence around it.
11. Transaction-level bank-statement parsing for the deposit-scrubbing lane: build
    (extend the existing extractor) vs. vendor (e.g., specialized bank-statement analytics
    providers) — accuracy, cost, and §1 compatibility (output must remain
    stage-then-human-verify).
12. VOIE fit for SE borrowers: Truv is the named vendor — what does it actually cover for
    self-employed files (payroll-absent), and what's the fallback evidence chain?
13. Where can LLM narration expand *without* touching the Reg B boundary — e.g., richer
    staff risk-brief narration, borrower-facing explanation of deterministic outcomes,
    lender-package narratives (P6) — and what evaluation harness should score narration
    faithfulness to the deterministic record? (`pnpm coach:ab` exists as a starting
    harness.)

**D. Market & experience**
14. Competitive landscape: who currently wins SE/non-W2 origination (non-QM specialists,
    fintech brokers, bank statement direct lenders) and on what — speed, doc burden,
    pricing, education? Where does a broker with our automation actually differentiate?
15. SE acquisition content program (gap #14): what content/SEO plays convert SE borrowers,
    and what claims are safe pre-launch under the Reg N/Z lint (§1)?
16. Multi-session application UX for complex-income borrowers (gap #13): what completion
    patterns do SE applicants exhibit, and what does that imply for server-side draft
    persistence and re-engagement?
17. Measurement design for the beachhead (gap #15): the minimal event set to prove or
    kill the SE-first strategy.

## 13. Key files & reference corpus

**Start here (code):**

| Area | Files |
|---|---|
| Income paths + orchestrator | `shared/incomePaths.ts`, `server/services/income/orchestrator.ts`, `server/services/income/paths/{selfEmployment,rental,dscr,bankStatement,agencyWage}.ts` |
| Form 1084 calculator | `server/services/selfEmploymentIncome.ts` |
| Tax intelligence | `server/extractionTaxIntel.ts`, `server/services/taxDocumentIntelligence.ts`, `server/services/taxReconciliation.ts`, `server/services/borrowerEntityResolution.ts`, `server/services/situationClassifier.ts` |
| Review loop / ground truth | `server/services/income/reviewTriage.ts`, `server/services/worksheetPrefill.ts`, `server/services/verification.ts` |
| Decisioning | `server/underwritingEngine.ts`, `server/services/decisionEngine.ts`, `server/services/preUnderwriting.ts`, `server/services/underwritingNuance.ts`, `server/services/ruleEngine.ts` |
| Pricing | `server/pricing.ts`, `server/services/pricingAdapter.ts`, `server/services/antiSteeringOptions.ts`, `shared/fannieMae/qmThresholds.ts` |
| Lender delivery | `shared/wholesaleLenders.ts`, `server/services/brokerSubmissionReadiness.ts`, `server/services/lenderSubmission.ts`, `server/services/incomeAnalysisPackage.ts`, `server/mismo.ts`, `shared/fannieMae/*` |
| Vendor seams | `server/mcp/vendors.ts`, `server/plaid.ts`, `server/services/ausSubmission.ts`, `server/services/creditPulls.ts` |
| Compliance rails | `shared/companyIdentity.ts`, `shared/compliance/loCommsLint.ts`, `shared/letters.ts`, `server/services/creditAdverseActions.ts` |
| Non-W2 UX | `client/src/pages/public/SelfEmployed.tsx`, `client/src/funnel/preApprovalMachine.ts`, `client/src/components/staff/ReviewWorkbenchPanel.tsx`, `server/services/documentChecklist.ts` |

**Reference corpus in-repo:**
- [docs/fannie-mae/](../../docs/fannie-mae/) — ULDD Phase 5, QM job aids, SFC catalog,
  URLA docs, and the transcribed B3-3.5/B3-3.6 SE-income reference (Form 1084 PDF still
  missing — gap #8).
- [docs/irs-forms/](../../docs/irs-forms/) — official IRS form PDFs backing the tie-out
  carry map (1040, Schedules, 1065/1120-S + K-1s, 4562, 8825).
- [docs/lender-programs/angel-oak/](../../docs/lender-programs/angel-oak/) — the DSCR and
  bank-statement program references grounding the P4 calculators.
- [docs/nmls/](../../docs/nmls/) — NMLS Policy Guidebook (licensing source of truth).

**Program/strategy docs:**
[specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md](../specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md) ·
[compliance/UNDERWRITING_SCENARIOS.md](../compliance/UNDERWRITING_SCENARIOS.md) ·
[research/islamic-finance/](islamic-finance/) ·
[feature-review/](../feature-review/) (CHARTER / DOMAINS / FINDINGS / WORKFLOWS) ·
[CTO_ROADMAP.md](../../CTO_ROADMAP.md) (live queue; see §11 staleness footnote).
