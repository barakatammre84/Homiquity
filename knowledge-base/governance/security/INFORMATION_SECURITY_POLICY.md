# Information Security Policy

**Company:** Homiquity Mortgage Corporation (NMLS #427468) · **Owner:** Founder/CEO (Security Owner)
**Version:** 1.0 drafted 2026-07-17 · **Adopted:** pending sign-off (§12) · **Review:** annually and on material change
**Authority:** [L2 Compliance & Logic](../../L2_COMPLIANCE_AND_LOGIC.md) guardrails + [TEAM_PRACTICES.md](../TEAM_PRACTICES.md) §9
**Audience:** everyone with access to Homiquity systems or data.

## 1. Purpose & scope

Homiquity operates a residential-mortgage platform that processes borrower PII — identity,
income, assets, credit, and uploaded documents. This policy states how we protect that data
and the systems that touch it. It covers the current two-person team (Founder/CEO and
Developer), all endpoints used for work (§6), the production platform (§4), and every
third-party service in the [Asset & Endpoint Register](ASSET_REGISTER.md).

## 2. Roles

- **Security Owner — Founder/CEO:** approves access grants, new vendors, and policy
  exceptions; leads incident response; signs the annual review.
- **Developer:** implements and maintains the technical controls; routes security-relevant
  changes through the mandatory review triggers below.
- Every engineering session (human or AI-assisted) is bound by
  [TEAM_PRACTICES.md](../TEAM_PRACTICES.md). Its **§9 security-review triggers are binding**:
  any change touching PII vaults/field encryption, auth & sessions, role/permission gates,
  uploads/object storage, outbound messaging/webhooks, or PII-adjacent logging requires a
  structured security review before merge, and unresolved critical findings block the merge.

## 3. Data classification & handling

| Class | Examples | Required handling |
|---|---|---|
| **Restricted** | SSNs, bank account numbers, Plaid access tokens, raw credit-report payloads, uploaded income/identity documents | Field-level **AES-256-GCM encryption at rest** with versioned keys (`server/services/encryptionService.ts`, `server/services/ssnVault.ts`, `server/services/piiVault.ts`). Plaintext SSNs/account numbers are never persisted — ciphertext + last-4 only, write-only via the API; decryption is confined to regulated delivery paths and a single audited staff-reveal flow. |
| **Confidential** | Loan applications, URLA data, borrower contact records, pricing/underwriting configuration | Authenticated, role-gated access only; per-resource ownership checks; mutations audit-logged. |
| **Internal** | Source code, runbooks, roadmap | Private GitHub repository; 2FA-protected accounts. |
| **Public** | Marketing site content | No restriction. |

Supporting controls: salted PII hashing for lookups; a **hash-chained, tamper-evident credit
audit log** (`computeAuditEntryHash`/`verifyHashChain`); an allowlist restricting which API
response bodies may ever be logged (`server/app.ts`); and a general audit trail capturing
actor, action, target, IP, and user agent (`server/auditLog.ts`). Regulated records (credit
reports, consents) carry enforced expiry/archival timestamps in the schema consistent with
FCRA timelines; encrypted PII is disposed of by row deletion plus encryption-key retirement.

## 4. Hosting & infrastructure

All server-side components run on **managed cloud infrastructure**: Vercel (serverless
application hosting), Neon (managed PostgreSQL, TLS enforced), and Google Cloud Storage
(borrower documents). There are **no on-premise or self-managed servers** and no corporate
office network — all access is remote, per-user, authenticated, and over TLS. The production
database provides continuous point-in-time recovery (Neon); the restore procedure is
documented in [ROLLBACK.md](../../runbooks/ROLLBACK.md). Our infrastructure subprocessors
maintain SOC 2 Type II programs (Vercel, Neon, GitHub, Google Cloud, Anthropic).

## 5. Access control

Access is least-privilege and deny-by-default per the
[Access Control Policy](ACCESS_CONTROL_POLICY.md): two named individuals, **2FA required on
every console** that can reach code, production infrastructure, or borrower data, quarterly
access reviews, and revocation within 24 hours on departure or role change.

## 6. Endpoint & BYOD standard

Work is performed on personally-owned laptops (BYOD). Every device used for Homiquity work
**must** have:

- Full-disk encryption on (macOS FileVault);
- Gatekeeper + XProtect enabled (macOS's built-in, automatically-updated anti-malware) or an
  equivalent endpoint-protection agent;
- Automatic OS and security updates enabled;
- Screen lock requiring a password immediately on sleep/screensaver;
- A unique local account with a strong password — no shared accounts;
- 2FA on every work account accessed from the device (§5).

Borrower PII is **not stored on endpoints**: borrower data lives in the production database
and object storage and is accessed through the application and authenticated tooling. Device
compliance is recorded per-device in the [Asset & Endpoint Register](ASSET_REGISTER.md) and
re-verified quarterly. A lost or stolen device is reported to the Security Owner immediately
and triggers the [incident process](INCIDENT_RESPONSE_PLAN.md) (session and credential
revocation).

## 7. Vendors & subprocessors

Third-party services are inventoried in the [Asset & Endpoint Register](ASSET_REGISTER.md)
with the data each touches. A new vendor requires Security Owner approval against this
policy **before** any borrower data flows to it. Vendor credentials exist only in Vercel
environment variables, scoped per environment — never in the repository. AI usage is
additionally governed by the [AI Governance Policy](../AI_GOVERNANCE_POLICY.md).

## 8. Vulnerability & patch management

- **Application dependencies:** every pull request runs `pnpm audit` over production
  dependencies as a blocking step of the CI `gate` (fails on high/critical; merges wait
  for a green gate per [TEAM_PRACTICES](../TEAM_PRACTICES.md) §6); Dependabot raises
  weekly dependency-update PRs; the repo health script (`pnpm checkup`) additionally
  audits at moderate level.
- **Platform:** operating systems, runtimes, and network infrastructure are patched by the
  managed providers (Vercel, Neon, Google Cloud) under their SOC 2 programs — there are no
  mutable server instances for us to patch.
- **Endpoints:** automatic OS/security updates are required by §6 and verified in the register.
- **Remediation:** a high/critical dependency finding blocks merge until fixed or expressly
  excepted by the Security Owner with a documented mitigation (§11).

## 9. Secure development

Production deploys only from `main`, which is branch-protected: changes land by pull request
through a required CI gate (typecheck, unit tests, production-dependency audit,
schema↔migration guard), with protection enforced for administrators. Security-sensitive
areas carry the binding §9 pre-merge review triggers (§2). The API applies defense-in-depth:
Zod input validation, per-surface rate limiting, origin-checked CSRF protection on
state-changing requests, shared-secret-verified webhooks that **fail closed** in production,
helmet security headers with a Content-Security-Policy, and Postgres-backed sessions
(`httpOnly`/`secure` cookies, 12-hour rolling idle timeout). Database schema changes are
migration-gated and applied by CI with **no standing production database credential** — a
scoped connection string is minted at run time from the Neon API
(`scripts/neon-connection-uri.cjs`).

## 10. Incident response

Handled per the [Incident Response Plan](INCIDENT_RESPONSE_PLAN.md): contain → preserve
evidence → eradicate & recover → notify (counsel-guided; FTC Safeguards Rule, state breach
statutes, partner agreements) → blameless postmortem.

## 11. Exceptions

Any exception to this policy is time-boxed, documented in
[ASSUMPTIONS.md](../ASSUMPTIONS.md), and approved by the Security Owner.

## 12. Adoption

Signing below adopts this policy and its companion documents (Access Control Policy, Asset &
Endpoint Register, Incident Response Plan) as company policy.

| Role | Name | Date |
|---|---|---|
| Security Owner (Founder/CEO) | ____________________ | ____________ |
| Developer | ____________________ | ____________ |
