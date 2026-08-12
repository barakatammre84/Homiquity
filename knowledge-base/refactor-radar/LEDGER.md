# Refactor Radar — Ledger

The cross-run memory of the `/refactor-radar` routine
([`.claude/skills/refactor-radar/SKILL.md`](../../.claude/skills/refactor-radar/SKILL.md)).
Every run reads this file before choosing work and updates it in the same PR as its
change. Candidates get ids `RR-001`, `RR-002`, … in discovery order; ids are never
reused. Sizes are re-measured at each audit; the seeded numbers are from
`origin/main` @ `f1c6b7e` (2026-08-08).

## Status vocabulary

- `open` — audited candidate, eligible for selection.
- `in-pr` — a refactor PR is open (URL in evidence). Not re-picked.
- `done` — PR merged (date + PR# in evidence). Never re-picked.
- `rejected: <reason>` — **permanent**. Only a human edit may remove a rejection;
  the routine never resurrects these.
- `failed: <reason> (cooldown 2 runs)` — retriable only after two subsequent runs,
  and only if the recorded reason is addressed; otherwise escalate to `blocked-human`.
- `blocked-human: <reason>` — needs an owner decision or a human-driven session
  (server-side, §9-adjacent, or research-derived ideas). The routine only
  adds/annotates these rows.

## Candidates

| id | target | size | signal | proposed extraction | risk | status | evidence/PR | updated |
|----|--------|-----:|--------|---------------------|------|--------|-------------|---------|
| RR-001 | client/src/pages/lending/PreApproval.tsx | 882 | shell over `preApproval/` steps + hooks + `client/src/funnel/` machine + `lib/affordabilityEstimate` | — | — | rejected: already decomposed; poor ROI | seeded at install | 2026-08-08 |
| RR-002 | client/src/components/ui/sidebar.tsx | 727 | vendored shadcn primitive | — | — | rejected: off-limits (R4) | seeded at install | 2026-08-08 |
| RR-003 | client/src/pages/admin/AdminUsers.tsx | 670 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-004 | client/src/components/ScenarioSimulatorDialog.tsx | 645 | not yet audited (seeded by size sweep) | tbd | tbd | blocked-human: open non-radar PR #467 ("extract scenario-simulator data layer into a hook") already modifies this file — picking it would conflict; owner should resolve #467 first, then re-audit | — | 2026-08-12 |
| RR-005 | client/src/pages/borrower/URLAForm.tsx | 625 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-006 | client/src/pages/staff/BorrowerFile.tsx | 619 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-007 | client/src/pages/staff/StaffDashboard.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-008 | client/src/pages/agent-broker/AgentCoBranding.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-009 | client/src/components/BorrowerPackageView.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-010 | client/src/pages/borrower/Tasks.tsx | 595 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-011 | client/src/pages/realtor-engine/StrategySessions.tsx | 580 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-012 | client/src/pages/calculators/RentVsBuyCalculator.tsx | 579 | ~95-line pure `calculateResults` (rent-vs-buy math) plus its input/result types live inline in the page component, unlike sibling `AffordabilityCalculator.tsx` which already extracted to `lib/affordabilityEstimate.ts` + colocated `types.ts` | extract `calculateResults`/`CalculatorInputs`/`CalculatorResults`/`defaultInputs` to `client/src/lib/rentVsBuyEstimate.ts`, mirroring the `affordabilityEstimate.ts` shape; page keeps all JSX/state/mutation, just imports the pure module | low — pure function, no JSX/query-key/route changes, single `@shared/lib/amortization` call untouched | in-pr | (PR opened in Phase 5) | 2026-08-12 |
| RR-013 | client/src/pages/realtor-engine/ScenarioDesk.tsx | 574 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-014 | client/src/pages/borrower/BuyerProperties.tsx | 568 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |

## Run log

| date | mode | target | outcome | PR | attempts | notes |
|------|------|--------|---------|----|----------|-------|
| 2026-08-12 | full | RR-012 client/src/pages/calculators/RentVsBuyCalculator.tsx | code PR opened | (see RR-012 evidence) | 1/5 | First-ever run (user-triggered test of /refactor-radar). Research: all 5 sites blocked by sandbox network egress proxy, cache still empty. Also flagged RR-004 blocked-human (conflicts with open non-radar PR #467). |
