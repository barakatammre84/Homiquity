# Deploy & Revert

Homiquity ships with a deliberately simple flow: **push to `main` → Vercel
deploys it. If it breaks, revert.** No CI gates, no approvals.

```
  git push (main)  ──▶  Vercel builds & deploys automatically
                              │
                     broken?  ▼
                    Vercel → Deployments → previous one → Promote  (instant)
```

## Shipping

```bash
npm run save        # commit everything with a timestamp + pull + push
# or, if you've already committed:
npm run sync        # pull + push
```

Every push to `main` triggers a production deploy on Vercel. Every PR branch
gets its own preview deployment automatically.

## Reverting

Full detail in [ROLLBACK.md](ROLLBACK.md). Short version:

- **Prod is broken right now** → Vercel dashboard → Deployments → pick the last
  good one → **Promote to Production**. Instant, no rebuild.
- **Undo the bad code** → `git revert <sha> && git push` (never
  `reset --hard` + force-push).
- **Database** → `drizzle-kit push` is forward-only; snapshot/branch in Neon
  before destructive schema changes.

## How the Vercel deploy works

- `vercel.json` — `npm ci` install, `npm run vercel-build` (= `vite build`) →
  static client from `dist/public`; rewrites send `/api/*` to the Express app
  running as a serverless function (`api/index.ts`, built via `createApp()` in
  `server/app.ts`), everything else falls back to the SPA `index.html`.
- `engines.node: 20.x` in `package.json` pins the Vercel build/runtime to
  Node 20. **Do not raise this without testing a deploy**: on Vercel's build
  image, the npm bundled with Node 22.x and 24.x crashes during install with
  "Exit handler never called" (npm/cli#8974); Node 20's npm installs cleanly.
  Local dev on Node 24 still works — npm just prints a harmless EBADENGINE
  warning. `.npmrc` disables audit/fund to keep installs deterministic.
- Env vars (Vercel → Settings → Environment Variables): `DATABASE_URL` (Neon,
  non-localhost), `SESSION_SECRET`, `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`,
  `NODE_ENV=production`, plus optional `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`,
  `OPENAI_API_KEY`, and for document storage `GCS_SERVICE_ACCOUNT_KEY`,
  `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` (see `.env.example`).

Persistent hosts (Replit, Fly, a VPS) still work unchanged: `npm run build` +
`npm start`.

## Optional checks (run manually, nothing enforces them)

```bash
npm run check              # typecheck
npm run test:unit          # pure logic tests (no server needed)
TEST_BASE_URL=http://127.0.0.1:5001 npm run test:integration   # against a running dev server
```

If you later want gates again (block bad pushes before they deploy), add a
GitHub Actions workflow that runs the commands above and enable branch
protection — but that's a deliberate future choice, not the current setup.
