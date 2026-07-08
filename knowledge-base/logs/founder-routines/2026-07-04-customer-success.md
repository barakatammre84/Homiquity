# Customer Success Executive — Daily Report — 2026-07-04

**STATUS: WARN** — the two rehearsed paths I checked most closely (locked-out recovery, adverse-action dispute rights) are solid in code; the gaps are in measurement and escalation routing, not in broken borrower-facing flows.

## Human actions

- ⛔ **Founder/legal signoff needed** on `kb/support-playbooks/discrimination-credit-error-escalation.md` before any of its scripted first-response copy is used with a real borrower. This file also defines today's escalation path (immediate founder notification — there is no separate Compliance Executive at this company size) since none existed in prior playbooks.
- **Decision needed (not blocking):** should there be a dedicated in-app "report a problem / complaint" surface distinct from the normal borrower↔staff message thread? Today a complaint travels through the same channel as a document question, with no priority signal. I filed the automation half of this as CS2 in CTO_ROADMAP.md; the decision of whether a separate surface is warranted is a product call, not something I should make unilaterally.

## Summary

Password reset and email verification are fully built and verified end-to-end in code: reset tokens expire in 30 minutes, verification tokens in 48 hours, and completing a reset provably clears the account lockout in the same database write. The Adverse Action Notice page correctly renders ECOA rights unconditionally and FCRA dispute-rights/bureau-contact information whenever a consumer report was actually used — verified against the generation logic, not just the page. A borrower complaint path does exist today (staff messaging plus public compliance/privacy email addresses), so support is not launch-blocked on that front, but nothing distinguishes a discrimination or credit-reporting complaint from routine traffic — I wrote the missing escalation playbook to close that gap procedurally today and filed the automated version as a ticket. Separately, I found that the taskEngine's SLA-class infrastructure (S0–S5, escalation timers) has empty configuration tables in the dev database, meaning no task actually gets a due date or auto-escalates today despite the code being fully built — a real, previously-undetected gap. A walk of the borrower onboarding path surfaced three friction points worth flagging, using an existing (not fresh) seeded test account.

## Checks run → results → evidence

**Playbook written today:** [kb/support-playbooks/locked-out-user.md](../support-playbooks/locked-out-user.md) (rotation item a). Also wrote the standing [kb/support-playbooks/discrimination-credit-error-escalation.md](../support-playbooks/discrimination-credit-error-escalation.md), required by section 2 of this routine's doctrine since that escalation was undefined anywhere in the repo. Created `kb/support-playbooks/README.md` as an index (directory didn't exist before today).

**Locked-out user flow (verified, all claims code-checked):**
- Reset token TTL 30 min, verify token TTL 48 h: `server/services/accountRecovery.ts:9-10`.
- Reset completion clears `failedLoginAttempts`/`lockoutUntil` in the same update as the password hash: `server/integrations/auth/storage.ts:151-158`.
- Lockout policy: 5 failures → 15 min, doubling per further failure, capped 24 h: `server/services/loginLockout.ts:12-14`.
- Locked-account and wrong-password responses are identically generic (`"Invalid email or password"`) by design — `server/auth.ts:165-167`, `client/src/pages/public/Login.tsx:58`.
- `forgot-password` always returns the same generic success regardless of account existence: `server/auth.ts:226-249` (anti-enumeration, confirmed intentional).
- Client routes `/forgot-password`, `/reset-password`, `/verify-email` all wired: `client/src/App.tsx:183-185`.

**Adverse Action Notice (verified):**
- Client page renders staff-generated `noticeText` plus structured bureau-contact card: `client/src/pages/borrower/AdverseActionNotice.tsx`.
- ECOA notice (creditor identity, administering agency, non-discrimination language) is unconditional on every notice: `server/services/creditService.ts:1014-1028`.
- FCRA free-report/dispute-rights language + bureau contact block is included only when the action was actually based on a consumer report (`basedOnConsumerReport` gate) — this is correct, not a bug: a self-reported-data denial must not claim a bureau report was used. `server/services/creditService.ts:860-865, 984-1006`.
- **Corollary:** the client-side bureau-contact card (`AdverseActionNotice.tsx:148-163`) is conditionally rendered on the same basis (`bureauName`/`bureauPhone`/`bureauWebsite` present), so it mirrors the notice text's own gating rather than being an independent gap.

**Complaint/discrimination escalation (verified — this was the main gap found):**
- Borrower message send path: `POST /api/messages`, `server/routes/borrower.ts:2607` — requires an existing assigned recipient; no content-based routing exists.
- Public non-authenticated contact surfaces: `mailto:compliance@homiquity.com` (Disclosures), `mailto:privacy@homiquity.com` (Privacy), `mailto:legal@homiquity.com` (Terms), `support@homiquity.com` (`server/config/company.ts:6`) — a complaint path exists, it is just unrouted by content.
- No code anywhere flags discrimination or credit-reporting-error language for priority handling. Closed procedurally today via the new escalation playbook; automation filed as **CS2** in CTO_ROADMAP.md.

