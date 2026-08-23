# Homiquity — the build queue

**What this is:** every piece of work still open, one line each, in the order it should be done.
It is not a history. Prior generations of this file live whole in the archive:
[CTO_ROADMAP_2026-08-06.md](knowledge-base/archive/roadmap/CTO_ROADMAP_2026-08-06.md) (the 96 KB
closure-narrative purge) and
[CTO_ROADMAP_2026-08-23.md](knowledge-base/archive/roadmap/CTO_ROADMAP_2026-08-23.md) (the launch
queue this file replaces, with the corrections recorded in its banner).

**The driver (founder directive 2026-08-23, CHARTER §1a):** a fully functional, real-time
loan-producing system that delivers the final end product to three parties — the client (the
borrower), the broker, and the wholesale lender — with the Fannie Mae **Selling Guide** as the
golden handbook. The Guide is the base of this queue: the coverage map says *have we looked*
([SELLING_GUIDE_COVERAGE.md](knowledge-base/compliance/SELLING_GUIDE_COVERAGE.md) — B1–B7 are the
product backlog; Part C is the wholesale lender's function, A3-3-01), the conformance ledger says
*what did we find* ([SELLING_GUIDE_CONFORMANCE.md](knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md)
— its C-rows and G-rows), and this file says *what we will do*.

**The binding line:** business events — licensing, contracts, counsel, procurement, GTM, go-live —
never rank, pause, or gate an item in §0 or §2–§4. They live in §1, the founder's parallel lane,
and each one only flips a simulation live at its adapter seam. Two founder-retained exceptions,
named in CHARTER §1a: the referral-commission payout path (3.7 / 1.10) and the UAL halal lane
(P7) stay do-not-build pending counsel.

**Maintenance rules — binding. They are why this file is small.**

1. **One line per open item.** No closure narratives, no "slice 2 of 3" essays, no progress logs.
2. **Done = deleted here and appended to the archive ledger, in the same PR.** *How* it shipped
   belongs in the change ledger ([CICD.md](knowledge-base/runbooks/CICD.md)) and the PR — not here.
3. **No frozen status boxes.** A correction **edits the item**; it is never appended underneath one.
4. **Deploy, ops and compliance facts live in the runbooks.** Link; never restate.
5. **Verify before you check a box.** Six items in a prior generation were `[ ]` with bodies saying
   the work had landed, and two more asserted things the code contradicted.

**Detail lives elsewhere:** [ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md) (real vs
simulated vs pending) · [feature-review/FINDINGS.md](knowledge-base/feature-review/FINDINGS.md)
(verified defect register) · [CICD.md](knowledge-base/runbooks/CICD.md) (what shipped, when) ·
[BETA_GO_LIVE_READINESS.md](knowledge-base/runbooks/BETA_GO_LIVE_READINESS.md) (beta scope).
Item numbers are stable IDs — a completed item is deleted and its number is never reused; new
items continue each section's sequence.

---

## §0 Trunk health — engineering; the fleet stops if these lapse

A red trunk, a dead gate, or a routine that cannot be shown to have run outranks every feature
below — these are the *technical* blockers CHARTER §1a-2026-08-23 names as the only legitimate
ones.

- [ ] **KTLO-4. The required gate is BACK and binding — what remains is Railway's own coupling.**
  **Corrected 2026-08-23 against [#711](https://github.com/barakatammre84/Homiquity/pull/711),
  which withdrew this item's premise.** The claim that stood here until this edit —
  `required_status_checks.contexts: []`, "verification is voluntary", with a restore command —
  came from an 02:37Z probe and was already false by 17:41Z. Classic branch protection (not a
  ruleset) is live on `main`, proven **behaviourally**, which is the only way it can be proven:
  merging #708/#647 through the API returned verbatim
  `405 Required status check "gate (typecheck · tests · schema guard)" is expected`, and #647 went
  `behind` when `main` moved and merged only once brought current — so **`strict: true` is on too**.
  🚨 **Do not try to read this from the settings endpoint:** `…/branches/main/protection` returns
  403 to any non-admin token, which is exactly how this claim rotted in *both* directions (it also
  sat on a stale ✅ for weeks after protection was removed). Probe the behaviour — open a PR and
  read what the merge refuses. Two live consequences: renaming the `gate` job deadlocks every open
  PR (the check name is matched verbatim, U+00B7 MIDDLE DOTs — see the DO-NOT-RENAME warning in
  `.github/workflows/ci.yml`), and **every PR must be current with `main` to merge**, so a routine
  that lets its branch go stale has made work for itself. **What is still open:** Railway's
  `checkSuites: false` means the deploy hook itself never waits for CI, so anything reaching `main`
  by a path other than a gated PR merge still ships unverified. Decide whether that residue is
  worth closing (disconnect the Railway GitHub source and deploy on a tag/dispatch) or accept it
  and record the acceptance in [ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md).
- [ ] **3.24 A routine can fire and leave no artifact, and the suite reads that as "did not run"**
  (evening-triage 2026-08-18; recurred 2026-08-19 ×2 and 2026-08-22 ×3 — `primary-engineer`,
  Trunk Health and `workflow-completion-engine` all dispatched and left no report on any ref, and
  two more routines committed reports to **unpushed local branches**, the same outcome by another
  route). Two fixes, neither landed: (a) every routine writes a `STATUS: STARTED` stub to
  `reports/` at orient time so a crash leaves evidence; (b) **every routine pushes its report
  branch before it exits** — a report that exists only on the laptop is indistinguishable from a
  routine that never ran. Triage already compares `lastRunAt` against the report set.
- [ ] **3.15 Register `reg:watch:save` on a schedule — or delete it and declare Tier 2 human-only**
  (#526 E5). `data/regulatory/regulatory-watch-state.json` last ran **2026-07-04** while
  [REGULATORY_MONITORING.md](knowledge-base/compliance/REGULATORY_MONITORING.md) still calls the
  tier "automated, live". Cheapest honest fix: a weekly CI step + a `lastRun` age assertion in
  `pnpm checkup`. (The *Selling Guide* leg of this is now solved — the Selling Guide Steward
  watches editions/amendments/links daily; this row is the rest of Tier 2.)
- [ ] **3.16 Un-red `pnpm checkup`: record an accepted-risk its dependency check can read**
  (launch-gate LG-3). 1 low + 4 moderate advisories, all in `@modelcontextprotocol/sdk`'s HTTP
  transport, which `server/mcp/index.ts` never loads (stdio only). Bump the SDK when upstream
  patches; **no `pnpm.overrides`**. A permanently-red check is a dead check.

---

## §1 Founder lane — parallel; never ranks, pauses, or gates engineering

> Business work in this section is real and stays worked at its own cadence (CHARTER §1a: licensing
> lead time "runs in parallel with engineering and is therefore still worked"). But per the
> 2026-08-23 development-first directive, **nothing here ranks, pauses, or gates an item in §0 or
> §2–§4** — each row either unblocks a *live* wiring seam (§4) or is founder business in its own
> right. Ranking inside this section is the founder's.

- [ ] **1.1 Confirm the go-live flip that live probes say already happened.** Prod has served
  ungated public pages since 2026-08-06; re-probed 2026-08-17: `/` and `/api/rates` 200 with no
  prelaunch/waitlist markers. `PRELAUNCH_GATED` and `VITE_PRELAUNCH_GATED` still exist as names in
  Railway variables and values are unreadable from any session — open the panel, confirm both are
  `false`/removed, then archive this line. `BETA_ACCESS_CODE` is a separate front-door switch
  (currently unset — #526 E2).
- [ ] **1.2 Railway service variables — launch-critical still unset** (live read 2026-08-17,
  #526 E2): `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` (+ `PUBLIC_OBJECT_SEARCH_PATHS`) —
  durable uploads 503 `UPLOADS_UNCONFIGURED` until they land; `SENTRY_DSN` + an uptime monitor on
  `/api/health`; `GOOGLE_MAPS_API_KEY` — every production address lookup fails today;
  `RAPIDAPI_KEY` (or record staying on the simulated rate survey in ASSUMPTIONS.md). Also delete
  the stray lowercase `fromemail` beside the real `FROM_EMAIL`. ~45 min.
- [ ] **1.3 Wholesale-lender outreach — UNBLOCKED since 2026-07-13; still unworked (2026-08-17).**
  Live now: the UWM AE / Director-hotline call (sandbox process + whether BOLT exposes a
  PPE-consumable feed); the Newrez Brigade contact; Angel Oak / Newrez approval-checklist requests;
  a manual read of Plaza's wholesale-broker guide PDF for net-worth/bond minimums; and
  re-verifying all five are still broker-friendly and NMLS-active (the shortlist is a 2026-07-04
  snapshot). Detail:
  [wholesale-lender-shortlist](knowledge-base/research/my-research/wholesale-lender-shortlist-2026-07-04.md).
- [ ] **1.4 Start the F3 (credit vendor) and F6 (DU/LPA) applications now** — vendor paperwork lead
  time runs in parallel with everything else. Ask in the same first email: SOC 2 Type II + signed
  DPA + permissible-purpose / FCRA end-user certification package (F3); both the DU **and** LPA
  legs (F6).
- [ ] **1.5 Production reseed for #24** — grids rerun + BRC-J30 jumbo min `806500.01`.
  `seedMarketPricing` is skip-if-exists, so this is a destructive wipe-and-reseed.
  Founder-supervised.
- [ ] **1.6 Status-vocabulary data migration on prod.** Dry-run
  `npx tsx scripts/migrate-status-vocabulary.ts`, confirm whether it already ran, apply with
  `--apply` if not. Founder-supervised (production data write).
- [ ] **1.7 Counsel gates, aggregated** (detail:
  [BETA_GO_LIVE_READINESS.md](knowledge-base/runbooks/BETA_GO_LIVE_READINESS.md) §5): BUILD-1
  pre-license calculator deviation · PH-2 consent copy · the Reg N cite confirmations from #138 ·
  the UAL §5 halal-lane review · an ad-imagery / Fair Housing marketing policy — none exists ·
  ratification of [MODEL_RISK_GOVERNANCE.md](knowledge-base/governance/MODEL_RISK_GOVERNANCE.md),
  still marked DRAFT while two indexes cite it as authority · and (qa-sweep F-0819-04, counsel
  Ask 2): in a *brokered* transaction, is Homiquity the **creditor** whose federal administering
  agency belongs on an adverse-action notice (§1002.9(g))? The mechanical half is 3.30; the fix is
  written against your answer, not ahead of it.
- [ ] **1.8 Regulatory subscriptions + Fannie Developer Portal** (~30 min): Fannie Selling Guide
  notifications (email is the only Fannie channel), Freddie Guide bulletins, FHA INFO, VA lender
  news; register for the Developer Portal (public APIs free, business-partner APIs unlock with
  F6). See [REGULATORY_MONITORING.md](knowledge-base/compliance/REGULATORY_MONITORING.md). The
  Selling Guide half is now double-covered in-repo (the Steward's daily edition/amendment watch);
  the rest still has no channel.
- [ ] **1.9 Delete the dead `GEMINI_API_KEY` from local `.env`** — all AI is Anthropic; prod
  verified clean 2026-08-17. The same local `.env` also carries a dead `RAILWAY_API_TOKEN` and a
  dead `OPENAI_API_KEY` (#536 E8) — delete all three together.
- [ ] **1.10 Counsel: is the referral-commission payout permitted?** (a) **Reg Z §1026.36(d)(1)** —
  a *fixed* percentage of the amount of credit extended is permitted; `POST /api/broker/commissions`
  takes a percentage chosen per file by an admin, and `calculateAgentCommission` would pay 25% of a
  lender comp figure that varies by lender and product. (b) **RESPA §8** — the partner tables were
  built with no fee/commission columns by design, and `broker_commissions` is that column set on
  the same referral edge. Ledgered under `regz-1026-36d1-referral-commission-payout` (14-day
  interval). **No commission may be paid on a live file until this is answered, and 3.7 stays
  unbuilt until then — a founder-retained exception (CHARTER §1a).**
- [ ] **1.11 Set the four email-auth DNS records at Squarespace** (the 2026-08-17 vendor FAIL,
  #526 E1): SPF TXT on the apex, DMARC TXT at `_dmarc`, SendGrid's `s1`/`s2` DKIM CNAMEs on the
  apex. Until then every password reset, verification and waitlist email leaves unauthenticated
  and lands in spam while `/api/health` reports email fine. ~20 min.
- [ ] **1.12 Finish what the Reg Z capture opened.** The capture itself happened 2026-08-20 —
  `docs/reg-z/` holds 12 CFR 1026 + Supplement I, pinned, and three ledger entries are re-verified
  on 180-day intervals. Residue: (a) re-read the other eight flagged entries against the capture —
  F-076/F-079 severity resolution also needs 1.15; (b) FCRA 1681s-2 / Reg V / CROA sources are
  still uncaptured (different sources; the CDIA Metro 2 manual is licensed — procurement, not a
  fetch); (c) keep `CLAUDE.md`'s probe-before-claiming-blocked rail current.
- [ ] **1.13 One NMLS login session, four outcomes** (compliance-watch +
  [STATE_LADDER.md](knowledge-base/compliance-watch/STATE_LADDER.md)): (a) does an IL-licensed MLO
  with an approved sponsorship exist? (b) pull Consumer Access / MU1 / surety bond /
  financial-statement records; (c) download the IL checklists from the NMLS Resource Center
  (unreachable from sessions) and hand them to a session for `docs/nmls/`; (d) confirm the first
  MCR due date (computed: Q3-2026 RMLA due 2026-11-14; prep draft ready in
  `knowledge-base/compliance-watch/drafts/`) and calendar it. ~1 h.
- [ ] **1.14 Decide F-040's scope: the stored FCRA disclosure promises 120-day consent validity,
  but `credit_consents` has no expiry column and no gate checks age.** Strictest defensible
  reading (bind everything, force re-consent past 120 d) is the default absent an answer; the
  mechanism (expiry column + age gate, expand-only migration) is routine engineering once decided
  (PE-006).
- [ ] **1.15 Counsel: is the borrower Loan Options page a §1026.18 disclosure?** If it is, the
  §1026.22(a)(2) 1/8% APR tolerance is exceeded 4–7× and F-076 escalates P1 → P0. It gates how
  *fast* 3.18 must move, not whether it moves.
- [ ] **1.16 Railway — decide the decommission question against data; the service never stopped
  serving** (was KTLO-1; re-verified 2026-08-23T02:39Z: prod `commit` equals `origin/main`, so
  Railway has been building and deploying every merge throughout — the pause taken on the
  opposite premise let migration 0057 go unapplied and cost a 35-minute auth outage on
  2026-08-22; `migrate-prod`/`verify-deploy` were re-armed the same day by #669). The blocker is
  gone: CI is alive, so run the read-only prod-DB census, then decide take-down vs keep against
  row counts. Coupled: **KTLO-3** — Neon production compute is unpinned (cold starts measured
  5.5–7.4 s on the borrower funnel); pin/disable autosuspend or record the accepted number in
  [ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md), in the same billing conversation.
- [ ] **1.17 Actions is alive because the repo is public — resolve the payment so visibility stops
  being load-bearing, and decide whether public is acceptable at all** (was KTLO-2; re-probed
  2026-08-23T02:37Z: 8 consecutive green runs on `main`, 27 PRs merged in 24 h). The underlying
  payment failure has never been observed resolved, so flipping the repo private re-breaks every
  merge instantly (it did exactly that on 2026-08-19). Also owed by the public decision:
  `knowledge-base/feature-review/FINDINGS.md`, `governance/security/`, and ~19 MB of re-hosted
  Fannie/NMLS PDFs are world-readable, and secret scanning + push protection are disabled. Full
  provenance: archived KTLO-2 (2026-08-23 snapshot banner note 3). Its restore command is **done** —
  the required `gate` check is live again with `strict` on (KTLO-4), which is a second reason not to
  flip the repo private casually: a required check that cannot run blocks every PR in the repo.
- [ ] **1.18 Product decision: bind `/api/leads` or delete it** — headless partner-embed vs a
  Homiquity-hosted form; PartnerHub prompt PH-6 is chartered to resolve exactly this. The
  engineering follows in 3.4.
- [ ] **1.19 Founder call on 3.6's binding model** — (a) fold scenario-adjusted figures into
  `aggregateBorrowerFinancials` with explicit PRELIMINARY provenance, or (b) keep the engine on
  raw figures and make every `"blocking"` flag a real CTC-gating condition. 3.6 builds the shared
  halves either way; the call picks the branch.
- [ ] **1.20 Business decision: the agent-lead intake mechanism** (referral link / agent portal /
  manual code) so `leads.source` can distinguish agent-sourced borrowers — 3.8 implements
  whichever you pick.
- [ ] **1.21 Register `domain-oracle` on a recurring cron and click "Run now" once** (PR #654's
  open founder action — CHARTER §11: a definition on disk is not a routine). It is the daily
  Selling Guide *reading* seat — the conformance-ledger sweep and random section sampling that
  3.40's scrub rides on. The Selling Guide *Steward* (05:30 UTC) covers the corpus's integrity,
  not its readings; both seats are needed.
- [ ] **1.22 The §4 trigger board — start any of these anytime; none gates building.** F4 Plaid
  production keys · F5 Truv contract · F7 AVM contract · F11 pricing-engine contract · F12 IRS
  IVES enrolment + counsel sign-off on the consent flow · F13 a decision to pursue Down Payment
  Resource at all (then SOC 2 + DPA + permissible-purpose review) · F15 a decision to pursue a
  Freddie corpus (then Form 91 lands in a new docs/freddie-mac directory) · LS-10 a signed
  broker–lender agreement. Each row in §4 names what the trigger flips.

---

## §2 Engineering — the three-party delivery spine, ordered

The Selling Guide is the spine's authority: B1–B7 are the product backlog
([SELLING_GUIDE_COVERAGE.md](knowledge-base/compliance/SELLING_GUIDE_COVERAGE.md)), and every new
item below cites the conformance ledger row (G-…) or coverage row it closes. A Guide id in this
file is re-derived from `docs/fannie-mae/selling-guide/section-index.tsv`; a threshold read from a
table is unverified until the PDF page is open (tables flatten — TEAM_PRACTICES §10).

### The package as delivered (A3-4-02: complete, accurate, verifiable)

- [ ] **2.5 F-080 — the delivered package drops the co-borrower.** One `PARTY` is emitted for a
  two-borrower file while both employers and both incomes are emitted under it, so the package
  misstates who earns the income, under the wrong SSN — and it validates clean (`xmllint` passes,
  `validateULDDCompliance {"valid":true}`), which is why no gate catches it. Authority is in-repo:
  `docs/fannie-mae/uldd-implementation-guide.pdf` p.14 — the PARTY container repeats for multiple
  borrowers. Fix: one PARTY per `borrowerSequenceNumber`, employment filtered by sequence.
  **Sequencing constraint (qa-sweep ⛔4): ship this with or before F-052/F-053** — fixing those
  two alone would promote a materially false file into an immutable SHA-256-hashed lender
  submission.
- [ ] **2.2 Fix uploads end-to-end**, then run the acceptance test. The code half is done (memory
  storage, honest failure copy in #444); it is `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR`
  from 1.2 that makes it real. Uploads silently vanishing is the single worst borrower-facing
  failure available to us.
- [ ] **2.3 Run [PROD_ACCEPTANCE_TEST.md](knowledge-base/runbooks/PROD_ACCEPTANCE_TEST.md) end to
  end** once 1.1 and 1.2 land. See §5.
- [ ] **2.15 Build the lender persona surfaces — sanctioned build work as of 2026-08-23** (founder
  directive; the "never build a lender-facing surface without asking first" gate is lifted).
  Sim-first UI/API over the existing backend route families (rate sheets, rate-sheet products,
  lender pricing adjustments, lender offers, per-lender submission views), so the third party of
  the deliverable can see its package. Live portal transmission still swaps in at
  `submitToLenderPortal` when an agreement lands (§4 LS-10).

### B2 — eligibility

- [ ] **2.6 Multiple-financed-property limits + reserves** (conformance G-17; B2-2-03, B3-4.1-01 —
  the ledger calls it the highest-readiness gap on the page: no missing document, no new schema,
  only capture). Needs 2.8's REO capture; also unblocks B3-6-06. ⚠️ The B2-2-03 threshold facts
  are TABLE-VERIFIED in the coverage map's row — read it before coding; the June-2020 EarlyCheck
  workbook's `>6` conflicts with the Guide's DU-10 and that conflict is an escalation, not a pick.
- [ ] **2.7 Compute CLTV and HCLTV** (conformance G-21; B2-1.2-02/-03/-04). We actively market the
  thing that creates them — four seeded IHDA DPA programs, each a subordinate lien, one carrying a
  monthly payment no field records. Capture half is buildable now; the enforcement ceilings need
  the Eligibility Matrix (G-14 — a §1-lane procurement, deferred to 39 times by the Guide).

### B3 — underwriting the borrower

- [ ] **2.8 Real-estate-owned capture, and honest scoring until it lands** (conformance G-16).
  `scoreRealEstateOwned` asserts "Real estate ownership reviewed = yes" whenever `reo.length === 0`
  — an unknown rendered as a pass. Build the REO capture path; until it lands, score the absence
  as *not evaluated*, never as a pass.
- [ ] **2.9 ARM qualifying rate** (conformance G-12; B3-6-04 — the ledger: "the trap is already
  loaded", a 5/6 ARM is seeded while the engine qualifies every file at the note rate). With C-9's
  fix an ARM currently routes to human review; this implements the greater-of qualifying rule so
  ARMs decision honestly.
- [ ] **2.10 Representative credit score for multi-borrower files** (conformance G-15; B3-5.1-02).
  A 760 primary with a 600 co-borrower is priced and gated at 760 where the Guide requires the
  lowest representative score; the co-borrower's income counts while their score does not.
- [ ] **2.11 Income continuance capture** (conformance G-19; B3-3.1-01). `other_income_sources`
  has no expiration date — alimony ending in eighteen months and a lifetime pension are
  indistinguishable to the engine. Expand-only column + the three-year-continuance check.
- [ ] **2.12 Temporary buydown qualifying** (conformance G-13; B3-6-04). IL DPA programs already
  allow funds toward a rate buydown; nothing represents one or qualifies at the correct rate.
- [ ] **2.13 The four missing PITIA components** (conformance G-10; B3-6-03): flood insurance,
  ground rent, special assessments, subordinate-financing payments — capture + qualifying-PITIA
  wiring, same expand-only pattern C-6 used for association dues.
- [ ] **2.14 Medical-collections DTI treatment, built sim-first ahead of the credit feed** (split
  out of F3, which now only swaps the live feed): FHA 4000.1's 5%-of-balance rule above $2,000
  aggregate with medical excluded, plus the Fannie B3-5.3-09 payoff carve-out. No collections→DTI
  path exists today, so nothing computes wrongly yet; the day real reports arrive, FHA files
  compute DTI wrong in both directions without it. *(The "2026 federal Medical Debt DTI exclusion"
  does not exist — verified 2026-07-04; the CFPB Reg V rule was vacated 2025-07-11.)*

---

## §3 Engineering — correctness and quality across the platform, ordered

### Delivery follow-through

- [ ] **3.1 ULAD field-mapping audit + escalations E-1…E-4.** The MISMO structural work is
  finished; what remains is L6's second half: audit `shared/mismo.ts` against
  `docs/fannie-mae/schemas/ulad-mapping-document.xlsx`, and resolve E-1…E-4 (registered U-14…U-17
  in [FINDINGS.md](knowledge-base/feature-review/FINDINGS.md)) — the MISMO 3.0-vs-3.4 authority
  conflict, the URLA 5b-J/5b-L foreclosure-family ambiguity, the eight orphan concepts, the
  unproven `OTHER` wrapper convention. F-023/U-4 stays open on the ULAD leg.
- [ ] **3.3 Internal data-lineage view for masked lender identity.** Borrower surfaces mask the
  wholesale lender by doctrine (`shared/borrowerOfferView.ts`); compliance and staff need the
  unmasked lineage somewhere.
- [ ] **3.22 Workflow 3's QA script cannot see the defect class it exists to catch** (qa-sweep
  D-014, P1). Run as scripted it catches 3 of 9 registered Domain 8 findings and misses the P0 —
  every step-3 assertion is a schema assertion, and these defects are schema-valid falsehoods. Add
  an **"emitted == stored"** leg before re-running it, or the next sweep re-certifies the same
  package.

### B3 underwriting correctness (question A on the decision path)

- [ ] **3.6 Close the advisory-vs-binding gap.** S-05/S-06/S-07 rental offsets now reach
  `UnderwritingInput`, but `preUwFlags` is read by neither `decisionEngine.ts` nor
  `underwritingEngine.ts` — S-01 income seasoning, S-03 sleeper debt and S-04 large deposits
  remain advisory-only, and `scenarioCatalog.ts` marking them `implemented` overstates it. Build
  the shared halves now (verify `checkPipelineProgress` actually enforces blocking flags; make the
  catalog honest); 1.19 picks the binding branch.
- [ ] **3.18 The borrower-facing APR is not an APR** (qa-sweep F-076, P1). `loanAnalysis.ts:138`
  computes a flat spread; it understates by 0.45–0.94pp whenever MI is in force, and on the
  `points: 1` scenario the borrower pays a $3,600 discount point and the displayed APR moves
  0.000pp. The repo asserts the correct invariant in four places and the marketing surface already
  does it right. Fix: route through `calculateMortgageAPR`, pin with a test asserting
  `loan_options.apr` came from the solver. Severity depends on 1.15.
- [ ] **3.19 One loan, three different MI figures** (qa-sweep F-077 + F-087, P1). The LE's MI and
  the engine's DTI both come from a hardcoded card exceeding the `CONVENTIONAL_PMI` matrix in all
  32 swept cells (1.42–2.17×); `resolvedPmiMonthlyPremium` is grep-proven never read. One borrower
  can see $239.20, $184.00 and $429.33 for the same loan. Fix: delete `calculatePMI`, use the
  `pmiAnnualRate` `derivePricing` already resolves, correct the false docstring at
  `loanCosts.ts:594-599`.
- [ ] **3.20 The public credit-tier calculator is flat** (qa-sweep F-078, P1 — live in production).
  `GET /api/calculators/credit-tiers` spans 0.025pp across the entire FICO range where the
  intended spread is 0.625pp; two `/100` conversion sites. Borrower-adverse on a public surface.
- [ ] **3.32 One client, three affordability answers, ending in a congratulation 46% above the
  first** (journey-walk 2026-08-22, J-0822-01). A W-2 buyer at $145k/$500/$50k is quoted $415–455k
  by the Landing estimator, $391–460k in the funnel, then "pre-approved for $607,000" on
  `/loan-options` — a maximum qualifying price at the 43% DTI cap labeled a pre-approved amount,
  with four different rate assumptions across the surfaces. Fixes in order: (a) label the $607,000
  correctly and name the DTI cap; (b) `FunnelChrome.tsx:105-107` — render PITI at the client's
  target price or say which price it describes; (c) reconcile the four rate assumptions onto one
  source or state the rate per surface. Owner: Primary Engineer.

### ECOA / HMDA / disclosure correctness

- [ ] **3.21 TRID is computed into the void, and the badge lies in the safe direction** (qa-sweep
  F-079 + ux-30, P1). `mismoValidation.ts:766-820` computes `tridStatus{leDueDate, leIssued}` and
  nothing in `client/src` reads it; 173 of 176 files render an affirmative green "TRID Compliant"
  badge derived from a null due date. Fix: give the borrower a gated route to their own LE, split
  the badge into "delivered on X" vs "within window", rank the intake pool by `leDueDate`. The
  badge half rode #546 (went `CONFLICTING` — needs rebase); the LE route and ranking remain.
- [ ] **3.25 The denial chokepoint fails open, and a green test pins it that way** (qa-sweep
  F-0819-01, P1). `ensureAdverseActionForDenial` de-dupes with no `actionType`, so any
  pre-existing notice of any type satisfies it — a file can reach `denied` with zero denial
  notices and no audit entry. Fix: scope the de-dup by `actionType`, re-fixture
  `tests/adverseActionFcraChokepoint.test.ts:225-233` (12/12 green over the bug). Owner: Backend
  Data Engineer (§6b).
- [ ] **3.26 A co-applicant's protected-class record can be overwritten with the primary's answers,
  and the co-borrower is never asked at all** (qa-sweep F-0819-02, P1).
  `server/routes/underwriting/compliance.ts:1310-1312`/`:1348-1350` both `LIMIT 1` with no
  `ORDER BY` and no `borrowerSequenceNumber` key; `server/routes/dashboard.ts:118-121` measures
  HMDA completeness by row presence. Fix: key GET+POST by `borrowerSequenceNumber`, per-borrower
  completeness, the missing unique constraint (expand-only, same-PR migration). Never match by
  array position. Owner: Backend Data Engineer (§6b).
- [ ] **3.27 The §1002.9(a)(1)(i) 30-day clock is not computable — there is no
  completed-application timestamp** (qa-sweep F-0819-05, P1). Two sites anchor the deadline on the
  wrong event; the platform records no "application became complete" moment, so the fix needs a
  column, not a formula. 🚨 Do not backfill a guessed value onto a compliance/provenance column —
  a NULL is an honest gap, a wrong value is a falsified record. Owner: Backend Data Engineer
  (§6b).
- [ ] **3.30 Adverse-action notices name the wrong federal agency** (qa-sweep F-0819-04, P2 —
  mechanical half of 1.7's counsel question). Every notice names the CFPB; Reg B Appendix A item 9
  assigns the FTC to a non-depository originator. Derive the agency from
  `shared/companyIdentity.ts` — the entity to name is counsel's call (1.7), so build the
  derivation and leave the value configurable.
- [ ] **3.34 A required-disclosures to-do that can never be cleared** (journey-walk 2026-08-22,
  J-0822-04). `dashboard.ts:306` requires three consent types; two have no active
  `consent_templates` row, so "Sign Required Disclosures" stands forever and the action-item count
  disagrees with `/e-consent`'s own Pending count. Require only types a live template can satisfy
  (unit test pins the invariant); make the count and the page read one list. Owner: Workflow
  Completion Engine.
- [ ] **3.35 Two disclosure surfaces throw away the server's honest explanation** (journey-walk
  2026-08-22, J-0822-06 + F-061). The server returns a 409 naming the missing pricing-setup step
  and a 422 naming the verify-first reason; `LoanEstimate.tsx:160-176` and
  `LoanLetterButton.tsx:96-98` both render "Please try again". Owner: Feature Completion Engine.
- [ ] **3.36 Self-reported debts attributed to a credit check that never ran** (journey-walk
  2026-08-22, J-0822-05). `ApplicationSummary.tsx:164` hard-codes "From your soft credit check"
  on files with no `credit_pulls` row. Derive the note from the figure's real provenance
  (`shared/dataProvenance.ts` — the three real states, no fourth enum). FCRA-flagged, not ruled.
  Owner: Feature Completion Engine.

### Client experience (question B)

- [ ] **3.9 VA funnel.** The engine already routes `isVeteran` → VA products (580 FICO / 100% LTV
  seeded). Missing: COE check, funding-fee calculation incl. exemptions, residual-income table,
  IRRRL flow.
- [ ] **3.10 Real-time messaging transport** — presence dots are decorative (no WebSocket). Wire
  it to something real or remove it; removing it is a legitimate answer.
- [ ] **3.28 Every write on the Homeowner Hub returns 500** (qa-sweep F-0819-03, P1).
  `server/routes/guaranteesHomeowner.ts` — nine live probes; `DashboardView.tsx:50-51` mounts the
  two broken sections for every profile. Fix: validate `POST /api/homeowner/profile` through
  `insertHomeownerProfileSchema`, supply `snapshotDate` + the two rates server-side.
- [ ] **3.33 The `aspiring_owner → active_buyer` promotion never reaches the navigation**
  (journey-walk 2026-08-22, J-0822-02). The role flips server-side on funnel submit; the sidebar
  keeps offering "Get Pre-Approved" on the client's own pre-approval page until a full reload.
  One-line fix with a named acceptance test: invalidate `["/api/auth/user"]` in
  `PreApproval.tsx:204-207`'s `onSuccess`. Owner: Capture Path Engineer.
- [ ] **3.37 `/apply` promises a *verified pre-approval letter in about 3 minutes* and the product
  correctly refuses to issue one** (journey-walk 2026-08-22, J-0822-01e). What it issues is a
  pre-qualification letter; the defect is the promise, not the engine. Founder call on which side
  moves (copy vs positioning), then a one-line copy change. Related and separable: ux-51 (five
  sub-44px controls in the Landing estimator's compact branch) and ux-52 (`/signup` links to
  neither Terms nor Privacy Policy).
- [ ] **3.5 NMLS state-routing gate** — the assignment engine must refuse to route an application
  in a regulated state to an unlicensed LO. Buildable now that F1 has cleared.
- [ ] **3.11 LO/staff assignment engine** — respects 3.5. Build it now against the seeded staff
  seats (deterministic routing rules, honest empty-state); live routing populates when humans
  exist to route to.

### Programs, money paths, and the registers

- [ ] **3.7 Optimization-engine dispositions:** wire `matchAndPriceBorrower` /
  `getCoachPreFillData` to a surface or delete them; fire `calculateAgentCommission` from the
  funded-loan transition rather than a schedule. **Blocked on 1.10 — a founder-retained exception
  (CHARTER §1a): wiring this fires a payout whose Reg Z / RESPA posture is unanswered.** When
  unblocked, the wiring must write through `evaluateCommissionPayout` (`shared/commissionPayout.ts`)
  the way `POST /api/broker/commissions` does.
- [ ] **3.4 Bind `/api/leads` to something — or delete it.** No caller anywhere in `client/src`.
  1.18 picks the product shape; this row implements whichever lands.
- [ ] **3.8 Tag agent-sourced inbound leads.** `leads.source` has no value for an agent-referred
  borrower, so the playbook's 30%-agent-sourced gate is structurally unmeasurable. 1.20 picks the
  intake mechanism; this row implements it.
- [ ] **3.12 Program next-prompts** (charters in [`specs/`](knowledge-base/specs/)): **UAL P7**
  halal-lane channel gates (two founder calls + the spec-§5 counsel review; funder-agnostic math
  only until then — a founder-retained exception, CHARTER §1a) · **LO-3** client-facing Advisor
  Report (its LO-2 dependency merged) · **PH-3** partner-asset compliance guard + co-branded
  education engine.
- [ ] **3.14 Recognize platform fee income** (audit F-22 — unblocked 2026-08-08: recognize ON
  RECEIPT). Snapshot the schedule charged at LE issuance, record collection at settlement beside
  `compensation_received_at`, surface charged-vs-collected variance the way lender short-pay is
  surfaced. Today the revenue line counts only the lender remittance while our own $500 + $1,500
  fees are recognized nowhere.
- [ ] **3.17 Adjudicate the 13-commit orphan `claude/lucid-edison-br5hsb`** (rescue-draft #542):
  +1,543/−72 including five compliance behavior-test suites and server fixes. Its F-042 slice is
  superseded by #537; the precondition (#537) merged 2026-08-18, so this is actionable: rebase,
  drop the superseded slice, land what's green — or close explicitly.
- [ ] **3.23 Make `/api/health` honest about identity** (residue of the killed 5002 orphan):
  decide whether a `/api/health` without a `commit` field should be a startup error — the deploy
  rail's entire proof is that field, and an orphan that cannot be dated from the outside cost
  three routine runs.
- [ ] **3.31 `feature-review/FINDINGS.md` overstates its own backlog** (qa-sweep D-0819-04;
  re-measured 2026-08-22: **18 rows** whose status cells say FIXED sit under `## Open findings` —
  the drift grew from ten while the item sat; open P0 reads 3 when it is 0, against 255 open / 36
  closed rows). Move them to `## Closed` in one pass. Owner: QA Sweep (it owns that register).
- [ ] **3.38 `docs/fannie-mae/README.md` tells every session the PDFs are readable, and they are
  not** (doc-accuracy DA-0822-03, proposed — `docs/**` needs founder authorization). The
  documented path fails with `pdftoppm is not installed`; `pypdf` and `pymupdf` are installed and
  work. Replacement wording is written out in the 2026-08-22 doc-accuracy report (rides PR #658).
  One file, ~8 lines.
- [ ] **3.39 Dead paths in two registers this file points at** (doc-accuracy DA-0822-04/-05).
  `FINDINGS.md` cites a `server/routes/lending.ts` (now a directory), an absent
  loanDeliveryReadiness test file, and an absent docs/hmda directory; this roadmap formerly cited
  docs/freddie-mac, which does not exist (now unbackticked in 1.22/F15 so the ratchet counts one
  reporter). Prevention half: fold a `deadRepoPaths` metric into `scripts/doc-staleness-guard.cjs`
  reusing its noise filters. Owner: engineering.
- [ ] **3.40 Scrub the 325 unreviewed Selling Guide sections — the standing Guide workstream.**
  The coverage map holds 423 citable sections, 98 reviewed. The **Domain Oracle seat** (1.21)
  sweeps and samples — randomly as well as by suspicion, the D1-1-01 shape its charter adopted —
  and proposes items; **Evening Triage lands them** into §2/§3 (its exclusive write authority,
  CHARTER §4). Every minted item cites its coverage/conformance row; the one-line rule is the size
  control that keeps this file from regrowing into the 96 KB failure mode.

---

## §4 Live-wiring seams — build sim-first NOW; a trigger only flips sim → live

Every seam below is **sanctioned build work today**: adapter, schema, UI and tests are built
against the deterministic simulation, and the named trigger (§1.22 board) swaps the live leg in
behind the same interface. Nothing in this section means "do not start" — that framing was
withdrawn 2026-08-23 (CHARTER §1a). The two counsel exceptions live in 1.10/3.7 and 3.12, not
here.

- [ ] **F3 — credit vendor** (CRS One / iSoftpull). *Trigger: signed contract (application: 1.4).*
  Swaps the real adapter into `server/mcp/vendors.ts` (it throws today if a key is set). The
  medical-collections DTI engine is 2.14 — buildable now, not gated on this.
- [ ] **F4 — Plaid production keys.** *Trigger: keys issued.* Real Link + asset reports through
  the existing webhook.
- [ ] **F5 — Truv contract.** *Trigger: signed contract.* Real VOIE into `verification_reports`.
- [ ] **F6 — GSE AUS access (Fannie DU + Freddie LPA).** *Trigger: credentials (application:
  1.4).* Submit to both engines at once (decided 2026-07-04) for best fit and rep-and-warranty
  relief; the sim already preserves the exact seams, and `submitToLPA` deliberately throws if a
  real key is set so a live key can never silently produce fake findings.
- [ ] **F7 — AVM contract** (HouseCanary or other). *Trigger: signed contract.* Real valuations
  via `retrieve_property_valuation`.
- [ ] **F11 — Pricing engine (Lender Price and/or Mortech).** *Trigger: signed contract.* The
  MISMO transfer middleware may be built sim-first; the internal rate-sheet + LLPA engine stays
  the clearly-marked simulation behind the same interface.
- [ ] **F12 — IRS IVES transcript access (4506-C → A2A).** *Trigger: founder IRS e-Services +
  IVES enrolment **and** counsel sign-off on the consent flow and FTI handling (1.22).* The
  consent-flow design, schema and simulated adapter may be built sim-first like every other seam —
  the prior "no schema, code, or env var" bar is withdrawn (2026-08-23); **no real taxpayer data
  and no live IRS wiring before both trigger legs.**
- [ ] **F13 — Down Payment Resource feed.** *Trigger: 1.22's pursue-it-at-all decision + SOC 2 +
  signed DPA + permissible-purpose review.* Table-fed import only, scoped to `LICENSED_STATES`;
  borrower income/ZIP must never egress.
- [ ] **F14 — rent-history-to-DU adjudication.** *The Selling Guide leg of the old trigger is
  satisfied* — B3-2-02 and B3-2-03 resolve in the committed section index (corpus landed
  2026-08-20), so the adjudication is startable now. *Remaining trigger for the live leg: the DU
  Release Notes and the asset-verification-report spec land in `docs/fannie-mae/`* (procurement,
  §1.22-shaped).
- [ ] **F15 — Freddie Mac corpus.** *Trigger: founder decision + Form 91 lands in a new
  docs/freddie-mac directory (1.22).* Until then every "Freddie program" claim is locally
  unverifiable and LPA stays a simulation leg.
- [ ] **LS-10 slice 3 — real per-lender portal hand-off.** *Trigger: a signed broker–lender
  agreement (1.3/1.22).* Slices 1 and 2 shipped (status machine; MISMO package assembly +
  immutable snapshot + sha256), and the lender-persona surfaces over them are 2.15 — sanctioned
  now. `submitToLenderPortal` stays the single deterministic seam until the agreement flips it.
- [ ] **OPT-2 — stale-application re-engagement email.** *Trigger: an email consent + unsubscribe
  path, plus a §9 security review — engineering prerequisites and a correctness rail, not
  business events; build them, then schedule it.* Quiet hours (#24) and the SMS STOP ledger (#25)
  already shipped; `sendReEngagementEmails` lacks consent and unsubscribe on the email leg only.

---

## §5 Go-live day (deferred)

Go-live is a founder decision downstream of *built* (CHARTER §1a: prove-it-first). When it is
taken up: do not improvise it. The checklist is
**[runbooks/PROD_ACCEPTANCE_TEST.md](knowledge-base/runbooks/PROD_ACCEPTANCE_TEST.md)** — run it
top to bottom against `https://www.homiquity.com` (the `www` is load-bearing; the apex is a
Squarespace forward), check every ⛔ BLOCKER, and paste the result into the change ledger.

Its §0 preconditions are the ones people skip, and both have burned us: prove the deploy is
current **by `commit`, not by a green check** — a failed Railway build leaves the previous
container serving — and prove the app is talking to the **right database** by hitting a
data-backed route, because `/api/health` returns 200 from the wrong one.
