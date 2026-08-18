# Parked branches — what is on origin and not on `main`, 2026-08-18

Written when the cloud fleet was stood down for local-first development. Every branch below is
**pushed to `origin` and therefore safe** — `git fetch --all --prune --tags` on a laptop copies
all of it. This file exists so none of them is a mystery six weeks from now, which is the failure
this repo has already paid for twice ([#542](https://github.com/barakatammre84/Homiquity/pull/542)
was opened only after 13 commits sat unlanded and invisible for five days).

A dated log, not a living doc: it describes 2026-08-18 and is not maintained.

## Opened as PRs while closing the sessions out

| PR | Branch | What it carries |
|---|---|---|
| [#579](https://github.com/barakatammre84/Homiquity/pull/579) | `claude/local-dev-runbook-freeze` | Local-setup traps measured against a running stack, and the one-line fix that lets `pnpm db:seed` read a local `.env` at all |
| [#581](https://github.com/barakatammre84/Homiquity/pull/581) | `claude/routines-operating-cadence-olj41t` | The `subMinTouchTarget` ratchet (the 44px rule had no guard and drifted to 233) plus the mobile grid fixes |
| [#582](https://github.com/barakatammre84/Homiquity/pull/582) | `claude/homiquity-app-flow-dex52g` | `/apply` progress rail, and removing a pre-highlighted *"No, this is my only income"* — a §13 honesty defect |

Already open before: [#574](https://github.com/barakatammre84/Homiquity/pull/574) (Backend Data
Engineer routine), [#567](https://github.com/barakatammre84/Homiquity/pull/567) (QA sweep
findings), [#542](https://github.com/barakatammre84/Homiquity/pull/542) (draft — its content
landed via #576 except `tests/mcpSoftPullConsentOrder.test.ts`), and dependabot
[#523](https://github.com/barakatammre84/Homiquity/pull/523) / [#524](https://github.com/barakatammre84/Homiquity/pull/524).

## Parked deliberately — each needs a decision, not a merge

**`claude/design-cleanup-visual-tccg20`** — 38 files, +473/−292. *"retire the royal-blue chrome —
quiet light chrome, one emerald accent."* Two reasons it is not a PR: it proposes replacing the
palette that [`DESIGN_SYSTEM.md`](../handbook/design/DESIGN_SYSTEM.md) binds as **Royal Blue
Emerald**, which is a founder call and not a machine's; and it edits
`handbook/design/design_guidelines.md` and `visual-consistency-standard.md`, both of which were
merged into `DESIGN_SYSTEM.md` and moved to [`archive/design/`](../archive/design/) the same day —
so its base documents no longer exist at those paths. Opening it as-is would put a large conflicted
diff in front of a reviewer and misrepresent it as ready. **Decide the direction first; the branch
is the sketch, not the proposal.**

**`claude/routines-code-quality-review-snqxol`** — 35 files, +3,379. The routine-governance half of
the branch #578 was extracted from: `routine-registry-guard.cjs`, CHARTER §12/§13, `registry.json`,
six committed routine definitions, and the CI change that would put the integration lane in `gate`.
**Moot while the fleet is down** — it is machinery for governing scheduled routines, and all twelve
cloud triggers are disabled. Worth landing only if the fleet comes back. The one piece with
standalone value is the CI change (the integration lane runs nowhere today, which is how two real
defects went unobserved until #578 — see its description).

## No merge base with `main` — extraction only

These five share no common ancestor with `main`, so `git merge` and `git rebase` cannot be used on
them at all. Recovering anything means copying files out, which is what #576 did for #542.

`claude/lucid-edison-br5hsb` (#542) · `claude/frontend-standardization-2` ·
`wip/primary-checkout-leftovers` · `wip/rate-pages-search-extraction` ·
`wip/radar-2026-08-08-scenario-simulator-abandoned` · `wip/urla-draft-persistence-copilot`

Check content against `main` before assuming anything is missing — most of what these carry has
since landed by other routes.

## Closed, content preserved as tags

Closed PRs were tagged rather than deleted, so `git fetch --tags` keeps them reachable:
`archive/claude-determined-mccarthy-ozgcqg` (#495) and 18 others under `archive/*`.

## Getting any of them locally

```bash
git fetch --all --prune --tags
git switch -c <name> origin/<name>      # work on one
git clone --mirror https://github.com/barakatammre84/Homiquity.git ~/homiquity-backup.git
```
