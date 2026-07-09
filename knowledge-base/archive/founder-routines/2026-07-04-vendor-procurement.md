# Vendor Procurement & Management — 2026-07-04

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**STATUS: OK** — no live vendor is degraded and no simulated seam is silently being treated as real; everything is on the same track as last check, with a short list of founder-only asks below.

## Human actions (procurement checklist)

⛔ **F1 NMLS licensing** — confirm current application/timeline status. Every other F-item and all commercial launch work is downstream of this. (`server/config/company.ts:4` still reads `nmlsId: "PENDING"`.)

⛔ **F10 — do the ~30 min setup** (still not done): subscribe to Fannie Selling Guide notifications, Freddie Guide bulletin emails, FHA INFO, and VA lender news; register for the Fannie Mae Developer Portal. Fannie's page is bot-protected, so email subscription is the only channel the automated regulatory watcher can't cover.

⛔ **Confirm Vercel env completeness** for roadmap #3/#4 (code has been ready since 2026-07-03): `SENDGRID_API_KEY` + `FROM_EMAIL`/`FROM_NAME` (real email delivery + SPF/DKIM DNS), and `SENTRY_DSN` (error visibility). Both fail silently to no-op today — there is no crash to alert you, so this needs an explicit check, not a wait-for-failure.

⛔ **F3 credit vendor (CRS One / iSoftpull) evaluation** — when engaging, request: SOC 2 report or equivalent security documentation, a signed DPA, and explicit FCRA permissible-purpose language in the contract (this vendor will handle real consumer credit data).

⛔ **F11 PPE comparison (Lender Price vs Mortech)** — start gathering pricing and SLA terms from both now so the MISMO 3.4 middleware ticket has a concrete target when F1 lands. (Per `broker-mismo-ppe-strategy` doctrine: these two, not Optimal Blue.)

⛔ **F4 Plaid production application** — production Link access requires a use-case review; starting the application now shortens the F1→launch runway.

⛔ **GitHub token scope** — roadmap #5 (minimal CI) is blocked on the repo's GitHub token lacking `workflow` scope; a PAT/token change is a founder account action, not something Claude can do.

## Summary

No live vendor dependency broke this week and no simulated seam has drifted into being treated as real — every vendor adapter still checks its credential env var, falls back to a clearly-flagged `simulated: true` response when unset, and fails loudly (throws) if a credential is set without the real adapter behind it. F1 NMLS is still `PENDING` — unchanged, and still the single blocker for all downstream commercial capability (F2, F8, and real closings). Two config items from last week (SendGrid/Sentry env vars) remain open with no visible symptom, which is exactly the kind of gap this routine exists to keep surfacing. One notable code-reality check: F6's "DU + LPA" dual-submission strategy has a DU (Fannie) simulation built (`ausSubmission.ts`); there is no Freddie LPA adapter or simulation in the codebase at all yet, simulated or otherwise — that's consistent with the roadmap's own "DU-only simulation today" note, not a new gap. `kb/founder-routines/` did not exist in the repo before this report; this is its first commit.

## Checks run → results → evidence

### F-item vendor status table

