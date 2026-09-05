# Assumptions & Facts Register

> **Freshness:** last verified 2026-09-04 · review every 30 days — enforced by `scripts/doc-freshness-guard.cjs`.

**Purpose:** one honest page separating what is **real**, what is **simulated**, and what
is **assumed/pending** — so nobody joining a sprint builds on a fact that isn't one.
**Maintenance rule:** every entry carries a verified-on date and a file reference. When an
assumption becomes fact (contract signed, env var set, PR merged), move it and update the
date in the same commit. If you find a claim here that the code contradicts, the code wins —
fix this file.

**2026-08-04 partial pass (financial architecture audit).** Scope was the repo-verifiable
claims only — §1's simulated-vendor rows and the migration facts below were re-read against the
code; the **ops rows in §2 (Vercel env vars, SendGrid, Sentry, GCS) were NOT re-verified** because
they are account state this codebase cannot see. Corrected in this pass: the migration HEAD claim,
which asserted `0023` while `main` carries **39 migration files through `0038`** (this branch adds
`0039`–`0044`). Prod's *applied* HEAD is a database fact and is deliberately not asserted here —
`migrate-prod` auto-applies on merge, so diff `drizzle.__drizzle_migrations` against the journal to
confirm. New this pass: `shared/businessChannel.ts` declares the channel `broker` and the Fannie
delivery stack is frozen (`pnpm guard:channel`) pending
[CHANNEL_DECISION.md](./CHANNEL_DECISION.md).

