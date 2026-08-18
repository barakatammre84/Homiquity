# Design Watch — ledger

Shared memory of the `design-watch` routine (`.claude/skills/design-watch/SKILL.md`).
Findings are date-qualified `DW-<MMDD>-<NN>` per charter §5. Statuses: `open` ·
`in-pr` · `done` · `blocked-human` · `failed (cooldown N runs)` · `rejected`.

**Surface rotation** (one audience batch per run): borrower → staff → partner →
admin → public → repeat. Next up: **borrower** (post-repaint re-verify).

## Context: the 2026-08-18 Calm Emerald repaint (branch `claude/design-cleanup-visual-tccg20`)

The founder called the royal-blue chrome "too much on-screen noise" and set
Better.com's dashboard as the lead reference. That session repainted the tokens
(white sidebar/footer, neutral `--accent`, ink persona closers), retired the
"premium header" colored bands on 5 authed surfaces + 3 legal pages + the borrower
hero, and rewrote the design docs. Everything it deliberately did NOT do is seeded
below — this queue is the routine's starting rotation, re-verified against code
before acting (charter §10: date every standing claim).

## Findings

| id | status | surface / files | finding | notes |
|---|---|---|---|---|
| DW-0818-01 | open | ~20 files with `bg-gradient-to*` washes (`LoanOptions.tsx`, `MortgageRates.tsx`, `Properties.tsx`, `FAQ.tsx`, `PreApprovalCta.tsx`, gap-calculator tabs, `WelcomeState.tsx`, `Landing.tsx`, education pages, …) | Post-repaint sweep of remaining gradient tints: keep subtle `from-primary/5`-class washes only where they separate a section; remove decorative multi-stop gradients and any remaining blur-orb divs | Repaint converted the loud solid-color bands; the tint-wash tier was left pending a per-surface look |
| DW-0818-02 | open | `client/src/pages/borrower/Dashboard.tsx`, `AgentDashboard.tsx`, `AdminDashboard.tsx`, `BrokerDashboard.tsx`, `StaffDashboard.tsx`, `ConversationList.tsx` | Browser-verify the calm headers on a live dev server (spacing rhythm at 375px/desktop, switcher alignment without its old white pill) — the repaint session was remote and could not screenshot | R8: needs port-5002 server + screenshots |
| DW-0818-03 | open | `demo/lender-demo/build-deck.js` (ROYAL #1C3A8F palette) | Lender demo deck still carries the royal-blue brand; rebuild deck palette to Calm Emerald so external collateral matches the product | Out of client/src territory — prepare the palette diff, founder rebuilds/ships (deck screenshots also stale) |
| DW-0818-04 | open | ~18 hand-rolled zero-states (named in visual-consistency-standard §6) | Consolidate to `<EmptyState>`; add the `illustration` slot first | Standard §6 carries the named offender list |
| DW-0818-05 | open | 57% of authed pages | PageShell adoption sweep (visual-consistency-standard §8 checklist, batch by audience) | Long-running; one audience batch per run fits R7 |
| DW-0818-06 | open | 178 ad-hoc `lucide-react` import sites | Icon-registry migration (`client/src/lib/icons.ts`, one glyph per concept) | Pair each batch with the surfaces already being touched |
| DW-0818-07 | open | eyebrow/section labels across authed pages | Standardize on the house eyebrow (`text-xs font-semibold uppercase tracking-wider text-muted-foreground`) — the repaint applied it to the 6 converted headers only | Grep `text-sm font-medium` eyebrows near h1s |
| DW-0818-08 | open | `client/src/pages/rates/*` + `RatePageHeader.tsx` | Rate pages got the token fix only (emerald CTAs, muted band); full surface still pre-standard (bespoke h1 `text-5xl`, no PageShell) | Fold into DW-0818-05's public batch |

## Run log

| date | mode | batch | PR | notes |
|---|---|---|---|---|
| — | — | — | — | (no runs yet — routine created 2026-08-18, awaiting scheduler registration) |
