# Design Guidelines — Homiquity

> **Source of truth is the code, not this file.** Tokens live in
> [`client/src/index.css`](client/src/index.css) (CSS variables) and
> [`tailwind.config.ts`](tailwind.config.ts); primitives live in
> [`client/src/components/ui/`](client/src/components/ui). This doc explains the
> *rules*; when they disagree with the code, the code wins — fix the doc.
> The `design-token guard` (`scripts/design-token-guard.cjs`, run by
> `npm run checkup`) **fails CI on any raw Tailwind palette class**, so the rules
> below are enforced, not aspirational.

## Design approach — "Obsidian Indigo" (monochromatic precision)

A single desaturated navy-indigo hue (~216°) expanded across a strict value ramp,
Stripe / Linear / Notion register — institutional trust, "high-performance
financial utility, not consumer neobank."

**Value ramp** (`precision.*` in Tailwind, CSS vars in `index.css`):
`950 #050B14` Obsidian (primary type & actions) · `900 #0C1625` Deep Ink
(nav/sidebars) · `700 #1D2D44` Steel Blue · `500 #3E5370` Muted Slate (secondary
text) · `300 #889DBE` Dusty Ice · `100 #D0DDF0` Frost Tint · `50 #F2F6FC` Paper Ice.
Ramp stops 100/50 are identity accents only — since the 2026-07-04 Warm Paper
amendment they are no longer the canvas/hairline surfaces (see Layers).

**Core principles**
1. **Hierarchy through VALUE, not hue.** Depth comes from the monochromatic ramp.
2. **Non-ramp color is reserved for semantic status only** (see below).
3. Radical transparency, speed indicators, trust through clarity, data-as-centerpiece.

## Color system

### Layers
- **Layer 0** `bg-background` — **Warm Paper #F9F7F4** canvas (warm-neutral,
  2026-07-04 amendment: the navy identity stays, the frame around it warms —
  "residential shelter, not clinical lab"). Secondary/muted chips follow in the
  same sand family.
- **Layer 1** — white cards + 1px **Warm Stone #E5E1DA** hairline
  (`border-card-border`), **no default shadow**.
- **Layer 2** — Obsidian primary actions (`bg-primary`), hover deepens via the elevate system.
- **Sidebar** — Deep Ink dark nav container.

### Semantic status (the ONLY non-ramp color)
Use these tokens or the `<Badge>/<Alert>` variants — **never** raw palette classes
like `text-emerald-600` / `bg-amber-100` (the guard blocks them, and they fail WCAG AA).

