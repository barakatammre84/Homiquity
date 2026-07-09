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
- **Design language**: **Charcoal Emerald** (2026-07-06, supersedes Obsidian
  Indigo) — stark-white surfaces, neutral slate ramp, deep-charcoal type, emerald
  reserved for conversion actions; one dominant CTA per screen, progress steppers,
  collapsible secondary content. Fonts: Geist → Inter. Tokens are enforced by the
  design-token guard — see [design_guidelines.md](../design/design_guidelines.md)
  (authoritative).
- **Aliases**: `@/` → `client/src/`, `@shared/` → `shared/` (defined in
  `vite.config.ts` + `tsconfig.json`).

## Dev experience

`npm run dev` runs Express with Vite as middleware — client edits hot-reload
instantly; **server** edits require a restart (tsx is not in watch mode).
The client build outputs to `dist/public` (`vite.config.ts`), which is exactly
what Vercel's CDN (prod) or `serveStatic` (VM prod) serves.
