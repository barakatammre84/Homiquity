# Vendor & Procurement — 2026-08-17 (Mon)

**STATUS: FAIL** — SendGrid is configured and sending, but the domain has **no SPF, no DMARC and
no apex DKIM record at all** (confirmed at the authoritative Squarespace nameserver). Every
password reset, email verification and waitlist invite leaves unauthenticated and lands in spam,
while `/api/health` reports `email.configured: true`. A live vendor dependency is broken and the
health signal says it is fine.

This is the **first** vendor-procurement run — the routine was registered in #493 (2026-08-12) and
`reports/` contains no prior vendor report, so everything below is a baseline, not a delta.
Per CHARTER §6 this routine writes no code and sent nothing to anyone; it took no `REGISTER.md`
claim because its territory is this file.

---

## ⛔ Human actions — this week, hardest first

| # | Action | Unblocks | Why now |
|---|---|---|---|
| 1 | **Railway → project `Homiquity` → Settings → Billing: add a payment method / leave trial.** | everything | **I could not probe this.** No billing endpoint on the Railway MCP and no `railway` CLI on this machine. The only observation on record is KTLO-1's "~30 days / ~$4.97 of credit left", made ~**2026-08-06 — 11 days ago**. When the credit runs out **production stops serving.** Nobody has re-checked it in 11 days and no routine can. |
| 2 | **Set the four email-auth DNS records at Squarespace**: SPF TXT on the apex, DMARC TXT at `_dmarc`, and SendGrid's `s1`/`s2` DKIM CNAMEs **on the apex** (the existing `s1._domainkey.www` is scoped to the wrong host and SendGrid never queries it). | account recovery, verification, waitlist | See Evidence E1. Mail is being *sent* today with zero authentication. MX (Google Workspace) is intact, so inbound is fine — this is outbound only. |
| 3 | **Set `GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR`** in Railway → service `Homiquity` → Variables (production). | §2.2 uploads | Confirmed absent from the live variable list (E2). `request-url` 503s `UPLOADS_UNCONFIGURED`; the roadmap calls silent upload loss "the single worst borrower-facing failure available to us". |
| 4 | **Set `SENTRY_DSN` + point a free uptime monitor at `/api/health`.** | prod observability | Confirmed absent (E2). A production crash is invisible today; the only outside signal is CI's `verify-deploy`, which runs on push and not otherwise. |
| 5 | **Start the F3 credit-vendor application (CRS One / iSoftpull)** and in the same email request **SOC 2 Type II, a signed DPA, and their permissible-purpose / FCRA end-user certification package.** | F3, medical-collections DTI work | Roadmap §1.4 has said "start now" since 2026-08-06. Nothing in the repo, the variable list or 11 days of commits shows an application opened. Vendor paperwork lead time runs *in parallel* with engineering — this is the loudest kind of finding this routine has. |
| 6 | **Start the F6 GSE AUS applications — Fannie DU *and* Freddie LPA, both legs.** | F6, dual-AUS strategy | Same §1.4 age. Note the code already has a **second** env var for the Freddie leg (`FREDDIE_LPA_API_KEY`) that `.env.example` never documents (E4) — fix that before credentials arrive or they will be pasted into the wrong name. |
| 7 | **Set `GOOGLE_MAPS_API_KEY`.** | address capture | Confirmed absent (E2). `server/routes/geocode.ts:34` 503s without it, so **every** address lookup in production fails right now. #516 (merged 2026-08-12) made that failure honest to the borrower instead of invisible — it did not make it work. |
| 8 | **Regulatory subscriptions, ~15 min, free** (roadmap §1.8): Fannie Selling Guide notifications (**email is the only Fannie channel** — their page is bot-protected), Freddie Guide bulletins, FHA INFO, VA lender news. Then register for the **Fannie Developer Portal** (public APIs free; business-partner APIs unlock with F6). | F6, Tier 3 monitoring | Compounded by E5: the automated Tier 2 watcher has not run since **2026-07-04**. Right now there is *no* live channel — automated or human — telling us a guideline moved. |
| 9 | **Set `RAPIDAPI_KEY`** (or decide to stay on the simulated survey and say so). | live rate display | Confirmed absent (E2). It died with the deleted Vercel project on 2026-08-06 and was never re-created in Railway. |
| 10 | **Delete the stray lowercase `fromemail` Railway variable.** | hygiene | It appears in the live production variable list beside the real `FROM_EMAIL` and nothing reads it (E2). |

**Not asks, but decisions only you can make:** F5 (Truv), F7 (AVM), F11 (PPE — Lender Price and/or
Mortech), F13 (Down Payment Resource), F15 (Freddie corpus). None has a contract, and F11 has no
comparison on file — see Proposed tickets.

