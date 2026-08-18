# Hiring Plan — the team that gets Homiquity originating

**Status:** binding on how we open, run and close a role. **Owner:** founder (Amr).
**Authority:** subordinate to [`CHARTER.md`](../routines/CHARTER.md) §1b (the decision-authority
matrix) and [`TEAM_PRACTICES.md`](TEAM_PRACTICES.md) (how work lands). Where this file and either
of those disagree, they win and this file is the bug.
**Last verified against the code:** 2026-08-18.

> **Freshness:** last verified 2026-08-18 · review every 90 days

---

## 0. The reframe this plan rests on

We are not hiring a team to build an MVP. Measured on 2026-08-18:

| Area | Files | Lines |
|---|---|---|
| `client/src` | 607 (385 under `pages/`) | 102,416 |
| `server` | 288 (81 route modules) | 80,274 |
| `shared` | 95 | 22,468 |
| `tests` | 225 | 42,566 |
| `migrations` | 57 | 5,457 |

Plus 188 `pgTable` definitions in [`shared/schema/`](../../shared/schema/). Reproduce with:

```bash
find server -type f -name '*.ts' | wc -l && grep -rho "pgTable(" shared/schema/ | wc -l
```

The underwriting engine, MISMO 3.4 export, dual-AUS simulation, pricing/LLPA, credit and adverse
action, and the broker submission workflow all exist in code today. **So the hire is not "build the
product." It is "finish, harden, license and transact."** That inverts the usual startup mix: fewer
generalist feature builders, more domain truth, vendor integration, and adversarial QA.

Two facts shape every role below:

1. **The dominant defect class here is silent success** — an operation that does not happen while
   the UI says it did. Four public forms rendered success on rejected POSTs; co-borrower URLA rows
   were dropped under the words "Everything is safely stored." Every one shipped past a green gate.
   A guard only asks its own question.
2. **Every vendor is a deterministic simulation behind an adapter.** A new engineer needs no vendor
   contract and no API key to be productive on day one. Use that in recruiting — it is unusual in
   this industry.

---

## 1. Hire order, and the org at first funded Illinois loan

Ranking follows [`CHARTER.md`](../routines/CHARTER.md) §1a: Illinois first, California second,
national on performance. A role earns its slot by how directly it unblocks an Illinois file.

| # | Role | Shape | Unblocks |
|---|---|---|---|
| 1 | **Mortgage SME / Ops lead** | FTE | Guideline truth. Every engineer hired before this one invents underwriting rules. |
| 2 | **Integrations / mortgage-systems engineer** | FTE | Sim → real: AUS, credit, pricing, e-sign, doc prep. The longest lead time to source. |
| 3–4 | **Senior full-stack engineer** ×2 | FTE | The backend-smarter-than-the-UI gap. |
| 5 | **QA / test-automation engineer** | FTE | The silent-success class. Weight higher than instinct suggests. |
| — | **Mortgage regulatory counsel** | Retainer | [`docs/reg-z/`](../../docs/reg-z/README.md) holds only a README; five ledger rows in [`data/regulatory/regulatory-ledger.json`](../../data/regulatory/regulatory-ledger.json) sit unverified for want of source text. |
| — | **AppSec / security** | Fractional | §9 triggers, PII vault, the SOC 2 question lenders will ask. |
| — | **Product designer** | Contract | Applied work — [`DESIGN_SYSTEM.md`](../handbook/design/DESIGN_SYSTEM.md) already exists. |
| — | **Sponsored MLO(s) + processor** | Licensed staff | Not an engineering hire. Without them nothing originates, whatever the software does. |

**Minimum viable team to a first funded IL loan: 5 FTE + 3 fractional.** Anything larger before
the first file closes is buying coordination overhead, not throughput.

---

## 2. Role scorecards

Each scorecard is written to be pasted into a job post and graded against. The **Disqualifiers**
row is the one that saves the most time — in this domain, confident fluency is cheap and
verifiable experience is not.

