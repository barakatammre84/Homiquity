# 02 — Architecture, Entry & Exit Points

## Big picture

One repository, one Express server, one React SPA, one Postgres database.
That is literally true in production: Railway runs **one persistent Node
process** (`dist/index.js`) which serves both the API (`/api/*`) and the built
client (`express.static` + SPA catch-all). There is no CDN, no serverless
function, and no edge middleware in front of it — every request, document or
API, is handled by the middleware chain below.

```
                 ┌────────────────────────────────────────────┐
                 │                 client/  (React SPA)         │
                 │  Wouter routes · TanStack Query · Shadcn UI  │
                 └───────────────────┬────────────────────────┘
                                     │ fetch /api/*  (session cookie)
                                     ▼
┌─────────────────────────────── server/ ────────────────────────────────┐
│ app.ts        — express app: helmet, rate limits, CSRF, logging          │
│ routes.ts     — registerRoutes(): health, auth, seeding, 39 route domains │
│ routes/*.ts   — HTTP handlers per domain (borrower, lending, admin, …)    │
│ services/*.ts — business logic (underwriting, pricing, borrower graph, …) │
│ storage/      — the data-access layer (26 domain files → DatabaseStorage) │
│ db.ts         — Drizzle + driver selection (Neon serverless vs local pg)  │
└───────────────────┬──────────────────────────────┬─────────────────────┘
                    ▼                              ▼
             PostgreSQL (Drizzle)          External services
             188 tables, 34 files          (Plaid, Anthropic, GCS,
             shared/schema/*               Google Maps, RapidAPI, SMTP)
```

## Entry points (every way execution starts)

| Entry | File | Used when |
|-------|------|-----------|
| Dev server | `server/index-dev.ts` → `runApp(setupVite)` | `pnpm dev` — Vite runs as Express middleware, HMR for client |
| **Prod server (the only prod entry)** | `server/index-prod.ts` → `runApp(serveStatic)` | `pnpm start` on Railway — one process; serves `/api/*` **and** `dist/public` statically |
| Client | `client/index.html` → `client/src/main.tsx` → `App.tsx` | The SPA — all browser routes |
| MCP server | `server/mcp/index.ts` → `pnpm mcp` (stdio) | AI agents calling platform tools (soft credit pull, best-execution rates, AVM) — registered for Claude Code via `.mcp.json` |
| DB scripts | `server/scripts/*` (e.g. `seedLendingGrids.ts`), `pnpm db:migrate` (`db:push` is blocked — see doc 03) | Manual/ops |
| Tests | `vitest.config.ts` (unit), `vitest.integration.config.ts` (HTTP) | `pnpm test:*` |

Key distinction in `server/app.ts`:
- **`createApp(setup)`** builds the fully-wired Express app *without* binding a
  port — exported so tests can drive the app without a socket.
- **`runApp(setup)`** calls `createApp` then `server.listen(PORT)` — this is what
  production does. `PORT` defaults to 5000 (Railway injects its own); local dev
  uses 5001.

## Request lifecycle (server)

Order matters — this is the actual middleware chain from `server/app.ts`:

