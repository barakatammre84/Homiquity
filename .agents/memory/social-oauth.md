---
name: Social OAuth (Google/LinkedIn/Apple) gotchas
description: Non-obvious constraints for the custom social-auth flow in server/socialAuth.ts
---

The custom social-auth flow (not the Replit OIDC integration) lives in `server/socialAuth.ts`. Callback URL is derived per-request from host + `x-forwarded-proto`, so EVERY environment (dev preview domain + published domain) has a distinct redirect URI that must be registered in each provider console, or the provider shows its own error page (e.g. Google `redirect_uri_mismatch`) — that is the "error page", not a 500 in our code.

**Apple Sign In requires real work, a static client secret cannot work:**
- The OAuth `client_secret` must be a short-lived ES256 JWT signed with Apple's `.p8` private key. Needs: `APPLE_CLIENT_ID` (the Services ID, not the App ID), `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8 contents). Generate per-request; sign with Node `crypto.createSign("SHA256", { dsaEncoding: "ieee-p1363" })` (64-byte raw sig, NOT DER).
- Apple replies via `response_mode=form_post` (required when name/email scope requested) — a **cross-site POST**. Two consequences this codebase had to handle:
  1. The `SameSite=Lax` session cookie is NOT sent on a cross-site POST, so session-stored OAuth `state` is lost. Carry `state` in a dedicated `SameSite=None; Secure` cookie (`oauth_state`, path `/api/auth`) and validate against it, session as fallback.
  2. The global CSRF Origin/Referer middleware in `server/app.ts` would 403 the cross-site POST. Exempt `/api/auth/*/callback` from CSRF (the OAuth `state` param is the CSRF defense there).
- Apple only returns the user's name on the FIRST authorization (in the form_post `user` field); email comes from the `id_token` claims.

**Why:** these are external-protocol constraints invisible in the code until you hit the provider; documented so the next change to auth doesn't reintroduce the SameSite/CSRF breakage.
