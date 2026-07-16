---
name: Integration test auth over HTTP
description: How to authenticate against the live dev server in HTTP integration tests despite secure-only session cookies.
---

# Authenticating in HTTP integration tests

The session cookie (`connect.sid`) is configured
`secure: process.env.NODE_ENV === "production"` (see
[`server/integrations/auth/session.ts`](../../server/integrations/auth/session.ts)) —
secure-only whenever `NODE_ENV=production`. Vitest integration tests hit the
worktree dev server over plain `http://localhost:5002` (local dev is 5001); if
that server was booted with `NODE_ENV=production`, the login response carries no
`Set-Cookie` and authed requests fail with 401.

**Fix:** the server runs `app.set("trust proxy", 1)`, so send the header
`X-Forwarded-Proto: https` on the login request AND on every authenticated
request. With that header express-session treats the connection as secure and
both sets and accepts the cookie **regardless of NODE_ENV** — which is why every
integration test sends it defensively (belt-and-suspenders, so the suite passes
whether or not the server booted in production mode).

**How to apply:**
- `POST /api/test-login` with body `{ email, password }` using a non-production
  dev test account (the account map is `setupDevTestLogin` in
  [`server/auth.ts`](../../server/auth.ts); roster in
  [`knowledge-base/runbooks/TEST_ACCOUNTS.md`](../../knowledge-base/runbooks/TEST_ACCOUNTS.md)) —
  this route is dev-only and 404s in production.
- Extract the cookie via `res.headers.getSetCookie()` (fallback to
  `get("set-cookie")`), take the `name=value` before the first `;`.
- Pass it back as `Cookie:` plus the `X-Forwarded-Proto: https` header.

See `tests/pricingUnderwriting.test.ts` for the working helper pattern.
