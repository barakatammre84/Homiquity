# Beta Go-Live Readiness

**Snapshot: 2026-08-05** — full launch-runway refresh (supersedes the 2026-07-12 founder
walkthrough snapshot; its verification record is preserved in §2). Point-in-time state;
update as PRs merge and decisions land. The binding launch-gate checklist is
[PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md) — this doc is the readiness summary
that feeds it, and §3 is the single current founder checklist (it replaces the
contradictory copies that had accumulated across the roadmap and older snapshots).

> **⚠️ Platform update 2026-08-06 — hosting is now Railway, not Vercel.** The migration
> is complete in code and the **Vercel project has been deleted** (its API 404s). Every
> instruction below that named a Vercel setting has been rewritten for Railway: env vars
> live in **Railway service variables** (Railway → project `Homiquity` → service
> `Homiquity` → **Variables**), deploy config is code in [`railway.json`](../../railway.json),
> and scheduled sweeps are GitHub Actions
> ([`cron-jobs.yml`](../../.github/workflows/cron-jobs.yml)), not a platform cron block.
> §1 and §2 below are **dated records** of what was true on 2026-08-05 and are left
> as-written; §3 is the live checklist and is current.
>
> Two 2026-08-06 incidents changed how you *verify* anything here, and they bind the flip:
> **(a)** a *failed* Railway deploy leaves the previous container serving — the site stays
> up, every check stays green, and prod silently goes stale (nine failed builds, ~8 commits
> behind, undetected). **"SUCCESS" and a 200 from `/api/health` are not evidence a merge
> shipped — only `/api/health`'s `commit` field is.** **(b)** Railway's `DATABASE_URL` was
> pointed at a stale Neon branch; `/api/health` stayed 200 (its `SELECT 1` succeeded against
> the wrong database) while `/api/articles` and `/sitemap.xml` 500'd. Spot-check a
> data-backed route, not just health.

