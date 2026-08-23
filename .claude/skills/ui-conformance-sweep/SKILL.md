---
name: ui-conformance-sweep
description: Use ONLY when the user explicitly invokes /ui-conformance-sweep or explicitly asks to "run the UI conformance sweep". NEVER auto-load for general UI, styling, design-token, or component questions — those belong to ui-components. This is a scheduled autonomous routine with its own safety rails.
---

# UI Conformance Sweep — the routine that makes the design standard true

**Cadence:** **Saturdays 15:30 local** (local fleet — CHARTER §3). Moved off the CCR fleet
2026-08-23: that seat ran daily on paper and produced **zero reports in its entire life**,
because the CCR fleet does not fire here. Saturday is the only day carrying no other weekly
seat, and 15:30 clears every daily seat by 90 minutes — CHARTER §3: two routines writing code
in the same ten minutes is how a peer's refactor gets clobbered.
**Writes code:** yes — `client/src/**`, visual conformance only.
**Produces:** **one** conformance PR + one report. A clean tick produces neither and says so.
**Authority:** the Fannie Mae *Selling Guide*, edition 08-05-2026, committed at
[docs/fannie-mae/selling-guide/](../../../docs/fannie-mae/selling-guide/) — the policy authority
for eligibility, underwriting, income, credit, property and delivery, controlling over every job
aid in `docs/fannie-mae/`. Cite the section id; never answer a Fannie policy question from memory.
**Contract:** [knowledge-base/routines/CHARTER.md](../../../knowledge-base/routines/CHARTER.md)
wins over this file on any conflict; say so in the report rather than following the stale copy.
The standard you enforce is
[handbook/design/DESIGN_SYSTEM.md](../../../knowledge-base/handbook/design/DESIGN_SYSTEM.md) —
read it, never a summary of it.

## Why this routine exists

The design system was never missing. Its predecessor doc — now archived at
[`archive/design/design_guidelines.md`](../../../knowledge-base/archive/design/design_guidelines.md),
**quarantined, do not act on it** — opened *"Royal Blue Emerald
(Better.com-style conversion clarity)"* and specified mobile-first forms, sticky CTAs and 44px
touch targets — and then, for five weeks, nobody propagated any of it. The foundations shipped
and stopped: `PageShell` reached 17% of pages, the icon registry and the `<Heading>`/`<Text>`
primitives shipped with **zero call sites**, and the docs still called all three future work
while quoting an adoption figure that had drifted in the flattering direction.

CHARTER §6a names the cause in one line: **a standard nobody is assigned to propagate is a
preference.** It then assigned the sweep as a *"may"* to two routines that already have other
jobs — so no run was ever judged on it. This routine is the fix: adoption is somebody's daily
number.

### What it catches that no other control does

`guard:tokens` answers one question (is colour bypassing the tokens). `guard:ui` counts seven
more but cannot fix anything. Primary Engineer builds the roadmap; the Wiring Audit chases
capture-path defects; Refactor Radar is **forbidden** visual changes by its own R6. Nothing else
converts a surface from the old shape to the standard — which is why 233 of 281 pages still
hand-roll their own geometry.

## Rails

**Binding. Each maps to a failure this program is designed to prevent.**

- **R1 — Invocation.** Run only on an explicit `/ui-conformance-sweep` or a scheduled-task prompt
  naming this routine. Never self-start from a passing mention of UI work.

- **R2 — Lane.** `client/src/**` for **visual conformance only**, plus
  `knowledge-base/ui-conformance/**` and your report. **Never `client/src/components/ui/**`** —
  those are vendored shadcn primitives and changing one restyles the whole app from underneath
  every other surface. Server, shared, schema and tests-as-behaviour are out of lane entirely.

