# The core team — seven seats, one working day

**Status:** binding on the seats named below. **Owner:** founder (Amr).
**Authority:** [`CHARTER.md`](CHARTER.md) wins over this file on any conflict, and every rail there
applies to every seat here. This file adds the seating chart and the hand-off protocol; it relaxes
nothing.
**Last verified against the code:** 2026-08-18.

> ⚠️ **Partly superseded 2026-08-19 by the prove-it-first suite rewrite** ([`CHARTER.md`](CHARTER.md)
> §1a, §3). The *role* mapping below still holds; the **clock and the seat list do not**. Three seats
> were retired, two were reshaped, one was promoted to daily, and two new build lanes were added.
> **Read `CHARTER.md` §3 and `list_scheduled_tasks` for who actually runs** — this file is a
> seating chart, not a registration, and §0 there is about exactly that confusion.

> **Freshness:** last verified 2026-08-18 · review every 60 days

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

Seven seats. **Four were already staffed** — the finding that produced this file is that the
fleet's gaps and the hiring plan's gaps are the *same* gaps, and both are on the non-engineering
side. We had built the builders and skipped the domain, the vendor edge, and the adversarial check.

| Seat | Hiring-plan role | Routine | Cadence | Writes code? |
|---|---|---|---|---|
| **Domain** | Mortgage SME (§2.1) | **Domain Oracle** *(new)* | daily 08:20 | no |
| **Integrations** | Mortgage-systems eng. (§2.2) | **Integration Readiness** *(new)* | daily 10:40 | no |
| **Build — product** | Senior full-stack (§2.3) | Primary Engineer | daily 07:21 | yes |
| **Build — backend** | Senior full-stack (§2.3) | Backend Data Engineer | daily 11:00 UTC | yes |
| **Build — capture path** | Senior full-stack (§2.3) | Frontend Wiring Audit | daily 09:20 | yes |
| **QA — find** | QA engineer (§2.4) | Deliverable QA Sweep | daily 15:05 | no |
| **QA — prove** | QA engineer (§2.4) | **QA Mutation Verifier** *(new)* | daily 16:20 | throwaway only |

**Supporting seats, unchanged:** Launch Gate (07:48) holds the `RELEASABLE` verdict · Lender
Delivery Gate (12:31) judges the package · Compliance Watch (Tue 13:21) holds the licensing ladder
and is the counsel seat · Vendor & Procurement (Mon 09:37) holds commercial state · Refactor Radar
(Sun 20:00) · Evening Triage (21:10) consolidates the day.

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
