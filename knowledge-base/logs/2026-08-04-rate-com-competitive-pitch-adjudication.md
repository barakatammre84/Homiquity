# 2026-08-04 — External "Beat Rate.com on complex borrowers" pitch: adjudication

> **Dated snapshot** (Tier 4). Facts verified against the code on 2026-08-04; verdicts govern
> until a reopen gate below fires. Same protocol as
> [2026-07-17-external-agentic-mortgage-artifacts-evaluation.md](./2026-07-17-external-agentic-mortgage-artifacts-evaluation.md)
> and [2026-07-19-modular-architecture-pitch-adjudication.md](./2026-07-19-modular-architecture-pitch-adjudication.md):
> adopt nothing wholesale, verify every claim in code, extract what survives, record binding
> rejections with reopen conditions.

## 0. What arrived, and the ask

An external competitive brief positioning Homiquity against Rate.com (Guaranteed Rate) on
complex borrowers (self-employed, multi-entity investors, Non-QM, HNW). Its thesis: Rate.com's
W-2-optimized retail machine stalls on complex files (manual SAM queues, "stipulation hell",
generalist LOs, vague partner updates), and Homiquity should win with a four-pillar "tech
blueprint":

1. **Speed** — "instant OCR + SAM engine": 1040/1120-S/1065/K-1 parsing, Fannie 1084
   add-backs, 2-yr trending; a bank-statement deposit classifier with NAICS-specific expense
   ratios; "fully audited qualifying income before the borrower speaks to a human".
2. **Clarity** — a "no-black-box portal": interactive income-math dashboard, contextual
   line-level document requests, live underwriting milestone tracker ("Income Audit Complete",
   "CD Issued").
3. **Relationships** — a realtor "Pre-Approval Power Hub" (white-labeled, 24/7,
   property-specific letters) and a CPA "one-click" AT-C 205 attestation portal.
4. **Operations** — a "Multi-Lender Non-QM Liquidity Engine": API-driven matching across
   "50+ wholesale investor matrices" with program stacking ranked by rate and doc friction.

The founder-direction attached to the adjudication (user decision, 2026-08-04): the tech must
stand out as **broker tooling that ships fast approvals**; the client side shows **no live
math** — pre-decision surfaces are educational and frame the work as *searching for the
borrower's full purchasing power*.

## 1. Facts: the pitch largely describes our own shipped architecture

Every row verified in code this session, not from memory:

| Pitch claim | Repo reality |
|---|---|
| "Automated tax return parsing (1040, 1120-S, 1065, K-1)" | **Shipped.** 15-form extraction catalog (`shared/taxFormExtraction.ts`), Opus-tier multi-form classifier + per-instance field extraction behind the vendor adapter (`server/extractionTaxIntel.ts`), deterministic `EXTRACTION_SIMULATE` lane, entity resolution + tie-outs (`server/services/taxReconciliation.ts`). |
| "Fannie 1084 rules, add-backs (depreciation, depletion…)" | **Shipped.** `server/services/selfEmploymentIncome.ts`: Sch C, K-1 1065, K-1 1120-S lanes; Schedule-C and entity-level add-backs at ownership %, incl. the Sch L 17d short-term-obligations subtraction with roll-over waiver; Selling Guide citations in every result. |
| "2-year vs 1-year declining trends" | **Partial.** Two-year averaging with declining-trend guard shipped (declining → most-recent year + manual review; never averages a decline up). No 1-year qualification lane (S-08 Proposed); no Freddie Form 91. |
| "Instant… before the borrower even speaks to a human" | **Architecturally declined by design** — see §2. |
| "Bank statement deposit classifier, NAICS expense ratios" | **Gap is real, numbers are quarantined.** `income/paths/bankStatement.ts` computes from *staff-entered* eligible deposits (Angel Oak 50%/70% factors — the only cited numbers in-repo). No deposit classifier, no transfer/refund filtering, no NAICS ratio table, and no citable source for one. |
| "Interactive income dashboard / contextual doc requests / milestone tracker" | **Server side exists, borrower rendering missing.** The breakdown payloads (`shared/incomePaths.ts`, cited notes), the per-request "why" model (`SituationDocumentRequest {description, reason, taxYear, entityName}` on an already-owner-readable endpoint), and the pipeline/milestone payloads all exist; every income exposure is staff-gated and the "why" model has zero borrower UI. This is the one genuine extraction — see §4. |
| "Realtor pre-approval hub" | **Pre-adjudicated and rejected** — PARTNER_HUB_PROGRAM §5-C3 (letters are staff-decision-gated; a broker does not approve loans; Reg N 12 CFR 1014). |
| "CPA attestation portal (AT-C 205), one-click signatures" | **Rejected as pitched** — §5-C2 (inviter-only, IRC §7216) and RESPA §8 bar the model; and the premise is backwards: AICPA guidance advises CPAs *against* lender comfort letters — a portal does not cure the CPA's liability, it solicits it. The narrow survivable form is already scoped: NON_W2 plan §4.4 P&L-only attestation lane (quarantined, Appendix A.2). |
| "50+ wholesale investor matrices, ranked by rate" | **Exactly what the adopted plan quarantines.** NON_W2_TECH_OPTIMIZATION_PLAN Appendix A.1/A.2: external program numbers are targets, not rules, until each investor's citable program doc lands in `docs/lender-programs/` (today: Angel Oak only, 152 lines). Multi-lender fit additionally carries the B5 deferral (2026-07-12 log §2). Rate ranking is further blocked by PPE reality (F11 unbuilt; `SIMULATED_RATE_DATA = true`). |

