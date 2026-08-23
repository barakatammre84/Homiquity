# Doc Accuracy — Ledger

The cross-run memory of the `/doc-accuracy` routine
([`.claude/skills/doc-accuracy/SKILL.md`](../../.claude/skills/doc-accuracy/SKILL.md)). Every tick
reads this file **before** choosing work (rail D2) and updates it in the same PR as the fixes it
describes. Ids are **`DA-<MMDD>-<NN>`** — date-qualified per
[`routines/CHARTER.md`](../routines/CHARTER.md) §9, unique by construction with zero coordination —
and are never reused. Statuses: `open` → `in-pr` → `done`, or `refuted` / `escalated` /
`blocked-collision` / `superseded`.

**Cadence:** daily at 19:33 local, scheduled task `doc-accuracy-daily` — founder decision
2026-08-20; the skill was amended to match by the founder on 2026-08-23 (no self-amendment: D10).
Every tick also re-derives `knowledge-base/handoff/` (SKILL Phase 1.4) and every fourteenth tick
re-runs the corpus's fresh-hire teach-back (Phase 1.5) — cluster 14 below.

**`last-swept SHA:`** `6377727e` *(advanced 2026-08-23 by the founder-directed session that
executed the first full sweep: diff-driven over the founding backlog `e3655d7..6377727e`
(122 commits) plus the mechanical sweeps over the all-markdown universe — dead paths, pnpm-script
existence, retired terms with the exclusion table honored, freshness via `guard:docs`. No
rotation deep slice ran (recorded; the cursor is untouched). The founding note: the routine was
seeded at `e3655d7` on 2026-08-18 and no scheduled tick ever advanced this line before today.)*

---

## Findings register

Seeded at founding from the [2026-08-18 knowledge-file audit](../logs/2026-08-18-knowledge-file-audit.md)
§2b — each row was code-verified that day and **must be re-dated per rail D6 before being acted
on** (the audit's Step-2 staging or another session's PR may land any of them first).

