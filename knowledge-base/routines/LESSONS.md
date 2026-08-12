# Routine lessons register

Append-only shared memory across every routine and session. Rules live in
[`CHARTER.md`](CHARTER.md) §10; this file is where a lesson **accretes between charter edits**.

Each routine runs in a fresh session with no memory of any other run, so a lesson learned mid-run
is lost the moment that session ends unless it is written somewhere a peer will read. §10's
honesty rails are the distilled, human-curated version; this is the inbox that feeds them.

## How to use it

1. **Append when you learn something the next session would otherwise re-learn.** Newest first.
2. **Cite evidence on every row** — a command, a PR, a `file:line`. A lesson without evidence is
   an opinion, and this file is not for opinions.
3. **Promote to `CHARTER.md` §10** when a lesson proves general and durable. Trim rows that were
   promoted or turned out to be wrong; say so in your report rather than deleting silently.
4. **A lesson may never loosen a compliance rail.** Reg Z trigger terms, Reg N approval language,
   TCPA consent, the §9 security-review triggers, no-citation-no-implementation and the delivery
   freeze bind exactly as written in their own sources. A lesson that appears to relax one is a
   **misread lesson** — escalate to the founder instead of acting on it.

## Lessons

| date | lesson | evidence | applies to |
|---|---|---|---|
| 2026-08-12 | **`ListAgents` is the weakest coordination signal — never read a "No reachable agents" result as "nobody is working".** Two sessions found this independently on the same day. Order signals `origin/main` → open PRs → `REGISTER.md` → `ListAgents`. | PR #496 (twice, during an active three-way collision); refactor-radar run (returned no agents while **five** sessions had open PRs) | all routines |
| 2026-08-12 | **Size is a poor proxy for "needs refactoring."** Rank by tangling signals — inline math functions, arithmetic outside a lib import, hook density, non-JSX line ratio — not `wc -l`. `AffordabilityCalculator.tsx` is 88 lines *because* it is already clean. | one grep for inline `function calculate*` found 6 real targets in a second; the size sweep produced 12 unaudited guesses | refactor-radar, wiring audit |
| 2026-08-12 | **Characterization test BEFORE the move, against the original location.** Assert it green pre-move, then change only the import path — that ordering is what makes an extraction *provably* behavior-preserving rather than asserted to be. Fast way to capture exact floats: assert against a sentinel and read the values out of the failure diff. | `client/src/lib/rentVsBuyEstimate.test.ts`; PR #481 | all routines that move code |
| 2026-08-12 | **Never inspect a ref with a pathspec checkout.** `git checkout <ref> -- .` overwrites the entire working tree, not just the file you meant to read. Use `git show <ref>:<path>`. | cost a working tree in the 2026-08-12 radar session; recovered only because the work was already committed | all routines |
| 2026-08-12 | **Do not hardcode a checkout path in a routine.** Cloud and remote sessions clone elsewhere; a `/Users/...` path aborts the run for no reason. Derive it with `git rev-parse --show-toplevel`, and assume `gh` may be absent (fall back to the GitHub MCP tools). | refactor-radar Phase 0 aborted on this in a cloud session, 2026-08-12 | all routines |
| 2026-08-12 | **A routine's environment now varies, so an environment-specific block is invisible elsewhere.** The crashed `refactor-radar-2026-08-08` worktree hard-blocked every radar run on the founder's machine, yet was undetectable from a cloud sandbox, which has no `.claude/worktrees/` at all. Report the environment you observed, not "the" environment. | CHARTER §0 vs the 2026-08-12 cloud radar run, which never saw the orphan | all routines |
| 2026-08-12 | **Blocked network egress here is permanent, not transient.** Competitor sites and every authoritative regulatory source (`ecfr.gov`, `consumerfinance.gov`, `govinfo.gov`, `law.cornell.edu`) are blocked by the sandbox proxy. Check once, record it, move on — do not re-spend a research budget rediscovering it each cycle. | refactor-radar Phase 1, 5/5 sites blocked; [`docs/reg-z/README.md`](../../docs/reg-z/README.md) | refactor-radar, seo-content, compliance work |
| 2026-08-12 | **Calculator math belongs in a pure `client/src/lib/<name>Estimate.ts`** with a colocated test; the `.tsx` keeps JSX, state and mutations only. Done: `affordabilityEstimate.ts`, `rentVsBuyEstimate.ts`. Still inline: Amortization, Mortgage, MortgagePayoff, Bah, DownPayment, HomeEquity. | PR #481 | refactor-radar, mortgage-calculations, ui-components |
