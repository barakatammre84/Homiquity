# Team Working Practices

**Adopted:** 2026-07-04 · **Tier 2 doctrine** (decisions in force) · **Audience:** every
work session — human or Claude, scheduled routine or interactive — operating on this repo.
The source-of-truth ladder ("which doc do I trust") lives in the root
[README.md](../../README.md); this page covers **how we work**, not what is true.

These rules were distilled from a real failure day: on 2026-07-04 a 13-PR batch merge
staled a layer of documentation within hours, one report file sat untracked and invisible
to every worktree session, and stale UI chips reported open PRs that were already merged.
Each rule below names the failure it prevents.

## 1. No transient state in living docs

Open-PR numbers, branch names, session names, and merge-queue status appear **only** in
the 🚀 Launch sprint section of [CTO_ROADMAP.md](../../CTO_ROADMAP.md) (maintained nightly by
evening triage) and in dated snapshot reports. Living docs (README, ASSUMPTIONS,
kb doctrine, app-guide) state durable facts and link to the roadmap for "what's in
flight." *(Prevents: "Open PR #45 — verify on merge" surviving in a fact register hours
after the PR merged.)*

## 2. Dated reports are immutable snapshots

Files under `kb/founder-routines/`, `kb/lo-audit/`, `kb/ux-audit/` are point-in-time
records. Never rewrite their findings. Corrections and supersessions go in a dated
**banner at the top** (`> ⚠️ SUPERSEDED …`). *(Prevents: history laundering — and readers
acting on a mid-afternoon report that the evening overtook.)*

## 3. Same-session commit rule

Any file a session generates (reports, research notes, extracted data) is **committed
before the session ends** — in the sanctioned lane for its type: a **docs-only PR merged
on green** (direct pushes to `main` are barred by doctrine — §6). An untracked file in one checkout is
invisible to every worktree and every other session. Code changes never ride along with a
report commit. *(Prevents: the 2026-07-04 lo-audit report stranding — that report now lives
at `knowledge-base/archive/lo-audit/2026-07-04-pm.md`.)*

## 4. Branch and worktree lifecycle

- One session = one isolated worktree = one branch. Never work on a branch in the shared
  primary checkout.
- Claim before building: mark the sprint item CLAIMED in the launch-sprint memory ledger;
  release the claim if you abandon. Stale claims (>24 h) are reclaimable.
- Merged = deleted, same day — remote and local branch, worktree, and session archive.
- Deliberately kept-back work (standby branches) **must exist on origin**. A laptop-only
  branch is one disk failure from gone.

### PR size: one CI cycle *(added 2026-08-04)*

**If a PR cannot survive one CI cycle without going stale, it is too big for this repo's
cadence.** That is the rule, and the number comes from observation rather than taste: `main`
merges something roughly every 15 minutes at peak, and the gate takes ~3.5 minutes. A PR that
takes a day to assemble races ~30 commits.

This is not hypothetical. The 2026-08-04 financial-architecture PR was **69 files / 7,292
additions**, and in the time it took to open, `main` landed a migration at the same index —
`0038` on both sides. Caught only because the branch was merged up *before* opening the PR; had it
merged as-is, two entries would have shared `idx: 38` in the journal and the post-merge
`migrate-prod` job would have applied them in an undefined order. **On a prod database that
auto-applies migrations, a stale branch is a correctness risk, not an inconvenience.**

Practically:

- Split by seam, not by size. That PR was four: compensation, disclosure, economics, governance.
  Each would have merged inside an hour and never met a conflict.
- Land the shared reference (an audit log, a spec) as its own PR first. It is pure addition,
  merges immediately, and gives the follow-ups something to cite.
- Merge `main` **before** opening, not after CI goes green — that is when a migration collision
  is cheap to fix.
- If a PR must be large (a mechanical rename, a dependency migration), say so in the body and
  expect to re-merge `main` more than once.

## 5. Definition of done (every PR, no exceptions)

