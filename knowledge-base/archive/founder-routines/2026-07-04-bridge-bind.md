# Bridge & Bind — 2026-07-04

> **⛔ ARCHIVED 2026-07-08 — launch-era snapshot (2026-07-02 → 07-06), superseded. Do not act on this document.** Current truth lives in the 🚀 Launch sprint of [CTO_ROADMAP.md](../../../CTO_ROADMAP.md); see the [archive rationale](../README.md). Retained for history only; its dated findings are preserved as written.

**STATUS: WARN** — invariants, load-bearing handshakes, trust-language, and AI-import doctrine all clean; two entire NEW route files (leads intake, market-data moat) merged in the last 48h ship with zero client binding.

## Human actions

None urgent (⛔ none). Recommended, not blocking: decide whether `/api/leads` (public lead-capture, roadmap #8) is meant to go live headless (e.g. embedded form on a partner site) or needs its own UI before the next marketing push — right now there is no page anywhere that calls it.

## Summary

Ran the full unit suite (478/478 green, compliance invariants included) and `tsc` (clean) — no compliance incident, no type regression. Diffed every `server/routes/*.ts` change since the last commit before the 48h window and checked each newly-added route against `client/src` for a real reference. Two previously-unlisted route files are wired to nothing on the client: `leads.ts` (public intake + staff views, merged 01:51 today) and `market-data.ts` (competitor-benchmark/undercut-quote/risk-profile, merged as "market-data moat services" ~00:08 today). Three smaller admin/compliance endpoints (SSN reveal, fair-lending disparate-impact, document-confidence accuracy-report) are also unbound but read as deliberately headless tooling, not UI misses. All five load-bearing handshakes (intake, offers, best-execution sync, anti-steering consent, intake kill switch) are present and correctly wired. Trust-language grep hit only the "AI Coach" product name, not a math/decision claim — not a violation.

## Checks run → results → evidence

**1. Compliance invariants** — `npm run test:unit`: 35 files / 478 tests passed, 5.82s. No FAIL.
**6. Typecheck** — `npx tsc`: zero errors.

**2. New orphaned endpoints (last 48h, vs commit `78a5b98`)** —
- `POST/GET /api/leads`, `GET /api/leads/:id`, `DELETE /api/leads/:id` — [server/routes/leads.ts](server/routes/leads.ts) (new file, commit `c00501d`, "Leads intake API… roadmap #8"). Zero references to `leads` anywhere in `client/src` (checked literal path, queryKey array, and bare "leads" string, case-insensitive) — genuinely unbound, not a grep miss.
- `GET /api/market-data/competitor-benchmark`, `/undercut-quote`, `/risk-profile` — [server/routes/market-data.ts](server/routes/market-data.ts) (new file, commit `fac55ba` → merged `e1be4f4`). Zero client references.
- Smaller/likely-intentional: `GET /api/urla/:applicationId/ssn` (borrower.ts:467, commit `7041dc3`), `GET /api/compliance/fair-lending/disparate-impact` (commit `86dc0bc`), `GET /api/documents/confidence/accuracy-report` (data-intelligence.ts:167, commit `86dc0bc`) — all 0 client refs, but read as admin/compliance-monitoring endpoints awaiting a dashboard, same shape as the accepted-baseline items. Flagging for visibility, not alarm.
- `/api/jobs/lifecycle`, `/api/jobs/graduate/:applicationId`, `/api/jobs/friction-summary` (jobs.ts) — also 0 client refs, but by design: cron/admin-triggered backfill jobs (file header documents Vercel-cron + manual-admin dual path), not meant for a UI surface. Not counted as orphans.
- `/api/webhooks/plaid-assets`, `/api/webhooks/sms` — server-to-server webhook receivers, correctly have no client caller. Not orphans.
- Everything else in the 48h diff (rates/articles/faqs/content-categories, loan-applications, offers, mismo-export, documents/upload, staff/applications, staff/users, shell/badges, loan-estimate, client-errors) resolved to a real client reference.

**3. Load-bearing handshakes** — all intact:
- `POST /api/loan-applications` → [server/services/loanAnalysis.ts:229](server/services/loanAnalysis.ts:229) `analyzeIntake`, called at [server/routes/lending.ts:382](server/routes/lending.ts:382).
- `GET /api/loan-applications/:id/offers` → `computeOffers` ([server/services/pricingAdapter.ts:110](server/services/pricingAdapter.ts:110)), client at [client/src/pages/lending/LoanOptions.tsx:332](client/src/pages/lending/LoanOptions.tsx:332) (`queryKey: ['/api/loan-applications', id, 'offers']`).
- `rateService.syncBestExecutionRates()` called from [server/seed.ts:777](server/seed.ts:777) and [server/routes/admin.ts:568](server/routes/admin.ts:568).
- Anti-steering consent gate present at [server/routes/lending.ts:820-834](server/routes/lending.ts:820).
- Intake kill switch: `intakePausedGate` wired in front of `POST /api/loan-applications` ([server/routes/lending.ts:452](server/routes/lending.ts:452)) and `POST /api/leads` ([server/routes/leads.ts:64](server/routes/leads.ts:64)); `INTAKE_PAUSED` short-circuit present in [server/services/rateService.ts:61](server/services/rateService.ts:61).

**4. Trust-language** — `grep -rniE "AI is calculating|analyzing with AI|AI analysis|our AI"` hit 4 files, all "AI Coach" (product feature name in `ConversionCTA.tsx`, `AICoach.tsx`, `Landing.tsx`) — none imply AI performs math or lending decisions. Clean.

**5. Deterministic-math drift** — no imports of `openai`/`@google/genai`/`@anthropic-ai` outside the four allowed files. Clean.

## Corrections table

| Baseline/prompt said | Verified reality |
|---|---|
| Accepted-baseline orphan list didn't mention leads or market-data | Both are new-this-window (created 2026-07-03/04), so correctly out of the historical baseline — not a stale-baseline issue, just newly-surfaced |
| Prompt's 48h window nominally implies a short list of changed routes | Commit velocity is high enough that "48 hours" swept ~20 route files / dozens of merges; narrowed by diffing against the pre-window commit and checking only truly-added `app.*` lines |

## Remediation tickets (proposed)

1. **Bind or scope `/api/leads`** — owner: Amr (product decision first: is this headless/partner-embed or does it need a Homiquity-hosted form?), then Claude for implementation. Est: 0.5h decision + 3h build if a UI page is wanted.
2. **Bind market-data moat endpoints to a staff pricing-intelligence view** — owner: Claude. Est: 4h (new admin page or a panel on an existing staff dashboard).
3. **Recommended next binding (from accepted baseline):** wire `/api/scenario-calculator` into a borrower-facing "what-if" tool on the loan-options page — it's the highest-leverage baseline orphan because the scenario engine (S-01..S-06) is fully implemented server-side and this is the only baseline item that directly touches conversion (borrowers currently can't self-serve scenario comparisons at all).

---
STATUS: WARN
