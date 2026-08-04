# 2026-08-04 — External "Renter Incubation & Access Engine" pitch: adjudication

> **Dated snapshot** (Tier 4). Facts verified against the code on 2026-08-04 (HEAD `4ba20cf`);
> verdicts govern until a reopen gate below fires. Same protocol as
> [2026-08-04-rate-com-competitive-pitch-adjudication.md](./2026-08-04-rate-com-competitive-pitch-adjudication.md),
> [2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md](./2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md) (both same-day),
> [2026-07-19-modular-architecture-pitch-adjudication.md](./2026-07-19-modular-architecture-pitch-adjudication.md), and
> [2026-07-17-external-agentic-mortgage-artifacts-evaluation.md](./2026-07-17-external-agentic-mortgage-artifacts-evaluation.md):
> adopt nothing wholesale, verify every claim in code, extract what survives, record binding
> rejections with reopen conditions.

## 0. What arrived, and the ask

An external pitch for a "Renter Incubation and Access Engine" — win the renter segment retail
lenders abandon by solving "Credit, Cash, and Complex Income." Four components:

1. **"Invisible Credit Booster"** — detect 12 months of $300+ monthly outflows to a landlord
   from Plaid/Finicity-connected bank accounts and "inject this verified payment history
   directly into Fannie Mae's Desktop Underwriter (DU) API"; claims it "bypasses the credit
   bureaus entirely," "can instantly flip a 'Refer/Ineligible' automated underwriting decision
   into an 'Approve/Eligible,'" and "you qualify renters that other banks legally cannot."
