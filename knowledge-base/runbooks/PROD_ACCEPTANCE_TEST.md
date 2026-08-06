# Production Acceptance Test — launch gate checklist

**Purpose.** The last gate before Homiquity goes commercial (roadmap **F1** — company NMLS license issued). Run this end-to-end against the **live production deploy** after every launch-critical change and immediately before flipping the pre-license gate open. It is a *release* acceptance test, not a code test — the unit/integration suites already ran in CI ([CICD.md](./CICD.md)). This proves the deployed system behaves in prod: config, gates, the money path, security, and the compliance rails.

**How to use.** Copy the checklist into the launch ticket, run top to bottom, check each box, and paste the result into the [production change ledger](./CICD.md#production-change-ledger-append-only). **Every ⛔ BLOCKER must pass to launch.** A failed BLOCKER stops the launch and gets a ledger row + rollback ([ROLLBACK.md](./ROLLBACK.md)). ☑ SHOULD items are logged but don't individually block.

**Environment.** Run against `https://www.homiquity.com` (the custom domain — live since the 2026-07-13 cutover). Use the current production commit — confirm it matches `origin/main` HEAD before starting.

---

## 0. Preconditions (do these first)

- [ ] **Confirm the deploy is live and current.** Vercel shows the latest `main` merge as **READY**, target `production` (`list_deployments` / dashboard). Prod commit SHA == `git rev-parse origin/main`.
- [ ] **Confirm prod DB migration HEAD.** Run the CI workflow with `dry_run: true` (Actions → CI → Run workflow) and confirm "up to date — no pending migrations" ([DB_MIGRATIONS.md](./DB_MIGRATIONS.md) §Pre-flight — prod isn't queryable from a laptop). As of 2026-08-05 the journal holds **47 entries (0000–0046)** — read the current count from `migrations/meta/_journal.json`, don't trust this sentence. Never `db:push` against prod ([TEAM_PRACTICES](../governance/TEAM_PRACTICES.md) §5).
- [ ] **A rollback target is identified.** The previous known-good production deploy is a Vercel rollback candidate ([ROLLBACK.md](./ROLLBACK.md) §1).

---

## 1. Environment & secrets — ⛔ BLOCKER

The server **fails closed** on missing security secrets (`assertEncryptionConfig` + `initEncryption` run before routes in `server/routes.ts`), so a bad config shows up as a boot failure / 503, not silent wrong behavior. Verify the intended config regardless.

- [ ] ⛔ **Required secrets set in the Vercel *production* env:** `DATABASE_URL`, `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`, `SESSION_SECRET`. (App refuses to boot without these.)
- [ ] ⛔ **`NODE_ENV=production`** in the prod env (gates all the dev-only fallbacks — test login, local upload store, etc.).
- [ ] ⛔ **`CREDIT_VENDOR_MODE` is UNSET** in prod. Set to `simulation` it would fabricate credit scores — production must refuse. (`.env.example` → "Credit vendor mode".)
- [ ] ☑ **`CRON_SECRET`** set (same value Vercel Cron uses) — else the daily lifecycle job only runs manually.
- [ ] ☑ **`APP_BASE_URL`** points at the canonical customer domain — `https://www.homiquity.com`, live since the 2026-07-13 cutover (the server default in `server/config/company.ts` matches; the env var wins if set). Customer-facing SMS/email links use it.
- [ ] ☑ **`PLAID_WEBHOOK_SECRET`** set **if** the Plaid assets webhook is in use (endpoint returns 503 fail-closed until set). If Plaid is not live, N/A.
- [ ] ☑ **`SENTRY_DSN`** set (error reporting) and **`SENDGRID_API_KEY`** / SMTP set **if** email notifications are expected at launch; otherwise record them as deliberately off.
- [ ] ☑ **`CSP_ENFORCE`** — decide: `true` to block (after a clean Report-Only soak) or leave Report-Only for launch. Record the choice.

---

## 2. Deploy health — ⛔ BLOCKER

- [ ] ⛔ **`GET /api/health` → 200** `{"status":"ok",...}`. (Proves the app booted *and* the DB is reachable — it runs `SELECT 1`.) A 503 here = DB unreachable or boot failure; **stop**.
- [ ] ☑ Point an uptime monitor (e.g. UptimeRobot) at `GET /api/health`.
- [ ] ☑ **No boot errors** in the Vercel runtime logs (`get_runtime_logs`) for the current deploy — specifically no encryption/KMS config failures.

---

## 3. Gate behavior — ⛔ BLOCKER (compliance-critical)

Two independent gates. Get both right — the pre-license gate is a **regulatory** control (Homiquity may not solicit a mortgage transaction pre-license).

**Pre-license gate** (`PRELAUNCH_GATED` server env + `VITE_PRELAUNCH_GATED` *build* env, tied to the NMLS id in `shared/companyIdentity.ts`; fail-safe: gated in prod while the NMLS id is PENDING). See [ARMED_LAUNCH_CHARTER](../governance/ARMED_LAUNCH_CHARTER_2026-07-07.md).

- [ ] ⛔ **While still pre-license (gated):** `/` renders the **Waitlist**, not the marketing Landing. Persona landing pages, the application funnel, rates/pricing, and the "Buy" nav dropdown are **not reachable** (client redirects gated routes to `/`; e.g. `/approval-strength` → `/`). No rate, price, or "apply" surface is exposed.
- [ ] ⛔ **The two gate flags flip together, only on F1 day:** server `PRELAUNCH_GATED=false` **and** build `VITE_PRELAUNCH_GATED=false` **and** the real company NMLS id is set in `shared/companyIdentity.ts`. Verify a fresh production **build** picked up `VITE_PRELAUNCH_GATED` (it's compiled in, not runtime — a redeploy is required).
- [ ] ☑ **After opening:** `/` renders Landing; the funnel and persona LPs are reachable.

**Private beta gate** (`BETA_ACCESS_CODE`, Vercel Edge `middleware.ts`, Vercel-only — no effect on local dev). Independent of the pre-license gate.

- [ ] ☑ If a private beta is intended: with `BETA_ACCESS_CODE` set, the site (except `/api/*`) locks behind `https://<host>/?beta=<code>`; a bad/absent code is blocked. Multiple comma-separated codes can be revoked individually.
- [ ] ☑ If a fully public launch: `BETA_ACCESS_CODE` is **unset**.

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

- [ ] ☑ **Sentry** receives a test error (if `SENTRY_DSN` set), or record that error monitoring is deliberately off.
- [ ] ☑ **Daily lifecycle cron** (`/api/jobs/lifecycle`) authenticates with `CRON_SECRET` (equity snapshots, PMI/refi alerts). A manual admin trigger succeeds.
- [ ] ☑ Runtime logs are clean of unexpected 5xx during the walkthrough (`get_runtime_logs` / `get_runtime_errors`).

---

## 10. Rollback readiness — ⛔ BLOCKER

- [ ] ⛔ **You can roll back in one step.** The previous production deploy is a Vercel rollback candidate; the procedure in [ROLLBACK.md](./ROLLBACK.md) §1 is understood. If this release included a migration, its reverse path (§3) is identified **before** launch.

---

## Sign-off

| Field | Value |
|---|---|
| Date / time (prod) | |
| Production commit SHA | |
| Deploy id | |
| Migration HEAD verified | `____` (count from `migrations/meta/_journal.json` at run time) |
| Gate posture | pre-license: gated / open · beta: on / off |
| BLOCKERS all green? | ☐ yes |
| Known deferrals accepted (F-003 AUS · uploads-503 if GCS deferred · SMS off) | |
| Approved by | |
| Ledger row added | [CICD.md](./CICD.md#production-change-ledger-append-only) ☐ |

> A launch is authorized only when **every ⛔ BLOCKER is green** and the compliance items in §8 are each consciously signed off. Record the run in the production change ledger.
