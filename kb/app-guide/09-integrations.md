# 09 — External Integrations

Every third-party service the app talks to, what breaks without it, and where
the code lives.

| Integration | Purpose | Env vars | Code | Without it |
|-------------|---------|----------|------|------------|
| **Neon** (Postgres) | Production database | `DATABASE_URL` | `server/db.ts` | App won't function (health check 503s) |
| **Plaid** | Income, employment, identity, asset verification | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | `server/plaid.ts`, `services/verification.ts`, client `react-plaid-link` | Verification features disabled; manual documents only |
| **Google Gemini** | Document OCR/data extraction (paystubs, W-2s, bank statements, tax returns) | `GEMINI_API_KEY` | `server/gemini.ts`, `extractionService.ts` | Uploads still work; no auto-extraction |
| **OpenAI** | AI Homebuyer Coach | `AI_INTEGRATIONS_OPENAI_API_KEY` (+ optional `..._BASE_URL`) | `services/coachingService.ts` | Coach chat unavailable |
| **AI Gateway** | Optional provider switch (Gemini ⇄ Claude) | `AI_GATEWAY_PROVIDER`, `ANTHROPIC_API_KEY`, model overrides | `services/aiGateway.ts` | Defaults to Gemini |
| **Google Cloud Storage** | Document/file storage via signed URLs | `GCS_SERVICE_ACCOUNT_KEY`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | `server/replit_integrations/object_storage/` | Document upload/download broken |
| **Google Maps Platform** | Address autocomplete, geocoding, address validation, maps, street view | `GOOGLE_MAPS_API_KEY` | `server/routes/geocode.ts`; client `AddressInput`, `PropertyMap`, `StreetView` | Manual address entry; no maps |
| **RapidAPI (Realty)** | Property listings search + live market rates | `RAPIDAPI_KEY` | `server/routes/listings.ts`, `services/rateService.ts` | Listings/live-rate features degrade (rates fall back to DB) |
| **Email (SMTP / SendGrid)** | Notifications, invites | `SMTP_*` or `SENDGRID_API_KEY`, `FROM_EMAIL`, `FROM_NAME` | `services/emailService.ts` | Emails print to server console (current state) |
| **Social OAuth** | Google / LinkedIn / Apple sign-in | provider client ids/secrets, `APPLE_*` | `server/socialAuth.ts` | Email/password login only |
| **Vercel** | Hosting: CDN for client, serverless for API | (dashboard env vars) | `vercel.json`, `api/index.ts` | See [10-deploy-ops.md](10-deploy-ops.md) |
| **Replit** (legacy) | Former host: OIDC login + storage sidecar, only active when `REPL_ID` is set | `REPL_*`, `REPLIT_*` | `server/replit_integrations/auth/` | Nothing — being migrated away from |

## Integration patterns to follow

- **Server-side proxying for keys**: the client never holds API keys. E.g.
  Maps calls go through `/api/geocode/*`; the browser gets a restricted maps
  key via `/api/config/maps-key`.
- **Graceful degradation**: services check for their env vars and log a
  warning instead of crashing (email is the model example). Follow this when
  adding integrations.
- **Direct-to-storage uploads**: files go browser → GCS with a short-lived
  signed URL; the API only issues URLs and records metadata. Don't route file
  bytes through Express.
- **Roadmap integrations** (from the AI-brokerage plan, not yet built):
  soft-pull credit bureau API, Optimal Blue pricing, Fannie DU / Freddie LPA
  submission, lead-aggregator webhooks (Zillow/LendingTree), Twilio/ElevenLabs
  voice. See the session notes / PRODUCT_SPINE for context.
