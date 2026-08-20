# Hygiene-loop pitch adjudication — 2026-08-20

Dated, immutable snapshot (TEAM_PRACTICES §2). Founder-directed session; plan approved by the
founder 2026-08-20, including the scheduler seat and the SOP landing recorded below.

The founder pasted an external AI's pitch: a **"Clean Engine Intelligence Loop"** that would
continuously (1) ingest mortgage guideline updates into structured rule definitions,
(2) scan the repo for stale MD files / unused rules / "dead constraints" (defined as constraints
that "never fire, always pass, block nothing"), (3) generate diff patches including file
deletions and constraint removals, and (4) auto-patch "when safe," in a state machine whose
closing line is "The loop never stops." Offered add-ons: a Python orchestrator, a LangGraph
implementation, a GitHub Actions workflow, a repo-wide dependency scanner.

Per the standing adjudication practice, the pitch's claims about *our* repo were verified before
its proposal was evaluated. Verification: two read-only exploration agents plus direct probes of
the live scheduler, the guard scripts, the worktree population, and the governance corpus —
evidence inline below.

## Verdict per element

| Pitch element | Verdict | Grounding |
|---|---|---|
| Stale-MD scanning | **Already exists, gated** | `guard:kb`, `guard:citations`, `guard:staleness` are blocking steps in `ci.yml`'s `gate`; `guard:docs` runs weekly (`doc-freshness.yml`). All incident-derived, ratchet-baseline design. A founder-directed session shipped `scripts/doc-staleness-guard.cjs` + normalized 43 stale references across 25 docs on 2026-08-18 — the pitch's headline deliverable, executed two days before the pitch arrived. |
| Continuous hygiene loop | **Exists; was unseated — re-seated, not rebuilt** | `.claude/skills/doc-accuracy/SKILL.md` is the pitch's loop with rails the pitch lacks (docs-only, PR-only, meaning-preserving, never-delete, drift-vs-regression). The 2026-08-19 suite rewrite left it with **no scheduler seat** (verified against the live scheduler: 13 tasks, none doc-content hygiene; Evening Triage §5–6 does git-level hygiene only; its ledger sat at founding state). A second hygiene routine was already tried once and killed the same evening for duplicating doc-accuracy (`routines/CHARTER.md` §3a) — the two-truths hazard. |
| Unused-rule / dead-constraint pruning | **REJECTED** | Wrong mental model for this repo: compliance posture is *implemented as* code that never fires. Examples a "never fires ⇒ delete" scanner would destroy: `shared/lib/metro2/compiler.ts` `FIELD_LAYOUT = []` (the control against furnishing mis-columned credit data), `server/services/rentFurnishing.ts` fail-closed constants (`RENT_REPORTING_BILLING_ENABLED = false`, `BUREAU_MINIMUM_ACTIVE_LINES = null`), the freeze-guarded ~2,300-line Fannie delivery stack (`scripts/delivery-stack-freeze-guard.cjs`, pending the founder channel decision), and `loanApplications.totalPointsAndFees` — the F-2 precedent, where the worst defect this codebase has found WAS dead code and the fix was the declared-fail-closed field registry in `tests/complianceInvariants.test.ts`, not deletion. |
| Guideline ingestion → auto rule definitions | **REJECTED** | Standing architecture decision on record (Reg B defensibility): no runtime rule injection, no confidence-scored detection; scenarios become behavior only through the cited-and-tested registry pipeline (`compliance/UNDERWRITING_SCENARIOS.md` → engines → `scenarioCatalog.ts`, sync-pinned by test). Regulatory ingestion already exists the safe way: `regulatory-watch.cjs` diffs sources, `regulatory-freshness.cjs` enforces re-verification, and changes flow as "Correction to S-XX" + ledger update. |
| Auto-patch, never-stopping | **REJECTED — prohibited, not missing** | Founder is the only merger (TEAM_PRACTICES §6); doc-accuracy D5/D8/D10; feature-review CHARTER rule 1 (reviewers never fix); `doc-governance-reviewer` contract ("never edits"). `DELETE` exists in the recommendation vocabulary; no mechanism is permitted to execute it. RR-005 is the standing counter-example to loop-autonomy: a three-times-refuted extraction (`handbook/URLA_FORM_REFACTOR_TRAP.md`) that an auto-refactor loop would re-propose every run — the ledger-with-refusals design exists to prevent exactly that. |
| Python / LangGraph orchestrator | **REJECTED** | The scheduler fleet + worktree/claim discipline + CHARTER **is** the orchestrator (13 live seats on 2026-08-20, 14 with the doc-accuracy seat added below). A parallel orchestration stack is a second brain — the dormant-suite disaster class. |
| Dependency / dead-export scanner (knip, ts-prune, ESLint) | **REJECTED for now** | CHARTER §10 forbids new tooling classes without a founder decision; no ESLint exists anywhere by design; `scripts/orphan-scan.cjs` (file-level, in `pnpm checkup`) is the deliberate local answer. A symbol-level scanner's report here would be dominated by the load-bearing "dead" code above. **Reopen condition:** the founder authorizes a specific tool with a curated ignore set, understanding the F-2 lesson — the repo's answer to dead-but-load-bearing state is *declaration*, never deletion. |

