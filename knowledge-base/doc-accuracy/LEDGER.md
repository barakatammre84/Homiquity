# Doc Accuracy — Ledger

The cross-run memory of the `/doc-accuracy` routine
([`.claude/skills/doc-accuracy/SKILL.md`](../../.claude/skills/doc-accuracy/SKILL.md)). Every tick
reads this file **before** choosing work (rail D2) and updates it in the same PR as the fixes it
describes. Ids are **`DA-<MMDD>-<NN>`** — date-qualified per
[`routines/CHARTER.md`](../routines/CHARTER.md) §5, unique by construction with zero coordination —
and are never reused. Statuses: `open` → `in-pr` → `done`, or `refuted` / `escalated` /
`blocked-collision` / `superseded`.

**`last-swept SHA:`** `4206025f` *(origin/main tip, 2026-08-22T15:20Z.)*

⚠️ **Merge note — this file has two unmerged writers.** [PR #647](https://github.com/barakatammre84/Homiquity/pull/647)
(the 2026-08-20 tick) advanced `last-swept` to `d8316ec` and added rows `DA-0820-01…13`, and it was
still **open** when this tick ran. This tick therefore branched from `origin/main` (where
`last-swept` is still the founding `e3655d7`), swept the **`d8316ec..4206025f`** window that #647
left behind, and did **not** duplicate any DA-0820 finding. If the two PRs conflict here, resolve
**additively — keep both sets of rows in date order** (the `knowledge-base/README.md` hazard rule,
REGISTER §hazards), and keep the later `last-swept` value.

**Cadence:** **daily at 19:30 local**, `taskId` `doc-accuracy-daily` — founder decision 2026-08-20.
The SKILL text still describes a 6-hourly cadence; it is **not self-amendable** (rail D10), so that
correction stays proposed to the founder rather than made here.

---

## Findings register

Seeded at founding from the [2026-08-18 knowledge-file audit](../logs/2026-08-18-knowledge-file-audit.md)
§2b — each row was code-verified that day and **must be re-dated per rail D6 before being acted
on** (the audit's Step-2 staging or another session's PR may land any of them first).

| id | class | status | finding | evidence / provenance |
|---|---|---|---|---|
| DA-0818-01 | path-moved + command-renamed | **done** | `governance/TEAM_PRACTICES.md` carried dead pointers while its freshness line was green: the retired "🚀 Launch sprint" section, the "launch-sprint memory ledger", `kb/…` paths, `npm run check`/`npm test`. | audit §2b.1. **Fixed by #557 (Step-2 landing, 2026-08-18)** — grep for `Launch sprint|kb/founder|kb/lo-audit|npm run check|npm test` at `e3655d7` returns only an innocuous `pnpm test` line. Closed by the founding session's own D6 re-dating: the finding was fixed between seed and commit — the exact CHARTER §1 failure mode this ledger exists to prevent. |
| DA-0818-02 | command-renamed | open | `npm`-as-instruction survives in living docs beyond TEAM_PRACTICES (which #557 fixed): `handbook/design/design_guidelines.md`, app-guide 01/02/10, `DEVELOPER_PLAYBOOK.md`, `compliance/REGULATORY_MONITORING.md`, three specs, and the KB README's own guard lines (verified live at `e3655d7`: README :4 `npm run checkup`, :158 `npm run checkup`). One mechanical normalization pass. | audit §2b.2. Proposed to Evening Triage by the audit; if unlanded when a tick reaches it, it is inside this routine's default lane. Re-date each file per D6 before editing. |
| DA-0818-03 | retired-term | open | Three spec passages lean on the retired "launch sprint" concept name: `specs/LO_ADVISOR_PROGRAM.md` :43, `specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md` :47/:298. The underlying intent (roadmap outranks program work) is still true — reword the pointer, keep the rule. | audit §2b.2; re-verified live at `e3655d7` (all three lines present). |
| DA-0818-04 | claim-fixed-still-asserted | **done** | `research/gtm/COMPETITIVE_BRIEF_2026-07-06.md` needed a dated supersession banner pointing at the teardown corpus. | audit §2b.4. **Fixed by #557** — the ⚠️ banner is present at `e3655d7` :3–:8, citing `research/better-teardown/`, history kept per TEAM_PRACTICES §2. |
| DA-0822-01 | contradiction | in-pr | `governance/TEAM_PRACTICES.md` §6 asserted "Branch protection **currently enforces** this (required `gate` check + `enforce_admins`…)". Live measurement says otherwise, and the doc **contradicts itself** — :146 already says "`main` carries no required status check". | Dated per D6: the claim entered at **#261 (`65b17793`, 2026-07-19)** and stood 34 days. Probed **2026-08-22T15:29:50Z**: `gh api …/branches/main/protection` → `"contexts": []`, `"checks": []`, `strict: false`, `enforce_admins: true`, `allow_force_pushes: false`, `allow_deletions: false`. Corrected **tightening only**: force-push/deletion facts kept (still true), the rule sentence kept verbatim, the false status claim replaced by the dated measurement plus a pointer to the enforcement probe §6 already prescribes. **Whether the config should be restored is NOT settled here** — that is the open `regression-suspect` DA-0820-10 (#647), and D7 forbids editing a doc to bless a state that may itself be the defect. |
| DA-0822-02 | retired-term | in-pr ⛔ | `.claude/skills/primary-engineer/SKILL.md` sent the daily 07:15 **code-writing** routine to `knowledge-base/SESSION_CLAIMS.md` twice — R4 :56 told it to *claim its item* there, and Phase-0 :112 told it to *read* it as memory. That file has been a stub since 2026-08-12 and says in its own body "do not add new content here". A claim written there is invisible to every peer reading `REGISTER.md` — the exact two-boards failure the consolidation fixed. | `knowledge-base/SESSION_CLAIMS.md` :1–:13 (stub, absorbed into `routines/REGISTER.md`, PR #493 vs #496, 2026-08-12); `knowledge-base/README.md:82` labels it a stub; **`.claude/skills/financial-audit/SKILL.md:84` already carries the correct wording**, which is the in-repo model this fix copies. Pointer-only (D11 ⛔ lane) — the rule "claim your item on the claim board before working" is unchanged. ⚠️ `.claude/skills/primary-engineer/SKILL.md` is also touched by open **#654**, whose hunks (:8–18, :92–105) do not overlap :56/:114. |
| DA-0822-03 | gap | open — **proposed** (D10 `docs/**`) | `docs/fannie-mae/README.md` "Reading these files" tells every human and Claude session: "Every file in this directory is readable locally — nothing requires an external service: **PDF** — Claude's Read tool renders them directly". **The Read tool cannot open a PDF on this machine.** | Reproduced this tick on the founder's own attachment: `Read(Selling-Guide_08-05-2026_highlighted.pdf, pages 1-6)` → `"pdftoppm is not installed. Install poppler-utils"`. Confirmed: `command -v pdftoppm/pdftotext/pdfinfo` → all **ABSENT**; `brew list poppler` → NOT installed. The *scripted* half of the sentence is true — `pypdf 6.14.2` ✅ and `pymupdf` ✅ (this tick extracted all **175** founder highlights with it). This is CLAUDE.md's "four ways a reachable source looks blocked" hazard **pointed at the local corpus**: a session told the documented method works, seeing it fail, may conclude the authority is unavailable — and CLAUDE.md's compliance-first rule then says do not proceed. Wording proposed in the report. |
| DA-0822-04 | path-moved | open — proposed to its owner | `feature-review/FINDINGS.md` cites three paths that do not exist: server/routes/lending.ts (:344 — no such file; it is the directory `server/routes/lending/`), tests/loanDeliveryReadiness.test.ts (:130 — no such file, hence no backticks), docs/hmda/ (:320 — no such directory; `docs/` holds cdia-metro2, fannie-mae, fcra, irs-forms, lender-programs, nmls, nmls-safe, reg-z). | Sweep 2a at `4206025f`, negations and `:NN` suffixes stripped. **Not touched** — peer routines' cross-run memory is off limits (D10); handed to the feature-review seat. |
| DA-0822-05 | path-moved | open — proposed to Evening Triage | `CTO_ROADMAP.md:504` references `docs/freddie-mac/`, which does not exist. | Sweep 2a at `4206025f`. **Not touched** — CHARTER §4 gives Evening Triage exclusive roadmap authority (D10). |
| DA-0822-06 | *(not doc drift — recorded because it blocked this tick)* | open — handed to Trunk Health | `client/src/components/BuyingPowerEstimator.test.tsx` is **load-flaky in the client lane** and blocked this docs-only push at the pre-push hook. **Second instance of this exact class in three days** (#647's DA-0820-13 was `tests/extractionPersistence.test.ts` in the *node* lane), so it is now a pattern, not an incident. | **Mechanism found, not guessed:** the helper `runToEstimate` ends in `screen.findByTestId("text-estimator-result")`, and testing-library's `findBy*` carries its **own 1000 ms** default that is *independent of* `vitest.client.config.ts:36 testTimeout: 45000` — so the suite budget is untouched while a 1 s wait on a `setTimeout`-gated step transition blows under load. Gate run: `1 failed \| 790 passed`, wall `675.69s` with `import 2389.96s` / `environment 1381.80s` (aggregate ≫ wall = contention). **Standalone: 4/4 passing in 12.16s** via `npx vitest run --config vitest.client.config.ts <file>`. Host at `load average 49.90` with **12 concurrent vitest processes** from peer sessions in `homiquity-income` and `hq-selling-guide`. Untouched in this tick's window (`git diff --name-only d8316ec..origin/main \| grep -i buyingpower` → empty) and unchanged since **#595 (`8260d734`)**. **Prevention (proposed, code so not mine):** give the `findBy*` calls in `setTimeout`-gated helpers an explicit `{ timeout }` rather than inheriting 1000 ms. |

## Drift-source scoreboard (the learning loop)

One tally per finding, class × doc-cluster. A class reaching **3** earns a structural-prevention
proposal in that tick's report (new mechanical sweep row, guard extension ticket, freshness
opt-in, CHARTER §2 fact row) — fixing the same drift twice without proposing the prevention is a
failed loop (SKILL Phase 3.2).

| drift class | tally | clusters hit | prevention proposed? |
|---|---|---|---|
| path-moved | 3 | governance, feature-review, roadmap | **at 3 — prevention proposed:** sweep 2a is manual every tick. Proposed ticket in this tick's report: fold it into `scripts/doc-staleness-guard.cjs` as a `deadRepoPaths` metric, reusing this ledger's four hard-won filters (strip `:NN` suffixes, skip negations, skip `.claude/worktrees/`, resolve extension-less module refs) — without them 764 of 785 hits are noise. Guards are code, so the guard itself is a ticket, not this routine's edit (D5/D10). |
| command-renamed | 2 | governance, handbook/specs/KB-README | not yet — at 3, propose a commands-as-instruction sweep script ticket |
| retired-term | 2 | specs, `.claude/skills/` | not yet — but note **no guard covers `.claude/skills/**` or `.claude/agents/**` at all**, and they auto-load into every session |
| claim-fixed-still-asserted | 1 | research | not yet |
| contradiction | 1 | governance/TEAM_PRACTICES | not yet — an *internal* contradiction (§6 vs :146, 60 lines apart) that no current guard can see |
| gap | 1 | `docs/` corpus-access | not yet |
| *(infra: load-flaky test blocking a docs-only push)* | 2 | node lane (#647 DA-0820-13), client lane (DA-0822-06) | **at 2 and climbing — proposed:** the shared cause is a short library-default wait (`findBy*` 1000 ms) inheriting nothing from `testTimeout`, exposed whenever peer sessions load the host. Ticket: audit `findBy*`/`waitFor` in `setTimeout`-gated helpers for explicit timeouts. Guards and tests are code (D5/D10) — a ticket, not this routine's edit. |

Classes: `path-moved` · `command-renamed` · `retired-term` · `transient-state` ·
`claim-fixed-still-asserted` · `freshness-lapsed` · `contradiction` · `index/dead-link` ·
`fossil` · `gap` · `regression-suspect`.

## Rotation cursor

**Next slice: 3.** · **Slice done today: yes (2026-08-22, slice 2 — `governance/` doctrine).**
One deep slice per day now that the seat is daily. *(#647 recorded slice 1 done on 2026-08-20; this
tick took slice 2 rather than re-running it. If #647 is closed unmerged, slice 1 is still owed.)*
One deep slice on the day's first sweep tick
(SKILL Phase 1.3); later same-day ticks are diff + mechanical sweeps only. Full cycle ≈ 13 days
at the 6-hourly cadence.

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
| `pnpm audit` | a pnpm **builtin**, not a `package.json` script — sweep 2b resolves script names only | DA tick 2026-08-22 (4 files, 0 real) |
| Extension-less module references — `server/http/routeParams`, `shared/compliance/loCommsLint`, `tests/extractionService`, `shared/lib/amortization`, `server/routes/lending` | all resolve once a .ts or .test.ts extension, or a trailing slash, is appended (suffixes written without backticks here so the citation guard does not read them as paths); sweep 2a must try those suffixes before reporting | DA tick 2026-08-22 (5 hits, 0 real) |
| Template placeholders in a recipe — migrations/NNNN_short_name.sql (`runbooks/DB_MIGRATIONS.md:140`; the placeholder is deliberately not backticked here — the citation guard would count it) | `NNNN` is the placeholder the recipe tells you to replace, not a path | DA tick 2026-08-22 |
| Living docs stating a **command** does not exist — `backend-data-engineer/SKILL.md:228` (**"`pnpm test:node` does not exist**  — the node lane is `pnpm test:unit`") | the 2026-08-20 negation exclusion was written for *paths*; it covers commands identically — the doc is doing this routine's job for it | DA tick 2026-08-22 |

## Run log

| date | mode | window | findings (new / carried / closed) | PR | STATUS |
|---|---|---|---|---|---|
| 2026-08-22 | `sweep+fix` | `d8316ec..4206025f` — 2 commits (#643 design-identity, #649 test race); the window #647 left behind | **6 new** (DA-0822-01…06): 2 fixed here (1 ⛔), 3 proposed to their owners (`docs/**`, feature-review, roadmap), 1 infra flake handed to Trunk Health · 0 carried closed · 0 refuted · **4 new exclusion rows** | *(this PR)* | WARN |
| 2026-08-18 | founding (not a tick) | `56cf00a..e3655d7` (3 docs-only commits, merged in-session) | 4 seeded from the knowledge-file audit → 2 closed by #557 landing mid-session (DA-0818-01, -04), 2 carried open (-02 narrowed, -03 re-verified) | founding branch `claude/md-docs-accuracy-routine-2x0850` | — |
