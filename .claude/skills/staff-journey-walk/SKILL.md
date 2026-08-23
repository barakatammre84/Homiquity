---
name: staff-journey-walk
description: Walk one STAFF desk end to end in the real browser — as the seeded staff seat AND as its counterpart — and report the handoffs between desks and what the borrower sees of them. Use when the user invokes /staff-journey-walk, asks to "walk the LO / processor / underwriter / closer / broker journey", or asks what staff actually experience moving a file. NOT for client journeys (journey-walk), single-page UI questions (ui-components), or API-level workflow proving (workflow-prover).
---

# Staff Journey Walk — one file, many hands

**Writes code:** no. Findings only.
**Authority:** the Fannie Mae *Selling Guide*, edition 08-05-2026, in-repo at
[docs/fannie-mae/selling-guide/](../../../docs/fannie-mae/selling-guide/) — the golden handbook
behind every domain claim a desk's surface makes (CHARTER §1a). A finding that asserts Fannie
policy cites the section id; never from memory.
**Charters:** [knowledge-base/feature-review/STAFF_JOURNEYS.md](../../../knowledge-base/feature-review/STAFF_JOURNEYS.md)
**Program rules:** [knowledge-base/feature-review/CHARTER.md](../../../knowledge-base/feature-review/CHARTER.md)
— it wins over this file on any conflict; say so in the report rather than following the stale copy.
**Client lane:** [journey-walk](../journey-walk/SKILL.md) — a different shape; do not merge the two.

## Why this skill exists

The five `journey-walker-staff-*` agents are durable subagents, and a subagent nobody can find is
not a control. This is the front door — one slash command, five desks.

## What a staff journey catches that nothing else does

A client journey is one persona crossing many surfaces. A staff journey is **one file crossing many
hands** — LO → processor → underwriter → closer — with the borrower on the far side of every
decision. Its seam is the **handoff between desks** and the **borrower-side consequence of a staff
action**. A domain reviewer reviews at one role; a workflow verifier holds one cookie jar and never
re-renders a nav; a UX reviewer grades one page at one role; the client walkers never hold a staff
session. That is why domain 11 has never been reviewed and why every open staff finding was found
from the borrower side or from code — never by someone sitting at the desk.

## The five desks

| Desk | Agent | Counterpart | Owns |
|---|---|---|---|
| S1. Loan officer (+ `loa` variant) | `journey-walker-staff-lo` | the invited borrower; admin for one optional code | the seven-hop attribution chain — pointer **and** team row **and** `LoanTeamCard` — where the server is non-fatal |
| S2. Processor | `journey-walker-staff-processor` | the borrower; admin for one team-add | one document rendered by two roles across two vocabularies |
| S3. Underwriter | `journey-walker-staff-underwriter` | two borrowers (denied / pre-approved); admin for team-add | the decision both directions, then *can the borrower find the notice* (ux-24) |
| S4. Closer — the desk with no verb | `journey-walker-staff-closer` | underwriter funds; borrower for graduation | promise vs reachability for a named role with no verb; expected `DEAD-ENDED (by design)` |
| S5. Broker — sees the stage, must not see the file | `journey-walker-staff-broker` | the referred borrower only — **no admin** | the only negative headline in either fleet: `MUST-NOT-CARRY`, a leak is P0 |

Not seated: **admin** (bypasses every gate — the counterpart, not a seat; provisioning is a
`WORKFLOWS.md` row), **loa** (folded into S1), **lender** (deferred by policy). The charter records
why, so the question is not reopened.

## Rails

**Binding. Each maps to a failure this design is meant to prevent.**

- **S1 — One desk per run.** A run takes ONE charter. Two sessions is not two journeys — it is one
  journey seen from both sides, and without the counterpart the central assertion cannot be stated.
- **S2 — Browser or nothing.** The walker's first action is a browser call; absence ⇒ `BLOCKED`,
  reported unchanged. **Never accept a walk driven with `curl`** — a `FAIL` for the run (CHARTER §9).
  S4 is the sharpest case: proving the closer path over HTTP is `workflow-verifier`'s job, and a
  journey proves what a person can reach.
