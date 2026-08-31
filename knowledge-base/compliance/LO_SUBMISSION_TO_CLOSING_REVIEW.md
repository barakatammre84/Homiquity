# The loan officer's path to lender approval and closing — a Selling Guide review

> **Freshness:** last verified 2026-08-23 · review every 30 days

**Authority:** [L1_VISION_AND_SCOPE.md](../L1_VISION_AND_SCOPE.md) §Broker channel ·
[L2_COMPLIANCE_AND_LOGIC.md](../L2_COMPLIANCE_AND_LOGIC.md) · Fannie Mae *Selling Guide*
edition **08-05-2026** (every section cited below was read this session from
`docs/fannie-mae/selling-guide/extracted/sections/`, cited by section id + PDF page; the one
load-bearing numeric table, B3-2-05/B3-2-10's tolerance numbers, was re-verified against the
PDF pages via a second extraction engine). Where the Guide binds the **lender** rather than the
broker, this review says "adopted by choice" and never claims the duty as ours — the same
convention as [SELLING_GUIDE_CONFORMANCE.md](SELLING_GUIDE_CONFORMANCE.md) and the coverage map.

**What this review answers.** The founder asked, acting as the loan officer: *do I have the
tools and the process to submit a file to lender approval and to the closer?* The method was
threefold: a corpus reading pass over the governing sections (B1-1, B3-2 complete, C1, D1;
notes cite id + page), a **live end-to-end walkthrough** of a seeded file on the local dev
server driven over HTTP as the actual seats (`lo@test.com`, `processor@`, `underwriter@`,
`closer@`, `admin@`) — evidence transcript in
[../feature-review/journey-walks/2026-08-23-lo-submission-review.md](../feature-review/journey-walks/2026-08-23-lo-submission-review.md) —
and adversarial verification of every finding before it is asserted here. Browser-driven S1/S4
journey walks were **attempted and BLOCKED** (no browser tooling in this session); the
walkability ledger records that honestly, and nothing below rests on an unwalked claim.

---

## 1. Doctrine: what kind of company the Guide says we are

**A3-3-01 (p.123)** defines the position: a third-party origination is "any loan that is
completely or partially originated, processed, underwritten, packaged, funded, or closed by an
entity other than the seller," and brokers are third-party originators. Homiquity **packages**;
the wholesale lender underwrites, closes, funds, and — if it sells to Fannie — delivers.
"Sellers remain fully responsible to Fannie Mae for functions that are outsourced," so every
wholesale lender we submit to is required (p.124 table) to vet our licenses, our principals,
our loan quality, and to demand **a written QC plan and a method to validate its existence**.
Their QC reporting must summarize third-party originations monthly (D1-1-03 pp.1058-1059), and
their post-closing random sample stratifies our files as a separate channel (D1-3-01 p.1063).

Two consequences frame everything below:

1. **The binding gate is broker submission readiness** (`../../server/services/brokerSubmissionReadiness.ts`),
   not delivery readiness — delivery pre-flight is deliberately informational (stage 4 never
   blocks), because Loan Delivery's fatal-edit gate (C1-2-02 p.947) is the lender's duty that
   we mirror by choice.
2. **B1–B7 are the product backlog in the practical sense**: the lender underwrites to them,
   so a file that fails them is a file kicked back to the LO as conditions.

---

## 2. The LO's path, step by step, against the Guide

Each step: what exists (verified in code and in the live walk), the governing section
(id + PDF page, read this session), and the verdict. Statuses use the coverage-map vocabulary.

### 2.1 File assembly — the application package

| | |
|---|---|
| What exists | URLA capture with GSE gating on sections 1a/4/5 (`../../server/services/mismoValidation.ts`); document checklist via conditions (`DOC_REQ_*` rules in `../../server/pipelineEngine.ts`); per-purpose consents — `credit_authorization` (`../../shared/schema/compliance.ts`), e-disclosure + anti-steering checked at readiness; income analysis package for SE/DSCR/bank-statement paths |
| Guide | B1-1-01 (pp.167-169) package contents; B1-1-02 (p.170) blanket authorization; B1-1-03 (pp.170-175) age of documents |
| Verdict | **partial.** The package the LO can assemble carries the URLA data, documents, and DU findings — but no signed final Form 1003 *artifact*, no **Form 1103** (Supplemental Consumer Information Form; zero references in the codebase), and the delivered MISMO package still drops a co-borrower (registered F-080, P1). B1-1-02's blanket-authorization device is replaced by narrower per-purpose consents (conservative direction; the lender collects its own form). B1-1-03's four-months-on-the-note-date clock has **no analog at the submission gate** — readiness checks document *presence*, never *age* (proposed gap SG-G-1 below); the 120-day `verification_reports` expiry and the `docs_expiring` signal are the partial mechanisms. |

