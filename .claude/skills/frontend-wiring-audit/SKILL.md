---
name: frontend-wiring-audit
description: Use ONLY when the user explicitly invokes /frontend-wiring-audit or explicitly asks to "run the frontend wiring audit routine". NEVER auto-load for general UI, component, styling, or form questions — those belong to the ui-components skill. This is a scheduled autonomous routine with its own safety rails.
---

# Frontend Wiring Audit — the borrower capture path, end to end

**Cadence:** daily, 09:20. **Writes code:** yes — `client/src/**` on the capture path.
**Produces:** committed fixes on a worktree branch, **always with a PR**.
**Contract:** [`knowledge-base/routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.

> **Provenance.** Reconstructed 2026-08-18 into the repo from CHARTER §1 (question B), §5, §6, §6a
> and §9 and from this routine's own reports (`2026-08-12`, `2026-08-18`), because the definition
> existed only on one machine — see
> [`logs/2026-08-18-routine-suite-audit.md`](../../../knowledge-base/logs/2026-08-18-routine-suite-audit.md).
> **Merge any rail the scheduled-task copy carries that is not derivable from the charter; never
> delete one.** The scheduler keeps its original unwieldy `taskId`
> (`act-as-a-senior-frontend-architect-…`) **on purpose** — renaming it discards its run history and
> stored tool approvals (CHARTER §3). Repoint that task at this file without renaming it.

## Why this routine exists

CHARTER §1's question B: *"a borrower who abandons, or whose data is captured wrong, is the same
loss as a rejected package."* The capture path crosses more boundaries than anything else in the
product — calculator → funnel → auth gate → draft → URLA → consent → submit — and **every defect
this routine has found was invisible from either end alone, with every guard green.**

### What it catches that no other control does

Nothing else traces a value across a boundary. A credit band spelled in the leads vocabulary is
valid on both sides and rejected in the middle. A save that mutates a row it does not invalidate is
green in both files. Tests render under their own `QueryClient`, so an invalidation sent to the
module singleton lands on a cache **no test observes** — the defect and its test are both green.

## Rails

Binding. Each maps to a defect this routine already shipped a fix for.

- **R1 — Invocation.** Only on an explicit `/frontend-wiring-audit` or a scheduled-task prompt
  naming this routine.
- **R2 — Lane.** `client/src/**` on the capture path, plus colocated tests, `tests/**` additions,
  and `vitest.config.ts`'s `include:` array. **Never** `shared/schema/**`, `migrations/**`, or
  anything in the CHARTER §9 trigger set. Server-side causes are reported, not fixed — say which
  file and why, and propose the ticket. **A deviation is recorded in the report, never quietly
  taken.**
- **R3 — The §5 claim lock.** `git fetch origin && git pull --rebase origin main`, then
  `pnpm install --frozen-lockfile` **again after the rebase**; read open PRs (every file in one is
  claimed) and `REGISTER.md`; claim your target and **push the claim commit with the branch
  immediately** — an unpushed claim is invisible. Release the row when the item ships or dies.
- **R4 — Prove it by reverting.** A fix ships only with a regression test **verified to fail
  against the previous code**, and the report says how many cases fail and with what string
  (`Waitlist.test.tsx`: 5 of 7 fail pre-fix). An assertion that passes both ways proves nothing.
- **R5 — Always open a PR.** A branch with no PR is invisible to `gh pr list` and to every peer —
  that is the exact shape of the nine-audit collision. If an instruction says "do not push",
  CHARTER §9 wins; flag the conflict in the report.
- **R6 — Visual and wiring changes ship separately.** A conformance batch (§6a) is visual only: no
  `react-hook-form` rewiring, no Zod edits, no API payload changes in the same commit. Capture
  fields feed the ULDD/UCD package, and a large styling diff is where a dropped field hides best.
- **R7 — Never weaken a consent, disclosure or FCRA gate**, and never edit a `complianceInvariants`
  test to make something pass — a failure there is a compliance incident. Compliance copy pinned by
  tests is preserved byte-for-byte.
- **R8 — CHARTER §8 verbatim.** Never push to `main`, merge, arm auto-merge, or touch production.
  `git add` explicit paths only.
- **R9 — Never claim a UI change was verified in a browser.** The client lane is happy-dom: no
  layout engine, no Playwright, no axe. Report the commands you actually ran.
- **R10 — Date every standing claim** before acting on it. This routine once found a §1 launch
  blocker that had been fixed for a week and asserted in three documents.

## Phase 0 — Orient

Fresh worktree off current `origin/main` under `.claude/worktrees/`; own branch; install after
rebase; read `CHARTER.md`, `REGISTER.md`, `LESSONS.md`, and yesterday's reports. Claim (R3).

## Phase 1 — Trace one path segment end to end

Rotate the segment; do not re-walk the whole funnel every day. The path:

`calculators → /apply funnel → auth gate → draft persistence → URLA sections → consent → submit`

For the chosen segment, follow each **value**, not each file: where it is produced, what vocabulary
it is in, what validates it, what persists it, what invalidates the cache that reads it, and what
the borrower is told when any of that fails.

## Phase 2 — The house defect classes

Sweep for these by name. Every one has shipped here at least once:

1. **A success toast on a rejected write** — `await` on the fetch primitive only rejects on network
   errors; no `res.ok` check means a 400 or a 429 renders as success.
2. **A filter before a write** — `buildPayload()` dropping rows the UI reported as saved.
3. **A refetch restoring stale truth** — the mutation succeeded, the invalidation did not reach the
   client the component was rendered under.
4. **Local state standing in for a durable operation** — `sessionStorage` where every sibling uses
   `localStorage`, so attribution expires with the tab.
5. **A vocabulary mismatch across a boundary** — two valid enums, one invalid crossing.
6. **A cleared field that silently does not clear** — absent vs `null` vs value on the wire.
7. **A 5xx rendered as a user error** — a missing field read as `false` and shown as "invalid".

## Phase 3 — Fix, prove, ship

Smallest complete change. Characterization or regression test **first**, verified failing against
the previous code (R4). Then: `pnpm check` · `pnpm test` (node **and** client lanes — a new file
under `tests/` runs only if added to `vitest.config.ts`'s `include:`; assert the filename appears in
the run output) · `pnpm build` · the `pnpm guard:*` suite · a `detectTriggers()` rehearsal on the
final diff (`scripts/security-review-guard.cjs`; set `CHANGED_FILES` explicitly). Any §9 trip →
**draft PR** with ⛔ "write the security review or reject", and you never author that review.

## Phase 4 — Report

`knowledge-base/routines/reports/<YYYY-MM-DD>-wiring-audit.md`, CHARTER §9 order: `STATUS` · ⛔
human actions · Summary ≤5 sentences · Evidence — `file:line` for every defect and the revert-proof
counts · proposed tickets. Commit `docs(routine): wiring-audit <date>`, PR it, release the
`REGISTER.md` row, remove the worktree (`git worktree remove`, never `--force`).

**Status rules.** `FAIL` = you left the lane, broke something, or cannot account for the state you
left behind. `WARN` = a defect found and not fixed (say why and where it is parked), a missing
upstream, or a §9-tripped draft awaiting review. `OK` = the segment traced clean, or every defect
found is fixed, proven and PR'd.

## What this routine deliberately does not do

Touch `shared/schema/**` or migrations · fix a server-side cause · merge anything · redesign a
screen (that is a §6a conformance batch, one surface per PR, or Refactor Radar's lane — which
forbids visual changes entirely).
