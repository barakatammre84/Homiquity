# External strategy adjudication — 2026-07-12

> Dated, immutable snapshot (TEAM_PRACTICES §2). Never rewritten; supersession goes in a banner here.
> Authority: adjudicates external claims against **code** per the KB precedence rule ("code wins
> over any doc on a stale fact" — [L1 §7](../L1_VISION_AND_SCOPE.md)). Verdicts below cite code, not docs.

Two external strategy inputs arrived on 2026-07-12 and were adjudicated line-by-line against the
repository (three read-only exploration passes, file:line evidence throughout):

1. a **four-point critique of [L1_VISION_AND_SCOPE.md](../L1_VISION_AND_SCOPE.md)** (PPE gap, AUS
   blindspot, wholesale last-mile friction, CAC catch-22);
2. a **broker ops-bottleneck memo** ("How Homiquity Can Win") naming five operational bottlenecks
   and three architecture directives.

House precedent: external drafts get processed with binding corrections, the chartered/adjudicated
version wins (cf. [PARTNER_HUB_PROGRAM.md](../specs/PARTNER_HUB_PROGRAM.md) §5).

## 1. Critique verdicts

| # | Claim | Verdict | Evidence (code) | Action |
|---|---|---|---|---|
| 1 | No live PPE — displayed rates and the "deterministic pre-approval read" are guesses; Reg-Z risk | **CONFIRMED fact, known & tracked; risk framing overstated** | Only quotable source = `1.0-demo` sheets + internal LLPA (`server/seedMarketPricing.ts:31`, `server/pricing.ts:45`, `server/services/pricingAdapter.ts`; `SIMULATED_RATE_DATA = true` in `scenarioSimulator.ts:63`). Mitigations already enforced: pre-license gate on rate APIs (`server/routes/admin.ts:431-463`), `PRESALES_DISCLAIMER` on all calculators (`shared/dataProvenance.ts:56`), letters disclaim any rate guarantee (`server/routes/lending.ts:1721-1724`), Reg Z trigger-term hard-block (`shared/compliance/loCommsLint.ts`), verified-data 422 guard (`lending.ts:1691-1700`) | None now — real PPE = roadmap **F11** (Lender Price + Mortech, decided 2026-07-04; Optimal Blue evaluated and passed on), business-blocked |
| 2 | Core loop has **no AUS pre-flight** | **Premise REFUTED — but it exposed a real gate defect** | Dual DU + simulated LPA exists and runs both legs in parallel (`server/services/ausSubmission.ts:154,:224`; `server/routes/aus.ts:220-223`; "Run DU / LPA" in `SubmissionReadinessDialog.tsx`). Defect: L1 §2 mandates the AUS stage gate submission, but `brokerSubmissionReadiness.ts` stage 2 only *warned* with no AUS run — a zero-AUS file passed `readyToSubmitToLender` | **Fixed in this log's PR** (branch `claude/aus-gate-adjudication`): no-AUS-run → stage-2 blocker; refer/ineligible → warning (L1 routes ambiguity to humans) |
| 3 | Wholesale lenders force proprietary-portal uploads; "automated delivery" collapses to manual staff work | **CONFIRMED — and already candid everywhere except L1's own wording** | `submitToLenderPortal()` is the declared single simulation seam (`server/services/lenderSubmission.ts:11-15,70-77`); staff download endpoints exist for the portal hand-off (`server/routes/underwriting.ts:975-990`); no doc/UI string overclaims automation; LS-10 slice 3 open, blocked on broker agreements (`CTO_ROADMAP.md`) | L1 §2 Delivery bullet amended in this log's PR to state the hand-off boundary |
| 4 | Top-of-funnel was deferred past the cut-line → zero organic distribution at launch | **REFUTED — misreading of the L1 §3 table** | Buying Power + SEO sit in the **IN-for-MVP** column and shipped (PR #61/#63; roadmap G2/G2b DONE); SEO stack live (bot pre-render + JSON-LD + DB sitemap, PR #91; `vercel.json:16-26`, `server/routes/seo.ts`); 9 calculators + hub, 4 persona LPs, education engine, DPA wizard, partner/CPA/agent referral surfaces all in `client/src/App.tsx`. Kernel of truth: while `BETA_ACCESS_CODE` is armed, `middleware.ts:116-124` serves `Disallow: /` — a deliberate launch-sequencing gate tied to F1 licensure, not a missing feature set | None — L1 §3 note clarified only where the misread was invited ("Rate Sheets") |

## 2. Broker-bottleneck map (memo input 2)

| Bottleneck | State in repo | Gap → action |
|---|---|---|
| B1 swivel-chair double entry | **Built internally** — single flow: consented URLA → deterministic read → MISMO 3.4 package, one system | Outbound hand-off stays manual until broker agreements (LS-10 slice 3, tracked) |
| B2 "garbage-in" submissions | **Mostly built** — pre-UW flag engine incl. large-deposit sourcing per Fannie B3-4.3-04 (`server/services/preUnderwriting.ts:255`), reserves/seasoning/DTI flags, smart per-borrower-type checklist auto-generating conditions (`server/pipelineEngine.ts:231,:279`) | AUS-gate defect fixed (this PR); live deposit data waits on Plaid (F4); deposit-eligibility scrubbing deliberately manual (`server/services/income/paths/bankStatement.ts:17-20`) |
| B3 condition ping-pong | **Half built** — internal per-condition tracker + clearance UI + borrower doc-chase loop (tasks + email) exist; **lender-issued conditions are a single status + free-text note** (`lenderSubmission.ts:225-257`) | **Approved build: lender-condition tracker** — decompose lender conditions into `loanConditions` rows linked to `lender_submissions`, reusing clearance + doc-chase (own PR, migration) |
| B4 TRID squeeze | **Built by design** — address-last **and** SSN-last funnel (`client/src/funnel/preApprovalMachine.ts:51-69` — ≤4 of 6 pieces at pre-approval), six-piece engine as sole idempotent trigger writer + overdue-LE hard stop (`server/services/trid.ts:44-190`) | **Approved build: COC → revised-LE workflow** — reason set per 12 CFR §1026.19(e)(3)(iv), 3-business-day redisclosure tracking per §1026.19(e)(4)(i) (own PR, migration); fee-tolerance cure stays manual review pending counsel |
| B5 guideline matching / calculator fatigue | **Effectively missing for submissions** — lender pick is a manual dropdown of the Target-5; `lenderMatchingEngine.ts` exists but is unseeded/disconnected; the `nonQm` flags shape income packaging only. Structural note: **three unjoined lender catalogs** (hardcoded Target-5 in `shared/wholesaleLenders.ts`, DB `wholesaleLenders` pricing table in `shared/schema/lending.ts`, `lenderProducts` in `shared/schema/intelligence.ts`) | Deferred by decision — see register below |

## 3. Binding correction to the memo (chartered version wins)

- The memo's *"issue a **guaranteed** pre-approval"* **cannot ship in any form.** Reg N bars
  representations that a consumer is "guaranteed" approval; the repo already hard-blocks this
  class of statement with no override (`shared/compliance/loCommsLint.ts:157-174`, 12 CFR
  §1014.3(q); enforced server-side, `server/routes/borrower.ts:2807-2828`). The *mechanic* the
  memo wants (verify deeply before the TRID clock starts) is already shipped as the address-last
  funnel; the framing stays **"pre-approval read / letter — no rate or approval guarantee,"**
  consistent with the UDAAP predictive-insights disclaimer (`shared/dataProvenance.ts:64-76`).

## 4. Actions

1. **This log's PR** (`claude/aus-gate-adjudication`): AUS-gate enforcement + tests; L1 §2
   delivery-seam sentence; L1 §3 "Rate Sheets" disambiguation; roadmap F6 dual-AUS wording; this log.
2. **Lender-condition tracker PR** (next): per-condition tracking for wholesale-lender conditions.
3. **COC revised-LE PR** (after): change-of-circumstance record + redisclosure deadline tracking +
   submission blocker on overdue revised LE; counsel-review row for the tolerance posture.

## 5. Deliberately unbuilt (business-blocked or deferred — tracked, not drift)

- **F11** real PPE (Lender Price / Mortech) — demo sheets + LLPA stay the clearly-marked sim.
- **F6** real DU/LPA access; **F3/F4/F5/F7** vendor contracts — simulations behind adapters.
- **LS-10 slice 3** direct lender-portal integration — blocked on broker agreements.
- **Lender-fit recommendations** (B5) — deferred by decision 2026-07-12; prerequisite noted:
  unify the three lender catalogs before wiring fit scoring into the submission dialog.
- **Fee-tolerance cure engine** — COC workflow ships with a manual-review lane; counsel item.
- Non-selected memo extract: non-QM fit hints in the submission dialog (folded into the B5 deferral).
