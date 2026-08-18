# Doc Accuracy — Ledger

The cross-run memory of the `/doc-accuracy` routine
([`.claude/skills/doc-accuracy/SKILL.md`](../../.claude/skills/doc-accuracy/SKILL.md)). Every tick
reads this file **before** choosing work (rail D2) and updates it in the same PR as the fixes it
describes. Ids are **`DA-<MMDD>-<NN>`** — date-qualified per
[`routines/CHARTER.md`](../routines/CHARTER.md) §5, unique by construction with zero coordination —
and are never reused. Statuses: `open` → `in-pr` → `done`, or `refuted` / `escalated` /
`blocked-collision` / `superseded`.

**`last-swept SHA:`** `e3655d7` *(origin/main tip at the routine's founding, 2026-08-18. The
founding session itself swept `56cf00a..e3655d7` — three docs-only peer-register/audit commits,
`git diff --stat` confirmed zero non-md paths, and the Step-2 landing #557 was reconciled into
the rows below the same session.)*

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

## Drift-source scoreboard (the learning loop)

One tally per finding, class × doc-cluster. A class reaching **3** earns a structural-prevention
proposal in that tick's report (new mechanical sweep row, guard extension ticket, freshness
opt-in, CHARTER §2 fact row) — fixing the same drift twice without proposing the prevention is a
failed loop (SKILL Phase 3.2).

| drift class | tally | clusters hit | prevention proposed? |
|---|---|---|---|
| path-moved | 1 | governance | not yet |
| command-renamed | 2 | governance, handbook/specs/KB-README | not yet — at 3, propose a commands-as-instruction sweep script ticket |
| retired-term | 1 | specs | not yet |
| claim-fixed-still-asserted | 1 | research | not yet |

Classes: `path-moved` · `command-renamed` · `retired-term` · `transient-state` ·
`claim-fixed-still-asserted` · `freshness-lapsed` · `contradiction` · `index/dead-link` ·
`fossil` · `gap` · `regression-suspect`.

## Rotation cursor

**Next slice: 1.** · **Slice done today: no.** One deep slice on the day's first sweep tick
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

## Run log

| date | mode | window | findings (new / carried / closed) | PR | STATUS |
|---|---|---|---|---|---|
| 2026-08-18 | founding (not a tick) | `56cf00a..e3655d7` (3 docs-only commits, merged in-session) | 4 seeded from the knowledge-file audit → 2 closed by #557 landing mid-session (DA-0818-01, -04), 2 carried open (-02 narrowed, -03 re-verified) | founding branch `claude/md-docs-accuracy-routine-2x0850` | — |