1. `npm run check` clean (tsc).
2. `npm test` fully green — it runs the node suite **and** the client component suite. New
   server/logic test files must be added to `vitest.config.ts`'s include list; client
   component tests are colocated `client/src/**/*.test.tsx` and glob-included by
   `vitest.client.config.ts` automatically. **UI behavior gets a component test here first**
   (render/interaction against `data-testid`s, in happy-dom — no server); the §5.4 browser
   pass is for what a component test can't prove (visuals, full E2E).
3. Integration suite green against a live worktree server
   (`set -a; source .env; set +a; TEST_BASE_URL=http://localhost:5002 npm run test:integration`).
   Boot the test server with `RATE_LIMIT_RELAXED=true` so the suite's ~30 auth calls don't
   trip the 20/15-min auth limiter; fallback if you can't set env: run in 3 groups with a
   server restart between (restarts clear the in-memory counters).
4. Live verification on the worktree port (5002+) when a running server proves the
   behavior — capture the evidence in the PR body. For client UI, do this *after* the
   point-2 component tests: the browser pass proves visuals and end-to-end wiring, not
   things a component test already pins.
5. Regulated math changes carry a `data/regulatory/regulatory-ledger.json` citation **in the
   same commit** — no citation, no code change. Never invent MISMO names (see
   [CLAUDE.md](../../CLAUDE.md) compliance-first rules).