1. `trust proxy` — hop count must match the real proxy chain (Railway's edge)
   or `req.ip` records the load balancer instead of the caller, which would
   poison TCPA consent and audit rows (`server/trustProxy.ts`).
2. **Helmet** — security headers. **CSP is enabled in production**, report-only
   unless `CSP_ENFORCE=true` (`server/app.ts:181-186`); it is `false` only
   outside production.
3. **Private-beta gate** (`server/middleware/betaGate.ts`) — a plain Express
   middleware (it replaced a platform edge middleware at the Railway cutover).
   A total no-op unless `BETA_ACCESS_CODE` is set, read **per request**, so
   arming/disarming it is a runtime variable change. It must stay ahead of the
   whole route surface or its `/robots.txt` Disallow-all override loses to the
   static file.
4. **Rate limiters** — general (500/15min on `/api`), auth (20/15min),
   uploads (50/15min), tracking (per-minute).
5. **Body parsing** — JSON (with `rawBody` capture) + urlencoded.
6. **CSRF check** — Origin/Referer validation for state-changing `/api`
   requests; OAuth callbacks exempt; relaxed in development.
7. **Request logging** — method/path/status/duration. 🚨 **Response bodies are
   logged ONLY for paths on an allow-list** — `/api/health`, `/api/track`,
   `/api/csp-report` (`RESPONSE_BODY_LOG_ALLOWLIST`, `server/app.ts:481-485`).
   This is not a denylist of sensitive paths, and the code says why in as many
   words: *"A denylist was the previous approach and it silently missed new PII
   routes (e.g. /api/urla/* responses contain the borrower's SSN) — do not
   revert to one."* Almost every endpoint here can carry borrower PII, so the
   safe default is status and duration only. Add a path only if its response can
   never contain personal or credential data.
8. `registerRoutes(app)` (`server/routes.ts`):
   - `GET /api/health` — DB connectivity probe: `{status, timestamp, commit}`,
     503 if the DB is down. `commit` is `RAILWAY_GIT_COMMIT_SHA` and is the
     **only** proof of what prod is actually serving (the `verify-deploy` CI job
     polls it — see [doc 10](./10-deploy-ops.md)). The probe is a bare
     `SELECT 1`, so a 200 proves *a* database answered, not the right one.
   - `assertEncryptionConfig()` — **the server refuses to boot without
     `CREDIT_ENCRYPTION_KEY` and `PII_HASH_SALT`**.
   - `setupAuth(app)` — sessions, Passport, login routes (see doc 06).
   - `seedDatabase()` — idempotent reference-data seeding on boot.
   - 39 domain route registrars (see doc 04). Four of them are *directories*
     with an `index.ts`, where the file order in that index is the Express
     matching order (`lending/`, `underwriting/`, `borrower/`, `staff/`).
   - `app.all("/api/*")` → 404 JSON — **the API exit point for unknown routes**.
9. Central error handler — any thrown/`next(err)` error becomes
   `{ message }` JSON with the right status code.
10. The `setup` step — Vite middleware (dev) or, in production,
    `serveStatic` (`server/index-prod.ts`): **bot prerender**
    — the mounted symbol is `prerenderMiddleware` (`server/routes/seo.ts:187`),
    built by `makePrerenderMiddleware` from `server/prerender.ts`; an in-process
    replacement for the platform's prerender feature — → `express.static(dist/public)` → SPA fallback to
    `index.html`. **This is why unknown non-API URLs render the React app
    instead of 404ing**, and why the same process answers both crawlers and
    humans. The prerender middleware must sit directly ahead of the static
    layer — earlier it swallows `/assets/*`, later crawlers get the raw shell.

## Exit points (every way data leaves the system)

| Exit | Mechanism | Where |
|------|-----------|-------|
| API responses | JSON over HTTPS (session cookie auth) | all `server/routes/*` |
| Emails | Nodemailer — SMTP or SendGrid if configured, **console log otherwise** | `server/services/emailService.ts` |
| PDF letters | PDFKit-generated pre-approval/pre-qualification letters | `server/services/pdfLetterGenerator.ts` |
| MISMO 3.4 XML | GSE-compliant loan export | `server/mismo.ts`, `server/services/mismoValidation.ts` |
| File downloads/uploads | GCS signed URLs (client uploads directly to the bucket) | `server/integrations/object_storage/` |
| Outbound API calls | Plaid, Anthropic (Claude), Google Maps, RapidAPI (see doc 09) | various services |
| Logs | stdout (Railway captures it — service → Deployments → logs) | `log()` in `server/app.ts` |

## The layering rule

Routes (`server/routes/*`) should stay thin: validate input (Zod), check
authorization, call **services** or **storage**, shape the response. Business
logic belongs in `server/services/*`. Database access goes through the
storage layer (`server/storage/` — see doc 03) or, in newer code, direct
Drizzle queries inside services. When you add a feature, follow the
domain-module pattern: schema in `shared/schema/<domain>.ts`, routes in
`server/routes/<domain>.ts`, page in `client/src/pages/<domain>/`.

### The 2026-07-17 monolith splits (where things live now)

The five largest server files were split into domain modules (PRs #182–#217).
The conventions, so you add code in the right place:

- **Route registrars** — `server/routes/{borrower,lending,underwriting,agent-broker}/`
  are directories of sub-registrars composed by an `index.ts` that calls them
  **in the original registration order**. Express matches routes in
  registration order, so the call sequence in `index.ts` is a correctness
  invariant — add new routes to the matching group file; add a new group only
  at the end of the chain unless you know the ordering is safe.
- **Storage** — `server/storage/` is a linear inheritance chain of domain
  classes composed into `DatabaseStorage` in its `index.ts`. `IStorage` is
  DERIVED from the class (`type IStorage = DatabaseStorage`) — add methods
  once, in the matching domain file; never re-create a hand-written interface.
- **Schema** — split schema files are FLAT siblings (`lending*.ts`,
  `underwriting*.ts`) with the old filename kept as a re-export shim, because
  the schema-migration guard readdirs `shared/schema/` non-recursively — a
  subdirectory would silently blind it.
- **Services** — `credit*.ts`, `coaching*.ts`, `extraction*.ts` families with
  the old filename as a re-export shim. Module-level mutable state shared
  across a family (the credit audit hash-chain queue, the coach/extraction
  clients) lives in a LEAF module the others import.
