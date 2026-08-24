# Doc Accuracy — 2026-08-24

STATUS: WARN — mode `sweep+fix`. #725 deleted the node test lane's hand-typed allowlist **this
morning**, and by tonight **54 living instruction files** — including the binding definition of
done and 41 auto-loading owner agents — were still ordering every PR author and every agent to
edit a list that no longer exists. 51 of them are corrected in this PR; the rest are proposals,
because their lane is not mine.

**Mode:** `sweep+fix`. One open PR from this routine (#713, `DIRTY`) — below D4's two-PR
threshold, so not `observe`. **Contract:** `origin/main`'s copy of
`.claude/skills/doc-accuracy/SKILL.md` **has its `## Modes` section** (`:117`), so the founder's
2026-08-23 amendment has merged (`6dd7bbf7`, #705) and this run followed `origin/main`, not the
branch fallback. `routines/CHARTER.md` and the skill did not conflict this tick.

## ⛔ Human actions (hardest first)

1. **The definition of done was wrong in the harmful direction, and is corrected in this PR —
   review the wording (DA-0824-01, the steward's HO-0824-01).** `TEAM_PRACTICES.md:96-97` said
   *"New server/logic test files must be added to `vitest.config.ts`'s include list."* After
   `387a3518` (#725, today) that file's `include` is a glob (`vitest.config.ts:71`) and the only
   hand-maintained `"tests/…"` block left is `exclude` (`:77-96`) — so an author who followed the
   rule literally edited the one list that *drops* files. Corrected **tightening only**: the
   obligation (the test must be collected, proved by its filename in the run output) is kept and
   promoted to *the* proof; the impossible mechanism is replaced and dated. ⛔-flagged because §5
   is governance prose (D8), even though the edit is mechanical.
2. **`routines/CHARTER.md:945-948` (§10 Honesty rails) still carries the retired mechanism, and
   §10 is never this routine's to edit (D11) — DA-0824-08.** It is the last remaining site of the
   class. Exact wording proposed below.
3. **Two routine contracts now aim at a mechanism that does not exist (DA-0824-09, the steward's
   HO-0824-03).** `rent-reporting-watch/SKILL.md:37-40` watches for a rent test file being
   *removed from `include:`* — nothing can be removed from a glob — and `:51` plus
   `refactor-radar/SKILL.md:42,219` still grant write territory over "the include array". Changing
   what a routine watches for, or may write, is its contract, not a pointer (D8). Wording below.
   The rent watcher is **redundant, not blind**: `scripts/test-collection-guard.cjs:515` fails on
   an orphaned test file whatever the mechanism.
4. **#713 (open, `DIRTY`) carries a hunk that today's merge made stale.** Its
   `02-architecture.md:42` cell calls the node lane an "**allowlist**" — true when written on
   2026-08-23, false since `387a3518`. It also already fixes three rows that were in my queue, so
   I did not duplicate them (DA-0824-12). Whoever lands it should re-derive that one cell.
5. **The 17:06 steward's own report cites `.github/workflows/ci.yml:583-646` for the integration
   step; at `49720133` that step is at `:689`.** Reported to that seat as a proposed `HO-` row
   below — it is the exact slid-citation class that report's headline is about, carried forward
   from `handoff/LEDGER.md`'s HO-0823-05 row rather than re-read.

## Summary

The window was 115 commits over two days — the gap the 2026-08-23 founder amendment deliberately
left unswept — and one commit in it dominated everything else. `387a3518` (#725) replaced
`vitest.config.ts`'s ~230-path `include` allowlist with a glob, which is a good change that
removed a real source of merge contention; what it also did was falsify a sentence that had been
copy-pasted into 54 living instruction files. The 17:06 Handoff Corpus Steward caught the corpus's
six copies and flagged three siblings; the sweep here found the other forty-eight, all of them in
files that auto-load into a session or bind every PR. Everything I could fix in-lane is fixed in
one mechanical pass that **preserves the rail and drops only the impossible step** — "assert the
filename appears in the run output" survives in all 51 files, because that, not a config edit, was
always the thing that proved a test ran.

## Evidence

### Phase 0 — position and memory

- Worktree `.claude/worktrees/doc-accuracy-2026-08-24` off `origin/main` @ `49720133`;
  `git rev-list --left-right --count origin/main...HEAD` → `0	0`. No `pnpm install` (docs-only
  tick); every guard below is dependency-free.
- `last-swept SHA` was `4206025f`; window `git log --oneline 4206025f..origin/main | wc -l` →
  **115**. Advanced to `49720133` in this PR.
- **Ledger reconciliation.** #647 (`5a7082c0`) and #658 (`c8bb44f6`) both **MERGED 2026-08-23** —
  every `in-pr` row from the 08-20 and 08-22 ticks is landed. **#700 is CLOSED unmerged**, but its
  content is on `main`: the amendment landed inside `6dd7bbf7`/#705, verified by
  `git log --oneline origin/main -- .claude/skills/doc-accuracy/SKILL.md`. Recorded rather than
  escalated — the work is not lost, only the PR.
- **Team sync.** 29 open PRs read. One is this routine's (#713); `#734` is the 17:06 steward's.
  Files claimed by #713 (`CICD.md`, `LOCAL_DEV.md`, `DB_MIGRATIONS.md`, `02-architecture.md`,
  `INCIDENT_RESPONSE_PLAN.md`, `CHARTER.md`, `LESSONS.md`) were left alone except `CICD.md:322-323`,
  a comment block its diff does not touch. `LEDGER.md` is edited by both and resolves **additively**,
  as the 2026-08-23 merge note in that file prescribes.

### Phase 1.4 — handoff corpus consistency (read-only; never written)

- `pnpm handoff:facts --check` @ `49720133` → **FAIL, 48 rows · 40 checkable · 8 not
  machine-comparable**, 8 DISAGREES: F-13 (`230 · 248` → `18 · 249`), F-17 (`14 · 24 · 21` →
  `15 · 25 · 23`), F-18 (`26 · 20` → `27 · 21`), F-19 (`58 · 41` → `59 · 41`), F-21 (`237` →
  `238`), F-31 (`1098` → `1170`), F-34 (`66` → `67`), F-36 (`17 · 7` → `19 · 8`). `STAMP` line:
  `FACTS.md says @ fd4a22c5; HEAD is 49720133`.
- `pnpm handoff:facts --cite` → **FAIL, 12 out-of-range + 1 slid symbol**; all 12 point into
  `vitest.config.ts` (324 → 113 lines), the slid one is `TEACHBACK_KEY.md:116 → CHARTER.md:525-526`.
- `ls knowledge-base/routines/reports/2026-08-24-handoff-steward.md` → **absent on `origin/main`**,
  **present on the open PR #734** (`routine/handoff-steward-2026-08-24`), read this tick.
- **Verdict: case (b) — red, and the steward's report explains it exactly and fixes it.** Its own
  `--check` names the same eight rows and its `--cite` is green after the PR (`974 citations · 0
  ambiguous · 0 out-of-range · 58 symbols on their line`). **No `DA-` finding for the corpus, and
  no WARN for a missing seat** — the seat demonstrably ran today; only its report has not merged.
- **Teach-back (Phase 1.5): not due.** Rotation cursor is at cluster 3, not 14; the last
  teach-back is dated 2026-08-23 in `handoff/LEDGER.md`'s run log — one day ago, far inside the
  21-day rule.

### Phase 1.1/1.2 — the sweeps

- **Diff-driven.** `git diff --diff-filter=DR --name-status 4206025f origin/main` → **no non-`.md`
  deletions or renames**. `package.json` scripts diff: `test` changed meaning
  (`vitest run ×2` → `node scripts/test-collection-guard.cjs`), `test:raw` added, plus
  `harness:t0..t3`, `guard:authority`, `guard:coverage`, `guard:corpus`, `guard:seats`,
  `guard:gating`, `handoff:facts`, `sg:watch*`, `reg:triage`, `coverage:sg`, `brand:*`.
- **Sweep 2b (commands).** 195 living docs × 56 `package.json` scripts → **0 real hits**; every
  survivor is an existing exclusion row (`pnpm audit`, pnpm builtins, prose after the word "pnpm")
  or the documented negation at `backend-data-engineer/SKILL.md:240`. ⚠️ That exclusion row cited
  `:228`; the line is now `:240`. Corrected in this PR — my own ledger had a slid citation.
- **Sweep 2a (paths).** 551 raw hits, 27 after narrowing to repo source roots, **6 real** — all in
  documents this routine may not edit (DA-0824-10 roadmap ×3, DA-0824-11 feature-review ×3). Four
  new exclusion rows added so the remaining 21 are never re-litigated.
- **Sweep 2c/2d.** `pnpm guard:staleness` at baseline in all three metrics (7 launch-sprint,
  3 old-repo-name, 1 dead-Vercel-host occurrences — history and explicit negatives).
- **Sweep 2e (freshness).** `pnpm guard:docs` → `10 living docs verified within interval ✅`.
  Nothing overdue and nothing due inside 7 days (the four cluster-3 registers are stamped
  2026-08-04 / 30 days ⇒ due 2026-09-03). **No stamp bumped** — nothing was re-read in full.

### The headline class, measured

- `387a3518` (#725, 2026-08-24): `vitest.config.ts:71` is now
  `include: ["tests/**/*.test.{ts,tsx}"]`; the file's own epitaph at `:44-62` records why (222
  commits, "#440 and #443 both went stale without merging"). The floor moved to
  `scripts/test-collection-guard.cjs` (orphan check at `:515`).
- 41 agent files carried one byte-identical sentence:
  `perl -0777 -ne 'print "$ARGV\n" if /does not run until it is in/' .claude/agents/*.md | wc -l`
  → **41**. All 41 rewritten in one pass.
- `git diff --shortstat` → **54 files changed, 208 insertions(+), 108 deletions(-)**;
  `git diff --name-only | grep -v '\.md$' | wc -l` → **0**;
  `git diff --name-only | grep '^knowledge-base/handoff/' | wc -l` → **0**.

### Phase 1.3 — rotation slice 3: `governance/` registers + the `security/` pack

Audited, **no drift found**, and one near-miss worth recording:

- `CHANNEL_DECISION.md` — `BUSINESS_CHANNEL = "broker"` verified at `shared/businessChannel.ts:49`;
  `pnpm guard:channel` → `1482 lines across 4 files (baseline 1482). Frozen, no growth. ✅`.
  ⚠️ The doc's four per-file counts (677/338/271/196) are **one higher than `wc -l`** each. They
  are not drift: the guard counts `split('\n').length`. A future tick "correcting" them to `wc -l`
  would break agreement with the guard the doc cites — now an exclusion row.
- `CONTINGENT_LIABILITY_REGISTER.md` — `GET /api/reports/contingent-liabilities` exists and is
  admin-gated (`server/routes/underwriting/submissions.ts:549`); `quantifiedFloor`,
  `unquantifiedCount`, `indeterminateCount`, `usesAssumedWindow` all present in
  `server/services/contingentLiabilityRegister.ts` / `shared/contingentLiabilities.ts`.
- `UNCONSUMED_CAPABILITIES.md` — open-entry list still legitimately empty.
- `security/ACCESS_CONTROL_POLICY.md:80-84` — `requireRole` at `server/auth.ts:452`, `shared/roles.ts`
  present, the threat-model link resolves.
- `security/INCIDENT_RESPONSE_PLAN.md:68` (`www` in the recovery probe) is fixed on open #713 —
  not duplicated.

### Guards (Phase 2 verify loop, 1 attempt)

`pnpm guard:kb` ✅ 237 docs, all indexed, no dead links · `pnpm guard:staleness` ✅ at baseline
(3 metrics) · `pnpm guard:citations` ✅ 29 unresolved at baseline, no regression ·
`pnpm guard:docs` ✅ 10/10 · `pnpm guard:ui` ✅ 0 raw palette / 97 bare literals, both at baseline ·
`pnpm guard:seats` ✅ 38 seats, 3 pre-existing warnings (unrelated). Diff proved `.md`-only and
touching nothing under `knowledge-base/handoff/`. Prod impact: **none**, docs-only.

## Proposed tickets

1. **`routines/CHARTER.md:945-948` (§10) — founder's pen (DA-0824-08).**
   *Before:* "**A new file under `tests/` never runs** unless it is added to the `include:` array in
   `vitest.config.ts`. Client tests under `client/src` are glob-picked automatically."
   *After:* "**A new file under `tests/` is glob-collected** by `vitest.config.ts` automatically
   (#725, 2026-08-24 deleted the hand-typed `include:` allowlist; the floor is now
   `scripts/test-collection-guard.cjs`). Client tests under `client/src` are glob-picked too."
   The rest of the paragraph — the `vitest run <file>` node-config trap and "assert your new test's
   filename appears in the run output" — is still true and stays verbatim.
2. **`rent-reporting-watch/SKILL.md:37-40` — its Phase 2 detection method (DA-0824-09 / HO-0824-03).**
   *Before:* "`vitest.config.ts` is an explicit allowlist: a file removed from it stops running."
   *After:* "`vitest.config.ts` glob-collects `tests/**`; the two ways a rent test stops running are
   an entry added to that file's `exclude:` block (`:77-96`) and the file being deleted. Watch both.
   `scripts/test-collection-guard.cjs:515` already fails on an orphan, so this check is a second
   pair of eyes, not the floor."
3. **Write-territory rows granting "`vitest.config.ts` (include array only)" —
   `refactor-radar/SKILL.md:42` and `:219`, `rent-reporting-watch/SKILL.md:51`.** Either narrow to
   `exclude:` or drop the grant; a permission over a deleted array is dead text that reads as live.
4. **Stop the class recurring — one mechanism, one home.** Eleven drift instances today came from
   one mechanism restated in 54 places. Have the `.claude/**` definition-of-done block **cite**
   `TEAM_PRACTICES` §5 instead of paraphrasing it, so the next mechanism change is one edit.
   Secondary: a `retiredMechanisms` metric in `scripts/doc-staleness-guard.cjs` seeded with
   `vitest.config.ts.*include` (guards are code — a ticket, not this routine's edit).
5. **Evening Triage — `CTO_ROADMAP.md` dead paths (DA-0824-10 + open DA-0822-05):** `:406`
   creditAdverseActions, `:421` dashboard, `:436` guaranteesHomeowner, `:504` the freddie-mac dir.
6. **feature-review seat — `FINDINGS.md` (DA-0824-11 + open DA-0822-04):** `:46`/`:104`/`:296` cite
   files that are directories now, and `:301` still records "The integration tier never runs in CI"
   as mechanically true (false since `d9e8f79d`/#704).

## handoff:

`--check` **48 rows · 40 checkable · 8 not-comparable · 8 DISAGREES** (F-13, F-17, F-18, F-19,
F-21, F-31, F-34, F-36) · `--cite` **12 out-of-range + 1 slid symbol**, all 12 into
`vitest.config.ts` · **explained (case b)** by the 17:06 seat's open PR #734, whose own report
names the same eight rows and lands `--cite` green · today's `2026-08-24-handoff-steward.md` exists
**on that PR, not yet on `main`** · teach-back **not due** (cursor at cluster 3; last run
2026-08-23) · **nothing written under `knowledge-base/handoff/`** — `git diff --name-only |
grep '^knowledge-base/handoff/' | wc -l` → 0.

**Proposed `HO-` rows for the 17:06 Handoff Corpus Steward** (its ledger, not mine):

- **`HO-` (proposed): the steward's own 2026-08-24 report cites a slid line.** It gives
  `.github/workflows/ci.yml:583-646` (and `:584`) for the integration step; at `49720133`
  `grep -n 'Integration lane' .github/workflows/ci.yml` → **`689`**, with the change-scope
  condition at `:690`. The citation was carried forward from `handoff/LEDGER.md`'s HO-0823-05 row
  (written at `d9e8f79d`) rather than re-read, and `ci.yml` has grown since through #718, #722 and
  #726. Same class as that report's own headline, and `--cite` cannot see it because report files
  are outside the corpus.
- **`HO-0824-01` is fixed** in this PR (`TEAM_PRACTICES.md:96-104`) — propose closing it.
- **`HO-0824-02` is fixed** in this PR (`hq-ci-guards-owner.md:92`, both halves) — propose closing it.
- **`HO-0824-03` is half fixed:** the impossible assertion step at `rent-reporting-watch/SKILL.md:120`
  is corrected; the detection method at `:37-40` is proposal 2 above (rule semantics, D8).
- **`HO-0823-05`, `HO-0823-02` and `HO-0822-14`'s two residual sub-claims are fixed on open #713**
  and were deliberately not duplicated here — propose closing them when #713 merges.

STATUS: WARN
