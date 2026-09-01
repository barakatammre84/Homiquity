# Handoff Corpus Steward — 2026-08-24

STATUS: WARN — the corpus is green at `49720133` after this PR, but the day's drift was a **mechanism deletion the numbers nearly hid**: #725 replaced the node test lane's ~230-path allowlist with a glob, six corpus files plus seven loop templates were still teaching the list, one FACTS command had **never executed since it was written**, and three live siblings — including the binding definition of done — still order every PR to edit a list that no longer exists.

## ⛔ Human actions (hardest first)

1. **`knowledge-base/governance/TEAM_PRACTICES.md:96-97` — the definition of done is now wrong in the harmful direction (HO-0824-01).** Rule 2 of §5 says "New server/logic test files **must be added to `vitest.config.ts`'s include list**". After #725 the include is a glob (`vitest.config.ts:71`) and the only hand-maintained `"tests/…"` block left is `exclude` (`:77-95`) — so a PR author who follows the definition of done and adds their path to the file's list **strands the test they just wrote**, which is the exact defect the rule was written to prevent. This binds every PR in the repo. Lane: doc-accuracy fix-now (governance). Not fixed here — this seat reads siblings, it never edits them (rail 1).
2. **`.claude/agents/hq-ci-guards-owner.md:90` — the CI-guards owner agent is misinformed about CI guards, in both halves of one sentence (HO-0824-02).** It says the node lane is "an explicit allowlist" (false since #725, 2026-08-24) and that the integration lane "never" runs in CI (false since #704, `d9e8f79d`, 2026-08-23 — `.github/workflows/ci.yml:583-646`). This is the seat most likely to be asked to change the node lane. Lane: ⛔ `.claude/**` (doc-accuracy flags, founder approves).
3. **`.claude/skills/rent-reporting-watch/SKILL.md:37-40` — a detection method with no target left (HO-0824-03).** Its Phase 2, described there as "the sharpest thing here", watches for a rent test file being removed from `include:`. Nothing can be removed from a glob. The failure mode it hunts is now "added to `exclude`" or "file deleted", and it looks for neither; the config comments it cites as corroboration were deleted in the same commit. Bounded — the rent suite is still collected and the orphan floor fails on a genuinely stranded file — so the routine is redundant here rather than blind, but it will report exercising a control it is not. Lane: ⛔ `.claude/**`.
4. **`scripts/handoff-facts.cjs` — an errored command and a prose answer are indistinguishable (HO-0824-04).** FACTS F-39's command used `<(...)`; the generator runs commands under `/bin/sh`, which rejects process substitution outright, so the row had **never run once** — empty output is not numeric, so it was filed under "not machine-comparable … prints prose" and read as verified on every refresh since authoring. The generator captures `stderr` (`:164`, `:183`) and never surfaces it. Fixed for F-39 this run; the class is open for the 7 rows that remain. Lane: `hq-ci-guards-owner` / founder — have `--check` report a non-zero exit or non-empty stderr as its own verdict.
5. **Three open PRs edit handoff chapters and are all stale drafts** — #715 and #710 both rewrite chapter 07's guard-fleet line to `15`/`16` guards and `6`/`7` baselines; the tree measures **19 · 8** (F-36). #733 edits chapter 13. None is a refresh PR, so this run proceeded in **refresh mode** (the scheduler prompt: "an open refresh PR means deferred mode, never a competing PR"), and deliberately touched a different region of chapter 07 than they do. Whoever lands them should re-derive that line rather than take either side.

## Summary

`--check` named 8 moved rows, but the one that mattered moved from 230 to 18 while still returning an integer, so nothing looked broken: `387a3518`/#725 deleted `vitest.config.ts`'s hand-typed allowlist — the repo's most-churned file, 222 commits, two PRs dead on one contended line — and F-13 had quietly started counting the new `exclude` list instead. That is the drift class this seat exists for: the number was fine, the *thing it named* was gone, and six corpus files plus seven loop templates went on teaching a mechanism the code no longer has. Two more commands had stopped measuring what they name (F-43's `sed` lines slid) and one had never executed at all (F-39), which moved the checkable set to **41 of 48** once rewritten and proved fail-closed. The corpus is fixed in place — including chapter 11's A14 pattern, now recorded as *resolved by deletion* for tests and still live for the route registrars — and the four sibling documents that carry the same falsehood are ledger rows, not edits. Chapter stamps were **not** bumped: no chapter was re-read in full this run (rail 6).

## Evidence

### Detection

- `pnpm handoff:facts --check` @ `49720133` → **8 DISAGREES**: F-13 (`230 · 248` → `18 · 249`), F-17 (`14 · 24 · 21` → `15 · 25 · 23`), F-18 (`26 · 20` → `27 · 21`), F-19 (`58 · 41` → `59 · 41`), F-21 (`237` → `238`), F-31 (`1098` → `1170`), F-34 (`66` → `67`), F-36 (`17 · 7` → `19 · 8`).
- `pnpm handoff:facts --cite` → **12 out-of-range + 1 slid symbol**, every one of the 12 into `vitest.config.ts`, which shrank **324 → 113 lines**. Worth stating plainly: those 12 were caught only because they fell off the *end* of the file. Every citation that still landed inside it pointed at unrelated code and passed — 58 symbol-bound citations of 969 this run, **911 bounds-only** (HO-0822-27, re-aged).
- Range read: `fd4a22c5..49720133` = **72 commits, 199 files, +32,398/−2,229**.
- The 7 non-comparable rows re-read by hand: F-04 `58 · 0057…` → **`60 · 0059_liability_paid_by_other_party`**; F-16 **11 → 16 guards in the gate** (`authority` `corpus` `coverage` from #708, `seats` from #722, `gating` from #726); F-30 all four areas moved (server 81,487 → **82,355**; shared → **23,355**; client/src → **107,848**; tests → **48,899**); F-06, F-23, F-44 unchanged.

### The mechanism change, and how it was proved

- `vitest.config.ts:71` is now `include: ["tests/**/*.test.{ts,tsx}"]` with an 18-entry `exclude` (`:77-95`); the file's own epitaph (`:44-62`) records why: "The list carried no information: 248 test files in `tests/` minus the 18 integration files is exactly 230, the number that was typed out here."
- The floor is what makes either design safe, and it is mechanism-agnostic: `scripts/test-collection-guard.cjs` fails on an orphan (`:515-534`) and, new with the glob, on a file claimed by two lanes (`:419-437`).
- **F-39 had never run.** Reproduced directly: `/bin/sh -c "comm -23 <(…) <(…)"` → `syntax error near unexpected token '('`, exit 2. Rewritten POSIX-clean as the symmetric difference of the node `exclude` list and the integration `include` list, and **proved fail-closed by reintroducing the defect** — deleting one entry from the integration list took it `0` → `1`, restoring it took it back to `0`.
- Three chapter-12 guard citations had slid without leaving the file and were re-pinned by content, not by hand: the orphan floor is `:515-534` (chapter said `:462-469`, which is the *stale-allowlist-line* message), `SHORT BY N` is `:473` (said `:406-415`), and the bypass announcement is `:401-404` (said `:354`, a `--reporter=json` flag).
- One number in the first draft of this run was typed rather than measured — "163 commits since `074899e3`" — and `git rev-list --count` said **93**. Corrected before commit. Rail 3 earns its keep every time.

### What changed in the corpus

`FACTS.md` re-derived and re-stamped `fd4a22c5` → `49720133` (41 of 48 checkable, up from 40). Prose rewritten in **07** (the node lane, the counts-that-must-agree identity, and a quotation of TEAM_PRACTICES rule 2 that had silently become a *misquote*), **11** (the allow-list pattern gains its counter-case: a list that is *derivable* should be retired, not widened; A14 resolved-by-deletion for tests), **12** (T1 diagram 230→231 node / 124→125 client, the acceptance-run historical note, three re-pinned citations), **README** (five-facts row 3), **TEACHBACK_KEY** (answer 8: `231` globbed, `125` client, `19` guards / `8` baselines; the CHARTER cite re-pinned 525→626), and **prompts/_RAILS.md** R4. Seven loop templates (`new-test`, `bug-fix`, `new-route`, `feature`, `refactor`, `schema-migration`, `INVOKE`) no longer instruct a loop to write to `vitest.config.ts`.

### Guards (Phase 4)

`pnpm handoff:facts --check` ✅ (one expected red — F-31, because this branch is 1 commit ahead; the tool prints the `CONTEXT` line itself, rail 6b) · `--cite` ✅ **974 citations · 0 ambiguous · 0 out-of-range · 58 symbols on their line** · `guard:kb` ✅ 237 docs · `guard:citations` ✅ at baseline · `guard:staleness` ✅ at baseline · `guard:ui` ✅ 523 files, 9 metrics at baseline (no client test added, so no §0 regeneration — rail 8 does not fire). Prod impact: **none**, docs-only.

### Drift rows aged (Phase 3)

No open `HO-` row is older than 7 days (oldest is `HO-0822-*`, two days), so no age escalation fires. Re-verified at `49720133`: **HO-0823-05 still open** (`knowledge-base/runbooks/CICD.md:357` verbatim: "The integration suite … **never runs in CI**"); **HO-0823-01 still open** (`scripts/dev-up.sh` arms `core.hooksPath` inside the `status)` case, so the `up)` path a fresh clone runs still never arms it); **HO-0823-02 still open** (`grep -c "@test.com" server/auth.ts` → **11**, banner lists 8); **HO-0822-26 headline still false** (`guard:ui` green on `main`); **HO-0822-27 partially resolved** by `8453abfd`/#701 and re-aged with measured coverage.

## Proposed tickets (for Evening Triage)

1. Fix the definition of done (HO-0824-01) — one sentence, highest traffic of anything in this report.
2. Correct `hq-ci-guards-owner.md:90` (HO-0824-02) and `rent-reporting-watch/SKILL.md:37-40` (HO-0824-03); both are `.claude/**`, which no guard covers.
3. Teach `handoff-facts --check` to distinguish a failed command from a prose answer (HO-0824-04).
4. Carry HO-0822-27's real remedy: pin a quoted snippet beside each `path:line`. #701 covers 58 of 974 citations; the other 916 are still bounds-only.
5. Re-derive chapter 07's guard-fleet line (19 · 8) when #715/#710 land — both currently propose lowering it to stale values.

STATUS: WARN — drift found and fixed in the corpus; four `HO-` rows opened against siblings this seat may not edit, one of them the definition of done.
