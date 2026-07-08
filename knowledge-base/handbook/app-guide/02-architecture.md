# 02 — Architecture, Entry & Exit Points

## Big picture

One repository, one Express server, one React SPA, one Postgres database.
The server serves both the API (`/api/*`) and, in production-on-a-VM mode, the
built client. On Vercel, the client is served by the CDN and only `/api/*`
hits the server (as a serverless function).

```
                 ┌────────────────────────────────────────────┐
                 │                 client/  (React SPA)         │
                 │  Wouter routes · TanStack Query · Shadcn UI  │
                 └───────────────────┬────────────────────────┘
                                     │ fetch /api/*  (session cookie)
                                     ▼
┌─────────────────────────────── server/ ────────────────────────────────┐
│ app.ts        — express app: helmet, rate limits, CSRF, logging          │
│ routes.ts     — registerRoutes(): health, auth, seeding, 22 route domains │
│ routes/*.ts   — HTTP handlers per domain (borrower, lending, admin, …)    │
│ services/*.ts — business logic (underwriting, pricing, borrower graph, …) │
│ storage.ts    — the data-access layer (IStorage, ~4,700 lines)            │
│ db.ts         — Drizzle + driver selection (Neon serverless vs local pg)  │
└───────────────────┬──────────────────────────────┬─────────────────────┘
                    ▼                              ▼
             PostgreSQL (Drizzle)          External services
             168 tables, 17 files          (Plaid, Gemini, OpenAI, GCS,
             shared/schema/*               Google Maps, RapidAPI, SMTP)
```

## Entry points (every way execution starts)

| Entry | File | Used when |
|-------|------|-----------|
| Dev server | `server/index-dev.ts` → `runApp(setupVite)` | `npm run dev` — Vite runs as Express middleware, HMR for client |
| Prod server (persistent) | `server/index-prod.ts` → `runApp(serveStatic)` | `npm start` on a VM/Fly — serves `dist/public` statically |
| Vercel serverless | `api/index.ts` → `createApp(noop)` | Every `/api/*` request on Vercel; client is served by the CDN, not Express |
| Client | `client/index.html` → `client/src/main.tsx` → `App.tsx` | The SPA — all browser routes |
| MCP server | `server/mcp/index.ts` → `npm run mcp` (stdio) | AI agents calling platform tools (soft credit pull, best-execution rates, AVM) — registered for Claude Code via `.mcp.json` |
| DB scripts | `server/scripts/*` (e.g. `seedLendingGrids.ts`), `drizzle-kit push` | Manual/ops |
| Tests | `vitest.config.ts` (unit), `vitest.integration.config.ts` (HTTP) | `npm run test:*` |

Key distinction in `server/app.ts`:
- **`createApp(setup)`** builds the fully-wired Express app *without* binding a
  port (what Vercel uses).
- **`runApp(setup)`** calls `createApp` then `server.listen(PORT)` (what
  persistent hosts use). `PORT` defaults to 5000; local dev uses 5001.

## Request lifecycle (server)

Order matters — this is the actual middleware chain from `server/app.ts`:

1. `trust proxy` — required for correct IPs behind Vercel/proxies.
2. **Helmet** — security headers (CSP disabled, see threat model).
3. **Rate limiters** — general (500/15min on `/api`), auth (20/15min),
   uploads (50/15min), tracking (per-minute).
4. **Body parsing** — JSON (with `rawBody` capture) + urlencoded.
5. **CSRF check** — Origin/Referer validation for state-changing `/api`
   requests; OAuth callbacks exempt; relaxed in development.
6. **Request logging** — method/path/status/duration; response bodies for
   sensitive paths (documents, auth, staff invites) are suppressed from logs.
7. `registerRoutes(app)` (`server/routes.ts`):
   - `GET /api/health` — DB connectivity probe (returns 503 if DB down).
   - `assertEncryptionConfig()` — **the server refuses to boot without
     `CREDIT_ENCRYPTION_KEY` and `PII_HASH_SALT`**.
   - `setupAuth(app)` — sessions, Passport, login routes (see doc 06).
   - `seedDatabase()` — idempotent reference-data seeding on boot.
   - 22 domain route registrars (see doc 04).
   - `app.all("/api/*")` → 404 JSON — **the API exit point for unknown routes**.
8. Central error handler — any thrown/`next(err)` error becomes
   `{ message }` JSON with the right status code.
9. The `setup` step — Vite middleware (dev) or static file serving (prod VM),
   with SPA fallback to `index.html`. **This is why unknown non-API URLs render
   the React app instead of 404ing.**

## Exit points (every way data leaves the system)

| Exit | Mechanism | Where |
|------|-----------|-------|
| API responses | JSON over HTTPS (session cookie auth) | all `server/routes/*` |
| Emails | Nodemailer — SMTP or SendGrid if configured, **console log otherwise** | `server/services/emailService.ts` |
| PDF letters | PDFKit-generated pre-approval/pre-qualification letters | `server/services/pdfLetterGenerator.ts` |
| MISMO 3.4 XML | GSE-compliant loan export | `server/mismo.ts`, `server/services/mismoValidation.ts` |
| File downloads/uploads | GCS signed URLs (client uploads directly to the bucket) | `server/integrations/object_storage/` |
| Outbound API calls | Plaid, Gemini, OpenAI, Google Maps, RapidAPI (see doc 09) | various services |
| Logs | stdout (Vercel/host log drain picks them up) | `log()` in `server/app.ts` |

## The layering rule

Routes (`server/routes/*`) should stay thin: validate input (Zod), check
authorization, call **services** or **storage**, shape the response. Business
logic belongs in `server/services/*`. Database access goes through
`server/storage.ts` (a single `IStorage` implementation) or, in newer code,
direct Drizzle queries inside services. When you add a feature, follow the
domain-module pattern: schema in `shared/schema/<domain>.ts`, routes in
`server/routes/<domain>.ts`, page in `client/src/pages/<domain>/`.
