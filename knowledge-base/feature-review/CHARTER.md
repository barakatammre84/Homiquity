# Feature Review Program — Charter

**What this is:** the standing QA program that reviews every Homiquity feature against its
intended use and verifies the end-to-end workflows function correctly. **Thirteen domain teams
+ a cross-cutting UX lens** (`DOMAINS.md`) + one workflow-verification pass (`WORKFLOWS.md`) +
**the client-journey walks** (`JOURNEYS.md`) + **the staff-journey walks** (`STAFF_JOURNEYS.md`) + documentation governance, all writing to one findings register (`FINDINGS.md`). Re-runnable
after any significant change — the teams are durable agents in `.claude/agents/`.

> **Verified census (supersedes "37/40/7"):** ~95 backend subsystems · 88 client pages · ~14
> end-to-end workflows. The register was seeded 2026-07-08 from a 9-dimension audit — see
> `FINDINGS.md`.

## The mental model

The program is a **standing inspection layer that never holds the wrench**. Reviewers, verifiers,
walkers and auditors are structurally separated from fixing — a finding is the program's only
product, and a finding survives only if it carries evidence a stranger can re-run and an
adversarial verifier failed to kill it. The model to hold: **discovery and repair are different
jobs with opposite incentives**, and every rule below exists to keep the boundary between them
sharp. (The suite-wide contract — clocks, claims, territory — is
[`../routines/CHARTER.md`](../routines/CHARTER.md); this charter binds the review program that
feeds it.)

## Explain it to a new hire — one review round

A round starts with a scope: one domain from `DOMAINS.md`, one workflow from `WORKFLOWS.md`, or
one journey from `JOURNEYS.md`/`STAFF_JOURNEYS.md`. A reviewer reads the intended use, reads the
code against it, runs the domain's tests, probes the live dev server (port 5002), and writes up
what it found — including a CLEAN section for what it checked and found conforming. Every
proposed finding then goes to the `finding-verifier`, whose whole job is to refute it; what
survives (plus a `compliance-auditor` verdict where flagged) enters `FINDINGS.md` with evidence.
Fixes happen later, in triaged fix waves, by other hands, citing finding ids. The walkers do the
same loop in a real browser, filing only the seams between surfaces. Read the Reality Map before
your first round — most false positives are filed by people who skipped it.

## The mechanism — the teams

| Agent | Job |
|---|---|
| `feature-reviewer` | Reviews one domain: intended-use brief → code-vs-intent → domain tests → live probe |
| `workflow-verifier` | Drives one E2E workflow against the live dev server, step by step |
| `ux-reviewer` | Audits client surfaces: design-system uniformity, friction/psychology, copy rails |
| `finding-verifier` | Adversarial skeptic — tries to refute every finding before it enters the register |
| `compliance-auditor` | Verifies compliance-touching findings against `docs/fannie-mae/`, `docs/nmls/`, CFR |
| `doc-governance-reviewer` | Audits the `.md` corpus vs the 4-point framework (prescriptive · Business-Intent · L1/L2/L3 · friction); flags stale/contradictory docs |
| `journey-walker-aspiring-owner` | Walks the renter/sandbox journey in the browser; proves the sandbox has a floor and never crosses the application boundary |
| `journey-walker-w2-buyer` | Walks the W-2 salaried buyer journey in the browser; owns the `aspiring_owner → active_buyer` promotion seam |
| `journey-walker-self-employed` | Walks the self-employed buyer journey in the browser; proves the funnel's `complexIncome` branch is carried, not merely taken |
| `journey-walker-affluent` | Walks the affluent move-up journey in the browser; owns the door with no explainer, the jumbo threshold, and promise-vs-reachability |
| `journey-walker-condo-buyer` | Walks the condo/project journey in the browser against a detached control; owns the **property** axis, where a qualified borrower is declined for the building |
| `journey-walker-staff-lo` | Walks the loan-officer desk as `lo@test.com` **and** as the borrower it invites; owns the seven-hop attribution chain (pointer **and** team row **and** `LoanTeamCard`) where the server is non-fatal |
| `journey-walker-staff-processor` | Walks the processor desk and the borrower; owns one document rendered by two roles across two vocabularies (`status` vs `verificationStatus`) |
| `journey-walker-staff-underwriter` | Walks the underwriter desk and two borrowers; owns the decision both directions — the 422 chain as rendered, then *can the borrower find the notice* (ux-24) |
| `journey-walker-staff-closer` | Walks the desk with no verb; owns promise-vs-reachability for a named role the product gives no way to fund — expected `DEAD-ENDED (by design)`, minted once |
| `journey-walker-staff-broker` | Walks the broker and the borrower it referred; the only negative headline in either fleet — stage must carry, contents must **not** (a leak is P0) |

