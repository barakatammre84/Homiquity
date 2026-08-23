# LO Advisor Program — Charter & Build Prompts (L3 program spec)

**Status:** in flight — **LO-1 merged (#133)**, **LO-2 merged (#114**, migration `0020`), **LO-5 merged (#124)**; **next: LO-3 Advisor Report** (deps satisfied); LO-4 + LO-6 open · **Owner:** Amr (founder/PM) · **Roadmap:** tracked in CTO_ROADMAP "Active program tracks"; extends the LO Command Center line (PR #33 → Rate-Lock Desk PR #99) and consumes the UAL income engine (#108, merged) · **Last updated:** 2026-07-12

> This is a *program* spec: six sequenced build prompts, each of which becomes its own
> one-page L3 spec (copy [`_TEMPLATE.md`](_TEMPLATE.md)) when a team member claims it. It
> executes under [L1](../L1_VISION_AND_SCOPE.md) + [L2](../L2_COMPLIANCE_AND_LOGIC.md); where
> this doc and L2 disagree, L2 wins.

## 1. Business Intent

When a borrower asks their loan officer "what if I put 5% more down?", the industry-standard
answer is *"let me run some numbers and get back to you."* That callback is where deals die —
the borrower hangs up, rate-shops, and a competing LO with a faster screen wins the file. Our
LO must answer **on the call**: qualified or not, payment, cash-to-close, APR, and the honest
trade-offs — in seconds, from engines that are deterministic and cited, not from a rate sheet
taped to a monitor.

This program turns the LO Command Center from a pipeline list into an **advisory cockpit**.
It is also a recruiting asset: the LO-partner GTM pitch ("No-Stall Guarantee", power-originator
recruiting via velocity proof) needs a demo-able cockpit that makes a top producer's current
tooling look slow. Two audiences, one build: our LOs advise better; prospective LO partners
see why they should move their book here.

**The grounding doctrine (binds every prompt below):** this program is mostly *wiring, not
greenfield*. The engines already exist — pricing ([`server/services/pricingAdapter.ts`](../../server/services/pricingAdapter.ts)),
qualification (`server/underwritingEngine.ts` + the UAL income orchestrator, PR #108), APR
([`server/services/apr.ts`](../../server/services/apr.ts), the Appendix J solver), LE cost
structure ([`server/services/loanEstimate.ts`](../../server/services/loanEstimate.ts)), the
prioritized attention feed ([`server/services/signalEngine.ts`](../../server/services/signalEngine.ts)),
comms rails (`emailService`, `smsCompliance`, `quietHours`), and fair-lending machinery
(`fairLendingAnalysis`). A prompt that proposes a new engine where one exists is wrong by
default; see §4 for the full built-vs-missing map.

## 2. Serves L1 loop

- **Core-loop link:** borrower → **pre-approval** → MISMO package → wholesale delivery. The
  cockpit strengthens the pre-approval link (right product, right path, first pass — LO-2's
  simulator reads the UAL orchestrator's income, so the number quoted on the phone is the
  number underwriting sees) and pull-through (LO-4's signals rescue stalling files before
  they die). LO-3's client report is the borrower-facing face of "certainty and speed."
- **Cut-line check:** the LO is the highest-leverage human in the loop; equipping them is
  loop work, not peripheral work. The roadmap's trunk-health and delivery-spine queue (CTO_ROADMAP.md §0–§2) remains the standing priority; no prompt
  below preempts it. LO-3 (borrower-facing delivery) renders behind the pre-launch gate (I9) —
  building it is never gated; consumer-reaching activation waits on the go-live flip (F1
  licensure itself cleared 2026-07-13).

## 3. Bound by L2 (the guardrails every prompt obeys)

| L2 invariant | How this program satisfies it |
|---|---|
| **I1 — AI never decides** | The simulator (LO-2) composes only the existing deterministic engines; no model output anywhere in scenario math. The comms lint (LO-5) is a deterministic lexicon, **not** an NLP classifier — same inputs, same warnings, testable. Proactive signals (LO-4) are derived state projections, not model recommendations. |
| **I2 — No citation, no regulated-math change** | The regulated behaviors this program implements — the §1026.36(e)(2)–(3) anti-steering option set (LO-2), the §1026.19(e)(2)(ii) pre-LE written-estimate disclaimer (LO-3), the §1026.24 trigger-term lexicon and Reg N (12 CFR Part 1014) promise-phrase lexicon (LO-5) — each land with a `data/regulatory/regulatory-ledger.json` citation to the verified eCFR text **in the same commit**. The cites in this charter are planning references; implementation verifies against eCFR first, per the no-citation-no-implementation rule. |
| **I4 — PII through the vault** | The cockpit (LO-1) renders last4/masked values by default; any full reveal goes through the existing audited staff-reveal path. `scenario_runs` (LO-2) stores derived financials and engine inputs, never SSN/account numbers. |
| **I5 — TRID timing is exact** | The Advisor Report (LO-3) is **not** a Loan Estimate and must not look like one; it carries the §1026.19(e)(2)(ii) statement verbatim. Nothing in this program collects or assembles the six §1026.2(a)(3) application pieces outside the existing application flow, so no prompt moves the LE clock. APR shown anywhere comes from `apr.ts` (Appendix J), never a flat spread. |
| **I7 — Outbound messaging is TCPA-gated** | Every SMS leg (doc nudges, report delivery) passes `evaluateOutboundSms` (STOP ledger + quiet hours). Note open finding **F-008** (SMS webhook signature verification) — any prompt that turns SMS on inherits it as a blocker. |
| **I8 — Fair lending is monitored** | LO-5 routes presentation-pattern review through the existing `fairLendingAnalysis` / HMDA machinery as a compliance-dashboard report. Explicitly **no** per-message protected-class inference and no prohibited-basis variable (or proxy) anywhere in signals or simulator inputs. |
| **I9 — the pre-launch gate covers solicitation** | Everything LO-facing is internal staff tooling. The single borrower-facing surface (LO-3 delivery) ships behind the pre-launch gate (`server/services/prelaunchGate.ts` pattern) and activates at the go-live flip (F1 licensure itself cleared 2026-07-13; the gate's live condition is the un-flipped posture plus the open advertising-content review). It also inherits the open calculator-suite counsel-review item (see §7). |
| **I10 — Simulations never ground a real decision** | Rate sheets are simulated until the PPE contract (Lender Price + Mortech). Every simulator output, re-price signal, and client report renders the simulated-data provenance honestly; the `simulated` flag discipline carries through `scenario_runs` and into any report footer. |

- **Security-review trigger?** Yes — LO-1 (staff role gates + PII display), LO-3 (borrower-facing
  delivery + outbound messaging), LO-5 (outbound messaging paths). Each such PR runs
  `/security-review` before merge (L2 §4); unresolved CRITICALs block.
- **Regulated math?** Yes — LO-2 (anti-steering option-set selection), LO-3 (disclaimer/disclosure
  content), LO-5 (trigger-term lexicon), LO-6 (lock extension economics from cited rate-sheet
  adjustment tables). Ledger citations in the same commit, per I2.

## 4. What already exists (build on it, don't rebuild it)

Recorded so no prompt reinvents an engine. **Code wins over this table on any stale fact.**

| Capability | Where it lives today | State |
|---|---|---|
| Pipeline queue + Rate-Lock Desk | [`client/src/pages/staff/LoCommandCenter.tsx`](../../client/src/pages/staff/LoCommandCenter.tsx) (PR #33, #99) | Live — superseded by the LO-1 three-pane rewrite (#133) |
| Prioritized "who needs attention" feed | [`server/services/signalEngine.ts`](../../server/services/signalEngine.ts) | Built; **not wired into the cockpit** |
| Borrower 360 | [`client/src/pages/staff/BorrowerFile.tsx`](../../client/src/pages/staff/BorrowerFile.tsx) + PR #108 Tax Intel tab / SituationProfile / review workbench | Built (#108 merged 2026-07-11) |
| Multi-lender pricing w/ LLPA, lock-term, fees, eligibility | [`server/services/pricingAdapter.ts`](../../server/services/pricingAdapter.ts) + rate-sheets routes + `PricingMatrices.tsx` | Built; simulated sheets (I10) |
| Multi-path qualifying income | UAL orchestrator + `income_path_evaluations` (PR #108) | Merged 2026-07-11 — dependency satisfied |
| APR (Appendix J) / LE cost structure / TRID clocks | [`server/services/apr.ts`](../../server/services/apr.ts), [`loanEstimate.ts`](../../server/services/loanEstimate.ts), [`trid.ts`](../../server/services/trid.ts) | Built |
| Pre-approval letters / PDF generation | [`server/services/pdfLetterGenerator.ts`](../../server/services/pdfLetterGenerator.ts), `PreApproval.tsx` | Built |
| Rate-lock expiry alerts (cron) | [`server/services/rateLockAlerts.ts`](../../server/services/rateLockAlerts.ts) (PR #99) | Live |
| Close-probability + optimization + competitor rates | `predictiveEngine.ts`, `optimizationEngine.ts`, `competitorRateService.ts` | Built |
| Messaging, email, SMS compliance, notifications | borrower message thread, `emailService.ts`, `smsCompliance.ts` + `quietHours.ts`, `notifications` table | Built |
| Activity digest (call-prep substrate) | [`server/services/activitySummary.ts`](../../server/services/activitySummary.ts) | Built |
| LO action scripts per underwriting scenario | [`server/services/scenarioCatalog.ts`](../../server/services/scenarioCatalog.ts) `loanOfficerActions` | Built; cited content |
| Fair-lending analysis | [`server/services/fairLendingAnalysis.ts`](../../server/services/fairLendingAnalysis.ts) + HMDA ingest | Built |

**The one genuinely new engine:** an interactive what-if scenario service (LO-2). Nothing
composes pricing + qualification + cash-to-close into a live sandbox today.

## 5. What this program is NOT (the cut list)

An external AI strategy draft (2026-07-11) proposed pieces that are deliberately **cut**.
Record them so nobody rebuilds them by accident; each lists its reopen gate:

| Cut | Why | Reopens only if |
|---|---|---|
| RFQ marketplace / capital order book / "bidding war" lock terminal | Order book is on the UAL cut list (taking/steering fund capital ≠ brokerage); PPE strategy is lean Lender Price + Mortech, not a capital-markets terminal | Founder decision + licensing/counsel — not on any current horizon |
| Monte Carlo lock-or-float simulator | Violates platform determinism; no rate-distribution data; probabilistic rate advice is a liability surface | A real analytics mandate w/ counsel sign-off; replaced meanwhile by LO-6's deterministic extend-vs-relock table |
| Halal product sliders (Musharaka equity %, rent-rate inputs) in the simulator | P7 founder calls are HARD GATES; broker-triage firewall — Homiquity holds no title/SPV/certification | P7 gates clear (funder program confirmed) — then a P7-scoped spec, not a slider bolt-on |
| "Sharia compliance board" alerts / de-purification NAICS scanning | We have no board and must never imply certification authority — the funder's Shariah board owns that lane | The funder contractually delegates it — unlikely |
| Bureau trigger-lead "competitor pulled credit" alerts | Requires an FCRA trigger-lead contract that doesn't exist; simulated trigger data would be theater | Signed bureau contract (founder procurement); build adapter-shaped then |
| NLP statement validator on LO free text | Non-deterministic compliance is untestable compliance (I1 spirit) | Never for the enforcement path; a model may someday *suggest*, the lexicon decides |
| Per-message fair-lending surveillance of LO chats | Protected-class inference per message is itself a fair-lending and privacy hazard | AI_GOVERNANCE_POLICY version change + counsel; I8 machinery covers the need |
| Video calls / co-browsing / calendar integration | Real vendor contracts (founder procurement) + large surface; LOs have phones | Vendor contract signed; then a scoped comms spec |
| WebSockets for cockpit "real-time" | TanStack Query polling is the repo pattern and is fast enough for pipeline-cadence data | A measured latency need polling cannot meet |
| LO compensation display in the simulator | §1026.36(d) steering hazard — comp must never be visible next to product choices | Never |

## 6. The build prompts

Recommended order: **LO-2 → LO-1 → LO-5 → LO-3 → LO-4 → LO-6.** The simulator is the
centerpiece and everything client-facing hangs off its audit trail; the lint is cheap
protection wanted before any new outbound surface; LO-3 waits on the lender-masking fix and
the licensing gate; LO-4's best signals need the #108 income engine (merged 2026-07-11).

### LO-0 — Program framing (directive to: everyone)

We are not building dashboards. We are building the answer to one question, asked live on a
phone call: *"given everything the platform already knows about this borrower, what is the
best honest answer to what they just asked — right now?"* Every prompt below either shortens
the time from question to cited answer, or protects the LO while they give it. If a feature
does neither, it doesn't belong in this program.

### LO-1 — Cockpit consolidation (directive to: engineering — wiring, not greenfield)

Rebuild `LoCommandCenter.tsx` as a three-pane cockpit:

- **Left — attention rail:** the existing pipeline queue plus the `signalEngine` feed (already
  computed, currently unwired here), rendered in priority order with one-click deep links.
- **Center — active borrower:** on click, load the `BorrowerFile` data queries in place —
  income paths and worksheets from the UAL orchestrator, document checklist with confidence
  scores, open conditions, message thread. No navigation away.
- **Right — actions:** pre-approval letter (existing generator), open simulator (LO-2),
  request lock (existing `RateLockDialog`), and a **Call Prep** button rendering
  `activitySummary` + open signals + next conditions as a one-screen digest.

Constraints: TanStack Query polling per repo convention (no WebSockets — cut list); PII
masked by default, full reveal only via the existing audited path (I4); role gates mirror the
server (`isInternalStaffRole`); PageShell conventions; mobile-responsive (an LO at a kitchen
table gets the full cockpit).

**Done when:** an LO answers "where does this file stand and what do I do next" from one
screen with zero navigation, verified live on :5002. DoD per `TEAM_PRACTICES.md` §5.
Security review: yes (role gates, PII display).

### LO-2 — Deterministic What-If Scenario Simulator (directive to: engineering — THE NEW BUILD)

New `server/services/scenarioSimulator.ts` composing engines that already exist — in order:
`pricingAdapter.computeOffers` → `underwritingEngine` qualification (income comes from the
UAL orchestrator's persisted evaluation, **never re-derived** in the simulator) → `apr.ts` →
cash-to-close from the `loanEstimate` cost structure. One endpoint, deterministic (I1),
target <500 ms measured; a pre-computed down-payment grid (5–25%) is a v2 optimization only
if measured latency demands it.

- **Inputs:** purchase price, down payment ($ or %), product, occupancy, property type,
  FICO what-if (hypothetical only — never triggers a pull, I6).
- **Products:** only what the rate-sheet catalog serves (conventional / FHA / VA / non-QM as
  configured). **No halal lane until P7 gates clear** (cut list). DSCR scenarios display the
  ratio only — no pass/fail threshold until the founder obtains the AE matrix (UAL P4 rule).
- **Anti-steering as a feature:** every result set includes the §1026.36(e)(2)–(3)
  safe-harbor options — lowest rate; lowest total points/fees; lowest rate without risky
  features — regardless of what the LO adjusted, with the ledger citation landing in the
  same commit (I2). LO compensation appears nowhere (cut list).
- **Audit substrate:** every run persists to an immutable `scenario_runs` table —
  hand-authored migration, number claimed at build time after PR #108 lands (0014–0019 are
  claimed; expect 0020+) — recording inputs, outputs, engine versions, rate-sheet version,
  `simulated` provenance flag (I10), and the LO's user id. LO-3 and LO-5 hang off this table.

**Done when:** an LO on a phone call changes down payment and reads qualified-or-not,
payment, cash-to-close, and APR in under 2 seconds; the run is in `scenario_runs`; unit
tests pin determinism (same inputs → byte-identical outputs) and the safe-harbor set's
presence. DoD per §5.

### LO-3 — Client-facing Advisor Report (directive to: engineering + compliance)

One-click share of a simulator scenario set as a read-only borrower page + PDF (reuse
`pdfLetterGenerator` and the LoanEstimate page patterns). Hard rules:

- **Lender identity masked** to neutral product-tier labels ("Option A — 30-Year Fixed
  Conventional") — server-side, not JSX-side. Depends on the in-flight masking fix
  (spawned task `task_fc63d240`: `LoanOptions.tsx` renders `lenderName`,
  `BorrowerDealComparison.tsx` hardcodes UWM/Rocket/PennyMac/loanDepot, both on borrower
  routes) — borrower-transparency doctrine.
- **Numbers populated only from a persisted `scenario_runs` row** — never LO-editable.
- **Not a Loan Estimate:** carries the §1026.19(e)(2)(ii) statement verbatim (exact text
  verified against eCFR at implementation, ledger-cited, I2/I5), plus NMLS # and disclosures
  injected from `shared/companyIdentity.ts`.
- **LO free-text** passes the LO-5 lint before send; delivery through the existing message
  thread and `emailService`; any SMS leg through `evaluateOutboundSms` (I7, note F-008).
- **Versioned, immutable, audit-logged**; simulated-data provenance rendered honestly (I10).
- **Gate:** ships behind the pre-launch gate; activates at the go-live flip (I9). Inherits the
  calculator-suite counsel-review item (§7).

**Done when:** LO clicks share on a scenario set → borrower receives a masked, disclaimed,
immutable report; a changed scenario produces a new version, never an edit. Security
review: yes (borrower-facing delivery + outbound messaging).

### LO-4 — Proactive advisory signals (directive to: engineering — extend `signalEngine`, don't fork it)

Three new signal producers feeding the existing prioritized feed:

1. **Re-price sweep:** nightly job re-runs `pricingAdapter` across the active pipeline
   against each file's quoted/locked rate; emits "current sheet saves $X/mo" signals.
   Rate data is simulated until the PPE contract — signals carry the `simulated` provenance
   and are labeled as such in the cockpit (I10). Build adapter-shaped so the PPE contract
   swap is a config change.
2. **Path-shift events:** when the UAL orchestrator changes a file's best income path
   (non-QM ↔ agency) on new documents, emit a signal with the qualifying-income delta.
   `income_path_evaluations` already computes the comparison — this is an event emitter,
   not new math.
3. **Income-optimization deltas:** surface the already-computed multi-path spread ("the
   bank-statement path yields $1,200/mo more qualifying income") with the citation the
   orchestrator carries.

Rate-lock expiry alerts already exist (PR #99 cron) — do not duplicate. Every signal gets a
one-click deep link into the cockpit and an audit entry. Cut per §5: bureau trigger-leads,
NAICS scanning.

**Done when:** each producer has a unit test emitting from fixture state; signals render in
LO-1's rail with working deep links; no duplicate of an existing signal type.

### LO-5 — Deterministic compliance rails for LO communications (directive to: engineering + compliance)

New `shared/compliance/loCommsLint.ts` — a deterministic lexicon, two tiers:

- **Tier 1 — trigger terms** (Reg Z §1026.24: down-payment %, payment amounts, rate figures
  in outbound text): auto-append the required disclosure block, or route the LO to the LO-3
  report instead of free-texting numbers. Lexicon + disclosure text ledger-cited (I2).
- **Tier 2 — promise phrases** (Reg N, 12 CFR Part 1014: "guaranteed", "approval assured",
  "lowest rate"): warn-not-block with a compliant rewrite suggestion; every warning and
  override logged.

Wire into the message composer and email paths. **Script library:** project
`scenarioCatalog`'s existing `loanOfficerActions` into insertable, pre-approved snippets —
the content is already written and cited. **Fair lending:** presentation-pattern review
routes through the existing `fairLendingAnalysis`/HMDA machinery as a compliance-dashboard
report; explicitly no per-message protected-class inference (I8, cut list).

Cheap, early, independent — no migrations. **Done when:** the lexicon has table-driven unit
tests (phrase in → expected tier/action out); a trigger-term send without disclosure is
impossible through platform paths; warnings appear in the audit log. Security review: yes
(outbound messaging).

### LO-6 — Lock desk completion (directive to: engineering — small)

Two additions to the shipped Rate-Lock Desk:

1. **Deterministic extend-vs-relock economics:** a cost table computed from the lock-term
   adjustments already priced in the rate sheets ("extend 15 days: +0.125; relock at current
   sheet: rate X") — replacing the cut Monte Carlo idea. Math sourced from the same cited
   adjustment tables `pricingAdapter` reads (I2).
2. **LE data package on lock:** wire the existing `loanEstimate.ts` + `trid.ts` so locking
   produces the LE data package for delivery — respecting the TRID clock rules already
   encoded there (I5); this wires existing services, it does not reimplement timing.

Expiry alerts and the scoped expiring route already exist — touch neither. **Done when:**
extend-vs-relock renders in the desk from fixture sheets with pinned-math tests; locking a
fixture loan yields a complete LE data structure that round-trips the existing `trid.ts`
validations.

## 7. Sequencing, dependencies, risks & escalations

**Dependencies (hard):**
- **PR #108 (UAL income engine) merges first** — *satisfied 2026-07-11 (merged).* LO-1 embeds its
  surfaces; LO-2 reads its orchestrator; LO-4's best signals are its events. Migration numbers:
  0014–0019 claimed by #108; LO-2 claimed `0020`; next free number per the cross-program ledger —
  re-check at PR time.
- **Lender-masking fix** — *satisfied 2026-07-11 (merged as #120, `shared/borrowerOfferView.ts`
  whitelist mapper — reuse it for any borrower-facing offer surface).* Was the LO-3 blocker;
  LO-3's remaining activation gate is the go-live flip (I9; licensure cleared 2026-07-13).
- **PPE contract** (Lender Price + Mortech — founder) converts LO-2/LO-4 from simulated to
  live rate data; until then I10's `simulated` discipline applies everywhere.

**Escalations (name them now, don't decide them silently — L2 §3):**
- **Counsel:** LO-3 inherits the open calculator-suite charter-deviation item (priced,
  borrower-facing outputs on a pre-license surface — counsel sign-off before F1). The
  §1026.19(e)(2)(ii) disclaimer text and §1026.36(e) option-set logic are implemented only
  from verified eCFR text with ledger citations — if the implementer cannot verify, stop.
- **F-008:** SMS webhook signature verification is an open finding; any prompt that turns on
  an SMS leg inherits it as a merge blocker.
- **Fair-lending report scope (LO-5):** what the compliance dashboard aggregates (product
  presentation by outcome, not by inferred demographics) gets compliance-officer sign-off on
  the report definition before build.
- **Halal lane:** any pressure to add halal products to the simulator before P7 gates clear
  escalates to the founder — the cut is deliberate.

**House rules throughout:** hand-authored migration SQL, never `db:push` from a worktree,
PRs only, security-review triggers per L2 §4, DoD per `TEAM_PRACTICES.md` §5.
