# Deploy & Revert

Homiquity ships with a deliberately simple flow: **push to `main` → Vercel
deploys it. If it breaks, revert.** No approvals.

```
  git push (main)  ──▶  Vercel builds & deploys automatically
        │                     │
        ▼            broken?  ▼
  GitHub Actions    Vercel → Deployments → previous one → Promote  (instant)
  (planned — not
   on main yet,
   see below)
```

**CI status (corrected 2026-07-04): there is no CI on `main` today** — `.github/`
does not exist there, so nothing runs on push; all checks are manual (see
"Optional checks" below). A finished non-blocking workflow (`ci.yml`:
typecheck, unit tests, build, lockfile parity) is authored and waiting on local
branch `claude/inspiring-faraday-86b6b2` (commit `4fa08ad`), but the automation
GitHub token lacks the `workflow` scope, so **a human must push/merge it from a
normally-authenticated environment** (roadmap #5). Once landed it is
informational only — a red run marks the commit but the deploy still goes out.
To make it a hard gate later: GitHub → Settings → Branches → protect `main`,
require the `ci` check (this also blocks direct pushes, so `npm run save`
would move to a PR flow).

## Shipping

```bash
npm run save        # commit everything with a timestamp + pull + push
# or, if you've already committed:
npm run sync        # pull + push
```

Every push to `main` triggers a production deploy on Vercel. Every PR branch
gets its own preview deployment automatically.

## Reverting

Full detail in [ROLLBACK.md](./ROLLBACK.md). Short version:

- **Prod is broken right now** → Vercel dashboard → Deployments → pick the last
  good one → **Promote to Production**. Instant, no rebuild.
- **Undo the bad code** → `git revert <sha> && git push` (never
  `reset --hard` + force-push).
- **Database** → schema changes ship as **hand-authored** versioned migration
  files in `migrations/`, applied with `npm run db:migrate` (**never `db:push`**,
  **never `drizzle-kit generate`** — see [ROLLBACK.md](./ROLLBACK.md) §3 and
  [kb/app-guide/03-database.md](../handbook/app-guide/03-database.md)). Still snapshot/branch
  in Neon before destructive schema changes; migrations have no automatic "down".

## How the Vercel deploy works

- `vercel.json` — install is `pnpm install --frozen-lockfile --prod=false`,
  build is `npm run vercel-build` (= `vite build` **plus** an esbuild bundle of
  the server into `api/_app.mjs`) → static client from `dist/public`; rewrites
  send `/api/*` to the serverless function `api/index.ts`, everything else
  falls back to the SPA `index.html`.
- **The function imports the pre-bundled `api/_app.mjs`, never the raw TS
  server graph.** Server code uses the `@shared/*` tsconfig alias, which
  Vercel's file tracer/Node runtime can't resolve (this produced opaque
  `FUNCTION_INVOCATION_FAILED` crashes); esbuild resolves the alias at build
  time. The handler imports the bundle *dynamically* so any bootstrap failure
  returns a readable `bootError` JSON instead of an opaque crash. Two more
  serverless rules learned the hard way: never construct SDK clients at module
  load (the OpenAI client throws without a key — build them lazily), and never
  write to the filesystem at module load (only the OS temp dir is writable).
- **Why pnpm on Vercel (do not switch back to npm casually):** npm crashed
  mid-install on Vercel's build image with "Exit handler never called" on
  Node 20, 22 AND 24 (reproduced four deploys in a row), while the identical
  install works locally. pnpm sidesteps npm entirely. `--prod=false` is
  required because Vercel sets `NODE_ENV=production`, which makes pnpm skip
  devDependencies — and vite (a devDependency) is needed to build.
- **Two lockfiles now exist.** Local dev can keep using npm
  (`package-lock.json`); Vercel uses `pnpm-lock.yaml` (generated via
  `pnpm import`, so versions match npm's exactly). **After any dependency
  change, run `npx pnpm@10 import` and commit both lockfiles together.**
- `engines.node: 24.x`; `.npmrc` disables audit/fund noise.
- Env vars (Vercel → Settings → Environment Variables): `DATABASE_URL` (Neon,
  non-localhost), `SESSION_SECRET`, `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`,
  `NODE_ENV=production`, plus optional `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`,
  `OPENAI_API_KEY`, and for document storage `GCS_SERVICE_ACCOUNT_KEY`,
  `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` (see `.env.example`).

Persistent hosts (Fly, a VPS) still work unchanged: `npm run build` +
`npm start`.

## Private beta gate (invite-link access)

Root-level `middleware.ts` is a Vercel **Edge Middleware** that locks the whole
site (every route except `/api/*`) behind invite links while the
`BETA_ACCESS_CODE` env var is set in Vercel. Tests live in
`tests/betaGate.test.ts`.

- **Turn on:** Vercel → Settings → Environment Variables → add
  `BETA_ACCESS_CODE` (Production) with one or more comma-separated codes, e.g.
  `hq-beta-7f3k2m` — then redeploy. Generate codes with `openssl rand -hex 4`
  or pick memorable phrases; avoid guessable words.
- **Invite testers:** send `https://<host>/?beta=<code>`. Opening it sets a
  90-day HttpOnly cookie (the SHA-256 of the code, so the raw code never sits
  in the browser) and redirects to a clean URL. Visitors without a code get a
  401 lock screen with a code-entry form.
- **Revoke a group:** remove that group's code from the env var and redeploy —
  its cookies stop validating immediately.
- **Turn off (public launch):** delete `BETA_ACCESS_CODE` and redeploy. The
  middleware becomes a no-op; nothing else to remove.
- **SEO while gated:** `/robots.txt` answers `Disallow: /` and every gate
  response carries `X-Robots-Tag: noindex`, so the beta never gets indexed.
  When the gate is off, the static `client/public/robots.txt` (allow-all)
  serves instead.
- **Why `/api/*` is exempt:** Vercel cron invocations and webhooks carry no
  browser cookie (they authenticate via `CRON_SECRET` / webhook secrets), and
  API routes already sit behind app auth. The gate is a privacy screen for the
  beta, not a security boundary — real access control stays in the app.
- Edge Middleware only runs on Vercel; `npm run dev` and local prod builds
  never execute it.

## Optional checks (run manually, nothing enforces them)

```bash
npm run check              # typecheck
npm run test:unit          # pure logic tests (no server needed)
TEST_BASE_URL=http://127.0.0.1:5001 npm run test:integration   # against a running dev server
```

If you later want gates again (block bad pushes before they deploy), add a
GitHub Actions workflow that runs the commands above and enable branch
protection — but that's a deliberate future choice, not the current setup.

## Production change ledger (append-only)

Every push to `main` (it deploys) and every action against the production database or its
env vars gets a row here **in the same session** — newest first
([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §6). Never rewrite or delete rows; corrections get a
new row. Each row: what shipped · prod DB/env actions (and how) · validation evidence ·
rollback pointer.

| Date | Change | Prod DB / env | Validation | Rollback |
|---|---|---|---|---|
| 2026-07-08 | **PR #90 — CPA partner nav + channel hygiene** (merge `454a41b`, fix `da7432a`). *(Row stubbed on #90's behalf by a concurrent session — from the merge + commit evidence + Vercel; owner: verify/amend.)* Routes `isPartnerRole("cpa")` to a CPA-only nav on desktop (`app-sidebar.tsx`) **and** mobile (`MobileBottomNav.tsx`) instead of the borrower nav a CPA would otherwise inherit; Footer "For CPAs" link → `/for-cpas`; corrected the stale/dangerous `shared/schema/cpaPartners.ts` docstring (cpa is a self-registering **PARTNER_ROLE, NOT a STAFF_ROLE** — the misconception behind the caught privilege-escalation bug `ae06fd4`); removed dead `getCpaFirmForUser` from `storage.ts`; added tests for `checkTaxReturnConsistency` capping (`extractionService`) + document-confidence tiering + test-seam exports. | **None** — the `cpaPartners.ts` edit is **comment-only** (no column added); no `migrations/` change. Migration HEAD on `main` remains `0011`. | Per the PR commit (not independently re-run): `npm run check` clean; **751 unit + 20 CPA/tax integration** green; live-drove the CPA login (desktop sidebar + mobile bar show the CPA nav with no borrower items; footer → `/for-cpas`). Prod deploy `dpl_H3KMr1K5dC5YgzMJJfmvwkJ4HcoY` **READY** on `mortgage-stream.vercel.app` (verified). Security-relevant (reinforces the `cpa` PARTNER_ROLE vs STAFF_ROLE boundary, cf. `ae06fd4`) — nav-routing + comment only, no new auth surface. | [ROLLBACK.md](./ROLLBACK.md) §1; `git revert -m 1 454a41b`. |
| 2026-07-08 | **Docs / skills / config cleanup — direct-to-`main` batch** (founder-authorized, no PR; branch `claude/project-markdown-audit-47f6eb`, since deleted). 3 deploys, newest→oldest: **`c504f1a`** — removed dead AI-gateway env vars (`AI_GATEWAY_PROVIDER`/`ANTHROPIC_API_KEY`) from `.env.example`, kept the live `AI_INTEGRATIONS_*` (read by `extractionService.ts`/`coachingService.ts`); **`c30758a`** — enriched the `.claude/skills/mortgage-calculations` router for the merged public calculator suite (hub + 10 pages, BUILD-1 pre-license note); **`6c6fc77`** (merge) folding **`78ecf80`** bloat pass — pruned 2 superseded founder-routine logs + purged dead `aiGateway.ts`/`documentEngine.ts` refs across app-guide 01/05/06/09 (`extractionService.ts` owns Gemini) — **`bba03b7`** banner-mode archival of the launch-era log chain (`kb/logs/{founder-routines,lo-audit,assessments}` → `kb/archive/`, ~65K tok quarantined; founder-authorized [TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §2 override; live status-vocabulary prod-migration reminder migrated out to [CTO_ROADMAP](../../CTO_ROADMAP.md) **CH-8**) — and **`ac1f12f`** four on-demand `.claude/skills/` router skills (api-routes / ui-components / mortgage-calculations / seo-content) + CLAUDE.md pointer + `app-guide/07-frontend` palette drift fix (→ Charcoal Emerald). | **None** — docs / `.claude/` / `.env.example`-template only; no `migrations/` or `shared/schema/` change (the merge pulled in main's calculator code, already logged in the row below — this batch introduced no code). Migration HEAD on `main` remains `0011`. | KB index guard **PASS** (80 docs, all indexed, no dead links); corpus relative-link check clean — 0 dead links outside `archive/` (17 pre-existing malformed code-links inside the archived logs left as-is under their "never act on" banner). All 3 prod deploys **READY** on `mortgage-stream.vercel.app`: `c504f1a` = `dpl_2Y5pgRswxvbAPehEDAu4ifmgmznv` (vite, `iad1`, ~72s), `c30758a` = `dpl_CWtt7xsC5QPnmzLDsvJEYnsRKhyw`, merge `6c6fc77` = `dpl_CaVxVRqjqW2YnHHZjcXQxsx7WiuU`. This ledger row logged in a follow-up commit. | [ROLLBACK.md](./ROLLBACK.md) §1; docs/config only, safe — `git revert <sha>`. Reverting `bba03b7` restores `kb/logs/` from `kb/archive/`; `ac1f12f` removes the skills; the rest are self-contained. |
| 2026-07-08 | **Public calculator suite + pre-license surfacing** (3 deploys, newest→oldest): **PR #88** — educational "Open the calculators" link on `client/src/pages/public/Waitlist.tsx` (merge `d284fc9`); **PR #87** — moved the "Calculators" nav link **outside** the `!PRELAUNCH_GATED` block in `Navigation.tsx` so it shows in gated mode while Rates/Buy/Refinance stay gated (merge `ce9ed6b`); **PR #86** — 5 new calculators (`/calculators/amortization`, `/home-equity`, `/payoff`, `/down-payment`, `/bah`) + the `/calculators` hub, all `PublicPage`, deterministic client-side math on the `MortgageCalculator` pattern (merge `a5dd472`). ⚠️ **AUTHORIZED DEVIATION from [ARMED_LAUNCH_CHARTER](../governance/ARMED_LAUNCH_CHARTER_2026-07-07.md) BUILD-1**: these calculators render **priced results + "Get Pre-Approved" CTAs on unauthenticated routes while the gate is on**, which BUILD-1's acceptance forbids ("no unauthenticated route renders a rate, a priced quote, or an apply/get-approved CTA"). Flagged to product with the compliant alternative (gate them like `/calculators/rent-to-own`); **product elected to override (2026-07-08)** to surface the free tools pre-launch. Mitigations: educational link framing, no Reg Z trigger terms / approval language in the link copy, in-code deviation note on `Waitlist.tsx`. **OPEN COMPLIANCE ITEM — requires counsel sign-off before F1**; a Lane-1 gate-integrity audit will flag these (plus the 3 pre-existing ungated calcs — affordability/mortgage/rent-vs-buy) as leaks. | **None** — no `migrations/` or `shared/schema/` change; `calculator_type` is an existing free `varchar(50)`, so the new types (`amortization`/`home_equity`/`mortgage_payoff`/`down_payment`/`bah`) persist without a schema change. Migration HEAD on `main` remains `0011`. | `tsc` clean + `npm run build` clean (#86); per-calculator live math spot-checks on a booted worktree server (e.g. $320k @ 6.5%/30yr → **$2,023/mo**, $408k interest; +$300/mo → 8yr 10mo sooner; BAH $2,400 → **$314,841** VA price, PITI == budget); nav + waitlist ungating verified with `VITE_PRELAUNCH_GATED=true` (Calculators shows, Rates/Buy/Refinance hidden; waitlist link → hub); **zero console errors** across all surfaces. All 3 deploys merged to `main`. | [ROLLBACK.md](./ROLLBACK.md) §1; each PR is an isolated merge commit — `git revert -m 1 <merge-sha>`. **Reverting `d284fc9` (#88) + `ce9ed6b` (#87) restores BUILD-1 compliance while keeping the calculators** behind the gate; add `a5dd472` (#86) to remove the suite entirely. |
| 2026-07-08 | Docs-reconciliation push (**PR #83**, docs-only): two-pass `.md` corpus audit — removed stale/conflicting info and completed indexing across `README`/`CTO_ROADMAP` + `knowledge-base/`; closed `FINDINGS` `D-001`–`D-007` + `F-001`. This ledger row rides in the same PR. | **None** — docs-only; no `migrations/` or `shared/schema/` change (22 `.md` files). | KB index guard **PASS** (82 docs, all indexed, no dead links); zero dead code-file refs; zero broken `.md` links corpus-wide. | [ROLLBACK.md](./ROLLBACK.md) §1; `git revert -m 1 <merge-sha>` — safe, docs-only |
| 2026-07-08 | Ledger + borrower-tracker batch (7 deploys, one folded row): **#77–#80** docs — production change ledger maintenance (#77 07-08 batch + retroactive 07-06 rows, #78 prod migration-HEAD `0011` confirm, #80 #70 row) and **#79** the F1 `PROD_ACCEPTANCE_TEST` launch-gate checklist; **#81/#82/#84** borrower `JourneyTracker` — de-jargoned milestone labels (#81), `closing`/**Signing** split into its own milestone (#82), responsive compact-on-mobile layout (#84). (#83 docs-reconciliation carries its own row above.) | **None** — no `migrations/` or `shared/schema/` change; latest migration on `main` remains `0011`. | Code PRs #81/#82/#84: `tsc` clean + full unit suite **739 green** (nothing depends on the tracker's internal DOM). Docs PRs #77–#80: KB index guard clean. All deploys **READY** on `mortgage-stream.vercel.app`. | [ROLLBACK.md](./ROLLBACK.md) §1; each is an isolated merge commit — `git revert -m 1 <sha>` (e.g. `ffac818` for #84) |
| 2026-07-08 | **PR #70** — borrower consent revocation: `POST /api/consents/:consentType/revoke` (allowlisted to `tax_document_use`; credit consent keeps its staff-gated workflow) flips `borrower_consents.isRevoked` and purges the user's derived `tax_insights` rows so the staff DSCR feed + borrower graph stop reading them; writes a `consent.revoked` audit entry. Rebased 56 commits onto `main` (resolved the `storage.ts` CPA-methods conflict; caught + fixed a stray rebase conflict marker before merge). Merge `b283910`. | **None** — no migration: the `is_revoked` / `revoked_at` / `revocation_reason` columns already exist on `main`; the purge is a runtime row delete scoped to the session user (encrypted extraction lineage stays on the source document). Migration HEAD remains `0011`. | `tsc` clean; full unit suite **739**; integration `taxInsightRoutes` **10/10** incl. 4 new revocation cases (401 unauth · 400 non-revocable · revoke+purge+re-lock · 404 no-active), run against a locally-booted worktree server; **§9 security review PASS** (session-scoped revoke+purge, no IDOR, allowlisted, audited); prod deploy `dpl_DVekjPRHC7qwfZJJ85T3p95p4bs4` **READY** on `mortgage-stream.vercel.app` (built ~70s, `iad1`) | [ROLLBACK.md](./ROLLBACK.md) §1; `git revert -m 1 b283910` |
| 2026-07-08 | Cleanup-to-MVP batch — 10 PRs merged to `main` (newest→oldest): **#76** uploads dev-only local-storage fallback (§9 reviewed); **#64** MISMO F-018 `validateMISMOXML` follow-through (drop `BaseLoanAmount` from required set); **#75** MISMO F-019 valid `LoanPurposeType` enum + fail-loud construction; **#63** Buying Power Estimator + SEO articles; **#61** Approval Strength tool; **#74** KB reconcile #68/#69; **#73** KB consolidation + index guard; **#71** design-comment truth pass; **#69** L1 VISION_AND_SCOPE (its own deploy was superseded/canceled by the next push; content landed via #74); **#68** QA infra Phase 0. Current prod = merge `920b34a` (#76). | **None** — verified no commit in this batch touched `migrations/` or `shared/schema/` (`git log --since=2026-07-06 -- migrations/ shared/schema/`): code + docs only. Latest migration on `main` remains `0011`. | Full unit suite **739 green** + `tsc` clean pre-merge across the code PRs; **§9 security review PASS** on #76 (uploads — recorded on the PR); prod deploy `dpl_9RBz4K5Bxp3R418GMu4fh4DgyQHv` **READY** on `mortgage-stream.vercel.app` (built ~70s, `iad1`) | [ROLLBACK.md](./ROLLBACK.md) §1; each PR is an isolated merge commit — `git revert -m 1 <merge-sha>` reverts one (e.g. `920b34a` for #76) |
| 2026-07-06 *(retroactive — logged 2026-07-08)* | Tax Return Insight pipeline: **PR #55** (P0 consumer-direct tax upload → readiness signals) + **PR #66** (P1 CPA inviter-only referral portal) merged to `main`. | Migrations `0009` (lender_submission_package — **the row previously flagged PENDING on the 2026-07-05 entry below**), `0010` (tax_insights), `0011` (cpa_partners). Prior-session record indicates all three applied to prod on 2026-07-06 via raw `pg` client — per-migration transaction + manual `drizzle.__drizzle_migrations` insert (Neon-pooler workaround, see [TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §5), after finding prod stuck at `0008`. ✅ **Confirmed 2026-07-08: prod migration HEAD = `0011`** — a read-only check found **12/12 rows** in `drizzle."__drizzle_migrations"` (0000–0011), matching the repo journal. No pending migrations on prod. | Unit + integration green pre-merge; a HIGH review escalation (a self-registerable role added to `STAFF_ROLES`) was caught and fixed in `ae06fd4` before merge. | [ROLLBACK.md](./ROLLBACK.md) §1, §3 (migration rollback) |
| 2026-07-05 | Close-out push `049a7fc→809eb7c`: PR #52 (docs SDLC) + PR #51 (LS-10 slice 2 — lender MISMO package assembly). Includes this ledger row (docs follow-up). PR #53/#54 (overlapping pre-launch gates) held for coordination. | ⛔ **Migration `0009` (lender_submissions package columns) PENDING on prod** — founder-supervised `npm run db:migrate`; idempotent `ADD COLUMN IF NOT EXISTS`, and the write path is F1-gated so not urgent, but must precede any real lender submission | 656 unit + 73 integration green pre-push; server boot + `/api/health` 200 on :5002 | [ROLLBACK.md](./ROLLBACK.md) §1; `git revert -m 1 809eb7c` isolates the two PRs |
| 2026-07-04 (evening) | Launch-integration batch: 13 PRs (#37, #39–#50) merged to `main` in one founder-authorized push | none (migrations 0005–0008 already applied) | 647 unit + 73 integration tests green pre-push | [ROLLBACK.md](./ROLLBACK.md) §1–2 |
| 2026-07-04 | PR #38 — GSE delivery engines (SFC/QM/edit mirror), broker submission workflow, lender submissions, dual-AUS | Migrations 0005–0008 applied via direct `pg` client + manual journal insert (Neon pooler breaks `npm run db:migrate` — see the known-traps index in [TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §5) | Deploy verified live post-migration | [ROLLBACK.md](./ROLLBACK.md) §1, §3 |
| ≤ 2026-07-04 | Baseline — everything before this ledger existed: migrations `0000`–`0004` and all prior deploys | Verified applied/live in the 2026-07-04 source-of-truth audit | [ASSUMPTIONS.md](../governance/ASSUMPTIONS.md) §4 | — |
