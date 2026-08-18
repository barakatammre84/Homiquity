# Homiquity Design Standard

> **Single source of truth for how Homiquity looks and behaves.**
> Version: 1.0 · 2026-08-18 · Derived from the full logged-in teardown of
> better.com (the execution benchmark) plus Homiquity's live token system.
>
> This file changes ONLY via PR. Research findings arrive as GitHub issues
> labeled `design-standard`; converting them into edits here is how "Claude
> learning about Better.com" reaches the codebase. No other document may
> restate these rules — link here instead. If you find an older design doc
> that conflicts with this one, delete it or reduce it to a link.

---

## 1. The look, in one paragraph

Clean white, generous space, almost no decoration. Better.com's layout
physics with Homiquity's brand: white surfaces everywhere, one deep green
accent doing all the work, tight display type, pill-shaped navigation and
commitment buttons, soft-rectangle inputs, and quiet grey-green supporting
text. The interface should feel like a well-set document, not a dashboard.
When in doubt, remove.

## 2. Tokens (already defined on `:root` — use them, never raw values)

- Type: `--font-sans` Geist/Inter stack · `--font-serif` Source Serif 4 ·
  `--font-mono` Geist Mono
- Core: `--primary 163 94% 24%` (deep green) · `--foreground 222 47% 11%` ·
  `--border 214 32% 91%` · `--muted-foreground` (see §4)
- Semantic pairs (use for ALL status color): `--success/-subtle`,
  `--warning/-subtle`, `--info/-subtle`, `--destructive/-subtle`
- Brand: `--veteran-gold/-navy/-red/-seal-bg` — reserved for the VA path
- `--radius .75rem`, 8-step shadow scale tinted `#131820`

Semantic mapping (fixed):
completed/self-reported → `success-subtle` pair · required/current/verified
→ solid `primary` · soft-checked/informational → `info-subtle` pair ·
needs-attention/estimated → `warning-subtle` pair · destructive → red
**outline on transparent, never red fill**.

## 3. Layout physics (measured from Better, adopted here)

- **Radius has three jobs, never mixed:** fully-rounded pills (`9999px`)
  for navigation and commitment buttons; `8px` for inputs and form
  controls; `12px` (`--radius`) for cards and containers.
- **Marketing display type:** large, tight, line-height ~1.0–1.08,
  weight 600, letter-spacing −0.02em. Hero H1 target 56–72px desktop.
- **App typography uses exactly two weights** (400 and 600). Hierarchy in
  the app comes from size and color, not weight. Marketing may add one
  display weight.
- **Body text:** 16px / 24px (1.5). Muted copy is grey-GREEN (§4), not
  neutral or blue grey.
- **Inputs:** ~52–56px tall, 1px `--border`, label ALWAYS above the field
  (never placeholder-as-label), red asterisk on the question only, 2px
  green focus ring. One form layout everywhere: stacked labels.
- **Spacing:** sections breathe — big vertical rhythm between concept
  groups; whitespace is the default separator, borders are the exception.
  Never fill space with decoration; fill it with explanation ("why we
  ask") or leave it empty.
- **Backgrounds:** white. Cards on white separated by 1px border +
  smallest shadow that reads. The navy `--sidebar` is the ONE dark
  surface, used only for the app sidebar (and report mastheads).

## 4. One deliberate token change

`--muted-foreground` shifts from blue-grey `215 24% 37%` to green-grey
**`168 12% 37%`** so quiet text carries the brand hue the way Better's
does. Apply in `:root` and verify contrast ≥ 4.5:1 on white.

## 5. Control-type rules (fixed vocabulary)

2 exclusive options → segmented pills (selected = white pill + green check
inside) · 3–5 exclusive → vertical radios · 6+ / known taxonomy → select ·
independent booleans → checkboxes · repeating entity → `EntityCard`
(empty → editing → saved-summary; saved keeps each question beside its
answer; Delete = red outline; Add lives on the collection, outside the
card). Screen boundaries in wizards follow **one underwriting concept per
screen**, whatever the field count.

## 6. Structural patterns (use the components, they encode these)

- Whole road visible, one step lit (`LoanTracker`) — future steps stay
  visible, greyed, with plain-English descriptions that **name the actor**.
- Sticky Support-left / Submit-right bar on every multi-field flow
  (`StickyFormBar`).
- Pre-fill what we know; frame screens as "Confirm", not "Enter".
- Branch in place beneath the triggering answer — never a modal or route
  change (`BranchingField` pattern).
- Bulk-answer escape hatch for mandatory declaration walls
  (`DeclarationsGroup`) — master checkbox derived, never stored.
- Progress totals snapshotted at task start (`TaskProgress` /
  `useTaskProgress`). Never a fraction whose denominator moves.
- Every financial figure inside a `SummarySection` (required `source` +
  `whyWeAsk`), dual-unit annual+monthly (`DualUnitTable`), `—` for
  not-applicable, never `$0`.
- Consent via `ConsentField` only: positive opt-in, never pre-ticked,
  consequence stated neutrally outside the label.
- Documents via `DocumentList`: human titles from the slug map, grouping,
  provenance/status chips, subject disambiguation, plain dates
  ("Sent to you on…").
- Empty states via `EmptyState`: required `scope`, heading derived from it.

## 7. Copy voice

Plain English; explain concepts without the acronym (describe LTV, don't
say it). Action → named artifact → benefit. Legal questions get a
"This could be…" example. Tell users what to do when a question doesn't
apply. Acknowledge milestones before asking for anything. State privacy
limits specifically ("we will never share your credit report or bank
statements"). Offer the real third option ("I'm waiting to hear back") —
no false binaries.

## 8. Banned (defects we or the benchmark actually shipped)

Raw slugs in UI text · "File name" columns without filenames · duplicate
rows without a disambiguating subject · "disclosed at"-style jargon ·
`<a>` wrapping `<button>` · per-option required asterisks · view-layer
name normalization · opt-out consent, double negatives, penalty language ·
counts/badges/empty-states computing their own "what's outstanding" ·
unlabeled progress displays (every tier says what it measures) · empty
hero slots / stale hashed asset references · decoration where explanation
should be.

---

*To change this standard: open a PR editing this file, referencing the
`design-standard` issue that motivated it. Bump the version line.*
