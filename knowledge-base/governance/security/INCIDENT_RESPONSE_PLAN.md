# Incident Response Plan

**Company:** Homiquity Mortgage Corporation (NMLS #427468) · **Incident Commander:** Founder/CEO (backup: Developer)
**Version:** 1.0 drafted 2026-07-17 · **Adopted:** with the [Information Security Policy](INFORMATION_SECURITY_POLICY.md) §12 · **Review:** annually and after every SEV-1/SEV-2
**Authority:** [Information Security Policy](INFORMATION_SECURITY_POLICY.md) §10.

## 1. What counts as an incident

Any suspected or confirmed unauthorized access to systems or borrower data, credential
compromise, malware on a work device, data exposure (including misdirected data), or an
integrity failure in audit/compliance records.

| Severity | Definition | Examples |
|---|---|---|
| **SEV-1** | Confirmed exposure of Restricted data, or platform-wide compromise | Database exfiltration; leaked encryption keys; account takeover with PII access |
| **SEV-2** | Suspected or contained compromise; exploitable vulnerability in production; single-account takeover without confirmed PII loss | Leaked API key with narrow scope; malware on a laptop; auth bypass found before abuse |
| **SEV-3** | Policy violation or defect with no evidence of data risk | Console found without 2FA; secret pasted into a local file and immediately rotated |

## 2. First hour (SEV-1/SEV-2)

1. **Assign the Incident Commander** (Founder/CEO; Developer if unavailable). Start a
   timestamped incident log — every action and finding, as it happens.
2. **Contain.** Levers, fastest first:
   - Gate the whole site behind invite codes: set `BETA_ACCESS_CODE` as a Railway service
     variable (Railway → project *Homiquity* → service *Homiquity* → Variables). The
     in-process Express middleware `server/middleware/betaGate.ts` then locks every path
     except `/api/*`, and serves a Disallow-all `robots.txt` while armed. The value is read
     per request, so the gate is live as soon as the service is running with it set.
   - Roll back to a known-good deployment ([ROLLBACK.md](../../runbooks/ROLLBACK.md) §1):
     Railway → project → service → **Deployments** → the last-good deployment → **Rollback**,
     which restores that image *and* its variables with no rebuild. Do this **early** — image
     retention is limited (72 h on the Hobby plan), and a rollback window can close.
     `railway redeploy` is **not** a rollback: it rebuilds the current (possibly bad) commit.
   - Kill all sessions: rotate `SESSION_SECRET` (boot-enforced entropy floor) and/or clear
     the `sessions` table.
   - Disable a compromised webhook by removing its shared secret — production endpoints
     fail closed (503).
   - Suspend the affected console seat or API key at the vendor.
3. **Preserve evidence before cleanup.** Snapshot the database via a Neon point-in-time
   branch; export the Railway service's build and runtime logs (Railway → service →
   Deployments → the deployment → logs) **promptly**, since platform log retention is
   limited and a rollback replaces the running container; capture the audit trail
   (`server/auditLog.ts` table) and verify credit-audit integrity with the hash-chain check
   (`verifyHashChain`, `server/services/encryptionService.ts`).
4. **Rotate what the attacker could have touched:** vendor API keys at each console,
   `SESSION_SECRET`, the Neon password (update the consumer — the `DATABASE_URL` Railway
   service variable — *then* rotate; note the pooled connection-string gotcha in
   [CICD.md](../../runbooks/CICD.md)), GCS service-account key, and PII encryption keys by
   rotate-forward (`ENCRYPTION_ACTIVE_KEY_ID` — old rows still decrypt under retired keys,
   new writes use the new key). Also rotate `CRON_SECRET` in **both** places it lives — the
   GitHub repository secret and the Railway service variable — or the scheduled jobs in
   `.github/workflows/cron-jobs.yml` start failing 401 silently.
   ⚠️ **After any `DATABASE_URL` change, confirm which Neon branch you landed on.** `/api/health`
   only runs a `SELECT 1`, which succeeds against *any* reachable Postgres: on 2026-08-06 the
   variable pointed at a stale branch (28 of 53 migrations) and health stayed 200 while
   data-bearing routes 500'd. Probe a data route, not just health.

## 3. Eradicate & recover

Identify and close the entry path (patch, config, revocation) before restoring exposure.
Recovery uses [ROLLBACK.md](../../runbooks/ROLLBACK.md) (deployment rollback; Neon
point-in-time restore for data). Re-open access only when the Incident Commander confirms
the vector is closed and credentials are rotated.

**Confirm what is actually running before declaring recovery.** A failed Railway build leaves
the *previous* container serving, so the site being up — and `/api/health` returning 200 — does
not prove your fix deployed. Read the **`commit`** field of
`curl https://www.homiquity.com/api/health` and match it to the commit you intended to ship
(CI's `verify-deploy` job does the same check automatically after every push to `main`).

## 4. Notification (counsel-guided)

Engage counsel before external notifications; the Incident Commander owns all comms.
Obligations to evaluate for any borrower-data event:

- **FTC Safeguards Rule (16 CFR Part 314):** notify the FTC within 30 days of discovery for
  a notification event involving unencrypted customer information of ≥ 500 consumers.
- **State breach-notification statutes** for each affected consumer's state of residence.
- **Contractual partner notices** — including Plaid per its agreements, once integrated.
- Affected consumers, per state law and counsel's guidance.

Encryption matters here: Restricted fields are AES-256-GCM encrypted at rest, which many
statutes treat as a safe harbor **unless keys were also compromised** — assess key exposure
explicitly in every incident.

## 5. Postmortem

Blameless postmortem within 5 business days of resolution: timeline, root cause, what
limited (or failed to limit) the blast radius, remediation items filed to the roadmap, and a
production change ledger entry ([CICD.md](../../runbooks/CICD.md)) for any prod action taken.
SEV-1/SEV-2 postmortems trigger a review of this plan.

## 6. Contacts

| Who | Role |
|---|---|
| Founder/CEO | Incident Commander, all external comms, counsel engagement |
| Developer | Technical containment & forensics |
| Counsel | Engage before any external notification (contact details held by the Founder) |
