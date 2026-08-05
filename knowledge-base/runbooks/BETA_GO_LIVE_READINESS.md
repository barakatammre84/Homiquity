# Beta Go-Live Readiness

**Snapshot: 2026-08-05** — full launch-runway refresh (supersedes the 2026-07-12 founder
walkthrough snapshot; its verification record is preserved in §2). Point-in-time state;
update as PRs merge and decisions land. The binding launch-gate checklist is
[PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md) — this doc is the readiness summary
that feeds it, and §3 is the single current founder checklist (it replaces the
contradictory copies that had accumulated across the roadmap and older snapshots).

**Bottom line:** the company is **licensed** (NMLS #427468, Illinois), the site is **live
on homiquity.com**, and the platform is mechanically ready — but the site still renders
the **gated Waitlist** because the founder env flip has never happened. Between today and
an open funnel: one **immediate ops blocker** (Vercel deploy freeze — §3 item 0), one
**regulatory gate** (counsel sign-off — [LAUNCH_COUNSEL_PACKET.md](../compliance/LAUNCH_COUNSEL_PACKET.md)),
one **env block** (LS-2), and two **facts only the founder holds** (business mailing
address, IL license number). Real *loans* (vs. a real open site) additionally need the
vendor contracts in §3 item 6 — start that paperwork now; lead time runs in parallel.

---

## 1. What changed since the 2026-07-12 snapshot

Each line is dated and verifiable; nothing below is aspirational.

- **Licensed** — PR #154 (2026-07-13) set company **NMLS #427468** in
  `shared/companyIdentity.ts`; `companyNmlsDisplay()` renders it site-wide. The
  "pre-license" framing of the old checklist is obsolete: solicitation is no longer
  barred by licensure, only by the un-flipped gate and the open counsel items.
- **Domain cutover done** (2026-07-13) — prod serves `https://www.homiquity.com`
  (`homiquity.com` 308s to www). The old checklist listed this as pending.
- **Broker channel declared** (F-14, `shared/businessChannel.ts`:
  `BUSINESS_CHANNEL = "broker"`) — **`mersOrgId` is closed as N/A**: MERS registration
  and GSE delivery are the wholesale lender's obligations; `server/config/company.ts`
  resolves `NOT_APPLICABLE_BROKER_CHANNEL`, and the seller/servicer delivery stack is
  frozen behind a guard. Do not resurrect this item.
- **Adverse action is wired, not deferred** — a denial is blocked unless a compliant
  §1002.9 / FCRA §615 notice generates; staff card delivers/mails the PDF; 30-day
  watchdog de-dups (F-004 closed; see §2 table).
- **MISMO XSD baseline shrank 9 → 2** (2026-08-05, roadmap L6-fix) — the remaining pair
  is the U-1 escalation (AUS data-point names pending ULDD data-dictionary confirmation).
- **Launch hygiene** — PR #388 (2026-08-05): the public site's contact channels were a
  fake vanity number and five unprovisioned mailboxes (including the **TCPA STOP** and
  **privacy-rights** channels in Terms/Privacy) — now rendered from `COMPANY_IDENTITY`;
  the Disclosures complaints card pointed at the **New York DFS** — now IDFPR; the SEO
  prerender advertised `/rates*` metadata to bots while humans were redirected — it now
  honors the prelaunch gate (waitlist-safe copy + noindex).
- **🔴 Vercel deploy freeze** (2026-08-05 ~17:20 UTC) — the day's merge train exhausted
  the **Hobby-tier** build quota. Merges #385 and #388 produced **no production
  deployment at all** (not an error state — the deployment is simply never created);
  prod serves #386. Quota-refused pushes never self-deploy later. See §3 item 0.

## 2. Verified state — probed 2026-08-05

| Check | Result |
|---|---|
| Prod deploy | `READY`, target production, serving `f7e0f5e` (#386) — **two merges behind `main`** (#385, #388) due to the deploy freeze |
| Gate posture | `/` renders the **Waitlist** ("Launching Soon") — `VITE_PRELAUNCH_GATED` unset ⇒ prod default GATED. Server gate is **open by design** post-licensure (`prelaunchGate.ts` fail-safe keys to `isCompanyNmlsPending()`); set `PRELAUNCH_GATED=true` explicitly if API-side closure is wanted pre-flip |
| `GET /api/health` | 200 — but **5.5–7.4 s cold starts measured** (Neon scale-to-zero + function cold boot); see §3 item 4 |
| Prod DB migrations | CI `migrate-prod` dry-run: **"up to date — no pending migrations"** (journal 47 entries, 0000–0046). Note #385's migration applied while its deploy was frozen — safe because expand-only (append-only table the serving code ignores) |
| Auth | `/api/auth/providers`: Google live |
| Repo | private; branch protection + `enforce_admins` with the required `gate` check |

**Workflow verification record (2026-07-12 walkthrough — last full pass; flip day re-runs
all of it via [PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md)):** applicant funnel
end-to-end · borrower post-submission dashboard · beta-LO cockpit claim/work ·
wholesale-lender push to `lender_submissions` with hashed MISMO 3.4 package · document
upload → extraction (presigned-only, magic-byte checks, cross-borrower 403) · credit
consent → denial → adverse action (never auto-denies; denial blocked without a compliant
notice). All six verified live then, shipped as PRs #135–#139.

## 3. Go-live checklist (founder actions) — THE current list

`[GATE]` = regulatory · `[DECISION]` = your call · `[ENV/OPS]` = configuration · `[FACT]` = information only you have.

- [ ] **0. `[OPS]` 🔴 Unfreeze deployments — do this first, launch or not.** Upgrade the
  Vercel account to **Pro**, then **Redeploy** latest `main` from the dashboard once
  (quota-refused merges never deploy themselves). Pro is independently required: the
  Hobby plan's fair-use terms bar commercial use, and today proved its build quota can't
  carry this repo's merge cadence. The launch flip (item 7) is impossible while frozen —
  it requires a fresh build.
- [ ] **1. `[ENV]` LS-2 ops env in Vercel (production scope).** GCS
  (`GCS_SERVICE_ACCOUNT_KEY`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` — else
  uploads correctly 503) · `SENDGRID_API_KEY` + `FROM_EMAIL` + SPF/DKIM DNS ·
  `SENTRY_DSN` + an uptime monitor on `/api/health` · `CRON_SECRET` (the four
  `vercel.json` crons no-op without it — including **adverse-action delivery watch**) ·
  `APP_BASE_URL=https://www.homiquity.com`. Verify the **Environments column per-var**
  (the 2026-07-16 outage lesson) — and note the boot secrets (`DATABASE_URL`,
  `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`, `SESSION_SECRET`) can only be confirmed in
  the dashboard; the API surface doesn't list env vars.
- [ ] **2. `[FACT]` Hand two values to engineering.** (a) The **business mailing
  address** — ECOA adverse-action notices require the creditor's name *and address*, and
  the Disclosures page currently says "available on request"; counsel flags this as
  resolve-before-un-gating. (b) The **Illinois license number** (IDFPR) for
  `LICENSED_STATE_DETAILS` — the State Licensing card shows the license name with no
  number. Also decide: keep `support@homiquity.com` as the single public mailbox
  (current state after #388), or create dedicated `privacy@` / `compliance@` aliases —
  if created, engineering splits them back out (one-line changes).
- [ ] **3. `[GATE]` Counsel sign-off** on the four flip-blocking asks in
  [LAUNCH_COUNSEL_PACKET.md](../compliance/LAUNCH_COUNSEL_PACKET.md) (priced public
  calculators + apply CTAs; adverse-action wording + creditor address; denial-reason
  specificity; Reg N cite confirmations). The packet is sendable as-is and deliberately
  excludes every parked-feature counsel item.
- [ ] **4. `[OPS]` Security & account batch** (~1 hour, one sitting): the 2FA checklist
  in [PLAID_SECURITY_QUESTIONNAIRE_ANSWERS.md](../governance/security/PLAID_SECURITY_QUESTIONNAIRE_ANSWERS.md) §1
  (all nine consoles are still ⬜) · delete the `GEMINI_API_KEY` Vercel var **and**
  revoke the key at Google AI Studio (deleting ≠ revoking) · the two Neon Console
  clicks in [NEON_PREVIEW_DB.md](NEON_PREVIEW_DB.md) §3 (until then, previews still
  clone prod PII) · **pin prod Neon compute / disable scale-to-zero** (5.5–7.4 s cold
  starts measured on the live domain today — a lender demo or first borrower of the
  morning eats that) · optionally drop the legacy `mortgage-stream.vercel.app` domain
  alias (cosmetic).
- [ ] **5. `[DECISION]` Launch-shape decisions.** Beta posture — recommended: set
  `BETA_ACCESS_CODE` and open invite-only first (the
  [ARMED_LAUNCH_CHARTER](../governance/ARMED_LAUNCH_CHARTER_2026-07-07.md) §9 sequence;
  deleting the code later = public launch, no rebuild needed) · `CSP_ENFORCE` — enforce
  or keep Report-Only, record the choice · document extraction — `ANTHROPIC_API_KEY` is
  live in prod, so extraction is real; nothing to do unless you prefer
  `EXTRACTION_SIMULATE=true` · `CREDIT_VENDOR_MODE` stays **unset** (prod refuses to
  fabricate credit — correct until F3) · provision beta LO accounts (admin-assigned,
  never self-registered).
- [ ] **6. `[BIZ]` Start vendor paperwork now — lead time runs parallel to everything
  above.** F3 credit-bureau reseller (until signed, no real pre-approvals — pulls
  refuse by design) · F6 DU/LPA access · F4 Plaid production keys (mid-clearance) ·
  **Target-5 wholesale broker agreements** — the hard dependency for real lender
  submission (LS-10 slice 3); re-verify all five are still wholesale-broker-friendly
  and NMLS-active per the 2026-07-04 shortlist before signing.
- [ ] **7. `[GATE]` The flip, in order** (only after 0–3 are green): set
  `BETA_ACCESS_CODE` → set `PRELAUNCH_GATED=false` **and** `VITE_PRELAUNCH_GATED=false`
  → **redeploy** (the VITE flag is compiled into the build; a runtime-only change does
  nothing) → run [PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md) top to bottom, every
  ⛔ green → sign-off table + [CICD ledger](CICD.md) row → invite beta users → when
  ready for public: delete `BETA_ACCESS_CODE` (middleware becomes a no-op — site public,
  no rebuild).

## 4. Honest limitations (unchanged by launch)

Deliberate simulated adapters — correct for an invite beta, material before real loans.

- **Wholesale-lender push is simulated** — real, hashed, compliant MISMO package; nothing
  transmits. Unblocked only by signed broker agreements + the portal adapter (LS-10
  slice 3).
- **Credit and AUS are simulated** (and prod credit pulls **refuse** rather than
  simulate — hardened again in #386/F-037). Real findings need F3/F6 contracts.
- **MISMO XSD baseline = 0** (U-1 resolved 2026-08-05 — AUS element names verified against
  the official ULDD Phase 5 schema and both export purposes validate clean; the export
  honestly labels the simulated AUS leg `Other`, never `DesktopUnderwriter`). Narrowed
  residual: ULDD **Appendix D** delivery conditionality/values — founder drops Appendix D
  into `docs/fannie-mae/` (the job aid is bot-blocked) and the values get pinned too.

## 5. For counsel

All flip-blocking legal asks live in
[LAUNCH_COUNSEL_PACKET.md](../compliance/LAUNCH_COUNSEL_PACKET.md) — question, current
implementation, and source references for each. Parked-feature counsel items (halal
lane, PartnerHub consent/RESPA, IVES/§7216, verified-funds letters) are deliberately
excluded there and tracked in their own program docs.