6. Schema changes are **hand-authored** SQL in `migrations/` (drizzle-kit generate has
   snapshot drift). Never `pnpm db:push` from a worktree — the shared dev DB serves
   multiple branches and push drops other branches' columns. Since #251 `db:push` and
   `db:generate` are exit-1 stubs that print this doctrine, and `--force` would additionally
   drop the `sessions` table (created by the session store, not `shared/schema/`), logging out
   every user. Use targeted `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. Full doctrine:
   [DB_MIGRATIONS.md](../runbooks/DB_MIGRATIONS.md) and CLAUDE.md.
7. New or changed environment variables land in `.env.example` **and** the env-var list in
   [CICD.md](../runbooks/CICD.md) in the same PR — production values live as **Railway service
   variables** (Railway → project *Homiquity* → service *Homiquity* → Variables).
   *(Prevents: a variable that exists only in someone's `.env` or the Railway dashboard,
   invisible to the next deployer.)* Say in the PR body whether the new variable is `VITE_*`:
   those are **build-time**, baked into the client bundle by `pnpm build`, so changing one
   takes effect on the next **redeploy**, not on a restart.
8. PR body contract: verification evidence (point 4), each new dependency justified in one
   line, a prod-impact note (migrations to apply / env vars to set / "none"), and an explicit
   doc-sync line — "docs updated: <files>" or "no doc update required". Silence is not a
   doc-sync statement.
9. Before implementing anything non-trivial: state your assumptions and the verifiable
   success criterion first ("write a failing test, then make it pass" beats "make it work"),
   then ship the **minimum diff** that satisfies it. Every changed line traces to the
   request; if a simpler approach exists, say so instead of building the clever one.
10. **A test guarding a compliance invariant or a regulated calculation is mutation-tested
    before it counts.** Break the thing it protects, confirm the test goes red, restore, and
    state `N/N caught` in the PR body. Deliberately narrow — this is not "mutation-test
    everything" (a rule that fires on every PR becomes boilerplate, the same failure mode §9
    warns about for security triggers). It binds where a false green is a *compliance*
    statement.
    *(Prevents: a test that cannot fail. Empirical, not theoretical — on 2026-08-12 this
    caught **four** holes in freshly written tests that were passing and looked right: a
    ban-list guard that stayed green on a wrong VA utility rate; a parity suite blind to the
    cushion multiplier because the engine reports its requirement pre-cushion; a WHERE-clause
    assertion that was vacuous because walking a drizzle condition reaches each Column's
    parent table and collects the whole schema; and an ECOA suite that passed while
    `MANUAL_REVIEW` was treated as `APPROVED`. Every one was written by someone who believed
    it worked — which is the point: you cannot review your way to this, you have to try to
    break it.)*
11. **Never write a test that asserts a known-defective behavior is correct.** When a fix is
    blocked — on a legal reading, an escalation, a product decision — pin the gap as a
    characterization test named `GAP (<finding-id>)` that states the correct behavior and how
    to invert the assertion once fixed. An untested gap gets silently reintroduced, or
    silently "fixed" with nobody noticing which; a gap asserted as correct is worse, because
    the suite now defends it.
    *(Pattern: `tests/fcraConsentGateBehavior.test.ts`. Precedent for why it matters: F-043 —
    `complianceInvariants.test.ts` asserted the error string of the very consent gate F-035
    calls insufficient, so the compliance suite certified the defect and stayed green through
    the whole F-034/F-035/F-040 cluster.)*

### Known traps index (check before fighting a known battle)

The trap doctrine lives where it lives — this is the one-stop pointer list. A newly
discovered trap gets a line here in the same PR.

- **A source-grep is not a compliance test** — it passes on wrong logic and breaks on renames.
  `tests/complianceInvariants.test.ts` is the standing instance (F-014). Four conversions to
  behavioral tests on 2026-08-12 each found something the text search could not see: three
  forked numeric literals live under a green guard (**F-051**); a consent never bound to the
  application it authorizes (**F-052**); a **live** FCRA re-disclosure — the cached-pull branch
  returned bureau data before control reached the gate, so a revoked borrower's report was
  re-disclosed for up to 90 days while the suite stayed green (**F-042**); and a `denied`-check
  whose "allowed statuses" assertion matched a *type annotation*, erased at runtime.
  Two rules follow. **(a)** Assert on behavior — what the code returns, what it persists, what
  order it queries in — never on the file's text. **(b)** Do **not** wholesale-rewrite that
  file: its architectural negative-space claims ("no AI import in the decision path", "no
  forked APR solver", "only `trid.ts` writes `tridTriggeredAt`") are *correctly* grep-based,
  because nothing else can express "this dependency must not exist." Convert assertions about
  regulated **math and behavior**; leave the dependency guards alone. Scope detail lives on the
  F-014 row in [FINDINGS.md](../feature-review/FINDINGS.md).
- **`pnpm db:push` from a worktree** drops other branches' columns on the shared dev DB, and
  `--force` also drops `sessions` (logging out every user); it is an exit-1 stub for that reason
  — [DB_MIGRATIONS.md](../runbooks/DB_MIGRATIONS.md).
- **`drizzle-kit generate` has snapshot drift** in this repo — hand-author migration SQL
  (point 6 above; [CLAUDE.md](../../CLAUDE.md) database rules).
- **Prod migrations are auto-applied by CI — never hand-apply.** The `migrate-prod` job
  applies pending `migrations/` on every merge to `main` (direct URL minted from
  `NEON_API_KEY`; the retired raw-`pg` + manual-journal-insert recipe caused the journal
  drift the dry-run pre-flight exists to reconcile). Break-glass:
  `DATABASE_URL=<direct-url> pnpm db:migrate:prod` ([DB_MIGRATIONS.md](../runbooks/DB_MIGRATIONS.md)).
- **A duplicated journal `when` silently skips a migration on prod** — the applier dedupes by
  `_journal.json` `when` as well as by hash (`scripts/migrate-prod.cjs`), so a copy-pasted
  `when` makes prod treat the new migration as already applied. Every `when` must be unique
  and strictly increasing ([DB_MIGRATIONS.md](../runbooks/DB_MIGRATIONS.md) §Adding a migration).
- **`pnpm-lock.yaml` is the only lockfile, and a stale one now fails the deploy outright** —
  the Railway build runs `pnpm install --frozen-lockfile && pnpm build` ([railway.json](../../railway.json)),
  which refuses to reconcile a lockfile that disagrees with `package.json`. After any dependency
  change run `pnpm install` and commit `pnpm-lock.yaml`. Never resurrect `package-lock.json` via
  `pnpm import` — it was deleted as proxy-poisoned (CH-1, 2026-07-08, when npm crashed mid-install
  with "Exit handler never called" on the then-host; [CICD.md](../runbooks/CICD.md)).
- **A failed Railway deploy leaves the previous container serving — the site stays up and every
  check stays green.** On 2026-08-06 nine consecutive deploys failed (`engines.node: "24.x"` is
  npm range syntax that mise, the Railpack toolchain resolver, cannot resolve) and prod sat ~8
  commits stale while `/api/health` answered 200 throughout. Neither a Railway deployment reading
  SUCCESS nor a 200 from `/api/health` is evidence your merge shipped — **only the `commit` field
  of `/api/health`** (it carries `RAILWAY_GIT_COMMIT_SHA`). CI's `verify-deploy` job polls it after
  every push to `main` and fails when prod is not serving that commit; if that job is red, treat
  prod as stale no matter what the dashboard says.
- **`/api/health` returning 200 does not mean the app is talking to the right database.** Its
  probe is a `SELECT 1`, which succeeds against *any* reachable Postgres. Also on 2026-08-06 the
  Railway service's `DATABASE_URL` was pointed at a stale Neon branch (28 of 53 migrations, no
  writes since 07-15): health stayed green while `/api/articles` and `/sitemap.xml` 500'd. After
  any DB env change, probe a **data-bearing** route as well, not just health.
- **Racing merges can land a tree the gate never tested** — the gate runs on the PR branch
  as pushed, so a PR that merges while other PRs land is combined with `main` untested
  (discovered 2026-07-17). The control is `strict: true` on `main`'s required status checks
  ("require branches to be up to date before merging"): a PR must be rebuilt on current
  `main` before it can merge, so a green gate can no longer be green against a base that has
  moved. **Verify it, don't assume it** (§6, §8) —
  `gh api repos/OWNER/REPO/branches/main/protection/required_status_checks --jq .strict`
  must print `true`. Whenever it is `false`, the hazard is live and the fallback is manual:
  after a squash merge amid other merges, diff the squash commit against your tested branch
  head before trusting green. Two costs to know going in: on a busy `main` every open PR
  must update before merging, so merges serialise; and the PATCH that sets `strict` must
  re-send `contexts[]` **verbatim** — the separators in
  `gate (typecheck · tests · schema guard)` are U+00B7 MIDDLE DOTs, and a mismatch deadlocks
  every future PR on "Expected — Waiting for status" with no admin bypass
  ([ci.yml](../../.github/workflows/ci.yml) carries the rename/recovery procedure).
- **The integration suite trips the auth rate limiter** — boot the test server with
  `RATE_LIMIT_RELAXED=true` (point 3 above).

## 6. Push and merge policy *(rewritten 2026-07-19: platform enforcement follows plan/visibility — verify it, don't assume it)*

- **Nobody direct-pushes `main`, founder included, and no PR merges before its `gate` is
  green.** Branch protection currently enforces this (required `gate` check +
  `enforce_admins`; force-push and deletion of `main` blocked; re-applied 2026-07-19
  ~19:45Z, probe-verified by unmerged PR #262). Work lands as a short-lived branch → PR →
  gate green → **squash merge**. No required reviews: the author merges their own green PR.
  Recipe: [CICD.md](../runbooks/CICD.md) §Shipping.
- **⚠️ The 2026-07-19 lesson: GitHub enforces branch protection only while plan/visibility
  allow it, and a flip can silently *drop the rule entirely*.** The repo went private
  ~17:20Z that day (Free plan ⇒ no protection on private repos) — the rule wasn't merely
  suspended, it was **deleted** (API 404) — and **#252–#259 merged pre-green** because
  `gh pr merge --auto` cannot arm with nothing required: it merges instantly, gate still
  running (all eight gates passed post-hoc). The repo was made public again ~19:45Z
  (founder: "for now, pro later") and the rule re-applied from the documented config in
  [DB_MIGRATIONS.md](../runbooks/DB_MIGRATIONS.md) §One-time setup. So the standing habit:
  **before relying on `--auto`, verify enforcement is live** —
  `gh api repos/barakatammre84/Homiquity/branches/main/protection` must list the
  `gate` context as required. If it 403s/404s or lists no checks, enforcement is OFF:
  fall back to **watch-then-merge** (`gh pr checks <n> --watch --fail-fast` → green →
  `gh pr merge <n> --squash`), flag it to the founder, and never merge red/pending.
  Direct pushes and force-pushes to `main` stay barred by doctrine regardless of what the
  platform currently blocks. *(Break-glass for a genuine emergency: a deliberate,
  ledgered founder action — the `enforce_admins` toggle while protection is live, a
  knowing direct push only when it is not. Never autonomous, never silent —
  [ROLLBACK.md](../runbooks/ROLLBACK.md) §2.)*
- Every merge to `main` deploys production — Railway builds from GitHub and rolls a new
  container. A deploying merge — and any action against the production DB or env — is not
  complete until its entry lands in the **production change ledger** in
  [CICD.md](../runbooks/CICD.md), same session: what shipped, prod DB/env actions, validation
  evidence, rollback pointer. Validation **must include the binding post-deploy health probe** —
  `curl https://www.homiquity.com/api/health` — and must read the **`commit`** field, not just
  the status code: a build status attests the build, not the runtime, and a *failed* Railway
  deploy leaves the previous container serving, so a healthy 200 can be the old code answering
  (2026-08-06: nine failed deploys, prod ~8 commits stale, every check green). *(Prevents: an
  unledgered deploy invisible to the next incident responder — and the 2026-07-17 class of
  outage, where a deploy marked READY served a dead API.)*