**2026-08-06 platform note (not a verification pass).** Hosting moved from Vercel to **Railway**;
the Vercel project has been deleted, so every "in Vercel" phrase in the rows below now reads
*Railway service variable* (Railway → project *Homiquity* → service *Homiquity* → Variables).
The 2026-08-04 note above is left as written — it records what that pass did and did not check.
Two ops facts the move surfaced, both worth knowing before you trust any "prod is fine" claim:
a **failed** Railway deploy leaves the previous container serving (nine failed in a row on
2026-08-06, prod ~8 commits stale, every check green — only `/api/health`'s `commit` field
disproves it), and `/api/health`'s `SELECT 1` succeeds against *any* reachable Postgres, so a
green health check does not prove `DATABASE_URL` points at the intended Neon branch (it did not
— data routes 500'd while health stayed 200). See
[TEAM_PRACTICES](./TEAM_PRACTICES.md) §5 known-traps index.

**2026-09-04 repository verification pass.** The code-verifiable claims below were checked again.
`main` has 61 migration files through `0060`; the Core lineage release adds `0061`.
`BUSINESS_CHANNEL` remains `broker`, the delivery-stack ratchet still passes, and the required CI
gate now runs the integration lane as well as unit/client tests. The company NMLS id is no longer
pending, so an unset prelaunch flag no longer gates production automatically; an explicit
`PRELAUNCH_GATED=true` can still do so. Railway variables, vendor credentials, executed lender
agreements and other account state were not re-verified from the repository. Those rows retain
their last-observed dates and must not be read as current account evidence.

Last full verification pass: **2026-07-04** (source-of-truth audit). Spot-updated **2026-07-08**
for migration HEAD and the pre-license gated-launch state, and **2026-07-12** (docs-hygiene pass)
for: prod migration HEAD now **`0023`** (0000–0023 applied), the gated-beta money path (intake →
LO claim → DU/LPA → wholesale package) verified live and deployed (#135–#139 — see
[BETA_GO_LIVE_READINESS.md](../runbooks/BETA_GO_LIVE_READINESS.md)), and the CI-branch
correction in §2. Entries still dated `2026-07-04` were not re-verified — trust the
[CICD.md](../runbooks/CICD.md) production change ledger and [CTO_ROADMAP.md](../../CTO_ROADMAP.md)
for anything that has moved since.

---

## 1. Simulated — looks real in the app, is not

Every vendor integration is a **deterministic simulation behind an adapter** (by design —
see CLAUDE.md ground rules). Each real contract converts one row here into a small
"implement the real adapter" ticket (roadmap F3–F11).

| Capability | Reality | Where |
|---|---|---|
| Credit pulls (tri-bureau, scores, debt ledger) | Simulated; the adapter **deliberately throws** if a real key is set before a real implementation exists | `server/mcp/vendors.ts` (F3) |
| DU (Fannie) AUS submission | Simulated response, DU-12.1-shaped — the Run-DU/LPA **UI trigger** + XSD-conformance recording are wired (#135); the vendor leg stays simulated | `server/services/ausSubmission.ts` (F6) |
| LPA (Freddie) AUS leg | Simulated (dual-AUS strategy decided 2026-07-04) | `server/services/ausSubmission.ts` (F6) |
| Asset/income verification (Plaid, Truv) | Wiring + webhooks exist; no production keys | `server/plaid.ts` (F4, F5) |
| Property valuation (AVM) | Simulated. realty-us/RealEstimate live endpoints exist in code, but **`RAPIDAPI_KEY` is not set anywhere** — it lived only in the Vercel project, which was deleted 2026-08-06, and was never re-created in Railway. The live endpoints therefore 503 in production too, not just locally. Setting it is LS-2-class ops work | `server/services/rateService.ts`, property services (F7) |
| Rate sheets / pricing | Self-refreshing **demo** sheets (`version = "1.0-demo"`); internal PPE is the demo behind the future Lender Price/Mortech adapter | `seedMarketPricing`, roadmap F11 |
| Wholesale lender submissions | Target-5 catalog + status machine built; **no lender has credentialed us** | `server/services/lenderSubmission.ts`, `shared/wholesaleLenders.ts` |
| SMS sending | Compliance guards built (quiet hours, STOP ledger); **no SMS provider wired**, webhook signature check stubbed | `server/services/smsCompliance.ts` |

## 2. Pending business — assumed by the product, not yet true

| Assumption | Reality (verified 2026-07-04) | Unblocks |
|---|---|---|
| "Homiquity is a licensed broker" | **True at company level** *(corrected 2026-07-19)*: `shared/companyIdentity.ts` carries NMLS **#427468** with an Illinois-only `LICENSED_STATES` footprint (#154/#201), plus IL Residential Mortgage License **#3423789** (#419). *(Corrected 2026-08-06: `mersOrgId` is **no longer `PENDING`** — the F-14 channel declaration set `BUSINESS_CHANNEL = "broker"`, so `mersOrgIdApplicable()` is false and `server/config/company.ts` resolves it to `NOT_APPLICABLE_BROKER_CHANNEL`. MERS registration is the wholesale lender's obligation in the broker channel.)* Go-live remains behind the founder's pre-launch-gate flips — nothing commercial is real until those flip. | Go-live flips |
| "The app sends email" | **Account state not re-verified.** Code supports SendGrid + SMTP and otherwise logs in development; the last recorded production check found no `SENDGRID_API_KEY` in Railway (2026-08-17). | LS-2 |
| "Production errors are visible" | **Account state not re-verified.** The reporter is a no-op without `SENTRY_DSN`; the last recorded check found neither that variable nor an uptime monitor (2026-08-17). | LS-2 |
| "Uploaded documents persist in prod" | **Account state not re-verified.** Code is fail-closed: the presigned flow is the only persistent upload path and production returns `UPLOADS_UNCONFIGURED` without GCS. The last recorded Railway check found the GCS variables absent (2026-08-17); a real upload → redeploy → download acceptance test is still required. | LS-2 |
| "CI runs on every push" | **True in repository configuration (re-verified 2026-09-04):** `.github/workflows/ci.yml` runs the required `gate` on every PR, including typecheck, unit/client tests, production build, self-host boot, and the HTTP integration lane. `migrate-prod` applies migrations after merge and `verify-deploy` checks that production serves the merged commit. Branch-protection and secret values remain external account state and must be checked before relying on auto-merge. Scheduled jobs curl `/api/jobs/*`, so `CRON_SECRET` must match in GitHub and Railway. | — |
| "Live mortgage rates" | **Account state not re-verified.** The RapidAPI adapter exists and falls back to the simulated survey without `RAPIDAPI_KEY`; the last recorded Railway check found the key absent (2026-08-17). | — |
| "Homiquity is heading to correspondent" | **UNDECIDED — the largest open question about the capital structure.** The repo carried a full Fannie Mae seller/servicer delivery stack (1,482 lines) that a broker never uses. As of 2026-08-04 the channel is DECLARED `broker` in `shared/businessChannel.ts`, the stack is frozen by `pnpm guard:channel` (may shrink, not grow), and `mersOrgId` reads `NOT_APPLICABLE_BROKER_CHANNEL` rather than `PENDING`. Flipping to correspondent invalidates the asset-light finding (F-16) and makes the contingent-liability register incomplete. Checklist + consequences: [CHANNEL_DECISION.md](./CHANNEL_DECISION.md) | Founder decision |

## 3. Uncited policy values — live code, unverified provenance

Numbers that actively gate decisions but lack a regulatory citation (tracked as roadmap
items; the "no citation → not implemented" contract in knowledge-base/compliance/UNDERWRITING_SCENARIOS.md):

- **Roadmap #29 — resolved (merged 2026-07-04, PR #39):** VA residual income unified on the
  cited 22% tax-estimate model; the 5% reduction verified real (26-7 Item 43) but disjunctive
  (gate corrected to OR); family-of-seven cap added; ledger entries
  `va-26-7-ch4-residual-reduction` + `platform-va-residual-tax-estimate`; compliance
  invariants now also read `underwritingEngine.ts`.
- **Roadmap #30–32 — resolved (merged 2026-07-04, PR #45):** every conventional policy scalar
  in `seedLendingGrids.ts` now carries a ledger citation (agency-sourced or explicitly
  PLATFORM POLICY); the dead `INCOME_DISCREPANCY_THRESHOLD_PCT` constant was deleted. One
  open verification: the Eligibility Matrix 95/97 LTV split needs a human pass (source PDF
  is bot-protected).

## 4. Facts verified against code (latest repository pass 2026-09-04)

- Auth is **email/password (scrypt)** with account lockout — not Replit OIDC (that era is
  over). `server/auth.ts`.
- Encryption **fails closed in production**: startup refuses to boot without
  `CREDIT_ENCRYPTION_KEY`; SSNs go through `ssnVault.ts`. The Feb-2026
  INFRASTRUCTURE_RISKS findings are resolved (doc archived).
- Migrations are versioned SQL on `main` — **61 files through `0060` as of 2026-09-04**; the
  Core document-lineage release adds `0061`. The figures below are the 2026-07-11 snapshot. Prod HEAD
  confirmed **`0023`** on **2026-07-11** (`0013`–`0023`: income engine, scenario_runs, partner
  spine/consents, halal lane — applied via the Neon-pooler raw-`pg` workaround; per-wave rows in
  the [CICD.md](../runbooks/CICD.md) ledger). After any main merge, diff
  `drizzle.__drizzle_migrations` against the journal — migrations slip silently.
- The company NMLS id is issued in `shared/companyIdentity.ts`. With no explicit environment
  override, `server/services/prelaunchGate.ts` therefore leaves the commercial surfaces open;
  `PRELAUNCH_GATED=true` can still gate them. The current Railway value is not repository-verifiable.
- Dev test login: **11 fixture accounts**, single shared `DEV_TEST_PASSWORD` env var, endpoint
  404s in production. No credentials live in the repo (TEST_ACCOUNTS.md matches
  `setupDevTestLogin`). Note (2026-07-12): the `realtor` partner role added by PH-1 has **no
  fixture** — realtor accounts come from the PH-1 registration/admin-queue path.
- Dark mode is **unreachable by users** (no ThemeProvider/toggle) — decided unsupported
  (roadmap #21).
- The underwriting engine is deterministic with no vendor calls inside it
  (`server/underwritingEngine.ts`, `server/services/decisionEngine.ts`).

## 5. Documents corrected or archived by this audit

| Document | What was wrong | Action taken |
|---|---|---|
| `LAUNCH_READINESS_CHECKLIST.md` | Feb-2026 Replit-era: `db:push` to prod, Replit Auth/checkpoints, "80% ready" verdict | Archived → `kb/archive/` |
| `INFRASTRUCTURE_RISKS.md` | Feb-2026 findings since fixed (fail-closed encryption); references deleted `server/replit_integrations/` | Archived → `kb/archive/` |
| `TEST_ACCOUNTS.md` | Wrong account list, hardcoded passwords for a system that was deliberately removed | Rewritten from `server/auth.ts` |
| `PRODUCT_SPINE.md` | Stack said Replit OIDC/Replit storage; declared an "active" feature freeze superseded by the launch sprint | Stack + rule sections corrected |
| `CICD.md` | Claimed CI runs on every push (contradicted itself and `main`) | Corrected to actual state |
| `CTO_ROADMAP.md` launch sprint | Pointed at dead branch names; PR #38 shown unlanded though merged + prod-migrated | Statuses refreshed to PR reality |
