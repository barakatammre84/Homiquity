# Pre-Production Daily Operating Routines

**Date adopted:** 2026-07-04 · **Lens:** the founder's daily operating system between "platform built" and "platform launched" — QA, vendor credentialing, liquidity acquisition
**Companion docs:** [CTO_ROADMAP.md](../CTO_ROADMAP.md) (live checklist — items 27/28 added from this doctrine) · [REGULATORY_MONITORING.md](REGULATORY_MONITORING.md) · [UNDERWRITING_SCENARIOS.md](UNDERWRITING_SCENARIOS.md) · [AI_GOVERNANCE_POLICY.md](AI_GOVERNANCE_POLICY.md)

> **Automation:** these four routines run as local scheduled tasks (2026-07-04): `morning-compliance-defense` 7:45 AM, `midday-lender-liquidity` 12:30 PM, `afternoon-chaos-drills` 3:30 PM, `evening-economics-gtm` 6:30 PM. Each emits a dated report into `kb/founder-routines/`; human-only steps (portal logins, lender calls) are emitted as checklists, not simulated. This doc is the corrected doctrine those runs execute against.

> **Provenance note:** this doctrine arrived as external research (2026-07-04) and was verified against the codebase before adoption — same discipline as every kb doc: trust the code, not the claim. The corrections table below records where the source text and reality diverged. Items marked ⛔ are **blocked on an F-item** (business contract/licensing) and are listed so the routine doesn't silently skip them.

## Corrections applied to the source doctrine

