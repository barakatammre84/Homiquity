# UX Implementation Roadmap — prioritized backlog

Effort: S ≤ half day · M ≈ 1 day · L ≈ 2–3 days. Order within a tier matters.
Redesign items follow the house rule: **one route/component per commit, no logic changes.**

## P0 — trust & correctness (do before any cosmetic sweep)

| # | Item | Effort | Acceptance criteria | Events |
|---|---|---|---|---|
| UX-1 | Unify RenterHome readiness scores (roadmap #14): keep server /100, delete client-side % | M | One score on screen; server value; renter extension covered by test | `page_view` delta on RenterHome |
| UX-2 | Accessibility baseline (roadmap #23, staged): aria-labels on all icon-only buttons + progress/stepper roles + focus-visible audit on funnel & dashboard | L | axe-core clean on Landing, /apply, Dashboard, Documents; aria-label count >0 per icon button; keyboard-only funnel completion possible | — |
| UX-3 | Remove fake presence dots on Messages (F9 decision: remove until real transport) | S | No liveness indicator renders; no WebSocket errors in console | — |
| UX-4 | Demo rate sheet UX guard (pairs with roadmap #11): rates pages show honest empty state ("Rates available after a quick pre-check") instead of blank table when pricing returns no products | S | Production rates page never renders an empty table | `rate_viewed` metadata `{empty: true}` |
| UX-5 | Funnel gate + resume instrumentation (`funnel_gate_blocked`, `funnel_resumed`, `preapproval_result_viewed`) | S | Events visible in activity table after a test run | new events |

## P1 — the palette sweep (mechanical, one per commit)

| # | Item | Effort | Acceptance criteria |
|---|---|---|---|
| UX-6 | HomeReadinessPassport → tokens (roadmap #13) | S | zero off-palette classes in file; visual parity screenshot |
| UX-7 | JourneyTracker → tokens (roadmap #15) | S | same |
| UX-8 | Shared components batch (roadmap #19): TrustLayer, AffordabilityBadge, NotificationsPanel, BorrowerRequests, DealTeam, ui/toast | M | grep for off-palette hues returns 0 in these files |
| UX-9 | Calculator → /apply handoff with context seeding + `calc_to_apply` event | M | price/purpose prefilled in funnel from any calculator CTA |
| UX-10 | HomeownerDashboard sweep (roadmap #16) | M | zero off-palette classes |
| UX-11 | Admin/Staff KPI tiles sweep (roadmap #17) + staff empty states (roadmap #22) | M | "My Queue (0)" shows guidance card; tiles use ramp+semantic tokens |
| UX-12 | AICoach + FirstTimeBuyerHub sweep (roadmap #18) | M | zero off-palette classes |
| UX-13 | PropertyDetail + LivePropertyDetail sweep (roadmap #20) | M | zero off-palette classes |
| UX-14 | Dark mode decision (roadmap #21): recommend **strip `dark:` variants** — no user-facing toggle exists and testing cost is 2× | S | decision recorded; variants stripped or dark QA added to routine |

## P2 — completion & emotion polish

| # | Item | Effort | Acceptance criteria | Test |
|---|---|---|---|---|
| UX-15 | Visible autosave confirmation in funnel | S | 1.5s confirmation on step advance | T1 |
| UX-16 | Upload→condition match toast ("clears 1 of 3") | S | toast on L4 match; `doc_condition_matched` fires | — |
| UX-17 | Resume nudge card on dashboard for stalled drafts | M | shows % + time-left from `routeProgress` | T3 |
| UX-18 | URLA section chunking with time estimates + `urla_section_complete` | L | each section has intro + estimate; drop-off measurable by section | — |
| UX-19 | Human fallback CTA on verification/underwriting screens + `human_fallback_clicked` | S | one-tap message-team on all wait states | — |
| UX-20 | LoanOptions rate-breakdown presentation experiment | S | T2 configured behind flag | T2 |
| UX-21 | SLA-risk sort for staff TaskOperations queue | M | queue orders by breach risk from `lib/sla.ts` | — |

## Explicitly deferred (don't pull forward)

- Lender-persona surfaces — persona unbuilt by decision.
- Any outbound SMS nudges — blocked on quiet-hours (#24) + STOP webhook (#25).
- Real social-proof counts — blocked on real volume; use process proof (see psychology-patterns §1).
- Storybook build-out — inventory CSV is ready; stand up Storybook when a second frontend
  contributor exists (solo-dev ROI is negative today).

## Definition of done (applies to every item)

1. Zero off-palette classes introduced; tokens only.
2. `data-testid` preserved/added for changed interactive elements.
3. Analytics events from the item's row fire (verified in activity table).
4. Screenshot before/after attached to commit/PR description.
5. CTO_ROADMAP.md checkbox updated in the same commit when an item maps to one.
