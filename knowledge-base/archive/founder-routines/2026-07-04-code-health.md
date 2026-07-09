# Code Health — 2026-07-04

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**STATUS: WARN** — no compliance seam broken and no prior code-health PR regressed anything (this is the routine's first run), but the intended dependency-removal PR had to be aborted mid-flight when a clean reinstall proved unsafe, and this environment has a real tooling landmine worth fixing before anyone next touches `package.json`.

## Human actions

⛔ **`package-lock.json` has 53 packages resolved against a dead `package-firewall.replit.local` proxy** (a leftover from when this repo lived on Replit). Any fresh `npm ci`/`npm install` on a machine whose local npm cache doesn't already have those exact tarballs cached will fail with `ENOTFOUND` and npm's own "Exit handler never called" bug. The primary checkout's `node_modules` still works because it was never rebuilt from scratch — but every future worktree/dependency change is one clean install away from hitting this. Needs a deliberate, carefully-verified lockfile regeneration (see ticket CH-1 below) — not something to do reflexively mid-task.

⛔ **This repo carries two lockfiles** (`package-lock.json` + `pnpm-lock.yaml`, with `packageManager: pnpm@10.34.4` declared in `package.json`) while every documented local command (`CLAUDE.md`, `LOCAL_DEV.md`) uses `npm run …`. Worth a founder decision on which is authoritative locally so dependency work doesn't keep tripping on this ambiguity.

## Summary

This is the routine's first run, so there's no prior week to regress — STATUS would be OK on code weight alone. Client, server, and shared all grew a small, fully-explained amount (0–1.5%) from real merged work (AG-2 identity handshake, LO Command Center, audit re-anchor, intake kill switch, error monitoring). Tests grew 18%, which looks alarming in isolation but is entirely test coverage added alongside those same features — a good kind of growth. The one real finding this week is environmental: attempting the safest-looking PR (removing 15 confirmed-orphaned dependencies) required a clean `npm install`, which surfaced that this repo's lockfile is stale enough relative to the live registry that a fresh resolve silently bumps ~40 unrelated packages and breaks the build (a `react-icons` minor bump alone deleted an icon export the app imports). That's not a code problem — main's `npx tsc` is clean today — but it means dependency hygiene work here needs either a warmed cache or a deliberately scoped lockfile edit, not a naive reinstall. No code-health PR ships this week; the safest available deletion turned out not to be safe once tested, which is exactly what the safety gate is for.

## Checks run → results → evidence

### Trend table (first row — `kb/founder-routines/code-health-trend.csv` created this run)

| Area | Files | Lines | vs. today's stated baseline | Attribution |
|---|---|---|---|---|
| client/src | 183 | 58,478 | +1 file / +352 lines (+0.6%) | `LoCommandCenter.tsx` (+346, PR #33), `AdverseActionNotice.tsx` (+170, roadmap #26), auth-recovery pages (+354, roadmap #2) minus routine consolidation elsewhere — net small |
| server | 123 | 51,303 | +2 files / +751 lines (+1.5%) | `mcp/identity.ts` (+129, AG-2), `services/fileHealth.ts` (+137, LO Command Center), `services/errorMonitoring.ts` (+109, roadmap #4), `services/maintenanceMode.ts` (+34, roadmap #27), `creditService.ts`/`encryptionService.ts` audit-chain work (AG-1/AG-2) |
| shared | 22 | 10,035 | +5 lines (~0%) | noise-level; no attribution needed |
| tests | 47 | 9,044 | +5 files / +1,387 lines (+18.1%) | `mcpAgentIdentity.test.ts` (+131), `mcpAudit.test.ts` (+30, +427 in two commits), `auditReanchor.test.ts` (+464), `fileHealth.test.ts`+`loCommandCenter.test.ts` (+253), `maintenanceMode.test.ts` (+87) — all coverage for AG-1/AG-2/LO Command Center/kill switch, already-merged PRs. **Explained, and the right direction.** |
| deps | — | — | 74 prod / 20 dev, unchanged | no net dependency change landed this run (see below) |

The "today's stated baseline" column compares against the numbers this task was launched with; the small deltas are same-day routine/PR commits that landed between when that baseline was taken and when this run started (`docs(routine): evening triage`, `lo pipeline handoff`, `midday lender liquidity`, `lo edge-case mining` — all docs-only, confirmed via `git show --stat`, so they don't affect these counts; the deltas are entirely from the AG-2/LO-Command-Center/audit-reanchor merges already noted above).

### Dead-code / unused-dependency scan

`npx knip` and `npx depcheck` both ran successfully (no tooling failure this week).

- **`knip`**: flagged ~150 unused exports, effectively all of them interfaces in `shared/mismo.ts`. **These are a documented compliance seam** (`CLAUDE.md`: "MISMO 3.4 reference-model types (ULDD Phase 5) — `shared/mismo.ts`") — a reference-model type file where most interfaces are used piecemeal by MISMO XML generation and knip can't see through the re-export pattern. **Correctly not on the deletion list; flagging here so nobody acts on knip's raw output without this context.** One real, low-stakes finding: a duplicate export `BorrowerRequests | default` in `client/src/components/BorrowerRequests.tsx` — cosmetic, not worth a standalone PR.
- **`depcheck`**: flagged 14 unused prod deps + 3 unused dev deps, plus a "missing dependencies" list that is entirely path-alias false positives (`@shared/*`, `@assets/*` — depcheck doesn't resolve `tsconfig` paths) except one genuine miss: **`nanoid` is imported in `server/index-dev.ts:6` but is not a direct entry in `package.json`** — it currently resolves as a transitive dependency of something else, which is fragile (ticket CH-3).

**Three-check verification on the 14 unused prod + 3 unused dev deps** (compliance-seam check / queryKey check / dynamic-dispatch check — all clear, confirmed by grep across the whole tree excluding `node_modules`/worktrees, zero source references beyond `package.json` itself):

| Package | Why it's dead |
|---|---|
| `google-auth-library`, `memoizee`, `memorystore`, `openid-client`, `passport-local`, `@types/memoizee`, `@types/passport-local` | Replit-Auth-era packages — orphaned since "Remove all Replit coupling" (`27ad22e`). `passport` core is still used for session serialize/deserialize (`server/integrations/auth/session.ts`) but no `Strategy` is registered anywhere — confirmed by grep. |
| `@types/supertest`, `supertest` | Zero references in `tests/` or anywhere else. |
| `@jridgewell/trace-mapping`, `next-themes`, `p-limit`, `p-retry`, `tw-animate-css`, `zod-validation-error` | Zero references. `next-themes` in particular corroborates roadmap item #21's finding that dark mode has no provider/toggle. |

**This was going to be this week's PR — see "This week's PR" below for why it didn't ship.**

### Duplication hotspots

1. **N+1 per-item fetch loops instead of the house `inArray` batch pattern** (`server/routes/lending.ts`'s `/api/dashboard` is the house style to match):
   - `server/routes/agent-broker.ts:41` — `agents.map(async (agent) => storage.getUser(agent.userId))`, one query per agent in `/api/agents/search`.
   - `server/routes/agent-broker.ts:817` — `referrals.map(async (referredUser) => storage.getLoanApplicationsByUser(...))` in `/api/my-referrals`, one query per referred user.
   - `server/routes/underwriting.ts:873` — `activeApps.map(async (app) => getApplicationValidationSummary(app.id))`, one MISMO validation pass (itself multi-query) per active application.
   These are real (not cosmetic) — each is an unbounded per-row query that will scale linearly with agent/referral/application count. **Ticket CH-2.**
2. **Scattered raw `user.role !== "admin"` checks** instead of a shared predicate — 15+ occurrences across `agent-broker.ts`, `compliance.ts`, `lending.ts`, `underwriting-rules.ts`, `data-intelligence.ts`, `documents.ts`, `borrower.ts`. `requireRole()` (`server/auth.ts:428`) and `isInternalStaffRole`/`isStaffRole` (`shared/roles.ts:73,81`) already exist and are used at the route-registration level, but object-level "is this specific actor an admin" checks inside handlers are all hand-rolled string comparisons rather than a shared `isAdmin(user)` helper. Consolidating touches 8 files — ticket, not this week's PR. **Ticket CH-4.**

### Decision-path test debt

Worst-first, comparing `server/services/{decisionEngine,preUnderwriting,underwritingNuance,pricingAdapter,ruleEngine}.ts` + the top-level engine/pipeline files against `tests/`:

| Module | Lines | Dedicated test file? | Coverage today |
|---|---|---|---|
| `server/pipelineEngine.ts` | 897 | **No** | Only incidentally exercised by `tests/statusVocabulary.test.ts` (narrow scope — status-enum transitions, not stage/document/milestone logic). Largest untested file in the decision path. |
| `server/services/ruleEngine.ts` | 189 | **No** | Zero references anywhere in `tests/`. This is the DSL condition/action evaluator behind `/api/underwriting-rules/execute` (an accepted-baseline endpoint) — a rule-DSL engine with no test coverage at all. |
| `server/services/pricingAdapter.ts` | 227 | **No** | Zero references anywhere in `tests/`. Computes LLPA-adjusted borrower offers — pricing-decision-adjacent, zero coverage. |
| `server/services/analyticsEventPipeline.ts` | 244 | **No** | Zero references. Lower regulatory priority (telemetry, not a decision path) — noted for completeness, not urgency. |
| `server/services/decisionEngine.ts` | 395 | No dedicated file, but well-exercised via `tests/adversarialPersonas.test.ts` + `tests/complianceInvariants.test.ts` | Acceptable — flagging only because there's still no unit-level file naming it directly. |
| `server/underwritingEngine.ts` | 602 | No dedicated file, but exercised by `complianceInvariants`, `underwritingEdgeCases`, `runUnderwritingTestSuite`, `adversarialPersonas` | Good coverage via multiple suites — no action needed. |

Tickets CH-5 (`ruleEngine.ts`) and CH-6 (`pipelineEngine.ts`) below, worst-first by size × zero-coverage.

### This week's PR: none — here's why

The dependency-removal list above looked like the safest possible PR (pure `package.json`/lockfile edit, zero source-file touches). In an isolated worktree (`claude/code-health-deps-cleanup`, since discarded), removing the 15 packages and running `npm install` to regenerate the lockfile hit npm's own `"Exit handler never called!"` bug repeatedly — traced to `package-lock.json` having 53 packages resolved against the dead `package-firewall.replit.local` proxy (ticket CH-1), which fails `ENOTFOUND` for any package not already in the local npm cache.

Working around it with a full `rm -rf node_modules package-lock.json && npm install` did complete cleanly (exit 0) — but comparing the regenerated lockfile against main's showed **~40 unrelated top-level packages silently bumped** (registry has moved on since main's lockfile was last generated; caret ranges like `"react-icons": "^5.4.0"` resolved to `5.7.0`). One of those bumps broke the build: `react-icons@5.7.0` no longer exports `SiLinkedin`, which `client/src/components/SocialLoginButtons.tsx:3` imports — `npx tsc` failed. That's real, uncontained blast radius from what should have been a 15-package deletion, so per this routine's own rule ("a risky deletion is not [an acceptable outcome]"), the branch was discarded and the worktree removed. **Verified-dead dependency list stands and is ready to execute the moment CH-1 is resolved or from a machine with a fully warm npm cache** — re-attempt next week or once CH-1 lands.

## Corrections table

| What was assumed | What's actually true | Evidence |
|---|---|---|
| Removing unused `package.json` entries is a mechanically safe, zero-risk edit | In this repo, any full lockfile regen (which `npm uninstall`/`npm install` triggers even for unrelated packages once the tree is touched) risks silent version drift across dozens of unrelated packages because main's lockfile predates the current registry state by enough that caret ranges resolve differently today | Direct version diff, main vs. regenerated lockfile — ~40 packages changed, one (`react-icons`) broke `tsc` |
| `knip`'s ~150 unused-export findings in `shared/mismo.ts` are dead code | They're a documented compliance seam (MISMO reference-model types) that knip can't see is used piecemeal by XML generation | `CLAUDE.md` table + `server/mismo.ts` imports |
| `depcheck`'s "missing dependency" list implies real gaps | All but one are `tsconfig` path-alias false positives (`@shared/*`, `@assets/*`); the one real miss is `nanoid` (used, not declared) | Manual read of each flagged import path |

## Remediation tickets

- **CH-1** (Amr — needs a deliberate, verified pass, not autopilot) — Regenerate `package-lock.json` to drop the 53 dead `package-firewall.replit.local` resolved URLs, from an environment with a full/warm npm cache or direct registry access, then diff every top-level package version against today's `package.json` ranges before committing so nothing silently bumps. Est: 2h (mostly verification, not mechanics).
- **CH-2** (Claude) — Replace the three N+1 per-row fetch loops (`agent-broker.ts:41`, `agent-broker.ts:817`, `underwriting.ts:873`) with the batched `inArray` pattern used in `/api/dashboard`. Est: 3h incl. tests.
- **CH-3** (Claude) — Add `nanoid` as an explicit `package.json` dependency (currently a working-by-luck transitive resolution used directly in `server/index-dev.ts:6`). Est: 0.25h.
- **CH-4** (Claude, ticket not a quick fix — touches 8 files) — Consolidate the 15+ raw `user.role !== "admin"` checks across `agent-broker.ts`, `compliance.ts`, `lending.ts`, `underwriting-rules.ts`, `data-intelligence.ts`, `documents.ts`, `borrower.ts` behind one shared `isAdmin(user)` predicate alongside the existing `shared/roles.ts` helpers. Est: 4h.
- **CH-5** (Claude) — Write a dedicated test file for `server/services/ruleEngine.ts` (189 lines, zero coverage today, backs the accepted-baseline `/api/underwriting-rules/execute` endpoint). Est: 3h.
- **CH-6** (Claude) — Write a dedicated test file for `server/pipelineEngine.ts` (897 lines, largest untested decision-adjacent module, only incidentally touched by `statusVocabulary.test.ts`). Est: 5h given its size.
- **Re-attempt** the 15-package dependency removal (list above) once CH-1 lands or from a warm-cache environment. Est: 1h (mechanics only, once the environment risk is gone).

---
STATUS: WARN
