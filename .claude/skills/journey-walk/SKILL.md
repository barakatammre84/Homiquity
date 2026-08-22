---
name: journey-walk
description: Walk one client journey end to end in the real browser as that persona, and report the seams — use when the user invokes /journey-walk, asks to "walk the borrower journey", "walk the app as a renter / self-employed / move-up buyer", or asks what a client actually experiences across surfaces. NOT for single-page UI questions (ui-components), layout/overflow sweeps (app-walker), or API-level workflow proving (workflow-prover).
---

# Journey Walk — experience the product as one continuous thing

**Writes code:** no. Findings only.
**Charters:** [knowledge-base/feature-review/JOURNEYS.md](../../../knowledge-base/feature-review/JOURNEYS.md)
**Program rules:** [knowledge-base/feature-review/CHARTER.md](../../../knowledge-base/feature-review/CHARTER.md)
— it wins over this file on any conflict; say so in the report rather than following the stale copy.

## Why this skill exists

The client `journey-walker-*` agents are durable subagents. Subagents are invisible: they do not
appear in any list a person reads, they are only spawnable by an orchestrator who already knows
their names, and **a new one is not registered until the session restarts**. A control nobody can
find is not a control. This skill is the front door — one slash command, every client journey, no need to
remember an agent name.

## What a journey catches that nothing else does

`DOMAINS.md` proves a subsystem against its intended use. `WORKFLOWS.md` proves a system
transaction over HTTP. `ui-conformance-sweep` and `app-walker` grade a surface. **None of the four
is continuous.** A domain reviewer never leaves its domain; a workflow verifier holds a cookie jar
and never re-renders a nav; a surface auditor sees one page at one role.

A journey is the only lens whose subject is the space **between** them: a value dropped crossing a
boundary, a role that changes under a live session, a promise made on one surface with no surface
that keeps it, a persona that runs out of next step. That is also the repo's dominant defect class
— *silent success* and the *capture path* — so this is where the finding density is.

## The five seats

| Journey | Agent | Owns |
|---|---|---|
| 1. Aspiring owner (renter, sandbox) | `journey-walker-aspiring-owner` | the sandbox's floor; never crosses the application boundary |
| 2. Active buyer — W-2 salaried | `journey-walker-w2-buyer` | the `aspiring_owner → active_buyer` promotion seam |
| 3. Active buyer — self-employed | `journey-walker-self-employed` | the `complexIncome` branch carry |
| 4. Active buyer — move-up / jumbo | `journey-walker-affluent` | the door with no explainer; promise-vs-reachability |
| 5. Active buyer — condo / project | `journey-walker-condo-buyer` | the **property** axis — whether answering `condo` changes anything the borrower is shown |

## Rails

**Binding. Each maps to a failure this design is meant to prevent.**

- **W1 — One journey per run.** A run takes ONE charter. Five journeys in one run produces five
  shallow walks and a register full of duplicates. **One exception, by design:** journey 5 walks a
  `single_family` *control pass* alongside its condo pass — that is one journey walked twice, not
  two journeys, and without the control its central finding cannot be stated.
- **W2 — Browser or nothing.** The walker's first action is a browser call; absence ⇒ `BLOCKED`,
  and you report that verdict unchanged. **Never accept a walk that was driven with `curl`** —
  substituting HTTP calls and reporting a walk is a `FAIL` for the run (CHARTER §9). *Verified
  2026-08-19: pointed at a dead port, `journey-walker-aspiring-owner` correctly returned `BLOCKED`
  and refused to substitute a live port on its own initiative.*
- **W3 — Local only, and know what you are pointed at.** Default `http://localhost:5001`. **Never
  the deployed site.** A local `/api/health` answers `commit: null` on every branch, so it cannot
  identify a checkout — use `lsof -a -p <pid> -d cwd` plus process start time. Stale listeners are
  the norm: on 2026-08-19 the `:5002` "worktree" port was still served by a **14-day-old orphan**
  from the deleted `launch-hygiene` worktree, whose `/api/health` returned only
  `{status,timestamp}` while current code also returns `commit` and `email` — that missing key is
  the cheapest tell. **A right checkout can still serve stale server code**: `pnpm dev` is
  `tsx server/index-dev.ts` with no watch flag, so the server half freezes at process start while
  the client stays current per request. Check the process start time against `server/**` mtimes
  before attributing any server-side finding to HEAD.
