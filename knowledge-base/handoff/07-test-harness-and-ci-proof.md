# 07 — Test harness and the CI proof hierarchy

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Verified against** `origin/main` @ 6377727e · **Authoritative:** `../runbooks/CICD.md` §Checks, `../governance/TEAM_PRACTICES.md` §5 and `vitest.config.ts`'s own header (they win on conflict; the code wins over both).

> **Dated status box (re-verify on every refresh):** at `6377727e` `main` requires **no** status
> checks (measured 2026-08-22: `gh api …/branches/main/protection` → `contexts: []`, rulesets `0`;
> `gh` was unavailable in the 2026-08-23 refresh sandbox — re-measure where it exists); `migrate-prod` and
> `verify-deploy` were **re-armed on 2026-08-22** by `76c96751` (#669) after a two-day pause, but
> `verify-deploy` carries `continue-on-error: true` on purpose, so it reddens without failing the
> workflow (chapter 10); the test-collection guard **merged 2026-08-23** (`fd4a22c5`, #670) and
> `pnpm test` is now `scripts/test-collection-guard.cjs`, which fails when vitest collects fewer
> files than exist and when any test file matches no lane's `include`; the pre-push hook stopped
> running the unit lanes by default on 2026-08-22 (`e49aab6d`, #660 — `PREPUSH_TESTS=1` opts back
> in), so **CI is where that floor binds**; and the previously stranded `tests/maintenanceMode.test.ts`
> is listed — the strand count is now zero *and enforced*, not merely observed.

## The mental model

Four proof lanes — `tsc`, the node allowlist, the client glob, the integration lane — of which
three run in CI and the fourth never does; above them the browser probe is run by nothing and
the deploy verifier is switched off. The PR gate is the merge proof, `preflight` is the ship
proof, and `complianceInvariants` reads the source as text, so a failure there is an incident,
not a flake.

## Explain it to a new hire

`pnpm test` runs two vitest configs back to back: the **node** lane, whose `include` is a
hand-maintained allowlist of 221 entries in `vitest.config.ts` — an unlisted test file is silently
never run, which is why the guard's orphan floor now fails the build rather than trusting the list —
and the **client** lane, whose `include` is a
glob on purpose so a colocated `*.test.tsx` cannot be *forgotten* — but the glob does not make it
safe: `CICD.md` used to say such a file "can never be silently stranded", and that is false. Vitest
crawls via `tinyglobby` → `fdir`, which defaults `suppressErrors: true`, so a directory whose
`readdir` FAILED is indistinguishable from an empty one; under load `pnpm test` collected 111 of 118
client files and exited 0. A glob protects against a file being *forgotten*, not against the crawl
being *truncated* (#670 corrected the CICD.md sentence and added the floor). A third config,
`vitest.integration.config.ts`, lists 18 files that hit a *running* HTTP server over the network
and never runs in CI at all — `CICD.md` says so explicitly, and `scripts/preflight.sh` is the only
thing that runs it. CI's one gate job is `gate (typecheck · tests · schema guard)` — those
separators are U+00B7 middle dots, matched byte-for-byte by branch protection — with 18 named
steps, fronted by a fail-closed "change scope" step that skips the expensive half when every
changed file is inert prose, and closed by a production build plus a boot of `dist/index.js`
against a disposable Postgres that must answer 200 from `/api/health`. Below CI sits
`.githooks/pre-push` (typecheck + eight guards + `pnpm test`, and it now *blocks* when `vitest` is
missing, since a PR once went up from a fresh worktree with zero checks), and above it
`scripts/preflight.sh` (18 steps including the build, the boot and the integration lane) and
`scripts/checkup.sh` (18 read-only checks plus a live prod probe). The caveat that outranks all of
it: branch protection on `main` currently requires nothing, so a green gate is advisory until it
is re-armed.

## Mechanism

```mermaid
flowchart TD
  A["pnpm check - tsc, noEmit via tsconfig - types line up; blind to runtime, bundling, wiring"]
  A --> B["vitest.config.ts - node lane - 221-entry ALLOWLIST, placeholder DATABASE_URL, 45s hang detector"]
  B --> C["vitest.client.config.ts - GLOB client/src/**/*.test.{ts,tsx} - happy-dom, no layout engine"]
  C --> D["14 scripts/*-guard.cjs against 7 baselines - text scans; counts may only go down"]
  D --> E["pnpm build - vite + esbuild - it bundles"]
  E --> F["boot dist/index.js vs a disposable Postgres, NODE_ENV=production, PORT 3999 - it boots and serves /api/health 200"]
  F --> G["vitest.integration.config.ts - 18 files over real HTTP - needs a RUNNING server - NEVER in CI"]
  G --> H["verify-deploy - poll prod /api/health, compare commit with github.sha - live, continue-on-error"]
  P[".githooks/pre-push - tsc + 8 guards + pnpm test"] -. covers .-> A
  P -. covers .-> B
  P -. covers .-> D
  Q["scripts/preflight.sh - 18 steps, ~3 min - SKIPPED is a third state"] -. covers .-> A
  Q -. covers .-> D
  Q -. covers .-> F
  Q -. covers .-> G
  R["CI gate - 18 named steps - pull_request only"] -. covers .-> A
  R -. covers .-> D
  R -. covers .-> F
  S["scripts/checkup.sh - 18 checks + live prod probe"] -. covers .-> E
  T["branch protection: contexts empty, strict false"] -. "nothing is required" .-> R
```

## The facts, with receipts

- **The node lane.** `vitest.config.ts:30-300` `include: [ … ]` — `grep -cE '^\s*"tests/' vitest.config.ts`
  → `219`; `:25-26` `testTimeout: 45000`, `hookTimeout: 60000` ("TIMEOUTS ARE A HANG DETECTOR HERE,
  NOT A PERFORMANCE ASSERTION", `:8`; the suite runs 172 s idle and 305–419 s under load, `:11-12`);
  `:304-308` a placeholder `DATABASE_URL` keeps it hermetic; `:261-266` new entries are appended at
  the **END** ("#440 and #443 both went stale without merging because every concurrent PR inserted
  its entry just after `tests/accessControl.test.ts`… an unlisted test file is silently never run").
- **The client lane.** `vitest.client.config.ts:37` `include: ["client/src/**/*.test.{ts,tsx}"]`
  ("a GLOB on purpose", `:11-13`); `:18` `environment: "happy-dom"`; the `@assets` alias (`:47`)
  exists because without it a component test "reports '0 tests' rather than a failure" (`:44-46`).
  `git ls-files 'client/src/**/*.test.ts' 'client/src/**/*.test.tsx' | wc -l` → `123`.
- **The integration lane.** `vitest.integration.config.ts:15-34` — 18 files
  (`grep -cE '^\s*"tests/'` → `18`); `tests/setup.ts:1` `BASE_URL = TEST_BASE_URL || "http://localhost:5000"`;
  tighter timeouts than the unit lane (15 s / 30 s, `:13-14`). Every request sends
  `X-Forwarded-Proto: https` + `Origin` (`tests/roleSeparation.test.ts:31`), logs in through
  `POST /api/test-login` with a **per-file session cache of promises** because hammering the login
  route trips the auth limiter even under `RATE_LIMIT_RELAXED` (`:33-36`). Nine files define their
  own `loginAs`; 14 send the proto header. `knowledge-base/runbooks/CICD.md:357-361`: "The
  integration suite … never runs in CI: a green gate proves the change typechecks, breaks no unit or
  component test, and produces a bundle that boots and answers `/api/health` — nothing more."
- **Counts that must agree — and now a guard makes them.** `git ls-files 'tests/*.test.ts' | wc -l`
  → `239`; 221 + 18 = 239 configured; `comm -23 <(git ls-files 'tests/*.test.ts'|sort) <(grep -ohE '"tests/[^"]+\.test\.ts"' vitest.config.ts vitest.integration.config.ts|tr -d '"'|sort -u)`
  → *empty*. Until `fd4a22c5` this identity was a thing you checked by hand and nobody did;
  `scripts/test-collection-guard.cjs` now fails the build on any non-empty result. The config
  records the precedent for why that matters:
  `vitest.config.ts:140-141` — `changeOfCircumstance.test.ts` "Was in NEITHER config since it
  landed, so its 10 assertions had never run (same class as F-013's maintenanceMode.test.ts)".
- **Source-text tests.** `grep -lE 'readFileSync\(' tests/*.test.ts | wc -l` → `63` (26% of the
  node suite asserts on source text, not behaviour). `tests/complianceInvariants.test.ts` (691
  lines, 16 describes, 54 its): `:16` "If one of these fails, treat it as a compliance incident,
  not a flaky test"; the Reg B check is a grep of 8 decision-path modules for 6 AI import patterns
  (`:34-53`).
- **The harness helpers are thin by design.** `tests/setup.ts` exports `BASE_URL`, `apiGet`,
  `apiPost`, `apiPatch`, `apiDelete`, `fetchPage` — no app factory, no DB fixture, no shared login.
- **The gate job.** `.github/workflows/ci.yml:118` `name: gate (typecheck · tests · schema guard)`
  (`od -tx1` shows `c2 b7` = U+00B7; rename procedure at `:101-110`); triggers `:47-94` —
  `pull_request` with **no `branches:` filter** (a filter once gave stacked PRs zero check-runs while
  reporting `CLEAN`, `:51-62`), `types: [opened, synchronize, reopened, edited, ready_for_review]`
  (`edited` because `guard:security` reads the PR body from the event payload, `:78-82`),
  `push: [main]`, `workflow_dispatch`. `if:` skips drafts and title-only edits (`:135-140`);
  concurrency cancels in-progress per PR and is safe only because of that `if:` (`:148-163`). The
  `postgres:16` service is for the boot probe only (`:166-169`).
- **The 18 gate steps, in order** (`grep -n '^      - name:' .github/workflows/ci.yml`): change
  scope (`:196`) → typecheck (`:254`) → unit tests (`:257`) → `pnpm audit --prod --audit-level=high`
  (`:260`) → `guard:schema` (`:268`) → `guard:migrations` (`:271`) → `guard:channel` (`:282`) →
  `guard:tokens` (`:292`) → `guard:ui` (`:303`) → `guard:kb` (`:316`) → `guard:staleness` (`:326`) →
  `guard:citations` (`:339`) → `guard:security` (`:351`, PR body via env, diff from the merge-base —
  two dots was F-0818-16, `:66-71`) → `guard:querykeys` (`:407`) → guard scripts parse (`:431` —
  added after a backtick inside `browser-probe.cjs` made every probe crash and a sweep read the
  stack trace as CLEAN, `:434-440`) → production build (`:449`) → `guard:bundle` (`:468`) →
  self-host boot (`:494`, `PORT=3999`, poll `/api/health` 45 × 1 s). Six doc-side steps run even on
  a docs-only PR (`:204-208`); the change-scope step fails closed (`:210-213`).
- **Pre-push.** `.githooks/pre-push` — `grep -c '^step ' .githooks/pre-push` → `9`: typecheck
  (`:104`) then the eight guards (`:110-117`). **The unit lanes are no longer among them.** As of
  `e49aab6d` (#660, 2026-08-22) `pnpm test` runs from the hook only under `PREPUSH_TESTS=1`
  (`:122-126`); the default branch prints `skipped — CI runs them`. The stated reason is capacity,
  not confidence: "both lanes cost ~1-2 GB and every core for minutes, which on a shared 8 GB laptop
  is what makes the machine swap, and CI runs them on every PR regardless" (`:118-121`). **What this
  changes for you:** a push now costs ~25 s instead of ~2 min, and a broken test reaches CI before it
  reaches you — so T1 is a step you run deliberately, not one the hook runs for you. The tooling
  probe still **blocks** when `node_modules/.bin/vitest` is missing (`:64-81`; reversed from
  warn-only on 2026-08-19 after "PR #608 went up from a fresh worktree with zero checks of any
  kind", `:57-62`) — which is now the hook's only remaining connection to the test lanes. It names
  its own blind spots (`:137-141`): no build, no boot, no integration lane.
- **Preflight.** `scripts/preflight.sh` — `grep -c 'step "' scripts/preflight.sh` → `18` (its
  header says "sixteen"); stages `:79-188`: pre-push armed → tsc → the eight guards → guard-scripts
  parse → query-key → §9 security review (only when `origin/main` is fetched, else SKIPPED) → unit
  tests → `pnpm audit` → build → bundle ratchet → self-host boot (`BOOT_PORT 3999`) → integration
  lane (`INT_PORT 4000`, **dev mode on the production bundle** because `/api/test-login` 404s in
  production, `:177-181`). `--fast` skips build/bundle/boot/integration; `--no-db` skips the two DB
  stages; **SKIPPED is a third state that neither passes nor fails** (`:21`, `:63-65`, `:212-215`);
  every run prints what it cannot see (`:197-205`).
- **Checkup.** `scripts/checkup.sh` — `grep -c '^check "' scripts/checkup.sh` → `18`, including
  citations, regulatory-ledger freshness, living-doc freshness, and a live probe of
  `https://www.homiquity.com` (`:16`, the only lane that uses the `www` host); audits at
  `moderate` vs the gate's `high` (`:58` vs `ci.yml:283`); integration tests deliberately excluded
  (`:8-9`).
- **The guard fleet.** `ls scripts/*-guard.cjs | wc -l` → `14`; `ls scripts/*baseline*.json | wc -l`
  → `7`. Ratchets (down only; **auto-tighten on a shrink**): `bundle-size` (`:217-218`), `design-token`
  (`:116-119`), `citation`, `doc-staleness`, `schema-migration` (baseline allow-list), `ui-standard`,
  `delivery-stack-freeze` (= `pnpm guard:channel`: the four GSE-delivery files may shrink, never
  grow, until the channel decision flips — `scripts/delivery-stack-freeze-guard.cjs`). Hard pass/fail with no baseline: `kb-index`,
  `migration-ledger`, `query-key`, `query-key-transport`, `security-review`, `hooks-installed`.
  Calendar-based: `doc-freshness` (weekly workflow, deliberately outside the gate).
- **Gaps between the lanes.** Neither pre-push nor preflight runs `guard:citations`
  (`grep -n citation scripts/preflight.sh .githooks/pre-push` → nothing); both run **one** of the
  three query-key scripts (`pre-push:115`, `preflight.sh:93` call `query-key-guard.cjs` directly;
  `package.json:38` chains all three for CI). A citation regression or a dead invalidation passes
  locally and reds in CI.
- **What the meta-test pins.** `tests/ciTriggers.test.ts` (294 lines): `:110` migrate-prod wired
  for push+dispatch **or explicitly paused to dispatch only**; `:115` verify-deploy wired for push
  **or explicitly paused off**; `:120` no `pull_request` can reach a deploy job; `:135` drafts are
  skipped; `:153` verify-deploy probes the Railway origin, never `www`; `:191` migrate-prod is never
  cancellable; `:237` the scope step fails closed. Note what `:110`/`:115` *do not* pin: both
  accept LIVE **or** PAUSED, so the two-day pause and the re-arm that ended it were each green.
  The property under test is only that no `pull_request` reaches a deploy job.
- **Other workflows.** `cron-jobs.yml` (7 sweeps, pinned by `tests/cronSchedules.test.ts:30-40` —
  whose title at `:63` still says "six"), `doc-freshness.yml` (weekly, `0 9 * * 1`, deliberately not
  in the gate — "it would go red on the day ASSUMPTIONS.md hits day 31 and block EVERY merge",
  `:10-13`), `preview-seed.yml` (dispatch only).
- **The definition of done.** `knowledge-base/governance/TEAM_PRACTICES.md:93-135` — nine rules:
  `pnpm check` clean; `pnpm test` green in both lanes (new server tests added to the allowlist; UI
  behaviour gets a component test first); the integration suite green against a live worktree
  server on 5002 with `RATE_LIMIT_RELAXED=true`; live verification on the worktree port with
  evidence in the PR body; regulated math carries a ledger citation in the same commit; schema
  changes are hand-authored SQL; new env vars land in `.env.example` **and** CICD.md; the PR-body
  contract (verification evidence, dependency justification, prod-impact note, an explicit doc-sync
  line — "Silence is not a doc-sync statement"); state assumptions and the success criterion first.
  §8 (`:285-291`): "Grep before claiming 'missing'."
- **Ports.** Dev 5001 (from `.env.example`; code default 5000; AirPlay squats on 5000), worktree
  servers 5002+, preflight boot 3999 / integration 4000, CI boot 3999
  (`knowledge-base/runbooks/LOCAL_DEV.md:183-187`, `scripts/preflight.sh:37-38`, `ci.yml:526`).
- **The collection shortfall (not fixed on main).** An open PR documents that vitest 4 discovers
  files through tinyglobby → fdir with `suppressErrors: true`, so a `readdir` that fails under load
  is indistinguishable from an empty directory: in its reproduction one injected failure dropped 36
  of 118 files with "signal to the caller: NONE"; observed three times on 2026-08-20/21 (`Test Files
  111 passed (111)` when 118 existed). Until it lands, compare the reported `Test Files` counts
  with the on-disk counts yourself (the playbook's T1 sanity check).

## Prove it yourself

```bash
cd "$(git rev-parse --show-toplevel)" && git rev-parse --short HEAD   # any clean checkout of origin/main
# → 6377727e @ 6377727e
grep -cE '^\s*"tests/' vitest.config.ts ; grep -cE '^\s*"tests/' vitest.integration.config.ts ; git ls-files 'tests/*.test.ts' | wc -l
# → 221 / 18 / 239 @ 6377727e
comm -23 <(git ls-files 'tests/*.test.ts'|sort) <(grep -ohE '"tests/[^"]+\.test\.ts"' vitest.config.ts vitest.integration.config.ts|tr -d '"'|sort -u)
# → (empty — zero stranded, and `pnpm test` now fails if that changes) @ 6377727e
git ls-files 'client/src/**/*.test.ts' 'client/src/**/*.test.tsx' | wc -l ; grep -n 'include:' vitest.client.config.ts
# → 123 / 37:  include: ["client/src/**/*.test.{ts,tsx}"], @ 6377727e
grep -c '^step ' .githooks/pre-push ; grep -c PREPUSH_TESTS .githooks/pre-push
# → 9 / 4   (the hook stopped running the unit lanes by default — #660) @ 6377727e
grep -lE 'readFileSync\(' tests/*.test.ts | wc -l ; grep -c '^describe(' tests/complianceInvariants.test.ts
# → 63 / 16 @ 6377727e
sed -n '111p' .github/workflows/ci.yml | od -An -tx1 | sed -n '2p'
# → 20 74 68 65 20 6e 65 77 20 63 68 65 63 6b 20 6e … — re-run with `| grep -o 'c2 b7'` to see the U+00B7 in the required-check name @ 6377727e
sed -n '182,531p' .github/workflows/ci.yml | grep -c '^      - name:'
# → 18 @ 6377727e
grep -c '^step ' .githooks/pre-push ; grep -c PREPUSH .githooks/pre-push ; grep -c 'step "' scripts/preflight.sh ; grep -c '^check "' scripts/checkup.sh
# → 9 / 4 / 18 / 18 @ 6377727e
grep -n "citation" scripts/preflight.sh .githooks/pre-push | wc -l ; grep -n "query-key" .githooks/pre-push scripts/preflight.sh | grep -c "query-key-guard.cjs"
# → 0 / 2   (no citation guard locally; one of three query-key scripts) @ 6377727e
ls scripts/*-guard.cjs | wc -l ; ls scripts/*baseline*.json | wc -l
# → 15 / 7 @ 6377727e
gh api repos/barakatammre84/Homiquity/branches/main/protection --jq '{contexts: .required_status_checks.contexts, strict: .required_status_checks.strict}' ; gh api repos/barakatammre84/Homiquity/rules/branches/main --jq 'length'
# → {"contexts":[],"strict":false} / 0 @ 2026-08-22
sed -n '583p;656p;672p' .github/workflows/ci.yml
# → if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
#   if: github.event_name == 'push'
#   continue-on-error: true                                    @ 6377727e
sed -n '63p' tests/cronSchedules.test.ts ; sed -n '/const SCHEDULES/,/^\];/p' tests/cronSchedules.test.ts | grep -c '^\s*\['
# → "schedules exactly these six sweeps…" / 7 @ 6377727e
```

## Where this breaks

| Trap | Where | Caught by |
|---|---|---|
| A new server test in neither config never runs — the allowlist is deliberate, and for the life of the repo nothing detected an omission. | `vitest.config.ts:30-300`; `CICD.md:366-376` | **Closed `fd4a22c5` (#670).** `scripts/test-collection-guard.cjs` diffs the disk against every lane's `include` and fails on a non-empty result; the floor is zero, with no baseline to bump. Its first run found the live example, `tests/maintenanceMode.test.ts` — the `INTAKE_PAUSED` kill switch, five assertions that had never executed. |
| `pnpm test` can run fewer files than exist and exit 0 — vitest globs via `tinyglobby` → `fdir`, whose default `suppressErrors: true` makes a directory that failed `readdir` read as an *empty* one. Seen three times under load: 111/118, 214/215, 113/119. | `package.json:15`; `scripts/test-collection-guard.cjs` | **Closed `fd4a22c5` (#670).** `pnpm test` is the guard: it runs each lane with `--reporter=json` and fails on any shortfall, naming the missing files. Its own enumeration is `fs.readdirSync` with no error suppression — counting with the same glob would shrink both sides together and pass. |
| `main` requires zero checks; `enforce_admins: true` binds admins to an empty list. | `ci.yml:30-45` | No mechanism — the comment warns the previous version of itself said "✅ CONFIGURED" while false. LEDGER HO-0822-15. |
| A pause on `migrate-prod` makes the journal run ahead of prod; this caused a 35-minute auth outage (migration 0057, `users.last_failed_login_at`). Re-armed 2026-08-22 — but a *future* pause is equally invisible. | `ci.yml:583`; `76c96751` | `tests/ciTriggers.test.ts:110` accepts LIVE **or** PAUSED, so it cannot tell you which you have. |
| `verify-deploy` reddens but cannot fail the workflow — `continue-on-error: true`, deliberately, because it and Railway's "Wait for CI" would otherwise deadlock into a permanent silent deploy freeze (`ci.yml:657-671`). With zero required checks, nothing turns its red into a block. | `ci.yml:656,663` | `tests/ciTriggers.test.ts:115`; the real alarm is Railway's own deployment notifications. |
| `strict: false`: two individually green PRs can combine into a red `main`; the ratchets surface it on the *next* PR. | `ci.yml:312-310`; `CICD.md:343-347` | Detected late, by design. |
| The integration lane never runs in CI — all multi-role authorization coverage rides on someone running it. | `CICD.md:357-361` | TEAM_PRACTICES §5.3 asks for it in the PR body; preflight runs it only when a DB is available. |
| Two guards auto-write their baselines on a shrink; a preflight run can dirty the tree with a file you did not edit. | `design-token-guard.cjs:116-119`; `bundle-size-guard.cjs:217-218` | `checkup.sh:48` "working tree clean" — after the fact. |
| `guard:bundle` gates only the eager entry graph, raw bytes; a lazy route can never fail CI. | `bundle-size-guard.cjs:35-36,58-59` | By design. |
| `guard:ui` / `guard:tokens` are text scans — no layout engine; `unprefixedMultiColGrid` is a proxy for "breaks at 320 px". | `ci.yml:328-322`; `scripts/browser-probe.cjs:9-11` | Only `browser-probe.cjs`, which nothing runs automatically. |
| 63 of 238 node tests are source greps — "passes on wrong logic and breaks on renames" (F-014). | `hq-underwriting-owner.md:105` | Acknowledged, not caught. |
| Pre-push and preflight run a strict subset of the gate (no citations; 1 of 3 query-key scripts). | `pre-push:115`; `preflight.sh:93` vs `package.json:38` | CI — now that it runs again. |
| The pre-push probe blocks on `node_modules/.bin/vitest`; if the open hook PR lands the suite removal without the probe change, a checkout with `tsc` but no `vitest` blocks a push for a binary the hook no longer uses. | `.githooks/pre-push:67` | No test. |
| Stale counts inside the harness: `cronSchedules.test.ts:63` "six" (7); `pre-push:107` "9 guards" (8); `pre-push:141` and `preflight.sh:6` "sixteen" (18); `checkup.sh:2-9` lists 8 categories for 18 checks. | as cited | `doc-staleness-guard` scans `.md` vocabulary, not counts in scripts. LEDGER HO-0822-20. |

## What we do not know

| Question | What resolves it |
|---|---|
| Was the gate green on `6377727e`? This chapter is about configuration and structure. | Measured on 2026-08-22 in chapter 12 §1, at the then-current `12d7cbec`: T0–T3 green plus the corpus, 218/218 and 120/120 files collected, the two database stages SKIPPED. The four commits since add one node test and two client tests; the run has not been repeated. |
| ~~Would `tests/maintenanceMode.test.ts` pass if it were listed?~~ | **Answered 2026-08-23:** yes — 5 tests, listed in `fd4a22c5` (#670) and green in that PR's gate. |
| ~~Does #670 still apply cleanly now that #660 has rewritten the hook's test step?~~ | **Answered 2026-08-23:** no, it needed a rebase, and it got one — #670 took #660's `PREPUSH_TESTS` conditional verbatim rather than restoring the unconditional step, and rewrote its own "while CI is down this hook is the only gate" rationale, which #660 had falsified. Merged `fd4a22c5`. |
| Does `enforce_admins: true` with an empty context list have any effect at all? | The `ci.yml` comment asserts it does not; untested. |

## Analogy

An aircraft's pre-flight checklist with three gauges disconnected. `tsc` is "do the controls
move" — cheap, proves nothing about flight. The unit lanes are the ground run: the engine spins,
the instruments read, the aircraft never leaves the tarmac. The guards are the walk-around:
counting rivets against yesterday's count catches corrosion and cannot see a cracked spar. The
build-and-boot step is the taxi test — the thing moves under its own power. The integration lane
and `verify-deploy` are the take-off and the tower confirming you are airborne — which is why it
matters that one never runs in CI and the other, though it calls, is wired so its warning cannot
ground the aircraft. The repo knows: `preflight` reads out the disconnected gauges on every run.

## Teach-back checkpoint

1. You add a new `tests/<name>.test.ts`, it passes locally, you push. Will it ever run again?
2. What exactly does a green `gate` prove, and what does it not?
3. Why is the change-scope step first, and what happens when it cannot classify the diff?
4. `pnpm test` prints `Test Files 214 passed (215)`. Green or not, and what would tell you?
5. Two guards rewrite their own baseline files. Which, when, and why does it matter to you?
6. `main` has `enforce_admins: true`. Is it protected?
7. Why does `tests/roleSeparation.test.ts` cache sessions in a `Map` of promises keyed by email?
8. Name the proof hierarchy from cheapest to strongest, and say which rungs do not run automatically.

## Go deeper

- `knowledge-base/runbooks/CICD.md` — `## Checks — what the gate enforces, and what stays manual`
  (`:315-363`) first; `:83-85` the `--auto` merge warning. `knowledge-base/runbooks/LOCAL_DEV.md`
  (ports `:183-187`, the browser-probe invocation `:57`, the integration recipe `:247-249`),
  `knowledge-base/runbooks/BROWSER_PROBE.md`, `knowledge-base/runbooks/CHANGE_LEDGER.md`.
- `knowledge-base/governance/TEAM_PRACTICES.md` §5 (`:93-135`), the known-traps index (`:137-202`),
  §6 push/merge (`:203`), §8 (`:285-291`), §9 (`:292-400`).
- Feature-map row 41 (CI, the guard fleet and repository tooling) — the only row with no routine
  assigned. Owner: `.claude/agents/hq-ci-guards-owner.md` (`:32-33` — "A ratchet only ever moves
  down… A guard only answers its own question"; `package.json` and the lockfile are off limits to
  every owner).
- Read before touching anything here: the three open PRs on the hook, the collection guard and
  the re-arm (chapter 10's status box names them by subject; numbers change).
