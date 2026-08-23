# CEO business queue — the non-engineering half of launch

> **Freshness:** last verified 2026-08-23 · review every 30 days
> **Authority:** founder direction, 2026-08-23. **L1** [Vision & Scope](../L1_VISION_AND_SCOPE.md)
> §2 (the core loop this work serves) · **L2** [Compliance & Logic](../L2_COMPLIANCE_AND_LOGIC.md)
> I9 (NMLS licensing gates solicitation).

## Why this file exists

**Founder direction, 2026-08-23:** *"The CTO roadmap should not focus on this portion of the
business — only the tech and code needed. We need to build a full app as part of our lender approval
process, so when we meet with them they can test a live and real client application."*

That reverses the usual order. We are not building the platform because a lender approved us; we are
building it **to get** approved. So [`CTO_ROADMAP.md`](../../CTO_ROADMAP.md) becomes an engineering
queue and nothing else, and every item below — legal, licensing, vendor paperwork, billing, DNS,
outreach — moved here **verbatim, nothing deleted**, on that date.

## What moving them does and does not mean

**Does:** the engineering queue stops being 40% items no engineer can action, so the ranked build
list ([the Lender-Demo Ten](../launch/LENDER_DEMO_TEN.md)) is readable at a glance.

**Does not:** remove the dependency. A *funded* loan still needs a signed broker agreement, a credit
vendor and DU access. Those constraints did not weaken by being filed elsewhere — they stopped
competing for engineering attention. **The build lane does not wait on this queue, and this queue
does not wait on the build lane** — but the demo is what converts the relationship, so the build
lane sets the meeting date.

## The item this queue now leads with

**Selling Guide A3-3-01 — "no manual, no broker approval."** `sop/SOP-000-manual-charter.md` records
the obligation; the manual itself is an unsigned DRAFT whose four content directories hold nothing
but `.gitkeep`. ⚠️ Its A3-3-01 wording is marked unverified pending procurement — confirm the cite
against `docs/fannie-mae/selling-guide/` before relying on it. Whatever the exact wording, a written
QC plan is a standard TPO onboarding requirement and we do not have one.

**The question to ask the first AE, because it re-ranks everything:** *does your onboarding run the
security/QC review before the technical demo, or after?* If before, the
[second ten](../launch/LENDER_DEMO_TEN.md) moves onto the critical path and the build sprint roughly
doubles.

---

## §A Relationships → paperwork (the lane that sets the meeting)