**Bottom line:** the company is **licensed** (NMLS #427468, Illinois), the site is **live
on www.homiquity.com**, and the platform is mechanically ready — but the site still renders
the **gated Waitlist** because the founder env flip has never happened. Between today and
an open funnel: one **regulatory gate** (counsel sign-off —
[LAUNCH_COUNSEL_PACKET.md](../compliance/LAUNCH_COUNSEL_PACKET.md)), one **env block**
(LS-2, now on Railway), and two **facts only the founder holds** (business mailing address,
IL license number). The ops blocker that headed this list on 2026-08-05 — the Vercel
build-quota freeze — was resolved by migrating off Vercel entirely (§3 item 0). Real
*loans* (vs. a real open site) additionally need the vendor contracts in §3 item 6 — start
that paperwork now; lead time runs in parallel.

**Canonical host:** `https://www.homiquity.com` (Squarespace DNS `CNAME www →
*.up.railway.app`). The apex `homiquity.com` is **not** on Railway — Railway needs CNAME
flattening/ALIAS at the apex and Squarespace does not offer it, so the bare domain serves a
Squarespace parked page. Use the `www.` form everywhere, including in anything customer-facing.

---

## 1. What changed since the 2026-07-12 snapshot

Each line is dated and verifiable; nothing below is aspirational.

- **Licensed** — PR #154 (2026-07-13) set company **NMLS #427468** in
  `shared/companyIdentity.ts`; `companyNmlsDisplay()` renders it site-wide. The
  "pre-license" framing of the old checklist is obsolete: solicitation is no longer
  barred by licensure, only by the un-flipped gate and the open counsel items.
- **Domain cutover done** (2026-07-13) — prod serves `https://www.homiquity.com`
  (`homiquity.com` 308s to www). The old checklist listed this as pending.
  *[2026-08-06: the `www` host survived the move to Railway (Squarespace `CNAME www →
  *.up.railway.app`), but the apex redirect did not — Railway needs CNAME
  flattening/ALIAS at the apex, which Squarespace doesn't offer, so `homiquity.com`
  now serves a Squarespace parked page instead of 308ing. `www.` is the canonical
  host; treat the bare apex as not ours.]*
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
  *[2026-08-06 resolution: rather than buying Vercel Pro, the platform was migrated to
  **Railway** and the Vercel project deleted. This freeze cannot recur; its successor
  failure mode is the Railway one — a failed build leaves the previous container
  serving, which also produces a silently stale prod. The shared lesson survives the
  platform change: **only `/api/health`'s `commit` field proves a merge shipped.**]*

## 2. Verified state — probed 2026-08-05

| Check | Result |
|---|---|
| Prod deploy | `READY`, target production, serving `f7e0f5e` (#386) — **two merges behind `main`** (#385, #388) due to the deploy freeze |
| Gate posture | `/` renders the **Waitlist** ("Launching Soon") — `VITE_PRELAUNCH_GATED` unset ⇒ prod default GATED. Server gate is **open by design** post-licensure (`prelaunchGate.ts` fail-safe keys to `isCompanyNmlsPending()`); set `PRELAUNCH_GATED=true` explicitly if API-side closure is wanted pre-flip |
| `GET /api/health` | 200 — but **5.5–7.4 s cold starts measured** (Neon scale-to-zero + function cold boot); see §3 item 4 |
| Prod DB migrations | CI `migrate-prod` dry-run: **"up to date — no pending migrations"** (journal 47 entries, 0000–0046). Note #385's migration applied while its deploy was frozen — safe because expand-only (append-only table the serving code ignores) |
| Auth | `/api/auth/providers`: Google live |
| Repo | private; branch protection + `enforce_admins` with the required `gate` check |

*[The table above is the 2026-08-05 probe record, taken while prod was still on Vercel —
left as-written. Re-probe before the flip, against Railway and with the 2026-08-06 method:
read `commit` from `GET https://www.homiquity.com/api/health` and compare it to
`git rev-parse origin/main` (a status of SUCCESS proves nothing), and hit `/api/articles`
and `/sitemap.xml` to confirm the service is on the right Neon branch. The "cold starts"
row was measured against a serverless function plus Neon scale-to-zero; on Railway the app
is a **single persistent process**, so the function-cold-boot half of that number is gone —
the Neon scale-to-zero half is not, and is still §3 item 4.]*

**Pre-flight 2026-08-05 (afternoon):** workflows 1, 2 and 5 were re-driven end-to-end by
verifier agents against current `main` — the first full pass since 07-12, ~250 PRs later.
Machinery held everywhere (TRID set-exactly-once, letter refusal seams, dual AUS, package
hash integrity, full submission status machine, adverse-action chokepoint + watchdog), and
the run caught four launch-relevant defects, fixed same-day in
[#392](https://github.com/barakatammre84/Homiquity/pull/392)/[#394](https://github.com/barakatammre84/Homiquity/pull/394)/[#395](https://github.com/barakatammre84/Homiquity/pull/395):
MISMO U-1 (export now validates clean), missing CDN security headers, the TRID
address-last trigger blind spot, and the $0 pre-approval letter. **Still open from the
pre-flight:** the intake instant-decision dead-stop root fix (every fresh intake since
08-04 needs the staff compensation election before it can decide — honest gap copy shipped,
pricing decoupling pending), the WF2-F4 loan-type/amortization write path (organic files
cannot reach wholesale submission), and the adjudicated FCRA §615(a) adverse-action
chokepoint (fix in flight; simulated-pull denials will refuse). Full traces + ledger:
[feature-review/WORKFLOWS.md](../feature-review/WORKFLOWS.md).

**Workflow verification record (2026-07-12 walkthrough — last full pass; flip day re-runs
all of it via [PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md)):** applicant funnel
end-to-end · borrower post-submission dashboard · beta-LO cockpit claim/work ·
wholesale-lender push to `lender_submissions` with hashed MISMO 3.4 package · document
upload → extraction (presigned-only, magic-byte checks, cross-borrower 403) · credit
consent → denial → adverse action (never auto-denies; denial blocked without a compliant
notice). All six verified live then, shipped as PRs #135–#139.

## 3. Go-live checklist (founder actions) — THE current list

`[GATE]` = regulatory · `[DECISION]` = your call · `[ENV/OPS]` = configuration · `[FACT]` = information only you have.

- [ ] **0. `[OPS]` Railway migration — infrastructure DONE (2026-08-06); two checks left.** After the 2026-08-05 deploy
  freeze the decision was to **migrate off Vercel to Railway rather than buy Vercel Pro**,
  and that migration is complete: project **Homiquity**, environment **production**,
  service **Homiquity**, builder Railpack, region `us-east4`, one replica, deploying from
  GitHub on every merge to `main`. Build/start/health-check are **config as code** in
  [`railway.json`](../../railway.json) (`pnpm install --frozen-lockfile && pnpm build` →
  `pnpm start`, health check `/api/health`, restart policy `ON_FAILURE`) — change them
  there, in a PR, not in the dashboard. `www.homiquity.com` resolves via Squarespace
  `CNAME www → *.up.railway.app`. **The Vercel project has been deleted** — there is no
  fallback to fall back to, and no second env surface to keep in sync.

  Two things to *verify rather than assume* before the flip — these are what keeps item 0 open:
  - [ ] **`CRON_SECRET` exists in BOTH places with the SAME value** — the Railway service
    variable *and* the GitHub **repository secret** (Settings → Secrets and variables →
    Actions). The scheduler is now GitHub Actions
    ([`cron-jobs.yml`](../../.github/workflows/cron-jobs.yml)); with the repo secret
    missing every run fails loudly, and with a mismatched value every sweep 401s. Prove
    it end-to-end in one click: Actions → cron-jobs → **Run workflow** → `lifecycle`.
  - [ ] **Prod is actually serving `main`.** `curl -sS https://www.homiquity.com/api/health`
    and compare `commit` to `git rev-parse origin/main`. A failed Railway build leaves the
    old container serving, so a green dashboard and a 200 prove nothing.
- [ ] **1. `[ENV]` LS-2 ops env — Railway service variables** (Railway → project
  `Homiquity` → service `Homiquity` → **Variables**; this is the only env surface now).
  GCS (`GCS_SERVICE_ACCOUNT_KEY`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` —
  else uploads correctly 503) · `SENDGRID_API_KEY` + `FROM_EMAIL` + SPF/DKIM DNS ·
  `SENTRY_DSN` + an uptime monitor on `https://www.homiquity.com/api/health` ·
  `CRON_SECRET` (**both** the Railway variable and the GitHub repo secret — the six
  scheduled sweeps in [`cron-jobs.yml`](../../.github/workflows/cron-jobs.yml) fail
  without it, including **adverse-action delivery watch**) ·
  `APP_BASE_URL=https://www.homiquity.com`.

  The old "verify the **Environments column** per-var" step (the 2026-07-16 outage lesson:
  a var scoped to the wrong environment) has a Railway equivalent — a variable is set on a
  **service within an environment**, so confirm you are in the **production** environment
  and on the **Homiquity** service before pasting, and check any shared/reference variables
  the same way. **`VITE_*` variables are build-time**: they are baked into the client
  bundle, so setting or changing one needs a **redeploy**, not a restart. Everything else
  is read at runtime.
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
  (all nine consoles are still ⬜ — and the console list now includes **Railway** and
  excludes Vercel) · **revoke `GEMINI_API_KEY` at Google AI Studio** — the Vercel variable
  that held it went away with the project, but *deleting a variable is not revoking a key*;
  the key itself is still live until you revoke it at the issuer, and it must not be
  re-pasted into Railway · **pin prod Neon compute / disable scale-to-zero** (5.5–7.4 s
  cold starts were measured on 2026-08-05; Railway's persistent process removes the
  function-cold-boot half, but Neon scale-to-zero is still there and a lender demo or the
  first borrower of the morning eats it) · confirm Railway's `DATABASE_URL` points at the
  **production** Neon branch, pooled string (2026-08-06: it was aimed at a stale branch and
  `/api/health` happily returned 200 anyway).

  ~~The two Neon Console clicks in [NEON_PREVIEW_DB.md](NEON_PREVIEW_DB.md) §3~~ —
  **closed 2026-08-06, by removal not by action.** Those clicks disarmed the Neon↔Vercel
  preview integration; the Vercel project is deleted, nothing creates preview branches, and
  no preview clones prod PII. The doctrine is preserved in that runbook and applies again
  *if* Railway PR environments are ever turned on — read it first, not after.
  ~~Drop the legacy `.vercel.app` domain alias~~ — moot; it died with the
  Vercel project.
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
- [ ] **7. `[GATE]` The flip, in order** (only after 0–3 are green), all in Railway →
  service `Homiquity` → **Variables**: set `BETA_ACCESS_CODE` → set
  `PRELAUNCH_GATED=false` **and** `VITE_PRELAUNCH_GATED=false` → **redeploy** (the `VITE_`
  flag is compiled into the client bundle at build time; a runtime-only change or a
  restart does nothing) → **confirm the redeploy actually shipped**: `curl -sS
  https://www.homiquity.com/api/health` and check `commit` == `git rev-parse origin/main`
  — a Railway status of SUCCESS is not proof, and if the build failed you are still
  looking at the gated bundle → run
  [PROD_ACCEPTANCE_TEST.md](PROD_ACCEPTANCE_TEST.md) top to bottom, every ⛔ green →
  sign-off table + [CICD ledger](CICD.md) row → invite beta users → when ready for
  public: delete `BETA_ACCESS_CODE` (the Express beta-gate middleware becomes a total
  no-op — site public, no rebuild, since the code list is read per request).

  Have the rollback path open in another tab before you touch anything: Railway → service
  `Homiquity` → **Deployments** → last known-good → **⋯ → Rollback** (restores that image
  *and* its variables, no rebuild). Note the **72h image-retention window on Hobby**, and
  that `railway redeploy` is *not* a rollback — it rebuilds the latest commit
  ([ROLLBACK.md](ROLLBACK.md)).

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
