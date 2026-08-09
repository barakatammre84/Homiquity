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
| RR-004 | client/src/components/ScenarioSimulatorDialog.tsx | 645 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-005 | client/src/pages/borrower/URLAForm.tsx | 625 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-006 | client/src/pages/staff/BorrowerFile.tsx | 619 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-007 | client/src/pages/staff/StaffDashboard.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-008 | client/src/pages/agent-broker/AgentCoBranding.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-009 | client/src/components/BorrowerPackageView.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-010 | client/src/pages/borrower/Tasks.tsx | 595 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-011 | client/src/pages/realtor-engine/StrategySessions.tsx | 580 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-012 | client/src/pages/calculators/RentVsBuyCalculator.tsx | 579 | pure `calculateResults` mortgage/rent math inline in the component | extracted to `client/src/lib/rentVsBuyCalculator.ts` (+ `.test.ts` pinning current output) | low | done | commit on `claude/kind-franklin-7l2af6`, no PR opened (scheduled-task run, not a `/refactor-radar` invocation) | 2026-08-09 |
| RR-013 | client/src/pages/realtor-engine/ScenarioDesk.tsx | 574 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-014 | client/src/pages/borrower/BuyerProperties.tsx | 568 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |

## Run log

| date | mode | target | outcome | PR | attempts | notes |
|------|------|--------|---------|----|----------|-------|
| 2026-08-09 | ad hoc (scheduled task, not `/refactor-radar`) | RR-012 RentVsBuyCalculator.tsx | success | none — pushed to `claude/kind-franklin-7l2af6`, no PR opened | 1 | `pnpm check`/`pnpm test` (2367+417 green)/`guard:tokens`/`guard:querykeys`/`guard:reachability`/`guard:transport`/`pnpm build` all clean; 10+142 line diff, no off-limits paths touched |