### 2.2 Running DU — the AUS stage

| | |
|---|---|
| What exists | `POST /api/underwrite/submit-gse` behind the Run DU / LPA button in `SubmissionReadinessDialog` — dual simulated legs (DU + LPA), DTI computed **with** the proposed housing payment (B3-6-02/-03, conformance-verified previously), Day 1 Certainty relief granted per layer only with a validated VOA/VOIE report AND Approve/Eligible, findings + casefile id + recommendation persisted on the application row, autopilot materializing findings conditions into `loan_conditions`, a simulated-labeled commitment letter |
| Guide | B3-2-01 (pp.288-292) general/resubmission duties; B3-2-02 (pp.292-300) validation service; B3-2-03 (pp.300-306) risk factors; B3-2-04 (pp.306-307) documentation requirements |
| Verdict | **partial, honestly labeled.** The sim is a deterministic 3-factor approximation (credit floor / DTI / LTV) of B3-2-03's factor set, and says so everywhere it surfaces. The D1C logic is the correctly-shaped B3-2-02/A2-2-04 analog (walk evidence: relief withheld on the demo file for exactly the right reason — no validated reports). Two Guide duties have **no analog**: B3-2-01 p.289's resubmission-on-change ("when the mortgage loan or borrower information changes … the lender must update the data and resubmit") and B3-2-10's tolerance arithmetic — nothing detects that a file changed after its last AUS run (SG-G-2 below). B3-2-08's Out of Scope recommendation cannot be represented at all (`ausRecommendation` vocabulary has no such member). |

### 2.3 Reading the result — the DU Underwriting Findings report

**B3-2-01 p.290** calls the Findings report "typically the first report viewed by an
underwriter or a loan officer after the loan casefile has been underwritten with DU."
**B3-2-04 p.306** requires it retained in the permanent loan file (B1-1-01 p.169's parallel
duty names the DU Underwriting *Analysis* Report — a different artifact; the compliance-auditor's
precision, so Findings-report retention is attributed to B3-2-04 alone).

The walk proved the pre-existing state precisely: the run's full findings (recommendation,
risk assessment, messages, the LPA leg, D1C relief, casefile id) ride the application row and
reach the LO's browser in the `GET /api/loan-applications/:id` payload — **and no client
surface rendered any of it**. The LO saw a toast, then nothing. That is the gap this
session's build closes: a DU / LPA findings panel inside `SubmissionReadinessDialog`
(`../../client/src/components/SubmissionReadinessDialog.tsx`), simulated-labeled, citing
B3-2-11. A durable report *artifact* in the document store remains future work.

### 2.4 Submitting to the lender — the wholesale package

