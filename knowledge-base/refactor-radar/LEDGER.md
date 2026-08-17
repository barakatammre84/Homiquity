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
| RR-004 | client/src/components/ScenarioSimulatorDialog.tsx | 645 | not yet audited (size re-measure due — PR #467 has since changed this file) | tbd | tbd | open | blocker cleared: PR #467 MERGED, so the conflict that set `blocked-human` is resolved | 2026-08-12 |
| RR-005 | client/src/pages/borrower/URLAForm.tsx | 750 | audited 2026-08-17 (owner-directed). The obvious extractions — `STEPS`, the hydration effect, `buildPayload`/`buildSectionsPayload` — are **refuted**: three independent adversarial reviews rejected **8 of 8** proposals, including ones that look like inert JSX moves | **none — do not extract.** The prerequisite the trap doc names (narrow `STEPS[].id` to a union) is now DONE; the moves themselves stay refuted | high — `buildPayload()` is argument-less *on purpose*; giving it a parameter compiles silently and writes a co-applicant's PII into the primary borrower's rows (`server/routes/borrower/urla.ts` rewrites `borrowerSequenceNumber` on id-keyed updates) | blocked-human: extraction refuted by adversarial review — see [URLA_FORM_REFACTOR_TRAP.md](../handbook/URLA_FORM_REFACTOR_TRAP.md). Only a human decision may reopen it | all 5 structural claims re-verified against the current 750-line file 2026-08-17; step-id narrowing shipped as https://github.com/barakatammre84/Homiquity/pull/530 | 2026-08-17 |
| RR-006 | client/src/pages/staff/BorrowerFile.tsx | 619 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-007 | client/src/pages/staff/StaffDashboard.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-008 | client/src/pages/agent-broker/AgentCoBranding.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-009 | client/src/components/BorrowerPackageView.tsx | 602 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-010 | client/src/pages/borrower/Tasks.tsx | 595 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-011 | client/src/pages/realtor-engine/StrategySessions.tsx | 580 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-012 | client/src/pages/calculators/RentVsBuyCalculator.tsx | 579 | ~95-line pure `calculateResults` (rent-vs-buy math) plus its input/result types live inline in the page component, unlike sibling `AffordabilityCalculator.tsx` which already extracted to `lib/affordabilityEstimate.ts` + colocated `types.ts` | extract `calculateResults`/`CalculatorInputs`/`CalculatorResults`/`defaultInputs` to `client/src/lib/rentVsBuyEstimate.ts`, mirroring the `affordabilityEstimate.ts` shape; page keeps all JSX/state/mutation, just imports the pure module | low — pure function, no JSX/query-key/route changes, single `@shared/lib/amortization` call untouched | done | merged 2026-08-12 as https://github.com/barakatammre84/Homiquity/pull/481 | 2026-08-12 |
| RR-013 | client/src/pages/realtor-engine/ScenarioDesk.tsx | 574 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |
| RR-014 | client/src/pages/borrower/BuyerProperties.tsx | 568 | not yet audited (seeded by size sweep) | tbd | tbd | open | — | 2026-08-08 |

## Run log

| date | mode | target | outcome | PR | attempts | notes |
|------|------|--------|---------|----|----------|-------|
| 2026-08-12 | full | RR-012 client/src/pages/calculators/RentVsBuyCalculator.tsx | code PR opened | https://github.com/barakatammre84/Homiquity/pull/481 | 1/5 | First-ever run (user-triggered test of /refactor-radar). Research: all 5 sites blocked by sandbox network egress proxy, cache still empty. Also flagged RR-004 blocked-human (conflicts with open non-radar PR #467). |
| 2026-08-17 | owner-directed (second pass, outside the one-PR-per-run rail — the founder asked for RR-005 by name) | RR-005 client/src/pages/borrower/URLAForm.tsx | **extraction refused, prerequisite shipped** | https://github.com/barakatammre84/Homiquity/pull/530 | 1/5 | The requested extraction is refuted by 3 adversarial reviews (8/8 proposals) in `handbook/URLA_FORM_REFACTOR_TRAP.md`; all 5 hazards re-verified against the current 750-line file before refusing, since the doc described a 625-line one. Shipped only the prerequisite that doc names — `STEPS[].id` narrowed to a union, each tab-panel literal pinned with `satisfies`, proven by reintroducing both failure directions (TS1360 / TS2322). Also corrected two stale claims in that doc: the `hasCoBorrower` latch gained a 4th setter (#450), and its "NOT fixed" `isUSCitizen` defect was fixed by #491 — **do not re-report it.** |
| 2026-08-12 | maintenance (human session, not a radar run) | — | unblocked the routine | — | — | The 2026-08-08 run crashed and left `.claude/worktrees/refactor-radar-2026-08-08` behind with uncommitted RR-004 work. Phase 0.4 aborts on exactly that and forbids self-deletion, so **every radar run since has been aborting on sight**. Work snapshotted to `wip/radar-2026-08-08-scenario-simulator-abandoned` (do not merge — superseded by merged #467), worktree removed, RR-004 → `open`, RR-012 → `done`. Radar also gained a real clock (Sun 20:00) — see [routines/CHARTER.md](../routines/CHARTER.md). |
