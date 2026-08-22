# Feature Review Program — Charter

**What this is:** the standing QA program that reviews every Homiquity feature against its
intended use and verifies the end-to-end workflows function correctly. **Thirteen domain teams
+ a cross-cutting UX lens** (`DOMAINS.md`) + one workflow-verification pass (`WORKFLOWS.md`) +
**five client-journey walks** (`JOURNEYS.md`) + documentation governance, all writing to one findings register (`FINDINGS.md`). Re-runnable
after any significant change — the teams are durable agents in `.claude/agents/`.

> **Verified census (supersedes "37/40/7"):** ~95 backend subsystems · 88 client pages · ~14
> end-to-end workflows. The register was seeded 2026-07-08 from a 9-dimension audit — see
> `FINDINGS.md`.

## The teams

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

All four are reachable without knowing their names via the **`/journey-walk`** skill — a subagent
nobody can find is not a control.

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
8. **Journey findings live in their own id space: `J-<MMDD>-<NN>`,** minted from the walker's own
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
- **Design system:** `main` is **Royal Blue Emerald** (2026-07-08 repaint #93; PageShell
  scaffold #131). Audit artifacts referencing Obsidian Indigo or Charcoal Emerald predate it —
  don't file color findings from them.

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

## Finding lifecycle

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
- **Journey walks use one account per walker.** `journey-walker-aspiring-owner` logs in as the
  seeded `renter@test.com` (`server/auth.ts:362`) and **must never apply** — applying promotes that
  shared seat (`server/routes/lending/applications.ts:134`). The three buyer walkers self-register
  `jw2+` / `jse+` / `jaf+<MMDD>@test.local` so the promotion they are testing is real; **never
  `buyer@test.com`**, which is pinned to `active_buyer` (`server/auth.ts:363`) and cannot cross the
  seam. `/test-login` rewrites the role on every login (`server/auth.ts:381`), so a polluted seed
  role self-heals — the application rows it created do not.
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
