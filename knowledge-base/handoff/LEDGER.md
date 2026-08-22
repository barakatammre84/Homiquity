# Handoff corpus ledger — drift, uncertainties, refresh log

> **Freshness:** last verified 2026-08-22 · review every 30 days
> Rows are **proposals for the owning lane**, never edits made here. The corpus does not patch
> other documents: when a chapter's prove-it command disagrees with an existing doc, a skill, a
> code comment or a session memory, the disagreement becomes a row below and the other artifact is
> left for its owner (the doc-accuracy routine's fix-now lane covers `knowledge-base/**` living
> docs and the root `README.md`; `CLAUDE.md` and `.claude/**` pointers are its ⛔-flagged lane;
> code comments and scripts belong to the code's owner agent; memories belong to the founder).
> Rows are never deleted — a fixed row gets `done` and the PR number. Ids are `HO-<MMDD>-<NN>`,
> unique without coordination (CHARTER §5).

## Classes

`drift` — a doc states a fact the code no longer has · `contradiction` — two living artifacts
disagree · `fossil` — a comment or doc describes a mechanism that no longer exists · `gap` —
something a new hire needs that nothing states, or a control that is missing · `uncertainty` —
the corpus could not decide which side is right · `memory` — a claim that lives only in a
session memory, not in the repo.

## Findings

| id | class | status | where | says | the code says (verified @ 074899e3) | lane |
|---|---|---|---|---|---|---|
| HO-0822-01 | drift | open | `knowledge-base/handbook/app-guide/03-database.md:7`, `:40-41` | "21 schema files, **178 tables** as of 2026-07-12"; lists `lending.ts` (44 tables) and `underwriting.ts` (36) as domains | 34 files / 188 tables (FACTS F-01/F-02); both named files are zero-table re-export shims | doc-accuracy fix-now |
| HO-0822-02 | fossil | open | `shared/loanApplicationStatus.ts:9`, `shared/statusVocabularies.ts:8`, `client/src/pages/lending/preApproval/useServerDraftAutosave.ts:24`, `tests/clientSchemaImports.test.ts:15` | "174 Drizzle table definitions" | 188 — the number is history inside a rationale comment; label it as the count at the time | code owners (`hq-pipeline-owner`, `hq-intake-funnel-owner`, `hq-ci-guards-owner`) |
| HO-0822-03 | drift | open | `CLAUDE.md:54` | names two sub-registrar directories | four exist with an `index.ts` (FACTS F-06); the api-routes skill already says four | doc-accuracy ⛔ lane (CLAUDE.md pointer) |
| HO-0822-04 | drift | open | `.claude/skills/api-routes/SKILL.md:24` | "~523 endpoints" | 558 under `server/routes` (FACTS F-07), 579 across `server/` | doc-accuracy ⛔ lane (skill pointer) |
| HO-0822-05 | contradiction | open | `.claude/skills/api-routes/SKILL.md:20` | "New status pools use `pgEnum`" | one `pgEnum` in 188 tables (F-03); the rule the code follows is `varchar` + `as const` + a `z.enum` re-pin (`shared/schema/underwritingTasks.ts:293-303`) | founder — rule semantics in a skill are propose-only |
| HO-0822-06 | drift | open | `knowledge-base/handbook/app-guide/01-start-here.md:22`, `knowledge-base/handbook/app-guide/07-frontend.md:3-5` | "React 18" | `package.json:102` `"react": "^19.2.8"` since 2026-08-04 (`39a42bfc`) | doc-accuracy fix-now |
| HO-0822-07 | drift | open | `README.md:62` | "The 11-chapter subsystem handbook" | 12 chapters (F-20); the KB index already says 12 | doc-accuracy fix-now |
| HO-0822-08 | memory | open | session memory (`local-routine-fleet-and-laptop-capacity`) | "pre-push made opt-in via `PREPUSH_TESTS=1`" | `grep -c PREPUSH .githooks/pre-push` → 0; the hook runs tsc + 8 guards + `pnpm test` and now *blocks* when vitest is missing; the opt-out is proposed in an open PR | founder's session memory |
| HO-0822-09 | memory | open | session memory (`ci-cd-gates-and-landing`) | "`pnpm test` gated 08-22 by a test-collection guard script" (scripts/test-collection-guard.cjs — absent on main, hence no backticks) | not on `origin/main`; it lives on an open PR's branch | founder's session memory |
| HO-0822-10 | drift | open | the stale checkout the planning session started from (`feat/landing-coach-first`) | `MAX_MODEL_CALLS_PER_TURN = 2`, 7 coach tools | 4 and 8 on main (F-23) | none — recorded so a reader of that branch is not misled |
| HO-0822-11 | drift | open | `knowledge-base/handbook/app-guide/02-architecture.md:21,24,29,82` | "38 route domains", "22 domain files" (storage), "178 tables, 21 files", "22 domain route registrars" | 40 registrars (F-05), 26 storage files (F-32), 188 tables / 34 files | doc-accuracy fix-now |
| HO-0822-12 | contradiction | open | `knowledge-base/handbook/app-guide/02-architecture.md:58,71,88` | "CSP disabled"; the logger "suppresses response bodies for sensitive paths" (a denylist); `server/prerender.ts` is the mounted middleware | CSP is enabled report-only in production (`server/app.ts:181-189`); the logger is an **allow-list of three paths** and the code forbids reverting (`server/app.ts:475-487`); the mounted symbol is `prerenderMiddleware` from `server/routes/seo.ts:187`. **The denylist line is dangerous: acting on it would log SSNs.** | doc-accuracy fix-now (highest priority row) |
| HO-0822-13 | gap | open | `.claude/agents/hq-*-owner.md` (all 41) | — | `server/routes.ts`, `server/db.ts`, `server/index-prod.ts`, `railway.json`, `scripts/migrate-prod.cjs`, `.github/workflows/ci.yml` appear in no owner's file list (`grep -ln 'server/routes\.ts\|railway\.json\|migrate-prod\|ci\.yml' .claude/agents/hq-*-owner.md` → no matches) | founder (ownership is a founder assignment; `hq-ci-guards-owner` is the natural home for four of them) |
| HO-0822-14 | drift | open | `knowledge-base/runbooks/CICD.md:236-239`, `knowledge-base/runbooks/DB_MIGRATIONS.md:19-39,173-175,188`, `knowledge-base/runbooks/ROLLBACK.md:43-44`, `knowledge-base/handbook/app-guide/10-deploy-ops.md:13,33-37` | `migrate-prod` applies on push; `verify-deploy` polls after every push (and `DB_MIGRATIONS.md:188` says it polls `www`) | both jobs are paused (`ci.yml:553` dispatch-only, `:621` `if: false`) since PR #608 on 2026-08-20; the probe host is the Railway origin (`ci.yml:658-669`, pinned by `tests/ciTriggers.test.ts:153`). Only `routines/CHARTER.md:685-693` records the pause | doc-accuracy fix-now — **or** close by re-arming (the open re-arm PR), whichever lands first |
| HO-0822-15 | drift | open | `README.md:110`, `knowledge-base/handbook/app-guide/10-deploy-ops.md:19`, `knowledge-base/handbook/app-guide/01-start-here.md:62-63`, `knowledge-base/runbooks/LOCAL_DEV.md:309` | direct pushes to `main` are "blocked by branch protection" | `main` requires no status checks (F-44 = 0; rulesets 0); `enforce_admins: true` binds admins to an empty list (`ci.yml:30-41`) | founder (re-arm the required check) + doc-accuracy fix-now for the prose |
| HO-0822-16 | drift | open | `knowledge-base/handbook/app-guide/05-data-flow.md` | describes an assistant-fed, borrower-graph-centred flow | never names `finalizeIntake`, `updatePipelineStage`, `decision_snapshots`, `lender_submissions`, adverse actions, TRID or the draft container (zero hits for the six chokepoint terms) — the current journey is chapter 04 | doc-accuracy fix-now (a rewrite, not a patch — propose) |
| HO-0822-17 | fossil | open | `server/services/coachFileTruth.ts:17` | "tests/integration/homiTruth.test.ts is the oracle" | no `tests/integration/` directory exists; the nearest live file is `tests/homiFileTruth.test.ts` (allowlisted at `vitest.config.ts:297`) | `hq-ai-coach-owner` |
| HO-0822-18 | fossil | open | `knowledge-base/handbook/app-guide/08-services.md:108` | "`storage.ts` is huge but mechanical — search it" | `server/storage.ts` was deleted in the split; the layer is `server/storage/` (26 files) | doc-accuracy fix-now |
| HO-0822-19 | drift | open | `knowledge-base/handbook/app-guide/07-frontend.md:9,12-13,16-37,56-58,75` | lists `next-themes`; "~420 lines … 160+ `<Route>`s"; a per-persona page table; adoption "7/99" and "82%" | `next-themes` is not in `package.json`; 635 lines / 121 routes (F-22); the page table is stale in every row (borrower 56, staff 48, public 27 …); the adoption figure is generated in `DESIGN_SYSTEM.md:42` | doc-accuracy fix-now |
| HO-0822-20 | fossil | open | `tests/cronSchedules.test.ts:12,63`; `.githooks/pre-push:107,133`; `scripts/preflight.sh:6`; `scripts/checkup.sh:2-9` | "six sweeps"; "9 guards"; "all 16 gate checks" / "all sixteen"; eight check categories | 7 sweeps (F-29); 8 guard steps; 18 preflight steps; 18 checkup checks (F-17). The assertions are correct — only titles and comments drifted | `hq-ci-guards-owner` |
| HO-0822-21 | memory | open | session memory (`agent-and-skill-registration`) | "`.claude/skills` hot-reloads" | not documented anywhere in `.claude/`, `knowledge-base/` or `CLAUDE.md` (`grep -rniE 'hot-?reload'` → Vite hits only); "agents snapshot at session start" *is* documented (`knowledge-base/routines/reports/2026-08-20-feature-completion.md:211`) | founder's session memory — keep as a hypothesis, not a fact |
| HO-0822-22 | fossil | open | `migrations/0056_extracted_fields_source_document.sql:1` | the header names itself "0054" | the file and journal entry are `0056`; the ledger guard checks filename ↔ idx, not comment prose | `hq-documents-owner` (comment only; never edit an applied migration's SQL) |
| HO-0822-23 | gap | open | `vitest.config.ts`, `vitest.integration.config.ts` | — | `tests/maintenanceMode.test.ts` is in neither include list (F-39) and has never run; the config records the same class for `changeOfCircumstance.test.ts` at `vitest.config.ts:140-141` | `hq-ci-guards-owner` — append it to the allowlist (at the END) in its own PR |
| HO-0822-25 | gap | open | `scripts/ui-standard-guard.cjs:337`; `knowledge-base/handbook/design/DESIGN_SYSTEM.md` §0 | — | the generated adoption table's denominator counts client `*.test.*` files, so **every PR that adds a colocated client test must also regenerate `DESIGN_SYSTEM.md`** (`pnpm guard:ui --write-table`) or the required `guard:ui` step reds — the first acceptance run of the loop playbook hit it and had to commit a generated line to add one test; the same class as the "main is red again — regenerate the §0 table" commit on 2026-08-22 | `hq-ci-guards-owner` — exclude test files from the denominator, or document the regeneration as a required step (chapter 12 ticket 15) |
| HO-0822-24 | gap | open | `scripts/migration-ledger-guard.cjs:18-24` | six checks: duplicate idx, duplicate tag, gaps, entry without SQL, SQL without entry, filename ≠ idx | no check for a **duplicate `when`** — the one copy-paste mistake that makes `migrate-prod.cjs:71,81` silently skip a migration in prod (`DB_MIGRATIONS.md:145-150`) | `hq-ci-guards-owner` — a seventh check |

## Uncertainties register (Feynman step 2: name what you could not verify)

| id | status | question | what would resolve it |
|---|---|---|---|
| HO-0822-U1 | **resolved** 2026-08-22 | Are the direct `status` writes in `server/services/loanAnalysis.ts` (bypassing `updatePipelineStage`) intended? | Yes — sanctioned by name: `tests/statusVocabulary.test.ts:254-259` allow-lists exactly four files (`pipelineEngine.ts`, `loanAnalysis.ts`, `scripts/migrate-status-vocabulary.ts`, `server/seed.ts`) and the comment at `:249-253` explains why. Chapter 04 records it. |
| HO-0822-U2 | open | Is the integration lane meant to stay outside the CI gate, or is that a gap awaiting the Postgres service the gate already has (`ci.yml:165-181`)? | founder / `hq-ci-guards-owner`; chapter 12 proposes it as a ticket. |
| HO-0822-U3 | open | Is outbound SMS wired anywhere? Only inbound Twilio signature verification and suppression logic were found. | `grep -rn "messages.create\|twilio" server --include='*.ts'` by the messaging owner. |
| HO-0822-U4 | **resolved** 2026-08-22 | Exact count of encrypted-at-rest column sites. | 8 `_encrypted` sites (F-28) plus `credit_pulls.encryptedRawResponse`, which the naming misses — nine in total; chapter 03 lists them. |
| HO-0822-U5 | open | Is dark mode reachable? `tailwind.config.ts:4` is `darkMode: ["class"]` and `index.css:265` defines `.dark {}`, but nothing under `client/src` toggles the class and `next-themes` is absent. | the design owner; `grep -rn "classList.*dark\|ThemeProvider\|useTheme" client/src`. |
| HO-0822-U6 | open | Do the open pre-push-hook PR and the open test-collection-guard PR conflict? Both touch `.githooks/pre-push` and `package.json`. | `gh pr diff` on each; whichever merges second rebases. |
| HO-0822-U7 | open | Why did commit `69de42ae` (the hooks + routine registry + governance test) never merge? No PR number, no closure note, no LESSONS row. | the founder; `git log --all -- .claude/settings.json`. |
| HO-0822-U8 | open | Does any test forbid `tryResolveMatrixValue` inside a decision-path module? | `grep -rn "tryResolveMatrixValue" tests/ server/`; chapter 12 proposes the test. |

## Refresh run log

| date | from SHA → to SHA | chapters touched | by | PR |
|---|---|---|---|---|
| 2026-08-22 | — → 074899e3 | all (initial authoring; six read-only evidence sweeps, every FACTS row re-derived) | founder session | — |
| 2026-08-22 | 074899e3 (+ the corpus) | fresh-hire teach-back test: an agent restricted to this directory (answer key forbidden) answered 100 questions, 96 with a confirmed `path:line`, 2 `DOC GAP`, 2 partial; its friction report's five numeric misses, six line offsets, two contradictions and one unnamed file were fixed in the same PR | founder session | draft PR #673 (the corpus) |
| 2026-08-22 | 074899e3 | playbook acceptance run: a real headless ralph-loop on `prompts/new-test.md` against `client/src/lib/sla.ts` — `STATUS: DONE`, 83 turns, 22.5 min, T0–T3 lines copied from its logs; found HO-0822-25 and the missing-promise rule; the rails, three templates and the report format were amended | founder session | draft PR #672 (the loop's own, two files) |
