# The core team — eight seats, one working day

**Status:** binding on the seats named below. **Owner:** founder (Amr).
**Authority:** [`CHARTER.md`](CHARTER.md) wins over this file on any conflict, and every rail there
applies to every seat here. This file adds the seating chart and the hand-off protocol; it relaxes
nothing.
**Last verified against the code:** 2026-08-19.

> ⚠️ **Partly superseded 2026-08-19 by the prove-it-first suite rewrite** ([`CHARTER.md`](CHARTER.md)
> §1a, §3). The *role* mapping below still holds; the **clock and the seat list do not**. Three seats
> were retired, two were reshaped, one was promoted to daily, and two new build lanes were added;
> the **Doc Accuracy** steward was re-seated daily at 19:30 on 2026-08-20 (CHARTER §3 — not a
> hiring-plan seat, so no row below), and the local fleet was paused 2026-08-22 (8 GB laptop), so
> any `Registered?` column below is the 2026-08-20 state.
> **Read `CHARTER.md` §3 and `list_scheduled_tasks` for who actually runs** — this file is a
> seating chart, not a registration, and §0 there is about exactly that confusion.

> **Freshness:** last verified 2026-08-19 · review every 60 days

---

## 0. Why this file exists

[`HIRING_PLAN.md`](../governance/HIRING_PLAN.md) names the roles we would hire. This file assigns
each of those roles a **seat** in the routine fleet, so the fleet reads as a team rather than as a
dozen strangers who happen to share a repository.

That distinction is not cosmetic. The 2026-08-18 knowledge-file audit found the two fleets
**blind to each other**: three triggers cited documents that did not exist, and neither list knew
the other existed. A group of routines that cannot hand work to each other is not a team, however
good each one is alone.

---

## 1. The seating chart

Eight seats **as designed** — but read the registration column: three are staffed, five are not.
The finding that produced this file is that the fleet's gaps and the hiring plan's gaps are the
*same* gaps, and both are on the non-engineering side. We had built the builders and skipped the
domain, the vendor edge, and the adversarial check. Two days on, the builders are still the only
seats that run — the same finding, a second time.

⛔ **This chart drifted from the scheduler, and the drift is the exact failure the file exists to
prevent.** Read live from `list_scheduled_tasks` on **2026-08-20**: of the eight seats below, **three
are registered and five are not.** A seating chart that lists a routine nobody runs is §0's fossil
wearing a team's clothes — so every row now carries its registration state, and the **Registered?**
column is the only column here that is a fact about the scheduler rather than an intention.

Three different causes, none of them sloppiness:

- **Domain Oracle, Integration Readiness and QA Mutation Verifier** were added 2026-08-18 and stated
  plainly at the time as *"defined but not registered — registration is a founder action"* (CHARTER
  §3). They have been correct-but-unstaffed ever since. This chart simply never said so.
- **Complex File Engine** was registered, then **retired 2026-08-20T16:22:57Z** (CHARTER §3's
  retirement list) on a finding — verified at the time — that its definition was not on
  `origin/main`. That was true when checked and false **two minutes thirty seconds later**: PR #589
  merged the definition at **16:25:27Z**. Nobody erred; the check and the merge raced. The subject
  outlived the seat: the UAL qualification layer is now a standing priority segment of the
  **Feature Completion Engine's** domain rotation, carrying its rails verbatim — it may not edit
  `underwritingEngine.ts`, `decisionEngine.ts` or `ruleEngine.ts`, and may not change regulated
  math at all.
- **Backend Data Engineer** sits on the CCR fleet, where every trigger has read `enabled: false`
  with zero recorded runs since 2026-08-18 (CHARTER §3a).

**The rule this earns:** a seat is registered or it is a proposal, and the chart must say which.
Re-read `list_scheduled_tasks` when you edit this table — the scheduler is the authority, this file
is the map, and a map nobody re-measures is how five seats came to look staffed.

