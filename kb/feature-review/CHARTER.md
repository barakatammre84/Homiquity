# Feature Review Program — Charter

**What this is:** the standing QA program that reviews every Homiquity feature against its
intended use and verifies the end-to-end workflows function correctly. Nine domain teams
(`DOMAINS.md`) + one workflow-verification pass (`WORKFLOWS.md`), all writing to one findings
register (`FINDINGS.md`). Re-runnable after any significant change — the teams are durable
agents in `.claude/agents/`.

## The teams

| Agent | Job |
|---|---|
| `feature-reviewer` | Reviews one domain: intended-use brief → code-vs-intent → domain tests → live probe |
| `workflow-verifier` | Drives one E2E workflow against the live dev server, step by step |
| `ux-reviewer` | Audits client surfaces: design-system uniformity, friction/psychology, copy rails |
| `finding-verifier` | Adversarial skeptic — tries to refute every finding before it enters the register |
| `compliance-auditor` | Verifies compliance-touching findings against `docs/fannie-mae/`, `docs/nmls/`, CFR |

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
6. **Cross-reference, don't duplicate.** `kb/ux-audit/page-audit.md` and `CTO_ROADMAP.md`
   already track known issues; findings that overlap must cite them. Known deliberate cuts
   (launch-sprint list, `ASSUMPTIONS.md`) are not defects.

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
  anything matching `kb/TEAM_PRACTICES.md` §9 triggers; compliance-auditor sign-off for
  Fannie/NMLS-touching fixes.
- **Wave 2 (P2/P3):** batched polish PRs.
- **UX wave:** `ux-refinement` findings, one route per PR (the existing redesign convention),
  verified against the design-token guard + before/after screenshots.
- After each wave: re-run the affected domain review + affected workflow verification.
- Every fix PR: `npm run check`, `npm test`, `npm run test:integration` green; cites finding ids.

## Operational conventions

- Live probing runs against the worktree dev server on **port 5002** (`.env` + symlinked
  `node_modules`; see the worktree-testing notes). Shared dev DB: no destructive SQL, never
  `npm run db:push` from a worktree.
- Test entities use clearly-fake identities (`wfqa+*@test.local`, test-pattern SSNs matching
  the existing test-suite convention).
- Nothing pushes to `main`; all changes land via PRs.