Every `journey-walker-*` is reachable without knowing its name — client seats via **`/journey-walk`**,
staff seats via **`/staff-journey-walk`** — because a subagent nobody can find is not a control.
`admin` is deliberately not a staff seat (it bypasses every scoping gate and so can see no seam
gates create — it is the counterpart with two permitted verbs); `loa` is folded into the LO seat;
`lender` is deferred by policy. `STAFF_JOURNEYS.md` records why, so the question is not reopened.

## Program rules (binding)

1. **Findings-first.** Review phases are strictly read-only on product code. No reviewer,
   verifier, or auditor edits anything. Fixes happen only in triaged fix waves (see below).
2. **Every finding is adversarially verified** by `finding-verifier` before it enters
   `FINDINGS.md`. Compliance-touching findings additionally require a `compliance-auditor`
   verdict. Unverified findings do not exist.
3. **Evidence or it didn't happen.** Every finding carries exact `file:line`, repro steps
   (or verbatim actual-vs-expected output), and for UI claims a screenshot or
   `preview_inspect` value. "Seems wrong" is not a finding.
4. **"Inspected, works" ≠ "not inspected."** Every review reports a CLEAN section naming what
   was checked and found conforming, so coverage is auditable.
5. **Compliance humility.** Nobody rules on MISMO/ULDD/UCD/QM/SFC/TRID/FCRA/ECOA/TCPA/NMLS/
   ESIGN questions from memory. Verify against `docs/fannie-mae/`, `docs/nmls/`, or eCFR — or
   mark UNVERIFIABLE and escalate. Never invent MISMO names, edit codes, or SFCs.
6. **Cross-reference, don't duplicate.** `knowledge-base/logs/ux-audit/page-audit.md` and `CTO_ROADMAP.md`
   already track known issues; findings that overlap must cite them. Known deliberate cuts
   (the roadmap, `ASSUMPTIONS.md`) are not defects.
7. **Journeys file seams, never surfaces.** A `journey-walker-*` files only what requires **two
   surfaces to be visible**: a value dropped crossing a boundary, a role or state transition that
   leaves the UI stale, a dead end, a promise made on one surface and unkept on another, a gate
   that collides with a persona's route. Anything visible on a single surface belongs to that
   domain's `feature-reviewer` (behaviour), to `ux-reviewer` (friction, uniformity, copy) or to the
   `app-walker` routine (layout, overflow, touch targets), and is reported as a **HANDOFF line
   naming the owner — no id is minted**. Where the file has an `hq-*-owner`
   (`knowledge-base/handbook/FEATURE_MAP.md` maps every owned path to exactly one), name that agent:
   owners implement, so a hand-off that names one becomes work rather than a line nobody reads. A walker that re-files a domain finding under a journey id
   has not added a control, it has added a duplicate; the register already paid for that lesson
   (the flat-0.5% PMI claim, filed independently by two agents and wrong on both grounds — Domain 5).
   **For a staff walker, "two surfaces" includes two roles**: a control the client offers and the
   server refuses is a client↔server seam — but per the route-gate-drift doctrine (*narrow the
   client, never widen the server*) it is a HANDOFF to the client file's owner citing F-0818-13,
   not a minted id. Only *named role, no verb, no path* mints a `DEAD-END`, once.
8. **Journey findings live in their own id space: `J-<MMDD>-<NN>` for client walks and
   `JS-<MMDD>-<NN>` for staff walks** (two lanes run on the same day), minted from the walker's own
   run date, never a next-free integer. `J-` ids never enter the `ux-NN` space — a journey walker
   does not get to grade a page — and never appear in a `WORKFLOWS.md` trace, which is
   `workflow-verifier`'s HTTP evidence. A journey finding that is really an existing
   `F-`/`ux-`/`D-` finding **cites it and merges**, as Domain 7 did with ux-30 rather than
   re-minting (D-012 discipline). Rule 2 is not bypassed: every `J-` finding still passes
   `finding-verifier` before it enters the register.