### 2.1 Mortgage SME / Ops lead — hire first

- **Mission.** Be the domain oracle, so that no rule in this codebase traces back to a guess.
- **Profile.** Ex-broker ops manager, wholesale AE, or a licensed MLO who has personally run files
  from intake to funding. 5+ years. Illinois experience is a strong plus.
- **First 90 days.**
  1. Adjudicate the open queue in [`UNDERWRITING_SCENARIO_INTAKE.md`](../compliance/UNDERWRITING_SCENARIO_INTAKE.md)
     into the shipped registry at [`UNDERWRITING_SCENARIOS.md`](../compliance/UNDERWRITING_SCENARIOS.md),
     each row carrying a guideline citation.
  2. Walk one organic (non-seed) borrower file end to end and write the gap list.
  3. Own acceptance for anything loan-shaped — nothing merges on their word alone, but nothing
     merges over their objection either.
- **Owns.** [`knowledge-base/compliance/`](../compliance/), the DU/LPA findings interpretation, the
  lender-package definition, Routine **R1** (§5).
- **Must have.** Reads a DU findings report cold. Knows what a wholesale lender rejects and why.
  Can say "I don't know, here is the guideline section" without discomfort.
- **Disqualifiers.** Cannot name a specific investor overlay they have fought. Answers guideline
  questions from memory with no instinct to cite. Has only ever worked retail consumer-direct and
  has never seen a lender submission package.

### 2.2 Integrations / mortgage-systems engineer — hardest to source, start now

- **Mission.** Replace deterministic simulations with real vendors without losing determinism.
- **Profile.** Engineer out of a LOS/POS vendor (Blend, Maxwell, LoanPASS, Encompass shops) or a
  wholesale lender's IT group. Has personally shipped an integration that moved a real loan.
- **First 90 days.** One vendor fully live behind its existing adapter boundary — credit is the
  right first target because [`NTHLA_609G_SPEC.md`](../compliance/NTHLA_609G_SPEC.md) already
  specifies the per-bureau data the contract must deliver.
- **Owns.** [`server/mismo.ts`](../../server/mismo.ts), [`shared/mismo.ts`](../../shared/mismo.ts),
  [`shared/fannieMae/`](../../shared/fannieMae/), [`server/services/ausSubmission.ts`](../../server/services/ausSubmission.ts),
  [`server/services/lenderSubmission.ts`](../../server/services/lenderSubmission.ts),
  [`server/integrations/`](../../server/integrations/). Routine **R2** (§5).
- **Must have.** Has read a MISMO spec in anger. Understands why an adapter boundary is a
  compliance artifact and not an abstraction preference.
- **Disqualifiers.** Would "just call the vendor SDK from the route." Treats XML schema mismatch as
  something to work around by inventing a field name — the one prohibition in root
  [`CLAUDE.md`](../../CLAUDE.md) that is never negotiable.

### 2.3 Senior full-stack engineer ×2

- **Mission.** Close the gap between what the backend already computes and what a borrower or
  partner can actually see and do.
- **Profile.** React 18 + Vite + TanStack Query + Shadcn/Radix on the front; Express + Drizzle +
  Postgres behind. Mortgage background optional **if** §2.1 is filled; mandatory if it is not.
- **First 90 days.** Ship inside the existing lanes: three merged PRs that each move a
  [`FINDINGS.md`](../feature-review/FINDINGS.md) row to Closed with a mutation proof.
- **Owns.** `client/src/**`, `server/routes/**`. Routine **R3** (§5).
- **Must have.** Comfort inheriting a large codebase and reading before writing. Instinct to prove
  a fix by reintroducing the bug.
- **Disqualifiers.** Opens with a rewrite proposal. Cannot explain how they would verify a fix
  beyond "the tests pass" — in this repo the tests passing is the *precondition*, not the evidence.

### 2.4 QA / test-automation engineer