| Source claim | Verified reality |
|---|---|
| "MISMO 3.6 XML export" | We generate **MISMO 3.4** (`server/mismo.ts`, `DataVersionIdentifier 3.4.0`) — deliberately: 3.4 is what DU/LPA and the F11 PPE middleware target. Do not chase 3.6 until a counterparty demands it. |
| "Log into Plaid/Equifax/Experian portals" | No live vendor portals exist yet — credit, Plaid, Truv, AVM are **simulated until contracts** (roadmap F3–F7). Real portals today: **Vercel, SendGrid, Sentry, RapidAPI**. |
| "July 2026 Reg B rules and the Medical Debt DTI exclusion are explicitly tested" | Reg B invariants are real and strong (33 tests, `tests/complianceInvariants.test.ts`). **Medical-debt exclusion exists nowhere** — not in the engine, tests, or regulatory ledger. Per ledger discipline ("never change a value without a citation") it must be **verified against an official source first**, then implemented → roadmap #28. |
| "Verify AAN routes via emailService.ts" | It now does at both seams: staff status→denied fires the neutral email (`server/routes/lending.ts`), and **AAN generation itself** now also fires it (`server/routes/compliance.ts`, added 2026-07-04) so ECOA delivery never depends on a separate status flip. |
| "Flip the environment variable... that pauses all new applications" | **Did not exist — built 2026-07-04** (roadmap #27): `INTAKE_PAUSED=true`, see Routine 3. |
| "Review rates from `rateService.syncBestExecutionRates()` against origination fees" | The function is real (`server/services/rateService.ts`, admin refresh route) but current rate sheets are the **`1.0-demo` seed** — margin math on demo sheets is rehearsal, not reconciliation. It becomes real when a genuine wholesale sheet is uploaded (staff rate-sheet flow) or F11 PPE lands. |
| "2026 HBPA bans trigger-lead buying" | Plausible and consistent with our design (we never buy trigger leads; `POST /api/leads` already requires a TrustedForm cert URL + captures consent IP/UA/timestamp), but the statute citation and effective date are **unverified** — confirm via F10 regulatory channels before adding a `regulatory-ledger.json` entry. |

---

## Routine 1 — Morning: Compliance & Vendor Unblocking (defense)

Clear the hurdles that can physically prevent launch before doing anything else.

1. **Vendor portal sweep (today's real list):** Vercel (build/deploy status, env vars), SendGrid (domain auth, suppression list — once the key is set, roadmap #3 ops), Sentry (new errors — once DSN is set, roadmap #4 ops), RapidAPI (rate-limit warnings on realty-us). ⛔ Plaid/credit-bureau/Truv portals join this sweep as F3–F5 contracts land.
2. **The 2026 guardrail check:**
   ```bash
   npx vitest run tests/complianceInvariants.test.ts --config vitest.config.ts
   ```
   33 tests: AI never in the credit-decision path, intake decisioning fully deterministic, denial cannot outrun its adverse-action notice, ECOA §1002.9 block present. Baseline 2026-07-04: **33/33 green**. ⚠️ Medical-debt exclusion is *not* among them — that's roadmap #28, gated on a verified citation.
3. **Adverse Action audit:** generate one test denial (staff → `POST /api/loan-applications/:id/credit/adverse-action`). Verify: the notice renders at `/adverse-action/:id` with reasons + bureau contact + dispute rights; the reason is deterministic (never "AI decision" — enforced by the invariant tests, `AI_GOVERNANCE_POLICY.md`); the borrower got the in-app notification **and** the deliberately neutral email (console-logged until `SENDGRID_API_KEY` is set).
4. **Regulatory freshness:** `npm run checkup` runs `scripts/regulatory-freshness.cjs` — fails if any `kb/regulatory-ledger.json` entry is overdue for re-verification.

## Routine 2 — Mid-Day: Lender Liquidity & Concierge Sales (offense)

A marketplace without lenders is dead on arrival. ⛔ **All outbound lender onboarding is gated on F1 (NMLS — currently `PENDING` in `server/config/company.ts`)** — no wholesale lender will credential an unlicensed broker. Until F1, this block is *preparation*, which is still daily work:

1. **The "Target 5" pipeline:** maintain the shortlist of 3–5 initial wholesale lenders in `kb/my-research/`. Pre-F1 goal: collect their broker-approval requirements, sandbox-access prerequisites, and pricing-matrix formats so day-1-after-licensing is submission, not research.
2. **Scenario translation:** any underwriting quirk learned from a lender conversation (e.g., "no FHA above 43% DTI") goes into [UNDERWRITING_SCENARIOS.md](UNDERWRITING_SCENARIOS.md) as a candidate scenario → processed into the deterministic engine via the registry + invariants + guardian loop (S-01…S-06 shipped; see SCENARIO_ARCHITECT.md). Cite sources — uncited rules don't enter the engine.
3. **MISMO 3.4 export test:** generate the export for one dummy borrower (staff BorrowerFile → one-click download; validated by `tests/mismoExport.test.ts` / `mismoValidation.test.ts` / `mismoMersMin.test.ts`). ⛔ Uploading to a real lender sandbox waits on credentials (F1 + per-lender approval); until then the ULDD validator + schema tests are the acceptance gate.

## Routine 3 — Afternoon: Chaos Engineering & "Poison Pill" Drills (resilience)

Intentionally try to break the system daily.

1. **Dirty-data drill** (test borrower through `client/src/pages/lending/PreApproval.tsx` funnel):
   - Junk document upload (the blurry-dog-photo test): `server/services/documentConfidence.ts` must flag low confidence for human review, never silently accept.
   - ⛔ Plaid mid-stream disconnect: partially drillable against the simulation (`server/plaid.ts`); the real webhook-drop drill becomes possible with F4 production keys.
   - ⚠️ Massive medical collection on the simulated credit report: **currently NOT ignored** — the engine has no medical-debt exclusion (roadmap #28). Until #28 lands, this drill documents the known gap rather than verifying a protection.
2. **Kill-switch test** (built 2026-07-04, roadmap #27):
   ```bash
   PORT=5002 INTAKE_PAUSED=true npm run dev
   curl -i -X POST localhost:5002/api/leads -H "Content-Type: application/json" -d '{"email":"drill@test.com"}'
   ```
   Expect `503 {"code":"INTAKE_PAUSED"}` + `Retry-After: 600`; funnel submit shows the graceful maintenance toast; `rateService` logs `INTAKE_PAUSED set, skipping live rate vendor fetch` instead of calling vendors. Existing borrowers keep full access — the switch stops **new intake**, not service. In production: set `INTAKE_PAUSED=true` in Vercel env + redeploy (takes effect next deployment).
3. **Zero-inbox the drill fallout:** every failure found goes to `CTO_ROADMAP.md` or `kb/my-research/` the same day — a drill that finds a bug nobody triages is theater.

## Routine 4 — Evening: Unit Economics & Go-To-Market Sync (strategy)

1. **Margin reconciliation:** review best-execution output (staff → `POST /api/admin/mortgage-rates/refresh`, or the LoanOptions LLPA breakdown) against planned origination/take-rate. ⚠️ Meaningful only against a **real** wholesale sheet — the `1.0-demo` seed makes this a rehearsal of the workflow, not a P&L check. Becomes real with the staff rate-sheet upload of an actual lender matrix, fully real with F11 (PPE).
2. **First-party lead review:** review the organic waitlist/inbound funnel (staff `GET /api/leads`). Our posture already assumes no purchased trigger leads: TrustedForm cert required, consent IP/UA/timestamp captured, quiet-hours + SMS opt-out guards in front of any outbound (roadmap #24/#25). Action item: verify the HBPA citation/effective date via F10 channels, then ledger it.
3. **Consent-language audit:** any new landing page or funnel copy must keep opt-in language strict (see the Reg Z trigger-term discipline from the landing-page research and `smsCompliance`/`quietHours` gates).

---

## Standing open items this doctrine generated

| Item | Where tracked |
|---|---|
| Medical-debt exclusion: verify rule → implement in engine + ledger + tests | CTO_ROADMAP #28 |
| HBPA trigger-lead ban: verify citation/effective date → ledger entry | Routine 4.2 / F10 |
| Real vendor portals join the morning sweep | F3–F5 |
| Lender sandbox MISMO uploads | F1 + per-lender credentialing |
| Margin reconciliation on real sheets | staff rate-sheet upload / F11 |
