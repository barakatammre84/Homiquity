# Test Accounts (dev only)

Eleven role-based test accounts for development. Source of truth is `setupDevTestLogin` in
[server/auth.ts](../../server/auth.ts) — if this table and the code disagree, the code wins.

**Password:** all accounts share the single password in the `DEV_TEST_PASSWORD` env var
(set it in your `.env`; see LOCAL_DEV.md). Credentials are deliberately **not** stored in
the repo, and the endpoint is hard-gated to non-production (`POST /api/test-login`
returns 404 in prod; 503 if `DEV_TEST_PASSWORD` is unset).

| Email | Role | Persona |
|---|---|---|
| admin@test.com | `admin` | Full system access, compliance tools |
| lo@test.com | `lo` | Loan officer |
| loa@test.com | `loa` | Loan officer assistant |
| processor@test.com | `processor` | Loan processor |
| underwriter@test.com | `underwriter` | Underwriter |
| closer@test.com | `closer` | Closer |
| broker@test.com | `broker` | External referral partner (broker dashboard) |
| lender@test.com | `lender` | Lender rep |
| cpa@test.com | `cpa` | CPA partner — inviter-only referral portal; never sees borrower data |
| renter@test.com | `aspiring_owner` | Incubator surface (RenterHome) — **only while it has zero applications**: the gate keys on the account's rows, not its role, and this seat has carried a stray application before (2026-08-20). Probe `GET /api/loan-applications` first; journey walks use a fresh signup instead |
| buyer@test.com | `active_buyer` | Borrower engine (Dashboard) — integration tests use this account |

> Note (2026-07-12): the `realtor` partner role (PartnerHub PH-1, #121) deliberately has **no
> fixture account** — realtor accounts are created through the PH-1 registration + admin
> approval queue, which is itself part of what needs testing.

## Usage

UI: navigate to `/test-login`, enter the shared `DEV_TEST_PASSWORD` once in the field above
the cards, then every account card is one-click. (The cards briefly carried fake per-account
passwords the server never accepted — fixed 2026-08-04; the shared password is the only one.)

API:

```
POST /api/test-login
Content-Type: application/json

{ "email": "buyer@test.com", "password": "<DEV_TEST_PASSWORD>" }
```

Logging in upserts the user (`id: test-<name>`), so accounts self-heal if the dev database
is reset. **Integration-test auth gotcha — corrected 2026-08-18:** the session cookie is
`secure: process.env.NODE_ENV === "production"` ([`server/integrations/auth/session.ts`](../../server/integrations/auth/session.ts)),
**not** unconditionally `secure: true`. Against a server booted with `pnpm dev` — which is how the
documented integration flow runs it — the cookie is not secure-only and **`X-Forwarded-Proto: https`
is unnecessary.** Roughly ten test files send it anyway with comments repeating the old claim; the
header is ignored, so they still pass, but do not treat its absence as the cause of a 401. A real
401 on an integration run is a cookie-jar or ordering problem, or an unmigrated `sessions` table.
The header **is** required against a server running with `NODE_ENV=production`.