**Maintenance/INTAKE_PAUSED (verified):**
- Borrower-safe 503 copy: `"We're briefly paused for scheduled maintenance. Your saved progress is safe — please try again in a little while."` with `Retry-After: 600` and `code: "INTAKE_PAUSED"` — `server/services/maintenanceMode.ts:26-34`. Gates new loan applications and new leads; existing borrowers keep full access (by design, per the module's own header comment).

**Privacy/GLBA (verified, spot-check — not today's rotation item, checked only because SLA/complaint work touched it):**
- Privacy page covers GLBA nonpublic-information handling, state privacy rights (incl. CCPA/CPRA), and a deletion-request path via contacting the company (founder-handled, no dedicated privacy team) — `client/src/pages/public/Privacy.tsx:100,116`.
- SSN is stored encrypted (AES-256-GCM, `ssnVault` scheme) with a deprecated plaintext column being phased out — `shared/schema/lending.ts:531-540`.

**SLA targets — table:**

| Event | Target (as coded) | What measures it today | Gap |
|---|---|---|---|
| Doc review / OCR flags, general task SLA | S0–S5 classes: S0 0-1h (15m escalation) … S4 72h (60h escalation), `shared/schema/underwriting.ts:26-32` | **Nothing** — `sla_class_configs` and `task_type_sla_mapping` tables are both **empty** in the dev DB (verified by direct query, 2026-07-04). `computeSlaDueAt` silently falls back to `{slaDueAt: null, slaClass: "S3"}` for every task (`server/services/taskEngine.ts:111-123`), so no due date is ever set and breach auto-escalation (`taskEngine.ts:549-569`) never fires. | **CS1** (filed) |
| Message response (borrower↔staff) | Not formally targeted anywhere in code | `messages.readAt` timestamp is captured (`server/storage.ts:3839-3841`) but nothing aggregates it into a response-time metric or dashboard | Folded into CS1 scope |
| AAN follow-up questions | Not formally targeted; would logically be a high-urgency (S1/S0) task type | Same as above — falls into the general (currently inert) task SLA system | Folded into CS1 |
| Stuck application | 48h no-touch = red ("No-Stall" threshold) | **This one already works.** `STALL_DAYS = 2` in `server/services/fileHealth.ts:53`, live in the LO Command Center (PR #33, shipped 2026-07-04) — deterministic, rule-based, unit-testable. Distinct system from taskEngine SLA classes, not affected by the CS1 gap. | None — already measured |

**Onboarding friction (labeled seed/test — reused `renter@test.com`, not a fresh seed; this account carries state from prior test sessions, so findings are illustrative rather than a pristine first-run):**

1. **Readiness score says "ready" while documents say otherwise.** `/api/borrower-graph` reports `readiness.completionPercentage: 84` and `tier: "ready_now"` for an application with `documentsUploaded: 0` and 5 required document types still missing. A new borrower reading "you're ready now" with an empty document checklist is a plausible confusion point. Microcopy proposal (report-only, UX loop owns the fix): the readiness tier badge should visually distinguish "financially ready" from "file-complete" so borrowers don't read "ready_now" as "nothing left to do."
2. **A borrower can be confused about whether they have a team yet.** A leftover message on this test account reads verbatim: *"I dont have a team yet but need help"* — sent to a recipient (`test-lo`) that the conversations list now shows as their partner. This suggests the moment of team assignment isn't obviously surfaced to a borrower before they need help, i.e. they may not know who to message until they've already tried. This is a microcopy/UX question (surface "your team" more prominently pre-first-contact), not something this routine should fix directly — flagging for the UX loop and for whichever future playbook covers pre-team-assignment borrower guidance.
3. **A blocking pre-underwriting flag is invisible outside the API.** The test application carries a `preUwFlags` entry (`COMPLEX_INCOME_CHECK`, severity `blocking`, self-employed income needs 2 years of returns + YTD P&L) that is real and correctly computed, but I did not verify in this pass whether the borrower-facing UI surfaces this specific flag's required-docs list as clearly as the generic document checklist does. Noting as a follow-up check for the next onboarding-friction walk rather than asserting a gap I haven't confirmed in the UI.

## Corrections table

| Where | What memory/prompt assumed | What's actually true |
|---|---|---|
| Task doctrine, item 3 | "align with the existing taskEngine SLA classes" implies the classes are operative | The classes are defined in schema/code but their configuration tables are empty in the dev DB — the SLA system as built is currently inert, not just "informal." See CS1. |
| Task doctrine, item 2 | Implies a complaint intake path may or may not exist, framed as binary | It exists (staff messaging + compliance/privacy/legal mailto links) but has zero content-based routing for sensitive complaint categories — a routing gap, not an absence gap. Did not warrant FAIL. |
| Onboarding walk instruction | "fresh seed user when possible" | `renter@test.com` is a fixed shared test account (`server/auth.ts:334-345`) that already carries state from prior sessions/routines — there is no mechanism to get a truly fresh instance of it without a new user record. Used as-is and labeled accordingly rather than fabricating a fresh persona. |

## Remediation tickets

Both appended to `CTO_ROADMAP.md` under a new "Customer-success readiness" section (checked the roadmap first — no existing complaint/SLA/customer-success tickets to update):

- **CS1** (Claude, automatable, ~2h): Seed `sla_class_configs` + `task_type_sla_mapping` with the target-hour values already documented in code comments; verify breach auto-escalation actually fires on an aged test task.
- **CS2** (Claude, automatable, ~3h): Add keyword/pattern flag on `POST /api/messages` for discrimination/credit-error language → founder-visible flagged record, per the new escalation playbook.

No FAIL-level findings — no runbook needed today.

STATUS: WARN