---

## Summary

Prod is healthy and current (`95770d4`, deployed 16:27Z today, verified by the `/api/health`
`commit` field, not by a green check). Every simulated vendor seam is correctly flagged and the
credit-vendor interlock is in exactly the configuration the code documents — `CREDIT_VENDOR_MODE=simulation`
set, `CREDIT_VENDOR_API_KEY` unset — so no simulation is being treated as real. The failure is on
the live side: SendGrid sends unauthenticated mail because three DNS records are missing, and
that is invisible to `/api/health`. Railway billing — the item that outranks everything in this
report — **cannot be probed from this session at all**, and the last human observation of it is
11 days old. Four launch-critical variables (GCS pair, Sentry, Maps, RapidAPI) remain unset with
no decision recorded either way, and the two vendor applications the roadmap told the founder to
open "now" on 2026-08-06 show no sign of having been opened.

---

## Evidence

### E1 — SendGrid: configured, and signing nothing

```
$ curl -s https://homiquity-production.up.railway.app/api/health
{"status":"ok","timestamp":"2026-08-17T16:30:34.838Z",
 "commit":"95770d4e56a7b113b756efffefb7e8bedb8650ea",
 "email":{"configured":true,"providers":["sendgrid"]}}

$ dig +short NS homiquity.com @8.8.8.8   →  nsd2.squarespacedns.com.

$ dig +short TXT  homiquity.com          @nsd2.squarespacedns.com   →  (empty)   # no SPF
$ dig +short TXT  _dmarc.homiquity.com   @nsd2.squarespacedns.com   →  (empty)   # no DMARC
$ dig +short CNAME s1._domainkey.homiquity.com @nsd2.squarespacedns.com → (empty)
$ dig +short CNAME s2._domainkey.homiquity.com @nsd2.squarespacedns.com → (empty)
$ dig +short CNAME em.homiquity.com      @nsd2.squarespacedns.com   →  (empty)
$ dig +short CNAME url.homiquity.com     @nsd2.squarespacedns.com   →  (empty)

$ dig +short CNAME s1._domainkey.www.homiquity.com @8.8.8.8
s1.domainkey.u112130352.wl103.sendgrid.net.        # <-- scoped to www, the wrong host

$ dig +short MX homiquity.com @8.8.8.8
1 aspmx.l.google.com. / 5 alt1 / 5 alt2 / 10 alt3 / 10 alt4      # inbound intact
```

Cross-checked on `8.8.8.8`, `1.1.1.1` and the authoritative Squarespace nameserver — all three
agree. SendGrid signs `d=homiquity.com`, so a `www`-scoped selector is never queried. The single
`s1._domainkey.www` record is the signature of the Entri-style failure mode already on file in the
DNS notes: the www-scoped record was written *in place of* the apex one.

`emailService.ts:5` also reads a legacy `SENDGRID_API_KEY1` fallback that `.env.example` does not
document. Not a defect — worth one line in `.env.example`.

### E2 — Railway production variables, read live (names only; this OAuth app never sees values)

Project `Homiquity` `605689d2…` · service `Homiquity` `577a33c7…` · environment `production`:

```
ANTHROPIC_API_KEY  APP_BASE_URL  CREDIT_ENCRYPTION_KEY  CREDIT_VENDOR_MODE  CRON_SECRET
DATABASE_URL  FROM_EMAIL  FROM_NAME  GOOGLE_CLIENT_ID  GOOGLE_CLIENT_SECRET  NODE_ENV
PII_HASH_SALT  PRELAUNCH_GATED  PUBLIC_BASE_URL  SENDGRID_API_KEY  SESSION_SECRET
TWILIO_AUTH_TOKEN  VITE_PRELAUNCH_GATED  fromemail            (+ 11 RAILWAY_* injected)
```

**Launch-critical and confirmed UNSET** — this is a read of live state, not an inference:
`GCS_SERVICE_ACCOUNT_KEY` · `PRIVATE_OBJECT_DIR` · `PUBLIC_OBJECT_SEARCH_PATHS` · `SENTRY_DSN` ·
`GOOGLE_MAPS_API_KEY` · `RAPIDAPI_KEY` · `PLAID_CLIENT_ID`/`PLAID_SECRET`/`PLAID_WEBHOOK_SECRET` ·
`CRS_API_KEY`/`ISOFTPULL_API_KEY` · `FANNIE_DU_API_KEY` · `FREDDIE_LPA_API_KEY` ·
`HOUSECANARY_API_KEY` · `BETA_ACCESS_CODE` · `CSP_ENFORCE` · `LINKEDIN_*`/`APPLE_*` · `GEMINI_API_KEY`.

