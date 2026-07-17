# Non-W2 Technology Optimization Plan — ADOPTED

> **Status: ADOPTED as the governing plan for the non-W2 / complex-income program**
> (founder directive, 2026-07-17). Where this plan conflicts with earlier roadmap or spec
> framing of the non-W2 program, **this document wins**. Three things it does not and
> cannot override:
>
> 1. **KB precedence** — code wins over any document the moment they disagree
>    ([README](../README.md)).
> 2. **The binding doctrines** of
>    [NON_W2_LENDING_RESEARCH_BRIEFING.md §1](NON_W2_LENDING_RESEARCH_BRIEFING.md)
>    (Reg B AI-isolation, no-citation-no-implementation, MR-2 stage-then-human-verify,
>    §7216 boundary, Reg N/Z comms lint, FCRA consent gating, reproducibility
>    fingerprints, PII discipline, Illinois-only footprint). The plan is written inside
>    them and repeatedly depends on them.
> 3. **Appendix A quarantine** — externally researched program numbers remain *targets*,
>    not implementable rules, until each one's citable source document is in-repo
>    (§ Phase 0). Until then the engines keep returning honest `requiresManualReview`.
>
> **Provenance:** founder-supplied external research (the outside-researcher program
> commissioned via the briefing, PR #234), returned 2026-07-17. Adjudicated and
> code-corrected per the returning-research protocol at `main` @ `a501ac1`
> (research was authored against `98a9674`; no drift found in any verified claim).
> §1 records every correction made; the founder's raw research text is otherwise the
> source of this plan's content.

---

## 1. Adjudication record

Every load-bearing claim in the returning research was verified against code. Verdicts:
**VERIFIED** (claim true as written), **CORRECTED** (claim adjusted to code reality),
**ALREADY BUILT** (research proposed building something that exists), **QUARANTINED**
(external number with no in-repo citable source — moved to Appendix A).

| # | Research claim | Verdict | Note |
|---|---|---|---|
| 1 | Rental offset computed but `appliedToDti: false`; decision engine sums wage + SE only | **VERIFIED** | `server/services/income/paths/rental.ts:34,52`; briefing gap #1 |
| 2 | Tie-out engine lacks 1120-S/K-1, 8825, Sch B/D, 4562 carries | **VERIFIED** | `server/services/taxReconciliation.ts` header says exactly this; briefing gap #6. Nomenclature: code checkIds are snake_case (`schedule_c_to_schedule_1`…); "C1–C10" is the [docs/irs-forms/README.md](../../docs/irs-forms/README.md) map numbering |
| 3 | No `expected_market_rent`, no `property_disposition`, no `application_drafts` anywhere in schema | **VERIFIED** | zero hits repo-wide; briefing gaps #4, #7, #13 |
| 4 | `asset_depletion` is an enum with no engine; ITIN / 1099-only / P&L-only absent | **VERIFIED** | briefing gaps #3, #5 |
| 5 | IL-only gate is ZIP3 600–629 + 422 `UNLICENSED_STATE` at intake/patch/property/pricing | **VERIFIED** | `shared/companyIdentity.ts:91` (`STATE_ZIP3_RANGES.IL = [[600, 629]]`) |
| 6 | Target-5 wholesale panel: UWM, Rocket Pro TPO, Plaza, Angel Oak, Newrez | **VERIFIED** | matches `shared/wholesaleLenders.ts` exactly |
| 7 | Phase 3: "deploy the vetted governance/security/ credentials to activate Plaid" | **CORRECTED** | The keys **do not exist yet** — the founder is mid-clearance with Plaid (2026-07-17). Activation trigger is *clearance completes*, not a credential deploy. The governance pack ([governance/security/](../governance/security/)) was drafted *for* that clearance |
| 8 | Phase 4: "Launch CPA Portal … to securely collect CPA letters" | **ALREADY BUILT** (partially) | The §7216 inviter-only CPA lane exists (PartnerHub CPA persona, PRs #55/#66). New work is narrower: CPA **P&L-attestation collection** for the P&L-only program (§4.4) + invitation activation |
| 9 | Phase 2: "Program the complete S-corporation cash-flow adjustment rules under B3-3.6" | **ALREADY BUILT** (mostly) | `server/services/selfEmploymentIncome.ts` already has the K-1 S-corp lane with the distributions-or-liquidity gate and meals exclusion. The **new** pieces are the Schedule L line 17d short-term-debt subtraction, the Schedule M-1 line 3b subtraction, and wiring 1120-S/8825 depreciation add-backs from extraction — *extend the calculator, don't rebuild it* (§3.2) |
| 10 | "Extraction confidence threshold < 0.8" | **CORRECTED** | Thresholds are per-doc-type (`server/services/documentConfidence.ts`: tax 0.85, gov ID 0.90, W-2/paystub/bank 0.80) and the review-triage field gate is < 0.7. No change needed to code |
| 11 | Draft `draft_token` sent to email/mobile for cross-device re-entry | **CORRECTED** (design constraint) | Adopted, but magic-link re-entry into a PII-bearing draft is outbound messaging + auth surface ⇒ **binding security-review trigger** ([TEAM_PRACTICES §9](../governance/TEAM_PRACTICES.md)) + TCPA consent rails for SMS |
| 12 | Angel Oak / Newrez / A&D / Acra / Deephaven underwriting matrices (FICO floors, LTV caps, DSCR floors, reserve months, haircuts, expense factors, ITIN terms) | **QUARANTINED** | Appendix A.1–A.2. The research answers *what the programs say* but not *provenance* — no citable artifacts were returned. No-citation-no-implementation holds |
| 13 | Departing-residence 30%-equity rule, 1-year-management-history restriction, ADU 30% income cap, Form 1007/1025 reconciliation | **QUARANTINED** | Appendix A.3. Selling Guide rental-income rules have changed over time; verify each sub-rule against the in-repo B3-3.1-08 reference (and fetch current text per CLAUDE.md compliance-first) **before** coding — never from this document |
| 14 | IL RMLA/IDFPR broker compliance table (net worth $150k, surety bond $25k–$150k, fidelity bond $100k, 20% liquid capital, PMLO, 8h CE) | **QUARANTINED** | Appendix A.4. Per CLAUDE.md, NMLS/state licensing policy is never adopted from memory or research — verify against [docs/nmls/](../../docs/nmls/), 205 ILCS 635, and counsel. State statute controls |
| 15 | "Rental valuation APIs" estimate `expected_market_rent` at pre-qual | **CORRECTED** (rails applied) | New vendor ⇒ deterministic simulation behind an adapter until a contract exists, same as every other vendor seam |
| 16 | Bank-statement deposit-scrubbing rule taxonomy (inter-account transfers, owner contributions, >50% large deposits, non-operating infusions, IOLTA carve-outs) | **ADOPTED as design** | Rule *classes* are adopted (§5.2); the specific eligibility percentages/windows per investor are Appendix A.1 quarantine |
| 17 | Competitive-landscape table (CTC days, doc burden, cost structures) | **ADOPTED as strategy color** | Market claims, unverifiable; fine for positioning, never for engine math |
| 18 | Reg B isolation, MR-2, §7216 isolation, comms lint, FCRA gating, fingerprints, PII vault descriptions | **VERIFIED** | The research restates the built rails accurately |

---

## 2. Phase 0 (continuous) — the citable-artifacts pipeline

**The single real unblock for every quarantined item.** The research supplies numbers;
it does not supply provenance. Standing acquisition work, running through all phases:

- Obtain the actual program documents — Angel Oak / Newrez AE-portal matrices (DSCR
  qualifying minimums by LTV/FICO, bank-statement deposit-eligibility rules), and the
  asset-depletion / 1099-only / P&L-only / ITIN program guides from the named investors
  (Deephaven, Acra, A&D Mortgage, Carrington as candidates alongside the Target-5).
- Land each artifact in `docs/lender-programs/<investor>/` following the Angel Oak
  pattern, with a `data/regulatory/regulatory-ledger.json` entry in the same commit.
- Only then does the corresponding Appendix A row graduate into engine rules. Until
  then: `requiresManualReview`, honestly.

This is the remaining half of briefing research questions Q1/Q2 ("what is publicly
documentable vs. relationship-gated?") — most of these matrices live behind AE
relationships, which makes Phase 4's broker agreements a *data* dependency, not just a
submission dependency.

## 3. Phase 1 — income-engine wiring (implementable now, in-repo citations exist)

**3.1 Rental income → DTI (briefing gap #1).** Wire the already-computed B3-3.1-08
offset into `server/services/decisionEngine.ts`: positive net rental (75% of gross rent
net of PITIA) adds to qualifying income; negative net rental adds to monthly
liabilities. Gate auto-application on *verified* rent evidence (doc-verified lease or
appraisal Form 1007/1025 figure — never chat-stated rent), consistent with the
provenance gate. Route through the S-05/S-06 scenario lane (advisory → applied) with
ledger entries; flip `appliedToDti` honestly per path run.

**3.2 Form 1084 S-corp completion.** Extend `server/services/selfEmploymentIncome.ts`
(not rebuild): Schedule L line 17d (mortgages/notes payable < 1 year) subtraction,
Schedule M-1 line 3b (non-deductible travel/meals) subtraction, and 1120-S line 14 /
8825 line 14 depreciation add-backs — each line verified against the in-repo
[B3-3.5/B3-3.6 reference](../../docs/fannie-mae/self-employment-income-reference.md)
before coding. Briefing gap #8 (official 1084 PDF + worked examples as golden fixtures)
remains open and should be closed alongside.

**3.3 `expected_market_rent` intake (gap #4).** Add to the property/REO schema
(same-PR migration, expand/contract) so purchase-money DSCR files can evaluate.
Prefill estimate via a rental-AVM **adapter with deterministic simulation** (rails);
reconcile against Form 1007/1025 at appraisal per A.3 verification.

**3.4 `property_disposition` + S-07 activation (gap #7).** Add
`retained_as_primary | sold | converted_to_rental` to intake. Implement the
departing-residence conversion rules **only after** the A.3 sub-rules are verified
against the current Selling Guide text — the equity/history restrictions in the raw
research are plausibly stale.

## 4. Phase 2 — tax-reconciliation depth + new income paths

**4.1 Entity tie-outs (gap #6).** Transcribe into `server/services/taxReconciliation.ts`,
each backed by the official form PDFs in [docs/irs-forms/](../../docs/irs-forms/):
- 8825 line 23 → 1120-S Schedule K line 2 → K-1 (1120-S) box 2 × ownership → 1040
  Schedule E Part II line 28.
- 1120-S line 21 → Schedule K line 1 → K-1 box 1 → Schedule E Part II.
- 4562 line 22 → 1120-S line 14 / 8825 line 14 / Schedule C line 13.
- Schedule B and Schedule D carries into 1040/Schedule 1.
Variances stay review flags, never auto-decisions (MR-2).

**4.2 `assetDepletion.ts` path (gap #3).** Build the sixth… fifth-plus path module under
`server/services/income/paths/` with **both** methodologies as pure, fingerprinted
functions — Option 1 (net qualified assets ÷ 84- or 120-month amortization, with the
min(1.5 × loan, $1M) qualified-assets test) and Option 2 (total-asset: net assets ≥
loan + costs + reserves + 60 × monthly liabilities, no DTI check) — with the
asset-class haircut table **as data, not constants**. The path returns
`requiresManualReview` until A.2 program docs land; the structure ships now so the
orchestrator compares it from day one. Cross-reference: platform reserve haircuts
already ledgered as conservative policy (`platform-haircut-*`, roadmap item 30) are a
*different* context (reserves, not income) — don't merge the tables.

**4.3 1099-only path.** Same pattern: gross 1099 receipts × (1 − expense factor) ÷
lookback months, expense factor and floors from A.2 once citable; deposit-corroboration
check against bank-statement analyses.

**4.4 P&L-only path + CPA attestation lane.** Reuses the existing §7216 inviter-only
CPA persona on PartnerHub for preparer-signed P&L collection (preparer validation,
seasoning/ownership floors, expense floors, 15% deposit-reconciliation tolerance — all
A.2 until citable). Consumer-direct upload stays the §7216-safe default.

## 5. Phase 3 — verification vendors (contract-gated, not code-gated)

Every item here is a one-seam adapter flip (briefing §10); the engineering is mostly
done by design. Order of activation follows contracts, not the calendar:

- **5.1 Plaid VOA (F4).** Trigger: **founder's Plaid clearance completes.** Then env
  keys per the governance pack. Asset-report parsing already handles real-vs-sim.
- **5.2 Bank-statement scrubbing.** Adopt the research's deposit-classification
  taxonomy as the deterministic rule set layered on Plaid transactions / extracted
  statements: inter-account transfer detection (same entity/EIN), owner-contribution
  carve-out, large-deposit flag (> 50% of average monthly deposits ⇒ LOE + 60-day
  seasoning), non-operating infusions, IOLTA/escrow carve-outs for professional firms.
  Investor-specific eligibility percentages stay A.1-gated. Manual-PDF path keeps the
  fraud checks (metadata/author signature, font consistency, running-balance math) —
  outputs stage `needs_review`, humans verify (MR-2).
- **5.3 Credit (F3, iSoftpull / CRS One)** — and ship the FHA 4000.1
  medical-collections DTI treatment in the same window (briefing gap #9 pairing).
- **5.4 PPE (F11, Lender Price + Mortech)** and **AUS onboarding (F6)** replace seeded
  rate sheets and the simulated DU/LPA legs.
- **5.5 Truv VOIE (F5).** Adopt the research's coverage-honest fallback chains:
  payroll-network verification works for S-corp officer W-2s (~partial) and nearly
  never for 1099/Schedule C/Schedule E profiles — the documented fallback evidence
  chain (Plaid deposit matching → IRS forms/transcripts → WVOE + statements) is the
  design, per profile class.

## 6. Phase 4 — commercial un-gating

- **6.1 Broker agreements (LS-10 slice 3)** with the Target-5 — replaces
  `submitToLenderPortal`'s simulation ("the single seam to replace") *and* unlocks the
  AE-portal program docs feeding Phase 0.
- **6.2 ITIN lane** — enters the path/product registry only with A.2 program docs.
  Engineering pre-work adopted now: the SSN vault treats ITINs as SSN-class PII
  (`server/services/ssnVault.ts`), CP565/CP567 + government-ID checklist types,
  alternative-credit document collection (12–24 mo utilities/rent/insurance).
- **6.3 Adverse-action counsel TODO** (administering-agency wording, briefing gap #18)
  resolved before any un-gating.
- **6.4 Go-live env flips** stay founder-held (prelaunch gate, beta code), per the
  briefing §1.

## 7. Cross-cutting adoptions (run alongside all phases)

- **7.1 Data flywheel.** Formalize the P5 `humanVerified` ground-truth loop into an
  extraction-accuracy eval: capture (document, model payload, human-corrected values)
  triples from review-triage resolutions; build drift monitors and a prompt-iteration
  cadence. MR-2 unchanged — the flywheel *measures*; it never auto-verifies.
- **7.2 Narration-faithfulness harness.** Extend `pnpm coach:ab` to score staff
  risk-brief narration against the deterministic record: every number/citation/DTI in
  the narrative must match engine JSON (hallucination check), citations must map to the
  Postgres matrices (alignment audit), and output must pass the comms lint. Echo-only
  doctrine unchanged.
- **7.3 Server-side draft persistence (gap #13 / roadmap A1).** `application_drafts`
  (same-PR migration), PII encrypted via `encryptionService`, event-driven saves from
  the funnel machine, re-engagement nudges. Magic-link re-entry goes through security
  review (adjudication #11) before build.
- **7.4 SE acquisition content (gap #14)** under the existing Reg N/Z lint rails:
  write-off math, declining-income averaging, bank-statement and asset-utilization
  explainers — "bank statement-derived gross receipts," never "no-doc"/"tax-return-free
  approval"; Reg Z trigger-term discipline enforced by the linter.

---

## Appendix A — Quarantined external parameters (targets, not rules)

Everything below came back from the outside research **without citable artifacts**. Each
row graduates to implementable only when its source document lands in-repo (Phase 0).
Recorded verbatim-in-substance so the research is not lost; **nothing here may be coded
against as-is.**

### A.1 DSCR + bank-statement investor matrices

| Parameter | Angel Oak (Investor Cash Flow) | Newrez (SmartVest) | A&D Mortgage | Source to obtain |
|---|---|---|---|---|
| Min FICO | 680 | 660 (680 first-time investor) | 620 | AE-portal program matrix, each investor |
| Max LTV | 85% at 720+ | 80% (DSCR ≥ 1.0) | 80% | same |
| DSCR floor | < 1.0 and no-DSCR options | 0.50 with −10% LTV penalty | no-ratio (0.00) | same |
| Reserves | 3–6 mo PITIA | 3 mo | 3 mo | same |
| Collateral notes | 1–4 unit, non-warrantable condo, STR | 1–15 financed, STR, non-warrantable | STR/AirDNA, condotel; dual appraisal > $2M | same |
| Bank-stmt deposit-eligibility %s and windows | — | — | — | same (pairs with §5.2 taxonomy) |

DSCR definition (already cited in-repo via the Angel Oak reference): gross monthly rent ÷
monthly PITIA.

### A.2 Asset depletion, 1099-only, P&L-only, ITIN

- **Asset depletion Option 1:** (qualified assets − funds-to-close − reserves) ÷ 84 or
  120 months; qualified-assets test ≥ min(1.5 × loan, $1,000,000). **Option 2:** net
  assets ≥ loan + costs + reserves + 60 × monthly liabilities; no DTI check.
  **Haircuts:** cash/CDs 100% · stocks/bonds/funds 70–80% · retirement 59½+ 70% ·
  retirement < 59½ 50–60% · ineligible: private stock, restricted stock, business
  operating accounts, physical gold, RE equity. Seasoning 30–60 days.
  *Named sources: Deephaven / Angel Oak Expanded Prime program guides.*
- **1099-only:** qualifying = gross 1099 × (1 − expense factor) ÷ 12-or-24 mo; factor
  10% (individual) / 15% (SMLLC payee); 680 FICO, 15% down, 2 mo statements
  corroborating deposits.
- **P&L-only:** 12/24-mo CPA/EA/CTEC-signed P&L; preparer filed the most recent business
  returns + attests audit-or-review; 2-yr self-employment, 25–50% ownership; expense
  floors 15% (service) / 20% (asset-heavy) with automatic downward adjustment; deposit
  reconciliation within 15%; DTI ≤ 50%; $2,500 residual; 6 mo PITIA ≤ $1.5M.
- **ITIN:** CP565/CP567 + government photo ID; FICO 640–660 or alt-credit (12–24 mo
  utilities/rent/insurance); LTV 75–80% (20–25% down); reserves 3 mo (6 mo above 75%
  LTV); income via ITIN tax returns, 12–24 mo statements, or WVOE + 1 mo ACH evidence.
  *Named sources: A&D Mortgage / Acra Lending program guides.*

### A.3 Fannie rental sub-rules pending in-repo verification

Verify each against the current Selling Guide B3-3.1-08 text (fetch per compliance-first
rule) before S-07/ADU work — flagged because the research's versions are plausibly stale:

- Departing-residence conversion: claimed ≤ 70% LTV on the departing property (≥ 30%
  appraised equity) to use projected rent.
- Claimed 1-year property-management-history requirement (Schedule E fair-rental-days
  365) gating whether net surplus can *add* to income vs. offset-only.
- Claimed ADU rental cap at 30% of total qualifying income, purchase/limited-cash-out
  only.
- Form 1007 (SFR) / Form 1025 (2–4 unit) market-rent reconciliation mechanics.

### A.4 Illinois RMLA / IDFPR broker compliance table

Claimed: $150,000 audited net worth · surety bond $25k–$150k (volume-scaled) · $100,000
fidelity bond absent an in-state branch · liquid capital ≥ 20% of assets · PMLO
designation · 8h annual CE (12-31 deadline). **Verify against
[docs/nmls/](../../docs/nmls/), 205 ILCS 635, and IDFPR/counsel before relying on any
figure** — state statute controls; nothing here enters PolicyOps monitoring or public
copy unverified.

---

*Adjudication performed 2026-07-17 against `main` @ `a501ac1` per the
returning-research protocol in [NON_W2_LENDING_RESEARCH_BRIEFING.md](NON_W2_LENDING_RESEARCH_BRIEFING.md);
original research text supplied by the founder in-session (external researcher output,
citation markers unresolved in the original).*
