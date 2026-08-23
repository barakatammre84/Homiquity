---
name: design-identity-engine
description: Use ONLY when the user explicitly invokes /design-identity-engine or explicitly asks to "run the design identity engine". NEVER auto-load for general UI, styling, token, icon or component questions — those belong to ui-components, and propagating an existing standard belongs to ui-conformance-sweep. This is a scheduled autonomous routine with its own safety rails.
---

# Design Identity Engine — the routine that RAISES the standard

**Writes code:** yes — the identity layer only (territory below).
**Produces:** **one** PR + one ledger row. A run that raises nothing produces neither and says so.
**Contract:** [CHARTER.md](../../../knowledge-base/routines/CHARTER.md) wins over this file on any
conflict; say so in the report rather than following the stale copy.
**Cross-run memory:** [design-identity/LEDGER.md](../../../knowledge-base/design-identity/LEDGER.md)
— read the `Refused` column BEFORE proposing anything.

## Why this exists, and how it differs from the sweep

The founder's complaint was that the UI looked generic — default icons, default type, no motion,
"nothing that looks like it was designed." That was factually correct: **every layer was the
stack's default.** Geist + Inter (the two most-used faces on the web), Lucide, unmodified shadcn,
stock photography, `prefers-reduced-motion` honoured in zero files. Nothing on that list was a
*decision*.

Two routines, two jobs, and they must not touch each other's files:

| | owns | judged on |
|---|---|---|
| **UI Conformance Sweep** | making surfaces *match* the standard | `guard:ui` going down |
| **Design Identity Engine** (this) | *raising* the standard | one identity decision landed and proved |

CHARTER §6a forbids the sweep from `client/src/components/ui/**`. That carve-out is this routine's
territory. **One invents, one spreads, neither edits the other's files.**

## Territory

`client/src/components/ui/**` · `client/src/index.css` · `tailwind.config.ts` ·
`client/src/components/motion/**` · `client/src/components/illustrations/**` ·
`client/src/lib/icons.ts` · `client/src/components/layout/**` · `client/index.html` (font links)

**Never touch:** any file in an open PR, anything under an active REGISTER claim, or the
Conformance Sweep's surface files. CHARTER §6a's "off limits to every routine, always" list applies
here in full — schema, migrations, encryption, auth, uploads, outbound messaging, the underwriting
engines, `amortization.ts`, dependencies.

## Each run does ONE of

- **Raise** — advance the identity one step (a token, a primitive, a scale).
- **Prove** — apply what exists to one surface, before/after.
- **Propagate** — carry a raised standard to N surfaces, one reviewable PR.

## Rails

1. **One surface per run.** The failure mode is a 411-file sweep nobody can review.
2. **Visual only** — no form state, Zod, or payload shapes in the same PR (DESIGN_SYSTEM §14).
   That rule exists because capture fields feed the ULDD/UCD package, and a large styling diff is
   where a dropped field hides best.
3. **AA before it enters `index.css`.** Measured, not assumed.
4. **Tokens, never literals.** `guard:tokens` holds at 0 raw palette classes.
5. **`guard:ui`'s nine ratchets may only fall.** A hand-rolled type scale raises
   `arbitraryTypeScale` — that is the guard working, not an obstacle.
6. **`guard:bundle`: move the bytes rather than raise the baseline.** Raise it only when the bytes
   buy something that *renders*, and say in the PR what. A shared module reaching a second lazy
   route gets hoisted into the eager chunk — that is the usual cause.
7. **Tenant white-label survives.** `BrandingProvider` owns `--primary`/`--accent`/`--sidebar`/
   `--ring` on authed surfaces, so identity there must come from type, motion, spacing and
   structure — not hue. Public marketing may commit fully.
8. **Screenshots are mandatory.** A run without before/after images is not a completed run.

## 🚨 Verification traps this routine has already paid for

- **A raw count is never a finding.** Ask what the elements *are*. "Most hairlines on the site"
  turned out to be control affordances; "buttons 32% taller" were tappable list rows.
- **Verify on a FULL-PAGE capture** (e.g. 1280×2600). Two permanently-invisible cards survived
  several review rounds because every screenshot was a partial viewport.
- **Geometry is not composition.** The DOM can report a block correctly offset while the design
  still fails — centred content inside an offset block cancels it.
- **A silent no-op is not an error.** `rounded-xl` equalled `rounded-lg` for 40 files and nothing
  went red. Assert a token is *declared*, not merely valued.
- **`preview_start` boots the PRIMARY checkout**, reading `launch.json` from the session's working
  directory and taking the first config regardless of the name passed. Confirm by reading the
  server process's cwd.
- **A webfont that fails is invisible** — the page just looks slightly wrong. Prove it renders with
  `document.fonts.check(...)`.

## Verification (every run)

1. Browser at 320 / 768 / 1280, **plus one full-page capture** — screenshot before and after.
2. AA contrast on every new pair before it lands.
3. Toggle `prefers-reduced-motion`; confirm motion genuinely stops.
4. Keyboard-only pass — visible focus on every new treatment.
5. `pnpm check` · `guard:tokens` · `guard:ui` · `guard:bundle` (build first) · `guard:kb` · `pnpm test`.
6. Append a ledger row — **including what was refused, and why.**

## Founder calls this routine may not make for itself

Licensing a display face · commissioning illustration · relaxing any AA or WCAG rail ·
extending identity work into the authed app's brandable tokens.