**Groundedness tells worth recording:** the pitch says "MISMO 3.5" (this repo is MISMO 3.4, ULDD
Phase 5 — keep 3.5 out of the docs), and it proposed building three things that already exist in
stronger form (the guards, the routine, the orchestrator).

## Binding produced (recorded in session memory alongside the prior pitch bindings)

> **Code that never fires may be the control.** No mechanical pruning of never-firing gates,
> empty-on-purpose structures, or false-by-design flags. Dead-but-load-bearing state gets a
> declaration (the `complianceInvariants` field-registry pattern); it never gets a deletion.

## Actions taken this session (founder-approved plan)

1. **`doc-accuracy` re-seated** — scheduled task `doc-accuracy-daily`, daily 19:30 local (after
   the build lanes and the 17:05 Journey Walk; before the 21:00 Evening Triage, which consumes
   its report). Cadence is a founder decision of 2026-08-20; the skill's 6-hourly design note now
   records the seating (edit in this PR, listed for founder review in the PR body).
2. **Scheduler fossils tombstoned** — `~/.claude/scheduled-tasks/{complex-file-engine,move-up-lane}`
   held full, runnable-looking definitions with no banner (the exact re-registration hazard
   `_archive/README.md` documents); both rewritten as tombstones per the `sprint-blitz`
   convention, pointing at their `_archive/` copies and `RETIRED.md` records. *(Deviation from
   the approved plan's "move to `_archive`": the archive copies already existed; the discovered
   house convention is tombstone-in-place, so that is what was done.)*
3. **SOP-000 charter landed as indexed DRAFT** (this PR) — see `knowledge-base/sop/` and the
   charter's own §9 change log for what was corrected. Until landed it sat untracked in the
   primary checkout, where it **blocked every push from that checkout** via the pre-push
   `kb-index` check (`kb-index-guard.cjs` walks the filesystem, not the git index) — the same
   session-stopping trap twice over: invisible to worktree sessions, blocking for primary ones.
4. **All nine `.claude/worktrees/` residues preserved off-laptop** (table below).

## The nine abandoned-looking worktrees: verified, preserved, NOT removed

Exploration flagged ~2,100 duplicate `.md` files across nine worktrees under `.claude/worktrees/`
as "mechanical, low-risk cleanup." Verification (2026-08-20, after `git fetch --prune`):
**all nine carry commits absent from `origin/main`** — zero were safely deletable. The cleanup
pitch's "obvious" targets failed verification nine for nine, which is this adjudication's thesis
demonstrated live. All are clean (no uncommitted changes); every HEAD is now reachable from an
origin ref; none was removed. Disposition belongs to Evening Triage / the founder.