9. **A journey not driven in a browser is not a journey.** The walkers exist because `curl` cannot
   see a stale nav, a value that renders blank, or a next step that was never offered. A walker
   whose browser tools are absent reports `BLOCKED` with the exact error and stops; substituting
   HTTP calls and reporting a walk is a `FAIL` for the run, not a degraded pass. Same rail, same
   reason, as `.claude/skills/app-walker/SKILL.md` R3. *(Verified 2026-08-19: pointed at a dead
   port, `journey-walker-aspiring-owner` returned `BLOCKED` and explicitly refused to substitute a
   live port on its own initiative.)*

## Reality Map — read BEFORE reviewing (stops false-positive findings)

The 2026-07-08 audit established these facts. A reviewer who files against them is filing a
false positive:

- **Dark-by-design locally (NOT bugs):** uploads (`PRIVATE_OBJECT_DIR`/GCS), live rates+AVM
  (`RAPIDAPI_KEY`), Gemini extraction, email/SMS, Plaid link, Sentry, cron. Unset →
  simulated/no-op/503 by design.
- **Simulated vendors — determinism is NOT a defect:** DU, LPA, soft-pull, full-credit,
  HouseCanary. Setting a real GSE key **intentionally throws** — that's a guardrail.
- **The underwriting-engine trap:** `server/underwriting.ts` *looks* like the engine (header
  says so) but is a superseded helper. The live path is `decisionEngine.ts → underwritingEngine.ts`.
- **Decisioning is a server cascade** on `POST /api/loan-applications` (`finalizeIntake →
  recalculateDecision → runInstantDecision`). The `instant-decision`/`calculate-*`/`advance-stage`
  endpoints are dead-but-redundant — assert on cascade outputs, not those endpoints (N-002).
- **~100 dead endpoints / 4 server-only subsystems** (Borrower Intelligence, Underwriting Rules,
  Rate Sheets, Optimization) — unshipped surface; don't review as features or write
  tests against endpoints nothing calls. Decide wire/defer/delete per the dead-surface map.
  ⚠️ **`Market-data` was removed from this list 2026-08-17 (D-013d) — it is WIRED**:
  `client/src/pages/staff/PricingIntelligence.tsx:91,97` calls `/api/market-data/undercut-quote`
  and `/risk-profile`, pinned by `PricingIntelligence.test.tsx:47-48`. `Rate Sheets` is still
  accurate (zero client callers, verified same day). **Re-verify a dead-surface claim before
  relying on it** — this list suppresses false positives, so a stale entry here teaches reviewers
  to dismiss real findings unreviewed, which is the more expensive failure.