- **Mission.** Make the silent-success class impossible to ship twice.
- **Profile.** QA engineer with financial-services or regulated-product exposure. Writes code.
- **First 90 days.** Own [`WORKFLOWS.md`](../feature-review/WORKFLOWS.md) as an executable suite
  rather than a document: every named workflow driven end to end against a local server, each step
  asserted on its observable outcome, not on the absence of an exception.
- **Owns.** [`tests/`](../../tests/), the three vitest lanes, Routine **R4** (§5).
- **Must have.** Understands that `await fetch` rejects on network errors only — and that this one
  fact accounts for four shipped defects here.
- **Disqualifiers.** Measures success in coverage percentage. Has never deliberately broken a fix
  to check the test would have caught it.

### 2.5 Fractional roles

| Role | Cadence | First deliverable | Owns |
|---|---|---|---|
| **Regulatory counsel** | Monthly + on-call | Answer the four asks in [`LAUNCH_COUNSEL_PACKET.md`](../compliance/LAUNCH_COUNSEL_PACKET.md); get authoritative Reg Z text into [`docs/reg-z/`](../../docs/reg-z/README.md), which today holds only a shopping list | Routine **R5** |
| **AppSec** | Quarterly + per §9 trigger | Independent review of the vault, session and role-gate surfaces named in [`TEAM_PRACTICES.md`](TEAM_PRACTICES.md) §9 | Routine **R6** |
| **Product designer** | Per project | Migrate the remaining capture surfaces to [`DESIGN_SYSTEM.md`](../handbook/design/DESIGN_SYSTEM.md) §12 | — |

---

## 3. Interview loops

**Universal rails.** Take-homes are paid, capped at four hours, and use only this repo running
locally — no vendor keys, no cloud access, no production. We never ask a candidate to work on a
real borrower file. Every loop ends with a written scorecard before debrief, so nobody anchors on
the loudest interviewer.

| Stage | SME | Integrations | Full-stack | QA |
|---|---|---|---|---|
| 1 — Screen (30m) | Founder | Founder | Founder | Founder |
| 2 — Domain / craft (60m) | File walkthrough | Integration design | Codebase reading exercise | Defect-class interview |
| 3 — Take-home (paid, ≤4h) | Brief 1 (§10) | Brief 2 (§10) | Brief 3 (§10) | Brief 4 (§10) |
| 4 — Review (60m) | Founder + counsel | Founder + SME | Founder + one engineer | Founder + one engineer |
| 5 — Reference (2 calls) | Someone who closed loans with them | Someone who shipped an integration with them | A peer and a manager | A peer |

**The bar, stated once:** would this person's judgment have caught the co-borrower URLA drop before
it shipped? If the loop cannot answer that, it is the wrong loop.

---

## 4. Take-home exercises — format only

**The briefs and their answer keys are deliberately not in this file.** This repository is public,
a good candidate reads it before interviewing — which is behaviour we want to select *for* — and a
published trap measures nothing. They live outside the repo (§10).

What is safe to state, and what a candidate is entitled to know up front:

- **Four exercises, one per role.** Paid, capped at four hours, and scoped so nobody works for free.
- **Drawn from real subsystems of this codebase**, run entirely on a local checkout. No vendor keys,
  no cloud access, no production, and never a real borrower file.
- **Graded on judgment, not diff size.** Each exercise contains one trap taken from a defect we have
  actually shipped. The pass condition is noticing it; a clean, confident answer that walks into the
  trap is the signal the exercise exists to produce.
- **Two of the four have "I cannot answer this from the sources available" as a correct response.**
  That is not a trick — it is the [no-citation-no-implementation contract](../compliance/UNDERWRITING_SCENARIOS.md)
  the job actually runs on.

---

## 5. Operating routines each role runs

**These are human routines, written in the shape of [`CHARTER.md`](../routines/CHARTER.md) §3 so the
two fleets read alike. None of them is registered as a scheduled task** — registration is a standing
configuration change and stays a founder action.

