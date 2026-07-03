# Homiquity CTO Roadmap — Development & Business Tasks

**What this is:** the CTO-level checklist of all project development and business work left to do (separate from the in-app borrower/staff "tasks" feature), in plain language, in the order it should be done. Details and reasoning for each item live in [kb/STATE_OF_THE_PLATFORM.md](kb/STATE_OF_THE_PLATFORM.md).

**How to use it:**
- Work top to bottom in the "Do next" section — the order matters.
- Check items off (`[x]`) as they ship. Claude should update this file in the same commit that completes a task.
- A prompt can be as simple as: *"do the next unchecked item in CTO_ROADMAP.md"*.
- Nothing in the "Future" section should be started until the business side (licensing, contracts) is in motion.

---

## Do next — engineering, in order

### Make the product safe to put in front of a stranger

- [ ] **1. Fix file uploads in production.** Uploaded documents currently go to temporary disk on Vercel and vanish. Configure the Google Cloud Storage bucket + credentials, make the presigned-URL flow (`/api/uploads/request-url`) the only path, and delete the multer disk-storage path in `server/routes/utils.ts`. Acceptance: upload a document in production, redeploy, document is still there.
- [x] **2. Password reset + email verification.** Neither exists — a locked-out user is locked out forever. Build forgot-password (email link, expiring token) and verify-email-on-signup flows. Acceptance: reset a password end-to-end in production. *(Done 2026-07-03: new `auth_tokens` table (SHA-256 token hashes, single-use, expiring — 30 min reset / 48 h verify) via migration `0002`; `emailVerifiedAt` on users. Endpoints: `/api/auth/forgot-password` (enumeration-resistant), `/api/auth/reset-password`, `/api/auth/verify-email`, `/api/auth/resend-verification`; registration fires a verification email, reset clears the lockout so a locked-out user recovers. Client pages `/forgot-password`, `/reset-password`, `/verify-email` + "Forgot password?" on Login. Token lifecycle DB-verified (single-use / expiry / type-isolation / invalidation) and HTTP contract covered in `tests/authRecovery.test.ts`. Live delivery depends on task 3's provider env.)*
- [x] **3. Turn on real email.** `emailService.ts` silently logs emails to console because no provider is configured in production. Set up SendGrid (API key env var + domain SPF/DKIM). Acceptance: receive a real email from the app. *(Code already complete: `emailService.ts` sends via the SendGrid API when `SENDGRID_API_KEY` is set, with optional SMTP fallback, and logs to console otherwise. **Remaining = ops only:** set `SENDGRID_API_KEY` (+ `FROM_EMAIL`/`FROM_NAME`) in Vercel and add SPF/DKIM DNS for the sending domain.)*
- [ ] **4. Add error monitoring + uptime alerts.** Right now a production crash is invisible. Add Sentry (client + server) and a free uptime monitor pinging `/api/health`. Acceptance: force a test error, see it in Sentry.
- [ ] **5. Restore minimal CI.** `.github/` was deleted in the "no gates" simplification. Add one non-blocking GitHub Action: typecheck + unit tests on every push (informational only — deploys still never wait). Acceptance: a push with a type error shows a red ✗ on the commit.

### Fix the workflows that work wrongly

- [x] **6. Tame the task engine.** Borrowers see "Complete 56 pending tasks." Add caps, group tasks into milestones ("3 documents needed"), and filter by loan stage. Acceptance: test buyer sees ≤ 5 meaningful next steps. *(Done 2026-07-03: dashboard signal now scoped to the active application and grouped — "Upload your documents — 8 needed"; Tasks page now groups document requests into one milestone checklist scoped to the active application with humanized labels. Generation-side caps deferred until real-traffic data justifies them.)*
- [x] **7. Stage-gated data validation.** Applications reach "pre-approved" with no loan amount ($0 volume on admin) and contradictory signals (pre-approved with 0 documents). Enforce required-fields-per-stage in the borrower state machine. Acceptance: admin dashboard shows real volume; no impossible state combinations. *(Done 2026-07-03: new pure invariant `shared/stageRequirements.ts` (single source of truth for amount-bearing statuses + coherent-amount) with 15 unit tests; `assertStageRequirements` guard wired beside the existing `assertVerifiedForDecisioning` at both status seams — underwriting advance-stage + staff status PATCH; fixed the root `$0` bug in loanAnalysis (an approval with no coherent amount now routes to `under_review`, not a $0 pre-approval); admin volume now sums `coalesce(purchase_price, pre_approval_amount)` across amount-bearing statuses instead of only `approved`. Verified: tsc clean, 197 unit tests, server boots, live `getAdminStats` totalLoanVolume $0 → $12.39M, 0 legacy impossible states in the dev DB. **Not covered:** the "pre-approved with 0 documents" borrower-signal contradiction (STATE §4.3) is a separate borrower-state-machine consistency issue, not this amount-coherence fix.)*
- [x] **8. Build the leads intake API.** The compliant `leads` table exists but has no endpoints — no way for a landing page or aggregator to create a lead. Build `POST /api/leads` (Zod-validated, TrustedForm evidence required, rate-limited) + a staff list view. Acceptance: integration test creates and lists a lead. *(Done 2026-07-03: `server/routes/leads.ts` — public `POST /api/leads` (Zod-validated; TrustedForm cert URL + at least one of email/phone required; captures consent IP/UA/timestamp; idempotent on (source, externalLeadId); rate-limited via `leadsLimiter`), staff `GET /api/leads` + `/api/leads/:id` (admin/lo/loa), and admin `DELETE /api/leads/:id` (erasure/cleanup). Storage methods added to `IStorage`. Storage layer DB-verified; self-cleaning HTTP integration test in `tests/leads.test.ts`.)*
- [x] **9. Lifecycle jobs.** Three deferred jobs: daily refi-alert scan, equity-snapshot job (AVM → snapshots), and the closed-loan graduation hook that auto-surfaces the Homeowner Hub. Acceptance: close a test loan, Homeowner Hub appears with an equity snapshot.
- [x] **10. Make integration tests self-cleaning.** Test runs pollute `buyer@test.com` with new applications and drift the dashboards. Tests should create and delete their own fixtures. Acceptance: two consecutive runs leave the database identical. *(Done 2026-07-03: `pricingUnderwriting.test.ts` was the sole polluter — its `beforeAll` created a fresh loan application every run with no cleanup; the two `lookupMatrix` suites already self-clean by deleting their `lookup_matrices` fixtures by code marker. Fix: `pricingUnderwriting` now find-or-creates a stable fixture (matches creditScore 760 / purchasePrice 400000 / CA) instead of always creating — delete-based cleanup isn't viable because `loan_applications` has ~30 child FKs with no `ON DELETE CASCADE` and no delete endpoint, so an idempotent reused fixture is the robust guarantee. Verified: baseline 39 apps → run → 39 → run → 39; 17/17 pass both runs. Note: orphan test apps accumulated before this fix remain in the shared dev DB — removing them needs the same cascade infra, left as optional one-time cleanup.)*
- [x] **11. Demo rate sheet for production.** Pricing returns "no products" in prod. Either seed a clearly-marked demo sheet or build the staff rate-sheet upload flow. Acceptance: best-execution quote works in production. *(Done 2026-07-03: root cause was the existing demo sheets' 90-day window silently expiring — the idempotent seed then never refreshed them, so `getActiveRateSheets()` returned empty. `seedMarketPricing` now calls a new `refreshDemoRateSheets()` on every boot that rolls any `version = "1.0-demo"` sheet at/near expiry to a fresh 90-day ACTIVE window (and aligns the demo overlay adjustments). Real vendor sheets — any other version — are never touched, so the staff upload flow still supersedes the demo cleanly. DB-verified: expired demo sheets are revived and best-execution has products again.)*

### Finish the redesign (Phase 4 — one route per commit, no logic changes)

- [x] **12. Landing page hero** — still old-brand dark gradient + emerald. First impression; do this one first.
- [ ] **13. HomeReadinessPassport** — legacy emerald/amber/sky badges, now visible on the renter home page.
- [ ] **14. Unify the two readiness scores** — RenterHome shows a client-side % next to the Passport's server-side /100 score on the same screen. Keep the server one, extend it for renters.
- [ ] **15. JourneyTracker** (center of the borrower dashboard).
- [ ] **16. HomeownerDashboard** (whole page off-palette).
- [ ] **17. AdminDashboard + StaffDashboard pastel KPI tiles.**
- [ ] **18. AICoach + FirstTimeBuyerHub.**
- [ ] **19. Shared components:** TrustLayer, AffordabilityBadge, NotificationsPanel, BorrowerRequests, DealTeam, ui/toast.
- [ ] **20. PropertyDetail + LivePropertyDetail.**
- [ ] **21. Decide on dark mode** — supported or not. If not, strip the `dark:` variants during the sweep; if yes, test every swept page in dark.
- [ ] **22. Empty-state pass on staff views** (bare "My Queue (0)" panels need guidance like RenterHome has).
- [ ] **23. Accessibility pass** — focus order, aria labels, contrast check on the precision ramp mid-values.

### Compliance guardrails to build ahead of need

- [x] **24. Quiet-hours service** (TCPA 8am–9pm recipient-local, timezone from ZIP). Must exist before ANY outbound SMS/dialer feature ships. *(Done 2026-07-03: `server/services/quietHours.ts` — resolves an IANA timezone from a ZIP 3-digit prefix (AZ=Phoenix/no-DST etc.), computes the recipient's local hour, and gates contact to the 8 AM–9 PM window. Unknown/non-US ZIPs fail SAFE: contact allowed only when inside the window at both the far-eastern and far-western US zones. DST-correct; covered by `tests/quietHours.test.ts`.)*
- [x] **25. SMS STOP / opt-out webhook** — receiver that sets the opt-out flag, purges queues, records the timestamp. Same rule: blocks outbound messaging. *(Done 2026-07-03: canonical `sms_opt_outs` ledger keyed by normalized phone (migration `0003`), so a number stays suppressed even before a lead exists. `POST /api/webhooks/sms` (provider-agnostic; Twilio form fields or JSON) classifies STOP/START/HELP, records the opt-out + timestamp, and purges outreach by flipping matching leads to do-not-contact (digit-normalized match). `server/services/smsCompliance.ts` adds `normalizePhone`, `classifyKeyword`, and `evaluateOutboundSms` — the single guard combining opt-out + quiet hours that a future sender must pass. DB-verified opt-out/resubscribe; unit tests in `tests/smsCompliance.test.ts`. Signature verification is stubbed with a note for when a real provider is wired.)*
- [x] **26. Legal pages** — privacy policy, terms of service, FCRA adverse-action notice flow. Page shells + routing can be built now; final text needs legal review (your side). *(Done 2026-07-03: Privacy, Terms, and Disclosures page shells already existed and are routed (`/privacy`, `/terms`, `/disclosures`). The FCRA adverse-action backend was already complete (adverse_actions table, staff generation + delivery, reasons w/ bureau codes); this closes the consumer side — new borrower-facing `AdverseActionNotice` page at `/adverse-action/:id` renders the notice, reasons, credit-score-used disclosure, CRA contact + free-report/dispute rights, with print/save. Generating a notice now also fires a borrower notification so they're told to read it. **Remaining = your side:** final legal copy review for the privacy/terms text.)*

### Lender-readiness wiring (from kb/LENDER_READINESS_GAP_ANALYSIS.md, 2026-07-03)

- [x] **L1. Persist the funnel's soft-pull consent.** The FCRA checkbox on the pre-approval final step gates client-side only — write it to the consent ledger (IP, user agent, disclosure text, hash) at submit so there's audit evidence. Acceptance: submitting the funnel creates a consent row queryable by application.
- [x] **L2. requireConsent enforcement gate.** `/api/consents/check` exists but nothing calls it. Add a `requireConsent(consentType)` middleware in front of electronic disclosure delivery (Loan Estimate, commitment letter) requiring the seeded eDisclosure (ESIGN) consent. Acceptance: LE generation 403s without consent, works after acknowledging.
- [x] **L3. Anti-steering disclosure.** Doesn't exist anywhere. New consent template + presentation record when LoanOptions shows priced options (lowest rate / lowest cost alternatives), acknowledged through the borrower_consents ledger. Acceptance: viewing loan options records the disclosure; acknowledgment logged with evidence.
- [x] **L4. Auto-match uploads to conditions.** Document upload currently changes nothing — match the uploaded documentType against outstanding condition requiredDocumentTypes, mark them "submitted" for review (never auto-clear), notify assigned staff, and surface one-click stage advance when checkPipelineProgress says ready. Acceptance: uploading a W-2 flips its condition to submitted and staff sees a notification.
- [x] **L5. Show the borrower why their rate is their rate.** calculateLLPA already returns the full base/adjustments/total breakdown — render it on LoanOptions ("760 FICO: −0.25 · 80% LTV: +0.125"). Acceptance: each loan option shows its adjustment decomposition.

---

## Future — blocked on business, do NOT start yet

These wait until licensing and contracts are in motion. Each contract unlocks a small, well-defined engineering ticket because every adapter is already built as a simulation.

- [ ] **F1. NMLS licensing** *(business critical path — everything commercial waits on this)*: company NMLS registration (`server/config/company.ts` says `nmlsId: "PENDING"`), state licenses, licensed-LO roster.
- [ ] **F2. NMLS state-routing gate** *(engineering, but pointless until F1 exists)*: assignment engine must refuse to route applications in regulated states (e.g., Illinois/IRMLA) to unlicensed LOs.
- [ ] **F3. Credit vendor contract** (CRS One / iSoftpull) → then implement the real adapter in `server/mcp/vendors.ts` (it intentionally throws today if a key is set).
- [ ] **F4. Plaid production keys** → real Link + asset reports through the existing webhook.
- [ ] **F5. Truv contract** → real VOIE reports into `verification_reports`.
- [ ] **F6. Fannie Mae DU access** → real submissions through `server/services/ausSubmission.ts`.
- [ ] **F7. HouseCanary (or other) AVM contract** → real valuations via `retrieve_property_valuation`.
- [ ] **F8. LO/staff assignment engine** — routes applications to humans, respecting F2. Build when there are humans to route to.
- [ ] **F10. Regulatory subscriptions + Fannie Developer Portal** *(your accounts, ~30 min total)*: subscribe to Fannie Selling Guide notifications, Freddie Guide bulletin emails, FHA INFO, and VA lender news (the automated watcher covers Freddie/FHA/VA pages + the Federal Register API, but Fannie's page is bot-protected — email is the only Fannie channel today). Register for the Fannie Mae Developer Portal (public APIs free; business-partner APIs unlock with F6). See kb/REGULATORY_MONITORING.md.
- [ ] **F9. Real-time messaging transport** — presence dots are decorative today (no WebSocket transport). Wire to something real or remove; low priority.

---

## Done (recent, for context)

- [x] RenterHome incubator surface (377f82a)
- [x] Repo hygiene: 42 orphaned files removed, formatters consolidated, status colors tokenized (d8fe5a0), 44 unused packages pruned (843d347)
- [x] DEVELOPER_PLAYBOOK.md + PORT fix (6a01de0)
- [x] CTO platform assessment (b0d6766)
- [x] Design system Phases 1–3, dashboard query rewrite, AUS pipeline, MCP server, Vercel migration, brand unification (earlier)