- Scheduled routines publish **docs-only, through the same PR lane** (docs-only branch →
  gate watched to green → merge; the routine inspects every commit's paths before opening
  the PR). A routine never carries code.
- **Immediately after a merge**: delete the merged branch (remote and local) and its worktree,
  and archive the finished session — stale session chips claiming "open PR" cost the team a
  confused audit. *(Prevents: the post-batch "2 active sessions and 8 pull requests"
  ghost state.)*
- Destructive production actions (grid reseed, env flips, credential rotation, any contract
  migration's data decision) are founder-supervised, never autonomous. Routines emit the exact
  runbook line instead. The one automated prod-DB writer is the `migrate-prod` CI job; what
  keeps it safe is the author-side discipline in [CLAUDE.md](../../CLAUDE.md) §Database
  (same-PR migration, expand/contract, read-only prod probe before any contract step).

## 7. Documentation link and file rules

- Markdown links in `kb/` subdirectory docs use paths **relative to the linking file**
  (`../../server/...` from `kb/founder-routines/`) — a bare `server/...` link only works
  from the repo root and breaks in every viewer.
- Official reference binaries keep their **original filenames** (spaces included) for
  provenance; always quote paths in shell. Reading recipes live in each `docs/*/README.md`
  (PDF → Read tool/pypdf; XLSX → openpyxl).
- Every new doc gets a home in the tier map (root README) and one index line — an
  unindexed doc is an unread doc.

## 8. Verification before assertion

Grep before claiming "missing"; read the code before repeating a doc's claim; check
`gh pr list` / `git log` before describing PR or branch state. The source-of-truth rule
applies to our own tickets and reports, not just external research. *(Prevents: ticket
#34 — a TRID clock "gap" that had been fully implemented on main all along.)*

## 9. Security-review triggers (binding)

Any PR touching one of the areas below runs `/security-review` (or an equivalent structured
security pass) **before merge**, and unresolved CRITICAL findings block the merge — the same
contract as the regulated-math rule in §5.5: no review, no merge. Record the outcome in the
PR body (part of the §5.8 contract).

- **PII vault / field encryption:** `server/services/ssnVault.ts`,
  `server/services/piiVault.ts`, `server/services/encryptionService.ts`, or any
  `shared/schema/` column holding PII.
- **Auth & sessions:** `server/auth.ts`, `server/socialAuth.ts`, `server/integrations/auth/`,
  `server/services/accountRecovery.ts` (mints password-reset tokens).
- **Role/permission gates** (`isAdmin`, `requireRole`, staff scoping) and per-resource
  ownership checks on borrower data.
- **Uploads / object storage:** `server/integrations/object_storage/`, `shared/uploads.ts`.
- **Outbound messaging:** `server/services/emailService.ts`,
  `server/services/smsCompliance.ts`.
- **Webhook receivers and the code that authenticates them:** receivers under
  `/api/webhooks/*`, **and** `server/services/twilioSignature.ts` /
  `server/services/twilioMessageStatus.ts`. *(Added 2026-08-06: coverage was inverted —
  the route was a trigger but the service it delegates to was not, so the signature check
  that IS the auth boundary could be weakened without tripping the gate. #433 was that bug:
  the inbound SMS webhook trusted anyone who found the URL. **A path trigger must cover the
  delegate, not just the caller.**)*
- **Request identity & trust boundary:** `server/clientIp.ts`, `server/trustProxy.ts`.
  *(Added 2026-08-06. These exist only because Railway's edge sends `X-Real-IP`, not
  `X-Forwarded-For`, leaving `req.ip` as a shared internal address (#436). They are §9 not
  for what they are but for what consumes them: `rateLimitKey` (abuse control) and
  `clientIpForRecord`, which is written to every audit row **and** to `consentIp` in
  `server/routes/leads.ts` — the TCPA consent provenance. A wrong change here bypasses rate
  limiting and falsifies legal consent evidence.)*
- **Rate-limit policy:** `server/services/rateLimitPolicy.ts`.
- **Logging near PII:** any widening of `RESPONSE_BODY_LOG_ALLOWLIST` in `server/app.ts`.
**Partly enforced by the gate.** `pnpm guard:security`
([`scripts/security-review-guard.cjs`](../../scripts/security-review-guard.cjs)) fails the PR
when it touches a trigger below and the PR body carries no heading containing
`Security review`. Two things it deliberately is not: it proves the review was *written
down*, never that it was *correct* — with a single collaborator no automation can do the
latter, which is also why CODEOWNERS cannot be used here (GitHub forbids self-approval, so
requiring code-owner review would deadlock every §9 PR). And it cannot see the last two
triggers below — a `shared/schema/` PII column and a new PII sub-processor need someone to
know which columns are PII and which vendors are processors. **A green gate is not evidence
that §9 is satisfied on those two.** The rule binds whether or not the script fires.

**Keep the triggers narrow.** Every path above is named because a wrong change to *that
file* has a specific, statable cost. Do not widen them into globs (`server/services/*`):
the gate proves a review was written down, so a trigger that fires on everything converts
the review section into pasted boilerplate and makes the artifact worth less than it is
now. **Audit coverage by running `detectTriggers()` against the security-critical files
that actually exist — not by re-reading this list**, which is how the two 2026-08-06 gaps
were found after the Railway cutover created them.

- **New PII sub-processor:** any PR that introduces or activates an external service
  receiving borrower PII (storage, OCR/extraction, income/asset verification, transcript
  retrieval, messaging providers). The review covers the egress path end-to-end, and a
  vendor-diligence note lands in `governance/security/` in the same program (pattern: the
  Plaid clearance pack). *(Added by the
  [2026-08-04 sovereign-stack adjudication](../logs/2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md)
  §3.4 — every external pitch in that series proposed an unreviewed new PII processor.)*
