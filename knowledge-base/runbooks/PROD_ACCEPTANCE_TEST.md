# Production Acceptance Test — launch gate checklist

**Purpose.** The last gate before Homiquity goes commercial (roadmap **F1** — company NMLS license issued). Run this end-to-end against the **live production deploy** after every launch-critical change and immediately before flipping the pre-license gate open. It is a *release* acceptance test, not a code test — the unit/integration suites already ran in CI ([CICD.md](./CICD.md)). This proves the deployed system behaves in prod: config, gates, the money path, security, and the compliance rails.

**How to use.** Copy the checklist into the launch ticket, run top to bottom, check each box, and paste the result into the [production change ledger](./CICD.md#production-change-ledger-append-only). **Every ⛔ BLOCKER must pass to launch.** A failed BLOCKER stops the launch and gets a ledger row + rollback ([ROLLBACK.md](./ROLLBACK.md)). ☑ SHOULD items are logged but don't individually block.

**Environment.** Run against `https://www.homiquity.com` — the canonical host, served by **Railway** (Squarespace DNS `CNAME www → *.up.railway.app`). The apex `homiquity.com` is **not** on Railway: Railway needs CNAME flattening/ALIAS at the apex and Squarespace doesn't offer it, so the bare domain currently serves a Squarespace parked page. Every URL in this checklist must be typed with the `www.` — do not "simplify" it. Use the current production commit — confirm it matches `origin/main` HEAD before starting (see §0, and read it the *right* way).

---

## 0. Preconditions (do these first)

- [ ] ⛔ **Confirm the deploy is live and current — by commit, not by status.**
  ```bash
  curl -sS https://www.homiquity.com/api/health   # -> {"status","timestamp","commit"}
  git rev-parse origin/main
  ```
  The `commit` field (`RAILWAY_GIT_COMMIT_SHA`) **must equal** `origin/main` HEAD. **A Railway status of SUCCESS, and a 200 from `/api/health`, are NOT evidence your merge shipped** — a *failed* Railway deploy leaves the previous container serving, so the site stays up and every check stays green while prod goes stale. That is the 2026-08-06 incident: nine consecutive failed builds, prod ~8 commits behind, nothing said so. CI's `verify-deploy` job polls this same field after every push to `main`; if it is red, prod is stale. If `commit` is older or `null`, **stop and fix the deploy** ([ROLLBACK.md](./ROLLBACK.md) §0) — do not run the rest of this checklist against yesterday's code.
- [ ] ⛔ **Confirm the app is talking to the *right* database.** A 200 from `/api/health` only proves *a* database answered its `SELECT 1`. On 2026-08-06 Railway's `DATABASE_URL` pointed at a stale Neon branch (28 of 53 migrations, no writes since 07-15): health stayed 200 while `/api/articles` and `/sitemap.xml` **500'd**. So hit one data-backed route as well:
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' https://www.homiquity.com/api/articles
  curl -sS -o /dev/null -w '%{http_code}\n' https://www.homiquity.com/sitemap.xml
  ```
  Both 200. If not, compare Railway → project `Homiquity` → service `Homiquity` → **Variables** → `DATABASE_URL` against the production branch's connection string in the Neon Console.
- [ ] **Confirm prod DB migration HEAD.** Run the CI workflow with `dry_run: true` (Actions → CI → Run workflow) and confirm "up to date — no pending migrations" ([DB_MIGRATIONS.md](./DB_MIGRATIONS.md) §Pre-flight — prod isn't queryable from a laptop). As of 2026-08-05 the journal holds **47 entries (0000–0046)** — read the current count from `migrations/meta/_journal.json`, don't trust this sentence. Never `db:push` against prod ([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §5).
- [ ] **A rollback target is identified.** Open Railway → project `Homiquity` → service `Homiquity` → **Deployments** and confirm the previous known-good deployment still offers **⋯ → Rollback** ([ROLLBACK.md](./ROLLBACK.md) §1 — it restores that image *and* its variables, no rebuild). ⚠️ **Image retention is limited (72h on Hobby)**: if the last good deploy is older than the window, the Rollback option is gone and there is no one-step path — know that before you flip, not after. `railway redeploy` is **not** a rollback (it rebuilds the latest commit); `railway restart` only reuses the current image.

---

## 1. Environment & secrets — ⛔ BLOCKER

All production configuration lives in **Railway service variables**: Railway → project `Homiquity` → service `Homiquity` → **Variables**. There is no other env surface — the Vercel project was deleted at the 2026-08-06 migration.

⚠️ **Two kinds of variable, two different ways to apply a change.** Plain server vars (`PRELAUNCH_GATED`, `BETA_ACCESS_CODE`, `INTAKE_PAUSED`, secrets…) are read from `process.env` at runtime, so the service picking them up is enough. **`VITE_*` vars are BUILD-time** — Vite compiles them into the client bundle, so changing one requires a **redeploy (rebuild)**, never just a restart. Getting this backwards is how a flip appears to do nothing — see §3 below and [BETA_GO_LIVE_READINESS.md](./BETA_GO_LIVE_READINESS.md) §3 item 7.

The server **fails closed** on missing security secrets (`assertEncryptionConfig` + `initEncryption` run before routes in `server/routes.ts`), so a bad config shows up as a boot failure, not silent wrong behavior. On Railway that means the **deploy fails its `/api/health` check** — and a failed deploy leaves the previous container serving, so the symptom is *prod stays on the old commit*, not an outage. Verify the intended config regardless.

- [ ] ⛔ **Required secrets set as Railway service variables:** `DATABASE_URL` (the Neon **pooled** string), `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`, `SESSION_SECRET`. (App refuses to boot without these.)
- [ ] ⛔ **`NODE_ENV=production`** (gates all the dev-only fallbacks — test login, local upload store, etc.).
- [ ] ⛔ **`CREDIT_VENDOR_MODE` is UNSET** in prod. Set to `simulation` it would fabricate credit scores — production must refuse. (`.env.example` → "Credit vendor mode".)
- [ ] ☑ **`CRON_SECRET`** set — and set **in both places, to the same value**: the Railway service variable *and* the GitHub **repository secret** (Settings → Secrets and variables → Actions). Scheduled sweeps are GitHub Actions (`.github/workflows/cron-jobs.yml`) that curl `/api/jobs/*` with `Authorization: Bearer $CRON_SECRET`; a mismatch fails every sweep loudly, an unset repo secret fails the run before it curls anything. (Deliberate: a scheduler that silently no-ops would hide a dead sweep.)
- [ ] ☑ **`APP_BASE_URL`** points at the canonical customer domain — `https://www.homiquity.com`, live since the 2026-07-13 cutover (the server default in `server/config/company.ts` matches; the env var wins if set). Customer-facing SMS/email links use it.
- [ ] ☑ **`PLAID_WEBHOOK_SECRET`** set **if** the Plaid assets webhook is in use (endpoint returns 503 fail-closed until set). If Plaid is not live, N/A.
- [ ] ☑ **`SENTRY_DSN`** set (error reporting) and **`SENDGRID_API_KEY`** / SMTP set **if** email notifications are expected at launch; otherwise record them as deliberately off.
- [ ] ☑ **`CSP_ENFORCE`** — decide: `true` to block (after a clean Report-Only soak) or leave Report-Only for launch. Record the choice.

---

## 2. Deploy health — ⛔ BLOCKER

- [ ] ⛔ **`GET /api/health` → 200** `{"status":"ok","timestamp":…,"commit":…}`. (Proves the app booted *and* a DB answered — it runs `SELECT 1`.) A 503 here = DB unreachable or boot failure; **stop**. Read the `commit` and the data-route spot-check from §0 — this endpoint is necessary but *not sufficient*.
- [ ] ☑ Point an uptime monitor (e.g. UptimeRobot) at `https://www.homiquity.com/api/health`. Alert on non-200 **and** — if the monitor supports keyword/JSON assertions — on the `commit` field going stale; the 2026-08-06 failure mode is invisible to a plain 200 check.
- [ ] ☑ **No boot errors** in the **Railway deploy/runtime logs** (Railway → project `Homiquity` → service `Homiquity` → the current deployment → **Logs**; or `railway logs`) — specifically no encryption/KMS config failures. Check the **Build** log too: a build that failed is why prod would still be serving the old commit.

---

## 3. Gate behavior — ⛔ BLOCKER (compliance-critical)

Two independent gates. Get both right — the pre-license gate is a **regulatory** control (Homiquity may not solicit a mortgage transaction pre-license).

**Pre-license gate** (`PRELAUNCH_GATED` server env + `VITE_PRELAUNCH_GATED` *build* env, tied to the NMLS id in `shared/companyIdentity.ts`; fail-safe: gated in prod while the NMLS id is PENDING). See [ARMED_LAUNCH_CHARTER](../governance/ARMED_LAUNCH_CHARTER_2026-07-07.md).

- [ ] ⛔ **While still pre-license (gated):** `/` renders the **Waitlist**, not the marketing Landing. Persona landing pages, the application funnel, rates/pricing, and the "Buy" nav dropdown are **not reachable** (client redirects gated routes to `/`; e.g. `/approval-strength` → `/`). No rate, price, or "apply" surface is exposed.
- [ ] ⛔ **The two gate flags flip together, only on F1 day:** server `PRELAUNCH_GATED=false` **and** build `VITE_PRELAUNCH_GATED=false` **and** the real company NMLS id is set in `shared/companyIdentity.ts`. Verify a fresh production **build** picked up `VITE_PRELAUNCH_GATED` — it is compiled into the client bundle by Vite, so **a Railway redeploy (rebuild) is required; restarting the service does nothing.** Then re-check `/api/health`'s `commit` to confirm that rebuild actually shipped before you judge the gate.
- [ ] ☑ **After opening:** `/` renders Landing; the funnel and persona LPs are reachable.

**Private beta gate** (`BETA_ACCESS_CODE`, `server/middleware/betaGate.ts` — in-process Express middleware since the Railway migration replaced the platform edge middleware; `tests/betaGate.test.ts` pins the semantics). Independent of the pre-license gate.

- [ ] ☑ If a private beta is intended: with `BETA_ACCESS_CODE` set, the site (except `/api/*`) returns the **401 lock screen**; `https://www.homiquity.com/?beta=<code>` sets an HttpOnly cookie holding SHA-256(code) and 302s to the same URL without the param. A bad code re-renders the lock screen with an error. Multiple comma-separated codes can be revoked individually — removing one from the variable invalidates that code's cookies.
- [ ] ☑ While armed, `GET /robots.txt` answers `Disallow: /` (the gated site must never be indexed) and `/api/*` is **never** gated (cron sweeps and API clients carry no browser cookie; every API route sits behind app auth already).
- [ ] ☑ Arming/disarming is a **runtime** variable change on a persistent host — the code list is read per request, so no rebuild is needed (unlike the `VITE_*` flag above). Note this middleware is no longer platform-only: setting `BETA_ACCESS_CODE` locally now gates local dev too.
- [ ] ☑ If a fully public launch: `BETA_ACCESS_CODE` is **unset** (unset/blank ⇒ total no-op).

**Bot prerender** (`server/prerender.ts` — in-process Express middleware since the Railway migration; it replaced a platform rewrite/env-var arrangement). It only fires for GET, non-`/api/`, dot-free paths from a bot user-agent; humans keep the static SPA path.

- [ ] ☑ **The prerender agrees with the gate posture.** While gated, a bot UA must get waitlist-safe copy + `noindex` — it must not advertise `/rates*` or funnel metadata that humans are redirected away from (the #388 fix). Spot-check with a bot UA:
  ```bash
  curl -sS -A "Googlebot/2.1" -D- -o /dev/null https://www.homiquity.com/rates
  ```
- [ ] ☑ **Static assets still fall through.** `/assets/*.js`, `/favicon.png` and `/robots.txt` must be served by `express.static`, not swallowed as injected HTML — the dot-in-path guard is what prevents that, and it is the documented ordering trap.

---

## 4. Auth & sessions — ⛔ BLOCKER

- [ ] ⛔ **Real login works** (borrower + a staff role). Session persists across navigation; **logout** clears it.
- [ ] ⛔ **`/api/test-login` is disabled** in production (dev-only accounts; `DEV_TEST_PASSWORD` path must be off when `NODE_ENV=production`).
- [ ] ⛔ **Role gates hold.** A borrower cannot reach staff/admin surfaces; a non-admin staff user only sees applications they're a deal-team member on (spot-check one cross-account URL → expect **403**, not data).
- [ ] ☑ Account-lockout / auth-token flows behave (migrations `0001`/`0002`).

---

## 5. Core loop end-to-end — ⛔ BLOCKER (the money path)

The MVP is: **borrower intake → instant pre-approval decision → MISMO loan package → wholesale-lender submission** ([L1_VISION_AND_SCOPE](../L1_VISION_AND_SCOPE.md)). Walk it once as a real user against prod.

- [ ] ⛔ **Create a loan application** (borrower intake) and attach a property. Record persists and reloads.
- [ ] ⛔ **Credit consent → pull → decision.** Consent is captured; the (simulated) credit pull runs; the deterministic decisioning cascade produces a pre-approval outcome on submit. Same inputs → same outcome.
- [ ] ⛔ **MISMO package generates and is schema-valid.** The lender package builds without the P0 export bugs (F-018 container nesting, F-019 `LoanPurposeType` enum — both fixed). If feasible, validate the emitted XML against `docs/fannie-mae/schemas/uldd-phase5-extension/MISMO_3_0.xsd`. A **cash-out refi** maps to `Refinance`; a **construction** purpose **fails loud** (by design, U-7 — do not deliver invalid XML).
- [ ] ⛔ **Wholesale-lender submission** (the MVP delivery mechanism) reaches the submitted state via the Submission Readiness dialog with the MISMO package attached. Status machine advances correctly.
- [ ] ☑ Confirm the outcome copy stays inside the compliance rails (no closing-date guarantee, no rate/payment promise, "pre-approval is not a commitment to lend").

---

## 6. Documents & uploads

Uploads use GCS presigned URLs in prod; the local filesystem fallback is **dev-only** (`isLocalFallbackEnabled` = `!configured && NODE_ENV!=="production"`).

- [ ] ⛔ **Decide the launch posture and verify it:**
  - **GCS configured** (`GCS_SERVICE_ACCOUNT_KEY` + `PRIVATE_OBJECT_DIR`): request an upload URL, PUT a real PDF, and download it back. Content round-trips; ACL blocks another account from the object.
  - **GCS not configured** (documents deferred): `POST /api/uploads/request-url` returns **503 `UPLOADS_UNCONFIGURED`** (a deliberate, graceful gate — **not** a bug). Confirm the client surfaces it as "temporarily unavailable," and that nothing silently writes to ephemeral disk.
- [ ] ☑ Upload size cap and magic-byte content check reject an oversized file and a spoofed non-allowlisted file.

---

## 7. PII, security & audit — ⛔ BLOCKER

- [ ] ⛔ **SSNs / PII are encrypted at rest** (SSN vault + `encryptionService`; a spot DB read of an SSN column shows ciphertext, never plaintext).
- [ ] ⛔ **No secret leakage in responses.** A user/profile fetch does **not** return `passwordHash` or raw PII; error responses don't leak stack traces (5xx bodies are masked).
- [ ] ⛔ **Audit-log entries are written** for sensitive actions (credit pull, document download, adverse-action reads) — `auditLog` rows appear for a test action.
- [ ] ☑ Security headers present (CSP per §1 choice; `X-Content-Type-Options: nosniff` on document streams).

---

## 8. Compliance rails — ⛔ BLOCKER (verify each consciously)

These are the items most likely to be a *silent* launch risk. Each is a deliberate decision, not an assumption.

- [ ] ⛔ **SMS is OFF at launch (TCPA).** Confirm no outbound SMS path is active. If SMS is turned on, the Plaid/webhook signature gates and consent (`sms_opt_outs`, migration `0003`) become hard prerequisites — do not launch SMS without them.
- [ ] ⛔ **ECOA adverse-action path works end-to-end.** *(2026-08-05 correction: this line's original F-004 deferral went stale — the denial seam is wired: a denial is **blocked** unless a compliant §1002.9 / FCRA §615 notice generates (deny seam + underwriting advance-stage path), the staff BorrowerFile card delivers/mails the PDF, and the 30-day watchdog de-dups. Verified live in the #135–#139 walkthrough; close recorded in [BETA_GO_LIVE_READINESS.md](./BETA_GO_LIVE_READINESS.md) §1 and the feature-review FINDINGS register.)* Two-part walk (WF5-F2 FCRA §615(a) fix): **(a)** on a test file with **NO completed credit pull**, walk the full denial — the ECOA-only notice generates (no consumer-report claims, no bureau named), the borrower can read it, and delivery is recorded; **(b)** on a test file **with a completed (simulated) credit pull**, attempt the denial and assert it returns the **422 refusal** — the refusal IS the compliant behavior under test: simulated bureau data cannot produce a truthful §615(a) notice (no CRA furnished a report to name), so denial stays blocked until the live credit vendor (roadmap F3) is wired.
- [ ] ⛔ **Required disclosures present.** Compliance disclosure templates (e.g. anti-steering) are seeded — `ensureComplianceTemplates` ran at boot; the borrower-facing disclosures render.
- [ ] ☑ **AUS DU/LPA leg** (`/api/aus/*`, finding F-003) has no UI trigger and is a simulation. **Confirm the Target-5 wholesale lenders don't require a DU casefile *at submission*** (they typically run DU on their side). If they do, it moves into MVP scope; if not, record the deferral.
- [ ] ☑ Vendor simulations are labeled/behaving as simulations (credit, AVM, GSE) — no fabricated data presented as real (see §1 `CREDIT_VENDOR_MODE`).

---

## 9. Observability & scheduled jobs

- [ ] ☑ **Sentry** receives a test error (if `SENTRY_DSN` set), or record that error monitoring is deliberately off. The release is tagged from `RAILWAY_GIT_COMMIT_SHA` (`server/services/errorMonitoring.ts`), so the Sentry release should match the `commit` from §0.
- [ ] ☑ **Scheduled sweeps are GitHub Actions, not a platform cron.** [`.github/workflows/cron-jobs.yml`](../../.github/workflows/cron-jobs.yml) is *the* scheduler — the platform cron block it once mirrored was deleted at the Railway cutover, so a schedule removed or mistyped there is a sweep that silently never runs again. Prove the whole chain once with the manual lever rather than waiting for a schedule:
  ```
  Actions → cron-jobs → Run workflow → job: lifecycle
  ```
  Expect a green run (equity snapshots, PMI/refi alerts). A red run naming `CRON_SECRET` means the **repo secret** is missing; a 401 from the curl means the repo secret and the **Railway service variable** disagree (§1). Six schedules are registered: `lifecycle`, `rate-lock-alerts`, `letter-expiry`, `adverse-action-delivery`, `task-escalation`, and weekly `aggregate-data` — confirm all six still appear in the workflow's `on: schedule` list *and* in its resolve `case` mapping (an unmapped expression fires a run that curls nothing; `tests/letterIntegrity.test.ts` and `tests/taskEngineSlaSeed.test.ts` pin both halves). Scheduled workflows run against the **default branch only**.
- [ ] ☑ Railway logs are clean of unexpected 5xx during the walkthrough (Railway → service `Homiquity` → **Logs**, or `railway logs`).

---

## 10. Rollback readiness — ⛔ BLOCKER

- [ ] ⛔ **You can roll back in one step.** Railway → project `Homiquity` → service `Homiquity` → **Deployments** → the last known-good SUCCESS → **⋯ → Rollback**. It restores that **image and the variables it was deployed with**, with no rebuild and no git change; traffic switches once it is healthy. The procedure in [ROLLBACK.md](./ROLLBACK.md) §1 is understood, including:
  - ⚠️ **Retention window (72h on Hobby).** Past it the Rollback option is simply gone and the only path is a rebuild from source. Re-check this on the day, not from this document.
  - ⚠️ `railway redeploy` is **not** a rollback — it rebuilds the latest (i.e. the broken) commit. `railway restart` reuses the current image. Neither one gets you back to yesterday's code.
  - ⚠️ **First establish which failure you have** ([ROLLBACK.md](./ROLLBACK.md) §0). If `/api/health`'s `commit` is *older* than `origin/main`, prod is **stale**, not bad — rolling back makes it worse; read the FAILED build's log instead.
  - If this release included a migration, its reverse path (§3) is identified **before** launch. Remember a rollback moves the *code* back but not the *schema*: expand/contract is what makes that survivable.

---

## Sign-off

| Field | Value |
|---|---|
| Date / time (prod) | |
| Production commit SHA | `____` (the `commit` field from `GET /api/health` — **not** the Railway status) |
| Railway deployment id | |
| Rollback target still in the retention window? | ☐ yes (deployment id: `____`) |
| Migration HEAD verified | `____` (count from `migrations/meta/_journal.json` at run time) |
| Gate posture | pre-license: gated / open · beta: on / off |
| BLOCKERS all green? | ☐ yes |
| Known deferrals accepted (F-003 AUS · uploads-503 if GCS deferred · SMS off) | |
| Approved by | |
| Ledger row added | [CICD.md](./CICD.md#production-change-ledger-append-only) ☐ |

> A launch is authorized only when **every ⛔ BLOCKER is green** and the compliance items in §8 are each consciously signed off. Record the run in the production change ledger.
