# Infrastructure Readiness Report

Generated: February 16, 2026
Runtime: Node.js v20.20.0 | Express.js | PostgreSQL (Neon) | Replit Deployment

---

## RISK 1: Encryption Fallback Uses Weak Derived Key in Production

**File:** `server/services/encryptionService.ts` lines 8-24
**Severity:** CRITICAL

**Problem:** When `CREDIT_ENCRYPTION_KEY` is not set, encryption falls back to deriving a key from `SESSION_SECRET` with a hardcoded salt `"credit-encryption-salt"`. This means:
- The encryption key is derivable from the session secret (single point of compromise)
- The salt is static and committed to source code
- If `SESSION_SECRET` is also missing, it falls back to `"default-dev-key"` — effectively no encryption

```typescript
// Current behavior when CREDIT_ENCRYPTION_KEY is missing:
const derivedKey = crypto.scryptSync(
  process.env.SESSION_SECRET || "default-dev-key",  // <-- weak fallback
  "credit-encryption-salt",                          // <-- hardcoded salt
  KEY_LENGTH
);
```

**Fix:** Validate at startup that `CREDIT_ENCRYPTION_KEY` exists in production. No logic change needed — add a startup guard:

```typescript
// In server/app.ts or server/db.ts startup path:
if (process.env.NODE_ENV === 'production' && !process.env.CREDIT_ENCRYPTION_KEY) {
  console.error("CRITICAL: CREDIT_ENCRYPTION_KEY must be set in production for PII encryption");
}
```

**Minimal action:** Set the `CREDIT_ENCRYPTION_KEY` secret (32 bytes, base64-encoded).

---

## RISK 2: PII Hash Salt Uses Hardcoded Fallback

**File:** `server/services/encryptionService.ts` line 160
**Severity:** HIGH

**Problem:** `hashPII()` falls back to `"mortgage-pii-salt"` when `PII_HASH_SALT` is not set. This hardcoded salt is committed to source code, making PII hashes predictable (rainbow-table vulnerable).

```typescript
const salt = process.env.PII_HASH_SALT || "mortgage-pii-salt";  // <-- hardcoded fallback
```

**Fix:** Set the `PII_HASH_SALT` secret to a cryptographically random value.

---

## RISK 3: Session Store Requires Pre-existing Table

**File:** `server/replit_integrations/auth/replitAuth.ts` line 26
**Severity:** LOW (currently mitigated)

**Problem:** `createTableIfMissing: false` means the session store will fail if the `sessions` table doesn't exist. The table IS defined in the schema (`shared/schema/core.ts` line 79-87) and IS present in the current database (verified). However, if `db:push` hasn't been run against a fresh database, the application will crash on startup.

**Current state:** Table exists (verified via SQL query). No fix needed unless deploying to a new database.

**Fix for fresh deployments:** Run `npm run db:push` before first `npm start`.

---

## RISK 4: No JSON Body Size Limit

**File:** `server/app.ts` line 89
**Severity:** MEDIUM

**Problem:** `express.json()` is configured without a `limit` parameter. Express defaults to `100kb`, which is reasonable, but the application handles document metadata, URLA form data, and complex underwriting payloads that could be larger. More importantly, there's no explicit limit on `express.urlencoded()` either.

```typescript
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));  // <-- no limit
```

**Current state:** Express default of 100kb applies implicitly. This is fine for most endpoints but may reject large URLA submissions or document metadata payloads silently.

**Fix:** Add explicit limit that matches expected payload sizes:
```typescript
app.use(express.json({ limit: '2mb', verify: ... }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
```

---

## RISK 5: Object Storage Depends on Sidecar Service

**File:** `server/replit_integrations/object_storage/objectStorage.ts` line 13
**Severity:** LOW (platform-managed)

**Problem:** Object storage connects via `http://127.0.0.1:1106` (Replit sidecar). This is only available in the Replit runtime environment. If the sidecar is down or unreachable, all document upload/download operations will fail with connection errors.

**Current state:** `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`, and `DEFAULT_OBJECT_STORAGE_BUCKET_ID` are all set as secrets. The sidecar is managed by the Replit platform and should be available in both dev and production.