2. **"Geo-Targeted DPA Matrix"** — integrate Down Payment Resource (DPR) via API; the renter
   "drops a pin on their target zip code"; cross-reference 2,600+ programs (state HFAs, county,
   city); show stacked awards ("a $10,000 forgivable state grant + a $2,500 Fannie Mae
   HomeReady credit. Your estimated out-of-pocket cash to close is now $2,500").
3. **"Gig-Economy Income Synthesizer"** — connect digital payroll (Truv/Argyle) plus bank
   accounts, compute "a blended 12-month average" of W-2 + gig income, and match to "specific
   Freddie Mac or Non-QM 1099-programs that do not require two years of tax returns."
4. **"Path to Purchase Simulator"** — "Never issue a flat denial"; compute "the exact delta
   between their current state and a mortgage approval"; gamified roadmap ("You are 60 days
   away from a home. Step 1: Pay exactly $420 toward your Capital One card… Step 2: Save
   $1,100 more to trigger the City of Chicago DPA grant.").

No founder direction arrived with the paste; the standing external-pitch protocol applied.
Unlike the Rate.com pitch (which largely described our shipped broker architecture), this one
splits three ways: features we already ship (the Incubator lifecycle), mechanics we cannot
verify locally and therefore cannot adjudicate — only procure the authority for (DU rent
history), and framings we have bindingly rejected (borrower-facing approval math).

## 1. Facts: the pitched simulator is our shipped Incubator; the rest is unverifiable or barred

Every row verified in code this session, not from memory:

| Pitch claim | Repo reality |
|---|---|
| "Parse 12mo rent outflows from Plaid/Finicity-connected bank accounts" | **Dormant substrate, zero rent logic.** Plaid is real but keyless by founder decision: SDK client with income/identity/assets products (`server/plaid.ts`), `PlaidConnectButton` + coach `plaidEligible` checklist items, `POST /api/webhooks/plaid-assets` → `verification_reports` rows carrying `voaReportId`/`auditCopyToken`/`gseEligible` (`server/routes/aus.ts:48`; `shared/schema/compliance.ts`). No Finicity anywhere. No Plaid *Transactions* product, and no `assetReportCreate` producer — the VOA webhook has no outbound trigger. The repo's only transaction-scanning rule is `detectSignificantDeposits()` (`server/services/underwritingNuance.ts:328`), a single-row magnitude filter with no periodicity, counterparty, or streak logic. Borrower-paid rent exists once: self-entered `currentRent` on homeownership goals, consumed as a tier-3 DTI liability (`server/services/borrowerGraph.ts:552`) — a debt, not a credit positive. |
| "Inject verified rent history directly into Fannie Mae's DU API" | **No DU API, no rent element, no authority doc.** DU is a deterministic 3-gate simulation (`server/services/ausSubmission.ts`: FICO<620 / DTI>50% / LTV>97%, `simulated: true`); setting `FANNIE_DU_API_KEY` throws "not implemented" (`:155` — live DU requires Fannie technology-provider onboarding, not an API key). `DuCasefileInput` (`:129`) has eight fields, none rent-related; `shared/mismo.ts` + `server/mismo.ts` contain zero rent elements. And the policy itself is **locally unverifiable**: `docs/fannie-mae/` is delivery/closing-only (ULDD, UCD, URLA, SFC, EarlyCheck) — no Selling Guide B3-x sections, no DU Release Notes, no asset-verification-report spec; greps for "rent payment" / "positive rent" / "asset verification report" return zero. CLAUDE.md compliance-first: a missing document means say so — never proceed from memory. |
| "Bypasses the credit bureaus entirely" / "you qualify renters that other banks legally cannot" | **Unverifiable, and implausible as framed.** These are assertions about a GSE feature we cannot verify locally (row above). The exclusivity claim is implausible on its face — DU is available to any DU-approved lender — but we assert no DU policy from memory in either direction; the claim routes to the §5.2 authority-corpus acquisition. |
| "Instantly flip Refer/Ineligible into Approve/Eligible" | **Nothing to flip.** The simulation has no rent sensitivity at all; Day 1 Certainty relief in `ausSubmission.ts` follows the recommendation, never changes it. Thin-file support is SFC 818 as a manual delivery label only (`shared/fannieMae/specialFeatureCodes.ts:100`, `autoDerived: false`); the adversarial persona suite *rejects* a thin-file borrower on the FICO floor; no nontraditional-credit logic exists. |
| "Geo-targeted matrix of 2,600+ DPA programs (DPR API), drop a pin on any zip" | **A real DPA directory ships — Illinois-deep, not geo-matched.** `dpa_programs` (`shared/schema/admin.ts:481`), public `GET /api/dpa-programs` (`server/routes/borrower/onboarding.ts:25` — no Zod, `filters: any`, ungated), `client/src/pages/education/DownPaymentWizard.tsx` at `/down-payment-wizard` (public, indexable, in the sitemap). Seeded: 6 IL programs (`server/seedData/illinoisDpa.ts` — IHDA ×4, Chicago HomeGrown up to $70k, Cook County up to $25k) + 3 banned-phrase-tested articles. No zip/county/AMI columns (sub-state scope is prose in `eligibilityNotes`), no stacking model, and `maxIncome`/`maxHomePrice` are never seeded — the wizard's income filter is a silent no-op (§3.4). |
| "Stacked grants → your estimated cash to close is now $2,500" | **DPA touches zero money math.** `loanCosts`/Loan Estimate/scenario simulator/pricing/underwriting/affordability are all DPA-clean; `cashToClose = closingCosts + downPayment − lenderCredits`, and the only `lenderCredits` producer is the first-time-homebuyer LLPA waiver (`server/pricing.ts:79`). "HomeReady" exists only as unused SFC delivery metadata (900/818/884 — the `homeReady` derivation input has no caller); "Home Possible" and "HFA": zero hits. Meanwhile the wizard's gated CTA already *promises* "you'll be able to factor DPA programs into your pre-approval" — a promise nothing keeps (§3.3). |
| "Any zip" nationwide reach | **Collides with the licensed footprint.** `LICENSED_STATES = ["IL"]` (`shared/companyIdentity.ts:69`, founder-confirmed 2026-07-17, pinned by a source-text test). The wizard already offers all 50 states ungated — survivable today only because non-IL queries return empty. Nationwide data would produce rich non-IL matches funneling into `unlicensedStateRejection` 422s at the very next step — Reg N/UDAAP-shaped bait on a pre-license indexable page (§3.6). |
| "Blended 12-month average of W-2 + gig income" | **Blending is our core engine; a "gig" path and the 12-month window are not.** The income orchestrator (`server/services/income/orchestrator.ts`) computes every applicable path in one deterministic pass — component paths (agency wage + self-employment + rental) stack additively, alternatives (bank statement, DSCR) compete, `recommendedPathId` surfaces the best method. Scenario S-01 "Hybrid W-2 / Self-Employed Creator" is implemented. But `INCOME_PATH_IDS` (`shared/incomePaths.ts`) has no gig/1099 entry; registry #38 "Multiple 90-Day Gaps in Gig Work" sits in the Backlog (`knowledge-base/compliance/UNDERWRITING_SCENARIOS.md:479`), and its cited authority (Fannie B3-3.1-05) averages over ~24 months — double the pitch's window. |
| "Connect Truv or Argyle for gig income" | **Contradicts our own adopted ruling.** Truv is a `verification_reports.provider` schema comment plus unchecked roadmap item F5. NON_W2_TECH_OPTIMIZATION_PLAN §5.5 (adopted): payroll-network verification works for W-2 profiles and "nearly never" for 1099/Schedule C — the adopted evidence chain is Plaid deposit matching → IRS forms/transcripts (now roadmap F12, adopted by the same-day sovereign-stack adjudication) → WVOE + statements. The pitch inverts the ruling. |
| "Freddie Mac or Non-QM 1099-programs that do not require two years of tax returns" | **Program numbers quarantined; Freddie corpus absent.** The 1099-only math (gross × (1 − expense factor), 680 FICO, 15% down) sits verbatim in NON_W2 plan Appendix A.2 — uncited, "nothing here may be coded against as-is"; graduation is a citable doc landing in `docs/lender-programs/`, enforced by `tests/nonQmProgramGate.test.ts`. There is no `docs/freddie-mac/` directory, no Form 91; LPA is simulated (`submitToLPA`, `ausSubmission.ts:224`). |
| "Path to Purchase Simulator: exact delta, gamified roadmap, captive pipeline" | **Mostly shipped — as the Incubator — minus the barred parts.** RenterHome *is* the Incubator: server-computed /100 readiness with trust tiers and outstanding inputs (`server/services/borrowerGraph.ts`), down-payment goal delta ("You're $X away… about N months"); `GapCalculator.tsx` + `GET /api/homeownership-goal/gap-analysis` (credit/savings/DTI gaps, months-to-goal; status vocabulary never contains a denial word) + credit-recommendations (score-band educational items, deliberately not tradeline-derived); coach `set_action_plan` (`server/services/coachTools.ts:362` — phased, categorized, checkable); `creditActions`/`savingsTransactions`/`journeyMilestones` tables. The "$420 precision" exists **staff-side**: `computeWhatIfPayoff` (`underwritingNuance.ts:148`) returns the smallest tradeline payoff that clears the DTI ceiling, surfaced in `preUnderwriting.ts:233` prose; the borrower sees a chip color + tooltip only. |
| "Never issue a flat denial" | **The engine already avoids gratuitous denials; a required denial cannot be suppressed.** `rejectionReasons` are "'a human must look,' not 'declined'" (`server/underwritingEngine.ts`); `NEEDS_MORE_INFO` returns missing items, not a decision. But ECOA/Reg B §1002.9 adverse action is fully built and mandatory (`ensureAdverseActionForDenial` refuses any denial it cannot paper, `server/services/creditAdverseActions.ts:274`; borrower rendering `AdverseActionNotice.tsx`). `denied: []` is terminal (`shared/schema/lendingCore.ts:75`) — and verification found the real gap is what happens *after* the notice (§3.7–§3.8). |

**PM note:** fifth consecutive external pitch in this series, and the first aimed at the
borrower-acquisition side rather than the income engine — yet the centerpiece is again a
rebuild of something already shipped (the Incubator lifecycle, live since the
RenterHome/Engine/Portfolio split). The genuinely new competitive observation — retail lenders
trash denied leads — is real, and our answer is already half-built; what verification exposed
is that our *own* denied borrowers currently hit a dead end (§3.7–§3.8). The moat argument is
unchanged from the sovereign-stack memo: not the parser, not the matrix — the citation
discipline and the human-verification throttle.

## 2. Point-by-point verdicts

| Recommendation | Verdict | Why (evidence) | Reopen gate |
|---|---|---|---|
| Plaid transaction parsing → recurring-rent classifier | ⏸ **Deferred** | Zero rent-classification code exists; Plaid is keyless by founder decision; the Transactions product is unlicensed; a classifier with no citable consumer for its output is speculative machinery. | Plaid keys land (founder clearance) **+** an explicit Transactions/Assets product decision (a new PII egress → §9 sub-processor review + vendor-diligence note) **+** the DU authority docs of the next row — the classifier exists only to feed that consumer. |
| Rent history → DU / "flip Refer/Ineligible to Approve/Eligible" | ⏸ **Deferred — unverifiable locally; never from memory** | `docs/fannie-mae/` has no Selling Guide B3-x, no DU Release Notes, no asset-verification-report spec; CLAUDE.md compliance-first bars proceeding from memory. DU is a 3-gate sim (`FANNIE_DU_API_KEY` throws); `DuCasefileInput` and both MISMO files carry zero rent elements. We cannot adjudicate the mechanics — only procure the authority. | The governing Selling Guide section + DU Release Notes + asset-verification-report spec land in `docs/fannie-mae/` (§5.2) **+** the Plaid row's gates **+** a Fannie technology-provider onboarding decision (roadmap F6 territory). Then re-adjudicate; nothing is implemented from the pitch's description. |
| Market "bypasses the bureaus" / "qualify renters other banks legally cannot" | ❌ **Rejected** | Uncited exclusivity claim about a feature we cannot verify — and DU is available to any DU-approved lender, so the framing is implausible on its face. Same lint class as the wizard's "$100 billion" defect (§3.1): no uncited claims in outbound copy. | None for the exclusivity framing — doctrine. The underlying feature reopens with the row above. |
| Add Finicity as a second aggregator | ❌ **Rejected** | No integration exists; no named coverage gap Plaid fails to serve; one adapter per capability (vendor doctrine, `server/mcp/vendors.ts` pattern); a second PII sub-processor with no payer fails the new §9 trigger's spirit outright. | A named, documented coverage gap Plaid cannot serve + §9 review + procurement gates (SOC 2, signed data-processing agreement). |
| DPR nationwide geo-targeted matrix ("drop a pin on any zip") | ❌ **Rejected as pitched** | Illinois-only footprint ruling (#201; `LICENSED_STATES`, test-pinned): nationwide matches funnel into 422s — Reg N/UDAAP-shaped on an indexable pre-license page. Vendor doctrine rejects a live borrower-path API; the house analogue is table-fed onboarding (the pricing-adapter pattern) — a DPR *feed* writing `dpa_programs` rows, which also keeps borrower income/zip from ever egressing to the vendor. Geo matching needs zip/county/AMI columns the schema lacks: no speculative schema — a column needs a named consumer. | Footprint expansion lands in `LICENSED_STATES` (founder + counsel), **or** a DPR feed procurement completes (SOC 2 + signed data-processing agreement + permissible-purpose review — and note the acronym collision: in our governance docs "DPA" is a Data-Processing Agreement) scoped to licensed states only, with schema columns arriving in the same program as their wizard consumer. |
| DPA stacking in cash-to-close ("your cash to close is now $2,500") | ⏸ **Deferred** | `dpa_programs` rows carry directory facts, not verified award terms; a DPA award is a third party's conditional decision, not our credit; `cashToClose` has exactly one credit producer (`server/pricing.ts:79`) and every money-math surface is DPA-clean by design. A directory-derived dollar shown as *the borrower's* cash-to-close is a live qualifying figure — the C2 class. | A staff-verified award record for a licensed-state program (amount, type, forgivability, provenance-gated) + a citable Loan Estimate/TRID treatment for third-party assistance — then a cash-to-close line item, post-verification, never live from directory data. |
| Surface "a $2,500 Fannie Mae HomeReady credit" | ⏸ **Deferred** | HomeReady is unused SFC delivery metadata here (900/818/884; input never set); the credit's terms are not in `docs/fannie-mae/`; unverifiable locally — same doctrine as the DU row. | A citable Fannie doc for the credit lands in `docs/fannie-mae/` + a pricing-engine consumer citing it. |
| Blended 12-month W-2 + gig average | ❌ **Rejected as pitched** (blending already ships; the window and path do not) | Component stacking is the orchestrator's core design (S-01 shipped). No `gig` path exists, and the only cited authority in-repo for gig income (registry #38 → B3-3.1-05) averages ~24 months; the pitch's 12-month window is an uncited program parameter. | Registry #38 graduates from Backlog with its citable guideline; a 12-month window only if a citable program doc lands in `docs/lender-programs/` (Phase 0). |
| Truv/Argyle as the gig-income rail | ❌ **Rejected (pre-adjudicated)** | NON_W2 plan §5.5: payroll networks cover W-2s, "nearly never" 1099/Schedule C; the adopted chain is Plaid deposit matching → IRS transcripts (F12) → WVOE. Truv remains an F5 W-2 VOIE procurement item, not a gig rail. | Vendor-published coverage evidence showing material gig-platform payout coverage, reviewed at F5 procurement (§5.3) + §9 sub-processor review. |
| 1099-no-tax-return program terms (680 FICO / 15% down / expense-factor math) | ❌ **Rejected under standing quarantine** | Verbatim Appendix A.2 numbers (NON_W2 plan: "nothing here may be coded against as-is"); graduation is Phase 0 — a citable doc in `docs/lender-programs/<investor>/`, enforced by `tests/nonQmProgramGate.test.ts`. The pitch adds no new information, and the quarantine held under identical pressure in both same-day adjudications. | Per investor: verbatim citable program doc in `docs/lender-programs/<investor>/` (Phase 0). |
| Route via "Freddie Mac 1099 programs" | ⏸ **Deferred** | No `docs/freddie-mac/` corpus exists; no Form 91; LPA is simulated. Locally unverifiable — same doctrine as the DU row. | A Freddie corpus is started under `docs/` (founder decision, §5.4) with the governing income docs; then re-adjudicate. |
| Path-to-Purchase Simulator (readiness score, deltas, action plan, savings roadmap) | ✅ **Already shipped — converge, don't duplicate** | RenterHome + gap-analysis + credit-recommendations + coach `set_action_plan` + the journey/gamification tables are the pitched simulator minus the barred framing. Remaining borrower-facing evolution belongs to the in-flight Borrower Clarity program (#319/#320/#323/#326 landed; PR 7 governs figures), not a parallel build. | — |
| Borrower-facing exact-dollar deltas pre-decision ("Pay exactly $420 toward your Capital One card") | ❌ **Rejected — binding (restated)** | `computeWhatIfPayoff` exists and stays staff-side by design. A live tradeline-specific payoff figure is a qualifying representation over pre-verification data — the C2 class bindingly rejected in the rate-com memo §2/§6, plus MR-2. Directive tradeline-specific consumer credit advice also raises the §5.6 CROA-adjacency question. | None — doctrine, not a deferral. Post-decision exposure belongs to Borrower Clarity PR 7's gate class. |
| Approval-likelihood countdown ("You are 60 days away from a home") | ❌ **Rejected — binding** | A representation about likelihood and timing of approval: Reg N §1014.3(q); `regn-guaranteed-approval` is a no-override hardBlock (`shared/compliance/loCommsLint.ts`). The gap-analysis status vocabulary deliberately never emits approval likelihood. | None — doctrine. |
| "Never issue a flat denial" | ❌ **Rejected as pitched; kernel adopted** | Adverse action under ECOA/Reg B §1002.9 is mandatory — a denial must be issued with specific reasons; suppressing or disguising it is illegal, not kind (`ensureAdverseActionForDenial` exists precisely to refuse un-paperable denials). The pitch's true observation — the denied borrower's experience *after* the notice — survives: today the notice page is unreachable from borrower UI and the denied borrower's home surface pitches an immediate re-apply (§3.7–§3.8). Adopted as post-notice re-entry into the existing Incubator (§4 Leg B), status machine untouched. | None for the status machine — doctrine. The re-entry surface is adopted now. |

## 3. Defects found during verification (fixed in the §4 legs unless noted)

None introduced by the pitch; all actioned regardless of its verdicts:

1. **Uncited "$100 billion" claim** — `DownPaymentWizard.tsx:116` hardcodes "Over $100 billion
   in down payment assistance is available nationwide" on a public, indexable, pre-license
   page; line 118 adds "Most first-time buyers qualify for at least one program" — an
   eligibility-likelihood claim. No citation for either exists in-repo. Cite-or-remove (Leg A).
2. **Empty-state copy contradicted by the data** — `DownPaymentWizard.tsx:198`: "Many federal
   programs are available nationwide," but the directory has zero `state: null` rows; every
   non-IL query returns empty while the copy implies otherwise (Leg A).
3. **Unkept CTA promise** — the wizard's prelaunch-gated CTA promises "you'll be able to factor
   DPA programs into your pre-approval when we launch" (ungated variant: "we'll factor in DPA
   programs automatically"); DPA touches zero money math (§1). UDAAP-shaped promise on a
   lead-capture surface (Leg A).
4. **Unvalidated public endpoint with a dead filter** — `GET /api/dpa-programs`
   (`server/routes/borrower/onboarding.ts:25`): no Zod schema, `filters: any`, filtering split
   between SQL and in-memory, no recorded public-by-decision rationale; and the income filter
   can never match because no seeded row sets `maxIncome` (Leg A).
5. **Education gap** — no glossary entry for down payment assistance despite a wizard, six
   seeded programs, and three articles; and the wizard's "Ask AI Coach" button points at a
   coach with no DPA grounding — the one surface where a hallucinated program term could slip
   past the seed-verified content (Legs A + C).
6. **Latent 50-state exposure** — the wizard's ungated state selector is honest today only
   because non-IL data is empty; any nationwide data load would silently convert it into the
   §2 DPR row's Reg N/UDAAP problem. Licensed-footprint framing lands now, before data can
   change (Leg A).
7. **The ECOA adverse-action notice is unreachable from borrower UI** — the `adverse_action`
   notification (`server/routes/compliance.ts:897`, `entityType: "loan_application"`) falls
   through `NotificationsPanel.tsx`'s entity mapping (deal/document/task only) to
   `href = "/dashboard"`; no borrower component links `/adverse-action/:id` (only staff
   surfaces do). The borrower is told a required disclosure is available and the click lands
   on the dashboard (Leg B).
8. **Denied borrowers get a re-apply pitch as their home surface** — a denied-only borrower
   fails `Dashboard.tsx:199`'s `applications.length === 0` Incubator gate, resolves no active
   application (terminal statuses are excluded by `pickWorkableLoanApplication`), and lands on
   the generic Dashboard whose server-computed next action is "Start your pre-approval — takes
   about 3 minutes" → `/apply`; the `denied` greeting and next-action branches are dead code on
   the default path (Leg B).

## 4. Adopted program — "Renter Ramp" (three PRs, zero migrations, converge-don't-duplicate)

Constraint up front: Borrower Clarity (rate-com memo §4) is mid-flight — its PRs landed today
as #319/#320/#323/#326, and its PR 7 owns borrower-facing income figures. Nothing below shows
a figure, changes the status machine, or adds schema.

- **Leg A — DPA wizard honesty (`fix(dpa)`)**: cite-or-remove the §3.1 claims; truthful
  IL-coverage framing + empty state; a licensed-footprint notice on non-IL state selection
  (reusing `unlicensedStateMessage`); CTA copy stops promising money-math that doesn't exist;
  the dead income filter is removed until sourced eligibility data exists (self-releasing
  test pin); Zod + typed SQL filtering + a public-by-decision note on `GET /api/dpa-programs`;
  a "Down payment assistance (DPA)" glossary entry; source-text compliance tests extending
  `tests/illinoisDpaSeed.test.ts`.
- **Leg B — post-denial re-entry (`feat(incubator)`, client-only)**: the home surface routes a
  borrower with no workable file (and no funded loan) to the existing Incubator instead of the
  re-apply Dashboard — one pure predicate (`showIncubatorHome`) replacing the
  `applications.length === 0` gate; the `adverse_action` notification maps to
  `/adverse-action/:id` (§3.7); the notice page gains one subordinate, `lintOutboundText`-clean,
  print-hidden "keep building toward homeownership" card linking to the readiness tools and
  gap calculator. The mandatory notice content is untouched; `denied: []` stays terminal;
  deep-linked closed files still render.
- **Leg C — coach DPA grounding (`feat(coach)`, after Leg A)**: one read-only
  `lookup_dpa_programs` coach tool over `storage.getDpaPrograms` (verified rows, including the
  confirm-with-agency `eligibilityNotes`), one system-prompt rule (cite the directory, always
  confirm-with-agency, never state the borrower qualifies), tests in `tests/coachTools.test.ts`.

Explicitly **not** adopted: a DPA-aware down-payment calculator (a seeded program cap applied
to the user's scenario is a personalized benefit figure that would numerically re-promise what
Leg A retracts; reopen: sourced per-program eligibility data, or a strictly user-entered
assistance input), the DPR feed, any `dpa_programs` schema columns, the rent classifier, a
`gig` income path, Finicity, and all DU work.

## 5. Founder / counsel items

1. **DPR procurement decision (founder):** whether to pursue a Down Payment Resource *data
   feed* — table-fed into `dpa_programs` on the pricing-adapter onboarding pattern, scoped to
   licensed states, never a live borrower-path API call (borrower income/zip must not egress).
   Gates: SOC 2 + signed data-processing agreement + permissible-purpose; §9 review if any
   borrower data flows outward. Watch the acronym collision (DPA) in the contract file.
2. **Acquire the Fannie authority corpus (founder):** the DU-adjacent documents
   `docs/fannie-mae/` lacks — the Selling Guide section governing positive rent-payment
   history, DU Release Notes, and the asset-verification-report spec — plus the Fannie
   technology-provider onboarding question. Until these land, §2's two DU rows cannot move;
   this is the same acquisition lane as the sovereign memo's F12 enrollment item.
3. **Truv F5 (founder):** proceed as W-2 VOIE procurement per NON_W2 §5.5; request the
   vendor's gig-platform payout-coverage evidence so the "nearly never" ruling is tested
   against data, not re-litigated by pitches.
4. **Freddie corpus (founder):** no `docs/freddie-mac/` exists; if Freddie routing matters to
   the roadmap, start the corpus the way `docs/fannie-mae/` was started (Form 91 first).
5. **Counsel — the roadmap-framing line:** where exactly the shipped educational gap analysis
   (readiness score, generic recommendations, no denial vocabulary) ends and an
   approval-likelihood representation under Reg N §1014.3(q) begins; includes review of the
   Leg B re-entry copy alongside the adverse-action notice (must not dilute the notice or
   imply reapplication outcomes).
6. **Counsel — CROA adjacency (question, not conclusion):** whether directive,
   tradeline-specific credit instructions to consumers ("pay exactly $420 toward your Capital
   One card") approach Credit Repair Organizations Act (15 U.S.C. §1679) or state-analogue
   territory, and whether the current generic score-band credit-recommendations surface stays
   clear. Requested as a boundary opinion before any future sharpening of borrower-facing
   credit guidance.

## 6. Binding restatements

- **New: adverse action is mandatory and unburiable** — no product may suppress, delay,
  disguise, or bury a required denial notice; "never deny" ideas land as post-notice re-entry,
  never notice avoidance (§2 final row; §4 Leg B renders the notice *more* reachable, not
  less).
- **No live qualifying figures or approval-likelihood representations to borrowers before
  human verification** (rate-com §2 C2/§6; `regn-guaranteed-approval` hardBlock) — held under
  adversarial pressure from the "$420" and "60 days away" framings; re-affirmed unchanged.
- **No underwriting policy from memory** (CLAUDE.md compliance-first) — exercised twice here:
  a missing authority doc means the mechanics cannot be adjudicated at all; only the
  procurement of the authority can be (DU rent history, HomeReady credit, Freddie 1099).
- **Appendix-A quarantine + Phase 0** (NON_W2 plan) — held against the 1099 program numbers;
  the §5.5 payroll-network ruling held against the Truv-for-gig premise.
- **No speculative schema** — held: no zip/county/AMI columns until the DPR reopen gate fires
  with a named consumer in the same program.
- **Illinois-only footprint (#201)** — held, and extended in practice: nationwide-*looking*
  surfaces must degrade honestly (Leg A's footprint framing), not rely on empty data to stay
  truthful.
- **Vendor doctrine + §9 sub-processor trigger** (golden rule 3; sovereign memo §6) — held
  against DPR-as-API, Finicity, and the Transactions-product expansion; table-fed data
  onboarding preferred wherever borrower data would otherwise egress.