Three of those absences are the **correct** posture and should stay that way until their trigger
fires: `CRS_API_KEY`/`ISOFTPULL_API_KEY`, `FANNIE_DU_API_KEY`/`FREDDIE_LPA_API_KEY`,
`HOUSECANARY_API_KEY` — each adapter throws on purpose if the key appears before the real
implementation. `PLAID_WEBHOOK_SECRET` unset is also correct: that endpoint fail-closes to 503.

Two roadmap corrections fall out of this read:

- **§1.9 ("delete the dead `GEMINI_API_KEY`") appears already done in production** — the name is
  absent from the live list. Worth a 30-second confirm against any local `.env` before closing.
- **§1.2's "~48 of the 65 names in `.env.example` are unset"** is now measurable rather than
  estimated: 19 non-injected names are set.

### E3 — Simulated-vendor seam inventory vs reality (baseline; every seam verified flagged)

| Seam | Adapter | Guard, read today | Real-adapter landing point | Unblocked by |
|---|---|---|---|---|
| Credit (tri-bureau) | `server/mcp/vendors.ts:69` | throws if `CRS_API_KEY`/`ISOFTPULL_API_KEY` set (`:73`); refuses to fabricate in prod unless `CREDIT_VENDOR_MODE=simulation` (`:90`) | same file | **F3** |
| Credit provenance stamp | `server/services/creditPulls.ts:179` | refuses outright if `CREDIT_VENDOR_API_KEY` **and** `CREDIT_VENDOR_MODE=simulation` are both set; `:382` refuses to record a pull as REAL while the override stands | — | **F3** |
| AVM / valuation | `server/mcp/vendors.ts:170` | throws if `HOUSECANARY_API_KEY` set (`:172`); returns `simulated: true` (`:184`) | same file | **F7** |
| DU (Fannie) | `server/services/ausSubmission.ts:156` | throws if `FANNIE_DU_API_KEY` set; `simulated: true` (`:189`) | same file | **F6** |
| LPA (Freddie) | `server/services/ausSubmission.ts:226` | throws if `FREDDIE_LPA_API_KEY` set | same file | **F6** |
| Assets / income (Plaid) | `server/plaid.ts:20,33` | `isPlaidConfigured()` false without both keys; throws on use | `server/plaid.ts` | **F4** |
| VOIE (Truv) | **no code seam exists** | — | — | **F5** |
| Rate sheets / live rates | `server/services/rateService.ts:64` | logs and falls back to the simulated survey when `RAPIDAPI_KEY` is unset (`:66`) | same file | RapidAPI key / **F11** |
| Wholesale submission | `server/services/lenderSubmission.ts:59` | `simulated: true` (`:67`); activity copy says "(simulated — no broker agreement live)" (`:291`) | `:81` marks where real client ids go | **LS-10 slice 3** |
| SMS (inbound webhooks) | `server/services/twilioSignature.ts` | real HMAC verification; 503s when `TWILIO_AUTH_TOKEN` unset (`:193`) | — | — |
| SMS (outbound) | **no sender exists** | — | — | 10DLC + provider |

**No simulated seam is being treated as real.** The credit interlock in particular is in the
exact state its own comments prescribe: `CREDIT_VENDOR_MODE=simulation` set, `CREDIT_VENDOR_API_KEY`
unset, so every `credit_pulls` row and cost-ledger entry is still stamped `isSimulated: true`.

Two rows the register does not currently carry correctly (see Proposed tickets):

- **Truv (F5) has no code seam at all.** The only occurrence of the string in `server/` or
  `shared/` is a comment on `shared/schema/compliance.ts:698` (`// plaid, truv, argyle`).
  `ASSUMPTIONS.md` §1 groups "Plaid, Truv" on one row pointing at `server/plaid.ts`, which
  overstates it — there is nothing to convert when a Truv contract lands, only something to build.
- **`TWILIO_AUTH_TOKEN` is now set in production** and `twilioSignature.ts` is a real
  implementation. `ASSUMPTIONS.md` §1's SMS row still says "webhook signature check stubbed".

### E4 — Env names referenced in code but absent from `.env.example`

```
FREDDIE_LPA_API_KEY   INTAKE_PAUSED   RATE_LIMIT_RELAXED   SEED_LO_ID
SENDGRID_API_KEY1     SENTRY_RELEASE  TRUST_PROXY_HOPS     UWM_EASE_CLIENT_ID
```