<!-- BEGIN GENERATED seats:team — do not hand-edit; run `pnpm guard:seats --write-table` -->

| Seat | Routine (`taskId`) | Cadence | Writes code? | Registered? (generated from `SEATS.tsv`) |
|---|---|---|---|---|
| **Selling Guide Steward** | `selling-guide-steward` | daily | yes — Guide fact layer + its watch state only | ⚠️ registered and enabled — **NOT DISPATCHING** |
| **Primary Engineer** | `primary-engineer` | daily | yes — company-wide lane | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Trunk Health** | `launch-gate` | daily | no — tickets only | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Capture Path Engineer** | `act-as-a-senior-frontend-architect-i-need-you-to-audit-the-wiring-and-structural-integrity-of-mortgage-streamhomiquity` | daily | yes — capture path | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Workflow Completion Engine** | `workflow-completion-engine` | daily | yes — one seam per run | ⏸️ registered, **paused** |
| **Backend Data Engineer** | `backend-data-engineer` | daily | yes — `server/**`, `shared/**` + same-PR migration | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Feature Completion Engine** | `feature-completion-engine` | daily | yes — one domain per run | ✅ **enabled** |
| **Staff Journey Walk** | `staff-journey-walk` | daily | no — trace + tickets | ⏸️ registered, **paused** |
| **Deliverable QA Sweep** | `deliverable-qa-sweep` | daily | no — findings only | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Client Journey Walk** | `client-journey-walk-v2` | daily — recommended, never registered | no — trace + tickets | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Handoff Corpus Steward** | `client-journey-walk` | daily | no — `knowledge-base/handoff/**` docs only | ✅ **enabled** |
| **Doc Accuracy** | `doc-accuracy-daily` | daily | docs only — living `.md` (§6) | ✅ **enabled** |
| **Evening Triage** | `evening-triage` | daily | docs only | ✅ **enabled** |
| **Refactor Radar** | `refactor-radar-weekly` | weekly | yes — `client/src` only | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Lender Package Gate** | `lender-delivery-gate` | weekly | small/safe only | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Compliance Watch** | `compliance-watch` | weekly | no — ladder + drafts | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Rent Reporting Watch** | `rent-reporting-watch` | weekly | no — report only | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **UI Conformance Sweep** | `ui-conformance-sweep` | weekly | yes — `client/src/**` visual only | ✅ **enabled** |
| **Vendor & Platform Risk** | `vendor-procurement` | monthly | no | ⛔ **NO** — definition on disk, not in the scheduler (§11) |
| **Complex File Engine** | `complex-file-engine` | — | — | — retired |
| **Move-Up Lane** | `move-up-lane` | — | — | — retired |
| **Sprint Blitz** | `sprint-blitz` | — | — | — retired |

<!-- END GENERATED -->

**The `Registered?` column is generated from [`SEATS.tsv`](SEATS.tsv)** — it can no longer disagree
with the roster. It used to: on 2026-08-24 this chart marked Primary Engineer, the Capture Path
Engineer and the Deliverable QA Sweep **"✅ yes"** when none of the three was registered, which is
the failure the rule above describes, in the table that states it. The hiring-plan role mapping
(§2.1–§2.4 of [HIRING_PLAN.md](../governance/HIRING_PLAN.md)) is prose and stays below.

**Supporting seats — what each is *for*.** Cadence and registration are in the generated table
above and in [`SEATS.tsv`](SEATS.tsv); this paragraph is about purpose only, so it cannot drift into
a second clock. **Trunk Health** answers whether the lanes can build today · the **Lender Package
Gate** judges the package · **Compliance Watch** holds the licensing ladder and is the counsel seat ·
**Vendor & Platform Risk** holds commercial state and watches the platform floor · **Refactor Radar**
takes at most one `client/src` PR a week · **Evening Triage** consolidates the day.

