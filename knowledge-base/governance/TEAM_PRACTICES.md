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
before the session ends** — in the sanctioned lane for its type (routine reports commit
to local main; evening triage publishes docs-only). An untracked file in one checkout is
invisible to every worktree and every other session. Code changes never ride along with a
report commit. *(Prevents: the `kb/lo-audit/2026-07-04-pm.md` stranding.)*

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
2. `npm test` fully green; new test files added to `vitest.config.ts`'s include list.
3. Integration suite green against a live worktree server
   (`set -a; source .env; set +a; TEST_BASE_URL=http://localhost:5002 npm run test:integration`).
   Boot the test server with `RATE_LIMIT_RELAXED=true` so the suite's ~30 auth calls don't
   trip the 20/15-min auth limiter; fallback if you can't set env: run in 3 groups with a
   server restart between (restarts clear the in-memory counters).
4. Live verification on the worktree port (5002+) when a running server proves the
   behavior — capture the evidence in the PR body.
5. Regulated math changes carry a `kb/regulatory-ledger.json` citation **in the same
   commit** — no citation, no code change. Never invent MISMO names (see
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
- **Neon's pooled connection breaks `npm run db:migrate` against prod** — apply via a direct
  `pg` client and insert the migrations-journal row manually
  ([kb/app-guide/03-database.md](../handbook/app-guide/03-database.md)).
- **npm crashes mid-install on Vercel** ("Exit handler never called") — Vercel builds with
  pnpm; after any dependency change run `npx pnpm@10 import` and commit **both** lockfiles
  ([CICD.md](../runbooks/CICD.md)).
- **The integration suite trips the auth rate limiter** — boot the test server with
  `RATE_LIMIT_RELAXED=true` (point 3 above).

## 6. Push and merge policy

- Pushes to `main` deploy production. They are **founder-approved**: either the founder
  pushes, or a session pushes under an explicit, per-batch approval (the 2026-07-04
  launch-integration push was such a one-time authorization — it does not generalize).
- A push to `main` — and any action against the production DB or env — is not complete until
  its entry lands in the **production change ledger** in [CICD.md](../runbooks/CICD.md), same session:
  what shipped, prod DB/env actions, validation evidence, rollback pointer. *(Prevents: an
  unledgered deploy invisible to the next incident responder.)*
- Scheduled routines publish **docs-only** (the evening-triage gate inspects every
  unpushed commit's paths before pushing).
- Batch merges via integration push preserve PR head SHAs (`git merge --no-ff` per PR) so
  GitHub marks the PRs merged. **Immediately after**: archive the finished sessions and
  delete the merged branches — stale session chips claiming "open PR" cost the team a
  confused audit. *(Prevents: the post-batch "2 active sessions and 8 pull requests"
  ghost state.)*
- Destructive production actions (grid reseed, migrations against prod, env flips,
  credential rotation) are founder-supervised, never autonomous. Routines emit the exact
  runbook line instead.

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
