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
| refactor-radar 2026-08-08 | `client/src/components/ScenarioSimulatorDialog.tsx` (RR-004) | 2026-08-12 | **abandoned** — run crashed mid-flight and left its worktree behind, hard-blocking every later radar run (`SKILL.md` Phase 0.4). Work snapshotted to `wip/radar-2026-08-08-scenario-simulator-abandoned` (do not merge; superseded by merged PR #467), worktree removed, RR-004 returned to `open`. |