| F-item | Vendor(s) | Contract status | Unlocks when it lands | Founder action this week |
|---|---|---|---|---|
| **F1** NMLS | Company + state licensing | `PENDING` (`server/config/company.ts:4`, `mersOrgId` also `PENDING` at line 5) — unchanged | F2 state-routing gate, F8 assignment engine, real loan closings | Status/timeline check — critical path |
| **F3** Credit (CRS One / iSoftpull) | No contract | Simulated soft-pull, gated on `CRS_API_KEY`/`ISOFTPULL_API_KEY`, throws if set without adapter (`server/mcp/vendors.ts:69-76`); prod-side fabrication also blocked unless `CREDIT_VENDOR_MODE=simulation` (`server/services/creditService.ts:649-656`) | Real bureau scores/tradelines; unblocks the F28 medical-debt DTI logic that's gated on real collection tradelines | Start vendor eval — request SOC 2 + DPA + FCRA permissible-purpose language |
| **F4** Plaid production | Plaid | Sandbox only — `PLAID_ENV` defaults `"sandbox"` (`server/plaid.ts:5`); real path only activates when `PLAID_CLIENT_ID`/`PLAID_SECRET` are set (`server/services/ausSubmission.ts:56`) | Real Link + asset reports through the existing `/api/webhooks/plaid-assets` webhook | Apply for production access (use-case review) |
| **F5** Truv | Truv | No contract, **no code seam at all** — unlike F3/F6/F7 there is no simulated VOIE adapter anywhere in `server/` (only a one-line trigger-comment reference in `scenarioCatalog.ts:111`) | Real VOIE reports into `verification_reports` | Nothing to build pre-contract (correctly deferred per the "Future" section rule) |
| **F6** GSE AUS — DU + LPA | Fannie Mae DU, Freddie Mac LPA | No access. DU leg simulated (`server/services/ausSubmission.ts:154-202`, throws if `FANNIE_DU_API_KEY` set without adapter). **LPA has zero code** — grepped repo-wide, no Freddie/LPA reference outside comments | Real Day 1 Certainty findings; dual-engine best-fit per the 2026-07-04 strategy decision | Start the Fannie DU technology-provider onboarding paperwork (it's a process, not just an API key); scope what an LPA-side simulation would need before F1 lands |
| **F7** AVM | HouseCanary or other | Simulated, gated on `HOUSECANARY_API_KEY`, throws if set without adapter (`server/mcp/vendors.ts:151-156`) | Real valuations via `retrieve_property_valuation` | Compare HouseCanary vs alternatives on price/coverage |
| **F10** Regulatory subscriptions + Fannie Developer Portal | Fannie/Freddie/FHA/VA + Fannie Developer Portal | Not started — ~30 min founder task, unchanged from prior status | Fannie Selling Guide notifications (email is the only non-bot-protected channel); Fannie Developer Portal account | Do it this week — it's pure founder-account setup, zero engineering dependency |
| **F11** PPE — Lender Price / Mortech | Lender Price, Mortech | No contract; today's LLPA/demo-rate-sheet engine simulates this behind the same adapter interface pattern | MISMO 3.4 transfer middleware, dual-engine best execution + rate lock | Gather pricing/SLA terms from both (per broker-mismo-ppe-strategy doctrine — not Optimal Blue) |

### Simulated-vendor inventory vs. reality

All confirmed still correctly flagged `simulated: true` and mapped to their F-item; no new seam found since last review.

| Seam | File:line | Real adapter lands at | F-item |
|---|---|---|---|
| `softPullCredit` | `server/mcp/vendors.ts:64-134` | CRS One / iSoftpull soft-inquiry POST | F3 |
| `fetchAvm` | `server/mcp/vendors.ts:150-175` | HouseCanary valuation API | F7 |
| `parsePlaidAssetReport` | `server/services/ausSubmission.ts:55-123` | Plaid `/asset_report/get` (real path already live when creds are set — line 56) | F4 |
| `submitToDU` | `server/services/ausSubmission.ts:154-202` | Fannie DU Messages API (12.1) | F6 (DU leg only — no LPA leg exists) |
| `simulateCreditPullCompletion` | `server/services/creditService.ts:637-739` | n/a — dev/test-only fabrication path, fails closed in production | F3 |
| `fetchLiveRatesFromApi` | `server/services/rateService.ts:57-90` | RapidAPI mortgage-rate feed (falls back to simulated survey; also short-circuited when `INTAKE_PAUSED`) | F11-adjacent (today's demo engine, not a formal PPE) |

Each throws loudly if its credential env var is set without the real adapter implemented (e.g. `vendors.ts:73-75`, `:153-155`; `ausSubmission.ts:156-159`) — the fail-safe that prevents a half-wired vendor key from silently going live. This pattern held across all six seams; nothing regressed.

### Live-vendor risk review

- **Vercel** (deploy platform) — single point of failure for the whole app; no fallback host. `SENDGRID_API_KEY`/`FROM_EMAIL` (#3) and `SENTRY_DSN` (#4) status can't be verified from the repo (Vercel env isn't visible to this routine) — code degrades silently to console-log-only when unset (`emailService.ts:13`, `errorMonitoring.ts:40,53`), so an unset var produces no error to notice, only silence. Needs a founder confirmation, not a wait-and-see.
- **RapidAPI (realty-us)** — `RAPIDAPI_KEY` is dual-purpose: property/AVM data (per `property-data-vendor` memory, prod-only) **and** the live mortgage-rate fetch in `rateService.ts:64` hit the same host list (`rateService.ts:9-13`). One key revocation or rate-limit event degrades both features simultaneously. Both fall back safely to simulated data (`rateService.ts:66` logs and returns `null`; property lookups already 503 locally as expected).
- **SendGrid / Sentry** — config-pending, no crash risk today (app functions without them), but the blast radius is invisibility: a real production error or account-recovery email isn't seen by anyone until these are set.
- **Neon Postgres** — sole production DB; backup/failover cadence was not reviewed in this pass (out of this routine's scope — flagging for the compliance/ops routine to confirm a backup policy exists).
- **GitHub** — repo hosting + the known token limitation (lacks `workflow` scope, roadmap #5). Confirmed `.github/workflows/` still doesn't exist — CI remains un-restorable without a token change, which only the founder can make.

## Corrections table

| What memory/prompt assumed | What's actually true | Evidence |
|---|---|---|
| Multiple daily founder routines (compliance, lender, chaos, economics, lo-support) have been writing to `kb/founder-routines/` since 2026-07-04 | The directory did not exist in the repo or git history before this report — this is the first commit under that path | `git log --oneline --all -- kb/founder-routines/` returned nothing; `find` found no matches before this run |
| F6 doctrine describes "dual DU+LPA" submission | Only the DU (Fannie) leg has any code — simulated or otherwise. Freddie LPA has zero references outside prose/comments | repo-wide grep for `LPA|Freddie|LoanProductAdvisor` — no hits outside `pricing.ts` (unrelated LLPA fee logic) and roadmap text |

No other divergences found — F1 status, the simulated-vendor inventory, and the CI/env gaps all match current code and existing roadmap entries exactly.

## Remediation tickets

None. Every gap surfaced this week (F1–F11 status, CI restoration, SendGrid/Sentry env completion) is already tracked in `CTO_ROADMAP.md` (items 3, 4, 5, F1–F11) — nothing genuinely new to append, so the roadmap's "Do next" and "Future" sections are untouched this run.

---
STATUS: OK