| id | class | status | finding | evidence / provenance |
|---|---|---|---|---|
| DA-0818-01 | path-moved + command-renamed | **done** | `governance/TEAM_PRACTICES.md` carried dead pointers while its freshness line was green: the retired "🚀 Launch sprint" section, the "launch-sprint memory ledger", `kb/…` paths, `npm run check`/`npm test`. | audit §2b.1. **Fixed by #557 (Step-2 landing, 2026-08-18)** — grep for `Launch sprint|kb/founder|kb/lo-audit|npm run check|npm test` at `e3655d7` returns only an innocuous `pnpm test` line. Closed by the founding session's own D6 re-dating: the finding was fixed between seed and commit — the exact CHARTER §4 failure mode this ledger exists to prevent. |
| DA-0818-02 | command-renamed | open | `npm`-as-instruction survives in living docs beyond TEAM_PRACTICES (which #557 fixed): `handbook/design/design_guidelines.md`, app-guide 01/02/10, `DEVELOPER_PLAYBOOK.md`, `compliance/REGULATORY_MONITORING.md`, three specs, and the KB README's own guard lines (verified live at `e3655d7`: README :4 `npm run checkup`, :158 `npm run checkup`). One mechanical normalization pass. | audit §2b.2. Proposed to Evening Triage by the audit; if unlanded when a tick reaches it, it is inside this routine's default lane. Re-date each file per D6 before editing. |
| DA-0818-03 | retired-term | open | Three spec passages lean on the retired "launch sprint" concept name: `specs/LO_ADVISOR_PROGRAM.md` :43, `specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md` :47/:298. The underlying intent (roadmap outranks program work) is still true — reword the pointer, keep the rule. | audit §2b.2; re-verified live at `e3655d7` (all three lines present). |
| DA-0818-04 | claim-fixed-still-asserted | **done** | `research/gtm/COMPETITIVE_BRIEF_2026-07-06.md` needed a dated supersession banner pointing at the teardown corpus. | audit §2b.4. **Fixed by #557** — the ⚠️ banner is present at `e3655d7` :3–:8, citing `research/better-teardown/`, history kept per TEAM_PRACTICES §2. |
| DA-0823-01 | contradiction | in-pr (founder amendment) | `.claude/skills/doc-accuracy/SKILL.md` stated two cadences — every 6 hours (`:19`, `:24`, `:140` at `6377727e`) and daily 19:30 (`:21-23`) — and Phase 1.3 assumed several ticks a day ("the day's FIRST sweep tick"). | `list_scheduled_tasks` → `doc-accuracy-daily`, `30 19 * * *`, fires 19:33; `logs/2026-08-20-hygiene-pitch-adjudication.md:43-45`. Fixed by the founder's amendment (this PR): one cadence statement, one rotation slice per tick. |
| DA-0823-02 | drift | in-pr | `SKILL.md:12` "`pnpm guard:docs`: six opted-in docs". | `scripts/doc-freshness-guard.cjs:35-51` lists **eight** in `REQUIRED` (`DESIGN_SYSTEM.md` and `HIRING_PLAN.md` added 2026-08-18). Fixed in this PR. |
| DA-0823-03 | contradiction | in-pr ⛔ | `routines/CHARTER.md` still seated Doc Accuracy on the CCR fleet every 6 h (`:315` §3a row — pre-restructure numbering, as the cited lines had it, `:330-335` "the suite's tightest"), listed it among skills "not on this clock" (`:249-253`), said its skill "does not exist at `origin/main` yet" (`:283-285`, `:317-322`), counted thirteen seats (`:178`) and omitted the 19:30 seat from the §8 table (`:184-199`) and the §3 chain. CHARTER wins over a skill (`:12-13`), so a tick was contractually bound to the wrong clock. | `list_scheduled_tasks` (local, `30 19 * * *`); `git cat-file -e origin/main:.claude/skills/doc-accuracy/SKILL.md` → exists since 2026-08-18. Fixed in this PR under rail D11 (factual rows; the §10 territory row's handoff clause is the founder's). ⛔ still open inside the note: whether the old CCR trigger was deleted — `list_triggers` is a founder read. |
| DA-0823-04 | drift | in-pr | This ledger: rotation cursor said "Full cycle ≈ 13 days at the 6-hourly cadence" (`:51-53`); no cluster covered `knowledge-base/handoff/`; cluster 7 said "app-guide 07–11" (the app-guide has 12 chapters, FACTS F-20). | `ls knowledge-base/handbook/app-guide/*.md \| wc -l` → 12. Fixed in this PR: one slice per tick, cluster 7 → 07–12, cluster 14 added. |
| DA-0823-05 | drift | in-pr | `knowledge-base/README.md:171` "The daily CCR-fired `/doc-accuracy` run". | The seat is a local scheduled task since 2026-08-20 (DA-0823-01's evidence). Fixed in this PR; the handoff stewardship sentence added after `:178` (additive — shared-file hazard). |
| DA-0823-06 | drift | in-pr | `knowledge-base/handoff/README.md:78-82` "sweeps `knowledge-base/**` every six hours … may consume `HO-` rows" and "a hand-invoked refresh skill (a follow-up … in a separate PR)"; `:4` a hand-typed corpus-wide stamp (`12d7cbec`) that disagreed with the generated one in `FACTS.md` (`ca791d72`). | `grep -c "HO-\|handoff" .claude/skills/doc-accuracy/SKILL.md` → 0 before this PR (the consumer claim lived only in the corpus); `#692` merged `ca791d72` (the skill exists). Fixed in this PR (stamp not bumped — partial re-read). |
| DA-0823-07 | drift | in-pr | `knowledge-base/handoff/11-patterns-and-repetition.md:247` "doc-accuracy every 6 h". | DA-0823-01. Fixed in this PR (stamp not bumped). |
| DA-0823-08 | drift (citation moved) | in-pr | The amendment moves every line of `SKILL.md`; the corpus cites it by line in 15 places (`handoff/09-…md:88,101,120,143,205,250`; `11-…md:183,184,191,192,196,211,247`; `TEACHBACK_KEY.md:114,115`). | Remapped in this PR from the final skill text, each verified with `sed -n '<line>p'` (bounds alone cannot see a stale-but-in-range line — HO-0822-27). |
| DA-0823-09 | gap | in-pr (banner) | `routines/TEAM.md:66-75` seating chart lacks the 19:30 seat; `:77-82` names retired seats. | Banner at `:9-11` extended (the seat is not a hiring-plan seat; the `Registered?` column is the 2026-08-20 state). The paragraph rewrite is cluster 4's slice. |
| DA-0823-10 | contradiction | in-pr | `routines/LESSONS.md:12` "Newest first" — the table is oldest-first (`:26` = 08-12 … `:42` = 08-19) and every writer since 08-12 has appended at the bottom. | Fixed in this PR by correcting the instruction, not re-sorting the table (re-sorting 17 rows conflicts with #647 and #675). SKILL Phase 3.2 now says "append at the bottom". |
| DA-0823-11 | gap | open — in progress on a founder-directed docs PR | `knowledge-base/handoff/TEACHBACK_KEY.md` has sections for chapters 00–10 only (`grep -c '^## ' → 11`); chapters 11 and 12 carry 6 questions each with no key, so the teach-back (Phase 1.5) cannot score 12 of 100 and must not author its own rows. | Authoring is the founder's (D10). A founder-directed PR (`docs/handoff-day1-and-scaffold-0823`) adds the rows; until it merges the grader records them `UNKEYED`. |
| DA-0823-12 | drift | **done** 2026-08-23 (outside the repo, CHARTER §15) | The scheduler prompt `~/.claude/scheduled-tasks/doc-accuracy-daily/SKILL.md` said "the repo is private", "`pnpm install` in the worktree before running anything", "the pre-push hook runs the full local CI gate and can take minutes". | `.githooks/pre-push:17-18, 70-85` (#660 `e49aab6d`): the hook is typecheck + guards, opt-in tests, and skips itself uninstalled; the repo is public again since 2026-08-22. Rewritten in the same session as the CHARTER edit. |
| DA-0823-13 | claim-fixed-still-asserted | open — handed to #647's rebase | #647 (`routine/doc-accuracy-2026-08-20`) asserts in its README ground-rules paragraph and CHARTER §7 "Deploy proof" hunk that `verify-deploy` is `if: false` and `migrate-prod` is dispatch-only. | Re-armed by #669 `76c96751` on 2026-08-22: `sed -n '574p;647p;663p' .github/workflows/ci.yml` at that SHA (FACTS F-43). #647 is CONFLICTING; the founder asked for it to be rebased and re-dated rather than closed — DA-0820-09 closes as `done (#669)` in that rebase. |
| DA-0823-14 | drift | open — first tick's Phase 1.4 | `#670` `fd4a22c5` merged 2026-08-23: `pnpm test` is now `scripts/test-collection-guard.cjs`; the corpus's T1 rail, chapter 07/12 status boxes, `README.md:147`, `LEDGER.md` HO-0822-09/-23/U6 and FACTS F-13/F-36/F-39 described the pre-merge state. | #670's own commit message ends "POST-MERGE TO-DO: run `/handoff-refresh`" — the refresh was a human to-do, which is the gap this amendment closes. PR #699 (`docs/handoff-refresh-0823`) is the mechanical refresh; what it leaves (the `_RAILS.md` T1 row, `README.md:147`, template lines) is the first tick's 1.4 queue or the founder-directed docs PR's. |
| DA-0823-15 | gap | open — proposed ticket (code) | No file under `knowledge-base/handoff/` is in `scripts/doc-freshness-guard.cjs`'s `REQUIRED` list, so the corpus's 28 `Freshness:` lines are unenforced; `FACTS.md` (14-day interval) lapses 2026-09-05 with nothing to notice. | `grep -c handoff scripts/doc-freshness-guard.cjs` → 0 at `6377727e`. Guards are code (D10): ticket for `hq-ci-guards-owner` — add `handoff/README.md` and `handoff/FACTS.md` to `REQUIRED`; a tooling PR (`chore/harness-tiers-0823`) carries it. |
| DA-0823-16 | founder-restructure (⛔ headline) | in-pr ⛔ | The three living charters rewritten into the Feynman teaching shape (founder decisions 4/5 of this session): routines `CHARTER.md` (885 → 1,112 lines, §0–§11 → §1–§21 + crosswalk appendix), `feature-review/CHARTER.md` (additive-complete; rules 1–9 identity kept), `sop/SOP-000-manual-charter.md` (renumbered; one factual fix — it was never in the freshness guard's `REQUIRED` list). Semantics preserved: a normalized line-diff of the old routines charter against the new found **10 lines changed beyond renumbering, every one a deliberate disambiguation** (TEAM_PRACTICES §9 / DESIGN_SYSTEM §12–§14 spelled out). | This branch, commits `5161620e` + `e25349cd`. Citation re-anchoring: 85 living citing files swept in three reviewed passes; 31 dated-history citers untouched (crosswalk serves them); the feature-review walkers' "CHARTER rule N" refs detected as their own charter's and reverted. |
| DA-0823-17 | machine-path (new class) | done | Every prove-it block in the handoff corpus opened with a founder-machine absolute path — 17 sites across 15 files — so the corpus's first command failed for any other team member, defeating its stated onboarding purpose. All neutralized to `git rev-parse --show-toplevel`. | `grep -rn "/Users/" knowledge-base/handoff/` → 0 living hits at `f1bd1a65`. Prevention proposed (see scoreboard). |
| DA-0823-18 | drift | done ⛔-adjacent | Root `README.md` and `DEVELOPER_PLAYBOOK.md` §5 step 9 claimed direct pushes to `main` are "rejected"/"blocked by branch protection"; measured protection is 0 required checks / no required review (FACTS F-44, 2026-08-22). Both now carry the honest state #694 established for the app-guide. The re-arm decision itself is the founder's standing ⛔. | This branch, commit `26885d9b`; `LOCAL_DEV.md`'s "CI still gates the PR" given the same honesty. |
| DA-0823-19 | drift | done | `runbooks/CICD.md` said `verify-deploy` "fails the run" and both deploy runbooks pointed it at `www`; the step is `continue-on-error: true` by design and polls the Railway origin (`ci.yml:706`, pinned by `tests/ciTriggers.test.ts:153`). HO-0822-14's two residual sub-claims, closed. | commit `26885d9b`. |
| DA-0823-20 | fossil (banner) | done | `app-guide/05-data-flow.md` describes the pre-chokepoint flow (HO-0822-16: "a rewrite, not a patch"). Dated stale-map banner added pointing at handoff 04 and app-guide 02/03; the rewrite stays a proposed ticket for the chapter's owner. | commit `26885d9b`. |
| DA-0823-21 | drift ⛔ | done ⛔ | `CLAUDE.md`'s lending-routes row named two sub-registrar directories as though they were the set; four exist with an `index.ts` (FACTS F-06; HO-0822-03). D11 pointer lane. | commit `26885d9b`. |
| DA-0823-22 | gap | done (founder-authored) | The corpus had a reading path for a new hire but no doing path. Chapter `13-day-one-to-first-pr.md` authored (full Feynman skeleton, machine-neutral proofs, the honest protection state); `TEACHBACK_KEY.md` §13 added; §§11/12 keys arrived via the founder's parallel day-1/scaffold branch, absorbed. Closes DA-0823-11. | commits `2239f567`…`f1bd1a65`; `pnpm guard:kb` green at 230 docs. |
| DA-0823-23 | gap | done ⛔-install | The seat's prompt existed only in the founder's scheduler — unauditable from any other machine (charter preamble). `knowledge-base/doc-accuracy/SEAT_PROMPT.md` created as the auditable copy, recording the 2026-08-23 founder decisions (all-markdown charge; corpus as flagship; charter receipts). ⛔ the scheduler paste is the founder's §15 half. | commit `176c59fd`; KB-indexed. |
| DA-0823-24 | sweep-result | done | First full sweep, clean: retired-term hits are all sanctioned history/banners; every `pnpm <script>` named as an instruction in living docs exists (28 raw hits reviewed — all negations or history); `guard:docs` 8/8 in window; the one regression the sweep caught was this session's own SEAT_PROMPT tripping the old-name ratchet — rephrased before commit (3/3 at baseline). | This report's evidence section. |

## Drift-source scoreboard (the learning loop)

One tally per finding, class × doc-cluster. A class reaching **3** earns a structural-prevention
proposal in that tick's report (new mechanical sweep row, guard extension ticket, freshness
opt-in, CHARTER §7 fact row) — fixing the same drift twice without proposing the prevention is a
failed loop (SKILL Phase 3.2).

| drift class | tally | clusters hit | prevention proposed? |
|---|---|---|---|
| path-moved | 1 | governance | not yet |
| command-renamed | 2 | governance, handbook/specs/KB-README | not yet — at 3, propose a commands-as-instruction sweep script ticket |
| retired-term | 1 | specs | not yet |
| claim-fixed-still-asserted | 2 | research, routines (#647's deploy claims) | not yet |
| contradiction | 3 | `.claude/skills`, routines/CHARTER, routines/LESSONS | **yes (2026-08-23):** the cadence was restated in nine living-doc sites and drifted in seven within three days of the founder changing it. Prevention is structural, not vigilance: a scheduling fact is stated **once** (CHARTER §8's row) and every other site points at it — this amendment does that, and the skill's contract header now cites the row instead of restating the clock. |
| drift | 8 | `.claude/skills`, doc-accuracy, KB-README, handoff (README, 11), scheduler prompt, handoff (post-#670) | at 8 from one cause (a re-seated routine): same prevention as above; the handoff rows are the steward's own Phase 1.4 from now on |
| gap | 5 | routines/TEAM, handoff (answer key → closed -22, doing-path → closed -22, seat prompt → closed -23), scripts (freshness opt-in) | the freshness opt-in ticket now has a carrier (`chore/harness-tiers-0823`, code lane) |
| machine-path | 1 (17 sites, one class) | handoff corpus | **yes (2026-08-23):** new mechanical sweep row proposed — no living doc states an absolute machine path as an instruction; derive with `git rev-parse --show-toplevel` (charter §7's Repo row, a fact about the founder's machine, is the one exemption) |
| founder-restructure | 1 | the three living charters | n/a — founder decision, not drift; the crosswalk + re-anchor sweep are the prevention for the citation class it created |

Classes: `path-moved` · `command-renamed` · `retired-term` · `transient-state` ·
`claim-fixed-still-asserted` · `freshness-lapsed` · `contradiction` · `index/dead-link` ·
`fossil` · `gap` · `regression-suspect`.

## Rotation cursor

**Next slice: 1** *(unchanged — the 2026-08-23 founder session ran the sweeps and the corpus lane but no rotation deep slice; the first scheduled tick starts the cycle).* One deep slice **every tick** (SKILL Phase 1.3). Fourteen clusters ⇒ full cycle
= fourteen ticks (one tick a day at 19:33). The "slice done today" marker is retired — there is
one tick a day.

| # | cluster | notes |
|---|---|---|
| 1 | Root: `README.md` tier map, `CLAUDE.md` | CLAUDE.md rules propose-only; pointer rows ⛔ lane (D11) |
| 2 | `governance/` doctrine: TEAM_PRACTICES, AI_GOVERNANCE_POLICY, MODEL_RISK_GOVERNANCE, ASSUMPTIONS, ARMED_LAUNCH_CHARTER | house-style exemplars — hold to the 4-point framework hardest here |
| 3 | `governance/` registers + `security/` pack | CHANNEL_DECISION, CONTINGENT_LIABILITY_REGISTER, UNCONSUMED_CAPABILITIES carry freshness lines — real re-verification, then bump |
| 4 | `routines/`: CHARTER, REGISTER, LESSONS, reports/README | CHARTER factual rows ⛔ lane; §6/§9/§10/§14 never (D11) |
| 5 | `handbook/`: DEVELOPER_PLAYBOOK, URLA_FORM_REFACTOR_TRAP, `design/` | |
| 6 | `handbook/app-guide/` 01–06 | |
| 7 | `handbook/app-guide/` 07–12 | 12 chapters (FACTS F-20) |
| 8 | `runbooks/` + support-playbooks | CICD/CHANGE_LEDGER historical rows are history (D9) |
| 9 | `compliance/` | verify against code only; regulatory readings flagged `UNVERIFIED`, never adjudicated |
| 10 | `specs/` + L1/L2 | L1/L2 content propose-only; stamps + pointers in-lane |
| 11 | `feature-review/` program docs + `research/` living claims | FINDINGS.md rows = propose-only (peer register, D10) |
| 12 | `.claude/skills/` + `.claude/agents/` | ⛔ lane; `doc-accuracy/SKILL.md` itself never (D10) |
| 13 | KB index integrity + `archive/` quarantine intact + `logs/` supersession banners | |
| 14 | `knowledge-base/handoff/` — chapters 00–12, FACTS, LEDGER, TEACHBACK_KEY, `prompts/` | the slice IS the teach-back (SKILL Phase 1.5); the seven not-machine-comparable FACTS rows re-read by hand here; `prompts/_RAILS.md` rule text propose-only (D8); chapter authoring founder-only (D10) |

## Known false positives — exclusion table (never re-litigate; grow it, cite it)

| pattern | why excluded | provenance |
|---|---|---|
| `server/services/apr.ts` `MortgageStreamParams` / `buildMortgagePaymentStream` | the *payment stream* domain term, not the repo's former name | audit §2a.2 |
| Old names / superseded claims inside `logs/`, `routines/reports/`, `archive/` | immutable dated history (TEAM_PRACTICES §2); banners only | audit §2 Manifest B |
| `runbooks/CICD.md` :4–7 former-name banner; `CHANGE_LEDGER.md` historical rows; `routines/CHARTER.md` :28 rename note; `BETA_GO_LIVE_READINESS.md` :204 struck-through item | each is deliberate, labeled history | audit §7a.2 |
| `feature-review/FINDINGS.md` old-name PR URLs | GitHub redirects renamed-repo URLs; normalizing is optional cosmetics, not drift | audit §2a.2 |
| "replacing Vercel" / "Retired … — Vercel" mentions in living docs | migration history, not instructions | audit §2b.3 |

## Run log

| date | mode | window | findings (new / carried / closed) | PR | STATUS |
|---|---|---|---|---|---|
| 2026-08-18 | founding (not a tick) | `56cf00a..e3655d7` (3 docs-only commits, merged in-session) | 4 seeded from the knowledge-file audit → 2 closed by #557 landing mid-session (DA-0818-01, -04), 2 carried open (-02 narrowed, -03 re-verified) | founding branch `claude/md-docs-accuracy-routine-2x0850` | — |
| 2026-08-23 | founder amendment (not a tick) | — (`last-swept SHA` untouched; no sweep — two routine PRs were open, #647 and #658, so a tick would have been `observe`) | 15 recorded (DA-0823-01…15): 10 fixed in this PR (one ⛔ CHARTER), 1 fixed in the scheduler, 4 open/proposed (-11 founder authoring, -13 #647's rebase, -14 first tick's 1.4, -15 code ticket) | `docs/doc-accuracy-daily-steward` | #700 |
| 2026-08-23 | founder-directed session (sweep executed; not a scheduled tick) | `e3655d7..6377727e` (122 commits — the founding backlog) + the corpus lane at the tip | 9 new (DA-0823-16…24): 7 done in this branch, -16 in-pr ⛔ (the charter restructure), -24 the clean sweep record; DA-0823-11 closed by -22; DA-0823-14 executed (the first 1.4 queue); DA-0823-13/-15 carried (—13 is #647's rebase; -15's carrier `chore/harness-tiers-0823` awaits review). Absorbed rather than raced: #699, #700, and `docs/handoff-day1-and-scaffold-0823`. `last-swept SHA` advanced. | branch `claude/homiquity-doc-accuracy-iv8ijz` | this report |
