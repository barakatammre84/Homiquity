# Lender Delivery Gate — 2026-08-18

> **⏱ Fired 2026-08-18T15:31:47Z** (scheduler `lastRunAt`), **interrupted mid-run, resumed and
> completed 2026-08-20T02:2xZ** (= 2026-08-19 ~21:20 local). The gap is ~35 hours and `origin/main`
> moved **13 commits** in it (`a402bef` → `b799b91d`, PRs #547…#602). **Every claim below was
> re-derived from scratch against `b799b91d` after the resume** — nothing from the pre-interrupt
> pass is reported on its original evidence. Dated per CHARTER §10.
>
> Filed under its **slot date (08-18)** rather than its completion date, because 08-18 is the
> hole in the proof-of-life count: `reports/` has **no lender-gate artifact for 08-17 or 08-18**,
> and the 2026-08-18 Evening Triage landed that as roadmap **§3.24** ("it ran and vanished").
> This file closes 08-18. **08-17 remains genuinely lost.**

STATUS: WARN — the delivery gate is green (17 suites, 388 passed / 1 skipped) and this run's rotated
field **`urla_property_info.occupancy_type` CLEARS** with a real organic write path proven on both
legs. But the same probe found the *absence* of that field is delivered as a **positive assertion
that contradicts the borrower's own gating declaration**, and it passes every gate we own —
XSD, ULDD and structural. Separately, the **live scheduler and CHARTER §3 have diverged** (this
routine is now weekly, not daily) and the founder deferred launch on 2026-08-19, which retires the
premise this routine's own prompt tells it to lead with.

---

## ⛔ Human actions — hardest decision first

### 1. The Target-5 premise changed yesterday; confirm the new one before anyone acts on the old one

**This routine's `SKILL.md` orders it to "lead the report with the Target-5 founder actions,
tracked as live founder actions with an age in days."** That instruction is now standing on a
premise the founder appears to have retired on **2026-08-19**. Read from the live scheduler, not
from memory:

| taskId | description text (verbatim fragment) |
|---|---|
| `launch-gate` | *"Trunk Health (7:45 AM daily — **was Launch Gate until 2026-08-19**) … The RELEASABLE/prod-drift/rollback verdict is **retired while launch is deferred**."* |
| `primary-engineer` | *"Ranks by client-facing completeness and quality, **not launch readiness (founder directive 2026-08-19)**."* |
| `vendor-procurement` | *"**Launch procurement urgency dropped**; Railway/Actions billing still outranks everything."* |
| `lender-delivery-gate` | *"**Weekly while launch is deferred**; the daily slot went to the Feature Completion Engine."* |

So the honest presentation is **tracked, not urgent** — and the ages are the founder's to weigh:

| # | Action (`CTO_ROADMAP.md` §1.3) | Age (days) |
|---|---|---|
| 1 | **Re-verify all five are still broker-friendly and NMLS-active** — do this *before* the four below or the calls are wasted | **46** (snapshot 2026-07-04; file unchanged since `398e06b9`, 2026-08-06) |
| 2 | **UWM** — AE / Director hotline: sandbox process, and whether BOLT exposes a PPE-consumable rate feed or is portal-only | **37** (F1 cleared 2026-07-13) |
| 3 | **Newrez** — Brigade contact for the sandbox path | 37 |
| 4 | **Angel Oak + Newrez** — request the broker-approval checklists | 37 |
| 5 | **Plaza** — manual read of the 82-page wholesale-broker guide PDF for net-worth / surety-bond minimums (automated fetch cannot parse it; stream-encoded, shortlist:127) | 37 |

**The ask is one line from you:** if launch is deferred, say so in `CTO_ROADMAP.md` §1.3 so §1.3
stops reading as an urgent unworked blocker to every routine that ranks off it — **or** say the
deferral does not extend to lender relationship-building, in which case item 1 is a 46-day-stale
assumption and should move first. Either answer is cheap; the ambiguity is what costs. **Nothing
was drafted and no lender was contacted — outbound is founder-only and this routine has never
sent anything.**

### 2. The scheduler and CHARTER §3 disagree — and CHARTER §11 forbids exactly this

CHARTER §11: *"Adding, retiring or re-timing a routine means editing **this file and the scheduler
together, in the same session**. A definition on disk that is not registered in the scheduler is not
a routine — it is a fossil, and fossils are what produced §0."*

`CHARTER.md` on `b799b91d` was last touched **2026-08-18** (`f733e6ed`). The scheduler was re-timed
**2026-08-19**. Read side by side (`mcp__scheduled-tasks__list_scheduled_tasks` vs
`CHARTER.md:155-171`), the local fleet's contract is stale in three ways:

**Cadence changed, CHARTER not updated (3):**

| Routine | CHARTER §3 | Live scheduler |
|---|---|---|
| **Lender Delivery Gate** (this one) | `30 12 * * *` — **daily** | `30 12 * * 1` — **Mondays only**, renamed *Lender Package Gate*; next run **2026-08-24T15:31Z** |
| Vendor & Procurement | `35 9 * * 1` — weekly | `35 9 1 * *` — **monthly**, renamed *Vendor & Platform Risk* |
| Launch Gate | `RELEASABLE: yes/no` verdict | renamed *Trunk Health*; **that verdict retired** |

**Registered but absent from CHARTER §3 (3)** — three routines are firing daily with no row in the
contract that is supposed to bind them:

- `workflow-completion-engine` — `50 9 * * *`, *"drives ONE end-to-end client workflow … and **FIXES** the first seam"* (**writes code**)
- `feature-completion-engine` — `30 12 * * *`, *"**Ships code.** Owns the 129-item open findings backlog"* (**writes code**, and it took this routine's old slot)
- `client-journey-walk` — `5 17 * * *`, report only

Two of the three **write code** and neither has a §6 territory row or a §5 claim discipline
described anywhere. That is the collision hazard the register exists to prevent.

**In CHARTER §3 but not in the local scheduler (7):** Domain Oracle, Integration Readiness, App
Walker, QA Mutation Verifier, Workflow Prover, Algorithm Auditor — plus Workflow Prover's `5 17 * * *`
slot now belongs to `client-journey-walk`. **I am deliberately not calling these dead.** Their
`SKILL.md` files exist and load, and I cannot see the CCR/cloud trigger fleet from here, so they may
be registered cloud-side. **What I can say is that the local scheduler does not list them**, and
CHARTER §7's proof-of-life count cannot distinguish "cloud-registered" from "fossil". Resolving that
is Evening Triage's §7 job and the re-timing itself is founder territory (§1b L3) — proposed as
ticket 1, not touched here.

---

## Summary

The delivery capability gate is green on current `main` and this run's rotated organic field —
`urla_property_info.occupancy_type`, which feeds ULDD `PropertyUsageType` — **clears**: all three
borrower-selectable values survive the route whitelist and reach the wire with their meaning intact,
proven by an executed "stored value == emitted value" probe rather than a code trace. The same probe
established something the register did not have: when occupancy is simply *never answered*, the
package asserts **`PropertyUsageType = PrimaryResidence`** while carrying the borrower's own
**`IntentToOccupyType = No`** three containers away — a self-contradicting file that `xmllint`,
`validateULDDCompliance` and `validateMISMOXML` all pass, and that **no gate blocks**, because
occupancy lives in URLA section 3 and `GATING_SECTIONS = ["1a","4","5"]`. That is not a new finding —
it is **F-055**, already registered P1 — but the contradiction leg is new, and it hands the eventual
fix a free correctness signal that costs the borrower no extra question. F-080 (co-borrower dropped)
was re-verified live and is unchanged. No code was written: every candidate fix sits inside the
F-052/053/054/055/080 cluster whose register rows carry an explicit *do not fix in isolation*
constraint, and a test asserting today's behaviour would pin the bug rather than catch it.

---

## Evidence

### 1. Sync, register, and standing facts — all re-probed

```
worktree  scratchpad/lender-wt   branch routine/lender-gate-2026-08-18
HEAD      b799b91d  "a11y: the shared chrome reaches 44px on phones … (#602)"
pnpm install --frozen-lockfile  re-run after the resync (CHARTER §5.1)
```

- **NMLS / F1** — `shared/companyIdentity.ts:16` → `nmlsId: "427468"`. **Unchanged, still CLEARED.**
  No lead-story news this run.
- **MISMO version** — 3.4 (`DataVersionIdentifier 3.4.0`). No 3.6 chase; **no counterparty demand
  on record**, in writing or otherwise.
- **No field name, enumeration, XML container path, edit code or SFC was invented or altered.**
- **`REGISTER.md` Active claims** — one row, `directed session (F-077 FHA leg)` on
  `server/services/{loanEstimate,loanCosts,scenarioSimulator,mortgageInsurance,apr}.ts`. **No
  overlap** with anything this run read or wrote. `ListAgents` → 4 peer sessions, none on this target.
- **Prod is current.** `GET https://homiquity-production.up.railway.app/api/health` →
  `commit b799b91da401edd92a7d6af8c76a2b1743f271d1` = `origin/main` HEAD. Drift **0**.
- **`main` CI is green**; the one `failure` on `b799b91d` is the **`cron-jobs`** workflow
  (`workflowName=cron-jobs`, `event=schedule`, job `trigger`), **not** `CI` — its two neighbouring
  `cron-jobs` runs on the same SHA succeeded. Logs already expired (`BlobNotFound`), so the cause is
  not recoverable from here. Flagged for Trunk Health; **not** a delivery-gate failure and not
  counted against this verdict.

### 2. Delivery capability gate — PASS

Suite **globbed from `tests/`** (`mismo|gse|deliver|sfc|qm|ucd|urla|lender|aus|broker|xsd`), not a
fixed list, then run. 19 files matched; the 2 excluded are the integration-lane HTTP tests
(`mismoExportAccess`, `lenderConditions` — `vitest.integration.config.ts`, unchanged classification
from the 2026-08-12 run).

```
tests/{mismoExport,mismoMersMin,mismoValidation,mismoValidationBatch,mismoXsdValidation,
       loanDeliveryEdits,qmThresholds,brokerSubmissionReadiness,lenderSubmission,
       lenderApprovalControl,urlaLoanDetailsSave,urlaRowContent,urlaCoApplicantRemoval,
       adverseActionDelivery,autopilotAusFollowUps,nonQmProgramGate,
       compensationElectionQmGate}.test.ts

Test Files  17 passed (17)      Tests  388 passed | 1 skipped (389)      exit 0
```

The single skip is the **intentional** inverse case from the 2026-08-12 fix (*"returns skipped:true
when xmllint is unavailable"*), which `it.skipIf`s when the binary is present. `xmllint` **is**
present here (`/usr/bin/xmllint`, libxml 20913), so the XSD leg executed for real rather than
early-returning — the exact failure that run closed. `mismoValidationBatch.test.ts` is new since
08-12 and is now permanently in the suite.

### 3. Organic-file question — **`occupancy_type` CLEARS**

**Rotated field:** `urla_property_info.occupancy_type` → ULDD `PropertyUsageType`
(`server/mismo.ts:1009-1012`). Chosen off the 08-12 rotation list because, unlike a consent, it is a
**delivered substantive value** — it drives LLPA tiers, B2-2-03 financed-property limits, and the
repo's own edits 6159/6439 — so it tests whether the package says something *true*, not merely
whether a gate can be satisfied.

Proven by **executed probe**, both legs, not by reading the chain:

**Leg 1 — does the borrower's pick survive the route whitelist?** (`pickTableFields`, the layer that
silently drops unknown keys — the #451 silent-success class)

```
body{occupancyType:"primary_residence", bogus:'x'} -> persisted {"occupancyType":"primary_residence"}
body{occupancyType:"second_home",       bogus:'x'} -> persisted {"occupancyType":"second_home"}
body{occupancyType:"investment",        bogus:'x'} -> persisted {"occupancyType":"investment"}
```

It survives **by construction, not by an allowlist that can drift**: `urlaValidation.ts:52` derives
the allowed set from `getTableColumns(table)` at runtime, so a real column cannot be omitted. The
decoy key is dropped, which is the control.

**Leg 2 — does the stored value reach the wire with its meaning intact?**

```
stored="primary_residence"  emitted=PrimaryResidence  ULDDvalid=true
stored="second_home"        emitted=SecondHome        ULDDvalid=true
stored="investment"         emitted=Investment        ULDDvalid=true
```

Chain, traced in code and confirmed by the probe:

1. `client/src/pages/borrower/urla/PropertySection.tsx:131-145` — `<Select id="occupancy-type">`
   with exactly the three options, `onValueChange` → `onChange({...propertyInfo, occupancyType})`.
2. `client/src/pages/borrower/URLAForm.tsx:694-696` renders it inside the borrower URLA;
   `:422` posts `propertyInfo` in the bulk save.
3. `server/routes/borrower/urla.ts:609-611` — `hasContent(propertyInfo)` →
   `pickTableFields(URLA_TABLES.propertyInfo, propertyInfo)` → `storage.upsertUrlaPropertyInfo`.
4. `shared/schema/lendingUrla.ts:417` — `occupancy_type varchar(50)`, the column the export reads.
5. `server/mismo.ts:1009-1012` → `mapPropertyUsage(propertyInfo?.occupancyType)`.

Borrower-reachable, persisted to the exact row the export reads, and **not** seed-only — the demo
seed writes it too (`server/scripts/seedDemoFile.ts:114`), which is precisely the shape that hides a
missing product path, and here the product path is real.

**Verdict: real product write path. Field cleared.**

**Cleared-field ledger** (append-only; future runs add rows, never re-check):

| Run | Field / section | Verdict |
|---|---|---|
| 2026-08-05 (#400, recorded by wiring audit 08-12) | `preferredLoanType` / `amortizationType` (URLA §4) — the former WF2-F4 | cleared |
| 2026-08-12 | `anti_steering` acknowledgment (Reg Z §1026.36(e)(3)) — submission stage 3 blocker | cleared |
| **2026-08-18 (this run)** | **`urla_property_info.occupancy_type` → ULDD `PropertyUsageType`** | **cleared** |

**Next rotations**, ranked by blast radius: the `e_disclosure` consent; the AUS casefile +
recommendation pair (`aus.casefileId` — stage 2 hard blocker); the change-of-circumstance records
driving the revised-LE gate; `urla_property_info.numberOfUnits` → `FinancedUnitCount`.

### 4. ⚠️ The *absence* of occupancy is delivered as a claim that contradicts the borrower — F-055, sharpened

This is **not a new finding.** `FINDINGS.md:28` **F-055** (P1) already registers
`mapPropertyUsage(undefined) → "PrimaryResidence"` as one of six delivery data points that
"substitute a positive value for absent data", and already names occupancy **the worst of the six**,
citing Selling Guide A3-4-03 (which names *"misrepresentation of … occupancy"* as a fraud variety).
Dated and re-verified live: `server/mismo.ts:213` still reads
`return mapping[usage?.toLowerCase() || ""] || "PrimaryResidence";`.

**What is new is the contradiction leg, and it is worth adding to that row.** The declaration
`willOccupyAsPrimaryResidence` (URLA 5a-A) is emitted as `IntentToOccupyType`
(`server/mismo.ts:448`) and lives in **section 5, which *is* a gating section** — so on any file that
reaches delivery readiness at all, **that answer is guaranteed present**. Occupancy lives in section
3, which is **not**:

```
server/services/mismoValidation.ts:83   const GATING_SECTIONS = ["1a", "4", "5"];
server/services/mismoValidation.ts:310  { name: "Occupancy Type", value: propertyInfo?.occupancyType, required: true }
                                        └─ scored inside scoreSection("Property Information", "3")
```

`required: true` in a **non-gating** section produces no `criticalError`, so `blocked` stays false.
The result, probed end to end — an investor who answered 5a-A *"No, I will not occupy this as my
primary residence"* and never touched the occupancy dropdown:

```
occupancy_type=null          IntentToOccupyType=No  PropertyUsageType=PrimaryResidence
                             ULDD=true  validateMISMOXML=true  xsd={valid:true,skipped:false,errors:0}
occupancy_type="investment"  IntentToOccupyType=No  PropertyUsageType=Investment
                             ULDD=true  validateMISMOXML=true  xsd={valid:true,skipped:false,errors:0}
```

The first row is a package that **states two incompatible things about the same loan** and is clean
against **every** validator we own, including `xmllint` against both ULDD Phase 5 schemas with
`skipped:false` (so the strongest gate genuinely ran).

Three things follow, and the third is the useful one:

1. **Reachability is not limited to the ungated staff export.** F-054's sibling defaults are
   reported as low-exposure because F-052/F-053 block organic files from the transmission path.
   Occupancy is different in kind: it is not gated *even in principle*, because its section is not
   in `GATING_SECTIONS`. Whenever F-052/F-053 clear, this ships inside the immutable
   SHA-256-hashed `lender_submissions.mismoPackageXml` with nothing in its way.
2. **The UI makes the gap invisible rather than loud.** `PropertySection.tsx:133` renders
   `value={propertyInfo.occupancyType || "primary_residence"}` — the control *displays*
   "Primary Residence" without writing it, and `URLAForm.tsx:136-138`'s `isComplete` for the step
   requires only address + value. So a borrower can complete the step, see a plausible answer, and
   leave the column NULL. The delivered assertion and the never-made choice look identical from
   every surface.
3. **The fix does not need a new borrower question.** Because 5a-A is gating and therefore always
   answered, `IntentToOccupyType` is a free cross-check: a file whose declaration says *No* can
   never legitimately deliver `PrimaryResidence`, and one whose declaration says *Yes* with a NULL
   occupancy has a defensible inference. That turns "omit rather than assert" (compliance-auditor's
   standard on F-055) from a data-loss trade-off into a strict improvement — and it is a *detectable*
   contradiction, so it can be a validator rather than only a mapper change.

**Not fixed here, deliberately.** `mapPropertyUsage` sits inside the
**F-052 / F-053 / F-054 / F-055 / F-080 cluster**, whose register rows carry an explicit *"do not fix
in isolation"* constraint (and roadmap §2.5 repeats it for F-080: shipping AUS/ARM honesty alone
promotes a materially false file into an immutable artifact). A one-function change from this
routine would be exactly the isolated fix those rows forbid. Adding a test that asserts today's
behaviour would be worse — that pins the bug in place, the fixture trap in CHARTER §10.

### 5. F-080 — re-verified live, unchanged

Dated per CHARTER §10 rather than carried from the 2026-08-18 Evening Triage's characterisation.
On `b799b91d`:

```
server/mismo.ts:1263-1265     dealChildren.push({ tag: "PARTIES", children: [buildPartyNode(dto)] });
                              └─ exactly one PARTY, no borrowerSequenceNumber dimension
server/storage/urla.ts:171-177  getEmploymentHistory(applicationId) — .where(eq(…applicationId, applicationId))
                              └─ no borrowerSequenceNumber filter, though the column exists
                                 (shared/schema/lendingUrla.ts:264,269)
server/storage/urla.ts:85-86   personalInfo IS filtered to borrowerSequenceNumber
```

Still open, still the register's top question-A item, still coupled. **The 2026-08-18 Evening Triage
is right that acceptance question A is "improved, not answered" by #545.**

### 6. Delivery build status — read from code this run

- **Lender submission adapter** (`server/services/lenderSubmission.ts`, **397 lines**) — real status
  machine, unchanged since 08-12: illegal transitions rejected (`:330`), status membership validated
  rather than cast (`:322`), duplicate live submission to the same lender blocked (`:166`),
  `approvalStatus` validated so a file cannot transmit to a never-approved company (`:95-103`).
- **XSD validation of the generated MISMO 3.4 XML** — exists, wired, **executed** (not skipped) this
  run against both `docs/fannie-mae/schemas/` schemas, **empty offending baseline**. Permanently in
  the step-2 suite per this routine's standing instruction. `server/services/mismoXsdValidation.ts`,
  145 lines.
- **`loanDeliveryReadiness.ts`** (270 lines) — no functional gap; its design point is that uncaptured
  data reports *"not evaluated"*, never as a pass. Standing caveat unchanged: in the broker channel
  GSE delivery is the **wholesale lender's** obligation, so this is a data-quality pre-flight and
  must never read as a gate we are subject to (F-14).
- **`brokerSubmissionReadiness.ts`** (345 lines) — the real gate; stages 1–3 block, stage 4 is
  informational by design. AUS quality deliberately does not block (`refer` / `approve_ineligible`
  stay human-placeable).
- **Dual-AUS** (`server/services/ausSubmission.ts`, 349 lines) — both legs present; the LPA leg is a
  deterministic simulation that **throws on purpose** if `FREDDIE_LPA_API_KEY` is set, so a real key
  can never silently produce fake findings.
- **Only one delivery-stack commit since 2026-08-12:** `1eb8fdb8` *"fix(F-051): the delivered MISMO
  package told every lender the AUS said Approve (#545)"*. Nothing else in
  `server/mismo.ts` or the four services changed.

### 7. Target-5 — shortlist state

`knowledge-base/research/my-research/wholesale-lender-shortlist-2026-07-04.md`, unchanged since
`398e06b9` (2026-08-06). The five, still as snapshotted **2026-07-04 (46 days)**: **UWM**,
**Rocket Pro TPO**, **Plaza Home Mortgage**, **Angel Oak Mortgage Solutions** (non-QM), **Newrez
Wholesale**. All five need re-verifying as still broker-friendly and NMLS-active before any of the
other four actions is worth doing — see ⛔1 for why that ranking is now a founder question rather
than an assertion. **No lender was contacted, no outbound copy drafted, no lender response or
sandbox result fabricated. No live lender relationship exists.**

### 8. Scenario intake — not triggered

`knowledge-base/compliance/UNDERWRITING_SCENARIOS.md` last changed **2026-08-07** (`2eb3af23`),
far outside the 24 h window. Step 6 correctly skipped.

### 9. Upstream reports — WARN, named

CHARTER §4 makes reading peers mandatory. Present and read: **2026-08-18** `evening-triage`
(its F-080 hand-off is this report's §5 and its §3.24 finding is this report's header),
`wiring-audit`, `qa-sweep`, `app-walker`.

**Absent for 2026-08-19** — the day this run actually completed: `primary-engineer` (fired
10:21:58Z), `launch-gate`/Trunk Health (fired 10:48:50Z), `frontend-wiring-audit` (fired 13:13:03Z).
All three **ran** per the scheduler and none left an artifact in `reports/` on any ref I can see;
`deliverable-qa-sweep` did (`origin/routine/qa-sweep-2026-08-19`, unmerged). Named per §4, not
silently ignored — but the determination of what that means is Evening Triage's under §7, and it is
the same pattern as roadmap §3.24. **This run is itself an instance of it**, which is why the header
says so first.

### 10. Not verified

No browser check and no dev server — CHARTER §10; this is test-and-typecheck-and-probe evidence
only. `cron-jobs` failure logs were already expired and are not recoverable. The seven CHARTER §3
routines missing from the local scheduler were **not** confirmed dead — I cannot read the CCR
trigger fleet from this session. Nothing was pushed to `main`, no PR merged, no auto-merge armed, no
production variable touched, no migration applied, and no lender contacted.

---

## Proposed tickets — for Evening Triage to land

1. **Reconcile the scheduler with CHARTER §3, in one session, both directions (§11).** Three
   cadence rows are wrong (this routine daily→Mondays; vendor weekly→monthly; Launch Gate's retired
   RELEASABLE verdict), three registered routines have no CHARTER row — **two of which write code**
   (`workflow-completion-engine`, `feature-completion-engine`) and so need §6 territory rows and §5
   claim discipline before they collide with the Wiring Audit and the Primary Engineer — and seven
   CHARTER rows have no local task. Founder/L3 for the re-timing itself; the reconciliation write-up
   is Evening Triage's. Evidence §⛔2.
2. **Record the launch deferral in `CTO_ROADMAP.md` §1.3** (or state that it does not cover lender
   relationship-building). Four routine descriptions now encode a 2026-08-19 directive that no
   in-repo doc carries, so every routine that ranks off §1.3 — including this one, by its own
   prompt — is ranking off a retired premise. Evidence §⛔1.
3. **Add the contradiction leg to F-055** and re-rank it. Specifically: occupancy's section is
   **not** in `GATING_SECTIONS`, so unlike its five siblings it is unreachable-by-gate *in
   principle*, not merely blocked today by F-052/F-053; and `IntentToOccupyType` gives the fix a
   free, always-present cross-check, which means "omit rather than assert" costs no borrower
   friction. Suggest the remedy be a **validator** (contradiction is detectable) rather than only a
   mapper change. Still **ships with the F-052/053/054/080 cluster, never alone.** Evidence §4.
4. **Make section 3 gating, or make its `required: true` honest.** `mismoValidation.ts:310` marks
   Occupancy Type `required: true` inside a section that cannot block. Either it is required — in
   which case section 3 belongs in `GATING_SECTIONS` — or the flag is decorative and should say so.
   A `required` field that never blocks is the same class of lie as a test that early-`return`s.
   **Needs a human**: adding a gating section can block existing files, exactly the way
   `declarations.isUSCitizen` once blocked every real application (the comment at
   `mismoValidation.ts:350-363` is that scar), so it wants the data check that comment's history
   demands, not a routine's judgement.
5. **`PropertySection.tsx:133` should not display an answer it did not record.** The
   `|| "primary_residence"` display default makes a NULL column indistinguishable from a chosen
   answer on the one surface that could have caught it. Either seed state on mount or render an
   explicit unselected placeholder. Small, capture-path, Wiring Audit's territory — **not** taken
   here because it is `client/src/**` on the capture path (CHARTER §6) and fixing the display
   without the emitter would move the lie rather than remove it.
6. **Carry forward, unchanged from 2026-08-12 and still open:** install `libxml2-utils` in the CI
   `gate` job (the XSD cases now report *skipped* rather than falsely passing, but CI still may not
   run them); promote the H8 `mismo-export` role gate (`tests/mismoExportAccess.test.ts`, a route
   emitting full SSN + DOB) out of the integration lane, which never runs in CI.

STATUS: WARN
