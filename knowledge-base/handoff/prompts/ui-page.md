# Loop template: UI page or component

> **Freshness:** last verified 2026-08-22 · review every 30 days

Read `_RAILS.md` now, and again at the top of every iteration. Then read `$SCRATCH/loop-log.md`
if it exists; append to it before each iteration ends.

```
TASK:   <one sentence: the page/component, the persona, the route, the gate, the data it shows>
WRITE:  client/src/pages/<persona>/<Name>.tsx  (or client/src/components/<dir>/<Name>.tsx)
        client/src/App.tsx                      (one lazy Route in the right Switch position, wrapped in the layout + gate)
        client/src/lib/queryClient.ts           (ONLY if a new key factory is needed — add, never rewrite)
        shared/seo/routeMeta.ts                 (public pages only: the entry that mirrors the page's SEOHead)
        client/src/<dir>/<Name>.test.tsx        (colocated; runs under the client glob)
NEVER:  raw palette classes (bg-blue-500 …), bg-white/text-white literals, direct lucide-react
        imports (use client/src/lib/icons.ts), min-h-screen outside PageShell, a hand-written
        queryFn, an interpolated queryKey, package.json, hand-back files
PROOF:  the colocated test renders the page with a mocked query and asserts the visible text and
        the gate behaviour; `node scripts/browser-probe.cjs` output at 320 px pasted
MAX_ITER: 8
```

## Iteration procedure

0. **T-1** + claim.
1. Read `knowledge-base/handbook/design/DESIGN_SYSTEM.md` §0 (the measured adoption table) and
   copy the nearest sibling page's structure: `PageShell` geometry, tokens from
   `client/src/index.css`, Shadcn primitives from `client/src/components/ui/`, `<Button asChild>`
   for link-buttons, `data-testid` in kebab-case on every interactive element, `aria-label` on
   icon-only controls, ≥ 44 px touch targets.
2. Data: `useQuery({ queryKey: <factory>(...) })` with the default `queryFn`; public pages use
   `getPublicQueryFn`. Invalidate with the same factory prefix — `partialMatchKey` compares
   arrays element by element, so a hand-written key never matches.
3. Auth: `useAuthGuard` drives loading / degraded / unauthenticated / forbidden / authorized; the
   degraded state must not navigate (a 502 mid-form would lose the form).
4. Route: a `lazy(() => import(...))` `Route` in `client/src/App.tsx` in the correct `Switch`
   position (first match wins), inside the layout shell, wrapped by the gate from
   `client/src/lib/routeGates.ts` (a UX affordance — the server route is the boundary). Public
   pages add a `shared/seo/routeMeta.ts` entry identical to the page's `SEOHead` copy, with no
   Reg Z trigger terms and no approval language.
5. Test colocated; run **only** with `pnpm test:client` (or `pnpm test`) — never
   `vitest run <file>` without the client config.
6. **T0** (`pnpm guard:tokens`, `pnpm guard:ui`, `pnpm guard:querykeys` are the ones that bite)
   → **T1** → commit → **T2** → **T4**: `PORT=5002 pnpm dev` in the worktree, then
   `node scripts/browser-probe.cjs --url http://localhost:5002/<route> --width 320` (and 768,
   1280); paste the output. A tightened baseline is staged and named.
7. Territory check; push; PR body from `_REPORT_FORMAT.md`. Five failed rounds →
   `STATUS: STOPPED(attempt-cap)`.

## What this loop must not do

Import `@shared/schema` by value (it drags every table into the bundle —
`tests/clientSchemaImports.test.ts`) · raise a UI baseline · add a route without its gate · use
`preview_start {name}` · promise an outcome the product disclaims (Reg N / Reg Z — the
`seo-content` skill).

Finish with the LOOP REPORT, then the promise.