- **Security posture is STRONG** — no P0, PII-at-rest sound (N-001). Findings are P1/P2
  hardening on §9 trigger surfaces. *(Correction 2026-07-12: one AUS-route IDOR was found after
  the audit and closed in #135's §9 review — the "no IDOR" line predates that discovery.)*
- **`grep-only` compliance tests give false confidence** — `complianceInvariants.test.ts` (F-014)
  executes nothing. A green run there ≠ correct regulated math.
- **The prelaunch gate is OPEN locally and CLOSED in production — both are correct.** `.env` sets
  no `PRELAUNCH_GATED`, so `server/services/prelaunchGate.ts:25-31` falls back to
  `NODE_ENV === "production" && isCompanyNmlsPending()`, and `client/src/lib/prelaunch.ts:17-19`
  gates only on `PROD`. Locally every persona route walks. **A journey that terminates at the
  waitlist under PRELAUNCH is the gate working** — record it in the `JOURNEYS.md` walkability
  column as a launch-readiness fact, never as a finding. What *is* a finding: a surface that
  survives the gate while soliciting, or a `<Gated>` redirect that strands state (the
  calculator→funnel sessionStorage handoff is read-and-consumed, so a redirect between write and
  read silently destroys it).
- **Design system:** `main` is **"Mint & Flare"** (2026-08-20 rebuild `3cba2dae`; PageShell
  scaffold #131) — white ground, green-black dark surfaces, one mint tint, one orange `--flare`.
  Audit artifacts referencing **Royal Blue Emerald**, Obsidian Indigo or Charcoal Emerald all
  predate it — don't file color findings from them.

## Severity scale

| Sev | Meaning | Examples |
|---|---|---|
| **P0** | Blocks launch / legal exposure / data loss / PII leak | SSN exposed outside vault path; TRID hard-stop bypassable; role gate missing on staff route |
| **P1** | A workflow is broken for its intended use | Submission stage never satisfiable; route the UI calls doesn't exist; decision recalc never fires |
| **P2** | Feature degraded, wrong on edges, or misleading | Wrong number on an edge case; error path shows raw exception; stale gate condition |
| **P3** | Polish | Copy, spacing, empty states, minor drift |

## Finding types

`defect` (behavior contradicts intended use) · `coverage-gap` (intended behavior with no test) ·
`doc-drift` (doc contradicts code) · `ux-refinement` (works, but friction/uniformity issue) ·
`roadmap` (real gap, but feature-scale — files to `CTO_ROADMAP.md`, not a fix wave).

Plus a **compliance-risk flag**: `yes (<regime>)` or `no`. Any `yes` requires a
compliance-auditor verdict before the finding is actionable.

## The finding lifecycle — the mechanism, end to end

```
proposed (reviewer) → verified (finding-verifier CONFIRMED/DOWNGRADE)
                    → [compliance-auditor verdict if flagged]
                    → registered (FINDINGS.md, status: open)
                    → triaged (user confirms severity, assigned to wave)
                    → fixed (PR cites finding id) → re-verified (domain re-review) → closed
REFUTED findings are recorded in the register with status: refuted (so they aren't re-found).
```

## Fix waves (Phase 3)

- **Wave 1 (P0/P1):** isolated worktrees, one PR per coherent cluster. Security-review gate for
  anything matching `knowledge-base/governance/TEAM_PRACTICES.md` §9 triggers; compliance-auditor sign-off for
  Fannie/NMLS-touching fixes.
- **Wave 2 (P2/P3):** batched polish PRs.
- **UX wave:** `ux-refinement` findings, one route per PR (the existing redesign convention),
  verified against the design-token guard + before/after screenshots.
- After each wave: re-run the affected domain review + affected workflow verification.
- Every fix PR: `pnpm check`, `pnpm test`, `pnpm test:integration` green; cites finding ids.

## Operational conventions

- Live probing runs against the worktree dev server on **port 5002** (`.env` + symlinked
  `node_modules`; see the worktree-testing notes). Shared dev DB: no destructive SQL, never
  `pnpm db:push` from a worktree.
- Test entities use clearly-fake identities (`wfqa+*@test.local`, test-pattern SSNs matching
  the existing test-suite convention).
- Nothing pushes to `main`; all changes land via PRs.
- **Client journey walks use one fresh account per walker.** `journey-walker-aspiring-owner` signs
  up fresh as `jr+<MMDD>@test.local` and **must never apply** — *(amended 2026-08-20: the seeded
  `renter@test.com` seat is retired as the primary because its central surface keys on the account's
  own rows, and the dev DB had accumulated a `processing` application on it — `JOURNEYS.md` §1
  records the probe to run if you want the seeded seat anyway)*. The buyer walkers self-register
  `jw2+` / `jse+` / `jaf+` / `jcd+<MMDD>@test.local` so the promotion they are testing is real;
  **never `buyer@test.com`**, which is pinned to `active_buyer` (`server/auth.ts:363`) and cannot
  cross the seam. `/test-login` rewrites the role on every login (`server/auth.ts:381`), so a
  polluted seed role self-heals — the application rows it created do not.
- **Staff journey walks use the seeded `/test-login` seat for the role and a fresh borrower for
  the file** — and the reason is the opposite of the client rule: a staff desk's central surfaces
  key on the **file under test**, which the walker creates fresh as `jst+<MMDD><seat>@test.local`
  and is the **only** file it acts on; the seat's accumulated rows are residue, not subject. Two
  sessions, sequentially (one cookie jar). Admin is opened for exactly two verbs — team-add of the
  walked seat to the walker's own file, and one staff-invite code for the LO seat's optional
  onboarding leg — each listed with its audit action. Never change a role, never `force`, never
  deliver an adverse-action notice, never run a sweep, never click the Intelligence tab
  (F-0820-20). The borrower withdraws the file at the end unless it is terminal. Own worktree, own
  port (5003), torn down after. Full rails: `STAFF_JOURNEYS.md` and J6–J13 in each staff agent.
- **Browser-driven runs are local only, and default to 5001** (the primary checkout) — **never**
  the deployed site, where a failed Railway build leaves the previous container serving. A local
  `/api/health` answers `commit: null` on every branch, so identify the serving checkout with
  `lsof -a -p <pid> -d cwd` plus the process start time before trusting any measurement. Stale
  listeners are the norm — two distinct staleness traps, both observed 2026-08-19: the `:5002`
  "worktree" port was still served by a **14-day-old orphan** from the deleted `launch-hygiene`
  worktree (its `/api/health` returns only `{status,timestamp}` while current code also returns
  `commit` and `email` — the cheapest tell); and even the *right* checkout serves stale **server**
  code, because `pnpm dev` is `tsx server/index-dev.ts` with **no watch flag** — the server half
  freezes at process start while the client is Vite-transformed per request and stays current.
  Compare process start time against `server/**` mtimes before attributing any server-side finding
  to HEAD.

## Prove it yourself

```bash
cd "$(git rev-parse --show-toplevel)"
ls .claude/agents/journey-walker-*.md | wc -l        # → 10 walker seats (5 client, 5 staff)
ls .claude/agents/ | grep -c ".md"                   # the durable review teams live here
grep -c "^| " knowledge-base/feature-review/FINDINGS.md   # the register's row count — the census moves
grep -n "Program rules" knowledge-base/feature-review/CHARTER.md  # the binding rules, cited by name
grep -rn "journey-walk\b" .claude/skills/journey-walk/SKILL.md | head -2  # walkers reachable by /journey-walk
```

The census in the header ("~95 backend subsystems · 88 client pages · ~14 workflows") is a
2026-07-08 measurement — re-derive before quoting it (routines charter §7 rule: probe, never
trust the page's age).

## Where this breaks — the paid-for lessons

| Failure mode | The incident | The rule it bought |
|---|---|---|
| Two agents file the same defect independently | the flat-0.5% PMI claim — filed twice, wrong on both grounds | rule 7's HANDOFF discipline |
| A suppression list goes stale | `Market-data` sat on the dead-surface list while it was WIRED — a stale entry teaches reviewers to dismiss real findings | the Reality Map's own re-verify warning |
| Trusting the port, not the process | the `:5002` "worktree" server was a **14-day-old orphan** from a deleted worktree | the operational conventions' staleness traps |
| HTTP substituted for a browser | a walk reported without a browser cannot see a stale nav or a blank render | rule 9 — `BLOCKED` beats a fake pass |
| Findings minted from "next free number" | six sessions minted six different `F-20`s (suite-wide) | rule 8's date-qualified ids |

## What we don't know

- The **census is approximate by design** (~95 / 88 / ~14) — exact counts drift weekly; the
  register, not this header, is the record.
- The **`lender` persona is deferred by policy** — `STAFF_JOURNEYS.md` records why, so the
  question is not reopened per walk.
- **`complianceInvariants.test.ts` executes nothing** (F-014) — a green run there is not evidence
  of correct regulated math; the gap is registered, not resolved.

## The analogy

A building inspector who also does the repairs stops writing up what they cannot fix — so the
inspectorate here is barred from holding tools. The findings register is the inspection report;
the verifier is the second inspector who tries to fail the first one's write-up; the fix waves
are the licensed contractors, who must cite the report line they are closing; and the Reality Map
is the building's as-built drawings, read before inspecting so nobody condemns a wall that was
always meant to be load-bearing.

## Teach-back

1. A walker sees a broken empty state on a single page. What does it do, and what does it never do?
2. What must be true before any proposed finding appears in `FINDINGS.md`?
3. The dev server answers on 5002. What do you verify before trusting a measurement from it?
4. Your review found nothing wrong in a subsystem. What do you write?

**Key:** 1 — a HANDOFF line naming the surface's owner (feature-reviewer / ux-reviewer /
app-walker / the `hq-*-owner`); it never mints a `J-` id for a single-surface issue (rule 7).
2 — adversarial verification by `finding-verifier`, plus a `compliance-auditor` verdict when
compliance-flagged, plus `file:line` evidence (rules 2–3). 3 — that the serving process is the
checkout and vintage you think it is — `lsof -a -p <pid> -d cwd` + process start time vs
`server/**` mtimes; stale listeners are the norm (operational conventions). 4 — a CLEAN section
naming what was checked and found conforming — "inspected, works" is a result, silence is not
(rule 4).

## Go deeper

[`DOMAINS.md`](DOMAINS.md) · [`WORKFLOWS.md`](WORKFLOWS.md) · [`JOURNEYS.md`](JOURNEYS.md) ·
[`STAFF_JOURNEYS.md`](STAFF_JOURNEYS.md) · [`FINDINGS.md`](FINDINGS.md) — the register ·
[`../routines/CHARTER.md`](../routines/CHARTER.md) — the suite contract this program feeds.