- [ ] **1.1 Confirm the go-live flip that live probes say already happened.** Prod has served
  ungated public pages since 2026-08-06; re-probed 2026-08-17: `/` and `/api/rates` 200 with no
  prelaunch/waitlist markers (launch-gate report). `PRELAUNCH_GATED` and `VITE_PRELAUNCH_GATED`
  still exist as **names** in Railway variables and values are unreadable from any session — open
  the panel, confirm both are `false`/removed, then archive this line. `BETA_ACCESS_CODE` is a
  separate front-door switch (currently unset — #526 E2).
- [ ] **1.2 Railway service variables — live read 2026-08-17 (#526 E2): 19 non-injected names set;
  launch-critical still unset:** `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR` (+
  `PUBLIC_OBJECT_SEARCH_PATHS`) — durable uploads; `request-url` 503s `UPLOADS_UNCONFIGURED` until
  they land; `SENTRY_DSN` + an uptime monitor on `/api/health` (a prod crash between CI
  `verify-deploy` runs is invisible); `GOOGLE_MAPS_API_KEY` — `server/routes/geocode.ts:34` 503s
  without it, so **every production address lookup fails today**; `RAPIDAPI_KEY` (or record staying
  on the simulated rate survey in ASSUMPTIONS.md). Also delete the stray lowercase `fromemail`
  sitting beside the real `FROM_EMAIL`. Verified done and dropped from this line 2026-08-17:
  SendGrid key + `FROM_*` set; `CRON_SECRET` matches (sweeps 200 — #526 E6); `DATABASE_URL` on a
  populated branch (data-backed routes 200). ~45 min.
- [ ] **1.3 Wholesale-lender outreach — UNBLOCKED since 2026-07-13; still unworked five weeks later
  (2026-08-17).** F1 cleared with NMLS #427468, but the shortlist still gated five actions on "once F1
  clears". Live now: the UWM AE / Director-hotline call (sandbox process + whether BOLT exposes a
  PPE-consumable feed); the Newrez Brigade contact for the sandbox path; Angel Oak / Newrez
  approval-checklist requests; a manual read of Plaza's wholesale-broker guide PDF for
  net-worth/bond minimums; and **re-verifying all five are still broker-friendly and NMLS-active**
  (the file is a 2026-07-04 snapshot). Detail:
  [wholesale-lender-shortlist](../research/my-research/wholesale-lender-shortlist-2026-07-04.md).
- [ ] **1.4 Start the F3 (credit vendor) and F6 (DU/LPA) applications now** — vendor paperwork lead
  time runs *in parallel* with everything else, not after it. Starting the paperwork is not the same
  as building against it. No application opened as of 2026-08-17 (#526). Ask in the same first
  email: SOC 2 Type II + signed DPA + permissible-purpose / FCRA end-user certification package
  (F3); both the DU **and** LPA legs (F6).

---

## §B Counsel, licensing and regulatory subscriptions

- [ ] **1.7 Counsel gates, aggregated** (detail:
  [BETA_GO_LIVE_READINESS.md](../runbooks/BETA_GO_LIVE_READINESS.md) §5): BUILD-1
  pre-license calculator deviation · PH-2 consent copy · the Reg N cite confirmations from #138 ·
  the UAL §5 halal-lane review · **an ad-imagery / Fair Housing marketing policy — none exists**
  (flagged by `attached_assets/lifestyle/CREDITS.md`) · ratification of
  [MODEL_RISK_GOVERNANCE.md](MODEL_RISK_GOVERNANCE.md), which both READMEs
  cite as an authority while it is still marked DRAFT. **Added 2026-08-19 (qa-sweep F-0819-04,
  counsel Ask 2 — the half a session cannot close):** in a *brokered* transaction, is Homiquity the
  **creditor** whose federal administering agency belongs on an adverse-action notice
  (§1002.9(g))? The mechanical half is settled and is a §3 ticket — every notice we generate today
  names the **CFPB**, while Reg B Appendix A item 9 assigns the **FTC** to a non-depository
  originator — but which entity is named turns on the creditor question, so the fix is written
  against your answer, not ahead of it.
- [ ] **1.8 Regulatory subscriptions + Fannie Developer Portal** (~30 min): Fannie Selling Guide
  notifications (**email is the only Fannie channel** — their page is bot-protected), Freddie Guide
  bulletins, FHA INFO, VA lender news; register for the Developer Portal (public APIs free,
  business-partner APIs unlock with F6). See
  [REGULATORY_MONITORING.md](../compliance/REGULATORY_MONITORING.md). Urgency doubled
  2026-08-17: the automated Tier-2 watcher (`reg:watch`) has been dark since 2026-07-04 (§3.15) —
  right now **no channel, automated or human, reports a guideline change**.

- [ ] **1.10 Counsel: is the referral-commission payout permitted?** Two questions, both opened by
  the [2026-08-08 financial re-audit](../logs/2026-08-08-financial-architecture-reaudit-commission-payouts.md)
  (F-21) and recorded in the regulatory ledger under `regz-1026-36d1-referral-commission-payout` on a
  **14-day** interval so `pnpm checkup` goes loud. (a) **Reg Z §1026.36(d)(1)** — a *fixed* percentage
  of the amount of credit extended is permitted; `POST /api/broker/commissions` takes a percentage
  chosen **per file** by an admin, and `calculateAgentCommission` would pay 25% of a lender comp
  figure that varies by lender and product. (b) **RESPA §8** — the partner tables were built with no
  fee/commission columns *by design* (charter §5-C1), and `broker_commissions` is that column set on
  the same referral edge. Today only the staff `broker` role can reach it (the `agent` role in the
  gate does not exist), so nothing is exposed — but §3.7 schedules wiring it up. **No commission may
  be paid on a live file until this is answered.**
- [ ] **1.11 Set the four email-auth DNS records at Squarespace — the 2026-08-17 vendor FAIL
  (#526 E1).** SPF TXT on the apex, DMARC TXT at `_dmarc`, and SendGrid's `s1`/`s2` DKIM CNAMEs
  **on the apex** (the existing `s1._domainkey.www` is scoped to the wrong host and never queried).
  Until then every password reset, verification and waitlist email leaves unauthenticated and lands
  in spam while `/api/health` reports email fine. MX (Google Workspace) intact — inbound
  unaffected. Recovery values: the DNS zone notes. ~20 min.
- [ ] **1.12 Authorize a Reg Z / FCRA / CROA capture pass into `docs/reg-z/`** (compliance-watch
  2026-08-17 ⛔5 + qa-sweep U-26; procedure in `docs/reg-z/README.md`): 12 CFR 1026.36(d)(1)-(2),
  1026.32(b)(1), 1026.19(e)(3), FCRA 1681s-2, CROA 1679b. **Corrected 2026-08-17 evening — the
  premise this item and `CLAUDE.md` both rest on is stale:** two qa-sweep agents independently got
  **200** from `consumerfinance.gov/rules-policy/regulations/1026/…`, the eCFR *versioner API*, and
  `law.cornell.edu`; only eCFR **HTML** is blocked. So this is no longer "only the founder can
  fetch it" — it is that nothing is *captured and versioned*, so a reading is unrepeatable. The
  founder decision is narrower and cheaper than it was: **authorize a session to capture those
  texts into `docs/reg-z/` and amend the `CLAUDE.md` "every authoritative source is blocked"
  clause** (it is a binding project rule, so a session may not amend it unasked). **The first of
  five ledger entries reaches its review date TODAY (2026-08-18); the remaining four follow through
  2026-08-23** — past this point `pnpm checkup` is reporting on stale verification, and two P1s
  (F-076, F-079) stay held below their evidence until a Reg Z reading may be asserted.
- [ ] **1.13 One NMLS login session, four outcomes** (compliance-watch 2026-08-17 ⛔1–4 +
  [STATE_LADDER.md](../compliance-watch/STATE_LADDER.md)): (a) **does an IL-licensed
  MLO with an approved sponsorship exist?** — if not, nobody can originate the first Illinois loan
  and this becomes the top item in this section; (b) pull Consumer Access / MU1 / surety bond /
  financial-statement records; (c) download the IL checklists from the NMLS Resource Center
  (unreachable from sessions) and hand them to a session for `docs/nmls/`; (d) confirm the first
  MCR due date (computed: Q3-2026 RMLA due **2026-11-14**; prep draft ready in
  `knowledge-base/compliance-watch/drafts/`) and calendar it. ~1 h.
- [ ] **1.14 Decide F-040's scope: the stored FCRA disclosure promises 120-day consent validity,
  but `credit_consents` has no expiry column and no gate checks age.** Does 120 days bind funnel
  soft-pull consents too, or only `/credit-consent` hard pulls? Strictest defensible reading (bind
  everything, force re-consent past 120 d) is the default absent an answer. The mechanism (expiry
  column + age gate, expand-only migration) is a routine engineering item once decided (PE-006).
- [ ] **1.15 Counsel: is the borrower Loan Options page a §1026.18 disclosure?** (qa-sweep 2026-08-17
  ⛔3, F-076.) If it is, the §1026.22(a)(2) 1/8% APR tolerance is exceeded **4–7×** and F-076
  escalates P1 → P0. Fetching the regulation does not settle it — it is a characterization
  question. It gates how *fast* §3.18 must move, not whether it moves, so it does not block that
  work starting.

---

## §C Billing and infrastructure spend

Moot while development is local-only (founder direction 2026-08-19), and live again the day we
redeploy. **`KTLO-4` did not move** — `main` still auto-deploys to a public site with no gate, and
that is an engineering safety item, so it stays in
[`CTO_ROADMAP.md`](../../CTO_ROADMAP.md) §0.

- [ ] **KTLO-1. Railway — being decommissioned, not paid for.** Founder direction 2026-08-19:
  development is local-only until the app is fully built and debugged; the production service is
  to be taken down deliberately rather than left to lapse unattended. CI's `migrate-prod` and
  `verify-deploy` jobs are paused accordingly (see `.github/workflows/ci.yml`, both carry restore
  instructions). **Blocked on one thing first:** a read-only census of the production database, so
  the decision is made against row counts rather than a guess — and that census runs through CI,
  which is currently dead (KTLO-2). Do not take the service down until the census answers.
  **Founder-held.** Superseded text follows for provenance:
- [ ] ~~**KTLO-1. Railway billing — add a payment method; the risk is the expiring trial credit, not
  consumption.** Re-measured 2026-08-17 (#536): 7-day usage ≈ **$3.20/month** (CPU avg 0.0002 vCPU,
  mem 0.32 GB — the container is idle), so this is the $5 Hobby plan plus a trial credit last read
  "~30 days / ~$4.97" on **2026-08-06** and unreadable by any session since (no MCP billing
  endpoint; the local `RAILWAY_API_TOKEN` is dead — #536 E8). When the credit lapses **production
  stops serving.** Railway → project `Homiquity` → Settings → Billing. Coupled: image retention is
  **72 h on Hobby** — the 2026-08-18 merge round (#539/#537/#514/#536/#543) refreshed the rollback
  window, which now relapses **~2026-08-21** without another deploy
  ([ROLLBACK.md](../runbooks/ROLLBACK.md) §1).~~
- [ ] 🚨 **KTLO-2. GitHub Actions billing has FAILED — every merge is blocked.** Escalated
  2026-08-19. The repo was flipped **public** on 2026-08-18, which made Actions free and *masked*
  an underlying payment failure. It was flipped back to **private** on 2026-08-19 (founder
  direction — the security pack and the open-findings register were world-readable), and the
  failure immediately reasserted: every run since 14:18 UTC dies in ~2 s with `steps: []` and the
  annotation *"The job was not started because recent account payments have failed or your
  spending limit needs to be increased."* Runs up to 14:16 succeeded.
  **Consequence, precisely:** `gate` is a required status check on `main` with
  `enforce_admins: true`, so no new PR can merge — the check never runs, the PR sits
  "Expected — Waiting for status", and nobody can bypass it. PRs whose gate went green before the
  flip keep their recorded pass and remain mergeable. The read-only prod census (KTLO-1) is
  blocked on this too.
  **DECISION 2026-08-19 — the required check was REMOVED rather than the bill paid.** Development
  is local-only and not launching, so the gate moved from GitHub to the laptop: `main`'s
  `required_status_checks.contexts` is now `[]`. Force-push and deletion protection and
  `enforce_admins` are untouched. This is safe *only because* the local gate was hardened the same
  day — `.githooks/pre-push` now BLOCKS instead of skipping when it cannot check anything, and
  `scripts/hooks-installed-guard.cjs` fails when a clone has `core.hooksPath` unset, which is how a
  fresh clone used to start ungated. Run `pnpm preflight` before opening a PR; it is the same 16
  checks CI ran.
  🚨 **RESTORE THIS BEFORE ANY RETURN TO LAUNCH.** One command — the separators are U+00B7 MIDDLE
  DOTs, not periods, and the string must match verbatim or every PR deadlocks on a check that never
  arrives:
  ```bash
  echo '{"strict":false,"contexts":["gate (typecheck · tests · schema guard)"]}' | gh api -X PATCH repos/barakatammre84/Homiquity/branches/main/protection/required_status_checks --input -
  ```
  **Fix:** GitHub → Settings → Billing & plans — resolve the failed payment and/or raise the
  Actions spending limit. The alternative is re-publishing the repo, which re-exposes
  `knowledge-base/feature-review/FINDINGS.md` and `governance/security/`. **Founder-held, and it
  now outranks everything else in this file.** Prior measurement for context:
- [ ] ~~**KTLO-2. GitHub Actions minutes — this is the platform bill, not Railway.** Measured
  2026-08-17 (#536 E9): ~13.6 CI runs/day × ~4–5 billable min ≈ **1,850 of the private repo's
  2,000 free min/month (~92%)**; overage $0.008/min. The 2026-08-06 queueing symptom is stale —
  Actions was healthy all day today (launch-gate 2026-08-17). Mitigations landed 2026-08-17: the
  local pre-push gate (#529) and superseded-run cancellation (#535). Decide: set an Actions
  spending limit **knowing a hard cap that halts `gate` also halts every merge and `migrate-prod`**,
  or accept overage. Settings → Billing → Actions.~~
- [ ] **KTLO-3. Neon production compute is unpinned — cold starts measured at 5.5–7.4 s.** The first
  request after autosuspend pays that, on the borrower funnel. Decide alongside KTLO-1 (same billing
  conversation): pin the compute / disable autosuspend on the production branch, or accept it and
  record the number in [ASSUMPTIONS.md](ASSUMPTIONS.md). Still unverified
  2026-08-17: the GitHub cron sweeps (every ~20–40 min) keep the compute warm and mask the cold
  start; the first borrower after a real idle window still pays it (#526 E6). **Founder-held.**

---

## Maintenance

Same rules as the roadmap it was carved from: **one line per open item**, done = deleted here and
appended to the archive ledger in the same PR, a correction **edits the item** rather than being
appended under it, and no item returns to `CTO_ROADMAP.md` — that file is engineering only.