### The organising insight

The automated suite already *produces* findings faster than anyone closes them. Ten local routines
and a CCR fleet fill queues daily. **What is missing is a human accountable for draining each
queue.** So every routine below is defined as ownership of a queue a robot already fills, not as
new work invented for a new hire.

| ID | Routine | Owner | Cadence | Drains the queue filled by | Produces |
|---|---|---|---|---|---|
| **R1** | Scenario adjudication | SME | Weekly, Mon | Compliance Watch (Tue 13:21) + intake | Rows moved from intake → shipped registry, each cited |
| **R2** | Vendor cutover review | Integrations | Weekly, Mon | Lender Delivery Gate (12:31) + Vendor & Procurement (Mon 09:37) | One adapter advanced sim → contracted → live |
| **R3** | Findings burn-down | Full-stack | Daily | Primary Engineer (07:21), Frontend Wiring Audit (09:20), Backend Data Engineer (11:00 UTC) | ≤3 merged PRs closing `FINDINGS.md` rows |
| **R4** | Mutation audit | QA | Daily | Deliverable QA Sweep (15:05) | Verified/refuted verdicts; every accepted fix mutation-proven |
| **R5** | Regulatory posture | Counsel | Monthly | Compliance Watch + the unverified ledger rows | `UNVERIFIED` rows cleared with source text, or explicitly held |
| **R6** | Security trigger sweep | AppSec | Quarterly + per §9 trip | The §9 gate | Written review per tripping PR; unresolved CRITICAL blocks merge |
| **R7** | Launch go/no-go | Founder | Weekly, Fri | Launch Gate (07:48) + Evening Triage (21:10) | `RELEASABLE: yes/no` for Illinois, with the blocking list |

### The three rules that bind all seven

1. **Claim before writing.** Humans claim in [`REGISTER.md`](../routines/REGISTER.md) exactly as
   routines do — a routine cannot see anyone's editor, and the Frontend Wiring Audit, Primary
   Engineer and Refactor Radar all write to `client/src/**`.
2. **Report what did not happen.** A routine that cannot be shown to have run is not a control.
   That is why the previous five-routine suite went dark for five weeks unnoticed.
3. **Authority is per [`CHARTER.md`](../routines/CHARTER.md) §1b, and a hire does not raise it.**
   Merging to `main`, contract migrations, license filings, production variables, outbound
   regulator communication and each state's go/no-go stay L3 — prepared by anyone, signed by the
   founder. A new title does not move a rail; only the founder does, knowingly.

---

## 6. Onboarding on a Mac — day 1 to day 30

**Day 1 is one command, and no vendor credential is involved:**

```bash
pnpm dev:up
```

That provisions a local Postgres, writes `.env`, migrates, seeds and serves on `:5001` — measured
at 15 seconds cold on a clean clone. No Docker required. Full recipe, the manual path and the
seeded accounts are in [`LOCAL_DEV.md`](../runbooks/LOCAL_DEV.md).

**Day 1, second command — teach it before their first push:**

```bash
pnpm preflight
```

All 16 checks CI's `gate` job runs, locally, in about three minutes. Have them install the hook
once (`git config core.hooksPath .githooks`) so the cheap half runs on every push. Preflight prints
what it did **not** cover on every run; teach that a green preflight is not a promise CI is green.

**Access matrix.** New engineers get: the repo, a local database, their own Neon branch. New
engineers do **not** get: production database credentials, Railway production variables, or the
ability to merge to `main`. Migrations reach production only through CI, and merging is a production
deploy.

**The seven traps to teach in week one** — each has cost us a real incident, and none is
discoverable from the code alone:

1. A green check is not a shipped deploy. A failed Railway build leaves the *previous* container
   serving. Only `/api/health`'s `commit` proves a ship — and locally it answers `commit: null`,
   which **is** the local signature, not a defect.