| Intent | Solid fill | Foreground on fill | Subtle chip (default for text) |
|---|---|---|---|
| success | `bg-success` (#10B981) | `text-success-foreground` (Obsidian) | `bg-success-subtle` + `text-success-subtle-foreground` |
| warning | `bg-warning` (#F59E0B) | `text-warning-foreground` (Obsidian) | `bg-warning-subtle` + `text-warning-subtle-foreground` |
| info    | `bg-info`               | `text-info-foreground` | `bg-info-subtle` + `text-info` |
| destructive | `bg-destructive` (red-600) | `text-destructive-foreground` (white) | `bg-destructive-subtle` + `text-destructive` |

**AA rules (enforced by design):**
- Status color as *text on canvas* is a WCAG fail — use the `*-subtle` pair
  (dark tint text on pale tint fill, all ≥5.5:1) for badges/labels/inline text.
- Solid fills carry **dark** foregrounds for success/warning (white-on-emerald
  was 2.54:1); `destructive` is red-600 so white-on-red clears 4.80:1.
- On **dark image overlays**, keep icons vivid (`text-warning`/`text-success`),
  not the dark subtle-foreground (which vanishes).

### Charts
`chart-1..5` is a **colorblind-safe categorical** set (navy/teal/amber/indigo/rose)
for multi-series data-viz — it deliberately does NOT reuse the success/warning
hues. For a single ordered metric, use the navy value ramp instead.

## Typography
- **Fonts:** Geist (primary) → Inter fallback; Source Serif 4 for display/hero;
  Geist Mono for code/figures. Loaded via `--font-sans/-serif/-mono`.
- Headings: weight 600–700, tight tracking (−0.02em). Body: 400, line-height 1.6.
  Financial figures: 500–600, `tabular-nums`.
- Scale: hero `text-4xl`→`text-6xl`, section `text-2xl`→`text-3xl`, `CardTitle`
  `text-2xl`, body `text-base`, caption/labels `text-sm`.
- **Gap:** no shared `<Heading>/<Text>` component yet — heading sizes are chosen
  ad-hoc. Prefer promoting to a component so the scale is enforced.

## Layout & spacing
- Spacing primitives: Tailwind `2, 4, 6, 8, 12, 16`. Component padding `p-6`–`p-8`;
  section spacing `py-12`(mobile)/`py-16`(desktop); form field `space-y-4`.
- Max-width `max-w-7xl` main content; `max-w-2xl` centered forms.
- Grids: dashboards `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; comparisons `lg:grid-cols-3`.

## Radii, elevation, motion
- **Radii:** `--radius` .75rem → `rounded-lg` 12px (cards/modals), `rounded-md` 8px
  (inputs/buttons), `rounded-sm` 4px (chips).
- **Elevation:** `--shadow-2xs`…`--shadow-2xl` (house-hue tinted). **Cards default
  to no shadow + hairline**; reach for shadow only for true overlays (popover/toast).
- **Motion:** `transition-all duration-150 ease-in-out` on interactive atoms;
  the elevate system (`hover-elevate`/`active-elevate-2`) supplies hover/active
  tints. Loading = `<Skeleton>` (`animate-skeleton-precision`, hairline→canvas via CSS vars), never spinners.

## Components (`components/ui/*`)
- **Button** — variants `default, destructive, outline, secondary, ghost, link`;
  sizes `sm` h-9 · `default` h-11 · `lg` h-12 · `icon` h-11 w-11. Focus ring via
  `focus-visible:ring-ring`. `size="icon"` **requires an `aria-label`**.
- **Badge** — `default, secondary, destructive, success, warning, info, outline`.
- **Alert** — `default, destructive, success, warning, info`.
- **Card** — `rounded-lg bg-card border border-card-border`, no shadow.
- All 30 primitives consume tokens. **Gap:** zero Storybook stories / component
  tests despite ~1,900 `data-testid`s ready for visual-regression.

## Iconography
- **Library: `lucide-react`** (not Heroicons — that's stale). Outline for
  nav/secondary; size 16px (`[&_svg]:size-4` in buttons) / 20–24px prominent.
- No emoji or raster glyphs for UI. Icon-only controls **must** have `aria-label`.

## Accessibility (WCAG 2.1 AA)
- **Skip link:** `<SkipLink />` is the first focusable element in every layout;
  `<main id="main" tabIndex={-1}>` is the target.
- **Form errors are announced:** shared `FormMessage` renders `role="alert"`;
  inline field errors use `role="alert"`; `FormControl` sets `aria-invalid` +
  `aria-describedby`. Toasts (Radix) announce automatically.
- **Contrast:** all semantic pairs verified AA (see Color system). Focus states
  are centralized (`focus-visible:ring-ring`), never removed.
- Labels always visible (no placeholder-only). Touch targets ≥44px (`.touch-target`).
- **Open follow-ups:** `aria-label` sweep on icon-only controls; landmark/skip-link
  on bare (layout-less) routes; a `<Heading>` component for ordered headings.

## Responsive & assets
- Mobile-first; single-column forms; bottom-sheet modals; sticky CTAs;
  `env(safe-area-inset-bottom)` handled.
- Images: 16:9 `object-cover` cards; `loading="lazy"` on all non-hero images.

## Governance
- **Single source of truth:** `index.css` + `tailwind.config.ts` + `components/ui/**`.
  This doc is narrative, not normative.
- **Enforcement:** the design-token guard (baseline 0) blocks raw palette colors in CI.
- **Ownership:** put a CODEOWNER on `components/ui/**` and the token files; any new
  primitive or token needs review + a changelog entry.
- **Adding a new status color?** Add a `<Badge>/<Alert>` variant + `*-subtle`
  tokens (light+dark, AA-verified) — never a one-off palette class in a page.
