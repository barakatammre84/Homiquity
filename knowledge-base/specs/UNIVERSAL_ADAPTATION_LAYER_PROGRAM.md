# Universal Adaptation Layer — Program Charter & Build Prompts (L3 program spec)

**Status:** executed — **P1–P7 all merged** (P1 = #103; P2–P6 = #108; P7 halal lane = #126; prod migrations `0013`–`0019` + `0023` applied). Remaining: the **P7 channel gates** — two founder calls (Ijara-CDC / CMG ecosystem) + the §5 counsel review before any halal-lane marketing; until then the lane stays funder-agnostic math only · **Owner:** Amr (founder/PM) · **Roadmap:** tracked in CTO_ROADMAP "Active program tracks"; extended the SE-income beachhead · **Last updated:** 2026-07-12

> This is a *program* spec: eight sequenced build prompts, each of which becomes its own
> one-page L3 spec (copy [`_TEMPLATE.md`](_TEMPLATE.md)) when a team member claims it. It
> executes under [L1](../L1_VISION_AND_SCOPE.md) + [L2](../L2_COMPLIANCE_AND_LOGIC.md); where
> this doc and L2 disagree, L2 wins.

## 1. Business Intent

Rocket and Better win the clean W-2 refi on speed and rate. The deals their automated engines
hard-stop on — multi-entity self-employed borrowers, complex tax returns, investor DSCR,
borrowers who require interest-free structures — take the offline world three weeks and one
option. That is the defensible space. The moat this program builds, in order of ROI:

1. **Intake any borrower, however messy.** Upload documents → the platform identifies the
   borrower's unique situation (business-entity structure, income character, product needs)
   in seconds, **very accurately** — accuracy is the product.
2. **Qualify down every viable path simultaneously** — agency, self-employed (Fannie 1084),
   rental, DSCR, bank-statement — and surface the best one, instead of failing on the first.
3. **Package and route to the right funder for any contract type** — conventional, non-QM,
   halal — *as a broker*. Homiquity identifies, translates, packages, and routes; the funder
   owns the legal structure.

**The accuracy doctrine (binds every prompt below):** AI may *read* documents; only
deterministic, cited math may *qualify*; every machine-read value is human-confirmed before it
touches a lender package; deterministic cross-form tie-outs are the accuracy multiplier on top
of extraction. We measure accuracy against human-confirmed truth — we do not assert it.

**The broker-triage firewall (binds every prompt below):** Homiquity never holds title or
SPVs, never generates legal instruments, never takes fund capital, never issues its own
Shariah certification. Established in the Islamic-finance UAL research —
`knowledge-base/research/islamic-finance/` on branch
`claude/islamic-finance-standardization-35d7c0` (**unpushed**; merge it alongside this doc so
the links resolve). See §4 for what that firewall cuts.

## 2. Serves L1 loop

- **Core-loop link:** borrower → pre-approval → MISMO package → wholesale delivery, at every
  link: P2 (intake/identification) widens who can enter the loop; P3–P5 (income engine +
  accuracy loop) make pre-approval correct for the borrowers competitors bounce; P6 (income
  package) strengthens wholesale delivery; P7 (halal lane) adds a funder route no competing
  broker offers.
- **Cut-line check:** this *is* the loop, extended to the borrowers with the least competition
  and the highest broker-comp deals. The SE-income beachhead (Workstreams A–C) is Phase 0 of
  this program, not a competing effort. The launch sprint remains the standing priority; no
  prompt below preempts a launch blocker.

## 3. Bound by L2 (the guardrails every prompt obeys)

| L2 invariant | How this program satisfies it |
|---|---|
| **I1 — AI never decides** | Extraction (P2) is AI-assisted and stays *provisional*; qualification math (P3, P7) is deterministic, matrix-driven, fingerprinted. Confirmation into underwriting inputs is human-gated (P5). No model retraining inside underwriting — workbench resolutions are labeled data for accuracy metrics and extraction-prompt iteration only. |
| **I2 — No citation, no regulated-math change** | Every new threshold/factor carries a `data/regulatory/regulatory-ledger.json` citation in the same commit. New authority docs: `docs/irs-forms/` (form/line maps, P2b) and `docs/lender-programs/` (non-QM program matrices, P4). Paths without an in-repo authority are hard-blocked — they return "unavailable", never a number. |
| **I3 — GSE delivery standards-valid** | No MISMO name/enum invented anywhere; the halal lane delivers via `MortgageType="Other"` only if verified in `docs/fannie-mae/` — otherwise escalate (L2 §3). |
| **I4 — PII through the vault** | New columns capturing EINs or account data use the vault trio (`*_encrypted/_iv/_key_id` + last4) via `server/services/encryptionService.ts`; every PII mutation writes an audit entry. |
| **I9 — NMLS gates solicitation** | All new borrower-facing surfaces (halal intake question, situation results) sit behind the existing pre-license gate; faith-adjacent marketing copy additionally requires the P7 counsel/ECOA review before publication. |
| **I10 — Simulations never ground a real decision** | Lender submissions to not-yet-contracted funders keep the `simulated` flag discipline; income packages state it honestly (P6). |

- **Security-review trigger?** Yes — P2 touches uploads/extraction and adds PII-adjacent
  columns; P5/P6 touch borrower-data role gates. Each such PR runs `/security-review` before
  merge (L2 §4); unresolved CRITICALs block.
- **Regulated math?** Yes — P3, P4, P7 all introduce regulated calculations; each lands with
  its ledger citation in the same commit (I2).

## 4. What this program is NOT (the cut list)

An earlier draft of this vision (external AI strategy session, 2026-07-10) proposed pieces
that are deliberately **cut**. Record them here so nobody rebuilds them by accident; each
lists the gate that would reopen it:

| Cut | Why | Reopens only if |
|---|---|---|
| Homiquity-held SPVs / co-ownership entities / "contract graph" of structures we own | Broker-triage firewall — holding the structure makes us the lender/landlord, triggering licensing, capital, and the legal-characterization trap | Counsel + deliberate business pivot away from brokerage |
| Auto-generated legal closing packages ("document bus": security instruments, riders, LLC operating agreements) | Unauthorized-practice-of-law exposure; the funder and title own closing docs | Counsel-approved template program with a supervising attorney |
| Capital order book taking fund contributions / RFQ marketplace for investor capital | Taking capital = lender/dealer activity, not brokerage | Licensing + counsel; not on any current horizon |
| Neo4j / graph database | Unneeded — relational tables + immutable snapshots + in-memory `server/services/borrowerGraph.ts` cover the actual query shapes | A demonstrated query the relational model cannot serve |
| Weekly model retraining inside underwriting | Violates I1 as written | A version change to `AI_GOVERNANCE_POLICY.md`, not a code workaround |
| Shariah income-purification math | The funder's Shariah board's lane (see `SHARIAH_GOVERNANCE.md` in the islamic-finance research); our lane is marketing integrity only | The funder contractually delegates it — unlikely |

## 5. The build prompts

### P0 — Program framing (directive to: everyone)

We are not building a UI for halal loans or a DSCR calculator. We are building a
**broker-side adaptation layer**: one intake that reads any borrower's documents accurately,
one deterministic engine that qualifies them down every path at once, one packaging seam that
makes any contract type look clean to its funder. Every architecture decision returns to the
single optimization: *given this borrower's fully-resolved situation and our funder catalog,
which product-funder pairing maximizes qualifying power, minimizes cost, satisfies the
borrower's constraints (including interest prohibition), and produces a package the funder
accepts first-pass?* The competing broker takes three weeks and presents one option.

### P1 — Phase 0: land the foundation (directive to: engineering)

Nothing below starts until this lands:

1. Merge branch `worktree-se-income-references` (**unpushed**): the Fannie-1084 calculator
   (`server/services/selfEmploymentIncome.ts`), `SelfEmploymentWorksheet` schema (jsonb on
   `employment_history`, migration `0013`), the URLA worksheet UI, and the
   `docs/fannie-mae/self-employment-income-reference.md` citation pattern every later path
   copies. Before merging, check the live worktrees for migration-number collisions
   (`0013` is free on `main`, which tops out at `0012`).
2. Finish the beachhead's remaining workstreams per the plan of record: **A** — wire the
   orphaned decision engine into the application flow; **C** — AUS-as-gate + XSD validation.
3. House rules apply throughout the program: hand-authored migration SQL, never `db:push`
   from a worktree, PRs only, security-review triggers per L2 §4.

### P2 — Complex Tax Return Intelligence: the Situation Identification Engine (directive to: engineering — **THE ROI PRIORITY**)

The industry re-keys 100-page returns by hand. We will ingest the upload, reconstruct the
borrower's full business structure, verify it against itself, and tell the LO what walked in
the door — in seconds, with measured accuracy. Three layers, built in order, all extending
`server/extractionService.ts` (keep the Gemini + lineage discipline — encrypted raw response,
`modelId`/`promptVersion`/SHA-256; a vendor swap stays behind the adapter seam per I10):

**P2a — Multi-form classification + per-form extraction.**
- Classify every page of an upload: 1040 + Schedules 1/B/C/D/E, 1065, 1120-S, K-1s
  (1065 and 1120-S variants), 8825, 4562. Multi-year and multi-document aware.
- Per-form Zod extraction schemas including the Fannie-1084 add-back fields the worksheet
  needs (depreciation, depletion, amortization/casualty, business-use-of-home, meals).
  Every field nullable + per-field confidence. Bump `promptVersion`.
- A missing value is a missing value — never defaulted silently.

**P2b — Entity resolution + cross-form reconciliation (the deterministic accuracy layer).**
- New tables (hand-authored migration): `borrower_business_entities` (applicationId,
  entityType `sole_prop | single_member_llc | partnership | s_corporation | c_corporation`,
  name, ownership percent, source document ids; any captured EIN goes through the PII vault
  as ciphertext + last4 per I4) plus entity↔form links. Three Schedule Cs = three sole props;
  a 1065 with two K-1s = one partnership, two partners with percentages.
- Deterministic tie-out engine `server/services/taxReconciliation.ts`: K-1 totals tie to the
  parent 1065/1120-S; Schedule C nets tie to Schedule 1; Schedule E ties to 8825;
  year-over-year continuity checks. Variances become flagged review items (P5) — never
  silent, never auto-corrected.
- **Authority first:** every tie-out cites an in-repo reference. Create `docs/irs-forms/`
  (README + per-form line maps) mirroring the `docs/fannie-mae/` pattern. No line number from
  memory — no citation, no check (I2).

**P2c — Situation classifier.**
- Deterministic rules over the resolved entity set + intake answers → a persisted
  `SituationProfile`: multi-entity self-employed, rental portfolio (DSCR candidate),
  declining income, K-1 distributions-vs-liquidity question, C-corp owner paid by W-2,
  halal-need (from the P7 intake question), and so on.
- Each profile carries: applicable income paths, product-lane recommendations, and a
  generated document checklist ("need 2023 1120-S", "8825 missing for Property B").
- Surfaces to the LO seconds after upload.
- **Success metrics:** field-level extraction accuracy vs. human-confirmed values (P5's
  workbench produces the labeled truth), tie-out pass rate, upload→SituationProfile latency.

### P3 — Multi-path income orchestrator (directive to: engineering)

Compute every applicable income path in one deterministic pass; rank; recommend; persist.

- New `server/services/income/` family:
  - `paths/agencyWage.ts` — reconcile the two existing single-path implementations
    (`qualifyIncome`, `server/underwriting.ts:104`; the income block of
    `aggregateBorrowerFinancials`, `server/services/decisionEngine.ts:137`) into **one**
    implementation (keep the decisionEngine semantics; cite Selling Guide B3-3.1).
  - `paths/selfEmployment.ts` — thin re-export of `computeSelfEmploymentQualifyingIncome`
    (never fork it).
  - `paths/rental.ts` — wraps `calculateRentalIncomeOffsets`
    (`server/services/underwritingNuance.ts`, already cited B3-3.1-08).
  - `paths/dscr.ts`, `paths/bankStatement.ts` — citation-gated per P4.
  - `orchestrator.ts` — pure core `computeIncomePaths(input)` (no IO, deterministic,
    unit-tested like the underwriting engine) + an IO loader per application.
- **Heterogeneous path envelope:** each result declares
  `kind: "dti_income" | "coverage_ratio"`. DSCR is property qualification — it never competes
  with a borrower-income number; it ranks separately as a program alternative.
- **Persistence:** append-only `income_path_evaluations` table modeled on
  `shared/schema/decisions.ts` — trigger, Zod-typed `paths` jsonb, recommended/selected path,
  `inputsFingerprint` + `evaluationFingerprint` (reuse the SHA-256 `buildResolvedPolicy`
  pattern from `server/underwritingEngine.ts`). LO path selection = a *new* row
  (immutability preserved) followed by `recalculateDecision`. One additive nullable column
  `decision_snapshots.income_path_evaluation_id` records which path-set fed each decision.
- **Cutover discipline:** rewire `aggregateBorrowerFinancials` and convert `qualifyIncome`
  into a deprecated adapter **in the same PR**, guarded by a parity vitest (orchestrator
  agency path === legacy aggregation on fixtures). The decision engine's income figure has
  exactly one producer at every commit.

### P4 — Non-QM program authority: DSCR + bank statement (directive to: engineering + founder)

DSCR and bank-statement math have no agency citation — they are lender-program-specific
(Angel Oak is the non-QM shop in our Target-5 catalog). Mirror the `docs/fannie-mae/`
pattern:

- New `docs/lender-programs/angel-oak/`: README (inventory, hierarchy, "never invent
  thresholds") + program references transcribing the real matrices — minimum DSCR, expense
  factors and vacancy treatment, bank-statement expense-factor method, 12- vs 24-month
  options. (Founder action: obtain the current program guides/matrices from the Angel Oak AE.)
- **Until the docs are in-repo, the paths are hard-blocked:** each path module carries a
  static `enabled: false` and returns a typed `PathUnavailableResult`
  (`"PROGRAM_REFERENCE_NOT_IN_REPO"`) — visible to the LO ("bank-statement path exists at
  Angel Oak; program reference pending"), but **no computed figure, ever**. No env flags — a
  wrong non-QM number behind a flag leaks into a lender package.
- A vitest asserts via `fs` that every `enabled: true` path's citation files exist — the
  mechanical form of "no citation, no implementation." The `enabled` flip lands in the same
  PR as the reference doc. Input *capture* (rent schedules, bank-statement uploads) is never
  gated; only the qualification math is.

### P5 — Smart-fill + the exception-only workbench (directive to: engineering + UX)

The underwriter's job becomes validating the few things the machine is uncertain about —
never re-keying, never waiting.

**Smart-fill (tax extraction → SE worksheet):**
- Draft source is the validated *document extraction* — **not** `tax_insights`, which stays
  "marketing/readiness signals only." Add an import-boundary test: no underwriting-side
  module imports `taxInsightService`.
- New `server/services/worksheetPrefill.ts` + a prefill endpoint returning proposed values
  with per-field provenance (documentId, taxYear, confidence). Drafts are **never
  persisted**; the existing Zod-validated worksheet endpoint remains the only write path.
  Confirm sets `confirmedByBorrowerAt` + `sourceTaxInsightId`, then triggers
  `recalculateDecision` and a fresh income-path evaluation. The boundary is structural: the
  1084 calculator only reads persisted, confirmed jsonb.
- Consent-gated via `server/consentGate.ts` — consumer-direct documents only (preserves the
  IRC §7216 posture); never accept CPA-partner-sourced documents into this flow.

**Workbench (staff surface):**
- "Income Review" tab in the staff `BorrowerFile` page; the LO Command Center's file-health
  light gains "N income items need review" via `server/pipelineEngine.ts` reasons.
- Deterministic tiering in `server/services/income/reviewTriage.ts`:
  **auto-accepted** (high confidence, cross-source match, no `requiresManualReview`) —
  collapsed, green; **one-click confirm** (medium confidence, prefilled-unconfirmed, clean
  new path) — single yes/no; **flagged** (low confidence, tie-out variance from P2b,
  `requiresManualReview`, cross-path divergence, declining trend/loss) — expanded with the
  exact source snippet and a specific multiple-choice question, never a free-text box.
- Tolerances come from `lookupResolver` policy scalars (e.g.
  `REVIEW_INCOME_MISMATCH_TOLERANCE_PCT`) — no invented hardcoded thresholds (I2).
- New `review_items` table (tier, status, actor, resolvedAt) + audit entries; confirmations
  trigger `recalculateDecision`. Resolutions are logged as structured labeled data — the
  accuracy metric source and extraction-prompt iteration input. **No model retraining inside
  underwriting** (I1).
- **Success metric:** average underwriter touch-time under 5 minutes on complex
  self-employed files.

### P6 — The income analysis package on lender submissions (directive to: engineering)

The broker version of a "normalized asset tape": one canonical, cited income narrative any
wholesale lender can consume without understanding how we got there.

- Three additive columns on `lender_submissions` mirroring the existing MISMO trio:
  `income_package_json`, `income_package_hash`, `income_package_generated_at`.
- `buildIncomeAnalysisPackage(applicationId)` in `server/services/lenderSubmission.ts`,
  built alongside the MISMO package: per-path math trace + full citations (repo doc +
  section, or lender program doc + version/date), recommended + selected path with the LO
  selection audit, the confirmed worksheet + confirmation provenance, the SituationProfile
  summary, a document manifest (SHA-256 + extraction lineage, labeled "machine-read,
  human-confirmed"), evaluation/policy fingerprints, and honest `simulated`/target labeling
  for funders not yet under contract (I10).
- **Gate:** in `brokerSubmissionReadiness.ts` stage 3, files with SE employment or a
  non-agency selected path block on (a) a current income-path evaluation and (b) zero open
  *flagged* review items. `loanDeliveryReadiness.ts` (the GSE gate) is untouched.
- Per-lender shaping: Angel Oak packages include the non-QM sections; agency lenders get the
  agency section.

### P7 — The halal lane: UAL productization, broker-safe (directive to: founder + engineering)

**Business gates first — these are the program's critical path, owner: founder, schedule now:**
1. Call a CMG (or alternative) wholesale AE: is there a TPO path for an Ijara-paired product?
2. Call Ijara-CDC partnerships: does a broker program exist (their public program is
   realtor-only)?
3. Counsel: ratify the §5 legal-determination register in the UAL research doc; ECOA/
   fair-lending review of any faith-adjacent marketing before publication (I9).

Until a "yes," build only what is funder-agnostic — all of which pays off for DSCR and
complex-SE regardless:

- **Intake branching:** "Do you require financing that avoids interest?" →
  `SituationProfile.halalNeed` (a routing signal). Wording follows the marketing-integrity
  rules in the islamic-finance research: name the *funder's* certification; never claim
  Homiquity's own.
- **Translation calculators** (already designed in the UAL research, in-lane):
  `rentalYieldToEquivalentRate()` / `structureToPaymentStream()` beside
  `server/services/apr.ts` — pure, cited functions mapping Ijara/Murabaha/Musharaka payment
  streams into an effective-rate + payment vector that feeds the existing
  `buildMortgagePaymentStream` / `calculateMortgageAPR` and the P3 path envelope
  (`kind: "dti_income"` with the translated obligation). Extend the compliance-invariants
  grep guard as the research doc requires.
- **Catalog extensibility:** a halal funder slots into `shared/wholesaleLenders.ts` + the
  submission status machine like any wholesaler. MISMO delivery uses `MortgageType="Other"`
  only if verified against `docs/fannie-mae/` — never an invented enum (I3).

**The extensibility contract ("and anything else"):** adding a future product lane =
one program-reference doc in `docs/lender-programs/<funder>/` + one path module implementing
the P3 envelope + one catalog entry + package shaping in P6. No schema rewrite per product.

## 6. Sequencing & dependencies

```
P1 (foundation) ──► P2a ─► P2b ─► P2c ──► P3 ──► P5 ──► P6
                     │
P4 (program docs) ───┴─── parallel, any time after P3's stubs exist
P7 business gates ─────── parallel, start immediately (founder)
P7 build items ────────── funder-agnostic parts after P2c/P3; full unlock on a founder-call "yes"
```

The launch sprint remains the standing priority; program work claims only the capacity the
sprint doesn't need.

## 7. Program risks

1. **Extraction accuracy oversold.** Mitigation: the tie-out engine (P2b) + the
   human-confirm boundary (P5) + accuracy measured against confirmed truth, not asserted.
2. **Income divergence during cutover.** Mitigation: single-PR cutover of both legacy
   consumers + the parity vitest; one income producer at every commit.
3. **Non-QM/halal math without authority.** Mitigation: hard-block + fs citation tests +
   version-stamped citations in every package section.
4. **The halal channel doesn't exist.** The two founder calls are the stated critical path;
   every funder-agnostic build item was chosen to be valuable for DSCR/complex-SE even if
   the halal answer is "no."
