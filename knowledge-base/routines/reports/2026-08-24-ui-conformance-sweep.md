# UI Conformance Sweep — 2026-08-24

**STATUS: OK** — the borrower's Loan Options surface converted; `arbitraryTypeScale` **151 → 146**,
and the fix is now self-guarding (reintroducing it reds CI).

## ⛔ Human actions

1. **`LoanOptions.tsx:290` renders the public marketing `<Footer />` inside `PrivateLayout`**, above
   `MobileBottomNav`'s reserved space (ux-36 named this). That Footer carries the NMLS identifier,
   the Equal Housing notice and the broker-not-lender disclosure, so removing it from an authed page
   is a **compliance-placement decision, not a layout call** (R8: where a disclosure belongs is
   proposed, never shipped). Left in place, untouched.
2. **`pageShellDrift` reads 0 and that zero is narrower than it looks.** The metric only fires on a
   file that *also* imports `PageShell`, so a page that hand-rolls `min-h-screen` and never imports
   the shell is invisible to it. Census below: **13 page files** under a layout that already supplies
   height. Whether to widen the metric is a founder call (the ledger forbids a routine adding one
   unilaterally).
3. **This routine did not run between 2026-08-18 and 2026-08-24.** The visible cost is in the ledger:
   UC-013 sat `open` for four days after #605 closed it, and three metric numbers in that file had
   drifted from `main`. Cadence, not the sweep, is the failure mode here.
4. Still `blocked-human` from prior runs, unchanged: **UC-003**, **UC-004**, **UC-012** (borrower
   dashboard mobile source order), **UC-008** (icon registry vocabulary), and **UC-010**
   (`unprefixedMultiColGrid`'s remaining 62 — deliberately not batch-converted).

## Summary

Converted **UC-014, the borrower's Loan Options surface** (`/loan-options/:id`, authed under
`PrivateLayout`): three hand-rolled `min-h-screen` wrappers removed, the two chrome-free branches
converted to `<PageShell width="full">`, and five sub-`text-xs` rungs lifted to the scale. The
wrappers were the **UC-006 defect class six days after UC-006 "closed" the metric** — a 100vh child
inside a `flex-1 overflow-y-auto` `<main>` is taller than its own scroll container — and the guard
could not see them, which is this run's real finding. The Reg Z qualifying disclosure at
`LoanComparisonMatrix.tsx:165` moved **not one byte** and only got larger. Four items were refused
rather than shipped, the loudest being the `<Footer />` above. `arbitraryTypeScale` ratcheted
**151 → 146**; every other metric held, including four now at a hard floor.

## Evidence

### The ratchet (R5) — both runs, in the worktree, off `origin/main` @ `b74d06ae`

Before:

```
OK       pageShellDrift: 0 file(s) (at baseline)
OK       directLucideImports: 323 file(s) (at baseline)
OK       nestedInteractive: 0 occurrence(s) (at baseline)
OK       rawHexLiterals: 11 occurrence(s) (at baseline)
OK       arbitraryColorValues: 3 occurrence(s) (at baseline)
OK       arbitraryTypeScale: 151 occurrence(s) (at baseline)
OK       blindSpotPaletteClasses: 0 occurrence(s) (at baseline)
OK       subMinTouchTarget: 0 occurrence(s) (at baseline)
OK       unprefixedMultiColGrid: 62 occurrence(s) (at baseline)
UI standard OK: 523 files scanned, 9 metrics at or below baseline.
```

After:

```
TIGHTEN  arbitraryTypeScale: 151 → 146 occurrence(s). Ratchet lowered.
Baseline tightened → scripts/ui-standard-baseline.json (commit it).
UI standard OK: 523 files scanned, 9 metrics at or below baseline.
```

