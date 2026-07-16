# Design Guidelines — Homiquity

> **Source of truth is the code, not this file.** Tokens live in
> [`client/src/index.css`](../../../client/src/index.css) (CSS variables) and
> [`tailwind.config.ts`](../../../tailwind.config.ts); primitives live in
> [`client/src/components/ui/`](../../../client/src/components/ui). This doc explains the
> *rules*; when they disagree with the code, the code wins — fix the doc.
> The `design-token guard` (`scripts/design-token-guard.cjs`, run by
> `npm run checkup`) **fails CI on any raw Tailwind palette class**, so the rules
> below are enforced, not aspirational.
>
> **Companion:** the detailed, operational catalogs — the icon registry (one glyph per
> concept), the brand/`<Logo>`/illustration system, the empty-state standard, the
> reference-surface spec, and the PageShell adoption checklist — live in
> [`visual-consistency-standard.md`](./visual-consistency-standard.md). This file is the
> narrative *language*; that file is the *checklist* you build against.
>
> **⏳ Consistency program (adopted 2026-07-14).** An app-wide uniformity pass is in
> flight (spacing · depth · icons · graphics). Two rules below change from the prior
> doctrine and are marked **⏳ rolling out** — they are the adopted target, wired in the
> foundations phase and rolled out surface-by-surface (borrower dashboard first), not yet
> true on every page: (1) **elevation** moves from near-flat to soft-shadow-on-a-gray-
> surface; (2) **branding** becomes tenant-overridable on private surfaces (white-label).
> Until a surface is converted, its current near-flat / Homiquity-only styling is correct.

## Design approach — "Royal Blue Emerald" (Better.com-style conversion clarity)