| worktree | HEAD | ahead of main | preserved at | note |
|---|---|---|---|---|
| aus-autopilot-0820 | f46f5afd | 1 | `backup/2026-08-20/feat/aus-autopilot-gap-0820` (pushed this session) | dated today — possibly a live session's tree; untouched |
| feature-owners | 98ee0845 | 1 | `backup/2026-08-20/trap/push-exit-masking` (pre-existing) | |
| infallible-gould-f06a1b | 04161b9d | 6 | `backup/2026-08-20/claude/infallible-gould-f06a1b` (pre-existing) | detached HEAD |
| musing-engelbart-0a72db | e9125599 | 2 | `backup/2026-08-20/claude/security-guard-lockout-trigger` (pre-existing) | **active REGISTER claim** (F-077 FHA leg, PR #556) — off limits |
| musing-hodgkin-6020d9 | 9e67b100 | 1 | `backup/2026-08-20/claude/wiring-audit-remainder` (pushed this session) | today's wiring-audit session; its task was reported already-landed via #629 — likely discardable, its owner decides |
| pensive-noether-5232f2 | 014ff411 | 5 | `backup/2026-08-20/claude/agitated-chatterjee-af3449` (pre-existing) | detached HEAD |
| primary-engineer-2026-08-18-1 | f94d6244 | 2 | `backup/2026-08-20/routine/primary-engineer-2026-08-18-1` (pre-existing) | |
| rescue | 54e19d73 | 1 | `backup/2026-08-20/rescue/inert-buttons-ratchet-landed` (pre-existing) | |
| strange-kilby-c389c0 | 934d81f5 | 1 | `origin/claude/login-lockout-consecutive-failures` | the parked #609 lockout branch (carries migration 0057 — merge-day constraint in the 2026-08-20 merge-queue close-out §Parked) |

Most `backup/2026-08-20/*` refs were pushed by the merge-queue close-out session earlier today
([2026-08-20-merge-queue-close-out.md](2026-08-20-merge-queue-close-out.md)) — this session added
the two it had missed. Cross-reference that log rather than re-deriving branch dispositions.

## Flagged for the founder (decisions, not defects — deliberately NOT entered in FINDINGS.md)

1. **TEAM_PRACTICES §6 vs the live fleet.** §6 says "Scheduled routines publish docs-only … A
   routine never carries code," while four live seats (Primary Engineer, Capture Path Engineer,
   Workflow Completion Engine, Feature Completion Engine) are chartered to ship code via PRs.
   One of the two is stale. Founder picks which; a doc-accuracy run can then carry the correction
   as a D8 proposal.
2. **Ten routine skills have no scheduler seat** (checked 2026-08-20 by grepping every live task
   prompt): `algorithm-auditor`, `app-walker`, `backend-data-engineer`, `domain-oracle`,
   `financial-audit`, `integration-readiness`, `move-up-lane`, `qa-mutation-verifier`,
   `ui-conformance-sweep`, `workflow-prover`. (The four domain routers — `api-routes`,
   `ui-components`, `mortgage-calculations`, `seo-content` — auto-load and are correctly
   seatless.) Some are deliberate manual-invocation tools (move-up-lane's `RETIRED.md` says
   exactly that); others may be fossils per CHARTER §11. Per-skill seat / keep-as-manual /
   archive is fleet design — founder's call.
3. **`.agents/skills/` (6 files)** — a second skills layer, excluded from `citation-guard`'s
   scan; unknown consumer. Catalog or archive.
4. **Primary-checkout residue remains** — the dirty `App.tsx` / `routeGates.ts` /
   `LoanDetails.tsx` edits (a superseded draft of merged #596 per the close-out log) were left
   untouched per plan. The untracked `knowledge-base/sop/` copy is now redundant (content
   preserved on `wip/sop-manual-draft-2026-08-19` and in this PR) but **remains in place** —
   removing it was declined in-session, so until the owner clears it, every push from the
   primary checkout stays blocked by the pre-push kb-index check.

## What would reopen the rejections

- Rule-ingestion / auto-rules: nothing short of a founder + counsel decision to change the Reg B
  isolation architecture. Generated strategy documents propose this regularly; the answer stays no.
- Dead-code tooling: a founder-authorized tool + curated ignore set (see verdict table).
- A second hygiene routine: nothing — extend `doc-accuracy` instead (CHARTER §3a precedent).