`scripts/ui-standard-baseline.json` is committed in this PR (`arbitraryTypeScale: 146`,
`updated: "2026-08-24"`). The first post-change run **failed** on §0's generated table going stale;
regenerated with `pnpm guard:ui --write-table` and committed — `PageShell` page geometry
**17% → 18%** (49 → 50 of 282 page files), `arbitraryTypeScale` **151 → 146**. Never hand-edited.

### What changed

| file:line (pre-change) | change |
|---|---|
| `client/src/pages/lending/LoanOptions.tsx:92,110,134` | three `<div className="min-h-screen">` wrappers removed |
| `client/src/pages/lending/LoanOptions.tsx:91,109` | loading + error branches → `<PageShell width="full">` |
| `client/src/pages/lending/LoanOptions.tsx:134` | main branch → fragment (the `:135` hero band is full-bleed) |
| `client/src/components/LoanComparisonMatrix.tsx:95,98,117` | `text-[10px]` → `text-xs` |
| `client/src/components/LoanComparisonMatrix.tsx:142,165` | `text-[11px]` → `text-xs` |

`:165` is the Reg Z qualifying disclosure (*"…not a commitment to lend"*, ux-33's subject). The diff
on that line touches `className` only — the string is byte-identical, is not relocated, and is now
rendered **larger**, the only direction R8 permits.

### The conversion is guarded, not merely done — proven by reintroduction

Before this PR the file had no `PageShell` import, so its three wrappers were invisible to
`pageShellDrift`. With the import present, putting one back:

```
FAIL  pageShellDrift: 1 file(s), baseline 0 (+1)
```

restored → `OK  pageShellDrift: 0 file(s) (at baseline)`. A hard-floor metric now covers this page.

### R2a — the white-label seam still resolves to the tenant

`LoanOptions` is authed (`App.tsx:425` → `BorrowerPage` → `PrivateLayout`), so it renders inside
`BrandingProvider`. Harness (scratchpad, **not committed** — R6 keeps the diff visual-only) rendered
the two edited components under `<BrandingProvider brand={{ primaryColor: "#1e3a5f" }}>`:

```
Test Files  1 passed (1)   Tests  1 passed (1)
```

asserting `--primary` on the branding seam resolves to **`214 52% 25%`** — the tenant's hex converted
to the token triplet — that the converted markup sits inside that seam, and that the rendered HTML
contains no hex literal. This diff sets none of `--primary` / `--sidebar` / `--ring` / `--accent`
and introduces no colour value; the surface's `from-primary/5 to-surface` was already semantic.
*(First assertion failed on a triplet I computed by hand — the provider's own conversion is
authoritative and the expectation was corrected to it.)*

### The bundle ratchet — 4 bytes, traced before the baseline was touched

CI's `gate` went red on `guard:bundle`: the eager entry bundle grew **526,640 → 526,644 raw bytes**.
The pre-push hook does not build, so this is exactly the class it cannot catch. Rather than bump the
number, both sides were built and compared:

```
origin/main  → bundle-size-guard: 526,640 raw bytes (at baseline, no regression). ✅
this branch  → bundle-size-guard: FAIL — grew 4 raw bytes (+0.0%)
```

So the bytes are this branch's. They are **one preload-manifest index**, not new eager code — the
`__vite__mapDeps` list for the `LoanOptions` route gained the entry for the *already-existing*
shared `PageShell` chunk:

```
main    import("./LoanOptions-DFGNFscq.js"),__vite__mapDeps([108,1,2,109,28,100,6,47,110,111,112,8,113,114,99,16,82,51])
branch  import("./LoanOptions-Bjo1zhyX.js"),__vite__mapDeps([108,1,2,109,28,100,6,47,110,111,112,113,8,114,115,99,16,82,51])
```

Both builds emit **268 chunks** and `PageShell-*.js` exists in both, so nothing was newly bundled and
nothing moved into the eager graph — the growth is the four characters `113,`. `eagerRawBytes` is
raised to **526,644** in this PR with that accounting, which is the guard's own documented case.

**For the next run, so it is not re-derived: every route that adopts `PageShell` costs ~4 eager bytes
in the preload manifest.** A multi-route adoption PR will show a proportional, harmless bump — trace
it to the manifest before believing it is real weight. Four open PRs (#716, #657, #648, #641) also
carry this file; like §0's table, whoever lands second regenerates.

### Other gates

```
pnpm guard:bundle  → 526,644 raw (baseline raised by the 4 accounted bytes above) ✅
pnpm guard:tokens  → 0 raw palette occurrences · 97 white/black literals (both at baseline) ✅
pnpm check         → clean (tsc, no output)
pnpm test:client   → Test Files 125 passed (125) · Tests 846 passed (846)
```

### Refusals — proposed, not written as `rejected` rows (that is human-edit only)

| # | site | why refused |
|---|---|---|
| 1 | `LoanComparisonMatrix.tsx:81` `min-w-[640px]` | The table is already inside `overflow-x-auto`. A comparison table's minimum width is not a type-scale rung; forcing it into the scale collapses the columns. Propose `rejected`. |
| 2 | `loanOptions/LoanOptionCard.tsx:61` `grid-cols-2` | Two short label/value cells. UC-010's standing judgment: that shape is fine at 320px. Left deliberately. |
| 3 | `LoanOptions.tsx:290` `<Footer />` | Compliance placement — see ⛔ 1. |
| 4 | `LoanOptions.tsx:135` full-bleed hero band → `PageShell` | Cannot live inside a max-width container; converting it restructures the rendered layout and **R10 says nothing here can verify that**. |

### Claim check (R3), in the prescribed order

`origin/main` (fetched, `b74d06ae`) → 21 open PRs and their changed files → `REGISTER.md` →
`refactor-radar/LEDGER.md`. Neither edited file appears in any open PR. **Adjacency, stated:** #689
holds `loanOptions/LoanLetterButton.tsx` and #657 holds `loanOptions/MarketPricingSection.tsx` in the
same directory — neither is touched here. Claim row added to `REGISTER.md` **before** the first edit.

## Proposed tickets (for Evening Triage — never edited into the roadmap here)

1. **Widen `pageShellDrift`, or add a sibling metric, to see page files that hand-roll `min-h-screen`
   without importing `PageShell`.** Comment-stripped census on this branch: **35** such page files,
   of which **22 are `BareLayout` routes where the wrapper is correct** — leaving **13 candidates**
   under a layout that already supplies height: `admin/AdminDashboard`, `agent-broker/{BrokerDashboard,
   FindAnAgent}`, `borrower/{BuyerProperties,RenterHome}`, `lending/BorrowerDealComparison`,
   `not-found`, `public/{FirstTimeBuyer,Landing,Refinance,SelfEmployed,VALoans,Waitlist}`. Not a
   sweep — several sit in open PRs or under Radar rows, and each needs a per-file judgment. **A
   routine may not add a metric unilaterally; this is a founder decision.**
2. **Finish ux-36's remainder.** Verified still present: `BorrowerDealComparison.tsx:85,100,103`
   (`min-h-screen` **and** `container mx-auto`, both named as prohibited) and `LoanEstimate.tsx:228`
   (`<ScrollArea className="h-[calc(100vh-64px)]">` nested inside the already-scrolling `<main>`).
   Both are the same class this run fixed, on adjacent Domain-6 surfaces.
3. **Decide the `<Footer />` question once, for every authed page** — not per surface. ⛔ 1.
4. **Re-seat this routine's cadence.** ⛔ 3.

## Deviation from the invoking prompt

The scheduled-task prompt asked for the report at `…/reports/2026-08-24-ui-conformance.md`.
CHARTER §9 specifies `<YYYY-MM-DD>-<routine-id>.md` and §3 gives the routine id as
`ui-conformance-sweep`; SKILL.md agrees. CHARTER wins on conflict, so this file is
`2026-08-24-ui-conformance-sweep.md`, and the difference is stated here rather than followed silently.

STATUS: OK