*Corrected 2026-08-24.* This paragraph previously read "Supporting seats, **unchanged**" and named
three things that had changed: the Launch Gate holding a `RELEASABLE` verdict (retired with the seat
when it became Trunk Health, 2026-08-19), the Lender Delivery Gate at 12:31 (moved to Mon 18:31 the
same day), and the **Move-Up Lane** (retired into the Feature Completion Engine's rotation, also
2026-08-19). Vendor & Procurement had likewise become Vendor & Platform Risk. The word "unchanged"
was doing the damage: it invited readers past the one thing worth re-checking.

**Review seats reachable by name:** the client `journey-walker-*` agents walk one client journey each
in a real browser (`knowledge-base/feature-review/JOURNEYS.md`), fronted by **`/journey-walk`**; the
five `journey-walker-staff-*` agents walk one staff desk each as the seat **and** its counterpart
(`knowledge-base/feature-review/STAFF_JOURNEYS.md`), fronted by **`/staff-journey-walk`** and run
daily at 13:40 by `staff-journey-walk`. Together they are the only lens in the fleet whose subject
is the space *between* surfaces and *between* desks, and the only seats that re-verify a builder's
fix from the person's side — **no seat signs off its own.**

### Seats with no routine, and deliberately so

- **AppSec** — quarterly and event-driven, not daily. The §9 gate already blocks the merge; a daily
  routine would find nothing on most days and become boilerplate.
- **Product designer** — [`DESIGN_SYSTEM.md`](../handbook/design/DESIGN_SYSTEM.md) plus the UI
  conformance sweep already carry the standard.
- **Licensed MLO and processor** — statutory human roles (CHARTER §1b, L4). No routine may occupy
  a seat the law assigns to a person, and none of the seats above may be read as doing so.

---

## 2. Why only three routines were added

Each new seat had to pass one test: **what does it catch that nothing else does?**

| Candidate | Verdict | Reason |
|---|---|---|
| Domain Oracle | **added** | Nothing in the fleet can say whether a rule is *real*. Compliance Watch tracks licensing; the delivery gate checks edits, not the guideline the package asserts. |
| Integration Readiness | **added** | Nothing records, per adapter, the distance between simulation and a signed contract. That distance currently gets discovered at contract time. |
| QA Mutation Verifier | **added** | The sweep *finds* defects; nothing verifies a **fix** is load-bearing. A test that passes with and without the fix is invisible to every guard. |
| Move-Up Lane | **added 2026-08-19** | Nothing owns the above-conforming borrower. Complex File Engine owns income *complexity*; jumbo is loan *size*, a different axis. Primary Engineer is launch-ranked, and launch is Illinois-first conforming business, so this lane never reaches the top of its queue. Weekly, not daily, so it does not contend with the three daily builders. **What it caught on day one:** the funnel gated its jumbo advisory on the 2024 limit (`766550` vs `806_500`), telling conforming borrowers they were jumbo across a $40k band — green under a one-limit test that named two files and could not see the funnel. |
| Staff-journey walkers (×5: lo, processor, underwriter, closer, broker) | **added 2026-08-22** | A staff journey is one file crossing many hands; its seam is the handoff between desks and the borrower-side consequence of a staff action. Every existing lens holds one role — domain 11 has never been reviewed, no workflow covers "LO invites a client", and every open staff finding came in from the borrower side or from code. **Admin is not a seat** (it bypasses every scoping gate and so can see no seam gates create — it is the counterpart with two verbs); **loa** is folded into the LO seat (every difference is a subtraction that renders as a 403); **lender** is deferred by policy. The closer seat is scoped like the affluent one — to the absence — and is expected to report `DEAD-ENDED (by design)`, minted once. |
| Client-journey walkers (×4) | **added 2026-08-19** | Report-only, so no file contention. Every existing seat is discontinuous — a domain reviewer never leaves its domain, a workflow verifier never re-renders a nav, a surface auditor sees one page at one role. Nothing could see a value dropped crossing a boundary or a promise with no surface that keeps it. |
| A white-glove / concierge service tier | **rejected — not a routine at all** | No such tier exists in the product, and a service promise is a staffing and Reg N commitment, not code. Move-Up Lane rail M2 forbids any routine from creating one; it is a founder decision, escalated as a proposal. |
| A full-stack routine | rejected | Three seats already build daily. A fourth would contend for the same files and the founder's merge throughput, which is the real constraint. |
| A standup routine | rejected | Evening Triage (21:10) already consolidates the day. A second consolidator is two sources of truth — the failure that closed PR #558. |
| A counsel routine | rejected | Compliance Watch is that seat. |

