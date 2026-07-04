# Executive Summary — UX Audit

## Top 5 UX risks (ranked)

1. **Accessibility is near-zero** — 2 `aria-label`s in the whole client; icon buttons, progress
   bars and steppers are invisible to assistive tech. For a consumer lending product this is a
   legal-adjacent risk (fair-access optics) and blocks WCAG AA. *(page-audit cross-cutting #1)*
2. **Contradictory trust signals on RenterHome** — two readiness scores (client % vs server /100)
   can disagree on one screen. A borrower who sees two different numbers stops believing both.
3. **Empty rates experience in production** — pricing returns "no products" (CTO #11); a
   rates-led acquisition page that renders blank kills the first impression permanently.
4. **Brand incoherence at scale** — 60 of ~130 client files still use legacy off-palette colors;
   the borrower crosses 3–4 visual dialects in one journey (funnel ✅ → dashboard 🟡 →
   passport 🔴 → homeowner 🔴). Inconsistency reads as "assembled from parts," not institutional.
5. **Fake liveness** — presence dots on Messages with no real-time transport. Small, but it's a
   manufactured signal in a product whose whole thesis is radical transparency.

## Top 5 recommended fixes (ranked, mapped to backlog)

1. **UX-2** Accessibility baseline pass on the money path (Landing → /apply → Dashboard →
   Documents): aria-labels, roles, keyboard completion. ~2–3 days, protects everything else.
2. **UX-1** One readiness score, server-owned. ~1 day.
3. **UX-4** Honest empty state on rates pages + demo rate sheet (with CTO #11). ~half day UX side.
4. **UX-6→UX-13** Palette sweep in strict order (Passport → JourneyTracker → shared components →
   dashboards), one commit each, screenshot-verified. ~2 weeks of dailies.
5. **UX-5/15/16/17** Completion loop: instrument funnel gates + resume, make autosave visible,
   close the upload loop, resume nudge. Turns the funnel from good to measurably improving.

## What's already excellent (protect, don't churn)

- The `/apply` funnel: deterministic route-as-pure-function machine, FCRA gates, autosave/resume,
  VA zero-down routing — genuinely Better.com-class. Reference implementation for URLA next.
- Compliance UX plumbing: consent ledger with evidence, anti-steering records, LLPA rate
  transparency (L5) — a real differentiator worth making the visual centerpiece.
- First-party analytics with a sane vocabulary and sendBeacon abandon tracking.
- 109 files with `data-testid` — visual-regression/E2E ready.

---

## Daily log

### 2026-07-04 — routine established (day 1)
- Built the full audit artifact set (this folder): page-by-page audit (30+ surfaces), component
  inventory CSV (65 components, palette status), design-tokens JSON export, borrower+ops workflow
  maps with gates, psychology pattern library with paste-ready copy, analytics plan (10 new
  events, 3 A/B tests), prioritized 21-item UX backlog with acceptance criteria.
- Verified findings against code: off-palette grep (60 files), aria-label count (2), analytics
  endpoint (`/api/track`), funnel machine review.
- Note: memory said CTO roadmap 1–26 shipped; **main's CTO_ROADMAP.md still shows 1–5, 8, 11,
  13–26 open** — overnight work may be on unmerged branches. Audit is grounded in main.
- Next run: UX-1 (unify readiness scores) or first palette-sweep commit (UX-6, Passport).
