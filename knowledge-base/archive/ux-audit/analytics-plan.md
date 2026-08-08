> **⛔ ARCHIVED 2026-08-06 — the UX daily-loop routine is dead (last run 2026-07-16). Do not act on this document.** It lived under `logs/`, which the [KB index](../README.md) declares immutable ("never rewritten"), while its own README described a routine that rewrote these artifacts daily — a contradiction resolved by archiving. The successor register is [feature-review/FINDINGS.md](../../feature-review/FINDINGS.md), which this directory's own exec-summary already named. Design *values* are canonical in [handbook/design/visual-consistency-standard.md](../../handbook/design/visual-consistency-standard.md). Retained for history only.

# Analytics & Experiment Plan

Infrastructure: first-party only. Client hooks in `client/src/hooks/useActivityTracker.ts` →
`POST /api/track` (`server/routes/borrower.ts:3916`) with `{activityType, page, metadata,
sessionId}`. Session ID is per-tab random — adequate for funnel analysis, no cross-device
stitching (fine; don't add third-party trackers without a compliance review).

## Event schema (canonical vocabulary)

Existing events (keep, already emitted):

| Event | Where | Metadata |
|---|---|---|
| `page_view` | all pages via `usePageView` | pathname |
| `form_start` / `form_step_complete` / `form_abandon` | funnel (abandon uses sendBeacon) | form, step_id, step, total |
| `preapproval_step` | PreApproval.tsx | step detail |
| `cta_click` | CTA components | cta, source page |
| `property_click` / `property_save` / `property_search` | properties | listing metadata |
| `coach_session_start` / `coach_message_sent` / `coach_session_complete` | AI coach | — |
| `account_created` / `login` / `doc_uploaded` / `rate_viewed` | account events | — |

Gaps to instrument (each maps to a funnel question we currently can't answer):

| New event | Fires when | Why |
|---|---|---|
| `funnel_gate_blocked` | `blockedGate` set in funnelReducer | which compliance gate stalls users (down-payment? consent?) |
| `funnel_resumed` | HYDRATE from draft | does autosave actually rescue abandons? |
| `preapproval_result_viewed` | final result render | approval-moment reach rate |
| `letter_downloaded` | letter download | activation proxy |
| `loan_option_expanded` / `rate_breakdown_viewed` | LoanOptions interactions | does LLPA transparency (L5) drive lock intent? |
| `rate_lock_clicked` | lock CTA | bottom-funnel conversion |
| `urla_section_complete` | 1003 section save | long-form drop-off by section |
| `doc_condition_matched` | client toast after L4 match | closes the upload loop |
| `human_fallback_clicked` | message-team CTA | stress-point demand signal |
| `calc_to_apply` | calculator → /apply handoff | discovery→prequal conversion |

Convention: `snake_case`, past-tense verb last, metadata keys stable across events
(`form`, `step_id`, `application_id` when authenticated).

## North-star funnel & success metrics

```
rate/calc page → apply start → apply complete → account → URLA start → docs complete → CTC
```

| Metric | Definition | Baseline | Target |
|---|---|---|---|
| Funnel completion | form_start → preapproval_result_viewed | measure first | 55%+ (Better.com-class) |
| Median time-to-preapproval | form_start → result | measure | ≤ 4 min (promise is "about 3") |
| Resume rate | funnel_resumed / form_abandon | measure | 25%+ |
| Docs cycle time | first doc request → all conditions submitted | measure | ≤ 5 days |
| Gate-block rate | funnel_gate_blocked / step views | measure | < 10% per gate |

## Three A/B tests (run in this order, one at a time)

**T1 — Visible autosave vs quiet indicator** (funnel)
- H: making autosave visible at step-advance increases completion of sessions that pause ≥30s.
- Variant: 1.5s full-contrast "✓ Saved — pick this up anytime" confirmation per step.
- Primary metric: funnel completion; guardrail: median time-to-complete (no slowdown >5%).
- Decision: ship if completion +2pp with p<0.05 at ~1,000 form_starts/arm.

**T2 — Rate-breakdown placement** (LoanOptions)
- H: showing the LLPA "why this rate" decomposition expanded-by-default (vs behind a click)
  increases rate_lock_clicked.
- Primary: lock CTR; secondary: rate_breakdown_viewed→lock correlation; guardrail:
  human_fallback_clicked (confusion signal shouldn't rise).

**T3 — Resume nudge framing** (dashboard, stalled drafts >24h)
- Arms: progress framing ("You're 70% done — about 1 minute left") vs neutral ("Continue your
  application").
- Primary: funnel_resumed→completion; guardrail: unsubscribe/complaint rate if emailed.
- Note: in-app + email only; **no SMS until quiet-hours (#24) and STOP webhook (#25) exist.**

## Reporting

- Admin dashboard already charts activity (`AdminCharts.tsx`); add a funnel view over the
  canonical events (drop-off by step_id) — that's the daily instrument for the UX loop.
- Weekly: gate-block leaderboard + form_abandon by step feeds the routine's next-fix pick.