| | |
|---|---|
| What exists | The 4-stage readiness gate (blockers from stages 1–3 refuse submission — walk step 1 proved the refusal, step 3 the clearance); counterparty gate (Target-5 all `approvalStatus: "target"` until a broker agreement exists; **demo lenders refused in every environment** — walk step 7b captured the exact refusal); one-active-submission-per-lender (step 7); the package: MISMO 3.4 XML + sha256, income analysis package, compensation snapshot, readiness snapshot; XSD conformance diagnostic recorded non-blocking (F-025/L6 posture) |
| Guide | B3-2-05/-06/-07 (pp.307-312) recommendation handling; A3-4-02 data quality (prior row); C1-2-02 (pp.947-950) as the lender's-eye mirror |
| Verdict | **works, with one new defect found live.** Warn-never-block on Ineligible/Refer at stage 2 is *defensible* under B3-2-06/-07 (both route to manual underwrite or negotiated variances — the lender's decision, not ours). The new defect: the demo file's package came back `xsdConformance: {valid:false, offendingElements:["QUALIFICATION_DETAIL"]}` — a conformance failure the XSD suite's fixture never exercises (the F-049-correction fixture-trap class; parked finding PF-3). The diagnostic surfaced it exactly as designed; the package it stamped was still handed over. |

### 2.5 Lender approval — the submission status machine

The machine (`../../shared/wholesaleLenders.ts`) walked cleanly end to end as the LO:
`submitted → acknowledged → in_underwriting → conditions_issued → conditions_cleared →
clear_to_close → funded`, illegal jumps 422 with the exact refusal, `funded` refused without
`fundedLoanAmount` + `compensationReceivedAmount` and accepted with them. Lender conditions
transcribe into `loan_conditions` (category `lender_condition`, `sourceRule lender:uwm`) and
ride every conditions surface. Two honest observations: the machine **trusts the operator**
(`conditions_cleared` succeeded with a transcribed condition still outstanding — the lender's
own machine is authoritative in reality), and it is **uncoupled from the loan pipeline**
(walk: the submission reached `funded` while the application sat at `pre_approved`; finding
PF-2, registered 2026-08-31 as **F-099**, records the divergence risk).

### 2.6 Clear-to-close and funding — the pipeline

This is where the review found the process gap the founder's question was really about.

**What the Guide says.** B3-2-05 p.308: Approve/Eligible is "eligible for sale to Fannie Mae
… **if all approval conditions have been met**." B3-2-01 p.291: the lender must "ensure that
the loan complies with **all of the verification messages and approval conditions** specified
in the DU Underwriting Findings report." D1-3-02 p.1066: post-closing QC "must confirm that
**all loan approval conditions required by the underwriter were satisfied**" — an
open-conditions closing is, by definition, a QC defect at every wholesale lender. D1-2-01
pp.1060-1061 exists precisely to stop "defects prior to closing."

**What the walk proved (pre-fix).** With one outstanding `prior_to_funding` condition on the
file: the provenance chokepoint correctly 422'd clear-to-close on self-reported data (a CLEAN
result — that gate works); after verify-financials, **`clear_to_close` was granted (HTTP 200)
with the condition outstanding**, `closing` and then **`funded` were granted the same way**,
HMDA action-taken stamped, homeowner graduation fired — a funded loan with an open
homeowners-insurance condition. Mechanism: the only status route any shipped UI calls
(`PATCH /api/loan-applications/:id/status`, `../../server/routes/lending/statusDecisions.ts`)
never consulted `checkPipelineProgress`; the one route that does (`advance-stage`) has zero
client callers (register N-002); and the progress function's switch had no `closing` branch,
so `closing → funded` was condition-ungated on every path.

