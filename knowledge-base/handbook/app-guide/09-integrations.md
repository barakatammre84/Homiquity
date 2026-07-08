# 09 — External Integrations

Every third-party service the app talks to, what breaks without it, and where
the code lives.

| Integration | Purpose | Env vars | Code | Without it |
|-------------|---------|----------|------|------------|
| **Neon** (Postgres) | Production database | `DATABASE_URL` | `server/db.ts` | App won't function (health check 503s) |
| **Plaid** | Income, employment, identity, asset verification | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | `server/plaid.ts`, `services/verification.ts`, client `react-plaid-link` | Verification features disabled; manual documents only |
| **Google Gemini** | Document OCR/data extraction (paystubs, W-2s, bank statements, tax returns) | `GEMINI_API_KEY` | `server/extractionService.ts` | Uploads still work; no auto-extraction |
| **OpenAI** | AI Homebuyer Coach | `AI_INTEGRATIONS_OPENAI_API_KEY` (+ optional `..._BASE_URL`) | `services/coachingService.ts` | Coach chat unavailable |
| **AI Gateway** | Optional provider switch (Gemini ⇄ Claude) | `AI_GATEWAY_PROVIDER`, `ANTHROPIC_API_KEY`, model overrides | `services/aiGateway.ts` | Defaults to Gemini |
| **Google Cloud Storage** | Document/file storage via signed URLs | `GCS_SERVICE_ACCOUNT_KEY`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` | `server/integrations/object_storage/` | Document upload/download broken |
| **Google Maps Platform** | Address autocomplete, geocoding, address validation, maps, street view | `GOOGLE_MAPS_API_KEY` | `server/routes/geocode.ts`; client `AddressInput`, `PropertyMap`, `StreetView` | Manual address entry; no maps |
| **RapidAPI (Realty)** | Property listings search + live market rates | `RAPIDAPI_KEY` | `server/routes/listings.ts`, `services/rateService.ts` | Listings/live-rate features degrade (rates fall back to DB) |
| **CFPB HMDA + Fannie Mae (public data)** | Competitor rate benchmarks + historical default/prepay rates | none (public APIs / bulk files) | `server/services/hmdaIngestService.ts`, `services/competitorRateService.ts`, `npm run data:hmda` / `data:fannie` — see [kb/FREE_DATA_MOAT.md](../../specs/FREE_DATA_MOAT.md) | Market-data endpoints return 404 until ingested |
| **Email (SMTP / SendGrid)** | Notifications, invites | `SMTP_*` or `SENDGRID_API_KEY`, `FROM_EMAIL`, `FROM_NAME` | `services/emailService.ts` | Emails print to server console (current state) |
| **Social OAuth** | Google / LinkedIn / Apple sign-in | provider client ids/secrets, `APPLE_*` | `server/socialAuth.ts` | Email/password login only |
| **Vercel** | Hosting: CDN for client, serverless for API | (dashboard env vars) | `vercel.json`, `api/index.ts` | See [10-deploy-ops.md](./10-deploy-ops.md) |
| **MCP server** (ours) | Exposes platform engines as AI-agent tools over stdio: `run_soft_credit_pull` (FCRA-gated, cached), `get_best_execution_rates` (rate sheets + LLPA + layered margins), `retrieve_property_valuation` (AVM → properties) | `CRS_API_KEY`, `HOUSECANARY_API_KEY` (simulated until set), `PRICING_MARGIN_BASE_BPS`, `MCP_VENDOR_TIMEOUT_MS` | `server/mcp/`, `.mcp.json`, `npm run mcp` | n/a — it's an entry point, not a dependency |

> Replit (the app's former host) was fully removed on 2026-07-02 — no Replit
> code, config, or env vars remain.

## Wholesale market pricing (vendor-ready, sample-fed today)

Borrower-facing live pricing (`GET /api/loan-applications/:id/offers`, rendered
on LoanOptions as "Live Market Pricing") is computed per request by
`services/pricingAdapter.ts` from four tables: `wholesale_lenders`,
`rate_sheets` (date-windowed, `status=ACTIVE`), `rate_sheet_products`
(base rate + lock-term grid + eligibility box), and
`lender_pricing_adjustments` (overlays). `server/seedMarketPricing.ts` seeds
three fictional lenders with 90-day demo sheets on first boot (guarded on
lender code `SWL`).

**Onboarding a real pricing vendor = loading these same tables** — via
`POST /api/rate-sheets` + `POST /api/rate-sheets/:id/products/bulk`, or a feed
job writing through `storage.ts`. No UI or pricing-code changes needed:
borrowers reprice automatically on next request. Expired sheets silently stop
pricing, so daily feeds keep pricing fresh by construction. Pricing is labeled
**Indicative** until the borrower's profile is verification-grade
(`shared/dataProvenance.ts`); rate locking stays gated on verification.

The **advertised rates** (landing page + `/rates` pages, `mortgage_rates`
table) are also fed from the sheets: `rateService.syncBestExecutionRates()`
writes the lowest executable rate per program (priced at a disclosed 780
FICO / 70% LTV marketing profile) on every boot and after every
`POST /api/admin/mortgage-rates/refresh`, overriding the RapidAPI survey
rates for the programs the sheets cover — we only advertise what the desk
can execute.

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

## Pre-flight checklist — vendor & GSE delivery changes

1. Vendor calls live **only** inside their adapter, and everything stays a
   deterministic simulation until a real contract exists — converting a row is
   a roadmap ticket ([ASSUMPTIONS.md](../../governance/ASSUMPTIONS.md) §1).
2. Anything touching MISMO/ULDD/UCD/delivery: consult
   [`docs/fannie-mae/`](../../../docs/fannie-mae/) plus the official Loan Delivery
   job aid first, and **never invent MISMO names**
   ([CLAUDE.md](../../../CLAUDE.md) compliance-first rules).
3. If the MISMO export shape changes, validate against the in-repo schemas and
   golden samples (`docs/fannie-mae/schemas/` — ULDD Phase 5 extension XSD,
   UCD v2 + samples).
4. New env vars for an integration land in `.env.example` **and** CICD.md's
   Vercel list in the same PR ([TEAM_PRACTICES](../../governance/TEAM_PRACTICES.md) §5.7).