**The competitive story this implies (PM note):** the "5-minute SAM engine" Rate.com lacks
*already exists here* — deliberately throttled by one human-confirmation step (MR-2) that is a
compliance feature, not a gap. The differentiation work is not building the engine; it is
making the engine's speed *visible* (staff already see it; borrowers see honest clarity), and
marketing should position Pillar-1 claims accordingly.

## 2. Point-by-point verdicts

| Recommendation | Verdict | Why (evidence) | Reopen gate |
|---|---|---|---|
| Instant pre-underwrite (no human touch) | ❌ **Rejected** | MR-2 (NON_W2 briefing §1) inserts borrower field-by-field confirmation between extraction and income math — `worksheetPrefill.ts` drafts are never persisted; an AI-extracted figure feeding a qualifying number unconfirmed collides with Reg B AI-isolation (#192 §4 binding). | None — doctrine, not a deferral. |
| Bank-statement deposit classifier | ⏸ **Deferred, not adopted from this pitch** | Real greenfield, but the adopted #238 sequencing governs (Phase 2 tie-outs + assetDepletion first). The pitch adds no new information. | #238's own roadmap reaches it; any program *numbers* still need Phase 0. |
| NAICS-specific expense ratios | ❌ **Rejected** | No-citation-no-implementation: zero citable source in-repo; the only cited factors are Angel Oak's flat 50%/70%. | A citable NAICS ratio source lands in `docs/lender-programs/` (Phase 0 mechanism). |
| Borrower income-math dashboard | ✅ **Adopt, post-decision only (C1)** | See §4. Live math (C2) rejected below. | — |
| Live qualifying math as documents land (C2) | ❌ **Rejected — binding** | Publishes a computed qualifying-income figure over unverified `requiresManualReview` data (MR-2 breach); a live "your qualifying income" number is a representation about ability to obtain credit (Reg N §1014.3(q) — the category `regn-guaranteed-approval` hard-blocks in prose); contradicts the standing capture-time decision (`SelfEmploymentIncomeWorksheet.tsx` never shows a computed figure). | None. The compliant remainder — process transparency without figures — is the adopted program's PR 3 + PR 6. |
| Contextual document requests + milestone tracker | ✅ **Adopt** | Converges existing owner-readable data into borrower UI; no new schema. §4. | — |
| Realtor 24/7 white-label letter hub | ❌ **Rejected (pre-adjudicated)** | §5-C3; Reg N; "guaranteed pre-approval cannot ship in any form" (2026-07-12 log §3). Surviving lane is already chartered: PH-3 → PH-4/PH-5 behind prelaunchGate + PPE. | None for partner-triggered issuance. |
| CPA AT-C 205 attestation portal | ❌ **Rejected as pitched** | §5-C2 (§7216 inviter-only), §5-C1/RESPA §8 (no referral economics), AICPA reality (comfort letters are what CPAs are told to refuse). | Phase 0 program doc for the P&L-only lane + counsel sign-off on the attestation template (NON_W2 §4.4 / Appendix A.2). |
| 50+ investor matrix engine, program stacking, rate ranking | ❌ **Rejected under standing quarantine** | #238 Appendix A.1/A.2; B5 deferral; PPE F11 unbuilt; §5-C4 bars rate figures in partner assets pre-F1. Substrate already exists for the day it reopens: `lookup_matrices` machinery, `income/orchestrator.ts` path envelopes, the wholesale status machine. No new schema until then. | Per investor: verbatim program doc in `docs/lender-programs/<investor>/` + regulatory-ledger entry (same commit) + a signed broker agreement moving the lender past `approvalStatus: "target"`. |

## 3. Defects found during verification (fixed in the hardening leg)

Adjudicating the pitch against the code surfaced four defects — none introduced by the pitch,
all fixed regardless of its verdicts:

1. **S-07 missing from `SCENARIO_CATALOG`** — implemented in code (mig 0037,
   `RENTAL_CONVERSION_OFFSET`) but absent from the catalog; its registry record sits under
   `## Backlog` while marked "Implemented", and the sync test scanned only the Implemented
   section, passing vacuously. → catalog entry + doc move + two strengthened contract tests.
2. **Licensed-state gate absent at letter issuance** — every `propertyState` write path is
   gated *today*, but the footprint gate landed 2026-07-17 and files exist since 06-01; a
   pre-gate non-IL file remains letter-eligible. → `unlicensedStateRejection` at both
   issuance routes (absent state still passes — TRID address-last).
3. **Three ungated, unconsumed lender-match surfaces** — `GET /api/intelligence/
   lender-matches[/top]` and `GET /api/optimizations/match-and-price` behind bare
   `isAuthenticated`, returning wholesale `lenderName` + uncited rate math the moment
   `lender_products` (admin CRUD exists; no seeder) gets a row. → staff-gated at the same
   boundary as `/api/admin/lender-products`; on B5 reopen, borrower exposure requires a
   redaction layer + citation-backed pricing (F11).
4. **Borrower payload over-exposures** — the pipeline endpoint returned raw condition rows
   incl. staff `clearanceNotes`; borrower-tasks returned staff `verificationNotes` (also
   mapped into the checklist's borrower-visible notes). → whitelist DTOs
   (`borrowerConditionView`, `borrowerTaskView`) in the Clarity program, field-absence
   test-pinned like `borrowerOfferView`.

## 4. Adopted program — "Borrower Clarity" (Pillar 2, converge-don't-duplicate)

Seven PRs, zero migrations; every figure shown to a borrower is staff-verified first:

- **PR 1–2**: document checklist carries `documentYear` + instructions to the borrower
  Documents page (and stops relaying `verificationNotes`).
- **PR 3**: "Why we need these" — renders the existing `SituationDocumentRequest` reasons
  (already owner-readable) on the Documents page; never income-path signals (Reg N).
- **PR 4–5**: the whitelist DTOs from §3.4 + wires the dormant `borrowerDisplayText` so
  borrower-visible staff tasks say something honest ("We're preparing your closing
  paperwork").
- **PR 6**: journey detail lines derived purely from already-authorized payloads (milestone
  timestamps, docs verified/in-review/needed, conditions cleared). Explicitly NOT
  "Income Audit Complete" (a human-verification claim — MR-2) and NOT "CD Issued"
  (`cdIssuedDate` has no writer; a milestone would be a lie).
- **PR 7**: income transparency, variant **C1 + educational pre-decision state** (the
  resolved user decision): post-decision (approved-grade status + decision-grade provenance,
  the same gate class as the letter the borrower can already download) the borrower sees the
  whitelisted breakdown — per-path monthly figures, add-back/deduction totals, Selling Guide
  citations, "not a commitment to lend" disclaimer. Pre-decision, the same card is
  educational: which income sources are under analysis, framed as *finding your full
  purchasing power* — no figures, no candidacy signals, copy linted by `lintOutboundText`.

## 5. Founder / counsel items

1. **§5-C3 wording amendment (founder sign-off, then docs-only PR):** borrower letter
   self-serve is deliberate and pre-dates the Partner Hub charter (`GenerateLetterButton`
   shipped in the initial commit); §5-C3 adjudicated *partner*-triggered issuance. Proposed
   wording: the *decision* (verified provenance + `pre_approved`) is staff-made; a partner
   can never trigger issuance; the borrower may render their own letter after the staff
   decision. Optional follow-up: attribute the deal-team LO on borrower-generated letters
   instead of `loanOfficerId = NULL` (SAFE Act hygiene).
2. **Counsel-review copy list:** the PR-7 post-decision disclaimer, the pre-decision
   educational copy ("find your full purchasing power" — service description, not outcome
   promise), and the `CMP_CLOSING_DISC` borrower display text — same review path the
   prediction disclaimer took.

## 6. Binding restatements

- **No live qualifying figures to borrowers before human verification** (§2, C2 row) — new
  binding rejection, same class as #192 §4.
- Appendix-A quarantine, §5-C1/C2/C3, no-speculative-schema, and the borrower
  wholesale-identity redaction doctrine all held under adversarial pressure from this pitch
  and are re-affirmed unchanged.
