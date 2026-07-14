---
name: ui-components
description: Use when building or restyling any client UI — pages, components, layout, theming, forms — in client/src. Covers the Royal Blue Emerald design tokens (enforced by design-token-guard), WCAG AA accessibility requirements, and the Shadcn/Radix + Tailwind + TanStack Query conventions.
---

# UI components & design system

Fast-start router. **Authoritative reference:** [`kb/handbook/design/design_guidelines.md`](../../../knowledge-base/handbook/design/design_guidelines.md) (normative rules) + its operational companion [`visual-consistency-standard.md`](../../../knowledge-base/handbook/design/visual-consistency-standard.md) (spacing/elevation scales, icon registry, `<Logo>`/white-label, empty-state + adoption checklists), and the code itself — `client/src/index.css` (CSS-variable tokens) + `tailwind.config.ts` + `client/src/components/ui/**` are the source of truth. Page map: [`app-guide/07-frontend.md`](../../../knowledge-base/handbook/app-guide/07-frontend.md).

## Non-negotiables
- **No raw Tailwind palette classes** (`text-emerald-600`, `bg-amber-100`, …). `scripts/design-token-guard.cjs` (via `npm run checkup`) **fails CI** on them. Use semantic tokens and `<Badge>`/`<Alert>` variants.
- **Royal Blue Emerald** (2026-07-08 repaint of Charcoal Emerald): stark-white surfaces, neutral slate ramp, near-black slate type (#0F172A), **vivid royal-blue dark surfaces** (sidebar via `--sidebar`, hero gradients via `precision.950/900/700`). **Emerald = forward action only** (`bg-primary` #047857, AA 5.49:1 — raw #10B981 must not carry white text). Hierarchy through the value ramp + whitespace, not hue. Cards = white + 1px slate-200 hairline; **⏳ on the app gray ground (`bg-surface`) a content card carries `shadow-card`** (=`--shadow-sm`; hover `shadow-card-hover`, emphasis `shadow-card-lg`) — the elevation reversal, rolled out surface-by-surface. Overlays keep Radix shadows; no ad-hoc `shadow-2xl`/`shadow-lg border-0` on content cards.
- **Spacing/scaffold:** authed pages use `PageShell` (owns width/gutter `px-4 sm:px-6 lg:px-8`/vertical rhythm). Canonical widths `narrow` 2xl / `content` 4xl / `wide` 6xl / `full` 7xl; section rhythm `space-y-6` (`-4`/`-8` tiers); card padding `p-6` (dense `p-4`); page `<h1>` `text-2xl sm:text-3xl` (use `<Heading>`/`<Text>`). Don't hand-roll `min-h-screen` page wrappers.
- **WCAG 2.1 AA (enforced):** status color as text-on-canvas is a fail → use the `*-subtle` pairs. Icon-only controls **require `aria-label`**. Labels always visible (no placeholder-only). Touch targets ≥44px. `<SkipLink/>` is the first focusable element; form errors announce via `role="alert"`.
- **Icons:** import by **semantic name from `client/src/lib/icons.ts`** (one glyph per concept), not directly from `lucide-react`; size rungs `h-4`/`h-5`/`h-3.5`/`h-6`/`h-8`/`h-10`. No emoji/raster glyphs. Zero-states use `<EmptyState>` (+ a `components/illustrations/` spot art), never a hand-rolled icon-in-a-gray-circle.
- **Branding/white-label (⏳):** private/authenticated surfaces are tenant-brandable — `BrandingProvider` overrides only the **brandable** tokens (`--primary`/`--accent`/`--sidebar`/`--ring`) per tenant, never inline hex; fixed tokens (neutral ramp, `--surface`+elevation, semantic status) never change; public surfaces stay Homiquity. Use `<Logo>` (brand/), not a hardcoded `homiquity` span.
- **Data:** never `fetch()` in a component — use `queryClient`/`apiRequest` (TanStack Query) so auth, errors, and cache invalidation stay consistent. Forms use react-hook-form + the shared Zod schemas.
- **Testability:** every interactive or asserted element gets a kebab-case `data-testid`.

## Where it lives
`client/src/components/ui/` (30 token-driven primitives: Button/Badge/Alert/Card…) · `client/src/index.css` + `tailwind.config.ts` (tokens) · `client/src/App.tsx` (routes, role-gated trees) · pages under `client/src/pages/<audience>/`.

Adding a status color? Add a `<Badge>/<Alert>` variant + `*-subtle` tokens (light+dark, AA-verified) — never a one-off palette class.
