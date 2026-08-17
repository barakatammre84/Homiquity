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
| 2026-08-12 | **Watch a new guard FAIL before trusting it, and make its no-input case loud.** A guard that measures an artifact will silently pass when the artifact is missing unless you make absence an error — the one state it cannot judge, reported green. Also assert the guard *found something*: a regex that matches nothing reports a clean zero and passes forever. Both were exercised deliberately (missing `dist/`, and an `index.html` with no assets) before `guard:bundle` was wired into CI. | `scripts/bundle-size-guard.cjs` (lands separately in the `chore/bundle-size-guard` PR); the same "finds files to scan" assertion credited in `tests/clientSchemaImports.test.ts` with exposing its own blind spot | anyone adding a guard |
| 2026-08-12 | **`ListAgents` is the weakest coordination signal — never read a "No reachable agents" result as "nobody is working".** Two sessions found this independently on the same day. Order signals `origin/main` → open PRs → `REGISTER.md` → `ListAgents`. | PR #496 (twice, during an active three-way collision); refactor-radar run (returned no agents while **five** sessions had open PRs) | all routines |
| 2026-08-12 | **Size is a poor proxy for "needs refactoring."** Rank by tangling signals — inline math functions, arithmetic outside a lib import, hook density, non-JSX line ratio — not `wc -l`. `AffordabilityCalculator.tsx` is 88 lines *because* it is already clean. | one grep for inline `function calculate*` found 6 real targets in a second; the size sweep produced 12 unaudited guesses | refactor-radar, wiring audit |
| 2026-08-12 | **Characterization test BEFORE the move, against the original location.** Assert it green pre-move, then change only the import path — that ordering is what makes an extraction *provably* behavior-preserving rather than asserted to be. Fast way to capture exact floats: assert against a sentinel and read the values out of the failure diff. | `client/src/lib/rentVsBuyEstimate.test.ts`; PR #481 | all routines that move code |
| 2026-08-12 | **Never inspect a ref with a pathspec checkout.** `git checkout <ref> -- .` overwrites the entire working tree, not just the file you meant to read. Use `git show <ref>:<path>`. | cost a working tree in the 2026-08-12 radar session; recovered only because the work was already committed | all routines |
| 2026-08-12 | **Do not hardcode a checkout path in a routine.** Cloud and remote sessions clone elsewhere; a `/Users/...` path aborts the run for no reason. Derive it with `git rev-parse --show-toplevel`, and assume `gh` may be absent (fall back to the GitHub MCP tools). | refactor-radar Phase 0 aborted on this in a cloud session, 2026-08-12 | all routines |
| 2026-08-12 | **A routine's environment now varies, so an environment-specific block is invisible elsewhere.** The crashed `refactor-radar-2026-08-08` worktree hard-blocked every radar run on the founder's machine, yet was undetectable from a cloud sandbox, which has no `.claude/worktrees/` at all. Report the environment you observed, not "the" environment. | CHARTER §0 vs the 2026-08-12 cloud radar run, which never saw the orphan | all routines |
| 2026-08-12 | **Blocked network egress here is permanent, not transient.** Competitor sites and every authoritative regulatory source (`ecfr.gov`, `consumerfinance.gov`, `govinfo.gov`, `law.cornell.edu`) are blocked by the sandbox proxy. Check once, record it, move on — do not re-spend a research budget rediscovering it each cycle. | refactor-radar Phase 1, 5/5 sites blocked; [`docs/reg-z/README.md`](../../docs/reg-z/README.md) | refactor-radar, seo-content, compliance work |
| 2026-08-12 | **Calculator math belongs in a pure `client/src/lib/<name>Estimate.ts`** with a colocated test; the `.tsx` keeps JSX, state and mutations only. Done: `affordabilityEstimate.ts`, `rentVsBuyEstimate.ts`. Still inline: Amortization, Mortgage, MortgagePayoff, Bah, DownPayment, HomeEquity. | PR #481 | refactor-radar, mortgage-calculations, ui-components |
| 2026-08-17 | **A scheduler `lastRunAt` stamp is not evidence a run happened — and the last slot of the day is the first one starved.** Evening Triage was stamped "run" while zero sessions and zero transcripts existed for it, ever: evenings the app is closed defer everything to next-launch catch-up bursts, where the global concurrency limit sheds the queue's tail — structurally always the latest-scheduled routine (97 recorded skips). Missing stored tool approvals are a *symptom* of never having run, not the cause. Verify a routine by its session transcript or its report, never by `lastRunAt`; keep the day's last slot in a quiet window; and click "Run now" once per new routine so its approvals exist before its first headless run. | evening-triage: `lastRunAt 2026-08-17T16:07Z`, no session in `list_sessions`, no transcript hit for its prompt, 0 reports on any branch; rent-reporting-watch same signature 2026-08-14 | all routines; whoever registers one |
| 2026-08-17 | **"The gate is green" is a claim about a head SHA, not about a PR — re-read checks at the *current* head before repeating it.** #539's gate ran green at 19:43Z; the report commit then moved the head and its dispatch dropped, leaving zero check-runs where a green gate had been truthfully reported an hour earlier. A body-edit nudge is itself droppable (both #537's and #539's were, same day). Verify with `gh api repos/…/commits/<head-sha>/check-runs` (REST — GraphQL's `statusCheckRollup` was empty-vs-stale all day); zero runs at head means branch protection cannot pass regardless of any earlier green. | evening-triage 2026-08-17: run 32061953955 green on the pre-report head vs `total: 0` at `3f63ab3`, re-checked after the 20:14Z body edit | all routines; anyone about to merge |
