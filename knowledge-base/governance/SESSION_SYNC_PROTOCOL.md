# Session Sync Protocol

**Adopted:** 2026-08-12 · **Tier 2 doctrine** (decisions in force) · **Audience:** every
work session — human or Claude, scheduled routine or interactive — that edits this repo
while other sessions may also be editing it.

> **Freshness:** last verified 2026-08-12 · review every 30 days

This page is the **shared memory** of concurrent sessions. [TEAM_PRACTICES.md](TEAM_PRACTICES.md)
governs how a session works; this one governs how sessions work *with each other*, and it is
where a lesson learned in one domain becomes available to all of them. It binds regardless of
which `.claude/skills/*` router is loaded.

**Why this exists.** Sessions run concurrently and none of them can see the others' context.
A session that acts on state it read ten minutes ago will re-do finished work, open a PR
against a base nobody wants to review, or edit a file another session already holds. On
2026-08-12 a refactor run picked `ScenarioSimulatorDialog.tsx` as its top-ranked target while
PR #467 was already rewriting that exact file; the collision was caught by hand, not by
mechanism. This protocol makes that catch mechanical.

## 1. The three obligations (every session, every iteration)

**O1 — Memory before work.** Refresh reality *before* acting, never from carried-over context:
`git fetch origin`, read what merged since your last known sha, re-read the ledger or register
your work updates. A loop iteration re-runs this even if the previous one ended seconds ago.
Carried-over state is the thing this protocol exists to distrust.

**O2 — Claim before edit.** Before committing to a target file, list what other sessions hold:
open PRs of *any* label and their changed files, live branches, other worktrees, reachable
agents. **A file in another session's open PR is claimed and is not eligible.** Record it as
blocked and take the next candidate — do not "just rebase later."

**O3 — Write back what you learned.** A lesson that stays in one session's transcript is lost
the moment that session ends. Append it to §4 below in the same PR as the work that produced
it. The register is the only channel that survives a session.

## 2. Freshness budget: two commits

Open a PR from a base **no more than 2 commits behind `origin/main`.** Re-check immediately
before opening it, because the base moves while you verify:

| Behind | Do |
|---|---|
| 0 | proceed |
| 1–2 | merge `origin/main` in, re-run verification once, proceed |
| >2 | discard the code, restart the iteration from a fresh base |

**Why 2.** Every merge to `main` auto-deploys (CLAUDE.md → Architecture). A PR built on a
stale base is reviewed against a world that no longer exists, and the reviewer pays for the
drift. Two commits is the point where "merge it in" stops being cheaper than "start over."

## 3. Loop pacing: review capacity is the constraint

Autonomous loops generate faster than a human reviews. On 2026-08-12 a full refactor-radar
run produced a reviewable PR in ~20 minutes — the queue, not the generator, is the bottleneck.
Therefore:

- **Never parallelize to go faster.** More concurrent sessions deepen a queue one person
  reviews. Parallelize only genuinely independent *verification*, never PR production.
- **Back-pressure is a stop signal, not a speed bump.** At ≥2 open PRs from the same routine,
  stop producing and say plainly that review capacity is the blocker.
- **Optimize for cheap review, not more PRs.** Prefer a diff a reviewer can verify
  *mechanically* (a proof the moved code is byte-identical, a test that pins the old
  behavior) over one they must read and trust.
- **Sleep between iterations.** Prefer an event trigger (PR webhook) over a clock tick.

## 4. Lessons register (shared across all domains)

Append here — newest first — when a session learns something the *next* session would
otherwise re-learn. Every row cites evidence; a lesson without evidence is an opinion.
Keep it to lessons that change behavior.

| date | lesson | evidence | applies to |
|---|---|---|---|
| 2026-08-12 | **Size is a poor proxy for "needs refactoring."** Rank by tangling signals (inline math functions, arithmetic outside a lib import, hook density, non-JSX line ratio), not `wc -l`. `AffordabilityCalculator.tsx` is 88 lines *because* it is already clean; one grep for inline `function calculate*` found 6 real targets in a second, where a size sweep produced 12 unaudited guesses. | refactor-radar 2026-08-12 run; PR #481 | refactor-radar, ui-components |
| 2026-08-12 | **Characterization test *before* the move, against the original location.** Assert it green pre-move, then change only the import path. That sequence is what makes an extraction provably behavior-preserving instead of asserted to be. Fast way to capture exact floats: temporarily assert against a sentinel and read the values out of the failure diff. | `client/src/lib/rentVsBuyEstimate.test.ts`; PR #481 | all domains |
| 2026-08-12 | **Calculator math belongs in `client/src/lib/<name>Estimate.ts`,** pure, with a colocated test; the `.tsx` keeps JSX/state/mutations only. Done: affordability, rent-vs-buy. Still inline: Amortization, Mortgage, MortgagePayoff, Bah, DownPayment, HomeEquity. | PR #481; `client/src/lib/affordabilityEstimate.ts` | mortgage-calculations, ui-components |
| 2026-08-12 | **Never inspect a ref with a pathspec checkout.** `git checkout <ref> -- .` overwrites the entire working tree, not just what you meant to read. Use `git show <ref>:<path>`. | this repo, 2026-08-12 session (clobbered an uncommitted tree; recovered only because the work was already committed) | all domains |
| 2026-08-12 | **A file in another session's open PR is claimed.** Target selection must cross-check open PRs' changed files, not just the local ledger. | RR-004 vs PR #467 near-miss | refactor-radar, all domains |
| 2026-08-12 | **Do not hardcode a checkout path in a routine.** Cloud/remote sessions clone somewhere else; a `/Users/...` path aborts the run for no reason. Derive it (`git rev-parse --show-toplevel`). Likewise assume `gh` may be absent and fall back to the GitHub MCP tools. | refactor-radar Phase 0, fixed 2026-08-12 | all routines |
| 2026-08-12 | **Blocked network egress is permanent here, not transient.** Competitor sites and every authoritative regulatory source (`ecfr.gov`, `consumerfinance.gov`, …) are blocked by the sandbox proxy. Do not spend a research budget rediscovering this each cycle — check once, record, move on. | refactor-radar Phase 1 (5/5 sites blocked); `docs/reg-z/README.md` | refactor-radar, seo-content, compliance work |

## 5. What this does not cover

This protocol coordinates sessions; it does not relax any domain rule. Compliance rails
(Reg Z trigger terms, Reg N approval language, TCPA consent, the §9 security-review triggers,
no-citation-no-implementation) bind exactly as written in their own sources, and no lesson
recorded above may loosen one. A lesson that appears to conflict with a compliance rail is a
misread lesson — escalate to the owner instead of acting on it.
