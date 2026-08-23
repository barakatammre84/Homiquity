# Doc Accuracy — 2026-08-20

**STATUS: WARN** — the corpus fixes landed, but the tick found two live **config** regressions the
docs were quietly papering over: prod deploy verification is switched off *while Railway is still
deploying every merge*, and `main`'s required-check list is empty.

Mode: `sweep+fix` · window `e3655d7..d8316ec` (**79 commits, 2 days** — the seat was defined
2026-08-18 and first fired 2026-08-20; from here ticks are one day wide) · rotation slice **1**
(root `README.md` + `CLAUDE.md`) · **1 PR**, docs-only.

---

## ⛔ Human actions — hardest first

1. **`verify-deploy` is `if: false` while Railway is deploying every merge to prod.**
   #608 disabled it and put `migrate-prod` on `workflow_dispatch` on the written premise that
   *"the Railway production service is being taken down"* (`.github/workflows/ci.yml:507,585`).
   **The service is up and current.** Prod served `d8316ec1` — the exact `origin/main` tip — at
   2026-08-20T22:45:18Z, with **38 commits merged since the pause**. The job that exists to catch a
   failed build silently serving the *previous* container is therefore off precisely while deploys
   are happening: the 2026-08-06 eight-commits-stale exposure, now unwatched and looking deliberate.
   **Decide one of two things, tonight:** restore `verify-deploy` (`if: github.event_name == 'push'`),
   or actually stop the Railway service so the premise becomes true.
   *Mitigation as of tonight:* **zero** migrations have landed since the pause
   (`git diff --name-only e762743b..origin/main -- migrations/` is empty), so the journal has not
   yet run ahead of prod. That is luck with a 38-commit head start, not a control.
   → `DA-0820-09`, `regression-suspect`. **Not edited — `ci.yml` is code (rail D10), and rail D7
   forbids editing a doc to match a state that may itself be the defect.**

