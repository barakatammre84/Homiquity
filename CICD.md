# Deploy & Revert

Homiquity ships with a deliberately simple flow: **push to `main` → Vercel
deploys it. If it breaks, revert.** No approvals.

```
  git push (main)  ──▶  Vercel builds & deploys automatically
        │                     │
        ▼            broken?  ▼
  GitHub Actions    Vercel → Deployments → previous one → Promote  (instant)
  (ci: typecheck,
   tests, build,
   lockfile parity)
```

CI (`.github/workflows/ci.yml`) runs on every PR and every push to `main`:
typecheck, unit tests, production build, and a lockfile-parity check. Today it
is **non-blocking on main** — a red run emails you but the deploy still goes
out. To make it a hard gate later: GitHub → Settings → Branches → protect
`main`, require the `ci` check (this also blocks direct pushes, so `npm run
save` would move to a PR flow).

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
- **Database** → schema changes ship as versioned migration files
  (`migrations/`, `npm run db:generate` + `npm run db:migrate` — see
  [ROLLBACK.md](ROLLBACK.md) §3). Still snapshot/branch in Neon before
  destructive schema changes; migrations have no automatic "down".

## How the Vercel deploy works

- `vercel.json` — install is `pnpm install --frozen-lockfile --prod=false`,
  build is `npm run vercel-build` (= `vite build` **plus** an esbuild bundle of
  the server into `api/_app.mjs`) → static client from `dist/public`; rewrites
  send `/api/*` to the serverless function `api/index.ts`, everything else
  falls back to the SPA `index.html`.
- **The function imports the pre-bundled `api/_app.mjs`, never the raw TS
  server graph.** Server code uses the `@shared/*` tsconfig alias, which
  Vercel's file tracer/Node runtime can't resolve (this produced opaque
  `FUNCTION_INVOCATION_FAILED` crashes); esbuild resolves the alias at build
  time. The handler imports the bundle *dynamically* so any bootstrap failure
  returns a readable `bootError` JSON instead of an opaque crash. Two more
  serverless rules learned the hard way: never construct SDK clients at module
  load (the OpenAI client throws without a key — build them lazily), and never
  write to the filesystem at module load (only the OS temp dir is writable).
- **Why pnpm on Vercel (do not switch back to npm casually):** npm crashed
  mid-install on Vercel's build image with "Exit handler never called" on
  Node 20, 22 AND 24 (reproduced four deploys in a row), while the identical
  install works locally. pnpm sidesteps npm entirely. `--prod=false` is
  required because Vercel sets `NODE_ENV=production`, which makes pnpm skip
  devDependencies — and vite (a devDependency) is needed to build.
- **Two lockfiles now exist.** Local dev can keep using npm
  (`package-lock.json`); Vercel uses `pnpm-lock.yaml` (generated via
  `pnpm import`, so versions match npm's exactly). **After any dependency
  change, run `npx pnpm@10 import` and commit both lockfiles together.**
- `engines.node: 24.x`; `.npmrc` disables audit/fund noise.
- Env vars (Vercel → Settings → Environment Variables): `DATABASE_URL` (Neon,
  non-localhost), `SESSION_SECRET`, `CREDIT_ENCRYPTION_KEY`, `PII_HASH_SALT`,
  `NODE_ENV=production`, plus optional `GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`,
  `OPENAI_API_KEY`, and for document storage `GCS_SERVICE_ACCOUNT_KEY`,
  `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS` (see `.env.example`).

Persistent hosts (Fly, a VPS) still work unchanged: `npm run build` +
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
