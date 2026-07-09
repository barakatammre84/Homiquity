---
name: ui-components
description: Use when building or restyling any client UI — pages, components, layout, theming, forms — in client/src. Covers the Charcoal Emerald design tokens (enforced by design-token-guard), WCAG AA accessibility requirements, and the Shadcn/Radix + Tailwind + TanStack Query conventions.
---

# UI components & design system

Fast-start router. **Authoritative reference:** [`kb/handbook/design/design_guidelines.md`](../../../knowledge-base/handbook/design/design_guidelines.md) (normative rules) and the code itself — `client/src/index.css` (CSS-variable tokens) + `tailwind.config.ts` + `client/src/components/ui/**` are the source of truth. Page map: [`app-guide/07-frontend.md`](../../../knowledge-base/handbook/app-guide/07-frontend.md).

## Non-negotiables
- **No raw Tailwind palette classes** (`text-emerald-600`, `bg-amber-100`, …). `scripts/design-token-guard.cjs` (via `npm run checkup`) **fails CI** on them. Use semantic tokens and `<Badge>`/`<Alert>` variants.
- **Charcoal Emerald** (2026-07-06, supersedes Obsidian Indigo): stark-white surfaces, neutral slate ramp, deep-charcoal type. **Emerald = forward action only** (`bg-primary` #047857, AA 5.49:1 — raw #10B981 must not carry white text). Hierarchy through the value ramp + whitespace, not hue. Cards = white + 1px slate-200 hairline, **no default shadow**.
- **WCAG 2.1 AA (enforced):** status color as text-on-canvas is a fail → use the `*-subtle` pairs. Icon-only controls **require `aria-label`**. Labels always visible (no placeholder-only). Touch targets ≥44px. `<SkipLink/>` is the first focusable element; form errors announce via `role="alert"`.
- **Icons:** `lucide-react` only (not Heroicons). No emoji/raster glyphs in UI.
- **Data:** never `fetch()` in a component — use `queryClient`/`apiRequest` (TanStack Query) so auth, errors, and cache invalidation stay consistent. Forms use react-hook-form + the shared Zod schemas.
- **Testability:** every interactive or asserted element gets a kebab-case `data-testid`.

## Where it lives
`client/src/components/ui/` (30 token-driven primitives: Button/Badge/Alert/Card…) · `client/src/index.css` + `tailwind.config.ts` (tokens) · `client/src/App.tsx` (routes, role-gated trees) · pages under `client/src/pages/<audience>/`.

Adding a status color? Add a `<Badge>/<Alert>` variant + `*-subtle` tokens (light+dark, AA-verified) — never a one-off palette class.
