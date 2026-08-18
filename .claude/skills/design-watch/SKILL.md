---
name: design-watch
description: Use ONLY when the user explicitly invokes /design-watch or explicitly asks to "run the design watch routine". NEVER auto-load for general UI, styling, component, or UX questions — those belong to ui-components and the app-guide. This is a scheduled autonomous routine with its own safety rails.
---

# Design Watch — looping autonomous UI/UX conformance routine

The standing guard on **question B** of the routine charter ("is the borrower and
partner experience best-in-class?") for the *visual* half: every surface conforms
to **Calm Emerald** (quiet light chrome, one emerald accent, hierarchy from type +
whitespace) and the visual-consistency standard, and stays WCAG 2.1 AA. One run =
one audited surface batch + at most ONE small conformance PR, never merged by you.

Born 2026-08-18 from the Calm Emerald repaint: the royal-blue chrome had accreted
for six weeks with nobody watching for on-screen noise as a *class* of defect.
This routine exists so design drift is caught weekly, not at the next repaint.

## Authorities (read before acting, in this order)

1. [`knowledge-base/routines/CHARTER.md`](../../../knowledge-base/routines/CHARTER.md) — the
   suite contract. §5 claim lock, §6 territory, §9 report format, §10 honesty rails
   ALL bind this routine; where this file and the charter disagree, the charter wins.
2. [`knowledge-base/handbook/design/design_guidelines.md`](../../../knowledge-base/handbook/design/design_guidelines.md)
   (the design language) + [`visual-consistency-standard.md`](../../../knowledge-base/handbook/design/visual-consistency-standard.md)
   (the operational checklist). Code wins over both: `client/src/index.css`,
   `tailwind.config.ts`, `client/src/components/ui/**`.
3. [`knowledge-base/design-watch/LEDGER.md`](../../../knowledge-base/design-watch/LEDGER.md) —
   this routine's shared memory: the surface rotation, open findings (DW-###), and
   what previous runs shipped. Reconcile it against merged PRs before ranking.

## Rails (non-negotiable)

R1. Explicit invocation only (/design-watch or a scheduled-task prompt naming it);
    otherwise STOP.
R2. Work in a fresh worktree off current `origin/main`; run the charter §5 claim
    lock first (open PRs of any label = claimed files; REGISTER.md; assist ladder
    before new work). Never work in the primary checkout.
R3. PR-only. Never merge, never enable auto-merge, never push to main. One code PR
    per run at most; findings that don't fit go to the ledger, not a second PR.
R4. **Visual-conformance changes only, zero behavior change**: classNames, layout
    scaffold (PageShell adoption), token usage, icon-registry swaps, EmptyState
    adoption. Never: business logic, data fetching, query keys, routes, forms.
    Every existing `data-testid` is preserved byte-for-byte.
R5. **No copy changes.** Words on regulated surfaces are compliance-gated (Reg Z
    trigger terms, Reg N approval language) — a visual routine must never reword;
    flag copy findings to the ledger for compliance-watch/the founder instead.
R6. Territory: `client/src/**` **minus `components/ui/**`** (vendored primitives
    change only with a human), plus `knowledge-base/design-watch/**`. The charter's
    always-off-limits list applies on top. Token files (`index.css`,
    `tailwind.config.ts`) are **flag-only**: a token change is a design-language
    change and belongs to the founder, not a routine.
R7. Diff cap ≤300 changed lines of production code; prefer several small runs over
    one sweeping one. Verify loop: `pnpm check` → `pnpm test` → `pnpm guard:tokens`
    (+ the full `guard:*` set) → `pnpm build`; max 5 attempts, then ledger the
    failure and ship no code.
R8. Never fabricate a visual verdict: a claim about rendered output needs either a
    screenshot from a live dev server (worktree port 5002 — may not start in an
    unattended run; say so plainly) or exact `file:line` class evidence.

## One iteration

1. **Phase 0 — sync** (charter §5, mandatory): fetch, read what merged, list open
   PRs + claimed files, reconcile the ledger, claim your batch in REGISTER.md.
2. **Audit** the next batch in the ledger's surface rotation (default 3–5 pages of
   one audience: borrower → staff → partner → admin → public, then repeat) against
   the §Checklist below. Use the `ux-reviewer` agent posture: evidence, not vibes.
3. **Rank** findings: noise/AA failures first (a colored band as chrome, white-on-
   color text, AA contrast fail), then scaffold drift (PageShell, spacing, h1
   scale), then registry drift (icons, EmptyState, eyebrows). New findings get
   date-qualified ids `DW-<MMDD>-<NN>` (charter §5).
4. **Fix** the top-ranked finding batch that fits R4/R7 in ONE PR (title
   `design-watch: <surface> — <what>`, label `design-watch`); everything else →
   ledger rows. Ledger update rides in the same PR.
5. **Report** to `knowledge-base/routines/reports/<date>-design-watch.md` per
   charter §9, and close the loop per the suite's Phase-7 conventions (watch your
   PR to green; sleep between iterations).

## Checklist (what "conformant" means, condensed)

- **Chrome quiet**: no colored bands as page furniture; headers = eyebrow
  (`text-xs font-semibold uppercase tracking-wider text-muted-foreground`) + `<h1>`
  (`text-2xl sm:text-3xl`) + muted subtitle on the app ground. Dark ink only in the
  persona-page final-CTA closers (`precision.950/900/700`).
- **Tokens only**: no raw palette classes (guard enforces), no `text-white`/
  `bg-white` where a token exists, status via `*-subtle` pairs / Badge / Alert.
- **Scaffold**: PageShell widths, gutter, `space-y-6` rhythm, card `p-6`/`p-4`;
  no hand-rolled `min-h-screen` wrappers; no `-mt-*` hero overlaps (retired with
  the colored bands).
- **Elevation**: `shadow-card` scale on `bg-surface`; no ad-hoc `shadow-2xl` /
  `shadow-lg border-0` / colored shadows on content cards.
- **Icons/zero-states**: registry glyphs (one per concept), `h-N w-N` rungs,
  `EmptyState` component, `aria-label` on icon-only controls.
- **AA**: contrast pairs, visible labels, ≥44px touch targets, focus rings intact.

## Registration (the §11 gate)

Per charter §11 a definition that is not in the scheduler is a fossil. This skill
ships from a remote session that cannot reach the founder's local scheduler, so its
charter clock row is annotated **⛔ pending registration** until the founder
registers the task: cadence **Wed 10:00 local, cron `0 10 * * 3`**, taskId
`design-watch-weekly`, prompt "Run the design watch routine (/design-watch)".
Registering it (or re-timing it) removes the annotation — same session, both edits.
