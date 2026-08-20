# App Walker — 2026-08-18 (first run)

**STATUS: WARN** — the walk ran, and it could only run after fixing two defects in the probe
itself. Five capture-path routes fail at 320px; every one of them was reported clean before today.

## ⛔ Human actions

1. **Nothing to decide** — the two probe defects are fixed in this PR and proven. The five page
   findings are builder tickets, listed below.

## Summary

The probe could not start on this Mac at all: `findChrome()` never checked Playwright's default
cache directory, its relative paths were x64/Linux-shaped on Apple Silicon, and `command -v
google-chrome` never resolves on macOS. With discovery fixed, a second and worse defect surfaced —
**the overflow check could not fail.** It compared `scrollWidth` against `window.innerWidth`, and
when a min-width forces the layout viewport wider, both sides grow together. With the reference
corrected to the requested width, five of eleven calculator routes fail immediately.

## Evidence

**Defect 1 — the probe found no browser.** `scripts/browser-probe.cjs` exited 1 on every
invocation, including with `PLAYWRIGHT_BROWSERS_PATH` exported by hand, while a Chromium sat at
`~/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/`
and Chrome sat in `/Applications`. Proven fixed: the probe now runs with **no environment
variables set at all**.

**Defect 2 — the overflow check could not fail.** Measured on `/calculators/affordability` at
`--width 320`:

```
{"inner":336,"docScroll":336,"bodyScroll":336,"screen":320,"dpr":1}
```

`window.screen.width` is the requested 320; `window.innerWidth` had grown to 336. The check asked
`scrollWidth > innerWidth`, i.e. `336 > 336`, and printed:

```
✓ no horizontal overflow (scrollWidth 336 ≤ 336)
```

The page overflowed by 16px. After correcting the reference to `Math.min(innerWidth, screen.width)`:

```
✗ HORIZONTAL OVERFLOW: scrollWidth 336 > viewport 320  (layout viewport widened to 336 …)
```

**The five failing routes**, 22 walked at 320px:

| Route | scrollWidth | Overflow |
|---|---|---|
| `/calculators/home-equity` | 378 | 58px |
| `/calculators/payoff` | 372 | 52px |
| `/calculators/bah` | 350 | 30px |
| `/calculators/affordability` | 336 | 16px |
| `/calculators/rent-to-own` | 336 | 16px |

Clean at 320px: `/`, `/afford`, `/calculators/mortgage`, `/calculators/rent-vs-buy`,
`/calculators/amortization`, `/calculators/down-payment`, `/apply`, `/rates`, `/learn`, `/faq`,
`/glossary`, `/disclosures`, `/login`, `/buy`, `/first-time-buyer`, `/accelerator`,
`/gap-calculator`.

**Root-cause note for whoever takes the ticket.** The toast viewport
`<ol class="fixed … w-full p-4">` appears at exactly the widened width on every failing page. It is
`w-full`, so it **follows** the widened viewport rather than causing it — do not "fix" it. The
narrowest elements still exceeding the viewport are the card internals (`flex flex-col space-y-1.5
p-6` and `p-6 pt-0`) at 360px inside a 320px viewport on `/calculators/home-equity`; the originator
is inside that subtree.

**Not a defect, reported once:** `/glossary` has 327 sub-44px touch targets. That is one repeated
component, not 327 findings.

**Server identification.** Walked against `http://localhost:5001`, pid 24589, started 18:15 local,
cwd `/Users/ammrebarakat/Developer/Homiquity` — the primary checkout, serving the working tree.
`/api/health` returned `commit: null`, which is the local-dev signature and identifies no branch;
the cwd and start time are the only honest evidence, per the routine's R2.

## Proposed tickets

1. **P2 — five calculator routes overflow at 320px.** DESIGN_SYSTEM §12 designs at 320. Start with
   `/calculators/home-equity` (58px, worst) and check whether one shared card/grid pattern explains
   all five before fixing them individually.
2. **P3 — `guard:ui` cannot see this class.** Its `unprefixedMultiColGrid` metric is a *proxy* for
   "breaks at 320px" by its own admission. Now that a real measurement exists, consider whether the
   ratchet should consume probe output rather than className strings.
3. **P3 — `/glossary` touch targets.** One component, 327 instances.

## Note for the next run

**A clean sweep is suspicious before it is reassuring.** Every one of these five pages passed every
UI guard in this repo, and passed the probe itself, right up until the check was able to fail.
