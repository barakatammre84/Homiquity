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
   snapshot drift). Never `npm run db:push` from a worktree — the shared dev DB serves
   multiple branches and push drops other branches' columns. Full gotcha doctrine:
   [.agents/memory/db-push-blocker.md](../../.agents/memory/db-push-blocker.md) — note that
   `.agents/memory/` is in-repo agent memory, visible to every session; check it before
   fighting a known battle.
7. New or changed environment variables land in `.env.example` **and** the Vercel env-var
   list in [CICD.md](../runbooks/CICD.md) in the same PR. *(Prevents: a variable that exists only in
   someone's `.env` or the Vercel dashboard, invisible to the next deployer.)*
8. PR body contract: verification evidence (point 4), each new dependency justified in one
   line, a prod-impact note (migrations to apply / env vars to set / "none"), and an explicit
   doc-sync line — "docs updated: <files>" or "no doc update required". Silence is not a
   doc-sync statement.
9. Before implementing anything non-trivial: state your assumptions and the verifiable
   success criterion first ("write a failing test, then make it pass" beats "make it work"),
   then ship the **minimum diff** that satisfies it. Every changed line traces to the
   request; if a simpler approach exists, say so instead of building the clever one.

### Known traps index (check before fighting a known battle)

The trap doctrine lives where it lives — this is the one-stop pointer list. A newly
discovered trap gets a line here (or a file in `.agents/memory/`) in the same PR.

- **`npm run db:push` from a worktree** drops other branches' columns on the shared dev DB;
  never `--force` — [.agents/memory/db-push-blocker.md](../../.agents/memory/db-push-blocker.md).
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
- **npm crashes mid-install on Vercel** ("Exit handler never called") — Vercel builds with
  pnpm, and `pnpm-lock.yaml` is the **only** lockfile: after any dependency change run
  `pnpm install` and commit `pnpm-lock.yaml`. Never resurrect `package-lock.json` via
  `pnpm import` — it was deleted as proxy-poisoned (CH-1, 2026-07-08; [CICD.md](../runbooks/CICD.md)).
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
- Every merge to `main` deploys production. A deploying merge — and any action against the
  production DB or env — is not complete until its entry lands in the **production change
  ledger** in [CICD.md](../runbooks/CICD.md), same session: what shipped, prod DB/env actions,
  validation evidence, rollback pointer. Validation **must include the binding post-deploy
  health probe** — `curl https://www.homiquity.com/api/health` — because Vercel READY attests
  the build, not the runtime. *(Prevents: an unledgered deploy invisible to the next incident
  responder — and the 2026-07-17 class of outage, where a READY deploy served a dead API.)*
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
- **Auth & sessions:** `server/auth.ts`, `server/socialAuth.ts`, `server/integrations/auth/`.
- **Role/permission gates** (`isAdmin`, `requireRole`, staff scoping) and per-resource
  ownership checks on borrower data.
- **Uploads / object storage:** `server/integrations/object_storage/`, `shared/uploads.ts`.
- **Outbound messaging:** `server/services/emailService.ts`,
  `server/services/smsCompliance.ts`, webhook receivers under `/api/webhooks/*`.
- **Logging near PII:** any widening of `RESPONSE_BODY_LOG_ALLOWLIST` in `server/app.ts`.
- **New PII sub-processor:** any PR that introduces or activates an external service
  receiving borrower PII (storage, OCR/extraction, income/asset verification, transcript
  retrieval, messaging providers). The review covers the egress path end-to-end, and a
  vendor-diligence note lands in `governance/security/` in the same program (pattern: the
  Plaid clearance pack). *(Added by the
  [2026-08-04 sovereign-stack adjudication](../logs/2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md)
  §3.4 — every external pitch in that series proposed an unreviewed new PII processor.)*
