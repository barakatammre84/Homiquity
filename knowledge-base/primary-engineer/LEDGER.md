# Primary Engineer — ledger

**Owner:** the `primary-engineer` routine (rows added by it or the founder). **Freshness:** seeded
2026-08-17 — every row is a claim about the day it was written; re-verify with `git log -S` before
building (routine rail R9).

The routine's Phase 1 queue source (d). Rules: every row carries a source cite or it is invalid;
rows sourced from `CTO_ROADMAP.md` may be landed first by another session — re-verify before
starting; a row fixed elsewhere is closed with a pointer, never rebuilt. Status vocabulary:
`open` · `done (PR #)` · `blocked-human (why)` · `superseded (by what)`.

| id | target | source | rank note (§1 / §1a) | status |
|---|---|---|---|---|
| PE-001 | Internal data-lineage view for masked wholesale-lender identity — compliance/staff need the unmasked chain somewhere | `CTO_ROADMAP.md:150-152` (§3.3) | A-adjacent (lender package traceability); IL tiebreak neutral | open |
| PE-002 | Surface platform-fee charged-vs-collected variance in FinancialReports | `CTO_ROADMAP.md:186-195` (§3.14, audit F-22) | A-adjacent (fee/QM budget honesty); likely §9-trip if a new endpoint → draft-PR path (R5) | open |
| PE-003 | Sidebar has no link for admin-only `/closing-guarantee` — route exists, nav omits it | route `client/src/App.tsx:517-518`; nav `client/src/components/app-sidebar.tsx:200-220` (2026-08-17 inventory) | B / LOW (staff friction) | open |
| PE-004 | Dead lazy import: `AdminPartnerWaitlist` bound in `client/src/App.tsx:162` but only rendered embedded from `AdminPartners.tsx:303` | 2026-08-17 inventory | LOW (dead code; verified-dead-code removal is L2) | open |
| PE-005 | `AdminDashboard.tsx:63-73` client-side role re-check duplicates `PrivateLayout`'s gate — the drift class `routeGates.ts:9-31` documents | 2026-08-17 inventory | B / LOW (consistency; gates stay server-side authoritative) | open |
| PE-006 | Enforce the 120-day consent validity the disclosure itself promises: `credit_consents` has no expiry column and no gate checks age (`creditConsents.ts:getActiveConsent` filters `isActive`+`consentGiven` only) — while `credit_pulls` models `expiresAt` for the weaker convention | FINDINGS F-040 (verified still open 2026-08-17, run 1) | A / P2 (FCRA consent validity). ⚠ escalation first: does 120d bind funnel soft consents too? (report 2026-08-17 ticket PE-T3). Mechanism = expand migration (`expiresAt` or age check) + gate tightening; strictest defensible posture available if unanswered, mirroring `CONSENT_PULL_COVERAGE`'s precedent | open |
