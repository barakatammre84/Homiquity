# 12 — The loop-safe build playbook

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Verified against** `origin/main` @ 12d7cbec. The rails this chapter summarises live in
> [prompts/_RAILS.md](prompts/_RAILS.md) (read, not copied — edit them there); the report shape
> in [prompts/_REPORT_FORMAT.md](prompts/_REPORT_FORMAT.md); the eight fill-in templates and the
> invocation recipe in [prompts/](prompts/). Every tier runtime below was **measured** on the
> stamped commit on 2026-08-22 (an 8 GB laptop, load average ≈ 3, zero peer test processes); a
> runtime you did not measure is a guess.

> **Dated status box (re-verify on every refresh):** `main` requires no status checks;
> `migrate-prod` and `verify-deploy` were re-armed on 2026-08-22 (`76c96751`, #669), but
> `verify-deploy` is `continue-on-error: true` and nothing requires it, so its red blocks nothing;
> the test-collection guard **merged 2026-08-23** (`fd4a22c5`, #670), so **T1's manual count check
> is retired** — `pnpm test` now fails by itself when a lane collects fewer files than exist, or when
> any test file matches no lane's `include`; the pre-push hook still does not run the unit lanes
> unless you set `PREPUSH_TESTS=1` (`e49aab6d`, #660), so T1 is a step you run deliberately *or*
> read off CI; no node test file is stranded any more, and the zero is enforced rather than
> observed.
> **T5 stays a human step** — a machine-checked deploy that cannot fail a merge is not a gate
> (FACTS F-13, F-39, F-43, F-44).

## The premise

A loop is safe when its completion promise is tied to the harness's outputs, never to the
model's belief. Everything in this chapter is in service of that sentence. The harness is a
proof hierarchy — each tier proves one thing and is blind to the rest — so the loop contract says
which tiers must be green, in which order, before a claim may be made; the templates put the
tiers in the right place in each kind of change; and the stop conditions make "I could not
satisfy a tier" a *terminal* state rather than a reason to loosen the tier.

The repo's own history (chapter 11 §C) is why: 91 of the last 300 commits are fixes, the
commonest scope is a routine report, and the recurring failures are a test that never ran, a
deploy that never shipped, a baseline bumped to pass, and a count nobody re-derived. A loop that
cannot produce any of those four is most of the way to safe.

## 1. The harness as a proof hierarchy

| Tier | Commands (run in the worktree) | Proves | Cannot see | Measured @ 074899e3 | When in the loop |
|---|---|---|---|---|---|
| **T-1 standing** | `git fetch origin && git rev-list --count HEAD..origin/main` (must be ≤ 2); `gh pr list --state open --json number,files`; read `knowledge-base/routines/REGISTER.md` | you are fresh and unclaimed | code | seconds | every iteration start |
| **T0 static** | `pnpm check`; `for f in scripts/*.cjs; do node --check "$f" \|\| exit 1; done`; `pnpm guard:schema && pnpm guard:migrations && pnpm guard:channel && pnpm guard:kb && pnpm guard:staleness && pnpm guard:citations && pnpm guard:querykeys && pnpm guard:tokens && pnpm guard:ui` | types; the guard scripts parse; the ratchets did not regress; the migration ledger is intact | runtime; classNames built by `cn()`/templates (the UI guards read literal strings); `guard:tokens` and `guard:ui` rewrite their baseline on a shrink | `tsc` **57 s** on the first run (cold cache, six evidence agents grepping in parallel) and **5–9 s** warm · `node --check` 1 s · nine guards **13 s**, tree clean afterwards | after every edit |
| **T1 unit** | `pnpm test > "$SCRATCH/t1.log" 2>&1` (never `\| tail`); then the **collection sanity check**: the node lane's `Test Files … (N)` must equal `grep -cE '^\s*"tests/' vitest.config.ts`, the client lane's must equal `git ls-files 'client/src/**/*.test.ts' 'client/src/**/*.test.tsx' \| wc -l`; and your new test's file name must appear in the log | in-process logic, the 63 source-text invariants, components in happy-dom | HTTP, the database, layout; a stranded or silently truncated collection (the reason for the equality checks); timeouts under load read as failures | **139 s** wall — node lane 218/218 files, 3,156 tests, 83 s; client lane 120/120 files, 808 tests, 51 s | after T0 |
| **T2 `pnpm preflight --fast`** | needs ≥ 1 commit on the branch, else the §9 stage reports SKIPPED | T0 + T1 + `pnpm audit --prod --audit-level=high` + the §9 security-review guard **exactly as CI computes it** (merge-base diff) | build, boot and the integration lane — reported SKIPPED, which is neither a pass nor a fail | **142 s** wall on the second run (`tsc` 5 s warm, unit lanes ≈ 2 min); 13 stages `ok`, 4 `SKIPPED — --fast`; its closing block lists what it cannot see even when green | before every push |
| **T3 `pnpm preflight`** | `bash scripts/local-db.sh up` first if no Postgres answers (needs `pg_ctl` or Docker; neither was present on the measuring machine) | + `pnpm build` + `guard:bundle` + a production-mode boot on 3999 answering `/api/health` + the 18-file integration lane on 4000 | production data shape; anything outside the 18 files; `/api/health` is `SELECT 1`; `guard:bundle` rewrites its baseline on a shrink | **204 s** wall with the database stages skipped: 16 stages `ok` including `production build` and `client bundle ratchet`; `self-host boot` and `integration lane` reported `SKIPPED — no database — run: bash scripts/local-db.sh up` (this laptop has neither `pg_ctl` nor Docker); tree clean afterwards | before opening the PR; after every rebase |
| **T4 browser** | `PORT=5002 pnpm dev` **inside the worktree** (prove it: `lsof -a -p <pid> -d cwd`); `node scripts/browser-probe.cjs --url http://localhost:5002/<route> --width 320` (and 768, 1280); the `journey-walker-*` / `workflow-verifier` agents, findings only | real render at three widths, end-to-end wiring | contrast and full a11y; anything `browser-probe.cjs` does not check; agents are snapshotted at session start | not measured (needs the database for a server) | UI or workflow changes; evidence = pasted probe output |
| **T5 post-merge** | `curl -s https://homiquity-production.up.railway.app/api/health \| jq -r .commit` must equal the merge SHA. `verify-deploy` now polls this for you on every push (`ci.yml:656`) — but it is `continue-on-error` and unrequired, so read its result rather than assuming a green workflow means it passed. A migration rides along automatically again (`migrate-prod`, `:574`); confirm `applied N migration(s)` in that job's log | prod runs the merge; the migration landed | a commit match is not a schema match — the 2026-08-22 outage served the right commit against the wrong database for 35 minutes; 200 is not the right database | — | never by the loop — it writes these commands into the PR body |

The same table without the measurements is R14 in `prompts/_RAILS.md` — the loop reads only that
file, so the copy is deliberate and the rails file is the one to edit.

The Tier Rule, in one line: **the completion promise may be written only when the LOOP REPORT
cites T0–T3 summary lines copied from the output files, plus T4 output when UI changed. Belief
is not a tier.**

What each blind spot costs, from the record: a stranded test (`vitest.config.ts:140-141`, and one
right now); a collection that dropped 36 of 118 files with no signal (the open collection-guard
PR); a guard that could not run and whose silence read as CLEAN (`ci.yml:450-449`); nine
consecutive failed deploys behind a green check (`CICD.md:221-226`); a 35-minute auth outage from
a migration the paused applier never ran — during which `verify-deploy`, had it been on, would have
been **green throughout**, because it compares commits and can never see a schema mismatch. Every
one is a tier that was skipped, trusted, or asked a question adjacent to the one that mattered.

## 2. The loop contract

The fifteen rails are in [prompts/_RAILS.md](prompts/_RAILS.md); this is the map of why each
exists, so a reader can argue with it.

| Rail | One line | The pattern or incident behind it |
|---|---|---|
| R0 where you are | a throwaway worktree, installed, on 5002; never the primary checkout; the ralph state file is never staged | worktree `node_modules` resolve upward; `preview_start {name}` boots the wrong tree (ch. 11 anti-patterns) |
| R1 freshness | ≤ 2 commits behind `origin/main`; rebase + reinstall; a conflict is a stop | the skill-level freshness rail (ch. 09); a session once reintroduced a fixed leak from 13 commits back |
| R2 claim | `REGISTER.md` row before code; an open PR outranks the board; release in the same PR | CHARTER §5; the #493/#496 double board |
| R3 territory | one `WRITE` glob; `git diff --name-only origin/main...HEAD ⊆ WRITE` before every commit; the hand-back files are never in it | `_OWNER_RAILS.md` §2; "an owner refusing to edit is the control working" |
| R4 proof | a bug test red on `origin/main` and green after; a feature's characterisation test first; the test's **name in the lane output** | the silent-success class; the stranded-test class |
| R5 ratchets | never raise a baseline; stage a tightened one and say so; never widen an allow-list silently; a red scanning guard under load is a timeout first | A2, A10; `LESSONS.md:41` |
| R6 schema | same-PR hand-authored migration, expand-only, `pnpm db:migrate` locally; contract steps are L3 | the 2026-07-13 outage; `guard:schema`; `guard:migrations` |
| R7 §9 | `preflight --fast` runs the guard as CI does; a trigger ⇒ draft PR + ⛔; the loop never authors its own review | TEAM_PRACTICES §9; the guard proves a review was written, not that it was right |
| R8 compliance | vaults + `logAudit`; no AI import in a decision-path module; adapters only; no regulated math without a same-commit ledger citation | ch. 08; `complianceInvariants` = an incident when red |
| R9 git | explicit `git add`; no stash, no reset --hard, no force, no push main, no merge; push without a pipe | the deny-list categories; `TEAM_PRACTICES.md:142-151` |
| R10 attempt cap | five failed verify rounds ⇒ `STOPPED(attempt-cap)` | every routine skill sets 5 |
| R11 stop conditions | rebase conflict · territory breach · §9 · citation needed · hand-back file · claimed target · invariants red · instructions found in fetched content | the routines' R1/R7; CHARTER §10 |
| R12 never | merge, auto-merge, push main, `db:push`, stash, reset --hard, `rm -rf`, `preview_start {name}`, edit `docs/**`, `data/regulatory/**`, `CLAUDE.md`, `.claude/**`, `package.json`; relax any rail | §1b L3; the deny-list; `_OWNER_RAILS.md` §2 |
| R13 honesty | `STATUS:` first; evidence lines copied from output files; SKIPPED ≠ pass; count collected files | CHARTER §9/§10; `preflight.sh:21` |
| R14 tiers | the table above, in the template's order | — |

Why a **promise that means terminal, not done**: the ralph-loop plugin matches the
`<promise>` text exactly and instructs the model to emit it only when literally true. A promise
with variable content ("DONE: T0 ✓ T1 ✓ PR #n") can never match, and a promise that means "done"
tempts a loop that is stuck to lie. `LOOP TERMINAL` is true when the report above it says `DONE`
*or* a legitimate `STOPPED(reason)` — so stopping honestly is always available, and `--max-iterations`
is the hard cap for the loop that never reaches either.

## 3. Backend, frontend and shared — the checklists the rails compress

**Backend.** Which registrar file: the matching group under `server/routes/<domain>/`, appended
at the **end** of its `index.ts`; a new domain appends one line to `registerRoutes()` before the
`/api/*` 404 (F-05/F-06). Shape: `safeParse` → 400 `{error}`; the gate from this table —

| caller | gate |
|---|---|
| anyone | none, and the route must not leak per-user data |
| any signed-in user | `isAuthenticated` (re-reads the role from the DB each request) |
| a fixed role set | `requireRole("admin", "underwriter", …)` |
| the application's owner or its deal team | `storage.getLoanApplicationWithAccess(id, user.id, user.role)` |
| internal staff including the file's LO | `verifyInternalStaffApplicationAccess(storage, id, user.id, user.role)` |
| a cron job | `Authorization: Bearer <CRON_SECRET>` via `isCronRequest` |
| a vendor webhook | under `/api/webhooks/` + the vendor's own signature check |

— then the storage method in the matching `server/storage/<domain>.ts` class; `inArray` batches;
`db.transaction` for a multi-table write; status only via `updatePipelineStage`; `logAudit(req,
"<entity>.<verb>", …)` on every mutation; PII through the vaults; never extend
`RESPONSE_BODY_LOG_ALLOWLIST` without §9; a vendor through the `server/mcp/vendors.ts` template; a
job through `/api/jobs/<name>` + `.github/workflows/cron-jobs.yml` + `tests/cronSchedules.test.ts`.
Tests: pure logic → `tests/<name>.test.ts` + the allowlist (END); rule-shaped → a source-text test;
HTTP → the integration config with `X-Forwarded-Proto: https`, `Origin`, `/api/test-login` with
`<role>@test.com` / `DEV_TEST_PASSWORD`, a per-file session cache, the server booted with
`RATE_LIMIT_RELAXED=true`. A new env var lands in `.env.example` **and** `CICD.md`. A schema change obliges, in the same
PR: the FACTS rows it moves (F-01 for a table, F-37 for a foreign key), the feature-map row if
ownership moves, and [app-guide 03](../handbook/app-guide/03-database.md)'s domain table if a
table is added — otherwise the PR body's doc-sync line says "no doc update required" and why.

**Frontend.** A `lazy()` `Route` in `client/src/App.tsx` in the right `Switch` position (first
match wins), inside a layout, wrapped by a gate from `client/src/lib/routeGates.ts`; public pages
add a `shared/seo/routeMeta.ts` entry identical to the page's `SEOHead`, free of Reg Z trigger
terms and Reg N approval language. Query keys only from the factories in `client/src/lib/queryClient.ts`,
invalidated through the same factory (element-wise matching); the default `queryFn`, or
`getPublicQueryFn` for signed-out surfaces; a new background poll joins the 401 allow-list.
`useAuthGuard`'s five states (degraded never navigates). `PageShell`, tokens only, icons from
`client/src/lib/icons.ts`, `data-testid` in kebab-case, `aria-label` on icon-only controls, ≥ 44 px
targets. Forms: react-hook-form + a shared zod schema + the resolver. A colocated `*.test.tsx`
under the client glob — never `vitest run <file>` without `--config vitest.client.config.ts`. No
value import of `@shared/schema`; `guard:bundle` after a build; `browser-probe.cjs` at 320 for
anything a borrower types into.

**Shared.** `shared/` is the only crossing between client and server; `shared/lib/amortization.ts`
is the one payment formula (its percent and fraction entry points are separate on purpose — mixing
them is a silent 100× error); runtime vocabularies are table-free modules; any `shared/schema/**`
change is R6.

## 4. The templates, and how to run one

| Template | Use it for | Its WRITE territory | Its proof |
|---|---|---|---|
| [new-test.md](prompts/new-test.md) | the first loop you ever run; a characterisation or regression test | one test file (+ the allowlist line for the node lane) | the file name appears in the lane output |
| [bug-fix.md](prompts/bug-fix.md) | one defect with a reproducible input | the owning source file(s) + a test | red on `origin/main`, green after |
| [feature.md](prompts/feature.md) | one seam in one layer | the layer's files + tests | neighbours' characterisation test green before and after; the feature test red → green |
| [refactor.md](prompts/refactor.md) | a behaviour-preserving move | the moved files + every importer | tests green before and after; guards unchanged or lower |
| [schema-migration.md](prompts/schema-migration.md) | a new nullable column and the one path that uses it | schema + SQL + journal + storage + route + test | a test that proves the column is read or written |
| [new-route.md](prompts/new-route.md) | one endpoint | the group file (+ storage) + an integration test | the happy path **and** the denied paths (401, 403, other-borrower) |
| [ui-page.md](prompts/ui-page.md) | one page or component | the page, its Route, a key factory if new, routeMeta, a colocated test | the test + a pasted `browser-probe` at 320 |
| [doc-update.md](prompts/doc-update.md) | a fact that moved | the doc (+ one index line) | the four doc guards + link resolution |

Invocation (full recipe in [prompts/INVOKE.md](prompts/INVOKE.md)):

```
/ralph-loop Follow knowledge-base/handoff/prompts/<template>.md exactly. TASK="<one sentence>" WRITE="<paths>" PROOF="<test file>" SCRATCH="$HOME/hq-scratch/<slug>" --completion-promise "LOOP TERMINAL" --max-iterations <MAX_ITER>
```

Use `/loop` only to poll (`gh pr checks <n>` on an interval) and a plain session for anything a
loop must stop on: a hand-back file, a §9 trigger, a contract migration, a design decision, a
multi-layer feature that needs a plan first, anything in CHARTER §1b rows L3/L4.

## 5. Worked examples

### 5a. The acceptance run (real): a characterisation test for `client/src/lib/sla.ts`

The target was chosen by the rails, not by taste: a pure module with no test, imported by five
staff surfaces, named in **no** open PR, and testable under the client glob so no shared-file
hazard (`vitest.config.ts` was touched by seven open PRs that day) was involved. The loop ran as a
headless `claude -p` session in a throwaway worktree of `origin/main`, with the plugin's own
setup script (setup-ralph-loop.sh, outside the repo) writing the state file and its Stop hook driving the iterations; the
destructive-operation categories were passed as disallowed tools. 83 turns, 22.5 minutes. The
lines below are copied from its logs and its LOOP REPORT; the PR number lives only in the
ledger's run log. **The counts in this table are the run's, not today's** — it executed at
`074899e3`, when the allowlist held 218 entries and 120 client tests were tracked; four commits
have landed since (221 / 123). Do not read them as current facts; read them as what the harness
printed on the day, which is the point of recording a run at all.

| step | what happened | copied from the logs |
|---|---|---|
| T-1 | toplevel, clean tree, `git fetch`, commits-behind = 0, `vitest` present, open-PR file lists read, REGISTER read; target claimed by nobody | (the template's step 0, verbatim) |
| read | the module, its five importers, a sibling test for house style, and `design-token-guard.cjs` — so the "no raw palette class" assertion pinned the guard's real regex rather than a guess | — |
| write | the colocated test beside the module (client/src/lib/sla.test.ts — on the loop's branch, not on main, hence no backticks) — 16 cases, the only file in WRITE | `?? client/src/lib/sla.test.ts` |
| T0 | green; no baseline rewritten | `tsc exit 0 · schema ✓ migrations ✓ channel ✓ kb ✓ staleness ✓ citations ✓ querykeys ✓ tokens ✓ ui ✓ (518 files scanned)` |
| T1 | green; the collection check passed with the new file counted | `Test Files 218 passed (218)` · `Test Files 121 passed (121)` — node 218 == the allowlist, client 121 == 120 tracked + this file; `vitest list --filesOnly` line 34 of 121 = the new file |
| commit 1 | explicit `git add` of the one file; the ralph state file left untracked | `test(sla): pin the four SLA status maps before anything else edits them` |
| T2, first run | **red** — the UI standard ratchet, with every metric at baseline: "DESIGN_SYSTEM.md §0's adoption table is stale … Run `pnpm guard:ui --write-table` and commit the result in this PR" | `FAIL  UI standard ratchet` |
| diagnosis | it proved the cause instead of guessing: a detached worktree of `origin/main` scans green, the branch scans red, the test file is the only other change; `scripts/ui-standard-guard.cjs:337` counts client `*.test.*` files into the generated table's denominator | `origin/main`: `UI standard OK` · branch: `FAIL` |
| commit 2 | `pnpm guard:ui --write-table`, staged as its own commit — **outside the template's WRITE list**, on the guard's explicit instruction; flagged in the report, the PR body and the hand-back rather than absorbed | `chore(design-system): regenerate the §0 table for the new client test file` (`120 → 121`) |
| T2, second run | green, §9 no trigger | `preflight passed, 4 skipped` · `ok security review (§9 triggers)` |
| T3 | green; the two database stages honestly skipped (no `pg_ctl`, no Docker; `scripts/local-db.sh up` needs a permission a headless session cannot grant) | `preflight passed, 2 skipped` · `ok production build` · `ok client bundle ratchet` · `SKIPPED integration lane — no database` |
| push + PR | pushed without a pipe, remote ref confirmed equal to HEAD, draft PR opened with the mandatory headings; exactly two files | `draft: true, files: [client/src/lib/sla.test.ts, knowledge-base/handbook/design/DESIGN_SYSTEM.md]` |
| report | `STATUS: DONE` · `TERRITORY: … ⊆ WRITE: no` (stated, with the reason) · `BASELINES TIGHTENED: none` · `SKIPPED:` named and explained · `HAND-BACK:` the template's client-lane WRITE list is incomplete, owner "whoever maintains the handoff prompts" | the report block, verbatim |
| the promise | the first final message ended with commentary and **no** `<promise>` tag — the Stop hook refused the exit and re-fed the prompt ("Ralph iteration 2 … iteration 3"); the next pass said "I omitted the completion promise — that's what the loop was waiting on", re-emitted the block with the promise as its last line, and the session ended | `exit=0 · num_turns 83 · promise emitted: true · state file removed by the hook` |

What the run changed in this corpus, in the same PR: R5 now names a guard-mandated generated
block as a sanctioned write (the `§0` table, `pnpm guard:ui --write-table`, its own commit, named in
the body); `new-test.md`, `ui-page.md` and `feature.md` inherit it; `_REPORT_FORMAT.md` now says the
promise is the **last line of the final message, after any prose**; and the ledger carries the
denominator as a proposed ticket for the guard's owner. What the run proved that no dry-run
could: the plugin's iteration mechanic, the exact-match promise, the hook removing the state
file on completion, a loop that stops on a red guard and proves the cause before acting, and a
territory deviation surfacing as an honest `no` rather than a quiet edit.

### 5b. The sketch (not run): HOA dues through the URLA property step into the engine

A real seam: `hoa_fees` exists only on `loan_options` (`shared/schema/lendingCore.ts:348`),
`urla_property_info` (`shared/schema/lendingUrla.ts:403-433`) has no HOA column, and the engine's
DTI (`server/underwritingEngine.ts:323`) never sees it. Three loops, and the point of the example
is where the third one **stops**:

1. `schema-migration.md` — iteration 1 adds the column and a test; `guard:schema` fails (the
   column name is quoted in no migration); iteration 2 authors the SQL + journal entry;
   `guard:migrations` fails on a copy-pasted `when`; iteration 3 passes T0/T1/T2, and T3's
   integration test 403s because the new test sent no `Origin`; iteration 4 is green → `DONE`, PR
   opened as a draft with the ⛔ "dispatch `migrate-prod` after merge" line. Two open PRs touch the
   same files today, so a real run would in fact have ended at T-1 with `STOPPED(claimed)` — which
   is the correct outcome.
2. `ui-page.md` — the URLA property step gains one input (the ≤ 3-inputs rule), a colocated test,
   a `browser-probe` at 320 pasted → `DONE`.
3. `feature.md` — iteration 1 finds the only fix is inside `server/underwritingEngine.ts` (a
   hand-back file) **and** that adding HOA to the housing-expense composition is regulated math
   needing a Selling Guide citation the loop cannot mint → `STATUS: STOPPED(off-limits + ledger-citation needed)`
   with a hand-back naming the line, the change, and the citation left blank. A human picks it up
   in a plain session. The promise is emitted — the loop reached a terminal state honestly.

## 6. Harness gaps → proposed tickets (ranked by value ÷ effort; none implemented here)

1. **Re-arm the required `gate` check on `main`** (`contexts: []` today; the verbatim name with
   U+00B7 separators; `strict: true`). A founder click; highest value. ⛔
2. ~~**Land the re-arm of `migrate-prod` and `verify-deploy`**~~ — **DONE** 2026-08-22, `76c96751`
   (#669). LEDGER HO-0822-14 closed. **The successor ticket is smaller and still open:** nothing
   makes `verify-deploy`'s red matter. It is `continue-on-error: true` on purpose (`ci.yml:672` —
   it and Railway's "Wait for CI" deadlock otherwise), so the only way its finding becomes a block
   is ticket 1. Until then T5 stays a human read. ⛔
3. ~~**Land the test-collection guard**~~ — **DONE 2026-08-23**, `fd4a22c5` (#670).
   `scripts/test-collection-guard.cjs` is `package.json:15`; T1's manual count check is retired.
   It did need the rebase this ticket predicted (HO-0822-U6): #660 had rewritten the same hook block
   into a `PREPUSH_TESTS` conditional, which #670 adopted verbatim rather than reverting.
4. **Run the integration lane in the CI gate.** The `postgres:16` service already exists for the
   boot probe (`ci.yml:172-181`); boot `dist/index.js` in dev mode on 4000 with
   `RATE_LIMIT_RELAXED=true` and run `pnpm test:integration` (+2–3 min). Owner `hq-ci-guards-owner`.
   Resolves HO-0822-U2.
5. ~~**A stranded-test guard**~~ — **DONE 2026-08-23**, `fd4a22c5` (#670). The orphan floor in
   `scripts/test-collection-guard.cjs` fails when `git ls-files` minus every lane's include is
   non-empty; `tests/maintenanceMode.test.ts` was appended in the same PR (HO-0822-23 closed).
6. **A seventh ledger check**: duplicate `when` in `migrations/meta/_journal.json` (HO-0822-24) —
   the one mistake that makes `migrate-prod` skip a migration silently.
7. **Shared test helpers** — a `loginAs` and an HTTP helper under a new tests/helpers/ directory
   (proposed, so not backticked): nine files define `loginAs`, fourteen hand-roll the headers; the
   commonest integration-test authoring error disappears.
8. **Bring pre-push and preflight to parity with the gate**: add `guard:citations` and the two
   missing query-key scripts (today they run one of three).
9. **A source-text test that no decision-path module calls `tryResolveMatrixValue`** (HO-0822-U8).
10. **A `routeMeta` ↔ `SEOHead` contract test** — the hand-mirror has no guard (ch. 06).
11. **`pnpm harness:t0|t1|t2|t3` aliases** so the playbook cites one token per tier
   (`package.json` is founder territory).
12. **Ignore the ralph state file** — .claude/ralph-loop.local.md (untracked by design, hence no
   backticks) is not gitignored today.
13. **A scheduled persona smoke** via the journey walkers, report-only, in the cloud fleet.
14. **Assign owners** to `server/routes.ts`, `server/db.ts`, `server/index-prod.ts`,
   `railway.json`, `scripts/migrate-prod.cjs`, `.github/workflows/ci.yml` (HO-0822-13).
15. **Stop counting test files in the §0 adoption denominator** (`scripts/ui-standard-guard.cjs:337`)
   — or accept that every client test regenerates `DESIGN_SYSTEM.md`; today the acceptance run had
   to commit a generated line to add one test (HO-0822-25).

## 7. How this playbook stays true

Every command here appears once, in the tier table or the rails, and the refresh re-runs them:
the facts it depends on are FACTS **F-05, F-06, F-13, F-14, F-15, F-16, F-17, F-36, F-39, F-40,
F-43, F-44** plus the measured runtimes, the ports (5001 / 5002 / 3999 / 4000), the test accounts,
the plugin path and version (`~/.claude/plugins/cache/claude-plugins-official/ralph-loop/1.0.0`),
and the status of the three open PRs named only by subject in the status box. When a value moves,
the chapter moves with it in the same commit; when a rail moves, it moves in `prompts/_RAILS.md`
and nowhere else.

## Teach-back checkpoint

1. Why is the completion promise a constant that means *terminal* rather than *done*?
2. T1 prints `Test Files 214 passed (215)`. What does the loop do next, and why?
3. Your loop's only fix is inside `server/services/lookupResolver.ts`. What is the correct terminal state?
4. Name the two tiers that do not run automatically today and what a human does instead.
5. A guard tightened a baseline during T0. What does the loop commit, and what must it never do?
6. Which template do you reach for first on a codebase you have never touched, and why that one?

## Go deeper

[prompts/_RAILS.md](prompts/_RAILS.md) · [prompts/_REPORT_FORMAT.md](prompts/_REPORT_FORMAT.md) ·
[prompts/INVOKE.md](prompts/INVOKE.md) · chapter 07 (what each lane proves) · chapter 09 (the
rails' ancestry) · chapter 11 (the patterns the rails compress) · `knowledge-base/governance/TEAM_PRACTICES.md`
§5 (the definition of done every template's PR body must satisfy) · `knowledge-base/routines/CHARTER.md`
§1b (what a loop may decide alone).
