---
name: Integration test auth over HTTP
description: How to authenticate against the live dev server in HTTP integration tests despite secure-only session cookies.
---

# Authenticating in HTTP integration tests

The session cookie (`connect.sid`) is configured `secure: true` (see
`server/replit_integrations/auth/replitAuth.ts`), so it is only set and sent
over HTTPS. Vitest integration tests hit the dev server over plain
`http://localhost:5000`, so without help the login response carries no
`Set-Cookie` and authed requests fail with 401.

**Fix:** the server runs `app.set("trust proxy", 1)`, so send the header
`X-Forwarded-Proto: https` on the login request AND on every authenticated
request. With that header express-session treats the connection as secure and
both sets and accepts the cookie.

**How to apply:**
- `POST /api/test-login` with body `{ email, password }` using a non-production
  dev test account (see the seeded test accounts in `server/seed.ts`) — this
  route is dev-only and 404s in production.
- Extract the cookie via `res.headers.getSetCookie()` (fallback to
  `get("set-cookie")`), take the `name=value` before the first `;`.
- Pass it back as `Cookie:` plus the `X-Forwarded-Proto: https` header.

See `tests/pricingUnderwriting.test.ts` for the working helper pattern.
