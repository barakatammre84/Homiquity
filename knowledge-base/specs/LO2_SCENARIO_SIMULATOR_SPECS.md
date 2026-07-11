# LO-2 — Deterministic What-If Scenario Simulator — Spec (L3)

**Status:** claimed/in build · **Owner:** Amr (founder/PM) · **Roadmap:** [LO Advisor Program](LO_ADVISOR_PROGRAM.md) prompt LO-2 (extends LO Command Center line) · **Last updated:** 2026-07-11

## 1. Business Intent

When a borrower asks "what if I put 5% more down?" on a live call, the LO must answer in
seconds — qualified or not, payment, cash-to-close, APR — from cited, deterministic engines,
not a rate sheet taped to a monitor. This spec builds the charter's one genuinely new engine:
a scenario service that composes the engines that already exist. It also lands the
**address-first intake** (the adopted extract from the 2026-07-11 Chrome-extension program
verdict): the LO types an address, the licensed realty adapter prefills price/taxes/property
type — no scraping, no re-keying.

## 2. Serves L1 loop

- **Core-loop link:** borrower → **pre-approval** → MISMO package → wholesale delivery. The
  simulator reads the UAL orchestrator's persisted income, so the number quoted on the phone
  is the number underwriting sees.
- **Cut-line check:** LO tooling is loop work (charter §2); no launch blocker is preempted.

## 3. Bound by L2

| L2 invariant | How this feature satisfies it |
|---|---|
| I1 — AI never decides | `scenarioSimulator.ts` composes `pricingAdapter.computeOffers` → `underwritingEngine` → `apr.ts` → `loanCosts` only. No model output anywhere. |
| I2 — No citation, no regulated-math change | §1026.36(e)(2)–(3) option set implemented from eCFR text fetched 2026-07-11 (eCFR API, title-12 part 1026); `regulatory-ledger.json` entry `regz-1026-36e3-option-set` lands in the same commit. |
| I4 — PII through the vault | `scenario_runs` stores derived financials and engine inputs only — no SSN/account numbers. |
| I6 — FICO what-if is hypothetical | Never triggers a pull; labeled hypothetical in UI and recorded as an input. |
| I9 — NMLS gates solicitation | Internal staff tooling only (`requireRole` internal staff + `verifyInternalStaffApplicationAccess` deal-team scoping). Nothing borrower-facing (that is LO-3). |
| I10 — Simulations never ground a real decision | Every run and result carries `simulated: true` (rate sheets are simulated until the PPE contract) rendered honestly in the UI and persisted on the run. |

- **Security-review trigger?** Not per charter §3 (LO-1/LO-3/LO-5 are the flagged prompts).
  This route adds no new auth semantics — it reuses `requireRole` + the existing deal-team
  access helper. If review disagrees, run `/security-review` before merge.
- **Regulated math?** Yes — the anti-steering option-set derivation. Ledger citation in the
  same commit (see I2 row).

## 4. Scope

- **In:** `scenario_runs` (migration 0020) · `server/services/loanCosts.ts` (fee schedule
  extracted from `loanEstimate.ts`, single source) · `server/services/antiSteeringOptions.ts`
  (§1026.36(e)(3) set) · `server/services/scenarioSimulator.ts` · `POST /api/scenarios/simulate`
  · `ScenarioSimulatorDialog` on LO Command Center rows with address-first prefill via the
  existing `/api/properties/auto-complete` + `/api/properties/detail-live` endpoints.
- **Out (non-goals):** halal products (P7 gates) · DSCR pass/fail thresholds (ratio display
  only, UAL P4 rule) · pre-computed down-payment grid (v2, only if measured latency demands) ·
  borrower-facing share (LO-3) · re-price signals (LO-4) · LO compensation display (never).

## 5. Design / execution

- **Server:** simulator loads the application + **latest persisted `income_path_evaluations`
  row (income is never re-derived here)**; builds a `BorrowerPricingProfile` from scenario
  inputs (purchase price, down payment $/%, product types, occupancy, property type, FICO
  what-if, optional taxes/HOA overrides from the address prefill); per offer: PITI from the
  shared `loanCosts` model → `consolidatedUnderwritingEngine.evaluate` (memoized per distinct
  PITI) → Appendix J APR (`apr.ts`) → cash-to-close; derives the (e)(3)(i)(A)/(B)/(C) options;
  persists one immutable `scenario_runs` row (inputs, outputs, engine fingerprints, rate-sheet
  versions, `simulated`, LO user id) and writes an audit entry.
- **Data model:** `shared/schema/scenarioRuns.ts` + hand-authored `migrations/0020_scenario_runs.sql`
  (append-only; no UPDATE path). Number 0020 verified free against live worktrees 2026-07-11.
- **Client:** `ScenarioSimulatorDialog` (pattern: `RateLockDialog`) on each pipeline row;
  address-first intake inside the dialog; results render qualification badge, payment,
  cash-to-close, APR, and the three safe-harbor options with a simulated-data banner.
- **Contract:** `POST /api/scenarios/simulate` `{ applicationId, scenario }` →
  `{ runId, simulated, income, offers[], antiSteeringOptions, engineVersions }`; internal
  staff on the deal team only.

## 6. Acceptance criteria

- [ ] Given a pipeline file with a persisted income evaluation, when the LO changes the down
  payment, then qualified-or-not, payment, cash-to-close, and APR render in under 2 seconds
  and a `scenario_runs` row exists for the run.
- [ ] Unit tests pin determinism (same inputs → byte-identical outputs) and the safe-harbor
  set's presence (A/B/C labels) — added to `vitest.config.ts`.
- [ ] Simulator endpoint returns 403 for non-deal-team staff (IDOR guard) and non-staff.
- [ ] No persisted income evaluation → structured `NEEDS_INCOME_EVALUATION` response, never a
  re-derivation.
- [ ] **Definition of Done** (TEAM_PRACTICES §5): `npm run check` clean · `npm test` green ·
  live evidence on :5002 in the PR · no new env vars · doc-sync (this spec + charter link).

## 7. Risks & escalations

- **PPE contract absent (founder):** all rate output remains simulated; I10 provenance
  discipline is the mitigation, not a waiver.
- **Product feature flags absent:** the catalog carries no prepayment-penalty / demand /
  shared-equity flags, so the (e)(3)(i)(B) "without risky features" leg derives from
  `amortizationType` markers (IO/balloon/neg-am patterns); today's simulated catalog contains
  none of these features. When the PPE adapter lands, it must map real feature flags — noted
  in the ledger entry.
- **Migration-number race:** 0020 claimed here; concurrent sessions (partner-hub worktree)
  checked and clear at claim time — re-verify at merge.
