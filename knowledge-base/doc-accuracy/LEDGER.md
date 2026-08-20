# Doc Accuracy — Ledger

The cross-run memory of the `/doc-accuracy` routine
([`.claude/skills/doc-accuracy/SKILL.md`](../../.claude/skills/doc-accuracy/SKILL.md)). Every tick
reads this file **before** choosing work (rail D2) and updates it in the same PR as the fixes it
describes. Ids are **`DA-<MMDD>-<NN>`** — date-qualified per
[`routines/CHARTER.md`](../routines/CHARTER.md) §5, unique by construction with zero coordination —
and are never reused. Statuses: `open` → `in-pr` → `done`, or `refuted` / `escalated` /
`blocked-collision` / `superseded`.

**`last-swept SHA:`** `d8316ec` *(origin/main tip, 2026-08-20T21:01Z. Advanced from `e3655d7` by
the routine's **first real tick** — a 79-commit, two-day window, because the seat was defined on
2026-08-18 and first fired on 2026-08-20. Ticks from here are one day wide.)*

**Cadence:** **daily at 19:33 local**, local fleet, `taskId` `doc-accuracy-daily` — founder decision
2026-08-20, which re-seated this routine off the CCR fleet's every-6 h trigger so its report lands
between the 17:05 Client Journey Walk and the 21:00 Evening Triage that reads it. The SKILL text
still describes the 6-hourly cadence; it is **not self-amendable** (rail D10), so the correction is
proposed to the founder rather than made here. Everything else in the skill binds unchanged: the
≤1-open-docs-PR-per-day budget is now at most one PR per run.

---

## Findings register

Seeded at founding from the [2026-08-18 knowledge-file audit](../logs/2026-08-18-knowledge-file-audit.md)
§2b — each row was code-verified that day and **must be re-dated per rail D6 before being acted
on** (the audit's Step-2 staging or another session's PR may land any of them first).

