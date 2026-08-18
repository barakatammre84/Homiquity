# Browser probe — seeing the product in a real renderer

> Tool documentation, not a living doc: it is verified against
> `scripts/browser-probe.cjs`, so it goes stale when that script changes, not on a date. It
> deliberately carries **no** `Freshness:` line — `doc-freshness-guard.cjs` reads a fixed list of
> seven living docs, and a freshness line outside that list is a claim nothing checks.

`scripts/browser-probe.cjs` renders a page in Chromium and answers the questions a text scan
cannot. **It adds no dependency** — Chromium is already on disk in any environment that has it
(Playwright's browser cache via `PLAYWRIGHT_BROWSERS_PATH`, or a system Chrome), and Node 22 ships
a WebSocket client in core, so the Chrome DevTools Protocol is reachable with `node` alone.
`package.json` and `pnpm-lock.yaml` are untouched, which is what
[CHARTER §6](../routines/CHARTER.md) actually protects.

## Why it exists

Until 2026-08-18 every UI change in this repo shipped on a text scan. `pnpm guard:ui` says so about
itself: no layout engine, and its className metrics see only literal double-quoted strings — so
`unprefixedMultiColGrid` is a **proxy** for "breaks at 320px", never a measurement. The client test
lane is happy-dom, which has no layout at all. Nothing here could answer *does this page actually
work at 320 pixels*.

## Usage

```bash
# Start the app first (dev on 5001, worktree on 5002, or the built bundle on any port)
node scripts/browser-probe.cjs --url http://localhost:5001/calculators --width 320
node scripts/browser-probe.cjs --url <url> --out /tmp/shot.png --full-page
node scripts/browser-probe.cjs --url <url> --expr "document.querySelectorAll('[data-testid]').length"
```

| Flag | Meaning |
|---|---|
| `--url` | required |
| `--width` / `--height` | viewport; `≤480` turns on mobile emulation (or force it with `--mobile`) |
| `--out` | write a PNG |
| `--full-page` | capture beyond the viewport |
| `--expr` | evaluate any JS in the page and print the result |
| `--timeout` | ms to wait for `load` (default 30000) |

Exit **1** on: no browser found, no server, a page error, horizontal overflow, or a broken image.
Exit **0** otherwise. Touch-target and accessible-name counts are printed but do **not** fail the
run — see the caveat below.

## The four built-in checks

1. **Horizontal overflow at the requested width** — `scrollWidth > innerWidth`, with the offending
   elements named (tag, `data-testid`, class, geometry). This is DESIGN_SYSTEM §12.3's real
   question rather than its proxy.
2. **Images that failed to load** (`naturalWidth === 0`). Before calling one a new defect, compare
   `/api/health`'s `commit` against `origin/main`: a hashed-asset 404 with drift > 0 is a **stale
   deploy**, not a missing file. That mistake has been made here twice.
3. **Interactive elements under 44×44 px** (DESIGN_SYSTEM §11).
4. **Interactive elements with no accessible name** — no `aria-label`, `title`, or text.

## What it still cannot do — and what §10 therefore still forbids claiming

- **It does not measure contrast.** No colour-contrast check exists in this repo.
- **It is not an accessibility audit.** There is no axe here. Checks 3 and 4 are two mechanical
  rules out of WCAG, not a verdict.
- **One viewport is not "mobile verified".** It is one width, one height, one engine.
- **The 44 px count includes inline text links in prose**, where a touch-target rule is arguably
  not aimed. Read the list, don't quote the number: it is a starting point for judgement, not a
  defect count. Same discipline `guard:ui` demands — every count it prints is a floor.

So the rail in [CHARTER §10](../routines/CHARTER.md) stands, in its amended form: **report the
command you ran and what it printed.** That is what turns "verified in a browser" from a claim into
a fact, and it is the only form of that claim anyone here may make.

## Deliberately not in CI

The GitHub runner's browser is not this repo's to guarantee, and a gate that depends on a browser
being present fails for reasons no diff caused — the same argument that keeps `doc-freshness` out
of the merge gate. Run it in a session, paste the output into the PR.

## First run, 2026-08-18

Against the built bundle on a freshly-seeded database:

- `/` at 1280 and at 320 — no overflow, no broken images.
- `/calculators` at 320 — no overflow; **19 interactive elements under 44 px**, including the whole
  footer link set at 36 px tall and the mobile-menu wordmark at 32 px. Measured, not inferred, and
  not visible to any guard in this repo before that day.
