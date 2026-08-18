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
| `rawHexLiterals` | 0 | 3 files. Two are `BrandingProvider`/`AgentCoBranding` where a tenant colour is genuinely dynamic — check before "fixing". |
| `pageShellDrift` | 0 | `min-h-screen` in a file that *also* imports `PageShell` — unambiguous drift, the cheapest wins. |
| `nestedInteractive` | **0, reached 2026-08-18** | Closed by #561/#564/#565. Any hit is a regression. |
| `unprefixedMultiColGrid` | 0 | Mobile breakage. Capture path first. |
| `arbitraryColorValues` | 0 | **3 left** — near a floor. Some are legitimately dynamic (a tenant brand colour); propose a `rejected` row rather than forcing a token. |
| `arbitraryTypeScale` | 0 | **172** — the real backlog. A bespoke `text-[11px]`/`w-[240px]` is a rung outside the scale §3 owns. |
| `directLucideImports` | 1 | `client/src/lib/icons.ts` **is** the registry and the one permitted importer. **⚠️ Effectively frozen — see UC-008 before planning any work against this metric.** |

## Candidates

| id | surface | metrics it would move | risk | status | evidence / PR | updated |
|---|---|---|---|---|---|---|
| UC-001 | `client/src/pages/borrower/URLAForm.tsx` + `urla/**` — the 1003 | touch targets, horizontal scroll | med — governed by `URLA_FORM_REFACTOR_TRAP.md` | `done` | [#566](https://github.com/barakatammre84/Homiquity/pull/566) — rail wraps, 14 controls raised; presentational only | 2026-08-18 |
| UC-002 | `client/src/pages/lending/PreApproval.tsx` + `preApproval/**` — the funnel | `unprefixedMultiColGrid` −2 | med — compliance copy is test-pinned | `done` | [#560](https://github.com/barakatammre84/Homiquity/pull/560) — 320px grids, input rung, AdvisoryPanel reaches mobile | 2026-08-18 |
| UC-003 | URLA §12.2 tunnel vision — the 1003 renders inside `PrivateLayout` with sidebar, header, bell and mobile bottom nav through a ~20-minute form | — (structural) | high | `blocked-human` — stripping the chrome needs a Save-and-exit control that does not exist; shipping it without one traps the borrower | #566 body | 2026-08-18 |
| UC-004 | URLA §12.1 input ceiling — PersonalInfo 22, Employment 17, Property 15, Demographics 14 controls | — (structural) | high | `blocked-human` — sub-stepping changes when fields render; §14 and the trap doc make it a decision, not a layout call | #566 body | 2026-08-18 |
| UC-005 | The `nestedInteractive` class — a link wrapping a button | `nestedInteractive` **122 → 0, closed** | low, but wide | `done` | [#561](https://github.com/barakatammre84/Homiquity/pull/561) batch 1 (78 sites), [#564](https://github.com/barakatammre84/Homiquity/pull/564) batch 2 (24 className-judgment sites), [#565](https://github.com/barakatammre84/Homiquity/pull/565) batch 3 (last 20). `ux-38` in FINDINGS.md. **The metric is now a hard floor at 0 — any hit is a regression, not a backlog item.** | 2026-08-18 |
| UC-006 | `pageShellDrift` — 13 files hand-roll `min-h-screen` while already importing `PageShell` | `pageShellDrift` −13 → 0 | low | `open` | the cheapest metric to close outright; DESIGN_SYSTEM.md §16 is the procedure | 2026-08-18 |
| UC-007 | `client/src/pages/borrower/Dashboard.tsx` + `components/dashboard/**` — the §15 reference surface | `arbitraryTypeScale` −7 | low | `done` | §15 was already BUILT (bg-surface, bg-accent hero with zero `text-white`, max-w-6xl grid, vertical JourneyTracker, PreApprovedCard, TrustLayer split). Fixed: `min-h-screen`→`min-h-full` per §15, a loading skeleton at the retired `max-w-xl` that snapped ~3x wider on load, 7 bespoke type rungs, 1 sub-44px control | 2026-08-18 |
| UC-008 | **The icon registry is ~20% of the vocabulary the app uses** | would unlock `directLucideImports` | — | `blocked-human` | `lib/icons.ts` covers **36 glyphs**; the client imports **176 distinct** lucide glyphs across ~758 import sites, so **142 have no registry entry** (`Loader2` 45x, `AlertCircle` 32x, `Search` 23x, `Calculator` 22x, `Sparkles` 21x, `CreditCard` 19x…). A page converting today would import from the registry **and** lucide, so the metric would not move and the code would be worse. **This — not neglect — is why the registry has zero adopters five weeks after shipping.** Extending the vocabulary is a §18 "new primitive needs review" decision and a naming decision per concept: propose it, do not do it unilaterally | 2026-08-18 |

## Run log

| date | target | outcome | guard:ui before → after | PR |
|---|---|---|---|---|
| 2026-08-18 | UC-001 (URLA) | shipped — presentational only | `nestedInteractive` 122 → 44 — **not this change's doing**, see below | [#566](https://github.com/barakatammre84/Homiquity/pull/566) |
| 2026-08-18 | UC-002 (funnel) | shipped | `unprefixedMultiColGrid` 69 → 67 | [#560](https://github.com/barakatammre84/Homiquity/pull/560) |
| 2026-08-18 | UC-007 (borrower dashboard) | shipped; UC-008 raised | `arbitraryTypeScale` 179 → 172 | this PR |

**Two metrics are now at a hard floor: `blindSpotPaletteClasses` and `nestedInteractive`.** Treat
a hit on either as a regression to fix on the spot, never as a queue item.

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