| id | class | status | finding | evidence / provenance |
|---|---|---|---|---|
| DA-0818-01 | path-moved + command-renamed | **done** | `governance/TEAM_PRACTICES.md` carried dead pointers while its freshness line was green: the retired "🚀 Launch sprint" section, the "launch-sprint memory ledger", `kb/…` paths, `npm run check`/`npm test`. | audit §2b.1. **Fixed by #557 (Step-2 landing, 2026-08-18)** — grep for `Launch sprint|kb/founder|kb/lo-audit|npm run check|npm test` at `e3655d7` returns only an innocuous `pnpm test` line. Closed by the founding session's own D6 re-dating: the finding was fixed between seed and commit — the exact CHARTER §1 failure mode this ledger exists to prevent. |
| DA-0818-02 | command-renamed | **done** | `npm`-as-instruction survives in living docs beyond TEAM_PRACTICES (which #557 fixed): `handbook/design/design_guidelines.md`, app-guide 01/02/10, `DEVELOPER_PLAYBOOK.md`, `compliance/REGULATORY_MONITORING.md`, three specs, and the KB README's own guard lines (verified live at `e3655d7`: README :4 `npm run checkup`, :158 `npm run checkup`). One mechanical normalization pass. | audit §2b.2. **Closed 2026-08-20.** Re-dated per D6: **#559 (`e7762d43`, the doc-staleness ratchet) normalized 43 instruction-class references across 25 living docs** and now gates the class — `pnpm guard:staleness` reports `6 npm-as-instruction occurrences (at baseline)`, and `--list` shows all six are quoted history or explicit negatives, except **one live survivor** this tick fixed (→ DA-0820-02). Every file the audit named — `app-guide/01,02,10`, `DEVELOPER_PLAYBOOK.md`, the KB README's guard lines — is clean; `handbook/design/design_guidelines.md` no longer exists. |
| DA-0818-03 | retired-term | **done** | Three spec passages lean on the retired "launch sprint" concept name: `specs/LO_ADVISOR_PROGRAM.md` :43, `specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md` :47/:298. The underlying intent (roadmap outranks program work) is still true — reword the pointer, keep the rule. | audit §2b.2. **Closed 2026-08-20.** Re-dated per D6: `grep -in "launch sprint\|launch-sprint"` over both specs returns **nothing** — normalized by #559 in the same pass. `pnpm guard:staleness` now holds the class at a baseline of 7, all seven being history or explicit negatives. |
| DA-0818-04 | claim-fixed-still-asserted | **done** | `research/gtm/COMPETITIVE_BRIEF_2026-07-06.md` needed a dated supersession banner pointing at the teardown corpus. | audit §2b.4. **Fixed by #557** — the ⚠️ banner is present at `e3655d7` :3–:8, citing `research/better-teardown/`, history kept per TEAM_PRACTICES §2. |
| DA-0820-01 | contradiction | in-pr | Root `README.md` told every reader that "every merge builds and deploys on Railway", that CI's `verify-deploy` job polls `/api/health`, and that `main` is "protected … through the required `gate` check — direct pushes are rejected". **All three were false.** | **#608 (`e762743b`, 2026-08-20 09:01) set `verify-deploy` to `if: false` and `migrate-prod` to `workflow_dispatch` only** (`.github/workflows/ci.yml:505,580`). **`gh api repos/barakatammre84/Homiquity/branches/main/protection` → `required_status_checks.contexts: []`** — `enforce_admins: true` over zero checks binds admins to nothing (`ci.yml:39-45` records the same measurement, landed by #635). Corrected in this PR, tightening only: the deploy-proof rail is kept and the reader is told to poll by hand. |
| DA-0820-02 | command-renamed | in-pr | `compliance/REGULATORY_MONITORING.md:9` — "`scripts/regulatory-freshness.cjs` runs inside `npm run checkup`". The last live `npm`-as-instruction in the corpus. | `package.json` has `checkup` and pnpm is the standing fact (CHARTER §2); `scripts/checkup.sh:67` runs `node scripts/regulatory-freshness.cjs`, so only the invocation word was wrong. → `pnpm checkup`. Closes the tail of DA-0818-02. |
| DA-0820-03 | path-moved | in-pr | `server/storage.ts` cited as a live file in `L2_COMPLIANCE_AND_LOGIC.md:38` (I4, "single write path") and `feature-review/DOMAINS.md:290` ("~5,600-line sole PII write path"). | The file was split into `server/storage/` (22 domain modules) by **#182 (`227cd778`)** — `git log --diff-filter=D -- server/storage.ts` returns exactly that commit; `wc -l server/storage/*.ts` = 6,311. Paths corrected; the "sole PII write path — concentration risk" judgement is preserved verbatim, since re-assessing it is the domain owner's call, not a steward's. |
| DA-0820-04 | index/dead-link | in-pr | `feature-review/CHARTER.md:46` directs every reviewer to cross-reference `knowledge-base/logs/ux-audit/page-audit.md`. That directory does not exist. | `git log --diff-filter=ADR -- 'knowledge-base/logs/ux-audit/*'` → `2eb3af23` (#458) moved the corpus to `knowledge-base/archive/ux-audit/`, where `page-audit.md` still is. Re-pointed at the archived path **and labelled quarantined history**, because the archive is provenance-only (README Tier 5). ⚠️ Whether that rule should instead point at the live `FINDINGS.md` is a semantics call → proposed, not made. |
| DA-0820-05 | fossil | in-pr | Root `README.md`'s **Tier 2 — Doctrine** table presented `runbooks/PRE_PRODUCTION_OPS_ROUTINES.md` as "(current: 5-routine launch suite)". That suite is the one that stopped on 2026-07-04 and stayed dormant five weeks — the founding failure `routines/CHARTER.md` §0 exists to record. A dead automation suite advertised as *current doctrine* in the repo's landing file is the two-truths hazard in its purest form. | CHARTER §0 and §3; none of the five `taskId`s it names (`morning-compliance-defense`, `daily-sprint-blitz`, `midday-lender-liquidity`, `evening-economics-gtm`, `weekly-vendor-procurement`) appears in `list_scheduled_tasks`. README row corrected; a dated status banner added to the doc itself (body untouched per D9). |
| DA-0820-06 | claim-fixed-still-asserted | in-pr ⛔ | `routines/CHARTER.md` asserted in two places that Doc Accuracy, the UI conformance sweep and the Backend Data Engineer "cite a skill that is not on `origin/main` yet", plus two live-transient pointers: "#589, #607 … if they merge" and "defers to `JOURNEYS.md` once #607 lands". | All merged, and three of them **the same evening the paragraph was written**: #566 `46006862` 2026-08-18T19:24Z · #569 `f7501e07` 20:04Z · #574 `70598e33` 21:33Z · #589 2026-08-20T16:25Z · #607 18:11Z. `git cat-file -e origin/main:.claude/skills/<id>/SKILL.md` succeeds for all six skills. `JOURNEYS.md` landed via **#595 (`8260d734`)**, not #607. This is CHARTER §1's own worked example recurring inside CHARTER §3. |
| DA-0820-07 | drift | in-pr ⛔ | The §3 clock had **no row for this routine**, and §3a still listed it on the CCR fleet at `40 3,9,15,21 * * *` / every 6 h. CHARTER §11 requires the scheduler and this table to move together. | `list_scheduled_tasks` read live 2026-08-20: `doc-accuracy-daily`, `"30 19 * * *"`, enabled, `lastRunAt 2026-08-20T22:32:52Z` — local fleet, not CCR. All thirteen pre-existing §3 rows verified against the same read and are correct. §3 row added; §3a row marked moved. ⛔ **I could not verify whether the old CCR trigger was deleted** — no `list_triggers` tool is reachable from this session, and two doc-hygiene routines over one corpus is exactly the hazard §3a's own retired row records. |
| DA-0820-08 | contradiction | in-pr ⛔ | `routines/CHARTER.md` §2's *Public host* and *Deploy proof* rows both gave `curl -s https://www.homiquity.com/api/health` as the re-verification command — **one row apart from** the standing fact "machine-to-machine host: `*.up.railway.app`, **never `www`** — three cron sweeps died `curl` exit 6 on DNS". The table instructed the failure it warns about. | Rows read at `d8316ec`; fixed to the Railway host, with the browser-only use of `www` kept. |
| DA-0820-09 | **regression-suspect** | **open — escalated** | `verify-deploy` is `if: false` and `migrate-prod` is `workflow_dispatch`-only **on the stated premise that "the Railway production service is being taken down"** (`ci.yml:507,585`). That premise is false: **Railway is still building and deploying every merge.** So the one job that catches a failed build silently serving the previous container is disabled precisely while deploys are happening — the 2026-08-06 eight-commits-stale exposure, now unwatched. | `curl -s https://homiquity-production.up.railway.app/api/health` at **2026-08-20T22:45:18Z** → `{"status":"ok","commit":"d8316ec1ec99f0da6c7e794750960f53303defc4"}` = the exact `origin/main` tip, and **38 commits have merged since the pause** (`git log --oneline e762743b..origin/main \| wc -l`). Mitigating: `git diff --name-only e762743b..origin/main -- migrations/` is **empty**, so the migration journal has not yet run ahead of prod — the gap is zero *today*. **No edit made: `ci.yml` is code (D10), and D7 forbids editing a doc to match a state that may itself be the defect.** |
| DA-0820-10 | **regression-suspect** | **open — escalated** | `main`'s branch protection carries **zero required status checks**, so the `gate` every doc calls "required" is not enforced by the branch rule. | `gh api repos/barakatammre84/Homiquity/branches/main/protection` → `"contexts":[], "checks":[]`, `enforce_admins.enabled: true`, `allow_force_pushes: false`. `ci.yml:42-45` records that this comment "previously read ✅ CONFIGURED 2026-07-17: gate required. That was true when written and false by 2026-08-19." Config, not docs — escalated, not edited. |
| DA-0820-11 | claim-fixed-still-asserted | open — proposed to its owner | `routines/journey-walk/LEDGER.md:7` describes **#607** as "still open, `DIRTY`". | `gh pr view 607` → `MERGED 2026-08-20T18:11:22Z`. **Not touched:** peer routines' cross-run memory is off limits (D10); handed to the Client Journey Walk seat. |
| DA-0820-12 | drift | in-pr | Root `README.md:62` called the app-guide "the 11-chapter subsystem handbook". | `ls knowledge-base/handbook/app-guide/` → 12 files; `12-api-contract.md` added by **#574 (`70598e33`, 2026-08-18)**. → "12-chapter". |

## Drift-source scoreboard (the learning loop)

One tally per finding, class × doc-cluster. A class reaching **3** earns a structural-prevention
proposal in that tick's report (new mechanical sweep row, guard extension ticket, freshness
opt-in, CHARTER §2 fact row) — fixing the same drift twice without proposing the prevention is a
failed loop (SKILL Phase 3.2).

| drift class | tally | clusters hit | prevention proposed? |
|---|---|---|---|
| path-moved | 2 | governance, L1/L2 + feature-review | not yet |
| command-renamed | 3 | governance, handbook/specs/KB-README, compliance | **yes, and it already exists** — `pnpm guard:staleness` (`scripts/doc-staleness-guard.cjs`, #559) ratchets this exact class. The prevention for the *next* one is to keep its baseline honest: **proposed ticket, tighten `scripts/doc-staleness-baseline.json` `npmCommandRefs` 6 → 5** after this PR lands (a guard baseline is code — not this routine's to edit, D5/D10). |
| retired-term | 1 | specs | covered by `guard:staleness`'s `launchSprintRefs` metric |
| claim-fixed-still-asserted | 3 | research, routines/CHARTER ×2, routines/journey-walk | **yes — proposed:** the class is *"a transient state written into a living doc as if permanent"* (#589/#607/"has not merged"/"still open, DIRTY"). Every instance names a **PR number or an `origin/main` presence claim**, both machine-checkable. Proposed ticket: extend `doc-staleness-guard.cjs` with a `transientPrClaims` metric — a living doc (excluding `logs/`, `reports/`, `archive/`) asserting `#NNNN` near *open · not merged · unlanded · once … lands · if they merge* fails when `gh pr view NNNN` says MERGED. |
| contradiction | 2 | root README, routines/CHARTER §2 | not yet — both were *internal* contradictions (a doc disagreeing with itself two rows apart), which no current guard can see |
| fossil | 1 | root README + runbooks | not yet |
| index/dead-link | 1 | feature-review | `guard:kb` covers the KB README's own links only; this routine's sweep 2a covers every living doc's pointers |
| regression-suspect | 2 | CI config, branch protection | n/a — escalated, never fixed here |

Classes: `path-moved` · `command-renamed` · `retired-term` · `transient-state` ·
`claim-fixed-still-asserted` · `freshness-lapsed` · `contradiction` · `index/dead-link` ·
`fossil` · `gap` · `regression-suspect`.

## Rotation cursor

**Next slice: 2.** · **Slice done today: yes (2026-08-20, slice 1).** One deep slice per day now
that the seat is daily (SKILL Phase 1.3 — "the day's first sweep tick" is the only tick).
Full cycle = 13 days, one slice per day.

| # | cluster | notes |
|---|---|---|
| 1 | Root: `README.md` tier map, `CLAUDE.md` | CLAUDE.md rules propose-only; pointer rows ⛔ lane (D11) |
| 2 | `governance/` doctrine: TEAM_PRACTICES, AI_GOVERNANCE_POLICY, MODEL_RISK_GOVERNANCE, ASSUMPTIONS, ARMED_LAUNCH_CHARTER | house-style exemplars — hold to the 4-point framework hardest here |
| 3 | `governance/` registers + `security/` pack | CHANNEL_DECISION, CONTINGENT_LIABILITY_REGISTER, UNCONSUMED_CAPABILITIES carry freshness lines — real re-verification, then bump |
| 4 | `routines/`: CHARTER, REGISTER, LESSONS, reports/README | CHARTER factual rows ⛔ lane; §1b/§5/§6/§10 never (D11) |
| 5 | `handbook/`: DEVELOPER_PLAYBOOK, URLA_FORM_REFACTOR_TRAP, `design/` | |
| 6 | `handbook/app-guide/` 01–06 | |
| 7 | `handbook/app-guide/` 07–11 | |
| 8 | `runbooks/` + support-playbooks | CICD/CHANGE_LEDGER historical rows are history (D9) |
| 9 | `compliance/` | verify against code only; regulatory readings flagged `UNVERIFIED`, never adjudicated |
| 10 | `specs/` + L1/L2 | L1/L2 content propose-only; stamps + pointers in-lane |
| 11 | `feature-review/` program docs + `research/` living claims | FINDINGS.md rows = propose-only (peer register, D10) |
| 12 | `.claude/skills/` + `.claude/agents/` | ⛔ lane; `doc-accuracy/SKILL.md` itself never (D10) |
| 13 | KB index integrity + `archive/` quarantine intact + `logs/` supersession banners | |

## Known false positives — exclusion table (never re-litigate; grow it, cite it)

| pattern | why excluded | provenance |
|---|---|---|
| `server/services/apr.ts` `MortgageStreamParams` / `buildMortgagePaymentStream` | the *payment stream* domain term, not the repo's former name | audit §2a.2 |
| Old names / superseded claims inside `logs/`, `routines/reports/`, `archive/` | immutable dated history (TEAM_PRACTICES §2); banners only | audit §2 Manifest B |
| `runbooks/CICD.md` :4–7 former-name banner; `CHANGE_LEDGER.md` historical rows; `routines/CHARTER.md` :28 rename note; `BETA_GO_LIVE_READINESS.md` :204 struck-through item | each is deliberate, labeled history | audit §2a.2 |
| `feature-review/FINDINGS.md` old-name PR URLs | GitHub redirects renamed-repo URLs; normalizing is optional cosmetics, not drift | audit §2a.2 |
| "replacing Vercel" / "Retired … — Vercel" mentions in living docs | migration history, not instructions | audit §2b.3 |
| `pnpm guard:*` / `pnpm test:*` and prose that follows the word "pnpm" (`pnpm is the package manager`, `pnpm import`, `pnpm sync`) | the sweep-2b regex reads the next token as a script name; globs and sentences are neither | DA tick 2026-08-20 (14 hits, 0 real) |
| Living docs that state a path **does not exist** — `WORKFLOWS.md:341` (`server/routes/optimizations.ts`), `CHARTER.md:278` (`docs/DESIGN-STANDARD.md`), `ASSUMPTIONS.md:122` (`server/replit_integrations/`), `seo-content/SKILL.md:25` (`client/public/sitemap.xml`) | sweep 2a cannot tell an assertion from its negation; each of these is the doc doing this routine's job for it | DA tick 2026-08-20 |
| Paths in an **implementation sketch** — `NTHLA_609G_SPEC.md:139` (`server/services/homeLoanApplicantNotice.ts`, "build at F3") | a spec naming the file it proposes to create is a plan, not a dead pointer | DA tick 2026-08-20 |
| `.claude/worktrees/` in any doc | real directory, untracked by git — invisible to a `git ls-files` sweep | DA tick 2026-08-20 |
| `file.ts:NN` and `file.ts:NN-MM` citation suffixes | strip the suffix before existence-checking, or 764 of 785 hits are noise | DA tick 2026-08-20 |

## Run log

| date | mode | window | findings (new / carried / closed) | PR | STATUS |
|---|---|---|---|---|---|
| 2026-08-20 | `sweep+fix` (first real tick) | `e3655d7..d8316ec` — **79 commits, 2 days** (seat defined 08-18, first fired 08-20) | **12 new** (DA-0820-01…12): 9 fixed in this PR, 2 `regression-suspect` escalated un-edited, 1 handed to its owning routine · **2 carried closed** (DA-0818-02, -03, both landed by #559) · 0 refuted | *(this PR)* | WARN |
| 2026-08-18 | founding (not a tick) | `56cf00a..e3655d7` (3 docs-only commits, merged in-session) | 4 seeded from the knowledge-file audit → 2 closed by #557 landing mid-session (DA-0818-01, -04), 2 carried open (-02 narrowed, -03 re-verified) | founding branch `claude/md-docs-accuracy-routine-2x0850` | — |
