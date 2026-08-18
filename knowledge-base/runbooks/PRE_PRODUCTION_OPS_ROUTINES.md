# Pre-Production Daily Operating Routines

**Date adopted:** 2026-07-04 · **Lens:** the founder's daily operating system between "platform built" and "platform launched" — QA, vendor credentialing, liquidity acquisition
**Companion docs:** [CTO_ROADMAP.md](../../CTO_ROADMAP.md) (live checklist — items 27/28 added from this doctrine) · [REGULATORY_MONITORING.md](../compliance/REGULATORY_MONITORING.md) · [UNDERWRITING_SCENARIOS.md](../compliance/UNDERWRITING_SCENARIOS.md) · [AI_GOVERNANCE_POLICY.md](../governance/AI_GOVERNANCE_POLICY.md)

> **Automation (updated 2026-07-04 evening — launch-sprint consolidation):** the scheduled-task suite, which had grown to 16 executive routines, was cut back to a **5-routine launch suite**: `morning-compliance-defense` = **Morning Launch Gate** 7:51 AM (test/typecheck/invariant gates + security quick-scan + AAN seams + the LAUNCH-DISTANCE scoreboard; absorbed the retired security-posture, risk-governance, code-checkup, and bridge-bind routines), `daily-sprint-blitz` = **Sprint Blitz Executor** 9:03 AM (the routine that BUILDS — claims one launch-sprint engineering item per run and ships it as a gated PR from an isolated worktree), `midday-lender-liquidity` = **Lender Delivery Gate** 12:31 PM (Routine 2 below), `evening-economics-gtm` = **Evening Launch Triage** 6:38 PM (report triage + maintains the 🚀 Launch sprint section of CTO_ROADMAP.md + repo/session hygiene + docs-only publish via a PR merged on a green gate — direct pushes to `main` are blocked and barred ([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §6), so the old "publish local main" lane stays dead ([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §6); margin rehearsal suspended until a real rate sheet or F11 lands), and `weekly-vendor-procurement` Mondays 9:33 AM (absorbed the daily vendor-portal sweep). **Routine 3 (chaos drills) is suspended until real traffic/F3** — the kill switch is verified (#27) and the medical-debt drill is F3-gated; the other 11 retired routines are disabled with `[RETIRED]` markers, prompts preserved for post-launch revival. Each live routine emits a dated report into [`knowledge-base/logs/`](../logs/) — the launch-era `kb/founder-routines/` corpus was archived to [`knowledge-base/archive/founder-routines/`](../archive/founder-routines/) on 2026-07-08 and **must never be written to again** (it is a quarantined snapshot). Human-only steps (portal logins, lender calls) are emitted as checklists, not simulated. This doc remains the corrected doctrine.

> **Provenance note:** this doctrine arrived as external research (2026-07-04) and was verified against the codebase before adoption — same discipline as every kb doc: trust the code, not the claim. The corrections table below records where the source text and reality diverged. Items marked ⛔ are **blocked on an F-item** (business contract/licensing) and are listed so the routine doesn't silently skip them.

## Corrections applied to the source doctrine

| Source claim | Verified reality |
|---|---|
| "MISMO 3.6 XML export" | We generate **MISMO 3.4** (`server/mismo.ts`, `DataVersionIdentifier 3.4.0`) — deliberately: 3.4 is what DU/LPA and the F11 PPE middleware target. Do not chase 3.6 until a counterparty demands it. |
| "Log into Plaid/Equifax/Experian portals" | No live vendor portals exist yet — credit, Plaid, Truv, AVM are **simulated until contracts** (roadmap F3–F7). Real portals today: **Railway, Neon, SendGrid, Sentry, RapidAPI**. *(This row said "Vercel" when written 2026-07-04; the platform moved to Railway on 2026-08-06 and the Vercel project was deleted.)* |
| "July 2026 Reg B rules and the Medical Debt DTI exclusion are explicitly tested" | **Verified 2026-07-04 (roadmap #28):** the "federal Medical Debt DTI exclusion" **does not exist** — the CFPB Reg V medical-debt rule was vacated 2025-07-11 (no appeal; same ruling held FCRA preempts state reporting bans). The real "July 2026 Reg B rule" is the **disparate-impact amendment eff. 2026-07-21** — unrelated to medical debt; our four-fifths monitoring is retained as internal risk management, never framed as a Reg B requirement. The citable medical carve-outs are *agency* policies, now in `regulatory-ledger.json`: Fannie B3-5.3-09 (medical collections exempt from payoff limits) and FHA 4000.1 (non-medical collections > $2,000 add 5% of balance to DTI; medical excluded). Engine build ships with F3. |
| "Verify AAN routes via emailService.ts" | It now does at both seams: staff status→denied fires the neutral email (`server/routes/lending/statusDecisions.ts`), and **AAN generation itself** now also fires it (`server/routes/compliance.ts`, added 2026-07-04) so ECOA delivery never depends on a separate status flip. |
| "Flip the environment variable... that pauses all new applications" | **Did not exist — built 2026-07-04** (roadmap #27): `INTAKE_PAUSED=true`, see Routine 3. |
| "Review rates from `rateService.syncBestExecutionRates()` against origination fees" | The function is real (`server/services/rateService.ts`, admin refresh route) but current rate sheets are the **`1.0-demo` seed** — margin math on demo sheets is rehearsal, not reconciliation. It becomes real when a genuine wholesale sheet is uploaded (staff rate-sheet flow) or F11 PPE lands. |
| "2026 HBPA bans trigger-lead buying" | **Verified 2026-07-04:** real and in force — Homebuyers Privacy Protection Act, **Pub. L. 119-36** (H.R. 2808), signed 2025-09-05, amending FCRA §604(c) (15 U.S.C. §1681b(c)), effective ~2026-03-04 (180 days after enactment). CRAs may furnish mortgage trigger leads only to a party with documented consumer opt-in, the current originator, the current servicer, or a depository/CU holding the consumer's account. Ledgered (`hppa-trigger-leads`). Our posture is structurally compliant: all lead acquisition is first-party (`POST /api/leads` requires TrustedForm cert + consent IP/UA/timestamp); re-check the ledger entry before any paid-lead initiative. |

---

## Routine 1 — Morning: Compliance & Vendor Unblocking (defense)

Clear the hurdles that can physically prevent launch before doing anything else.

1. **Vendor portal sweep (today's real list):** Railway (project `Homiquity` → service `Homiquity` → **Deployments** for build/deploy status, **Variables** for env), Neon (branch/compute state), SendGrid (domain auth, suppression list — once the key is set, roadmap #3 ops), Sentry (new errors — once DSN is set, roadmap #4 ops), RapidAPI (rate-limit warnings on realty-us). ⛔ Plaid/credit-bureau/Truv portals join this sweep as F3–F5 contracts land.

   ⚠️ **Reading the Railway deploy status is not enough.** A *failed* Railway deploy leaves the previous container serving, so the site stays up and every check stays green while prod silently goes stale — that is exactly the 2026-08-06 incident (nine consecutive failed builds, ~8 commits behind, nothing said so). The one-line sweep that actually proves the merge shipped:
   ```bash
   curl -sS https://www.homiquity.com/api/health   # compare `commit` against `git rev-parse origin/main`
   ```
   A 200 proves the process is alive and *a* database answered — nothing more. On 2026-08-06 it answered 200 from a **stale Neon branch** while `/api/articles` and `/sitemap.xml` 500'd, so spot-check one data-backed route too. Full triage: [ROLLBACK.md](./ROLLBACK.md) §0.
2. **The 2026 guardrail check:**
   ```bash
   npx vitest run tests/complianceInvariants.test.ts --config vitest.config.ts
   ```
   33 tests: AI never in the credit-decision path, intake decisioning fully deterministic, denial cannot outrun its adverse-action notice, ECOA §1002.9 block present. Baseline 2026-07-04: **33/33 green**. ⚠️ Medical-collections handling is *not* among them — verified 2026-07-04 as agency policy (not a federal rule), engine build ships with F3 (roadmap #28). Note the invariants are unaffected by the 2026-07-21 Reg B disparate-impact amendment — they enforce determinism, not the effects test.
3. **Adverse Action audit:** generate one test denial (staff → `POST /api/loan-applications/:id/credit/adverse-action`). Verify: the notice renders at `/adverse-action/:id` with reasons + bureau contact + dispute rights; the reason is deterministic (never "AI decision" — enforced by the invariant tests, `AI_GOVERNANCE_POLICY.md`); the borrower got the in-app notification **and** the deliberately neutral email (console-logged until `SENDGRID_API_KEY` is set).
4. **Regulatory freshness:** `pnpm checkup` runs `scripts/regulatory-freshness.cjs` — fails if any `data/regulatory/regulatory-ledger.json` entry is overdue for re-verification.

## Routine 2 — Mid-Day: Lender Liquidity & Concierge Sales (offense)

A marketplace without lenders is dead on arrival. ✅ **F1 CLEARED 2026-07-13 — the company is licensed (NMLS #427468, `shared/companyIdentity.ts`; Illinois only, IL Residential Mortgage License #3423789, IDFPR). Outbound lender onboarding is UNBLOCKED.** This block stopped being *preparation* and became *the work* — and it stayed mislabelled here for three weeks, so treat the shortlist's "once F1 clears" items as overdue, not pending. Tracked as **CTO_ROADMAP §1.5**.

1. **The "Target 5" pipeline:** maintain the shortlist of 3–5 initial wholesale lenders in [`knowledge-base/research/my-research/`](../research/my-research/). The pre-F1 goal (collect broker-approval requirements, sandbox prerequisites, pricing-matrix formats) is **done** — the remaining actions are outbound: AE/hotline calls, sandbox requests, approval checklists. Re-verify each lender is still wholesale-broker-friendly and NMLS-active first; the shortlist is a 2026-07-04 snapshot.
2. **Scenario translation:** any underwriting quirk learned from a lender conversation (e.g., "no FHA above 43% DTI") goes into [UNDERWRITING_SCENARIOS.md](../compliance/UNDERWRITING_SCENARIOS.md) as a candidate scenario → processed into the deterministic engine via the registry + invariants + guardian loop (S-01…S-06 shipped; see SCENARIO_ARCHITECT.md). Cite sources — uncited rules don't enter the engine.
3. **MISMO 3.4 export test:** generate the export for one dummy borrower (staff BorrowerFile → one-click download; validated by `tests/mismoExport.test.ts` / `mismoValidation.test.ts` / `mismoMersMin.test.ts`). ⛔ Uploading to a real lender sandbox waits on credentials (F1 + per-lender approval); until then the ULDD validator + schema tests are the acceptance gate.

## Routine 3 — Afternoon: Chaos Engineering & "Poison Pill" Drills (resilience)

Intentionally try to break the system daily.

1. **Dirty-data drill** (test borrower through `client/src/pages/lending/PreApproval.tsx` funnel):
   - Junk document upload (the blurry-dog-photo test): `server/services/documentConfidence.ts` must flag low confidence for human review, never silently accept.
   - ⛔ Plaid mid-stream disconnect: partially drillable against the simulation (`server/plaid.ts`); the real webhook-drop drill becomes possible with F4 production keys.
   - ⚠️ Massive medical collection on the simulated credit report: **not currently injectable** — the simulated soft pull has no collection tradelines and the engine has no collections→DTI path (verified 2026-07-04), so today nothing can compute wrongly *and* nothing verifies the protection. The FHA 5%/$2,000/medical-excluded capacity rule and GSE payoff carve-outs (both now in `regulatory-ledger.json`) must ship with the F3 credit adapter (roadmap #28); this drill then flips from documenting a gap to verifying a protection.
2. **Kill-switch test** (built 2026-07-04, roadmap #27):
   ```bash
   PORT=5002 INTAKE_PAUSED=true pnpm dev
   curl -i -X POST localhost:5002/api/leads -H "Content-Type: application/json" -d '{"email":"drill@test.com"}'
   ```
   Expect `503 {"code":"INTAKE_PAUSED"}` + `Retry-After: 600`; funnel submit shows the graceful maintenance toast; `rateService` logs `INTAKE_PAUSED set, skipping live rate vendor fetch` instead of calling vendors. Existing borrowers keep full access — the switch stops **new intake**, not service. In production: set `INTAKE_PAUSED=true` as a **Railway service variable** (Railway → project `Homiquity` → service `Homiquity` → **Variables**), then let the service restart with it. It is read from `process.env` **per request** (`server/services/maintenanceMode.ts`), so it takes effect as soon as the process is running with the variable — no rebuild is needed, unlike the `VITE_*` build-time flags.
3. **Zero-inbox the drill fallout:** every failure found goes to `CTO_ROADMAP.md` or `knowledge-base/research/my-research/` the same day — a drill that finds a bug nobody triages is theater.

## Routine 4 — Evening: Unit Economics & Go-To-Market Sync (strategy)

1. **Margin reconciliation:** review best-execution output (staff → `POST /api/admin/mortgage-rates/refresh`, or the LoanOptions LLPA breakdown) against planned origination/take-rate. ⚠️ Meaningful only against a **real** wholesale sheet — the `1.0-demo` seed makes this a rehearsal of the workflow, not a P&L check. Becomes real with the staff rate-sheet upload of an actual lender matrix, fully real with F11 (PPE).
2. **First-party lead review:** review the organic waitlist/inbound funnel (staff `GET /api/leads`). Our posture already assumes no purchased trigger leads: TrustedForm cert required, consent IP/UA/timestamp captured, quiet-hours + SMS opt-out guards in front of any outbound (roadmap #24/#25). HPPA verified + ledgered 2026-07-04 (`hppa-trigger-leads`: Pub. L. 119-36, FCRA §604(c), in force since ~2026-03-04) — the daily check is now simply that no lead source is a purchased trigger lead.
3. **Consent-language audit:** any new landing page or funnel copy must keep opt-in language strict (see the Reg Z trigger-term discipline from the landing-page research and `smsCompliance`/`quietHours` gates).

---

## Standing open items this doctrine generated

| Item | Where tracked |
|---|---|
| Medical-collections handling: ~~verify rule~~ **verified 2026-07-04** (no federal rule; Fannie B3-5.3-09 + FHA 4000.1 carve-outs ledgered) → build ships with F3 credit adapter | CTO_ROADMAP #28 |
| Reg B disparate-impact amendment (eff. 2026-07-21): keep four-fifths monitoring as internal risk mgmt; audit any copy framing it as a Reg B requirement | regulatory-ledger `reg-b-2026-disparate-impact` |
| HBPA trigger-lead ban: ~~verify citation~~ **verified + ledgered 2026-07-04** (Pub. L. 119-36; in force); binds only if we ever buy leads | regulatory-ledger `hppa-trigger-leads` |
| Real vendor portals join the morning sweep | F3–F5 |
| Lender sandbox MISMO uploads | F1 + per-lender credentialing |
| Margin reconciliation on real sheets | staff rate-sheet upload / F11 |
