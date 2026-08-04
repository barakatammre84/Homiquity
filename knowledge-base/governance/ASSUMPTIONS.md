# Assumptions & Facts Register

**Purpose:** one honest page separating what is **real**, what is **simulated**, and what
is **assumed/pending** — so nobody joining a sprint builds on a fact that isn't one.
**Maintenance rule:** every entry carries a verified-on date and a file reference. When an
assumption becomes fact (contract signed, env var set, PR merged), move it and update the
date in the same commit. If you find a claim here that the code contradicts, the code wins —
fix this file.

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
| Property valuation (AVM) | Simulated; realty-us/RealEstimate live endpoints exist but `RAPIDAPI_KEY` is Vercel-only (503 locally) | `server/services/rateService.ts`, property services (F7) |
| Rate sheets / pricing | Self-refreshing **demo** sheets (`version = "1.0-demo"`); internal PPE is the demo behind the future Lender Price/Mortech adapter | `seedMarketPricing`, roadmap F11 |
| Wholesale lender submissions | Target-5 catalog + status machine built; **no lender has credentialed us** | `server/services/lenderSubmission.ts`, `shared/wholesaleLenders.ts` |
| SMS sending | Compliance guards built (quiet hours, STOP ledger); **no SMS provider wired**, webhook signature check stubbed | `server/services/smsCompliance.ts` |

## 2. Pending business — assumed by the product, not yet true

| Assumption | Reality (verified 2026-07-04) | Unblocks |
|---|---|---|
| "Homiquity is a licensed broker" | **True at company level** *(corrected 2026-07-19)*: `shared/companyIdentity.ts` carries NMLS **#427468** with an Illinois-only `LICENSED_STATES` footprint (#154/#201). `mersOrgId` is still `PENDING`, and go-live remains behind the founder's pre-launch-gate flips — nothing commercial is real until those flip. | Go-live flips |
| "The app sends email" | **False in prod.** Code is complete (SendGrid + SMTP fallback) but no `SENDGRID_API_KEY` in Vercel → emails log to console | LS-2 |
| "Production errors are visible" | **False.** Sentry-style reporter built, no-op until `SENTRY_DSN` is set; no uptime monitor | LS-2 |
| "Uploaded documents persist in prod" | **False until LS-2.** Code side done (merged 2026-07-04, PR #44): the multer disk path is deleted, presigned-URL flow is the only path, and `request-url` returns a deliberate 503 `UPLOADS_UNCONFIGURED` until storage exists. Remaining = GCS bucket + credentials in Vercel, then the prod acceptance test | LS-2 |
| "CI runs on every push" | **True** *(re-verified 2026-07-19 evening)*: `.github/workflows/ci.yml` runs the required **`gate`** check (typecheck · unit tests · blocking prod audit · schema guard · design-token ratchet) on every PR, branch protection enforces it with `enforce_admins` on, and the `migrate-prod` job auto-applies migrations on merge ([CICD.md](../runbooks/CICD.md)). ⚠️ Enforcement follows plan/visibility: a 2026-07-19 private flip silently **deleted** the rule for ~2½ hours (#252–#259 merged pre-green; re-applied when the repo went public again) — verify protection is live before trusting `--auto` ([TEAM_PRACTICES](./TEAM_PRACTICES.md) §6). Integration tests stay manual — CI never runs them. | — |
| "Live mortgage rates" | Real vendor (realty-us RapidAPI) but key exists only in Vercel; local/dev sees simulated survey | — |
| "Homiquity is heading to correspondent" | **UNDECIDED — the largest open question about the capital structure.** The repo carried a full Fannie Mae seller/servicer delivery stack (1,482 lines) that a broker never uses. As of 2026-08-04 the channel is DECLARED `broker` in `shared/businessChannel.ts`, the stack is frozen by `pnpm guard:channel` (may shrink, not grow), and `mersOrgId` reads `NOT_APPLICABLE_BROKER_CHANNEL` rather than `PENDING`. Flipping to correspondent invalidates the asset-light finding (F-16) and makes the contingent-liability register incomplete. Checklist + consequences: [CHANNEL_DECISION.md](./CHANNEL_DECISION.md) | Founder decision |

## 3. Uncited policy values — live code, unverified provenance

Numbers that actively gate decisions but lack a regulatory citation (tracked as roadmap
items; the "no citation → not implemented" contract in kb/UNDERWRITING_SCENARIOS.md):

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

## 4. Facts verified against code this audit (2026-07-04)

- Auth is **email/password (scrypt)** with account lockout — not Replit OIDC (that era is
  over). `server/auth.ts`.
- Encryption **fails closed in production**: startup refuses to boot without
  `CREDIT_ENCRYPTION_KEY`; SSNs go through `ssnVault.ts`. The Feb-2026
  INFRASTRUCTURE_RISKS findings are resolved (doc archived).
- Migrations `0000`–`0023` are versioned SQL on `main` and applied to prod — prod HEAD
  confirmed **`0023`** on **2026-07-11** (`0013`–`0023`: income engine, scenario_runs, partner
  spine/consents, halal lane — applied via the Neon-pooler raw-`pg` workaround; per-wave rows in
  the [CICD.md](../runbooks/CICD.md) ledger). After any main merge, diff
  `drizzle.__drizzle_migrations` against the journal — migrations slip silently.
- The public site deploys in **pre-license gated mode**: `server/services/prelaunchGate.ts`
  fail-safes to gated in prod while the company NMLS id is `PENDING`, so a stranger sees only
  educational content + a waitlist. The full commercial funnel is built and behind the flag
  (roadmap armed-launch state).
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
