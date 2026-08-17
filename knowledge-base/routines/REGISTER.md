# Routine claim register

The lock. Every routine and every human session that intends to **write code** claims its target
here first. Rules live in [`CHARTER.md`](CHARTER.md) §5; this file is only the table.

Without this, the Frontend Wiring Audit (09:10), Sprint Blitz (09:45) and Refactor Radar (Sun 20:00)
all write to `client/src/**` with no idea the others exist.

## How to use it

1. **Claim before writing.** Add a row: routine, target, worktree, branch, UTC timestamp, intent.
2. **Respect fresh claims.** Target claimed **< 24 h** ago → pick something else.
3. **Reclaim stale ones.** A claim **≥ 24 h** old is stale — take it, and say so in your report.
4. **Release on finish.** Delete your row whether you shipped, abandoned, or failed. A stale claim
   blocks every peer.
5. **Commit the claim** on your branch so peers can see it. Never push to `main`.

Humans: claim too. A routine cannot see your editor.

## Active claims

| routine / session | target | worktree | branch | claimed (UTC) | intent |
|---|---|---|---|---|---|
| _(none)_ | — | — | — | — | — |

## Recently released

Keep the last ~10 for collision forensics; trim older rows freely.

| routine / session | target | released (UTC) | outcome |
|---|---|---|---|
| refactor-radar 2026-08-17 (owner-directed) | `client/src/pages/borrower/URLAForm.tsx` (RR-005) | 2026-08-17 | **extraction refused, prerequisite shipped** — [#530](https://github.com/barakatammre84/Homiquity/pull/530). The RR-005 extraction is refuted by 3 adversarial reviews (`handbook/URLA_FORM_REFACTOR_TRAP.md`), re-verified against the current 750-line file. Shipped only the union-narrowing of `STEPS[].id` that the doc names as its prerequisite. **Peers: do not re-attempt the extraction** — it is `blocked-human` in the radar ledger. |
| frontend-wiring-audit 2026-08-12 | the remaining 71 singleton-`queryClient` importers | 2026-08-12 | **shipped** — #504, merged and verified in prod via `/api/health`. The migration is now COMPLETE: `client/src/lib/logout.ts` is the only module-singleton consumer left and carries a comment explaining why it must stay (plain async fn, not a render; and `clear()` on the app's own cache is exactly what it wants). |
| frontend-wiring-audit 2026-08-12 | the 12 `client/src` components importing the singleton `queryClient` **with** a `.test.tsx` sibling | 2026-08-12 | **shipped** — migrated to `useQueryClient()` on `claude/frontend-standardization-2` (`384ab1a`). The other **72** singleton importers are untouched and unclaimed; take them in tested-first batches. Note `TestLogin.test.tsx` had been rendering with no `QueryClientProvider` at all — only the singleton made that pass. |
| refactor-radar 2026-08-08 | `client/src/components/ScenarioSimulatorDialog.tsx` (RR-004) | 2026-08-12 | **abandoned** — run crashed mid-flight and left its worktree behind, hard-blocking every later radar run (`SKILL.md` Phase 0.4). Work snapshotted to `wip/radar-2026-08-08-scenario-simulator-abandoned` (do not merge; superseded by merged PR #467), worktree removed, RR-004 returned to `open`. |
