# Morning Launch Gate — 2026-07-06

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**STATUS: OK** — gates green (tsc clean, 673/673 unit tests across 48 files), 0 npm audit findings, no secrets in the last 24h of commits, no PII-in-logs regressions, no route-guard regressions, both adverse-action seams verified **live end-to-end** (today is Monday), regulatory ledger fresh.

## LAUNCH DISTANCE

```
LAUNCH DISTANCE: sprint 5/10 · founder blockers 6 open · prod ✓ · domain ✗ · next leg: LS-10 slice 3/L6 — no movement in 24h (PR #55 open, unrelated)
```
Today's single most important unblock: **LS-2 ops env vars** (SendGrid/Sentry/GCS/CRON_SECRET) — unchanged from yesterday, still the cheapest founder task (~1 hr) blocking real email, error visibility, and durable uploads despite the code being merged.

**(a) Sprint ledger** — 5/10 checked in the "🚀 Launch sprint" section of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md) (unchanged from 2026-07-05):
- [ ] LS-1 NMLS licensing + MERS org ID — **founder**
- [ ] LS-2 Ops env vars in Vercel — **founder**
- [x] LS-3 PR #39 merged
- [ ] LS-4 F3/F6 vendor applications — **founder**
- [x] LS-5 GCS presigned uploads (PR #44)
- [ ] LS-6 Prod grid reseed — **founder-supervised** (destructive)
- [x] LS-7 Persona LPs (PR #42)
- [x] LS-8 Speed-to-lead (PR #40)
- [x] LS-9 Co-applicant GSE gate (PR #41)
- [ ] LS-10 Lender submission adapter — slice 2/3 merged 2026-07-05 (PR #51), slice 3 open — **engineering**

**(b) Founder-ops blockers board:**
- LS-1 NMLS licensing — **PENDING** (`shared/companyIdentity.ts:16` `nmlsId: "PENDING"`; also visible in today's live-test AAN creditor block — founder handles personally, not tracked further here).
- LS-2 env vars — not locally probeable (no Vercel CLI in this environment; exact values never guessed). Standing until founder confirms.
- LS-4 vendor applications (F3 credit / F6 DU-LPA) — no code-side signal available; founder-owned, standing.
- LS-6 prod grid reseed — founder-supervised, destructive; not run.
- ci.yml human push — still not on origin: `git ls-remote --heads origin` shows neither `claude/inspiring-faraday-86b6b2` nor `claude/gracious-mendel-a0f77c`; `.github/workflows/ci.yml` does not exist on `main`. Standing.
- homiquity.com domain — `curl https://homiquity.com/api/health` → **404** (not attached). Prod still lives at mortgage-stream.vercel.app.

**(c) Production pulse** — `curl https://mortgage-stream.vercel.app/api/health` → **200 OK**, ~0.22s response time, body `{"status":"ok","timestamp":"2026-07-06T14:45:04.541Z"}`.

**(d) Next engineering leg** — LS-10 slice 3 (real per-lender portal hand-off) and L6 (XSD-validate MISMO export): `git log --since="24 hours ago" --oneline -- server/services/lenderSubmission.ts server/mismo.ts` shows only `0516957` (slice 2, already landed and reflected in yesterday's report — dated Jul 5 23:15, inside today's 24h window but not new work since it was already accounted for). No further movement today. Open PRs (`gh pr list --state open`): **#55** `feat(tax-insight): consumer-direct tax return upload → readiness signals + DSCR lead flag` (branch `claude/jolly-shtern-015538`) — unrelated to LS-10/L6, already tracked in the tax-insight-pipeline memory.

## Summary

Both gates pass clean (tsc; 673/673 unit tests, up from 651 two days ago) and `npm audit --production` is still 0 across all severities. Secrets/PII/route-guard scans of the last 24h of commits (the PR #54 pre-license-gate merge + PR #51 LS-10 slice 2 + several feature commits) turned up nothing new — the only routes touched added `prelaunchGate` middleware ahead of existing guards, not guard removals. Since today is Monday, I ran the adverse-action live test end-to-end for the first time this cycle: created a marked test application, denied it as staff with two HMDA reasons, and confirmed both the neutral console-logged email and the generated AAN notice — deterministic, ECOA-compliant, no AI language. Regulatory freshness checkup passes; the sole non-regulatory FAIL (2 orphaned scripts) is pre-existing and already noted, not re-ticketed. No new P0/P1 surfaced; all founder-ops blockers are unchanged from yesterday.

## Evidence

1. **Gates:**
   - `npm run check` → clean, no output (tsc).
   - `npm test` → `Test Files 48 passed (48)`, `Tests 673 passed (673)`.

2. **Security quick-scan (deltas vs 2026-07-05-morning-gate.md baseline):**
   - `npm audit --production --json` → `{info:0, low:0, moderate:0, high:0, critical:0}` — no new criticals/highs.
   - Secrets scan: `git log --since="24 hours ago" -p | grep -inE 'sk-|api_key=|password=|BEGIN PRIVATE KEY|postgres://...'` → hits are all benign: empty `DEV_TEST_PASSWORD=` in `.env.example` diffs, `ForgotPassword`/`ResetPassword` lazy-import identifiers, and self-referential grep-pattern text quoted inside prior routine markdown docs. No actual secret values.
   - PII-in-logs: same 3 pre-cleared hits as yesterday — [server/scripts/backfillSsnEncryption.ts:36,56](../../../server/scripts/backfillSsnEncryption.ts) (logs row/app counts, never plaintext SSN) and [server/routes/borrower.ts:495](../../../server/routes/borrower.ts:495) (logs the caught exception, not the `ssn` variable). No leak.
   - New/changed routes: `git log --since="24 hours ago" --stat -- server/routes/` → `admin.ts`, `calculators.ts`, `lending.ts` in commit `0f0811d` (pre-license gated mode). Diff confirmed: each change only inserts `prelaunchGate` middleware ahead of the existing handler (`/api/rates`, `/api/mortgage-rates`, `/api/mortgage-rate-programs`, `/api/calculators/credit-tiers`, `POST /api/loan-applications` — the last already had `isAuthenticated` + `intakePausedGate`, both retained). No guard was weakened or removed.

3. **Adverse-action seams — live end-to-end test (Monday):**
   - Logged in as `buyer@test.com` via `/api/test-login`, created a marked test application (`cea7f85d-6107-412d-beb6-f8db4bd9996b`, notes: "MORNING-GATE Monday AAN test denial — routine evidence capture, not a real applicant") — deliberately weak profile (credit 600, high DTI) so the denial is realistic, not forced.
   - Logged in as `admin@test.com`, `PATCH /api/loan-applications/:id/status` with `status: "denied"`, `denialReasons: ["Debt-to-income ratio", "Credit history"]` → `200`, `hmdaActionTaken: "3"`.
   - This exercises the staff status→denied seam: [server/routes/lending.ts:1395](../../../server/routes/lending.ts:1395) `ensureAdverseActionForDenial` fires before the status flips; [server/routes/lending.ts](../../../server/routes/lending.ts) fires `sendNotificationEmail({type: "application_denied"})` after.
   - Console-logged email confirmed in `/private/tmp/homiquity-dev-5001.log`: `[Email][DEV] To: buyer@test.com`, `Subject: An Update on Your Application` (the deliberately neutral `application_denied` template — [server/services/emailService.ts:557-558](../../../server/services/emailService.ts:557)), timestamped immediately after the `PATCH .../status 200` log line — same request.
   - AAN content confirmed via `GET /api/loan-applications/:id/credit/adverse-actions`: `primaryReason: "Debt-to-income ratio exceeds maximum threshold"`, `secondaryReasons: ["Insufficient credit history to evaluate"]` — both derived from `HMDA_TO_ADVERSE_ACTION_REASON` ([server/services/creditService.ts:1059](../../../server/services/creditService.ts:1059)), `fcraCompliant: true`. Full notice text is boilerplate ECOA §1002.9 language (rights notice, CFPB contact, creditor block) — no AI-generated or free-text language anywhere in the path.
   - Test application remains in the shared dev DB in `denied` status — consistent with the already-accepted tradeoff in roadmap item #10 (no cascade-delete infra exists yet); clearly marked via its `notes` field for anyone auditing dev data later.

4. **Regulatory freshness:** `npm run checkup` → `PASS regulatory ledger fresh`. Same pre-existing non-regulatory `FAIL no orphaned files` as yesterday (`server/scripts/ingestFannieMaePerformance.ts`, `server/scripts/ingestHmdaCompetitors.ts`, traced to `fac55ba` WIP checkpoint) — not new, not launch-blocking, not re-ticketed.

5. **Launch-readiness scoreboard:** see LAUNCH DISTANCE block above for all sourcing.

## Gaps (say every time)

No SAST/DAST tooling exists — this routine is `npm audit` + `tsc` + targeted greps + one live functional test, not a real security scanner. LS-2/LS-4 env-var and vendor-application status cannot be confirmed from this environment (no Vercel CLI, no vendor portal access) — reported as standing/PENDING rather than guessed.

## Tickets

None. No new P0/P1 surfaced today — the orphaned-scripts finding is pre-existing, non-regulatory, and not launch-blocking; all founder-ops blockers are already tracked in CTO_ROADMAP.md's Launch Sprint section and not duplicated here. The live Monday AAN test passed with no defects to ticket.

---
STATUS: OK