2. Never point `pnpm db:local` at the shared dev database, and never `pnpm db:push` from a
   worktree. The first seeds — and `seedLendingGrids` wipes and rebuilds the pricing matrices. The
   second drops columns belonging to other branches.
3. A worktree with no install resolves `node_modules` upward to the primary checkout. Run
   `pnpm install` after every branch switch and every merge of main.
4. `vitest run <file>` defaults to the node config, so a `client/src` test silently runs nothing.
5. Vendor adapters are deterministic simulations that throw on purpose if you set a real key.
6. Never invent a MISMO field name, enumeration, edit code or SFC. If it cannot be verified in
   [`docs/fannie-mae/`](../../docs/fannie-mae/) or the official job aid, stop and flag it.
7. **The demo seed is not an organic file.** A delivery suite green against the seed has proven
   very little ([`CHARTER.md`](../routines/CHARTER.md) §1, question A) — the fixture being the seed
   is precisely what hides the defect class that matters most.

**Day 30 definition of ramped:** three merged PRs, one mutation-proven fix, one
[`REGISTER.md`](../routines/REGISTER.md) claim opened and released cleanly.

---

## 7. Compensation

**Bands are held outside this repo (§10)** — this one is public, and publishing bands for roles that
are not yet open negotiates against us with the people we are about to hire.

The structural guidance is safe to state here, and matters more than the numbers:

- **The SME is compensated as an ops lead, not as an engineer.** Benchmarking them against the
  engineering band is the most common way this hire is lost.
- **The integrations engineer carries a real scarcity premium.** Budget above instinct; this is the
  role that will sit open longest.
- **The two full-stack roles sit at the same band as each other.** Splitting them into a senior and
  a junior to save money buys a mentoring obligation nobody here has capacity to carry.
- **Sponsored MLO compensation is commission-structured** and sits outside the salary plan entirely.
- Counsel and AppSec are retainer plus per-matter, not salaried.

---

## 8. What we deliberately do not hire yet

Mobile engineer · dedicated ML/AI engineer (the coach is already Anthropic-backed and working) ·
SRE (Railway + Neon are automated; a fractional platform hour covers it) · data engineer · sales
engineer · **anyone for the lender persona**, which is deferred by decision — its endpoints stay
admin-only and building a lender surface is a founder call, not a staffing one.

---

## 9. Open decisions this plan depends on

| Decision | Owner | Blocks |
|---|---|---|
| Broker vs mini-correspondent — [`CHANNEL_DECISION.md`](CHANNEL_DECISION.md) | Founder | The integrations engineer's scope. Mini-correspondent adds warehouse, funding and post-close, and changes role §2.2 materially. |
| Which vendor contracts sign first | Founder + integrations | R2's first cutover target |
| Whether the SME is also a sponsored MLO | Founder | Whether §2.1 and the licensed-staff line are one hire or two |

**The honest risk in this plan.** Onboarding cost here is high: ~250k lines, 188 tables, and a
number of load-bearing compliance invariants that read as ordinary code. A new senior engineer's
first four to six weeks are net-negative velocity, and an engineer who does not know that
`resolveMatrixValue` throws for Fair Lending reasons will "fix" it. **Hire §2.1 first and let them
plus this handbook carry onboarding, or the cost is paid twice.**

---

## 10. What is deliberately not in this file

This repository is **public**. Two parts of the plan cannot be, and live at
`~/Documents/Homiquity-private/HIRING_PLAN_CONFIDENTIAL.md` on the founder's machine:

| Held privately | Why |
|---|---|
| The four take-home briefs and their answer keys | Each grades a trap. Published, it grades nothing. |
| Compensation bands | Published bands for unopened roles negotiate against us. |

**That file is outside git, so nothing backs it up.** Put a copy somewhere durable before relying
on it, and if the repo ever goes private again, folding it back in is a deliberate decision — not
an automatic one, since a public repo is the current cost-saving posture.
