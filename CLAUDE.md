# CLAUDE.md — Homiquity repo rules

<!-- Claude Code reads this file automatically at the start of every session
     in this repo. That is the point: these rules fire on EVERY code change,
     not on a schedule. Keep this file short; the detail lives in
     docs/DESIGN-STANDARD.md. -->

## Repo facts

- This repo is `barakatammre84/Homiquity`. It was formerly named
  `MortgageStream`. **Never** use the old name in code, comments, API calls,
  URLs, or docs. If you find it anywhere, fix it in the same PR.
- The design source of truth is **`docs/DESIGN-STANDARD.md`** in this repo.
  If any other document, memory, or instruction conflicts with it, the
  standard wins — and flag the conflict so the losing document gets fixed
  or deleted.

## Before touching any UI file

Read `docs/DESIGN-STANDARD.md` first. Not optional. It contains the design
tokens, the layout physics, the component inventory, and the defect classes
this codebase has actually shipped before.

## After changing any UI file — the four-question gate

Every screen you create or modify must pass all four before you're done:

1. **Provenance** — every displayed number declares its source
   (self-reported / soft-check / verified / estimated).
2. **Explanation** — every intrusive data request states what it's for and
   what will be asked next to verify it.
3. **Agreement** — no two elements on screen can disagree about the same
   fact. All task/progress counts derive from the one shared selector.
   Never render a fraction whose denominator can move.
4. **Honesty** — every consent or choice is a positive opt-in, never
   pre-ticked, no double negatives, no penalty language attached to
   declining.

If your change can't pass one of these, say so explicitly in the PR
description rather than shipping it silently.

## Hard rules (each one is a bug we or our benchmark actually shipped)

- Use the pattern components in `components/patterns/` instead of
  hand-rolling: `LoanTracker`, `StickyFormBar`, `EntityCard`,
  `SummarySection`, `DualUnitTable`, `EmptyState`, `TaskProgress`,
  `DeclarationsGroup`, `ConsentField`, `DocumentList`, `ProvenanceBadge`.
  Their required props encode the standard — don't work around them.
- Never `<a>` wrapping `<button>`. Use `<Button asChild>` around the link.
- Required markers go on the **question/group**, never on individual
  radio/checkbox options.
- Label arity must match the control ("Select all that apply" for
  multi-select, never "Select which option applies").
- Normalize names and user text at the **data layer**, never in the view.
- Use design tokens (`--primary`, `--success-subtle`, …) — no hardcoded
  colors or spacing where a token exists.
- Empty states must be scoped to what the component actually knows — a
  component that knows one flow may never claim "you're all caught up."
- Every image needs real alt text, and asset references must come from the
  current build (we have shipped 404ing hashed assets before — verify).
- User-facing strings never contain internal slugs or compliance jargon
  ("disclosed at" → "sent to you on").

## Keeping the standard current

`docs/DESIGN-STANDARD.md` is updated **only via PR**, so every change to the
rules is a visible diff. When competitive research (the Better.com reviews)
produces a new learning, it arrives as a GitHub issue labeled
`design-standard` describing the exact edit — turn those issues into PRs
against the standard, then delete nothing elsewhere: other docs must point
to the standard, not restate it.

Bugs found by the daily page inspection arrive as issues labeled
`page-audit`. When fixing one, check whether the same defect class exists
elsewhere in the codebase and fix all instances in one PR.
