# Vendor Procurement & Management — 2026-07-06

**STATUS: WARN** — no live vendor is broken and no simulated seam is silently being treated as real, but F1 has no new signal and five launch-ops env items (GCS/SendGrid/Sentry/CRON_SECRET/homiquity.com domain) remain unconfirmed after multiple routine cycles with no founder action visible on any of them.

## ⛔ Human actions (procurement checklist)

1. **F1 NMLS licensing** — confirm current application/timeline status; still `PENDING` (`shared/companyIdentity.ts:15`, `server/config/company.ts:9` `mersOrgId` also `PENDING`). Everything commercial (F2, F8, real closings, wholesale-lender credentialing) is downstream of this — single longest-lead item.
2. **F3 credit vendor (CRS One / iSoftpull) evaluation** — when engaging, request: SOC 2 report (or equivalent), a signed DPA, and explicit FCRA permissible-purpose language in the contract. This vendor touches real consumer credit data the day it goes live.
3. **F6 sandbox prerequisites — start now, not after F1.** The Freddie LPA leg landed in code this week (see below) alongside the existing DU simulation, so both AUS legs are now dual-modeled — gather Fannie DU technology-provider onboarding requirements and Freddie LPA seller/servicer sandbox prerequisites in parallel; this also feeds the midday-lender routine's Target-5 wholesale-lender credentialing prep.
4. **F11 PPE comparison (Lender Price vs Mortech)** — gather pricing and SLA terms from both now so the MISMO 3.4 transfer-middleware ticket has a concrete target the day F1 lands. (Per `broker-mismo-ppe-strategy` doctrine: these two, not Optimal Blue.)
5. **F10 — still not done:** subscribe to Fannie Selling Guide notifications, Freddie Guide bulletin emails, FHA INFO, and VA lender news (email is the only non-bot-protected Fannie channel); register for the Fannie Mae Developer Portal. ~30 min, zero engineering dependency, open since at least 2026-07-04.
6. **Launch-ops env vars — still unconfirmed as of this check:**
   - `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` in Vercel (roadmap #1) — uploaded documents vanish on redeploy without this.
   - `SENDGRID_API_KEY` / `FROM_EMAIL` / `FROM_NAME` + SPF/DKIM DNS (roadmap #3) — code is ready, silently no-ops (console-log only) until set.
   - `SENTRY_DSN` + uptime monitor on `/api/health` (roadmap #4) — same silent no-op risk; a production crash today produces no alert to anyone.
   - `CRON_SECRET` (`vercel.json` crons: `/api/jobs/lifecycle`, `/api/jobs/adverse-action-delivery`) — unset degrades the lifecycle sweep and the adverse-action watchdog to admin-manual with no error surfaced.
   - **`homiquity.com` domain attach** — confirmed still not attached: `GET https://homiquity.com/api/health` returned **404** just now, while the known-good `https://mortgage-stream.vercel.app/api/health` returned 200. Borrowers can only reach the platform via the `.vercel.app` URL until this is fixed in the Vercel project's domain settings.
7. **F4 Plaid production application** — production Link access needs a use-case review; starting now shortens the F1→launch runway. Still sandbox-only (`server/plaid.ts:5` `PLAID_ENV` defaults `"sandbox"`).
8. **GitHub token scope** — roadmap #5 (minimal CI) stays blocked on the repo token lacking `workflow` scope; `ci.yml` is written and sitting on a local branch waiting for a human push. Founder-only account action.

## Summary

No live vendor dependency degraded this week and every vendor adapter still checks its credential env var, falls back to a clearly-flagged `simulated: true` response when unset, and throws loudly if a credential is set without the real adapter behind it — that fail-safe pattern held across all seams checked, including one genuinely new one. The standout finding: **the Freddie Mac LPA leg (`submitToLPA`, `server/services/ausSubmission.ts:224-265`) was added this week** (commit `cf044c9`, "LPA leg for dual-AUS — sprint P1") — last week's report (2026-07-04) explicitly found zero LPA code anywhere in the repo, so this is a new simulated seam, and it's correctly flagged (`simulated: true`) and gated (throws if `FREDDIE_LPA_API_KEY` is set without a real adapter), same as the DU leg. F1 NMLS remains `PENDING` with no new signal. The `homiquity.com` domain is confirmed not yet attached to the Vercel project (404 vs. the `.vercel.app` URL's 200) — this plus the still-unconfirmed GCS/SendGrid/Sentry/CRON_SECRET env vars are the same open ops items flagged in the prior report, now aging across at least two routine cycles with no visible founder action, which is the WARN trigger this week.

## Evidence

### F-item vendor status table

| F-item | Vendor(s) | Contract status | Unlocks when it lands | Founder action this week |
|---|---|---|---|---|
| **F1** NMLS | Company + state licensing | `PENDING` (`shared/companyIdentity.ts:15`, `server/config/company.ts:9`) — unchanged | F2 state-routing gate, F8 assignment engine, real closings, wholesale-lender credentialing | Status/timeline check — critical path |
| **F3** Credit (CRS One / iSoftpull) | No contract | Simulated soft-pull, gated on `CRS_API_KEY`/`ISOFTPULL_API_KEY`, throws if set without adapter (`server/mcp/vendors.ts:69-76`); prod-side fabrication also fails closed (`server/services/creditService.ts:637-739`, `simulateCreditPullCompletion` is dev/test-only) | Real bureau scores/tradelines; unblocks F28's medical-debt DTI logic (gated on real collection tradelines) | Start vendor eval — request SOC 2 + DPA + FCRA permissible-purpose language |
| **F4** Plaid production | Plaid | Sandbox only — `PLAID_ENV` defaults `"sandbox"` (`server/plaid.ts:5`); real path activates when `PLAID_CLIENT_ID`/`PLAID_SECRET` are set (`server/services/ausSubmission.ts:56,65`) | Real Link + asset reports through the existing webhook | Apply for production access (use-case review) |
| **F5** Truv | Truv | No contract, no code seam — only a one-line comment reference (`server/services/underwritingNuance.ts:252`) | Real VOIE reports into `verification_reports` | Nothing to build pre-contract — correctly deferred |
| **F6** GSE AUS — DU + LPA | Fannie Mae DU, Freddie Mac LPA | No access to either. **Both legs now simulated in code** — DU (`ausSubmission.ts:141-203`, throws if `FANNIE_DU_API_KEY` set without adapter) and, new this week, LPA (`ausSubmission.ts:224-265`, throws if `FREDDIE_LPA_API_KEY` set without adapter) | Real Day-1-Certainty findings, dual-engine best-fit per the 2026-07-04 doctrine | Start Fannie DU technology-provider onboarding paperwork; begin scoping Freddie LPA sandbox/seller-servicer prerequisites now that the code shape exists |
| **F7** AVM | HouseCanary or other | Simulated, gated on `HOUSECANARY_API_KEY`, throws if set without adapter (`server/mcp/vendors.ts:150-156`) | Real valuations via `retrieve_property_valuation` | Compare HouseCanary vs. alternatives on price/coverage |
| **F10** Regulatory subscriptions + Fannie Developer Portal | Fannie/Freddie/FHA/VA + Fannie Developer Portal | Not started — unchanged | Fannie Selling Guide notifications (email-only channel); Developer Portal account | Do it this week — pure founder-account setup |
| **F11** PPE — Lender Price / Mortech | Lender Price, Mortech | No contract; today's internal LLPA/demo-rate-sheet engine (`server/services/rateService.ts`, `pricingAdapter.ts`) simulates behind the same swappable-adapter pattern | MISMO 3.4 transfer middleware, dual-engine best execution + rate lock | Gather pricing/SLA terms from both (not Optimal Blue) |

### Simulated-vendor inventory vs. reality

| Seam | File:line | Real adapter lands at | F-item | Status |
|---|---|---|---|---|
| `softPullCredit` | `server/mcp/vendors.ts:64-134` | CRS One / iSoftpull soft-inquiry POST | F3 | Unchanged, correctly flagged |
| `fetchAvm` | `server/mcp/vendors.ts:150-175` | HouseCanary valuation API | F7 | Unchanged, correctly flagged |
| `parsePlaidAssetReport` | `server/services/ausSubmission.ts:55-123` | Plaid `/asset_report/get` (real path already live when creds are set) | F4 | Unchanged, correctly flagged |
| `submitToDU` | `server/services/ausSubmission.ts:141-203` | Fannie DU Messages API (12.1) | F6 (DU leg) | Unchanged, correctly flagged |
| `submitToLPA` | `server/services/ausSubmission.ts:207-265` | Freddie Mac LPA submission API | F6 (LPA leg) | **NEW since 2026-07-04** (commit `cf044c9`) — correctly flagged `simulated: true`, throws if `FREDDIE_LPA_API_KEY` set without adapter (`:225-231`); risk-class messages carry an explicit `LPA-SIM-*` code prefix so they can never be mistaken for real findings |
| `submitToLenderPortal` (via `submitToWholesaleLender`) | `server/services/lenderSubmission.ts:47-176` | Per-wholesale-lender portal API, once a broker-lender agreement exists | N/A (not F1-F11 — broker-lender agreements, LS-10 slice 3) | Unchanged; already tracked in `CTO_ROADMAP.md` LS-10/next-engineering-item, not a new gap |
| `fetchLiveRatesFromApi` | `server/services/rateService.ts:57-90` | RapidAPI mortgage-rate feed (falls back to simulated survey; short-circuited when `INTAKE_PAUSED`) | F11-adjacent (today's demo engine, not a formal PPE) | Unchanged |
| `simulateCreditPullCompletion` | `server/services/creditService.ts:637-739` | n/a — dev/test-only fabrication, fails closed in production | F3 | Unchanged |
| `simulateKycScreening` (OFAC/sanctions) | `server/routes/borrower.ts:3280-3300` | A real KYC/AML/OFAC screening provider | Not on the F1-F11 list — pre-existing since the initial commit (2026-06-01), not new this week | Flagging for completeness: this is a simulated vendor seam with no F-item home today. Low urgency pre-launch (screening feeds are correctly gated behind manual staff review, never auto-clears), but worth a founder decision on whether to fold it into F-item tracking once a real provider is being evaluated. Not filing an engineering ticket — this is a compliance/vendor-scoping question, not a code gap. |

Every credential-gated seam still throws loudly if its env var is set without the real adapter wired (`vendors.ts:73-75,153-155`; `ausSubmission.ts:156-159,225-231`) — confirmed no vendor credential is set even locally (checked `.env` — none of `CRS_API_KEY`, `ISOFTPULL_API_KEY`, `HOUSECANARY_API_KEY`, `PLAID_CLIENT_ID/SECRET`, `FANNIE_DU_API_KEY`, `FREDDIE_LPA_API_KEY`, `RAPIDAPI_KEY`, `SENDGRID_API_KEY`, `SENTRY_DSN` are present).

### Live-vendor risk review

- **Vercel** (deploy platform) — single point of failure, no fallback host.
  - `homiquity.com` domain: **confirmed not attached** — `curl -s -o /dev/null -w '%{http_code}' https://homiquity.com/api/health` → **404**; control check against `https://mortgage-stream.vercel.app/api/health` → **200**. Borrowers can only reach the `.vercel.app` URL today.
  - `GCS_SERVICE_ACCOUNT_KEY`/`PRIVATE_OBJECT_DIR` (#1), `SENDGRID_API_KEY`/`FROM_EMAIL` (#3), `SENTRY_DSN` (#4), `CRON_SECRET` — none verifiable from the repo (Vercel env isn't visible to this routine); all degrade silently to no-op/admin-manual when unset, so there is no error to notice, only silence. `CRON_SECRET` specifically gates `vercel.json`'s two cron jobs (`server/routes/jobs.ts:15-24`) — the lifecycle sweep and adverse-action watchdog fall back to admin-manual trigger without it.
- **RapidAPI (realty-us)** — `RAPIDAPI_KEY` is dual-purpose: property/AVM data (Vercel-only per prior review) and the live mortgage-rate fetch (`rateService.ts:9-13,64`) hit the same host list. One key revocation or rate-limit event degrades both simultaneously; both fall back safely to simulated data.
- **SendGrid / Sentry** — config-pending, no crash risk today (app functions without them), but blast radius is invisibility: a real production error or account email isn't seen by anyone until set.
- **Neon Postgres** — sole production DB. Backup/failover cadence remains out of this routine's scope (flagged previously for the compliance/ops routine).
- **GitHub** — token still lacks `workflow` scope (roadmap #5); `.github/workflows/` confirmed still absent from `main`. `ci.yml` remains stranded on a local/unpushed branch — founder-only fix.

## Corrections table

| What was assumed | What's actually true | Evidence |
|---|---|---|
| F6 "dual DU+LPA" was DU-only in code, LPA existed only in prose/comments (per 2026-07-04 report) | LPA now has a real, correctly-flagged simulation (`submitToLPA`) as of this week — the dual-AUS strategy is now dual-*coded*, not just dual-*decided* | `git log --oneline -S "submitToLPA" -- server/services/ausSubmission.ts` → `cf044c9` |

No other divergences found this week.

## Tickets

None. The LPA-leg addition is progress, not a gap, and is already covered by the existing F6/LS-10 roadmap entries. Everything else surfaced here (F1-F11 status, ops env vars, domain attach, GitHub token scope) is already tracked in `CTO_ROADMAP.md` (LS-1, LS-2, LS-4, roadmap #1/#3/#4/#5, F1-F11) — nothing genuinely new to append. `CTO_ROADMAP.md` "Future" section left untouched, as required.

---
STATUS: WARN
