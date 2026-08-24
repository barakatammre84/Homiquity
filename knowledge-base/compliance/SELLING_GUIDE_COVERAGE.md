# Selling Guide coverage map

> **Freshness:** last verified 2026-08-21 · review every 30 days

**Generated — do not hand-edit.** Run `pnpm coverage:sg` after editing
[`knowledge-base/compliance/selling-guide-coverage.json`](selling-guide-coverage.json). The section rows come from
`docs/fannie-mae/selling-guide/section-index.tsv` (edition 08-05-2026); the status file
carries only judgements, so this map cannot invent or omit a section.

This is the **standing map of all 423 citable sections**.
[`knowledge-base/compliance/SELLING_GUIDE_CONFORMANCE.md`](SELLING_GUIDE_CONFORMANCE.md) is the companion: the deep record
of rules actually read and checked. Coverage says *have we looked*; conformance says *what did we
find*. Deliberate overlays we run stricter than the Guide live in
[`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json).

## Where we stand

**98 of 423 sections have been looked at (23%).**
The rest are `unreviewed` — not a backlog someone forgot, but the honest measure of how much of
the book has never been checked against this codebase. Domain Oracle works this map down daily,
sampling **randomly as well as by suspicion**, because a queue worked only by what someone already
worried about measures nothing about the rest (D1-1-01).

| Status | Sections | Meaning |
|---|---:|---|
| ✅ implemented | 11 | A rule in the Guide is enforced by code on the decision path, named in `evidence`. |
| 🟡 partial | 12 | Computed or partially encoded, but not binding on the decision, or missing a documented leg. |
| ❌ absent | 7 | The Guide states a rule that binds us and no code implements it. |
| ➖ n/a | 68 | The section governs a function Homiquity does not perform as a broker. Reason required. |
| · unreviewed | 325 | Nobody has looked. The default. |

## By part

| Part | Sections | Reviewed | ✅ | 🟡 | ❌ | ➖ |
|---|---:|---:|---:|---:|---:|---:|
| Part A — Doing Business with Fannie Mae | 41 | 8 | 0 | 3 | 0 | 5 |
| Part B — Origination Through Closing | 287 | 44 | 11 | 8 | 7 | 18 |
| Part C — Selling, Securitizing, Delivering | 48 | 41 | 0 | 0 | 0 | 41 |
| Part D — Quality Control | 11 | 5 | 0 | 1 | 0 | 4 |
| Part E — Quick Reference | 36 | 0 | 0 | 0 | 0 | 0 |

### What binds a broker

Homiquity is a broker — a **third-party originator** in the Guide's vocabulary (A3-3-01), keyed off
`shared/businessChannel.ts`. **B1–B7 are the product backlog**: the wholesale lender underwrites to
them, so a file that fails them is a file kicked back. The `➖` rows are functions we do not
perform, and each one carries its reason — *not applicable* is a finding, not a gap. Part D binds
the lender; we adopt its shape for our own quality program **by choice**, and say so.

## Reviewed sections

| Section | Title | Status | Evidence |
|---|---|---|---|
| `A2-2-04` | Limited Waiver and Enforcement Relief of Representations and Warranties | 🟡 partial | The DU limited waiver's data-accuracy condition is why F-0818-11 was a warranty problem and not a cosmetic one. Partial because the waiver presumes a real DU casefile and ours is simulated; AutomatedUnderwritingCaseIdentifier is deliberately not emitted rather than assert the simulator's sim-du-<sha1> as a real case id (F-068). |
| `A3-3-01` | Outsourcing of Mortgage Processing and Third-Party Originations | 🟡 partial | No TPO-oversight model in code. This section DEFINES our position: a broker is a third-party originator, and the seller must satisfy itself we produce quality loans. It is the reason the authority gate exists (TEAM_PRACTICES §10). |
| `A3-4-02` | Data Quality and Integrity | 🟡 partial | Data Quality and Integrity — the keystone: data must be "complete and accurate", all DU data "verifiable", with "adequate procedures in place to validate the integrity of specific data for each underwriting recommendation"; inaccuracy is life-of-loan under A2-2-07. SWEPT 2026-08-21 for the defect class it forbids — a stored value discarded for a compile-time constant in the delivered package. Results: F-051 (AUS recommendation) already fixed in #545; F-053 (LoanAmortizationType) was live and is fixed here; LoanManualUnderwritingIndicator "false" is ACCURATE (no manual-UW path exists in either engine); CountryCode/PartyRoleType/TaxpayerIdentifierType/ContactPointRoleType/DataVersion are legitimate per-context constants. 🚨 COUPLED TRAP: BorrowerClassificationType is the literal "Primary" (server/mismo.ts:400) and is correct ONLY because buildPartyNode is called exactly once — the DTO has no co-borrower concept. Whoever fixes F-080 must make it Primary/Secondary keyed off borrowerSequenceNumber, which is the only valid discriminator; array position is not. Still `partial` overall: no single control proves every DU-submitted field is verifiable. |
| `B1-1-01` | Contents of the Application Package | 🟡 partial | Application package documentation. The delivered MISMO package carries ONE borrower — buildPartyNode (server/mismo.ts:1300) and buildBorrowerNode (:755) are each called once and the DTO has no co-borrower concept, so a co-borrower is dropped entirely and their employment is attributed to the primary. Registered as FINDINGS F-080 (P1) and CTO_ROADMAP 2.5; structural, not a literal swap. Verified open 2026-08-21. |
| `B2-1.2-01` | Loan-to-Value (LTV) Ratios | ✅ implemented | server/underwritingEngine.ts:381 resolves the CONVENTIONAL_MAX_LTV matrix on the decision path. |
| `B2-1.4-01` | Fixed-Rate Loans | ✅ implemented | Fixed-Rate Loans — the default product; delivered as LoanAmortizationType Fixed via mapAmortizationType (server/mismo.ts), which now asserts the platform default only when the field is unset rather than overriding a stored value. |
| `B2-1.4-02` | Adjustable-Rate Mortgages (ARMs) | 🟡 partial | Adjustable-Rate Mortgages. The rate sheet seeds a 5/6 ARM (server/seedMarketPricing.ts) and the URLA captures amortizationType (server/routes/borrower/urla.ts), but server/mismo.ts DELIVERED every file as fixed-rate — the compile-time literal "Fixed" (F-053). Fixed 2026-08-21: mapAmortizationType reads the stored value, enum verified against the committed MISMO_3_0.xsd, unmapped values throw. Still partial: no ARM-specific underwriting (qualifying rate, caps, index/margin) exists — only the delivery element is now honest. |
| `B2-2-03` | Multiple Financed Properties for the Same Borrower | ❌ absent | TABLE-VERIFIED against PDF p.245: principal residence non-HomeReady = no limit; principal residence HomeReady = 2; second home/investment = DU-10; high-LTV refi exempt (B5-7-01). STATUS CHANGED partial -> absent on 2026-08-24: the only code that scoped this (Loan Delivery edit 6439, in the delivery-edit mirror) was REMOVED with the GSE-delivery stack, so nothing implements it now. The prior gap was the THRESHOLD (>6 from a June-2020 EarlyCheck workbook vs B2-2-03's DU-10 effective 11/05/2025) plus the unenforced HomeReady limit of 2; that Guide-vs-job-aid conflict is now moot here (escalations U-23/U-24 marked moot in FINDINGS). If multiple-financed-property limits bind our own pre-qualification read, they must be implemented in the decision path, not in a delivery mirror. |
| `B3-2-01` | General Information on DU | 🟡 partial | The lender must ensure delivery data matches the final DU submission and that the casefile receives an eligible recommendation. The delivered recommendation is now honest — server/mismo.ts maps the recorded AUS value via mapAusRecommendation and OMITS the whole AUTOMATED_UNDERWRITINGS container when there is none (F-051 fixed in #545; the compile-time "Approve" literal is gone). Still partial because submitToDU is a deterministic simulation: there is no real casefile, so 'matches the final DU submission' cannot yet be satisfied end to end (blocked on F6). |
| `B3-2-02` | DU Validation Service | ❌ absent | DU validation service / Day 1 Certainty relief is parsed in ausSubmission.ts but the asset-verification-report spec is not procured, so the validation legs cannot be adjudicated. Also carries the Asset Verification Report policy that CTO_ROADMAP F14 needs. |
| `B3-2-03` | Risk Factors Evaluated by DU | ❌ absent | Carries the positive rent-history policy DU uses (12-month third-party AVR or credit report; one borrower renting >=12 months at >=$300/mo). Nothing consumes it. This is the Selling Guide leg of CTO_ROADMAP F14, now unblocked; the DU Release Notes and AVR spec legs remain absent. |
| `B3-3.5-01` | Underwriting Factors and Documentation for a Self-Employed Borrower | ✅ implemented | Length of Self-Employment. server/services/selfEmploymentIncome.ts via server/services/income/paths/selfEmployment.ts, on the decision path through the income orchestrator. Seasoning assessed in underwritingNuance.ts assessIncomeSeasoning. |
| `B3-3.7-01` | Analyzing Partnership Returns for a Partnership or LLC | ✅ implemented | Partnership (Form 1065) cash-flow add-backs and subtractions x ownership share, in server/services/selfEmploymentIncome.ts, reached via the income orchestrator. |
| `B3-3.7-02` | Analyzing Returns for an S Corporation | ✅ implemented | S-corporation (1120-S) cash flow; owner W-2 counted in addition to the K-1 share. server/services/selfEmploymentIncome.ts via the income orchestrator. |
| `B3-3.8-01` | Rental Income | ✅ implemented | server/services/income/paths/rental.ts, reached on the decision path via computeIncomePaths (server/services/decisionEngine.ts:17 imports ./income/orchestrator). 75% of gross rent net of each property's PITIA. The most-cited section in the tree: 40 sites. |
| `B3-4.1-01` | Minimum Reserve Requirements | 🟡 partial | server/services/preUnderwriting.ts:204 requiredReserveMonths, reached in production ONLY via runPreUnderwriting (dynamic import at server/routes/aus.ts:115 and server/services/loanAnalysis.ts:580). The resulting flags are read by NEITHER decisionEngine.ts NOR underwritingEngine.ts (0 references, verified) — computed and surfaced, not binding. CTO_ROADMAP §3.6. |
| `B3-4.2-02` | Depository Accounts | 🟡 partial | server/services/underwritingNuance.ts:371 detectSignificantDeposits, called from preUnderwriting.ts:326 inside derivePreUnderwritingFlags. Same reachability caveat as B3-4.1-01: advisory-only, not read by either engine. Two comments cited B3-4.3-04 (Personal Gifts) for large-deposit SOURCING; the governing section is this one, and gifts are only one way a deposit resolves. Re-cited 2026-08-21. The id resolved, so no machine could catch it — this is the F-063 class, found only by reading. |
| `B3-4.3-04` | Personal Gifts | 🟡 partial | Personal Gifts — donor eligibility, minimum borrower contribution and documentation are not implemented; the section is referenced only as the resolution path for a sourced large deposit (server/services/scenarioCatalog.ts:114, correctly). |
| `B3-5.1-01` | General Requirements for Credit Scores | ✅ implemented | server/underwritingEngine.ts:342 reads the CONVENTIONAL_FICO_FLOOR policy scalar (620) on the decision path. |
| `B3-5.3-09` | DU Credit Report Analysis | 🟡 partial | Collection thresholds ($5,000 / >=$250 / >$1,000) carried in data/regulatory/regulatory-ledger.json; tri-bureau pull is simulated. REVISED IN THIS EDITION — the change is Authorized User Tradelines plus a disputed-medical-tradeline note; re-verify before relying on the prior reading. |
| `B3-6-02` | Debt-to-Income Ratios | ✅ implemented | server/underwriting.ts:440 reads CONVENTIONAL_STRETCH_DTI (50%). Platform runs a deliberately stricter 43% baseline overlay (ledger platform-conv-dti-cap-43). The ratio SUBMITTED TO DU previously omitted the proposed housing payment — the back-end ratio, understating every purchase file (12.5% where the real total was 50% on the worked example). Fixed 2026-08-21 (F-0818-11): server/routes/aus.ts now composes the total ratio through computeCasefileDti. |
| `B3-6-03` | Monthly Housing Expense for the Subject Property | ✅ implemented | Monthly Housing Expense for the Subject Property. Now included in the DU casefile DTI via computeCasefileDti (server/services/ausSubmission.ts), called from server/routes/aus.ts using the same computePaymentProjection the decision engine uses, so casefile and decision cannot disagree (B3-2-01). Fixed F-0818-11 on 2026-08-21; tests/ausCasefileDti.test.ts. |
| `B3-6-05` | Monthly Debt Obligations | ✅ implemented | server/underwriting.ts assessLiabilities — DEFERRED_STUDENT_LOAN_FACTOR (:301, 1%) and REVOLVING_PAYMENT_FACTOR (:294, greater of $10 or 5%). REVISED IN THIS EDITION. |
| `B3-6-07` | Debts Paid Off At or Prior to Closing | 🟡 partial | Debts paid off at closing. Was entirely unimplemented until #650 — both branches tested liability types the URLA form cannot emit, so neither could execute while the suite stayed green (conformance ledger C-2). This is the defect class that governs how `evidence` must be written. |
| `B4-1.2-01` | Appraisal Report Forms and Exhibits | ❌ absent | Appraisal Report Forms and Exhibits — the 1004/1073/1007/1025 family. `Form 1004` returns 0 hits across server/shared/client; there is no appraisal-form handling, no UCDP/SSR submission, and the AVM adapter is a deterministic simulation. Appraisal exists only as a fee line and a condition string. |
| `B4-1.3-01` | Review of the Appraisal Report | ❌ absent | Review of the Appraisal Report. No appraisal review logic of any kind; `server/services/decisionEngine.ts:373` takes `appraisalValue = propertyValue \|\| purchasePrice`, i.e. it substitutes the contract price for a value nobody reviewed. |
| `B4-2.1-01` | General Information on Project Standards | ❌ absent | No condo/PUD project review of any kind — `project review` returns 0 hits. Only a condo LLPA adjustment in server/pricing.ts and one risk-flag string. REVISED IN THIS EDITION. |
| `B7-1-02` | Mortgage Insurance Coverage Requirements | ✅ implemented | server/scripts/seedLendingGrids.ts seeds MI coverage 12/25/30/35% by LTV band; all four bands verified against this section in the conformance ledger. |
| `B7-3-02` | Property Insurance Requirements for One-to Four-Unit Properties | ❌ absent | Property and flood insurance requirements. Flood appears only as Special Feature Codes 170/175/180; no flood-zone determination, no coverage-adequacy math. REVISED IN THIS EDITION. |
| `D1-1-01` | Lender Quality Control Programs, Plans, and Processes | 🟡 partial | Binds the lender, not us — ADOPTED BY CHOICE as the shape of our own quality program, because a wholesale lender's QC must sample our files monthly (QC Review of Third-Party Originations). The routine fleet is that program; Domain Oracle implements the sampling and reporting rules. |

## Not applicable

| Sections | Reason | Basis |
|---|---|---|
| `A1-*` (1) | Seller/servicer approval. Homiquity never applies to Fannie; the wholesale lender is the seller/servicer. | shared/businessChannel.ts BUSINESS_CHANNEL=broker |
| `A4-*` (4) | Maintaining seller/servicer eligibility — not a broker obligation. | shared/businessChannel.ts BUSINESS_CHANNEL=broker |
| `B8-*` (18) | Closing legal documents. The wholesale lender closes; we originate and package. | server/services/brokerSubmissionReadiness.ts header |
| `C2-*` (18) | Whole-loan commitments and deliveries to Fannie — seller/servicer function. | knowledge-base/governance/CHANNEL_DECISION.md |
| `C3-*` (23) | MBS pooling and securitization — seller/servicer function. | knowledge-base/governance/CHANNEL_DECISION.md |
| `D2-*` (4) | Fannie's own QC process, run against the seller/servicer, not the originator. | Selling Guide D2-1-01 |

## Reading a row honestly

`evidence` names code **on the decision path**, never a citation grep. Two local failures set that
bar. Conformance **C-2**: `assessLiabilities` cited B3-6-07 from branches the URLA form cannot
emit, so the rule was unimplemented while the suite stayed green and a grep for the citation said
"covered." And `derivePreUnderwritingFlags` is reached in production only through
`await import(...)` — invisible to a static import grep — while the flags it returns are read by
neither `decisionEngine.ts` nor `underwritingEngine.ts`. Present, computed, and still not binding.
That is why B3-4.1-01 and B3-4.2-02 are 🟡 and not ✅.

🚨 **A value read out of a table is unverified until the PDF page is open.** The text extraction
flattens tables — ruled ones survive, borderless ones do not (B2-2-03's financed-property limits
table is the known case). Prose may be trusted from the extraction; a threshold, matrix cell or
eligibility limit may not.
