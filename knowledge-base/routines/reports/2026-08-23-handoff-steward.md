# Handoff Corpus Steward — 2026-08-23 (founding tick)

STATUS: WARN — the corpus is trustworthy at today's tip and its steward seat now exists, but an open refresh PR (#699) carries part of today's truth with four off-by-ones of its own, the daily walk seat is retired pending the founder's scheduler repoint, and today's Journey 3 walk is BLOCKED (no browser tooling in this container) with the seam probe standing in at HTTP fidelity.

## ⛔ Human actions (hardest first)

1. **Repoint the laptop scheduled task `client-journey-walk`** to the new steward prompt — paste the fenced "Scheduler prompt" block from `.claude/skills/handoff-refresh/SKILL.md` verbatim, keep the `taskId`, archive the old prompt under `~/.claude/scheduled-tasks/_archive/` with a dated note (CHARTER §11). Until then the laptop still fires the walk prompt daily; each firing will find the walk retired in CHARTER §3 and this ledger. Journey walks stay available: `/journey-walk`, next persona = Journey 3.
2. **Merge order: #699 first, then this PR.** They touch disjoint files by design (this PR edits only chapters 01/02/04/05/08, `handoff/README.md`, `prompts/`, the skill, CHARTER, the two routine ledgers; #699 owns 00/03/06/07/09/10/11/12 + FACTS + LEDGER + TEACHBACK_KEY). Before merging #699, consider its four off-by-ones listed under "Feedback on #699" — each is one line.
3. **Two CCR triggers still fire daily into their own STOP clauses** (re-measured live this session via `list_triggers`, 14 triggers): "Frontend Wiring Audit — REPORT ONLY" (`20 10 * * *`) and "Deliverable QA Sweep" (`10 16 * * *`) invoke `/frontend-wiring-audit` and `/deliverable-qa-sweep`, and `git cat-file -e origin/main:.claude/skills/<id>/SKILL.md` fails for both. Land the skills or disable the triggers. (CHARTER §3a's "three cite a skill not on origin/main" is itself stale: `backend-data-engineer`, `ui-conformance-sweep` and `doc-accuracy` all exist on main now — doc-accuracy's ⛔ lane.)
4. **`main` still has no required status checks** (carried from ch 07/10's status boxes and ci.yml:30-45's own comment, not re-measured here — no `gh` in this container). The gate is advisory; `.githooks/pre-push` is the only bite. Re-arm when ready (HO-0822-15's founder leg).

## Summary

All 13 chapters of `knowledge-base/handoff/` plus `prompts/` were adversarially re-verified against `origin/main` @ `6377727e` by four read-only verifiers re-running every prove-it command: **every code-level mechanism claim reproduces**, and the drift found is almost entirely two stories — #694 (`3d047ce9`) fixed the app-guide staleness five chapters still warned about, and #667's 20-line insertion shifted `statusDecisions.ts` cites. Fixes were made in place only in the files open PR #699 does not touch (chapters 01/02/04/05/08, README, prompts — commits `14d8569a`, `b0320b31`, `6f18433c`); everything in #699's files is routed below as feedback or steward tickets. The daily 17:06 seat was rewritten from the Client Journey Walk into the **Handoff Corpus Steward** (founder decision; commit `c7030959`): the `handoff-refresh` skill is now the seat definition with an existence guard, a drift-aging phase, reconciled clocks, and the verbatim replacement scheduler prompt. Today's Journey 3 walk is **BLOCKED** (no browser tooling in this cloud container; W2 forbids reporting HTTP substitution as a walk; rotation does not advance) — a separately-labeled seam probe proved the server halves: promotion, draft round-trip, draft consumption, the self-employed document set, and the URLA employment carry, plus 12 clean public-page render probes.

## Evidence

### Corpus verification (the reverse-engineering pass)

- **Facts at the tip.** `pnpm handoff:facts --check --verbose` → 3 DISAGREES: F-13 (219·238 → 221·239), F-36 (14·7 → 15·7) — both already fixed in open #699 — and F-31 (1,085 → **72**), which is this container's **shallow clone** (`git rev-parse --is-shallow-repository` → `true`), not drift; #699 carries the true 1,098. `pnpm handoff:facts --cite` → "555 resolvable citation(s)… every citation lands. ✅". F-44 (required checks) not re-measurable here (no `gh`).
- **Chapter verdicts** (verifier / prove-it commands re-run / result):
  - **00–03**: all clean at HEAD; server/ and shared/schema byte-identical to the verification commit. Ch 01's four "app-guide 02 is stale" trap rows described bugs #694 fixed → rewritten in place with the two residues (the fixed doc's own "39 vs measured 40 registrars" miscount; `runbooks/CICD.md:129-131` + `app-guide/10-deploy-ops.md:154-156` still pointing at `server/prerender.ts`). Ch 02 the strongest chapter — zero meaningful drift; its one uncited figure now carries a receipt (136).
  - **04–06 + 11**: every mechanism/hop/gate claim reproduces; ch 04/05's only rot was #667's +20 line shift (remapped in place, each number re-derived against the file) and one more #694-resolved trap (app-guide 08's deleted `storage.ts` pointer — annotated). Ch 06/11 (#699's files): residual number-only deltas listed as steward tickets; the sixteen A-patterns + sixteen B-patterns all still describe what the code does.
  - **07 + 10 + 12** (all #699's files): status boxes substantively TRUE at HEAD pending #699 (`migrate-prod`/`verify-deploy` armed at ci.yml:583/:656, `continue-on-error` :672, #670 landed, PREPUSH_TESTS opt-in). Residuals #699 does not cover → steward tickets T1–T9 below. The one permitted live `pnpm test` demonstrated the collection guard's fail-closed property (exit 1 on missing esbuild — the container blocks dependency build scripts) though the counts themselves were verified statically.
  - **08 + README + prompts + HO rows**: ch 08's 14/14 prove-it groups byte-identical; cites remapped (+20 statusDecisions, +3 CLAUDE.md via #693, fcra-owner :33). README five-facts row 3 rewritten (#670 closed both halves). prompts/: 8 of 11 files fully clean; 3 carried the moved `ci.yml` job lines (:574→:583, :663→:672) — fixed.
- **HO- drift rows re-verified at HEAD** (LEDGER is #699's file — verdicts recorded here for the steward): **resolved by `3d047ce9` (#694):** HO-0822-01, -06, -07, -11 (residuals: "39" vs measured 40; `02-architecture.md:93` names `staff/` where the fourth sub-registrar is `agent-broker/` — new-row candidate), -12, -18, U5; **partially resolved:** -15 (root `README.md:107-109` still claims direct pushes are rejected by the required gate check — the last overstatement), -19 (page-table still stale); **still valid:** -02 (clientSchemaImports cite now :13), -03 (CLAUDE.md now :57), -04, -05, -13, -14 (the `www` claim moved to `DB_MIGRATIONS.md:52`), -16, -17 (vitest cite now :298), -20 (moved targets), -21, -22, -24, -25; **kernel-valid, headline stale:** -26 ("red right now" no longer true). U2/U3/U7/U8 open and re-confirmed.

### The steward seat

`c7030959` — `.claude/skills/handoff-refresh/SKILL.md` reshaped to the canonical seat skeleton (cadence daily 17:06; existence guard; phases orient→detect→fix→**age**→prove→report; deferred mode for an open handoff PR; status rules; the reconciled clocks: `--check`/`--cite` daily · FACTS ≤14 d · chapter rotation ≤30 d; the scheduler prompt fenced verbatim). CHARTER: §3 row + dated prose, §4 chain, §6 steward territory row + walk row annotated hand-invoked + Doc Accuracy's never-edit list gains `knowledge-base/handoff/**` (one writer per truth). `routines/journey-walk/LEDGER.md` carries the retirement banner; rotation preserved (next = Journey 3). `handoff/README.md` layer 3 names the scheduled steward.

### Journey 3 attempt — verdict BLOCKED; the seam probe (labeled, not a walk)

**Why BLOCKED:** the journey-walker agents require `mcp__Claude_Browser__*`; ToolSearch confirms none exist in this container. `feature-review/CHARTER.md:83-86` + walk rail W2: substituting HTTP calls and reporting a walk is a FAIL — so the verdict is BLOCKED, the rotation pointer does not advance, and what follows is a **seam probe at HTTP + public-render fidelity**, never a walk.

**Truthful server:** `bash scripts/dev-up.sh` on the primary checkout; `/api/health` → `{"status":"ok","commit":null,"email":{…}}` (the local-dev signature — both keys present); `lsof -a -p <pid> -d cwd` → `/home/user/Homiquity`; fresh boot (tsx has no watch; server == HEAD). Throwaway cluster on :5433 (`LOCAL_DB_DIR=/var/lib/postgresql/hq-local-pg` — overriding the script's `chown -R $HOME` hazard). Mid-probe the sandbox reaped the detached server+DB (no crash in the log — last lines are this probe's own 200s); both were restarted via `setsid` and the session cookie and file survived (same data dir).

**Seam assertions, actual values** (account `jse+0823@test.local`, all POSTs with `Origin: http://localhost:5001` + `X-Forwarded-Proto: https`; NB `/api/auth/me` is a 404 — the identity route is `/api/auth/user`):

| seam | assertion | actual |
|---|---|---|
| signup → role | `POST /api/auth/register` then `GET /api/auth/user` | `role: "aspiring_owner"` ✓ (id `193643cb…`) |
| draft mint | `POST /api/loan-applications/draft` | empty draft `d63dbadb…`, status `draft` — **by design**: "no figures are accepted here — answers arrive only through the validated PATCH" (`server/routes/lending/applications.ts:318-319`) |
| draft round-trip (#667) | `PATCH /api/loan-applications/:id` with the full mid-funnel payload — `employmentType: "self_employed"`, 2 self-employed entities ("Barakat Consulting LLC" $120k/6yr; "Lakeview Design Studio LLC" $45k/3yr), 1 rental ($1,700/mo, Chicago IL), `propertyState: "IL"` — then `GET /api/loan-applications/draft/latest` | HTTP 200; **sent-vs-stored mismatches: NONE** — every field survived including the nested `incomeSources` structure |
| submit consumes the draft | `POST /api/loan-applications` (same payload + `softPullConsentAccepted: true`) | HTTP 201, **same id** `d63dbadb…` (no sibling row; list shows exactly 1), status `submitted` → `analyzing` via post-response `finalizeIntake` → later `pre_approved` (the deterministic engine; `financialDataProvenance: "self_reported"`) |
| promotion | `GET /api/auth/user` after submit | **`role: "active_buyer"`** ✓ |
| generated request set | `GET /api/loan-applications/:id/conditions` | 9 conditions incl. **all four** self-employed artifacts: 2-Year Tax Returns (Self-Employed) · YTD Profit & Loss · Business Documentation · Business Bank Statements (`server/pipelineEngine.ts:91-122`) — plus base rows; see finding candidate 1 |
| URLA carry | `GET /api/urla/:id` | `application.employmentType: "self_employed"` ✓ and `application.incomeSources`: 3 rows intact; `employmentHistory: 0` / `otherIncomeSources: 0` (URLA tables start empty); client code defaults the seq-1 self-employed checkbox + worksheet from the application (`client/src/pages/borrower/urla/EmploymentSection.tsx:196,286`) — see finding candidate 2 |
| server-side pre-uw | dev log | `[pre-uw] d63dbadb… (intake): COMPLEX_INCOME_CHECK, INCOME_SEASONING, RENTAL_INCOME_OFFSET — borrower notified` + a plain-language document-request email naming the self-employed items — **the complex-income branch is exercised server-side** |

**Public-render probes** (`scripts/browser-probe.cjs`, Chromium via `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`): `/`, `/self-employed`, `/signup`, `/calculators/affordability` × 320/768/1280 — **12/12: zero horizontal overflow, zero broken images, zero unnamed interactive elements**; sub-44px touch targets: 1–4 per page at 320 (footer links at 296×36 dominate; 32 at 1280 on `/`). The §3 door exists on `/` ("Your income is your own"); `/self-employed` promises captured verbatim: "No hard credit check", "Humans read your file — not just software", "One tap — the application adapts to how you're actually paid", "Soft credit check only — checking your options won't affect your credit score". The server half kept the adapts promise (the doc set adapted; the pre-uw flags fired); the soft-pull promise is consistent with the consent stamp the submit wrote.

**NOT WALKED** (each maps to a JOURNEYS.md §3 assertion; all need a real browser): the pre-screen → `?type=self-employed` → funnel-default seam; the `complexIncome` routing inside `preApprovalMachine.ts` as a client experiences it; the **render** halves of the document set, the URLA worksheet, and the decision surfaces ("is the borrower *shown* the four artifacts"); every funnel interaction incl. the AnimatePresence artifact the ledger warns about; the promises' keeping beyond copy ("humans review" as an experience); `/dashboard`, `/application-summary`, `/verification` as rendered. No claim above extends to any of these.

**Findings** (check-first done; adversarial verification per program rule):

- **Candidate 1 — the request set demands pay stubs from a purely self-employed borrower.** `BASE_DOCUMENT_REQUIREMENTS` unconditionally includes `pay_stub` ("Most recent 30 days of pay stubs"); `EMPLOYMENT_RULES.self_employed` adds four but nothing prunes the base by employment type — a borrower whose only declared income is two businesses and a rental is asked for a document that cannot exist for them. No prior FINDINGS row. → finding-verifier verdict: **pending at report-draft time; final disposition in FINDINGS.md and the PR body.**
- **Candidate 2 — intake → URLA: the branch's flag carries, its substance is re-asked.** The URLA pre-checks self-employment from `application.employmentType` (code path above) but nothing in `client/src/pages/borrower/urla/` reads `application.incomeSources` — the two business names/amounts/years and the rental, already captured and durable on the application row, are never pre-filled. Same family as open `J-0820-09` (URLA 1a re-asks name/email) — duplicate-vs-distinct left to the verifier. → **pending; final disposition in FINDINGS.md and the PR body.**
- Micro-observation (not filed): `/api/auth/user` projects `emailVerified` as `null` where `POST /api/auth/register` returned `false` for the same user.

### Feedback on #699 (its files; each one line)

1. FACTS/00: react is at `package.json:106` (#699 writes `:105`); `db:push` at `:30` (#699 keeps `:29`). package.json is identical between fd4a22c5 and HEAD.
2. Ch 09's four-Markdown-linters cite: truth is `package.json:37,41,42,43` (#699 writes `37,40,41,42`).
3. TEACHBACK Q07.8/Q07.2/Q10.1 keep `ci.yml:574`/`:663` while #699's own LEDGER hunk remaps the same facts to `:583`/`:672` — internally inconsistent; and Q00.7/Q03.5 carry the react/db-push off-by-ones above.
4. All three re-stamped chapters keep "Verified against @ 12d7cbec" headers while inline receipts say fd4a22c5.
5. Its LEDGER should credit `3d047ce9` (#694) with closing HO-0822-01/-06/-07/-11/-12/-18 (+ partial -15/-19, U5 answered) — see the row table above.

## Proposed tickets (for Evening Triage)

Steward first-run (all in #699's files — apply after #699 merges):
- **T1** ch 07 ×3 spots: the pre-push tooling probe is described backwards — it is WARN-never-block, checks `tsc` not vitest, exits 0 (`.githooks/pre-push:61-83`).
- **T2** ch 07 "collection shortfall (not fixed on main)" bullet + mermaid P + new-hire ¶ contradict the (post-#699) status box — #670 landed.
- **T3** ch 07 guard fleet is 15 not 14 (bullet, mermaid, prove-it, category list); "63 of 238"→239; "14 send the proto header"→15; the 18-step ci.yml line map and prove-it seds re-derived (583/656/672; name at 118).
- **T4** ch 10 traps 2–3 narrate the deploy pause as present; trap 4 was hollowed by #694 (zero grep hits; only root README :107-109 residual); Go-deeper "verify-deploy is off" and the shore-leave analogy inverted; the job-header and cite remaps (94/107/549/639; :618; :672; …).
- **T5** ch 12: blind-spot ¶ ("one right now" / "the open collection-guard PR") false post-#670; T1 row still prescribes the retired manual count check; §5a sla.test.ts is on main now; `:574`→`:583`; "four commits"→re-derive; "fourteen"→15.
- **T6** FACTS conditional: if #699's patch misses F-39 (→ empty, enforced) or F-43's command (`sed -n '583p;656p;672p'`), those rows are false at HEAD.
- **T7** ch 06/11 residual numbers (client tests 123, bundle 526640, testid ~2223, components 179, index.css/DESIGN_SYSTEM line shifts; B1 19, B15 15, A2 221, A13 116, CHARTER +16-21 shifts) — one prove-it re-run at the post-merge stamp.
- **T8** ch 09: 19-of-25 anti-autoload, 243-line CLAUDE.md, 885-line/fourteen-rail CHARTER remaps (§9 :766-775, §10 :783-846, §11 :847-851, :798), routers 26–34, the hooks-grep wording (scope to `.claude/**`), and a dated paragraph on the steward seat + the PR #697 pending-hooks note.
- **T9** headers: move all three "@ 12d7cbec" stamps on the next full pass.

New sibling-doc drift rows for the steward to open (targets outside handoff/):
- **N1** `app-guide/02-architecture.md:21,91` "39 route domains" vs measured 40 (`grep -cE "^\s*(await )?register[A-Za-z]+Routes\(app" server/routes.ts`).
- **N2** `app-guide/02-architecture.md:93` names `staff/` as a sub-registrar directory; the fourth is `agent-broker/`.
- **N3** `runbooks/CICD.md:129-131` + `app-guide/10-deploy-ops.md:154-156` still name `server/prerender.ts` as the mounted middleware (mounted symbol: `prerenderMiddleware`, `server/routes/seo.ts:187`).
- **N4** root `README.md:107-109` still says direct pushes are rejected by the required gate check (protection is empty).
- **N5** CHARTER §3a's "three cite a skill not on origin/main" paragraph — the three have landed; the two actually-broken triggers are Frontend Wiring Audit and Deliverable QA Sweep (⛔ 3 above; §3a is doc-accuracy's ⛔ lane).

Environment note for any cloud steward run: shallow clone (history-window ~72 commits — F-31 and last-N-commit stats not measurable; say so), no `gh` (F-44 carried), dependency build scripts blocked (`pnpm test` cannot execute — verify the harness statically and say SKIPPED).

STATUS: WARN
