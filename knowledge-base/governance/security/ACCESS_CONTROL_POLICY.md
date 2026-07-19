# Access Control Policy

**Company:** Homiquity Mortgage Corporation (NMLS #427468) · **Owner:** Founder/CEO (Security Owner)
**Version:** 1.0 drafted 2026-07-17 · **Adopted:** with the [Information Security Policy](INFORMATION_SECURITY_POLICY.md) §12 · **Review:** quarterly (with the register)
**Authority:** [Information Security Policy](INFORMATION_SECURITY_POLICY.md) §5.

## 1. Principles

Least privilege · deny by default · **server-side enforcement** (client UI state is never a
security control) · every sensitive access attributable to a person and audit-logged.

## 2. Who has access

| Person | Role | Scope |
|---|---|---|
| Founder / CEO | Security Owner | All consoles; production data (admin) |
| Developer | Engineering | Code, CI, and the production consoles required for operations |

No other individuals hold credentials. Adding anyone requires a Security Owner grant, this
policy's onboarding requirements (2FA before first access), and a row in the
[Asset & Endpoint Register](ASSET_REGISTER.md).

## 3. Console authentication requirements

**2FA (authenticator app or passkey — not SMS where avoidable) is required on every console**
that can reach source code, production infrastructure, or borrower data: GitHub, Vercel,
Neon, Google Workspace / Google Cloud, Anthropic Console, and ancillary vendor consoles
(property data, error monitoring, email delivery, and the Plaid Dashboard upon issuance).
Per-console status is tracked in the register; a console found without 2FA is remediated
within 7 days or has its access suspended.

## 4. Access lifecycle

- **Grant:** Security Owner approval; narrowest workable scope.
- **Review:** quarterly, alongside the register review — confirm every seat is still needed.
- **Revoke:** within 24 hours of departure or role change — remove the GitHub, Vercel, Neon,
  and Google seats; then rotate anything the departing person could have held: vendor API
  keys at their consoles, `SESSION_SECRET` (invalidates all sessions), the Neon password, and
  PII encryption keys by versioned rotate-forward (`ENCRYPTION_ACTIVE_KEY_ID` — new writes use
  the new key, old rows still decrypt).

## 5. Production change control

- `main` is production. All changes land by pull request and must pass the CI `gate` check
  (typecheck, unit tests, production-dependency audit at high/critical, schema ↔ migration
  guard, design-token guard) before merge, **verified green at merge time as documented
  procedure** ([TEAM_PRACTICES](../TEAM_PRACTICES.md) §6). *(2026-07-19: the repository is
  deliberately private on the GitHub Free plan, which does not enforce branch protection on
  private repositories — merge discipline is procedural, not platform-enforced. Direct
  pushes to `main` are prohibited by policy.)*
- Database schema changes ship as versioned SQL migrations applied by CI on merge using a
  connection string **minted at run time** from `NEON_API_KEY`
  (`scripts/neon-connection-uri.cjs`); no standing production database password exists in
  GitHub, and the migration tool refuses non-TLS URLs (`scripts/migrate-prod.cjs`).
- Destructive production actions (data changes, env flips, credential rotation) are
  Security-Owner-supervised and recorded in the production change ledger
  ([CICD.md](../../runbooks/CICD.md)) — see [TEAM_PRACTICES.md](../TEAM_PRACTICES.md) §6.

## 6. Secrets

- Production secrets exist only in Vercel project environment variables; local development
  uses a gitignored `.env` (`.env.example` in the repo carries empty placeholders only).
- No secrets in code, logs, or URLs; API response-body logging is restricted to an explicit
  allowlist (`server/app.ts`), widening of which is itself a §9 security-review trigger.
- `SESSION_SECRET` has a boot-enforced entropy floor in production. PII encryption keys are
  versioned (`keyId`) with app-level rotation and optional Cloud-KMS envelope wrapping (data
  keys wrapped by a KMS key that never leaves the HSM).

## 7. Application-layer access control (defense in depth)

- Server-side RBAC on every protected route: `isAuthenticated`, `isAdmin`, and
  `requireRole(...)` (`server/auth.ts`), with role definitions centralized in
  `shared/roles.ts`. The user's role is **re-read from the database on each authenticated
  request**, so demotions and revocations apply immediately.
- Internal-staff vs external-partner separation (`isInternalStaffRole`) plus per-resource
  ownership checks on borrower records — the enforced guarantees are specified in the
  [threat model](../../compliance/security/threat_model.md).
- Borrower PII: write-only encrypted vault (AES-256-GCM ciphertext + last-4 only), full
  decryption confined to regulated delivery paths and one audited staff-reveal flow;
  encrypted columns are stripped before any serialization.
- Sessions are Postgres-backed with `httpOnly`, `secure` (production), `sameSite` cookies and
  a 12-hour rolling idle timeout; passwords are hashed with scrypt (per-user salt,
  constant-time comparison); Google OAuth sign-in is handled server-side.

## 8. Adoption

Adopted via the [Information Security Policy](INFORMATION_SECURITY_POLICY.md) §12 signature block.