- **R2a — Tenant white-label: semantic tokens are the mechanism, literals are the breakage.**
  **193 of the 281 non-test pages are authed** (borrower 56, staff 48, lending 27, admin 23,
  agent-broker 26, homeowner 8, realtor-engine 4, profile 1) and every one of them renders
  inside `BrandingProvider`, which writes the tenant's own **values** for `--primary`,
  `--sidebar`, `--ring`, `--accent` and their foregrounds
  ([`brand/BrandingProvider.tsx:140-156`](../../../client/src/components/brand/BrandingProvider.tsx))
  onto an inline-styled `display: contents` wrapper (`:197`), from which they cascade to
  everything beneath.

  So the intuition to distrust is *"colour is risky on authed pages, restyle structure only"* —
  it is **backwards**. A semantic class resolves to whatever that tenant's value is, which is
  the white-label feature working. **Converting a literal to a semantic token is what makes
  white-label work**, and it is the direction `guard:tokens` already ratchets (0 raw palette
  classes, ≤97 bare white/black).

  What actually breaks a tenant is the opposite:
  - **A hex or palette literal** (`bg-emerald-600`, `#047756`, `text-[#0B1E19]`) — it ignores the
    override, so one tenant silently gets another's brand. Convert these on sight, authed or not.
  - **Redefining the value** of `--primary`, `--accent`, `--sidebar` or `--ring` for an authed
    surface — in `index.css`, a `style=`, or a Tailwind arbitrary value. Those four belong to the
    tenant; you may *use* them anywhere and must **never** *set* them.

  Everything else — type, spacing, motion, radius, elevation, `PageShell` adoption, the icon
  registry — is unconstrained on every surface. **Colour is in scope everywhere; only those four
  token definitions are not.**

  Prove it on the first authed target of any run: render under a tenant brand and confirm
  `--primary` still resolves to the tenant's value rather than a literal you introduced.

- **R3 — Non-overlap with Refactor Radar, and with everyone else.** Radar's R6 forbids visual and
  copy changes; you do *only* visual changes and **never** UI/logic separation — the two lanes
  are complements, and touching the other's is how two PRs collide on one file. Before choosing a
  target, read in this order: `origin/main` → open PRs and their changed files →
  [`routines/REGISTER.md`](../../../knowledge-base/routines/REGISTER.md) →
  [`refactor-radar/LEDGER.md`](../../../knowledge-base/refactor-radar/LEDGER.md). A file in an
  open PR or carrying an open ledger row is off the table this run — pick another surface rather
  than planning to rebase. `ListAgents` is the weakest signal and is read last, if at all: "no
  reachable agents" has been returned during an active three-way collision.

- **R4 — One surface per PR, one CI cycle.** A surface is a page or a coherent group (one
  dashboard, one calculator, one flow) — not a file count. Follow DESIGN_SYSTEM.md §16's adoption
  checklist as the procedure. A 200-file mechanical sweep is unreviewable and will be rejected;
  so will a diff that mixes three unrelated surfaces to inflate the numbers.

- **R5 — The ratchet is the deliverable.** Run `pnpm guard:ui` before and after. Counts must go
  **down**, never up, and the tightened `scripts/ui-standard-baseline.json` is committed in the
  **same PR** — that is what makes the sweep irreversible. Report both numbers. **Never quote an
  adoption figure from a document**; run the guard. And when a count moves, **regenerate
  DESIGN_SYSTEM.md §0 with `pnpm guard:ui --write-table`** and commit it in the same PR — that
  table is generated, the guard fails when it drifts, and hand-editing it is the failure it
  exists to prevent. The predecessors' numbers rotted precisely
  because they were prose.

- **R6 — Visual only (DESIGN_SYSTEM.md §14).** No `react-hook-form` rewiring, no Zod schema
  edits, no API payload changes, no query-key changes in the same commit. Capture fields feed the
  URLA and the ULDD/UCD delivery package, and a large styling diff is exactly where a dropped
  field hides best. If a conversion *needs* a logic change, that is two PRs, and the logic one is
  not yours.

- **R7 — Off limits.** CHARTER §6's always-off-limits list in full. Plus: capture-path files
  under an active Wiring Audit claim; and — binding, with its own document —
  [`handbook/URLA_FORM_REFACTOR_TRAP.md`](../../../knowledge-base/handbook/URLA_FORM_REFACTOR_TRAP.md).
  On `URLAForm.tsx` specifically: do not extract `buildPayload`/`buildSectionsPayload`, the
  `STEPS` table or the hydration effect, and **never add `React.memo`, `useCallback`, `useMemo`
  or a debounce to any of its children** — that is the stale-closure path that writes one
  borrower's PII permanently into the other's rows. Audit your diff against those hazards; do not
  merely assert you avoided them.