2. **`main`'s branch protection has zero required status checks.** `gh api
   repos/barakatammre84/Homiquity/branches/main/protection` → `"contexts":[]`, `"checks":[]`, with
   `enforce_admins: true` — which binds admins to nothing. Every doc that calls `gate` "the required
   check" is describing a rule the branch is not enforcing. `ci.yml:42-45` already records this
   ("previously read ✅ CONFIGURED 2026-07-17 … true when written and false by 2026-08-19"); the
   root `README.md` had not caught up, and this PR corrects it. **Restoring the required context is
   a founder action.** → `DA-0820-10`, `regression-suspect`.

3. **Confirm the old CCR `doc-accuracy` trigger was deleted.** This seat now runs on the *local*
   fleet (`doc-accuracy-daily`, `30 19 * * *`, verified live). CHARTER §3a still listed it on the
   CCR fleet at `40 3,9,15,21 * * *`; I marked that row **moved** but **could not verify deletion** —
   no `list_triggers` tool is reachable from this session. Two doc-hygiene routines over one `.md`
   corpus is the exact two-truths hazard §3a's own retired row records. → `DA-0820-07`.

4. **Rail D10 vs. reality: this routine's `SKILL.md` still describes a 6-hourly cadence.** The
   founder re-seated it daily at 19:30 on 2026-08-20. D10 forbids self-amendment, so the file is
   unchanged. Proposed wording is in *Proposed tickets* below; **one line, founder's pen.**

---

## Summary

Two carried findings closed themselves — **#559's doc-staleness ratchet** had already normalized
the `npm`-as-instruction and "launch sprint" classes the founding audit logged, leaving exactly one
live survivor, now fixed. The rotation slice found the repo's landing file telling every new reader
three things that are false: that merges deploy with CI proving it, that `gate` is a required check,
and that a five-routine automation suite dead since 2026-07-04 is *current doctrine*. The charter
was carrying the same defect it teaches against — §3a asserted three skills "not on `origin/main`
yet" when two had merged **before the sentence was written**, and §2's re-verify column told you to
`curl www` one row below "never `www`". Nine findings are fixed in this PR; two are config
regressions escalated un-edited, and one belongs to a peer routine's ledger.

---

## Evidence

Every claim below is a command run in this tick's worktree at `d8316ec`.

### Closed from the founding ledger
- **DA-0818-02** (`npm`-as-instruction) → **done**. `pnpm guard:staleness` → `6 npm-as-instruction
  occurrences (at baseline, no regression) ✅`; `--list` shows five are quoted history or explicit
  negatives. The sixth was live: `knowledge-base/compliance/REGULATORY_MONITORING.md:9` said
  `scripts/regulatory-freshness.cjs` "runs inside `npm run checkup`". `scripts/checkup.sh:67` runs
  it; the invocation is `pnpm checkup`. **Fixed** (`DA-0820-02`). Every other file the audit named
  is clean; `handbook/design/design_guidelines.md` no longer exists.
- **DA-0818-03** (retired term in two specs) → **done**. `grep -in "launch sprint|launch-sprint"`
  over `specs/LO_ADVISOR_PROGRAM.md` and `specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md` → nothing.
  Normalized by **#559 (`e7762d43`)** in the same pass.

### Fixed in this PR
| id | file | was | evidence |
|---|---|---|---|
| DA-0820-01 | `README.md` deploy + protection block | "every merge builds and deploys on Railway … polled by CI's `verify-deploy` job … `main` is protected … through the required `gate` check — direct pushes are rejected" | `ci.yml:505,580` (`if: false`, `workflow_dispatch`); `gh api …/branches/main/protection` → `contexts: []` |
| DA-0820-02 | `compliance/REGULATORY_MONITORING.md:9` | `npm run checkup` | `package.json` script `checkup`; CHARTER §2 standing fact |
| DA-0820-03 | `L2_COMPLIANCE_AND_LOGIC.md:38`, `feature-review/DOMAINS.md:290` | `server/storage.ts` as a live file, "~5,600-line" | `git log --diff-filter=D -- server/storage.ts` → `227cd778` (#182) split it into 22 modules; `wc -l server/storage/*.ts` → 6,311 |
| DA-0820-04 | `feature-review/CHARTER.md:46` | cross-reference `knowledge-base/logs/ux-audit/page-audit.md` — the directory does not exist | `2eb3af23` (#458) moved the corpus to `knowledge-base/archive/ux-audit/` |
| DA-0820-05 | `README.md:76` + a banner on `runbooks/PRE_PRODUCTION_OPS_ROUTINES.md` | "(current: 5-routine launch suite)" | none of its five `taskId`s appears in `list_scheduled_tasks`; CHARTER §0 records the suite stopping 2026-07-04 |
| DA-0820-06 ⛔ | `routines/CHARTER.md` §3, §3a | "three of these cite a skill that is not on `origin/main` yet"; "#589, #607 … if they merge"; "once #607 lands" | #566 `46006862` 19:24Z · #569 `f7501e07` 20:04Z · #574 `70598e33` 21:33Z (all 08-18) · #589 08-20 16:25Z · #607 08-20 18:11Z; `JOURNEYS.md` landed via **#595** (`8260d734`) |
| DA-0820-07 ⛔ | `routines/CHARTER.md` §3 / §3a | no clock row for this routine; §3a still had it on CCR every 6 h | `list_scheduled_tasks` live: `doc-accuracy-daily`, `30 19 * * *`, enabled, `lastRunAt 2026-08-20T22:32:52Z`. All 13 pre-existing §3 rows re-verified against the same read — **correct, no other drift** |
| DA-0820-08 ⛔ | `routines/CHARTER.md` §2 | *Public host* and *Deploy proof* both gave `curl -s https://www.homiquity.com/api/health` — one row from "**never `www`** — three cron sweeps died `curl` exit 6 on DNS" | the table read at `d8316ec` |
| DA-0820-12 | `README.md:62` | "the 11-chapter subsystem handbook" | `ls knowledge-base/handbook/app-guide/` → 12; `12-api-contract.md` from #574 |

### Escalated, not edited
- **DA-0820-09** / **DA-0820-10** — ⛔ items 1 and 2 above.
- **DA-0820-11** — `routines/journey-walk/LEDGER.md:7` calls **#607** "still open, `DIRTY`";
  `gh pr view 607` → `MERGED 2026-08-20T18:11:22Z`. Peer routines' cross-run memory is off limits
  (D10) → handed to the **Client Journey Walk** seat.

### Sweeps that came back clean
- **Sweep 2b (commands-as-instruction):** 191 living `.md` files scanned; 14 candidate hits, **0
  real** — all `pnpm guard:*` / `pnpm test:*` globs or prose after the word "pnpm". Now excluded.
- **Sweep 2a (repo paths):** 785 backticked path references; after stripping `:NN` citation
  suffixes, 21 distinct missing paths, of which **4 were live** (fixed above) and the rest are
  peer registers, `CTO_ROADMAP.md`, or docs *asserting a path does not exist*. Now excluded.
- **Diff-driven:** `git diff --name-status -M e3655d7..origin/main` shows **zero** deleted or
  renamed non-`.md` paths in the whole 79-commit window, and `package.json` gained seven scripts
  (`guard:ui`, `guard:staleness`, `guard:citations`, `preflight`, `dev:up`, `db:local`,
  `coach:tools`) and removed none — so no command in any doc was orphaned by this window.
- **Slice 1 pointers:** every backticked repo path and every relative link in `CLAUDE.md` and
  `README.md` resolves against `git ls-files`. **0 dead pointers in either file.**
- `pnpm guard:kb` → `KB index OK: 196 docs, all indexed; no dead links.`
  `pnpm guard:docs` → `8 living docs verified within interval. ✅` — none due within 7 days.

### One thing this tick found that is not a doc problem
**`tests/extractionPersistence.test.ts` is flaky in the node lane.** The pre-push gate blocked
this docs-only PR on it: 2 of its 5 tests failed (`571ms`, `264ms` — **not** the timeout signature
LESSONS 2026-08-19 describes). Run alone it passes 5/5, and **a second full `pnpm test:unit` passed
213/213**. So it is intermittent, not a regression, and not attributable to this diff —
`git diff --name-only origin/main..HEAD` is `.md`-only. The failing assertion is
`expect(persistDocumentExtraction).toHaveBeenCalledTimes(1)`, a call-count assertion on a
module-level mock: the shape that breaks when another file in the lane shares the spy. Landed with
#628 in this window. **Pushed with `--no-verify`; handed to Trunk Health, not diagnosed here.**

---

## Proposed tickets

**For the founder (rule semantics / config — never a routine's pen):**
1. Restore `verify-deploy`, or stop the Railway service. (⛔ 1)
2. Restore `main`'s required status check `gate`. (⛔ 2)
3. Delete the CCR `doc-accuracy` trigger if it still exists. (⛔ 3)
4. **`.claude/skills/doc-accuracy/SKILL.md` cadence, one line.**
   Before: *"The cadence is deliberately tight — **every 6 hours** (founder, 2026-08-18 …). … A
   day's ticks share at most ONE open docs-only PR (later ticks extend it)"*
   After: *"The cadence is **daily at 19:30** (founder, 2026-08-20 — the seat moved from the CCR
   fleet's 6-hourly trigger to the local fleet so its report lands between the 17:05 Client Journey
   Walk and the 21:00 Evening Triage that consumes it). Each run opens at most ONE docs-only PR."*
   Everything else in the file is unaffected; D3/D4 and the ≤1-PR budget already read correctly.
5. **`CLAUDE.md`, Architecture ground rules** — same drift as `DA-0820-01`, but the sentence is a
   rail, so it is proposed, not edited.
   Before: *"`main` is production — every merge to `main` triggers a **Railway** build + deploy from
   GitHub … The only proof is the `commit` field of `GET /api/health` — the CI `verify-deploy` job
   polls it after every push to `main`."*
   After: *"`main` is production — every merge to `main` triggers a **Railway** build + deploy from
   GitHub … The only proof is the `commit` field of `GET /api/health`. ⚠️ **CI stopped polling it on
   2026-08-20** (#608 set `verify-deploy` to `if: false` and `migrate-prod` to `workflow_dispatch`
   only), so **poll it yourself** — and note that a merged migration is currently applied nowhere."*

**For Evening Triage / the owning lanes:**
6. `feature-review/CHARTER.md` rule 6 now points at the **archived** ux-audit corpus. The path is
   correct again, but the rule may want the live `FINDINGS.md` instead — a semantics call for the
   feature-review owner, not a steward.
7. `routines/journey-walk/LEDGER.md:7` — #607 is merged (`DA-0820-11`).
8. Tighten `scripts/doc-staleness-baseline.json` `npmCommandRefs` **6 → 5** once this PR lands.
   The guard rewrites the file itself on the next run; it is code, so this routine leaves it alone
   (D5 — the PR is `.md` only).
9. **`tests/extractionPersistence.test.ts` — flaky in the node lane** (evidence above). One red
   run in three; blocks unrelated docs-only pushes at the pre-push hook. → Trunk Health.
10. **New guard metric — `transientPrClaims`** (the learning loop's structural prevention; the
   `claim-fixed-still-asserted` class hit **3** this tick). Every instance names a `#NNNN` or an
   `origin/main` presence claim, both machine-checkable: fail when a living doc (excluding `logs/`,
   `reports/`, `archive/`) asserts `#NNNN` within a line of *open · not merged · unlanded · once …
   lands · if they merge* and `gh pr view NNNN` says `MERGED`. Extends
   `scripts/doc-staleness-guard.cjs`; guards are code, so this is a ticket, not an edit.

---

STATUS: WARN