**Fix:** No code change needed. This is inherent to the Replit object storage architecture. Document upload failures are already caught with try/catch in `server/routes/documents.ts`.

---

## RISK 6: SMTP Not Configured — All Emails Silently Logged

**File:** `server/services/emailService.ts` lines 12-29
**Severity:** MEDIUM (feature degradation, not crash)

**Problem:** When `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are not set, all emails (pre-approval notifications, consent confirmations, task alerts) are logged to console instead of delivered. The application correctly logs `"[Email] SMTP not configured"` at startup.

**Current state:** Startup log confirms: `[Email] SMTP not configured — emails will be logged to console`

**Fix:** Set SMTP secrets. No code change needed — the graceful fallback is already implemented.

---

## RISK 7: Plaid Client Initialized with Undefined Credentials

**File:** `server/plaid.ts` lines 1-17
**Severity:** MEDIUM (silent misconfiguration)

**Problem:** The Plaid `Configuration` object is created at module load time with `PLAID_CLIENT_ID` and `PLAID_SECRET` as header values — even when they're `undefined`. This means the Plaid client object exists but will fail at runtime when called. The `isPlaidConfigured()` guard function exists and is checked before each API call, so this won't crash, but the client is initialized with invalid headers.

```typescript
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;   // undefined
const PLAID_SECRET = process.env.PLAID_SECRET;           // undefined
const configuration = new Configuration({
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": PLAID_CLIENT_ID,    // undefined in headers
      "PLAID-SECRET": PLAID_SECRET,           // undefined in headers
    },
  },
});
export const plaidClient = new PlaidApi(configuration);  // client exists but misconfigured
```

**Current state:** Guarded by `isPlaidConfigured()` before every call. No crash risk.

**Fix:** Set `PLAID_CLIENT_ID` and `PLAID_SECRET` secrets when Plaid verification is needed. No code change required.

---

## RISK 8: Production Detection Uses Two Different Mechanisms

**File:** `server/auth.ts` line 35, `server/app.ts` line 114
**Severity:** LOW

**Problem:** Two different environment variables are used to detect production:
- `auth.ts` uses `!!process.env.REPL_DEPLOYMENT` (Replit deployment flag)
- `app.ts` CSRF middleware uses `process.env.NODE_ENV === 'development'`

These are set by different mechanisms:
- `REPL_DEPLOYMENT` is set by Replit's deployment infrastructure
- `NODE_ENV` is set by the start script (`NODE_ENV=production` in `npm start`, `NODE_ENV=development` in `npm run dev`)

Both should align in practice, but if there's a mismatch (e.g., manual run with wrong NODE_ENV), the test login could be exposed while CSRF is enforced, or vice versa.

**Current state:** The `npm start` script sets `NODE_ENV=production` and Replit sets `REPL_DEPLOYMENT`. Both should be present in production. Low risk.

**Fix:** No code change needed. Ensure the build/start pipeline uses `npm start` which sets `NODE_ENV=production`.

---

## RISK 9: Gemini API Key Has Two Environment Variable Names

**File:** `server/gemini.ts` line 3
**Severity:** LOW

**Problem:** The Gemini client checks two environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY || GEMINI_API_KEY`. If neither is set, `genAI` is `null` and all AI analysis falls back to deterministic calculations.

```typescript
const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;
```

**Current state:** `AI_INTEGRATIONS_GEMINI_API_KEY` is set (verified in secrets). Fallback is implemented. No risk.

**Fix:** None needed. The dual-variable pattern is defensive and correct.

---

## RISK 10: Health Check Doesn't Verify Database Connectivity

**File:** `server/routes.ts` line 24-26
**Severity:** LOW

**Problem:** The health check returns `{ status: "ok" }` without verifying the database is reachable. This means the deployment health check could pass while the database is down, leading to 500 errors on actual API calls.

