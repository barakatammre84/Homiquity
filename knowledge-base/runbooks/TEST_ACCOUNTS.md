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
| renter@test.com | `aspiring_owner` | Incubator surface (RenterHome) |
| buyer@test.com | `active_buyer` | Borrower engine (Dashboard) — integration tests use this account |

> Note (2026-07-12): the `realtor` partner role (PartnerHub PH-1, #121) deliberately has **no
> fixture account** — realtor accounts are created through the PH-1 registration + admin
> approval queue, which is itself part of what needs testing.

## Usage

UI: navigate to `/test-login` for one-click login buttons.

API:

```
POST /api/test-login
Content-Type: application/json

{ "email": "buyer@test.com", "password": "<DEV_TEST_PASSWORD>" }
```

Logging in upserts the user (`id: test-<name>`), so accounts self-heal if the dev database
is reset. Integration-test auth gotchas: see `.agents/memory/integration-test-auth.md`.