**The rule this table encodes: a new routine must catch something, not merely represent someone.**
An org chart is not a control.

---

## 3. The working day

All three new seats are **report-only or throwaway-only**, so none of them can collide with the
builders. That is a deliberate property, not a coincidence — the fleet's scarcest resources are
write access to `client/src/**` and the founder's merge attention, and neither is spent here.

```
07:21  Primary Engineer ........ builds        ── consumes yesterday's DECISIONS + VERDICTS
07:48  Launch Gate ............. verdict
08:20  Domain Oracle .......... adjudicates    ── emits DECISIONS
09:20  Frontend Wiring Audit ... builds
10:40  Integration Readiness ... scores        ── emits ASKS
11:00Z Backend Data Engineer ... builds
12:31  Lender Delivery Gate .... verdict
15:05  Deliverable QA Sweep .... finds
16:20  QA Mutation Verifier .... proves        ── emits VERDICTS
21:10  Evening Triage .......... consolidates  ── reads the whole board
```

The order is the argument: **the domain answers before the builders build, and the prover runs
after the finders find.** A seat that runs before its upstream is a seat working from yesterday's
truth, which is how the previous suite spent five weeks gating everything behind an NMLS ID that
had already been issued.

---

## 4. The hand-off protocol

[`HANDOFF.md`](HANDOFF.md) is the board. It is **not** the claim lock — that is
[`REGISTER.md`](REGISTER.md), and both still apply: claim files there, hand off work here.

Four block types, appended by the seat that owns them:

| Block | Emitted by | Means |
|---|---|---|
| `DECISIONS` | Domain Oracle | A rule now has a cited verdict. A builder may implement it. |
| `ASKS` | Integration Readiness | An engineering requirement a contract or a builder must satisfy. |
| `VERDICTS` | QA Mutation Verifier | A merged fix is `PROVEN` or `UNPROVEN`. |
| `WAITING` | any seat | This seat is blocked on another. **Names the seat**, never "someone". |

**Three rules on the board:**

1. **A row names its next seat.** "Needs review" with no owner is not a hand-off, it is a wish.
2. **A `WAITING` row outranks ordinary queue order** for the seat it names. Blocking a peer is
   worse than a slow day.
3. **Clear your own rows.** A board nobody clears becomes a board nobody reads — the same rule, and
   the same reason, as REGISTER.md rule 4.

---

## 5. The rule that makes this a team rather than a fleet

**No seat signs off its own work.**

The builders build; the QA seats find and prove; the Domain Oracle decides what is true and writes
no code. That separation is the whole point of the three additions — a seat that both ships a fix
and certifies it has certified nothing. It is also why the QA Mutation Verifier is forbidden from
fixing what it finds, however small: the moment it does, the next day's verdict is self-graded.

The two rails that hold above every seat, unchanged from [`CHARTER.md`](CHARTER.md):

- **Merging stays human.** A merge to `main` is a production deploy (§1b, L3). No seat merges,
  enables auto-merge, or touches a production variable.
- **A routine that cannot be shown to have run is not a control** (§0). Each seat's report is its
  evidence; a missing report is a finding for Evening Triage, not an absence to be assumed benign.