`FREDDIE_LPA_API_KEY` is the procurement-relevant one: it is the second half of F6 and the file a
founder would consult when credentials arrive does not mention it. `INTAKE_PAUSED` is the §8
escalation switch and is likewise undocumented there.

### E5 — Regulatory monitoring: the automated tier is dark

```
$ cat data/regulatory/regulatory-watch-state.json   →  "lastRun": "2026-07-04T07:12:30.608Z"
$ git log -1 -- data/regulatory/regulatory-watch-state.json
  e5d9301 2026-07-08  docs(kb): consolidate all documentation into knowledge-base/…

$ grep -n "reg:watch" package.json scripts/checkup.sh .github/workflows/*.yml
  package.json:22  "reg:watch": "node scripts/regulatory-watch.cjs"
  package.json:23  "reg:watch:save": "node scripts/regulatory-watch.cjs --update-state"
  (no other hit — not in checkup, not in ci.yml, not in cron-jobs.yml, not in CHARTER §3)
```

`REGULATORY_MONITORING.md` describes Tier 2 as "automated, live" and says "the daily guardian runs
the watcher". It is registered in no scheduler. Last state write **44 days ago**. This is CHARTER
§0's exact failure shape — a definition on disk that is not registered is not a control — and it
lands on this routine because Tier 3 (the four free subscriptions) is the human fallback the
doc names, and it is also not done. Federal Register, Freddie bulletins, FHA ML and VA circulars
currently have **no** watcher, automated or human.

Tier 1 is fine: `pnpm checkup` reports `PASS regulatory ledger fresh`.

### E6 — Live-vendor risk review

| Vendor | Probed? | State | Single point of failure / what breaks this week |
|---|---|---|---|
| **Railway** (deploy + runtime) | partly | Service `Homiquity`, **1 replica, `us-east4-eqdc4a`**, RAILPACK builder, deploying from `main` with **`checkSuites: false`** — Railway does **not** wait for GitHub checks, so branch protection is the only gate between a merge and prod. Latest deploy `SUCCESS` 2026-08-17T16:27Z = `95770d4` = `origin/main`. | **Billing is the whole company's SPOF and I could not read it** — no billing endpoint on the MCP, no `railway` CLI installed. Credit exhaustion stops production serving. Single replica, single region: no failover. |
| **Railway image retention (rollback)** | yes | Only **two** deployments exist for this service: today's `95770d4`, and `1f520b1` built **2026-08-12T22:53Z** — everything older is `REMOVED`. | Between 08-12 22:55Z and 08-17 16:27Z prod ran ~**114 h on a single deployment with no in-window rollback target at all**. Today's deploy restores one candidate, but the only prior image is itself ~114 h old, past the **72 h Hobby retention** — so a one-step rollback **cannot be confirmed available**. `ROLLBACK.md` §1's path is `git revert` + rebuild. Coupled to the billing item: leaving trial is what buys retention back. |
| **Neon** (prod Postgres) | yes | DB-backed routes 200 and fast: `/sitemap.xml` 0.52 s (2,726 B), `/api/articles` 0.63 s, `/api/rates` 0.55 s, `/api/health` 0.49–0.88 s. Also proves `DATABASE_URL` is on a populated branch — `/api/health`'s `SELECT 1` alone would not. | **KTLO-3 (unpinned compute, 5.5–7.4 s cold start) is unverified, not resolved.** I could not observe a cold start because the compute was warm — the GitHub cron sweeps hit the app every ~20–40 min and incidentally keep it awake. That masking is worth knowing: the first real borrower after a genuine idle window still pays the cold start. |
| **GitHub Actions** | yes | Healthy today. `cron-jobs` runs 32031034105 … 32038494454 all `success` in 6–9 s. Run 32038494454 (`adverse-action-delivery`) returned `{"ok":true,"trigger":"cron","scanned":0,…}` against `SWEEP_HOST=https://homiquity-production.up.railway.app`. | Two facts confirmed as *working*, both previously broken: **`CRON_SECRET` matches** between the repo secret and the Railway variable (a mismatch 401s every sweep silently), and the sweeps use the `*.up.railway.app` host, not `www` — the 2026-08-06 `curl exit 6` class is closed. KTLO-2's queueing is not reproducing today. If the gate cannot run, nothing merges and `migrate-prod` never applies a migration. |
| **SendGrid** | yes | `configured: true`, provider `sendgrid`, `FROM_EMAIL`/`FROM_NAME` set. | **BROKEN IN PRACTICE — see E1.** Sends unauthenticated; password reset and email verification ride this path. `/api/health` cannot see it, which is why this is the report's FAIL. |
| **Sentry** | yes | `SENTRY_DSN` absent from the live variable list. | No error reporting and no uptime monitor. A prod crash between CI `verify-deploy` runs is invisible. |
| **Object storage / GCS** | yes | `GCS_SERVICE_ACCOUNT_KEY`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` all absent. | Uploads 503 `UPLOADS_UNCONFIGURED` — fail-closed, which is the right failure, but it means document collection does not work at all in production. Also note Dependabot PR **#524** proposes `@google-cloud/storage` **7.21.0 → 8.0.0**, a major bump on the dependency this capability rests on; land it deliberately, not on autopilot. |
| **RapidAPI** | yes | `RAPIDAPI_KEY` absent. | Live rates fall back to the simulated survey — silently, by design (`rateService.ts:66` logs and returns). |
| **Anthropic** | partial | `ANTHROPIC_API_KEY` set. Powers the AI Coach and document extraction. | Not probed for quota/limits (no read-only endpoint used here). Degradation drops the coach to labelled offline-guidance mode; no other feature is affected. |
| **Google OAuth** | no | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` both set, so the button renders. | Not probed — `/api/auth/providers` is presence-only and proves nothing about the secret. Verifying it needs the bogus-code probe, which is out of this routine's scope. |
| **Twilio** | partial | `TWILIO_AUTH_TOKEN` set (inbound webhook signature verification armed). **No** `TWILIO_ACCOUNT_SID`, API key, or phone number — and no outbound sender exists in the code. | Correct posture, not a gap: STOP/HELP and delivery receipts authenticate; nothing can send. US A2P needs 10DLC brand + campaign registration, which Twilio does not permit on trial accounts — that is a procurement lead-time item whenever SMS is scheduled. |