- **S3 — Local only, own worktree, own port.** Never the deployed site. Add a worktree at
  `origin/main`, `pnpm install`, copy `.env`, `PORT=5003 bash scripts/dev-up.sh`, and verify the
  process with `lsof -a -p <pid> -d cwd`. **`PORT=5003 bash scripts/dev-up.sh down` at the end is a
  rail** — the `:5002` port was once served by a 14-day-old orphan from a deleted worktree. A right
  checkout can still serve stale server code (`tsx` with no watch flag): compare process start time
  against `server/**` mtimes before attributing a server-side finding to HEAD.
- **S4 — Seams, not surfaces — and two roles count as two surfaces.** A finding must need two
  surfaces to be visible. For a staff walker, *offered by the client, refused by the server* is a
  client↔server seam — but per the route-gate-drift doctrine it is a **HANDOFF to the client file's
  owner citing F-0818-13**, never a minted id, because the fix is to narrow the client. Only *named
  role, no verb, no path* (the closer's `funded`) mints a `DEAD-END`, once. Route every single-surface
  hand-off to the `hq-*-owner` that can act; four files on the staff spine (`statusDecisions.ts`,
  `dealTeam.ts`, `app-sidebar.tsx`, `ApplyInvite.tsx`) carry **provisional** owners in
  `FEATURE_MAP.md` — name the owner and say "provisional".
- **S5 — Nothing enters the register unverified.** Every `JS-<MMDD>-<NN>` passes `finding-verifier`
  first; anything `compliance-risk: yes` also needs `compliance-auditor`. The walker is primed to read
  absence as evidence — a `DROPPED` handoff needs the rendered page **and** the wire to disagree,
  otherwise `INCONCLUSIVE` and re-walked.
- **S6 — Test-data discipline, privileged edition.** Seeded `/test-login` seats for the staff role
  (the role is rewritten on every login, so the seat self-heals); the borrower is a **fresh**
  `jst+<MMDD><seat>@test.local` the walker creates and **the only file it acts on**. Admin is opened
  for exactly two verbs (team-add of the seat to its own file; one staff-invite code for S1's optional
  leg), each listed with its audit action. Never change a role, never `force`, never deliver a
  notice, never run a sweep, never click the Intelligence tab (F-0820-20). At the end the borrower
  **withdraws** the file from the UI unless it is terminal.
- **S7 — You never fix.** This skill reports. Fixes are triaged by the founder or claimed by a
  builder seat via `knowledge-base/routines/REGISTER.md`.

## Procedure

1. **Pick the desk.** If the user named a role, map it above. If not, take the next row in
   `knowledge-base/routines/staff-journey-walk/LEDGER.md` — **strict rotation S1 → S5 → S1**, one
   rule only. A `BLOCKED` run does not advance the rotation.
2. **Establish a server** per S3 — your own worktree, your own port.
3. **Spawn the seat** with the Agent tool, passing the desk number, the base URL, and any narrowing
   the user asked for. It is a long walk (a full funnel as setup, two sequential sessions, a retire
   leg) — let it run.
4. **Adversarially verify** before repeating anything: S5 above. Check `ADMIN-ACTIONS:` against
   `auditLog` — two verbs, no more. Check `FILE:` says `retired:`.
5. **Report.** Relay the walk verbatim in the walker's output shape; update the `STAFF_JOURNEYS.md`
   ledger row **and** the LEDGER **in the same PR** — the client lane's two ledgers already drift.
   Registered findings reach `FINDINGS.md` only after step 4. Tear the server down.

## Status rules

`WALKED` = the whole route driven in a browser as both sessions, every charter seam asserted, the
CLEAN block naming what carried. `WALKED-WITH-FINDINGS` = the same plus verified `JS-` findings.
`DEAD-ENDED (by design)` = S4's expected verdict, cited not re-minted. `BLOCKED` = no browser or no
server — honest, never a degraded pass.

**A staff walk that finds nothing is suspicious before it is reassuring** — the handoffs it hunts
have never been walked. Confirm the walker actually held both sessions (the `SESSIONS:` block has
timestamps and 401s) rather than reasoning about the counterpart.
