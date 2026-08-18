# 07 — Frontend

## Stack

React 18 + TypeScript, built by **Vite**. Routing is **Wouter** (a tiny
react-router alternative — `<Route path>` components, `useLocation`,
`navigate`). Server state is **TanStack Query** (all API reads/writes go
through `queryClient`); forms are **react-hook-form + Zod** (sharing the same
schemas the server validates with, from `shared/`). UI is **Shadcn/ui** on
Radix primitives + Tailwind, with light/dark themes (`next-themes`).

Entry chain: `client/index.html` → `client/src/main.tsx` →
[`client/src/App.tsx`](../../../client/src/App.tsx) (~420 lines: providers, layout,
and every route — 160+ `<Route>`s).

## Page map (`client/src/pages/`)

| Directory | Pages | Audience / purpose |
|-----------|------:|--------------------|
| `public/` | 14 | Logged-out: landing, persona landing pages (`/refinance` — savings calculator; `/va-loans` — military pre-screen → `/apply?type=va`; `/self-employed` — income-shape pre-screen → `/apply?type=self-employed`; `/first-time-buyer` — rent-reframe calculator → `/apply?type=first-time`; all wordmark-only, no global nav), affordability check ("Can I Afford This Home?"), find-an-agent, auth pages |
| `borrower/` | 15 | The borrower portal: dashboard, conversational pre-approval, URLA form, documents, letters, predictions |
| `staff/` | 8 | Staff Dashboard (unified command center: pipeline, tasks, compliance, intelligence), LO Command Center (`/lo-command-center`: deal-team-scoped pipeline with the green/yellow/red File Health light and one-click MISMO export), loan pipeline, document review |
| `admin/` | 5 | Admin panel: users, policy ops, system config |
| `agent-broker/` | 13 | Agent/broker portal: referrals, deals, partner landing |
| `realtor-engine/` | 5 | Agent enablement & revenue tools |
| `lending/` | 7 | Loan-detail views, rate locks, letters |
| `property/` | 5 | Property search, detail (maps/street view), saved properties |
| `rates/` | 7 | Rate display & comparison |
| `calculators/` | 5 | Mortgage/affordability/refinance calculators |
| `education/` | 9 | Learning center + AI Coach chat |
| `homeowner/` | 2 | Post-close dashboard, refi alerts |

Shared building blocks live in `client/src/components/` (including
`AddressInput` with Google Places autocomplete, `PropertyMap`, `StreetView`,
journey steppers, trust-layer cards) and `client/src/components/ui/` (the
Shadcn primitives).

## Conventions that matter

- **Role-gated routing**: `App.tsx` decides which route tree you get based on
  the authenticated user's role (borrower vs staff vs admin vs agent). The
  session comes from `GET /api/auth/user`.
- **Data fetching**: never `fetch` directly in components — use the existing
  TanStack Query helpers (`queryClient`, `apiRequest` in `client/src/lib/`)
  so auth, errors, and cache invalidation stay consistent.
- **Design language**: **Calm Emerald** (2026-08-18 repaint of Royal Blue Emerald,
  which repainted Charcoal Emerald / Obsidian Indigo) — Better.com-led visual quiet:
  stark-white surfaces, neutral slate ramp, near-black slate type, light navigation
  chrome (white sidebar/footer, slate text, hairlines; no colored bands as page
  furniture), emerald reserved for conversion actions; one dominant CTA per screen,
  progress steppers, collapsible secondary content. Fonts: Geist → Inter. Tokens are enforced by the
  design-token guard — see [design_guidelines.md](../design/design_guidelines.md)
  (authoritative) and its operational companion
  [visual-consistency-standard.md](../design/visual-consistency-standard.md)
  (spacing/elevation scales, icon registry, `<Logo>`/white-label, empty-state + adoption
  checklists). **⏳ Consistency program (2026-07-14):** app surfaces are moving to
  soft-shadow cards on a light-gray `bg-surface`, one canonical glyph per concept, and
  **tenant-overridable branding on private pages** (white-label; public stays Homiquity) —
  rolled out surface-by-surface (borrower dashboard first).
- **Page scaffold**: every authed page wraps its content in
  [`PageShell`](../../../client/src/components/PageShell.tsx) — it owns the
  max-width, centering, horizontal padding, and vertical rhythm so pages don't
  hand-roll `min-h-screen` / `container mx-auto` wrappers (which drifted apart:
  the shell was at 7/99 adoption, see finding `ux-03`). New authed pages **must**
  use it. Widths are semantic (`narrow` 2xl / `content` 4xl / `wide` 6xl / `full`
  7xl). The header is optional and non-flattening: pass `title`/`subtitle` for the
  standard block, plus `icon`, `eyebrow`, `headerLead` (e.g. a back link),
  `headerMeta` (status badges), and `headerAction` (right-aligned) to preserve a
  bespoke header instead of dropping it. Pass `titleTestId` to keep a page's
  existing `data-testid`. Omit every header field for a container-only shell (keep
  your own header as the first child). `fullHeight` wraps content in a full-height
  **white** background and is only for pages rendered outside `PrivateLayout`
  (auth/bare/public routes); inside `PrivateLayout` **don't set it** — that layout
  supplies the gray app surface (`bg-surface`), and a white `min-h-screen` would
  paint over it. Full-bleed marketing/hero pages and centered spinner/empty states
  are legitimate exceptions. Converting one of the ~57% opt-out pages: follow the
  PageShell adoption checklist in
  [visual-consistency-standard.md](../design/visual-consistency-standard.md) §8.
- **Aliases**: `@/` → `client/src/`, `@shared/` → `shared/` (defined in
  `vite.config.ts` + `tsconfig.json`).

## Dev experience

`pnpm dev` runs Express with Vite as middleware — client edits hot-reload
instantly; **server** edits require a restart (tsx is not in watch mode).
The client build outputs to `dist/public` (`vite.config.ts`), which in production
is served by `serveStatic` in the **same Express process** that answers `/api/*`
(`server/index-prod.ts`) — there is no CDN in front of it. Assets are
content-hashed and served `immutable`; `index.html` is served `no-cache` so a
deploy can't strand clients on a stale asset graph.

⚠️ **`VITE_*` env vars are build-time, not runtime.** Vite inlines them into the
bundle at `vite build`, so changing one (e.g. `VITE_PRELAUNCH_GATED`) in Railway
requires a **redeploy**, not a restart. Anything that must be flippable at
runtime belongs behind an API call, not an `import.meta.env` read.
