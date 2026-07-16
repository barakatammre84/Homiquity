# Executive Summary — UX Audit

> ⚠️ **Dated snapshot (banner added 2026-07-12).** Risk #1 below (accessibility) was
> substantially addressed by the roadmap #23 a11y pass (aria-labels 2 → 60, skip links,
> landmarks, AA contrast + token-guard ratchet); error-state and layout risks were reduced by
> #93/#95/#131. Read as history; current open UX findings live in
> `knowledge-base/feature-review/FINDINGS.md`.

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

### 2026-07-04 (later) — reconciliation lands most of the P0/P1 backlog at once
- Investigated the unmerged-branch discrepancy: the overnight work was real, spread across ~13
  branches. Consolidated it (with PRs #16/#17/#20 that landed on main mid-session) into PR #22.
- **Baseline shifts once PR #22 merges** (numbers in this audit's older sections are pre-merge):
  - Off-palette classes: 60 files -> **0** (kind-borg codemod + ratchet guard
    `scripts/design-token-guard.cjs` — regression now fails loudly).
  - aria-labels: 2 -> **60**; skip-links, landmarks, announced form errors shipped (UX-2 mostly
    done — keyboard-order/focus audit on the funnel remains).
  - **UX-1 done**: RenterHome readiness unified to the single server-side score.
  - **UX-3 pending re-check**: verify Messages presence dots post-merge.
  - **UX-4 partially done**: demo rate sheets self-refresh so prod always quotes; the honest
    empty-state fallback is still worth adding.
  - **UX-11 (empty states) done** for StaffDashboard; other staff views to verify.
- Also landed with the reconciliation: password reset + email verification, error monitoring,
  leads API, TCPA quiet hours + SMS STOP, TRID/APR/adverse-action compliance, VA residual inputs.
- Still open from the P0/P2 lists: UX-5 (funnel gate/resume instrumentation), UX-9 (calculator ->
  /apply context seeding), UX-15–UX-21 (completion & emotion polish), dark-mode follow-through.
- Next run: re-verify the borrower section of page-audit.md against post-merge main; then UX-5.