- **R8 — Compliance copy is byte-for-byte.** Strings pinned by tests survive a restyle unchanged
  — `FUNNEL_SOFT_PULL_CONSENT_TEXT` (persisted as `credit_consents.disclosure_text`), the funnel
  footer disclosures, the Reg N never-"Approved" vocabulary. **Never weaken a consent gate, a
  disclosure gate or an FCRA pull gate to make a layout nicer**, and never move a disclosure to a
  place the borrower is less likely to read it. Where a disclosure *belongs* is a compliance
  decision — propose it, never ship it.

- **R9 — PR-only.** Never merge, never push to `main`, never enable auto-merge, never force-push.
  `git add` explicit paths — never `git add .` or `-A`. The founder merges: a merge to `main` is
  a production deploy (CHARTER §1b, L3).

- **R10 — Verification honesty.** happy-dom has **no layout engine**, and there is no Playwright,
  Storybook or axe in this repo — CHARTER §6 forbids adding one. So nothing here can prove a
  rendered layout, a mobile viewport or a contrast ratio in situ. Report the commands you
  actually ran. A green `guard:ui` proves only its own seven metrics, and its className counts
  see literal double-quoted strings only — classes built in `cn()`, template literals or cva
  variants are invisible, so **every count is a floor, not a total**. Where a change is only
  verifiable by eye, say so and leave it for a human.

- **R11 — Selling Guide.** Every Fannie policy claim cites a section id that resolves in
  `docs/fannie-mae/selling-guide/section-index.tsv` and is read out of the committed text this run
  — never from memory. An id the index does not know is a **wrong** citation, not an old one: the
  Guide renumbers, and the stale URL used to return HTTP 200 rather than 404. A value read out of a
  **table** is unverified until you open the PDF page — borderless tables lose their row/column
  association in extraction. Where the Guide and a job aid disagree the Guide controls, and the
  conflict escalates rather than being resolved here. Enforced in CI by `pnpm guard:authority`
  (TEAM_PRACTICES §10).
- **R12 — CHARTER §8, verbatim.** The escalation runbook binds unchanged.

## Phase 0 — memory before work, every run

You have no memory of any prior run. The memory is in the repo:

1. [`knowledge-base/ui-conformance/LEDGER.md`](../../../knowledge-base/ui-conformance/LEDGER.md)
   — converted surfaces, refusals with reasons, and the `guard:ui` trend. **A surface marked
   `done` or `rejected` is not re-attempted**; a `rejected` row is human-edited only.
2. `pnpm guard:ui` — today's real counts, and the queue.
3. [`feature-review/FINDINGS.md`](../../../knowledge-base/feature-review/FINDINGS.md) — an open
   `ux-NN` row on your target is context you must read before restyling around it.
4. DESIGN_SYSTEM.md §0's adoption table — and if a row there disagrees with the guard, **the
   guard is right and the doc is a bug**; fix the doc in your PR.

## How to pick the target

Rank by borrower impact, not by count. In order: the capture path (funnel, URLA, consent,
verification) → borrower-facing surfaces they reach after applying → public marketing →
staff/admin. A 40-hit admin screen is worth less than a 3-hit consent screen. At equal impact,
prefer the surface that closes a whole metric for a directory, because a metric that reaches zero
somewhere is a rule that can be enforced there forever after.

## Report

`knowledge-base/routines/reports/<YYYY-MM-DD>-ui-conformance-sweep.md`, CHARTER §9 format:
STATUS line + one-line verdict · ⛔ human actions (or none) · summary ≤5 sentences · evidence with
`file:line` or command output for every claim, including the before/after `guard:ui` counts ·
proposed tickets for Evening Triage. **Never edit `CTO_ROADMAP.md`** — CHARTER §4 gives Triage
exclusive authority over §0–§3. Commit as `docs(routine): ui-conformance-sweep <date>`.

A run that finds the queue blocked — every candidate claimed, or the ratchet already at its floor
for the surfaces in reach — writes three sentences saying so and stops. That is a success. What
is *not* acceptable is an idle tick: if peers hold every target, work CHARTER §5's assist ladder
(fix a red CI, verify an unreviewed PR, supply a missing test) before reporting nothing.