**What this session changed (B1).** The reachable route now consults the engine's stage-exit
requirements whenever the target status is `clear_to_close`, `closing`, or `funded` (422
`conditions_outstanding` with the blocker list; the existing admin-only `force` is the audited
escape hatch), and `checkPipelineProgress` gained the missing `closing` branch. Under the
engine's own current-stage semantics that means: approval/docs-priority conditions gate entry
to clear-to-close, **all** un-settled conditions gate entry to closing, and the new branch
stops funding on anything un-settled — which is where `prior_to_funding` bites, matching the
priority's meaning (a funding condition may legitimately remain open at CTC). Two adjacent
corrections ride the same commit: the early branches' settled-filter is normalized to
`SETTLED_CONDITION_STATUSES` (pre-fix they exempted only cleared|waived, so a `not_applicable`
condition would have false-blocked the moment the gate went live — the register's F-0820-63),
and the false doc-comment in `../../server/services/preUnderwriting.ts` claiming the status
route already "refuses advancement while checkPipelineProgress reports blockers" is corrected.
Direction check: this **tightens** a gate — the conservative direction the Standing rule
permits without escalation (compliance-auditor: SUPPORTED; no ECOA/HMDA interaction — the
gate never touches denial/withdrawal, and action-taken stamps only on a completed
transition). Two recorded caveats: from `conditional` the engine demands ALL conditions
settled before CTC (stricter than the branch-2 path — over-strict is the safe direction),
and **the gate is only as complete as `loan_conditions`** — structural AUS messages are
deliberately not materialized as conditions, and a live lender's stips must be transcribed
to be visible, so a green gate proves everything *recorded* is settled, not that the record
is complete.

### 2.7 The closer handoff — documented gap, not built

The closer seat walked as chartered (S4 expectation `DEAD-ENDED (by design)` — confirmed,
not minted as a journey finding since the browser walk itself was BLOCKED; the HTTP census
stands in): every staff read works; `Run DU / LPA` **renders for the closer and 403s**
(F-0818-13, lived); protected statuses refuse with "Only underwriters or admins may set
approval or denial outcomes"; `closing` is the seat's one pipeline verb; the file generated
**zero staff signals** at clear-to-close/closing (`SIGNAL_ACTIVE_STATUSES` excludes both by
design — the comment says the closing track belongs elsewhere; nothing exists there yet).
No closing surface, no scheduling verb (`closingScheduledAt` written only as a status side
effect; zero client reads), no wire/final-docs surface, no Closing Disclosure anywhere
(two MISMO field-name hits are the only occurrences).

**What a closer desk would need, Guide-grounded** (for a future build — deliberately not
built this session, per the founder's scope decision): the D1-2-01 prefunding checklist as
its worklist shape; D1-3-02 p.1068's closing-document review list (note, security instrument,
MI cert, title evidence, final settlement statement) as the package checklist; `prior_to_funding`
condition clearance as its gate (now enforced by B1); and the understanding that the CD/UCD
duty (C1-2-02 pp.949-950) is the **lender's** — the desk coordinates, it does not disclose.

---

## 3. The founder's three answers

**Tools you have (verified live).** A real gate that refuses an unready file with named
blockers; one-click dual-AUS with honest simulation labels and correct D1C withholding; a
counterparty gate that cannot be talked into a demo lender; a package with hashes, an XSD
diagnostic, an income package, and a compensation snapshot; a transition-checked submission
machine with funding economics enforced at `funded`; lender-condition transcription that rides
the standard conditions surfaces; deal-team-scoped access with role-true refusals; a
provenance chokepoint that genuinely blocks approval-grade statuses on unverified data; and —
as of this session — a condition gate on clear-to-close/closing/funded and a DU findings
panel (the Guide's "first report viewed by … a loan officer," B3-2-01 p.290).

**What's missing (register-tracked).** A durable DU findings artifact in the document store;
data-staleness/tolerance handling after an AUS run (SG-G-2); a document-age check at
submission (SG-G-1); Form 1103 and a signed-1003 artifact in the package (B1-1-01); the
co-borrower in the MISMO package (F-080, P1, already registered); reconciliation between the
submission machine and the pipeline (F-099); the closer desk itself (roadmap; §2.7); an
`out_of_scope` representation (B3-2-08); XSD conformance of the live package
(QUALIFICATION_DETAIL, F-097, under the F-025/L6 posture).

**What mismatches the Guide.** Nothing found that *loosens* a borrower protection. The two
substantive mismatches — the unenforced condition gate (fixed this session) and the
unimplemented resubmission-on-change duty (recorded, conservative direction unclear-free) —
are both in the tighten-only direction when fixed. The warn-never-block posture on
Ineligible/Refer was checked against B3-2-06/-07 and stands as written.

## 4. CLEAN — checked and found conforming

- Provenance chokepoint: approval-grade statuses genuinely refuse self-reported data on the
  reachable route (lived 422, exact message).
- TRID/LE stage-1 gating and the CoC revised-LE blocker (per `deriveSubmissionStages`; not
  re-litigated — covered by `../../tests/brokerSubmissionReadiness.test.ts`).
- DTI includes the proposed housing payment (B3-6-02/-03; `../../tests/ausCasefileDti.test.ts`).
- D1C relief withheld without validated reports and without Approve/Eligible (lived).
- Demo-counterparty refusal in every environment; duplicate-active-submission refusal (lived).
- Funding-figures requirement on the submission machine (lived 400 → 200).
- Deal-team object-level access: off-team staff 403 (lived, processor before team-add).
- HMDA action-taken stamped `1` on funding (lived).
- Simulated labels on the commitment letter and findings (lived; `../../tests/commitmentLetterProvenance.test.ts`).

## 5. What this session deliberately did NOT do (founder decisions, proposed only)

1. **Couple the two status machines** (submission `funded` ⇏ pipeline `funded`). Proposal:
   a divergence *flag* (staff signal when one machine is ≥ clear_to_close and the other is
   > 1 stage behind), not an auto-advance — auto-advance would move a credit decision without
   its chokepoints. F-099.
2. **Build the closer desk** (§2.7 carries the Guide-grounded requirements).
3. **Extend `SIGNAL_ACTIVE_STATUSES`** into the closing track — the exclusion is a documented
   design decision; reversing it belongs with the closer-desk build.
4. **Remove or wire `advance-stage`** — N-002 records it as redundant; after B1 the reachable
   route carries the condition gate, making the dead route *more* redundant. Either delete it
   or make it the closer's funding door; both are product decisions.
5. **Backfill `not_applicable` exemption into `checkPipelineProgress`'s early branches**
   (pre-approval/docs branches exempt only cleared|waived, unlike `SETTLED_CONDITION_STATUSES`)
   — tightening-consistent today; normalizing is a small follow-up left un-bundled.

## 6. Proposed conformance-ledger entries (Domain Oracle's register — drafted here, not written)

The conformance ledger is the Domain Oracle routine's lane; per program discipline this
review *proposes* entries ready to paste, ids local to this doc (SG-G-*/SG-C-*) until the
Oracle assigns real G-/C- numbers. `FINDINGS.md` was claim-locked by open PRs at review time
(#698, #710), so the same discipline applies there — the register rows are **parked** in the
walk record, per the park-file protocol.

**SG-C-A (correction, resolved in this session's PR).** *An Approve/Eligible file could reach
clear-to-close, closing, and funded with approval conditions outstanding.* B3-2-05 p.308
conditions sale eligibility on "all approval conditions have been met"; B3-2-01 p.291 requires
compliance with "all of the verification messages and approval conditions"; D1-3-02 p.1066
makes unsatisfied conditions a post-closing QC defect. The only client-reachable status route
never consulted the condition-progress check, and the check itself had no `closing` branch.
Live repro 2026-08-23 (funded loan, open `prior_to_funding` condition) in the walk record.
Fixed: condition gate on target statuses {clear_to_close, closing, funded} + the `closing`
branch; admin `force` audited. Direction: tightens.

**SG-G-1 (gap, conservative).** *No document-age check at submission.* B1-1-03 p.171: credit
documents (credit reports + employment/income/asset docs) no more than four months old on the
note date. Readiness checks presence, never age; partial mechanisms exist
(`verification_reports` 120-day expiry; `docs_expiring` signal; ledger overlay
`platform-doc-freshness-30`). The clock binds the lender to a note date the broker does not
control — resolution is a readiness *warning* keyed to document dates, not a block. Until
built, lenders will condition stale documents back to us; no borrower is harmed.

**SG-G-2 (gap, conservative).** *No staleness or tolerance handling after an AUS run.*
B3-2-01 p.289 requires resubmission when data no longer matches the last casefile; B3-2-10
pp.314-316 defines the tolerances (DTI newly > 45% or +3pts at ≤ 50%; refi amount
+$500-or-1%-whichever-less / −5%; reserves ≥ 90% of Findings-report figure — all
PDF-verified). Today a post-run data edit leaves the stale recommendation standing, unflagged.
Conservative resolution: a staleness *flag* on readiness stage 2 when qualifying inputs
changed after `ausSubmittedAt` (tightens); the tolerance arithmetic itself only matters once
a real DU integration exists (F6).

## 7. Register cross-references

Lived this walk and already registered (cited, not re-minted): F-0818-13 (Run DU renders for
closer, 403s) · F-0818-01 (verify-financials demands no evidence) · N-002 (advance-stage
unreachable) · ux-0818-01 (dead Generate LE button; fixed this session) · F-080 (co-borrower
dropped from package) · F-025/L6 (XSD non-blocking posture) · F-051 (delivered recommendation
now honest — per the #710 audit the register row lags the code). Parked findings, each
adversarially verified this session: PF-0 (the condition gate, CONFIRMED P1, fixed
in-session), PF-1 (DU findings surface, CONFIRMED P2, fixed in-session), PF-2 (uncoupled
machines, CONFIRMED P2), PF-3 (XSD fixture blindness on QUALIFICATION_DETAIL, CONFIRMED
and raised to **P1** by the compliance-auditor, reproduced mechanically), PF-4 (STAFF_JOURNEYS wrong-at-birth claim + cite drift,
CONFIRMED P3, corrected in this PR — one leg refuted), and PF-5 which came back
DUPLICATE-of F-0818-10/F-015 (fold, don't mint). Full text and verdicts in the
[walk record](../feature-review/journey-walks/2026-08-23-lo-submission-review.md).

> **Folded into the register 2026-08-31.** At the founder's direction the three findings that were
> still parked entered `../feature-review/FINDINGS.md` as **F-097** (PF-3, XSD `QUALIFICATION_DETAIL`,
> P1), **F-098** (PF-6, the MERS container sibling, P2) and **F-099** (PF-2, the uncoupled status
> machines, P2) — while #698/#710 were both still open, so the claim lock the park protocol waits on
> had *not* cleared. Each was re-verified against `main` @ `993db44` before it was written. F-098
> carries a standing caveat in its own row: it has never passed `finding-verifier`.


---

*Method note: readings were performed on the extracted corpus materialized this session
(sha256-verified against the manifest); `grep -F` used for `$` phrases; the flattened
tax-return table in B1-1-03 (pp.172-174) was NOT relied on for any claim. This doc contains
no Selling Guide text beyond short quotes for verification purposes.*
