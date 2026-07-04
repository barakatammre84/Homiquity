# UX Audit & Design Routine — Homiquity

**What this is:** the standing UX design-review system for Homiquity, run as a daily routine.
Every artifact in this folder is grounded in the actual code on `main` — file paths are cited so
claims can be verified (per the house rule: docs go stale, code is truth).

## Daily routine definition

The routine ("UX daily loop") does the following each run:

1. **Re-verify one section of `page-audit.md`** against current code (rotate through the groups:
   public → funnel → borrower → lending → broker → staff/admin → homeowner → education).
   Update statuses; close issues that shipped; add new ones found.
2. **Advance one redesign item** from `ux-roadmap.md` P0/P1 (these map onto CTO_ROADMAP items
   13–23). One route or component per commit, no logic changes — same rule as the roadmap.
3. **Keep the machine-readable artifacts in sync**: `component-inventory.csv` (Storybook import),
   `design-tokens.json` (token export), `analytics-plan.md` (event schema).
4. **Auto-commit** on a work branch with a `ux:` prefix. Never push to `main` directly.
5. **Append a dated entry** to `exec-summary.md` describing what moved and remaining risk.

## Artifact index

| File | What it is | Consumer |
|---|---|---|
| [exec-summary.md](exec-summary.md) | Top 5 UX risks, top 5 fixes, daily log | Founder/CTO |
| [page-audit.md](page-audit.md) | Page-by-page audit: status, top issues, severity | Designers/devs |
| [component-inventory.csv](component-inventory.csv) | Component census with palette status | Storybook import |
| [design-tokens.json](design-tokens.json) | Color/type/spacing/radius/elevation/z-index tokens | Design tools, CI |
| [workflows.md](workflows.md) | Borrower E2E map + ops workflow with gates/handoffs | PM/eng |
| [psychology-patterns.md](psychology-patterns.md) | Trust/completion patterns with exact copy | Devs (paste-ready) |
| [analytics-plan.md](analytics-plan.md) | Event schema, funnel metrics, 3 A/B tests | Devs/analytics |
| [ux-roadmap.md](ux-roadmap.md) | Prioritized backlog, effort, acceptance criteria | Sprint planning |

## Ground rules (inherited from the codebase)

- **Design system:** "Obsidian Indigo" — single 216° hue value ramp, semantic pop colors
  (success/warning/danger) outside the ramp. Source of truth: `client/src/index.css` +
  `tailwind.config.ts` + `design_guidelines.md`. No new hues.
- **No logic changes in redesign commits.** Visual sweep only, one route per commit.
- **Analytics is first-party:** `POST /api/track` (`server/routes/borrower.ts`), client hooks in
  `client/src/hooks/useActivityTracker.ts`. No third-party trackers without a compliance review
  (GLBA/RESPA context).
- **Regulatory copy is not "microcopy".** FCRA consent, ESIGN, anti-steering, LE timing language
  may not be reworded for conversion without a compliance check.