### E7 — Housekeeping observed while probing

- **The primary checkout moved under this run.** `origin/main` advanced from `1f520b1` to `95770d4`
  (#519) mid-session, and `HEAD` there is `488886f` — a peer session (`homiquity-e3`, seen via
  `ListAgents`) merging main into `feat/rent-payments-writer`. This report was written from an
  isolated worktree; nothing in the primary checkout was touched.
- `pnpm checkup` FAILs on **`dependency vulnerabilities` — 5 found (1 low, 4 moderate)**, including
  `@hono/node-server < 1.19.15` reached via `@modelcontextprotocol/sdk`. That is the full audit;
  CI's blocking gate is `--prod`, so this is not currently redding PRs. Dependabot #522/#523/#524
  are open against it. Not this routine's territory — flagged for Evening Triage.
- 14 PRs are open, 11 of them from 2026-08-12. Not a procurement item, but the queue is not moving.

---

## Proposed tickets — for Evening Triage to land

1. **VP-1 · §0/KTLO-1: no routine can see Railway billing.** The one item that stops production is
   unprobeable from any session — no MCP billing endpoint, no CLI. Either install + authenticate
   the `railway` CLI on this machine so a routine can read it, or set a calendar reminder the
   founder owns. Today the control is "somebody remembers".
2. **VP-2 · Correct `ASSUMPTIONS.md` §2 and §1.** Three rows now contradict live state: "The app
   sends email — **False in prod** … no `SENDGRID_API_KEY`" (it is set; the real problem is DNS,
   which that row does not mention); the SMS row's "webhook signature check stubbed" (it is real
   and armed); and the Plaid/Truv row, which implies a Truv seam that does not exist. The register's
   own maintenance rule says the code wins — apply it.
3. **VP-3 · Add an LPA row + document `FREDDIE_LPA_API_KEY` and `INTAKE_PAUSED` in `.env.example`.**
   F6 is a two-leg procurement and only one leg is documented where a founder would look.
4. **VP-4 · Register `reg:watch:save` on a schedule, or delete it and say Tier 2 is human-only.**
   44 days dark while a governance doc calls it "automated, live" is the fossil pattern CHARTER §0
   exists to prevent. Cheapest honest fix: a weekly step, and a `lastRun` age assertion in `checkup`.
5. **VP-5 · Close roadmap §1.9 (`GEMINI_API_KEY`) after confirming local `.env`.** Absent from
   production already.
6. **VP-6 · Get a PPE comparison on file for F11.** Lender Price and Mortech are named as the
   candidates and Optimal Blue / LoanSifter are recorded as evaluated-and-passed, but there is no
   comparison document for the two live candidates — so the "trigger: signed contract" has no
   decision behind it. One page: MISMO feed shape, LO-facing UI, per-lock cost, broker-channel
   eligibility. Pairs with the UWM BOLT question already in §1.3.

---

STATUS: FAIL
