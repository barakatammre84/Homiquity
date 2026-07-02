# 06 — Auth, Security & Secrets

## Authentication

Three login paths, all managed by Passport + express-session
([`server/auth.ts`](../../server/auth.ts), `server/socialAuth.ts`,
`server/replit_integrations/auth/`):

1. **Email/password** — `POST /api/auth/register` / `POST /api/auth/login`;
   bcrypt-style hashing (`comparePasswords`/`hashPassword`).
2. **Social OAuth** — Google, LinkedIn, Apple (`server/socialAuth.ts`).
3. **Replit OIDC** — only when running on Replit (`REPL_ID` set); irrelevant on
   Vercel/local, kept for backwards compatibility.

Sessions are stored **in Postgres** (`sessions` table, `connect-pg-simple`) and
identified by the `connect.sid` cookie. That makes them serverless-safe (no
in-memory session state).

> ⚠️ **Known issue in flight (2026-07-02):** historically the session/Passport
> middleware was only initialized inside the Replit OIDC setup, so off-Replit
> `req.isAuthenticated` didn't exist and auth was broken. A fix (initialize
> session+passport unconditionally) is being merged from a background task.
> If you see `req.isAuthenticated is not a function`, this is that.

### Dev logins
`POST /api/test-login` (dev only; guarded by `NODE_ENV` and requires
`DEV_TEST_PASSWORD`) logs you in as seeded role accounts —
see [TEST_ACCOUNTS.md](../../TEST_ACCOUNTS.md).

## Authorization (RBAC)

`users.role` ∈ borrower · staff · admin · agent. Middleware in `server/auth.ts`:
`isAuthenticated`, `isAdmin`, `requireRole(...roles)`. The role is re-read from
the DB on each authenticated request, so demotions apply immediately.
Per-resource ownership checks (does this application belong to `req.user.id`?)
are done inline in handlers — always add them for borrower data.

## Platform security controls (`server/app.ts`)

| Control | Detail |
|---------|--------|
| Helmet | Security headers (CSP currently disabled — see threat model) |
| Rate limiting | 500/15min general on `/api`; 20/15min auth; 50/15min uploads; per-minute tracking |
| CSRF | Origin/Referer allow-list on state-changing `/api` requests (OAuth callbacks exempt — protected by OAuth `state`) |
| Log hygiene | Sensitive paths' response bodies suppressed; invite tokens redacted from logged paths |
| Central error handler | No stack traces leak to clients |

## Data protection

- **Field encryption**: credit-related PII is encrypted at rest with
  `CREDIT_ENCRYPTION_KEY` (`server/services/encryptionService.ts`).
- **Hashing**: PII lookups/anonymization use `PII_HASH_SALT`.
- **Tamper-evidence**: the credit audit log is hash-chained
  (`computeAuditEntryHash`, `verifyHashChain`).
- **Boot guard**: `assertEncryptionConfig()` stops the server from starting
  without the two keys above — you cannot accidentally run unencrypted.
- **FCRA flow**: consent capture (versioned disclosure text) → credit pull
  (soft/hard recorded) → adverse action records — all in
  `server/services/creditService.ts` + `shared/schema/compliance.ts`.

Deeper reading: [threat_model.md](../../threat_model.md).

## Secrets inventory (complete)

Everything the code reads from `process.env`, grouped. **Required** means the
app won't boot or a core feature dies without it.

### Required
| Variable | Used for |
|----------|----------|
| `DATABASE_URL` | Postgres. localhost → `pg` driver; anything else → Neon serverless driver |
| `SESSION_SECRET` | Session cookie signing |
| `CREDIT_ENCRYPTION_KEY` | Field encryption (boot-guarded) |
| `PII_HASH_SALT` | PII hashing (boot-guarded) |

### Feature-gated (optional; feature off/degraded without it)
| Variable | Feature |
|----------|---------|
| `GEMINI_API_KEY` (or `AI_INTEGRATIONS_GEMINI_API_KEY`) | Document AI extraction |
| `AI_INTEGRATIONS_OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_BASE_URL` | AI Coach |
| `AI_GATEWAY_PROVIDER`, `AI_GATEWAY_GEMINI_MODEL`, `AI_GATEWAY_CLAUDE_MODEL`, `ANTHROPIC_API_KEY` | Pluggable AI gateway (`server/services/aiGateway.ts`) |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | Income/employment/asset verification |
| `GCS_SERVICE_ACCOUNT_KEY`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | Document storage (GCS) |
| `GOOGLE_MAPS_API_KEY` | Address autocomplete/geocoding/maps |
| `RAPIDAPI_KEY` | Property listings + live rate lookups |
| `SMTP_HOST/PORT/USER/PASS`, `SENDGRID_API_KEY`, `FROM_EMAIL`, `FROM_NAME` | Outbound email (console-logged if unset) |
| `APPLE_CLIENT_ID/KEY_ID/TEAM_ID/PRIVATE_KEY` | Apple Sign-In |
| `PUBLIC_BASE_URL` | Absolute URLs in invites/emails (falls back to request host) |

### Dev / platform
| Variable | Purpose |
|----------|---------|
| `NODE_ENV`, `PORT` | Runtime mode; local dev uses PORT=5001 |
| `DEV_TEST_PASSWORD` | Enables `/api/test-login` (never set in prod) |
| `USE_LOCAL_PG` | Force the `pg` driver |
| `REPL_ID`, `REPLIT_*`, `ISSUER_URL` | Replit-only (OIDC, domains); ignored elsewhere |
| `LOOKUP_MATRIX_STAMP_WINDOW_MS` | Lookup-matrix tuning |

### Where secrets live
- **Local**: `.env` (gitignored; template in `.env.example`). The production
  Neon URL is also stashed there as `PROD_DATABASE_URL` for schema pushes.
- **Production**: Vercel → Project → Settings → Environment Variables.
- **Never in git.** `.gitignore` covers `.env*`; keep it that way. If a secret
  ever lands in a commit or a chat transcript, rotate it.
