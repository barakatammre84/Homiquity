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
- [ ] **2. Password reset + email verification.** Neither exists — a locked-out user is locked out forever. Build forgot-password (email link, expiring token) and verify-email-on-signup flows. Acceptance: reset a password end-to-end in production.
- [ ] **3. Turn on real email.** `emailService.ts` silently logs emails to console because no provider is configured in production. Set up SendGrid (API key env var + domain SPF/DKIM). Acceptance: receive a real email from the app. *(Do before or together with task 2 — reset emails need it.)*
- [ ] **4. Add error monitoring + uptime alerts.** Right now a production crash is invisible. Add Sentry (client + server) and a free uptime monitor pinging `/api/health`. Acceptance: force a test error, see it in Sentry.
- [ ] **5. Restore minimal CI.** `.github/` was deleted in the "no gates" simplification. Add one non-blocking GitHub Action: typecheck + unit tests on every push (informational only — deploys still never wait). Acceptance: a push with a type error shows a red ✗ on the commit.

### Fix the workflows that work wrongly

- [ ] **6. Tame the task engine.** Borrowers see "Complete 56 pending tasks." Add caps, group tasks into milestones ("3 documents needed"), and filter by loan stage. Acceptance: test buyer sees ≤ 5 meaningful next steps.
- [ ] **7. Stage-gated data validation.** Applications reach "pre-approved" with no loan amount ($0 volume on admin) and contradictory signals (pre-approved with 0 documents). Enforce required-fields-per-stage in the borrower state machine. Acceptance: admin dashboard shows real volume; no impossible state combinations.
- [ ] **8. Build the leads intake API.** The compliant `leads` table exists but has no endpoints — no way for a landing page or aggregator to create a lead. Build `POST /api/leads` (Zod-validated, TrustedForm evidence required, rate-limited) + a staff list view. Acceptance: integration test creates and lists a lead.
- [ ] **9. Lifecycle jobs.** Three deferred jobs: daily refi-alert scan, equity-snapshot job (AVM → snapshots), and the closed-loan graduation hook that auto-surfaces the Homeowner Hub. Acceptance: close a test loan, Homeowner Hub appears with an equity snapshot.
- [ ] **10. Make integration tests self-cleaning.** Test runs pollute `buyer@test.com` with new applications and drift the dashboards. Tests should create and delete their own fixtures. Acceptance: two consecutive runs leave the database identical.
- [ ] **11. Demo rate sheet for production.** Pricing returns "no products" in prod. Either seed a clearly-marked demo sheet or build the staff rate-sheet upload flow. Acceptance: best-execution quote works in production.

### Finish the redesign (Phase 4 — one route per commit, no logic changes)

- [ ] **12. Landing page hero** — still old-brand dark gradient + emerald. First impression; do this one first.
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

- [ ] **24. Quiet-hours service** (TCPA 8am–9pm recipient-local, timezone from ZIP). Must exist before ANY outbound SMS/dialer feature ships.
- [ ] **25. SMS STOP / opt-out webhook** — receiver that sets the opt-out flag, purges queues, records the timestamp. Same rule: blocks outbound messaging.
- [ ] **26. Legal pages** — privacy policy, terms of service, FCRA adverse-action notice flow. Page shells + routing can be built now; final text needs legal review (your side).

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
- [ ] **F9. Real-time messaging transport** — presence dots are decorative today (no WebSocket transport). Wire to something real or remove; low priority.

---

## Done (recent, for context)

- [x] RenterHome incubator surface (377f82a)
- [x] Repo hygiene: 42 orphaned files removed, formatters consolidated, status colors tokenized (d8fe5a0), 44 unused packages pruned (843d347)
- [x] DEVELOPER_PLAYBOOK.md + PORT fix (6a01de0)
- [x] CTO platform assessment (b0d6766)
- [x] Design system Phases 1–3, dashboard query rewrite, AUS pipeline, MCP server, Vercel migration, brand unification (earlier)