```typescript
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

**Fix:** Add a database ping to the health check (optional enhancement, not a blocker):
```typescript
app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", db: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", db: "disconnected", timestamp: new Date().toISOString() });
  }
});
```

---

## RISK 11: Seed Data Runs on Every Startup

**File:** `server/routes.ts` line 29
**Severity:** LOW

**Problem:** `await seedDatabase()` runs on every server start. The seed function is idempotent (checks for existing data with `SELECT ... LIMIT 1` before inserting), so it won't duplicate data. However, it adds unnecessary database queries on every cold start in production.

**Current state:** Safe — the idempotency checks prevent duplicate data. The overhead is ~5 SELECT queries on startup.

**Fix:** None needed. The idempotency pattern is correct.

---

## RISK 12: RapidAPI Rate Service Has No Fallback Data

**File:** `server/services/rateService.ts` line 54-56
**Severity:** LOW

**Problem:** When `RAPIDAPI_KEY` is not set, the rate service logs a message and returns empty results. The frontend gracefully handles this with static rate display data.

**Current state:** Startup log shows no error. Routes that call `refreshRates()` handle the empty response. No crash risk.

**Fix:** Set `RAPIDAPI_KEY` secret when live rate data is desired. No code change needed.

---

## VERIFICATION SUMMARY

### Startup Sequence (Verified Working)
1. `db.ts` — validates `DATABASE_URL`, creates Pool + Drizzle client
2. `app.ts` — creates Express app, configures Helmet, rate limiters, CSRF, body parser, request logging
3. `routes.ts` — registers health check, sets up OIDC auth, runs seed, registers all 15 route modules, sets up 404 catch-all
4. `app.ts` — registers global error handler, starts HTTP server on port 5000 (from `PORT` env var)

### Port Configuration
| Port | Usage | Status |
|------|-------|--------|
| 5000 | Express (API + frontend) | Correct — bound to `0.0.0.0:5000` |
| 1106 | Replit sidecar (object storage) | Platform-managed, not configurable |

### Database State (Verified)
- 130+ tables present in `public` schema
- `sessions` table exists (required for `connect-pg-simple` with `createTableIfMissing: false`)
- All schema tables verified present via SQL query

### External API Connectivity
| Service | Env Var | Status | Fallback |
|---------|---------|--------|----------|
| PostgreSQL (Neon) | `DATABASE_URL` | Connected | None (hard requirement) |
| Replit OIDC | `ISSUER_URL` / `REPL_ID` | Configured | None (hard requirement) |
| Object Storage | `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Configured | None for uploads |
| OpenAI | `AI_INTEGRATIONS_OPENAI_API_KEY` | Configured | None for coach |
| Gemini | `AI_INTEGRATIONS_GEMINI_API_KEY` | Configured | Deterministic fallback |
| SMTP | `SMTP_HOST` etc. | NOT configured | Console logging |
| Plaid | `PLAID_CLIENT_ID` etc. | NOT configured | `isPlaidConfigured()` guard |
| RapidAPI | `RAPIDAPI_KEY` | NOT configured | Empty results |

### Background Jobs
- None required. All processing is request-driven.
- Seed database runs once on startup (idempotent).
- No cron jobs, no worker processes, no message queues.

### Session Configuration (Verified Safe)
- `httpOnly: true` — prevents XSS access to session cookie
- `secure: true` — cookie sent only over HTTPS
- `sameSite: "lax"` — CSRF protection for cross-site requests
- `maxAge: 7 days` — session expiration
- Store: PostgreSQL via `connect-pg-simple` (durable across restarts)

---

## PRIORITIZED ACTION ITEMS

| Priority | Risk | Action | Type |
|----------|------|--------|------|
| P0 | #1 | Set `CREDIT_ENCRYPTION_KEY` (32 bytes base64) | Set secret |
| P0 | #2 | Set `PII_HASH_SALT` (random string) | Set secret |
| P1 | #6 | Set SMTP credentials for email delivery | Set secrets |
| P2 | #4 | Add explicit body parser size limit | Code change (1 line) |
| P2 | #10 | Add DB check to health endpoint | Code change (5 lines) |
| P3 | #7 | Set Plaid credentials when needed | Set secrets |
| P3 | #12 | Set RapidAPI key when needed | Set secret |
| — | #3, #5, #8, #9, #11 | No action required | Already mitigated |
