# UI conformance ledger

Cross-run memory for [`/ui-conformance-sweep`](../../.claude/skills/ui-conformance-sweep/SKILL.md).
Every run starts here (its Phase 0) and updates it **in the same PR as the change** — a ledger
written afterwards is a ledger nobody trusts.

The routine has no memory of any prior run, so everything a future run must not re-learn lives in
this file: which surfaces are converted, which were refused and why, and where the `guard:ui`
numbers actually stood on a given day.

## Why the numbers live here and not in prose

The two predecessor design docs measured adoption in sentences. Both drifted, in the flattering
direction — one claimed 57% of pages opted out of `PageShell` while the real figure had reached
82%, and three primitives were described as future work five weeks after they shipped with zero
call sites. `scripts/ui-standard-baseline.json` is now the authority and this file is its diary.
**Never quote an adoption figure from a document — run `pnpm guard:ui`.**

## Status vocabulary

- `open` — a candidate surface, not yet started.
- `in-pr` — a PR is out; do not pick this up.
- `done` — converted and landed; do not re-attempt.
- `rejected: <reason>` — permanent, **human-edit only**. A routine may propose a rejection in its
  report; it may not write one here.
- `blocked-human: <reason>` — needs a decision above a layout call (compliance placement, a
  product/navigation change, a missing control).
- `failed: <reason> (cooldown 2 runs)` — attempted and abandoned; skip for two runs.

## Metric floors — what "done" means per metric

