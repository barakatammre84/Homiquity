# Routine claim register

**The lock, and the only one.** Every routine and every human session that intends to **write
code** claims its target here first. Rules live in [`CHARTER.md`](CHARTER.md) §5; this file is the
table plus the overlap protocol.

Without this, the Frontend Wiring Audit (09:10), the Primary Engineer (07:15 — absorbed Sprint Blitz 2026-08-17) and Refactor Radar (Sun 20:00)
all write to `client/src/**` with no idea the others exist.

> **Absorbed `knowledge-base/SESSION_CLAIMS.md` on 2026-08-12.** Two boards briefly existed — this
> one from PR #493 and SESSION_CLAIMS from PR #496, written hours apart by sessions that could not
> see each other, which is the very failure both were built to prevent. This file is authoritative;
> that one is now a pointer stub. Its graduated overlap protocol, shared-file hazards and live claim
> are below; its finding-id scheme and signal hierarchy moved to `CHARTER.md` §5 and §10.

## A claim is a courtesy, not a mutex

Nothing enforces it. It costs one commit and it degrades toward *available*, never toward *blocked
forever* — a session that dies mid-run cannot clean up after itself, so a board that latches would
be worse than no board.

**The stronger signal is always `origin/main`.** A file with an open PR against it is claimed by
that PR, board row or not. Read commits and open PRs first; read this board second, for the intent
that `main` cannot show until work lands.

## How to use it

1. **Claim before writing.** Add a row: routine, target, worktree, branch, UTC timestamp, intent.
2. **Respect fresh claims.** Target claimed **< 24 h** ago → do not race it; take the graduated
   response below.
3. **Reclaim stale ones.** A claim **≥ 24 h** old with no open PR or commit behind it is dead —
   take the work and say so in your report. A claim of any age that *does* have an open PR behind
   it is live, because `main` outranks this page.
4. **Release on finish.** Delete your row whether you shipped, abandoned, or failed, in the same PR
   as the work. A board nobody clears becomes a board nobody reads.
5. **Commit the claim** on your branch so peers can see it. Never push to `main`.

Humans claim too — a routine cannot see your editor.

## Graduated overlap response

When your intended work meets a live claim, the answer is rarely "stop":

- **No overlap** → proceed; add your claim.
- **Adjacent** (same area, different files) → proceed, add your claim *naming the adjacency*, and
  keep your diff inside the files you listed.
- **Direct overlap** (same files, or the same finding-id space) → do **not** race. Prefer different
  work, or work the assist ladder in [`CHARTER.md`](CHARTER.md) §5 against what is already in
  flight. If the work genuinely must happen now, coordinate — `SendMessage` if the session is
  reachable, otherwise a note in the row's Notes for the owner to sequence.

## Active claims

| routine / session | target | worktree | branch | claimed (UTC) | intent |
|---|---|---|---|---|---|
| user-tasked session (F-077 follow-up) | `server/services/scenarioSimulator.ts` MI source, `server/services/loanCosts.ts` (delete `calculatePMI`), `tests/scenarioSimulator.test.ts`, `tests/loanEstimateMI.test.ts` (drop the deleted import) | strange-kilby-c389c0 | `feat/f-077-scenario-sim-matrix-mi` | 2026-08-18 14:29 | The follow-up #553 itself flags: what-if MI card→matrix/product-aware. Stacked on open PRs #552+#553 (adjacent by design — their branches are merged into this one; lands after they do). |

## Recently released

Keep the last ~10 for collision forensics; trim older rows freely.