- **W4 — Seams, not surfaces.** A finding must need **two surfaces to be visible**. Single-surface
  issues come back as `HANDOFF` lines with no id, and you route them **to the seat that can act**:
  a file with an owner → its `hq-*-owner` agent (`knowledge-base/handbook/FEATURE_MAP.md` maps every
  path to exactly one, and owners implement); behaviour with no owner → the domain's
  `feature-reviewer`; friction/uniformity/copy → `ux-reviewer`; layout/overflow/touch targets →
  `app-walker`. **Do not let a walker mint an id for another seat's finding** — the register has
  already paid for that once.
- **W5 — Nothing enters the register unverified.** Every `J-<MMDD>-<NN>` goes through
  `finding-verifier` before `FINDINGS.md`, and anything flagged `compliance-risk: yes` also needs a
  `compliance-auditor` verdict. CHARTER §2 is not relaxed for journeys.
- **W6 — Test data discipline.** `journey-walker-aspiring-owner` signs up **fresh** as
  `jr+<MMDD>@test.local` and **must never apply** — *(amended 2026-08-20: the seeded `renter@test.com`
  seat is retired as the primary; its central surface keys on the account's own rows and the dev DB
  had polluted it — see `JOURNEYS.md` §1 for the probe if you want the seeded seat anyway)*. The
  buyer walkers self-register `jw2+` / `jse+` / `jaf+` / `jcd+<MMDD>@test.local`; **never `buyer@test.com`**,
  which is pinned to `active_buyer` and cannot cross the promotion seam. No destructive SQL, never
  `pnpm db:push`, never touch a row you did not create.
- **W7 — You never fix.** This skill reports. Fixes are triaged into waves by the founder, or
  claimed by a builder seat via `knowledge-base/routines/REGISTER.md`.

## Procedure

1. **Pick the journey.** If the user named a persona, map it to a seat above. If they did not, pick
   the next row in `knowledge-base/routines/journey-walk/LEDGER.md` — **strict rotation**, the one
   selection rule this lane has (the ledger, not "oldest Last walked"; two rules diverge the first
   time a run is `BLOCKED`) — and say which and why. Staff desks are a separate lane:
   `/staff-journey-walk`.
2. **Establish a server.** If nothing listens on 5001, start one; if something does, identify its
   checkout per W3 before trusting a single observation.
3. **Spawn the seat** with the Agent tool, passing: the journey number, the base URL, and any
   narrowing the user asked for. Let it run — it is a long walk, not a query.
4. **Adversarially verify** what comes back before you repeat it. The walker is primed to read
   absence as evidence, so a flaky render and a dropped seam look identical: a `DROPPED` verdict
   needs the rendered page **and** the wire (or the stored value) to disagree, otherwise it is
   `INCONCLUSIVE` and the seam is re-walked, not filed. Run surviving findings past
   `finding-verifier`.
5. **Report.** Relay the walk verbatim in the walker's output shape, then update the `JOURNEYS.md`
   ledger row (`Last walked`, `Verdict`, and the gate state the verdict was earned under). Registered
   findings go to `FINDINGS.md` only after step 4.

## Status rules

`WALKED` = the whole route driven in a browser, every charter seam asserted, the CLEAN block
naming what was found carrying. `WALKED-WITH-FINDINGS` = the same, plus verified `J-` findings.
`DEAD-ENDED` = the persona ran out of next step partway, which is itself the finding.
`BLOCKED` = no browser, or the base URL would not open — an honest verdict, never a degraded pass.

**A walk that finds nothing is suspicious before it is reassuring.** The seams this hunts were
invisible to every green guard in the repo; if a walk comes back clean, confirm the walker actually
rendered pages rather than reasoning about them.