| Metric | Floor | Notes |
|---|---|---|
| `blindSpotPaletteClasses` | **0, already** | Hard zero from day one. Any hit is a regression, never a backlog item. |
| `rawHexLiterals` | 0 | **11** (was 13; two of those were never violations — see the run log). `BrandingProvider`/`AgentCoBranding` carry a genuinely dynamic tenant colour — check before "fixing". |
| `pageShellDrift` | **0, reached 2026-08-18** | Closed by UC-006. Any hit is a regression. The layout already owns page height: `PublicLayout` and `PrivateLayout` both supply it, so `PageShell fullHeight` is for `BareLayout` routes **only** — nesting it under either layout is the bug this metric caught. |
| `nestedInteractive` | **0, reached 2026-08-18** | Closed by #561/#564/#565. Any hit is a regression. |
| `unprefixedMultiColGrid` | 0 | **62.** Mobile breakage — but **not every hit is a defect**, and this is the one metric where driving to zero mechanically would make the UI worse. See UC-010 before touching it. |
| `arbitraryColorValues` | 0 | **3 left** — near a floor. Some are legitimately dynamic (a tenant brand colour); propose a `rejected` row rather than forcing a token. |
| `arbitraryTypeScale` | 0 | **146** (2026-08-24; was 153 on 08-18). The real backlog. A bespoke `text-[11px]`/`w-[240px]` is a rung outside the scale §3 owns — and below `text-xs` it is also a mobile legibility problem, which is where the cheap wins are. |
| `subMinTouchTarget` | **0, reached 2026-08-20** | Closed by [#605](https://github.com/barakatammre84/Homiquity/pull/605) (`31d9dc21`), which took the baseline **232 → 0** *and* fixed the regex that had been miscounting it in both directions — so the 233 this table used to show was itself one of the miscounts. Any hit is now a regression. The two limits still stand, so nobody reads the zero as "touch targets are fine": `.touch-target` is scoped `max-width: 767px`, so a 768px+ touch device is **not** covered; and raw `<button>`s are excluded as too noisy to fail on (33 of them are reported in §0 for human review). |
| `directLucideImports` | 0 (the metric excludes the registry) | **323 files**, unchanged since the metric bootstrapped in #560. |

## Candidates

| id | surface | metrics it would move | risk | status | evidence / PR | updated |
|---|---|---|---|---|---|---|
| UC-001 | `client/src/pages/borrower/URLAForm.tsx` + `urla/**` — the 1003 | touch targets, horizontal scroll | med — governed by `URLA_FORM_REFACTOR_TRAP.md` | `done` | [#566](https://github.com/barakatammre84/Homiquity/pull/566) — rail wraps, 14 controls raised; presentational only | 2026-08-18 |
| UC-002 | `client/src/pages/lending/PreApproval.tsx` + `preApproval/**` — the funnel | `unprefixedMultiColGrid` −2 | med — compliance copy is test-pinned | `done` | [#560](https://github.com/barakatammre84/Homiquity/pull/560) — 320px grids, input rung, AdvisoryPanel reaches mobile | 2026-08-18 |
| UC-003 | URLA §12.2 tunnel vision — the 1003 renders inside `PrivateLayout` with sidebar, header, bell and mobile bottom nav through a ~20-minute form | — (structural) | high | `blocked-human` — stripping the chrome needs a Save-and-exit control that does not exist; shipping it without one traps the borrower | #566 body | 2026-08-18 |
| UC-004 | URLA §12.1 input ceiling — PersonalInfo 22, Employment 17, Property 15, Demographics 14 controls | — (structural) | high | `blocked-human` — sub-stepping changes when fields render; §14 and the trap doc make it a decision, not a layout call | #566 body | 2026-08-18 |
| UC-005 | The `nestedInteractive` class — a link wrapping a button | `nestedInteractive` **122 → 0, closed** | low, but wide | `done` | [#561](https://github.com/barakatammre84/Homiquity/pull/561) batch 1 (78 sites), [#564](https://github.com/barakatammre84/Homiquity/pull/564) batch 2 (24 className-judgment sites), [#565](https://github.com/barakatammre84/Homiquity/pull/565) batch 3 (last 20). `ux-38` in FINDINGS.md. **The metric is now a hard floor at 0 — any hit is a regression, not a backlog item.** | 2026-08-18 |
| UC-006 | `pageShellDrift` — 13 files hand-roll `min-h-screen` while already importing `PageShell` | `pageShellDrift` **13 → 0, closed** | low | `done` | this PR. Not cosmetic: 12 of the 13 nest a second `min-h-screen bg-background` **inside** `PublicLayout`'s own (`client/src/components/layouts/PublicLayout.tsx:25` — `flex min-h-screen flex-col` around a `flex-1` `<main>`), forcing every calculator to ≥100vh of content and pushing the Footer — NMLS ID, Equal Housing, broker-not-lender — below the fold on a two-line page. The 13th (`AgentDashboard`) sits in `PrivateLayout`, whose `<main>` is `flex-1 overflow-y-auto`, so a 100vh child overflows its own scroll container: `min-h-full`, per §15. **The metric is now a hard floor at 0.** | 2026-08-18 |
| UC-007 | `client/src/pages/borrower/Dashboard.tsx` + `components/dashboard/**` — the §15 reference surface | `arbitraryTypeScale` −7 | low | `done` | §15 was already BUILT (bg-surface, bg-accent hero with zero `text-white`, max-w-6xl grid, vertical JourneyTracker, PreApprovedCard, TrustLayer split). Fixed: `min-h-screen`→`min-h-full` per §15, a loading skeleton at the retired `max-w-xl` that snapped ~3x wider on load, 7 bespoke type rungs, 1 sub-44px control | 2026-08-18 |
| UC-009 | `unprefixedMultiColGrid` — the unambiguous 3-to-5-column cases on consumer surfaces | `unprefixedMultiColGrid` −5 (67 → 62) | low | `done` | this PR. `ReferralLink` skeleton was `grid-cols-4` while its loaded content is `grid-cols-2 md:grid-cols-4` — the snap-on-load defect UC-007 found on the dashboard, in a second place. Plus `BuyerProperties` stat cards (a 32px icon + 12px gap inside an ~85px column), `CpaPortal` stat strip, `PartnersJoin`'s licence row (a real `<input>` at ~85px), `OfferCard`'s three-metric row | 2026-08-18 |
| UC-010 | `unprefixedMultiColGrid` — the remaining **62**, which are *not* all defects | `unprefixedMultiColGrid` → 0 | med — **judgment, not a sweep** | `open` | **Do not batch-convert this metric.** A `grid-cols-2` of short label/value pairs is fine at 320px; `BuyingPowerEstimator:115` is a 3-phase progress rail where stacking would be *worse* than the hit; `FirstTimeBuyerHub:237` is a compact 3-tile stat row that is genuinely borderline. Those two were left deliberately: judging them needs a rendered viewport, and per R10 this environment has no layout engine. Triage the rest by column count (3+ first) and by whether the cells contain form controls | 2026-08-18 |
| UC-011 | `client/src/pages/borrower/Dashboard.tsx` + the 14 components it renders — **mobile** | `arbitraryTypeScale` −17, `subMinTouchTarget` −10 | low | `done` | this PR. **First pass caught 6 of 10 sub-44px controls**; a re-audit found four raw `<button>`s the `<Button size="sm">` grep could not see — including the three collapsible toggles (~20px tall) that are the only way to expand the entire secondary detail stack. That miss is why UC-013 exists. 17 labels at `text-[10px]`/`text-[11px]` lifted to the scale's floor (`text-xs`); 6 `size="sm"` buttons are **h-9 = 36px** and got `.touch-target`; the request row in `BorrowerRequests` truncated the task title to ~100px on a phone (36px icon + 24px gaps + a `shrink-0` ~90px CTA out of ~256px of card) — it now stacks under `sm:` with a full-width CTA and a wrapping title; the readiness readout (label + `w-20` bar + %) was ~326px of content on one un-wrapping row inside ~248px of card | 2026-08-18 |
| UC-012 | Borrower dashboard **mobile source order** — the pre-approval letter sits ~3–4 phone screens down | — (information architecture) | med | `blocked-human` | The grid is `grid-cols-1 lg:grid-cols-3` with the wide column first in the DOM, so on a phone the borrower scrolls the whole left column — next-step card, every task row, the full vertical `JourneyTracker` — before reaching `PreApprovedCard`, `ContactCard` and `LoanTeamCard`. For a pre-approved borrower the letter is the thing they opened the app for. **Not fixable by reordering the two column wrappers**: putting the narrow column first buries the primary action instead, and the order actually wanted (next step → letter → tasks → journey → contact → team) interleaves the two columns, which needs the cards flattened into one grid with per-breakpoint placement. That is a restructure of the §15 reference surface, and per R10 there is no layout engine here to check the result. Recommendation: flatten, and place on `lg:` — founder call | 2026-08-18 |
| UC-013 | `subMinTouchTarget` — **233** `size="sm"` buttons (h-9 = 36px) with no `.touch-target`, across 114 files | new metric, ratcheting from 233 | low per site, wide | `done` | Closed by [#605](https://github.com/barakatammre84/Homiquity/pull/605) (`31d9dc21`, merged 2026-08-20) — **a peer, not this routine**, which is the UC-005 lesson repeating: the queue item was still marked `open` here six days after the class hit zero. Originally found by re-auditing UC-011 rather than by the guard, which is the point: this was the **only** DESIGN_SYSTEM accessibility rule with no mechanical check, and it drifted to 233. A manual pass over the dashboard caught 6 of 10 — the metric exists because the human method demonstrably misses ~40%. Convert per surface, never in one sweep | 2026-08-18 |
| UC-008 | **The icon registry is ~20% of the vocabulary the app uses** | would unlock `directLucideImports` | — | `blocked-human` | `lib/icons.ts` covers **36 glyphs**; the client imports **176 distinct** lucide glyphs across ~758 import sites, so **142 have no registry entry** (`Loader2` 45x, `AlertCircle` 32x, `Search` 23x, `Calculator` 22x, `Sparkles` 21x, `CreditCard` 19x…). A page converting today would import from the registry **and** lucide, so the metric would not move and the code would be worse. **This — not neglect — is why the registry has zero adopters five weeks after shipping.** Extending the vocabulary is a §18 "new primitive needs review" decision and a naming decision per concept: propose it, do not do it unilaterally | 2026-08-18 || UC-014 | `client/src/pages/lending/LoanOptions.tsx` + `components/LoanComparisonMatrix.tsx` — the borrower's offers surface | `arbitraryTypeScale` −5 (151 → 146); `PageShell` adoption 49 → 50 of 282 pages | low | `done` | this PR. Three hand-rolled `min-h-screen` wrappers (`:92,:110,:134`) inside `PrivateLayout`'s already-scrolling `<main>` — **the UC-006 defect class, six days after UC-006 closed the metric**, and invisible to `pageShellDrift` because that metric only fires on a file that *also* imports `PageShell` (R10: every count is a floor). ux-36 had named these exact lines. The two chrome-free branches became `<PageShell width="full">`; the main branch is a fragment, because `:135` is a full-bleed hero band that cannot live inside a max-width container. Five sub-`text-xs` rungs lifted — including the Reg Z qualifying disclosure at `LoanComparisonMatrix.tsx:165`, whose copy moved **not one byte** and only got larger (R8). **The conversion is now self-guarding**: reintroducing one wrapper takes `pageShellDrift` 0 → 1 and reds CI — proven, not asserted | 2026-08-24 |

## Run log

| date | target | outcome | guard:ui before → after | PR |
|---|---|---|---|---|
| 2026-08-18 | UC-001 (URLA) | shipped — presentational only | `nestedInteractive` 122 → 44 — **not this change's doing**, see below | [#566](https://github.com/barakatammre84/Homiquity/pull/566) |
| 2026-08-18 | UC-002 (funnel) | shipped | `unprefixedMultiColGrid` 69 → 67 | [#560](https://github.com/barakatammre84/Homiquity/pull/560) |
| 2026-08-18 | UC-007 (borrower dashboard) | shipped; UC-008 raised | `arbitraryTypeScale` 179 → 172 | this PR |
| 2026-08-18 | — (merge of `main`) | five §0 rows were stale after one afternoon | `arbitraryTypeScale` 172 → 170 — **#556/#569/#571's doing, not this branch's** | this PR |
| 2026-08-18 | UC-006 (`pageShellDrift`) | shipped — closed outright | `pageShellDrift` 13 → 0; `rawHexLiterals` 13 → 11 | this PR |
| 2026-08-18 | UC-009 (mobile grids, consumer) | shipped; UC-010 raised | `unprefixedMultiColGrid` 67 → 62 | this PR |
| 2026-08-18 | UC-011 (borrower dashboard, mobile) | shipped; UC-012 raised | `arbitraryTypeScale` 170 → 153 | this PR |
| 2026-08-18 | UC-011 re-audit | 4 more sub-44px controls found; `subMinTouchTarget` metric added | new baseline **233** | this PR |
| 2026-08-20 | UC-013 (`subMinTouchTarget`) | **closed by a peer, not by this routine** — #605, `31d9dc21` | `subMinTouchTarget` 232 → 0 | [#605](https://github.com/barakatammre84/Homiquity/pull/605) |
| 2026-08-24 | UC-014 (Loan Options) | shipped — three `min-h-screen` wrappers, two `PageShell` conversions, five type rungs | `arbitraryTypeScale` 151 → 146; every other metric held | this PR |

**`rawHexLiterals` 13 → 11 is not two fixes.** The guard now strips comments before scanning, and
those two were `#1e3a5f` / `#0F172A` in a JSDoc block on `client/src/components/brand/BrandingProvider.tsx:24`
documenting the *shape* of a tenant-supplied colour. They were never styling and never violations.
A count that falls because the measurement got more honest is not progress, and a run log that
banked it as progress would be the drift this ledger exists to prevent.

**Three metrics are now at a hard floor: `blindSpotPaletteClasses`, `nestedInteractive` and
`pageShellDrift`.** Treat a hit on any of them as a regression to fix on the spot, never as a
queue item.

**Read the ratchet honestly.** The `nestedInteractive` baseline fell 122 → 44 inside the UC-001
commit, and **none of those 78 fixes were UC-001's**: [#561](https://github.com/barakatammre84/Homiquity/pull/561)
("ux-38 batch 1") landed between the guard's bootstrap and that merge, and the guard simply
recorded the improvement the next time it ran. This is the ratchet working — it tightens on any
improvement, whoever made it — but a run log that let the adjacent commit take the credit would
be a falsified record. **When you report a count moving, attribute it: run `git log` over the
baseline file and name the commit that actually did the work.**

The rest of that class closed the same afternoon (#564, #565), which carries its own lesson for
this routine: **a peer can finish your queue item between the moment you write it down and the
moment you open the PR.** UC-005 was drafted `open`, corrected to `in-pr`, and closed `done`
inside one session. Re-read this ledger and `pnpm guard:ui` at the START of the run, not from
notes taken earlier in it.

**Note for the next run, so it is not re-derived:** neither of the URLA's two defects — a
horizontally scrolling step rail, and controls under the 44px floor — is covered by any current
`guard:ui` metric. Both are *written* rules (DESIGN_SYSTEM.md §12.3 and §11) that nothing
enforces, which is exactly why the URLA shipped violating both and they were only found by hand.
Repo-wide today that is **234** `size="sm"` buttons carrying no `.touch-target` across 117 files,
and **17** `overflow-x-auto` occurrences across 13 files — though many of the latter are
legitimate data tables on desktop-operated staff screens, so a metric would need scoping to the
capture path rather than the repo. **Proposing those two metrics is a founder decision, not a
routine one** — put it in a report, do not add them unilaterally.


**This routine did not run between 2026-08-18 and 2026-08-24.** The gap is not neglect in the sweep: the routine was seated on a fleet whose triggers were all `enabled: false`, so six days of ticks produced nothing. The cost is visible above — UC-013 sat `open` here for four days after #605 closed it, and `main`'s baseline had moved under three metrics while this file still quoted the 08-18 numbers. **A ledger is only as good as the cadence that writes it**, which is why the first act of this run was to reconcile the table against `pnpm guard:ui` rather than trust it.

## Metric provenance — read before trusting a number in this file

`arbitraryColorValues` was **split on 2026-08-18**, in the same batch that first used it in anger.
It had counted 116 things and called them colours; **3 were colours** and 107 were font sizes like
`text-[11px]`. A reader acting on "116 arbitrary colour values" would have hunted for colours and
found almost none, and the two classes have different fixes and different reachable floors. They
are now `arbitraryColorValues` (3) and `arbitraryTypeScale` (172, and wider than the old regex — it
also catches `w-[240px]`, `max-w-[…]`, `gap-[…]`).

The lesson generalises, and it is the reason this section exists: **a metric earns trust by being
used, not by being written.** The first surface measured against it exposed the naming defect in
minutes. Expect the same of any metric proposed here — use it on one real surface before treating
its number as fact, and when it turns out to measure something other than its name, fix the name
rather than the reader.