| routine / session | target | released (UTC) | outcome |
|---|---|---|---|
| primary-engineer 2026-08-18 (item 1) | ux-30 TRID delivery-window honesty: `server/services/loanEstimate.ts`, `server/routes/underwriting/delivery.ts`, `client/src/pages/lending/LoanEstimate.tsx`, `tests/trid.test.ts` | 2026-08-18 | **shipped** — [PR #546](https://github.com/barakatammre84/Homiquity/pull/546). Claim released on landing per rule 4; the branch had gone DIRTY on this register's own shared-file hazard (active-table divergence) and was resolved additively and landed by the #554 session on founder authorization. The stale 08-12 financial-audit row it also carried was already cleared by evening-triage on main — cleared side kept. |
| sprint-blitz 2026-08-12 | `server/services/mismoValidation.ts`, `server/routes/underwriting/compliance.ts`, batch reads in `server/storage/{urla,applications,pipeline}.ts` | 2026-08-12 | **shipped** — [PR #514](https://github.com/barakatammre84/Homiquity/pull/514), CTO_ROADMAP §3.2. Loading split from scoring; the compliance dashboard went from 15N+1 storage reads to a flat 4. New pure modules `server/storage/{batchGroup,urlaBatch}.ts` are shared ground for the next batching job — take them rather than hand-rolling a group-by. |
| `/financial-audit` (weekly, standing claim of 2026-08-12) | money paths (`shared/compensation*`, `costLedger`, `rateLockConfirmation`, `wholesaleLenders`, `contingentLiabilityRegister`, rate-sheets/rateLocks routes, admin Financial pages) · finding ids `F-0812-*` | 2026-08-17 | **stale claim cleared by evening-triage** (REGISTER rule 3): 5 days old, its branch `claude/fervent-mayer-oqk0iv` was merged (#496, #506) and deleted from origin, no worktree exists. The lane's live signal is open PR #521 (2026-08-16) — open PRs outrank this board. The weekly routine re-claims on its next tick per CHARTER §5.5. |
| primary-engineer 2026-08-17 (item 1) | `server/mcp/index.ts` + `server/mcp/softPullGate.ts` (F-042: consent gate ran after the cached-pull return; gate ignored consent type) | 2026-08-17 | **shipped** — gate-first made structural (`readCachedSoftPull` requires the authorized consent as a parameter), scoped via `consentCoversPullType`; 9 new tests in `tests/mcpSoftPullGate.test.ts` prove a refusal never reads `credit_pulls`. Bug reintroduced → 5 fail; fixed → all green. |
| primary-engineer 2026-08-17 (item 3) | `client/src/pages/borrower/CreditConsent.tsx` (ux-20: hard-inquiry fact invisible at the ask) | 2026-08-17 | **shipped** — callout + checkbox label + fine print now name the hard inquiry, mirroring the ratified disclosure item 2; colocated test proves the facts render even with the disclosure document seeded empty. 4 red pre-fix → 543/543 green. |
| primary-engineer 2026-08-17 (item 2, assist) | PR #503 `scripts/bundle-size-baseline.json` (branch `chore/bundle-size-guard`) | 2026-08-17 | **shipped** — CHARTER §5 rung-1 assist on the queue's only red PR: baseline froze at 521,319 on 08-12 while main's merged client work grew the eager entry to a measured 522,148 (+829 raw, +0.16%); branch itself adds zero client bytes (`git diff origin/main...HEAD -- client/` empty). Re-baselined to the measured tip per the guard's own procedure, attribution in the PR comment. |
| refactor-radar 2026-08-17 | `client/src/pages/calculators/AmortizationCalculator.tsx` (RR-015) | 2026-08-17 | **shipped to review** — [#528](https://github.com/barakatammre84/Homiquity/pull/528), the run's one PR. Pure amortization math extracted to `client/src/lib/amortizationEstimate.ts` + colocated characterization tests; page 519→378 lines, behavior-preserving (moved block `diff`-proven byte-identical). **Not merged — owner's call.** Note for peers: `gh pr create` was unusable during a GitHub GraphQL outage that day; the PR was opened over REST (`gh api …/pulls -X POST`), which stayed up. |
| lender-delivery-gate 2026-08-12 | `tests/mismoXsdValidation.test.ts` (worktree `wt-lender`, branch `routine/lender-gate-2026-08-12`) | 2026-08-12 | **shipped** — eight XSD cases early-`return`ed without `xmllint`, which vitest reports as PASSED; converted to `it.skipIf` so absence is visible. Proven both ways: on `adaa826` with no xmllint the suite reports **19 passed**; on the branch, **8 skipped**. Claim was recorded at commit time, not before the edit — a §5.4 deviation, noted in the report. |
| frontend-wiring-audit 2026-08-12 | the remaining 71 singleton-`queryClient` importers | 2026-08-12 | **shipped** — #504, merged and verified in prod via `/api/health`. The migration is now COMPLETE: `client/src/lib/logout.ts` is the only module-singleton consumer left and carries a comment explaining why it must stay (plain async fn, not a render; and `clear()` on the app's own cache is exactly what it wants). |
| frontend-wiring-audit 2026-08-12 | the 12 `client/src` components importing the singleton `queryClient` **with** a `.test.tsx` sibling | 2026-08-12 | **shipped** — migrated to `useQueryClient()` on `claude/frontend-standardization-2` (`384ab1a`). The other **72** singleton importers are untouched and unclaimed; take them in tested-first batches. Note `TestLogin.test.tsx` had been rendering with no `QueryClientProvider` at all — only the singleton made that pass. |
| refactor-radar 2026-08-08 | `client/src/components/ScenarioSimulatorDialog.tsx` (RR-004) | 2026-08-12 | **abandoned** — run crashed mid-flight and left its worktree behind, hard-blocking every later radar run (`SKILL.md` Phase 0.4). Work snapshotted to `wip/radar-2026-08-08-scenario-simulator-abandoned` (do not merge; superseded by merged PR #467), worktree removed, RR-004 returned to `open`. |

## Known shared-file hazards

Several routines legitimately touch these. Expect conflicts and resolve **additively** rather than
taking one side wholesale:

- **`vitest.config.ts`** — the node-lane `include:` array; more than one routine adds test files.
- **`knowledge-base/README.md`** — the doc index; keep both entries, in date order.
- **`tests/__snapshots__/zod-schema-semantics.json`** — re-recorded by any schema change. **Never
  take one side wholesale**: re-record after merging and re-read every delta, because the snapshot
  is what tells you a data-admission rule changed.

There is deliberately **no "observed in flight" table** here. One existed on the old board and was
stale within hours — every row it listed had merged or moved by the next day. Open PRs are the live
answer to "who else is working", and they are one API call away; a hand-copied snapshot of them is
a claim about the past wearing the clothes of the present.
