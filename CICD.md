# CI/CD Pipeline

How Homiquity is validated, tested, built, and deployed. For undoing a bad
change, see [ROLLBACK.md](ROLLBACK.md).

```
   push / PR to main
          │
          ▼
┌─────────────────────────────────────────────┐
│  GitHub Actions — .github/workflows/ci.yml    │
│                                               │
│   1. npm ci                                    │
│   2. Typecheck        (npm run check)          │
│   3. DB schema push   (npm run db:push)        │  ← throwaway Postgres service
│   4. Unit tests       (npm run test:unit)      │
│   5. Production build  (npm run build)          │
│   6. Boot server + Integration tests           │
│                        (npm run test:integration)│
└─────────────────────────────────────────────┘
          │
          ▼  (merge to main)
┌─────────────────────────────────────────────┐
│  Vercel — vercel.json                          │
│   • builds client (vite) → dist/public          │
│   • runs Express API as a serverless function   │
│     (api/index.ts)                              │
│   • instant rollback of any prior deploy        │
└─────────────────────────────────────────────┘
```

---

## Current status: gates are NON-BLOCKING

Every CI step runs with `continue-on-error: true`. **The pipeline reports
pass/fail but does not yet block merges or deploys.** This was a deliberate
starting point because two pre-existing issues make the pipeline red today:

1. **22 TypeScript errors** on `main` (`npm run check` fails). Mostly in
   `server/replit_integrations/` and `client/src/pages/public/AffordabilityCheck.tsx`.
2. **Auth is broken off-Replit**, so 3 API integration tests hang/fail. Session
   + Passport middleware only initialize when running on Replit, so `req.isAuthenticated`
   is undefined locally and on Vercel. **This is also a production blocker for the
   Vercel deploy**, not just a test failure.

Both are tracked as separate tasks. Once they're fixed, **tighten the gates** —
see ["Flip to blocking"](#flip-to-blocking-when-the-codebase-is-clean) below.

---

## The gates

| Step | Command | What it catches |
|------|---------|-----------------|
| Typecheck | `npm run check` | Type errors across client, server, shared, api (`tsc`) |
| Schema push | `npm run db:push -- --force` | Broken Drizzle schema; sets up the test DB |
| Unit tests | `npm run test:unit` | Pure logic regressions (pricing/underwriting DSL, MISMO validation, lookup resolver) — no server needed |
| Build | `npm run build` | Vite client build + esbuild server bundle |
| Integration tests | `npm run test:integration` | API behavior against a running server (auth, RBAC, endpoints) |

### Test layout — unit vs integration

Tests were split because some need a live HTTP server and some don't:

- **`vitest.config.ts`** (unit) → `tests/lookupResolver.test.ts`,
  `tests/mismoValidation.test.ts`. Pure in-process logic. Fast, no server, no DB.
  Run: `npm run test:unit`.
- **`vitest.integration.config.ts`** (integration) → `tests/api.test.ts`,
  `tests/lookupMatrixCoverageGap.test.ts`, `tests/lookupMatrixLifecycle.test.ts`,
  `tests/pricingUnderwriting.test.ts`. These make real HTTP calls to a running
  server at `TEST_BASE_URL` (default `http://localhost:5000`).
  Run locally against your dev server:
  ```bash
  TEST_BASE_URL=http://127.0.0.1:5001 npm run test:integration
  ```

In CI, the workflow builds the app (as a gate), then boots the **dev** server
(`npm run dev`) on port 5000, waits for it to answer, and runs the integration
suite against it. The dev server is used because the integration tests rely on
the dev test-login and relaxed CSRF; the production build is validated separately
by the build step.

---

## Deployment (Vercel)

The app deploys to Vercel: the Vite-built client is served as static assets from
the CDN, and the Express server runs as a single serverless function.

### How it's wired
- **`vercel.json`** — builds `dist/public` (via the `vercel-build` script =
  `vite build`) and routes:
  - `/api/*` → the serverless function `api/index.ts`
  - everything else → the static client, with SPA fallback to `/index.html`
- **`api/index.ts`** — imports `createApp()` from `server/app.ts` (added
  specifically for this: it builds the fully-wired Express app **without** calling
  `server.listen()`, which serverless can't use) and hands it to Vercel as the
  request handler. The app is built once per warm instance and reused.

Persistent hosts (Replit, Fly, a VPS) are unaffected — they still use
`npm run build` + `npm start`, which goes through `runApp()` and listens on `PORT`.

### One-time setup
1. Import the GitHub repo `barakatammre84/MortgageStream` into Vercel.
2. Vercel's Git integration then **auto-deploys**: production on push to `main`,
   preview deployments on every PR. (No deploy job in GitHub Actions is needed.)
3. Set the environment variables below in **Vercel → Project → Settings →
   Environment Variables** (Production + Preview).

### Required environment variables (Vercel)
| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | **Must be a Neon (or other cloud) Postgres URL, not localhost.** A non-localhost URL makes `server/db.ts` use the Neon serverless driver, which is what works in serverless. |
| `SESSION_SECRET` | Random 32+ byte hex. |
| `CREDIT_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `PII_HASH_SALT` | `openssl rand -hex 32` |
| `NODE_ENV` | `production` |
| `GEMINI_API_KEY` | Optional — document AI extraction. |
| `GOOGLE_MAPS_API_KEY` | Optional — address autocomplete / maps. |
| `OPENAI_API_KEY` | Optional — AI coach. |

> Serverless caveats to know: `express-rate-limit` uses an in-memory store, so
> limits are per-instance (not global) on Vercel — fine for now, revisit with a
> shared store (Redis/Upstash) if abuse becomes a concern. Sessions use the
> Postgres store (`connect-pg-simple`), which is correct for serverless. File
> uploads already go to object storage, not local disk.

---

## Flip to blocking (when the codebase is clean)

Once the 22 typecheck errors and the auth bug are fixed and the pipeline is green:

1. In `.github/workflows/ci.yml`, remove the `continue-on-error: true` lines (or
   set them to `false`) on the steps you want to enforce.
2. On GitHub → repo **Settings → Branches → Branch protection rules** for `main`:
   - Require the **CI / Validate, test & build** status check to pass before merge.
   - Require branches to be up to date before merging.
   - (Optional) require a PR review.
3. (Optional) Make Vercel wait for CI: enable **Settings → Git → "Only deploy
   when checks pass"** so a red pipeline can't ship to production.

---

## Roadmap / future hardening
- **Fix the two blockers** (typecheck, off-Replit auth), then flip gates to blocking.
- **Versioned DB migrations**: move from `drizzle-kit push` to `generate` + `migrate`
  so schema changes are reviewable and reversible (see [ROLLBACK.md](ROLLBACK.md) §3).
- **Lint**: no ESLint is configured yet; `tsc` is the current static-analysis gate.
  Add ESLint + a lint step when ready.
- **Secret scanning / dependency audit**: add `npm audit` and a secrets scanner as
  additional non-blocking gates.
- **Smoke test after deploy**: hit a health endpoint post-deploy and auto-rollback
  on failure.

## Related docs
- [ROLLBACK.md](ROLLBACK.md) — how to undo a deploy, code change, or migration.
- [LOCAL_DEV.md](LOCAL_DEV.md) — local setup and the `save`/`sync` git helpers.