*Royal-blue repaint 2026-07-08 of "Charcoal Emerald" (which superseded "Obsidian
Indigo" on 2026-07-06): charcoal dark surfaces swapped for vivid royal blue,
emerald kept as the action color.* Stark-white surfaces, neutral slate structure,
near-black slate typography (#0F172A), **royal-blue dark surfaces** (sidebar, hero
gradients), and **emerald reserved for forward-moving conversion actions** ("green
means Go") — radical transparency, frictionless onboarding, high-velocity conversion.

**Dark-surface ramp** (`precision.950/900/700` in Tailwind — hero gradients only):
`950 #0A1E52` deep royal navy · `900 #1B3B9E` royal blue · `700 #2456D6` vivid royal
blue. **Neutral light ramp** (`precision.500→50`): `500 #64748B` Muted Slate
(micro-copy) · `300 #94A3B8` slate-400 · `100 #E2E8F0` slate-200 (hairlines) ·
`50 #F8FAFC` Ultra-Light Gray (data-section separation). Primary type: near-black
slate `#0F172A`. Sidebar: deep royal blue.

**Core principles**
1. **Hierarchy through VALUE, not hue.** Depth comes from the neutral ramp, whitespace,
   and — on app surfaces — a soft neutral card shadow over a light-gray ground (⏳ see
   *elevation*); never from harsh borders or colored shadows.
2. **Emerald = action.** `bg-primary` is #047857 (emerald-700, AA-safe with white
   text at 5.49:1 — raw #10B981 is only 2.49:1 and must not carry white text);
   `--ring` is emerald-600. Non-action green stays in the success tokens.
3. **Other non-ramp color is reserved for semantic status only** (see below).
4. Radical transparency, speed indicators, trust through clarity, data-as-centerpiece.

## Color system

### Layers
- **Layer 0** `bg-background` — Stark White canvas (public/marketing, forms, reading
  surfaces); `bg-muted` (#F8FAFC) separates data sections (e.g. PITI panels).
- **Layer 0-surface** `bg-surface` — the light-gray **app ground** (`--surface`, one hair
  deeper than `--muted`) that white cards sit *on* so their shadow reads. **Shipped: the
  whole authenticated app.** `PrivateLayout`'s `<main>` carries `bg-surface` + the
  `app-surface` hook, so every authed page is on it by default; Layer 0 white stays for
  public/marketing, auth, and reading surfaces. See *Radii, elevation, motion*.
- **Layer 1** — white cards + 1px slate-200 hairline (`border-card-border`). On the white
  canvas they stay near-flat (hairline only); on `bg-surface` a content card carries
  `shadow-card` — supplied **automatically** inside `.app-surface` (see elevation), so
  authed pages need no per-card class. The hairline is always kept as a second separation cue.
- **Layer 2** — Emerald conversion actions (`bg-primary`), hover deepens via the elevate system.
- **Sidebar** — deep royal-blue dark nav container.

### Semantic status (the ONLY non-ramp color)
Use these tokens or the `<Badge>/<Alert>` variants — **never** raw palette classes
like `text-emerald-600` / `bg-amber-100` (the guard blocks them, and they fail WCAG AA).

| Intent | Solid fill | Foreground on fill | Subtle chip (default for text) |
|---|---|---|---|
| success | `bg-success` (#10B981) | `text-success-foreground` (charcoal) | `bg-success-subtle` + `text-success-subtle-foreground` |
| warning | `bg-warning` (#F59E0B) | `text-warning-foreground` (charcoal) | `bg-warning-subtle` + `text-warning-subtle-foreground` |
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
hues. For a single ordered metric, use the neutral value ramp instead.

## Typography
- **Fonts:** Geist (primary) → Inter fallback; Source Serif 4 for display/hero;
  Geist Mono for code/figures. Loaded via `--font-sans/-serif/-mono`.
- Headings: weight 600–700, tight tracking (−0.02em). Body: 400, line-height 1.6.
  Financial figures: 500–600, `tabular-nums`.
- Scale (canonical): **page `<h1>` = `text-2xl sm:text-3xl`** (one rung — the audit
  found bespoke h1s at `text-xl`→`text-5xl`), section `text-2xl`, `CardTitle` `text-2xl`,
  hero (marketing only) `text-4xl`→`text-6xl`, body `text-base`, caption/labels `text-sm`.
- **Eyebrow/section label:** `text-xs font-semibold uppercase tracking-wider
  text-muted-foreground` (the standard small-caps label; apply it consistently, not ad hoc).
- **`<Heading>`/`<Text>` (⏳ rolling out):** promote the scale to shared components so h1
  size is enforced, not hand-picked per page. Closes the long-standing gap; new pages use
  them, existing pages migrate in the propagation sweep.

## Layout & spacing

**[`PageShell`](../../../client/src/components/PageShell.tsx) owns page geometry.** Every
authed page wraps its content in it; it sets the width, centering, gutter, and vertical
rhythm so pages don't hand-roll `min-h-screen` / `mx-auto max-w-…` wrappers (which drifted
across `max-w-xl`→`7xl`, three gutters, and `py-8`→`py-24` — finding `ux-03`). New authed
pages **must** use it; the 57% that opt out migrate in the propagation sweep. Full-bleed
marketing/hero pages and centered spinner/empty states are the only legitimate exceptions.

- **Container width — semantic set only:** `narrow` `max-w-2xl` (forms) · `content`
  `max-w-4xl` (default reading) · `wide` `max-w-6xl` (dashboards) · `full` `max-w-7xl`
  (data/marketing). **Retire page-level `max-w-xl / 3xl / 5xl`.**
- **Gutter — one convention:** `px-4 sm:px-6 lg:px-8` (owned by PageShell). ⏳ PageShell
  applies flat `px-4` today; Phase 2 upgrades its gutter to this three-step so every page
  inherits it.
- **Page vertical padding:** owned by PageShell (`py-8 sm:py-10`); don't set your own.
- **Section rhythm:** default `space-y-6`; `space-y-4` (compact) and `space-y-8` (generous)
  are the only other sanctioned tiers.
- **Card padding:** default `p-6`; `p-4` for dense dashboard cards. **Retire `p-2/p-3/p-8`.**
- **Spacing primitives:** Tailwind `2, 4, 6, 8, 12, 16`; form field `space-y-4`.
- **Grids:** dashboards `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`; comparisons `lg:grid-cols-3`.

## Radii, elevation, motion
- **Radii:** `--radius` .75rem → `rounded-lg` 12px (cards/modals), `rounded-md` 8px
  (inputs/buttons), `rounded-sm` 4px (chips).
- **Elevation (this reverses the prior "cards default to no shadow" doctrine).** The
  neutral-tinted `--shadow-2xs`…`--shadow-2xl` vars (in `index.css`) are wired into Tailwind
  as a named card scale: `shadow-card` (= `--shadow-sm`), `shadow-card-hover`
  (= `--shadow-md`), `shadow-card-lg` (= `--shadow-lg`). Rules:
  - A **content card on `bg-surface`** carries `shadow-card` (+ its hairline). On the white
    canvas (Layer 0), cards stay near-flat (hairline only) — shadow needs the gray ground to read.
  - **You don't hand-apply it inside the authed app.** `index.css` supplies the default via
    `.app-surface .shadcn-card:not([class*="shadow-"])`. Declaring any `shadow-*` class on a
    card opts out of the default and wins — use `shadow-card-lg` for emphasis, `shadow-none`
    to go flat. (The `:not()` guard is load-bearing: Tailwind v3's `@layer` is a build-time
    directive, not native cascade layers, so without it this selector's specificity would
    silently flatten every explicit override.)
  - **Interaction depth:** clickable cards/rows use `hover-elevate` (pair with
    `shadow-card-hover` for a lift); `active-elevate-2` is the pressed state (buttons and
    other pressables). Don't mix raw `hover:shadow-*` on cards — that's one of the drifts
    being retired.
  - **Overlays** (popover/dropdown/dialog/toast/sheet) keep their existing Radix shadows.
  - **Retire ad-hoc surface shadows:** no `shadow-2xl` / `shadow-lg border-0` / one-off
    `shadow-primary/25` on content cards — they fought the flat-card design. Use the card scale.
  - The `Card` primitive stays shadow-less by default; a surface opts in with `shadow-card`
    (so nothing changes until a page is converted).
- **Motion:** `transition-all duration-150 ease-in-out` on interactive atoms;
  the elevate system (`hover-elevate`/`active-elevate-2`) supplies hover/active
  tints. Loading = `<Skeleton>` (`animate-skeleton-precision`, slate-200→slate-50),
  never spinners.

## Components (`components/ui/*`)
- **Button** — variants `default, destructive, outline, secondary, ghost, link`;
  sizes `sm` h-9 · `default` h-11 · `lg` h-12 · `icon` h-11 w-11. Focus ring via
  `focus-visible:ring-ring`. `size="icon"` **requires an `aria-label`**.
- **Badge** — `default, secondary, destructive, success, warning, info, outline`.
- **Alert** — `default, destructive, success, warning, info`.
- **Card** — `rounded-lg bg-card border border-card-border`, shadow-less by default;
  a surface opts into `shadow-card` on `bg-surface` (see *Radii, elevation, motion*).
- All 30 primitives consume tokens. **Gap:** zero Storybook stories / component
  tests despite ~1,900 `data-testid`s ready for visual-regression.

## Iconography
- **Library: `lucide-react`** (not Heroicons — that's stale). No emoji or raster glyphs
  for UI. Icon-only controls **must** have `aria-label`.
- **One glyph per concept (⏳ rolling out).** The audit found 178 ad-hoc import sites and
  the same concept drawn 3–6 ways (e.g. "done" as `CheckCircle2` / `CheckCircle` /
  `CircleCheckBig`). Import icons **from the registry** `client/src/lib/icons.ts` (added in
  Phase 2) by semantic name, not directly from `lucide-react`. The concept→glyph table lives in
  [`visual-consistency-standard.md`](./visual-consistency-standard.md).
- **Size rungs (`h-N w-N` form only — retire the `size-4` shorthand):** inline `h-4 w-4`
  (default) · emphasis `h-5 w-5` · badge/dense `h-3.5 w-3.5` · feature `h-6`/`h-8` ·
  empty-state `h-10`. Buttons keep `[&_svg]:size-4` internally.

## Branding & white-label (⏳ rolling out)

The **private/authenticated app** (broker dashboard, LO dashboard, consumer/borrower
portal + chrome — the licensed "engine, CRM & tools") is **white-labeled to the LO/broker's
brand**; the **public marketing site stays Homiquity**. This is delivered by overriding a
small set of *brandable* tokens per tenant — never by inline hex or raw palette classes (so
the design-token guard still holds). Detailed mechanism + `<Logo>` spec in
[`visual-consistency-standard.md`](./visual-consistency-standard.md).

- **Brandable tokens (tenant-overridable, private surfaces only):** the brand hue —
  `--primary`, `--accent` (hero), `--sidebar`, `--ring` — plus the `<Logo>` source
  (tenant logo/brandName). A tenant's `primaryColor`/`accentColor`/logo drive these via CSS
  variables set on the private-layout root; because components use `bg-primary`/`bg-accent`
  semantically, the portal re-skins automatically.
- **Fixed tokens (NEVER tenant-overridable):** the neutral slate ramp/structure, `--surface`
  + the elevation scale, and **all semantic status tokens** (success/warning/info/
  destructive) — these carry meaning and AA guarantees and must stay constant across tenants.
- **Surface boundary:** overrides apply on **`PrivateLayout` only**; public layouts pin to
  Homiquity. (The pre-existing public co-brand landing `/partner/:profileId` applies its own
  inline colors — separate existing feature, left as-is.)
- **Contrast is not optional:** a tenant may pick any brand color, so a readable
  `--primary-foreground` must be **derived from the chosen color's luminance (or validated
  for AA on save)** — white text is not assumed to pass. The house emerald #047857 was
  hand-verified at 5.49:1; tenant colors get no such guarantee for free.
- **Compliance gate:** white-labeling a *licensed mortgage* portal (broker/LO brand + NMLS
  on the surface) raises advertising/NMLS questions — route the feature through compliance
  review before ship; never fabricate NMLS/brand data.

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
