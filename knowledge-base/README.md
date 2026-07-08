# Knowledge Base (KB)

The single home for all Homiquity documentation. Every `.md` here is indexed below — an
unindexed doc is an unread doc (enforced by `scripts/kb-index-guard.cjs` via `npm run checkup`).
Only three docs live outside this tree, deliberately: **`CLAUDE.md`** (Claude Code auto-loads it
from repo root), **`README.md`** (the repo landing page), and **`CTO_ROADMAP.md`** (the live work
queue). Regulatory source binaries stay in **`docs/`** (fannie-mae / nmls / nmls-safe). App-data
(not docs) lives in **`data/regulatory/`**.

## Precedence hierarchy (which doc wins)

Decisions flow **L1 → L2 → L3**, and **code wins over any doc on a stale fact** (that's a
doc-drift bug to fix):

- **L1 — Vision & Scope** — decides what we build (the cut-line). *Lands here as
  `L1_VISION_AND_SCOPE.md` when PR #69 merges; currently at repo root `VISION_AND_SCOPE.md`.*
- **L2 — Compliance & Logic** — the guardrails that override any feature. *Lands here as
  `L2_COMPLIANCE_AND_LOGIC.md` when PR #69 merges; currently root `COMPLIANCE_AND_LOGIC.md`.*
- **L3 — Feature specs** — [`specs/`](specs/) — each cites its L1 loop + L2 invariants. Template
  lands as `specs/_TEMPLATE.md` when PR #69 merges (currently root `FEATURE_SPEC_TEMPLATE.md`).

## Sections

### Handbook — how the system is built · [`handbook/`](handbook/)
- [DEVELOPER_PLAYBOOK.md](handbook/DEVELOPER_PLAYBOOK.md) — the map: where code lives, the core
  workflows, the golden rules.
- [app-guide/](handbook/app-guide/) — the 11-part subsystem handbook (`01-start-here` …
  `11-domain-glossary`).
- [design/design_guidelines.md](handbook/design/design_guidelines.md) — the design system.

### Compliance — regulated-logic doctrine (L2 detail) · [`compliance/`](compliance/)
- [UNDERWRITING_SCENARIOS.md](compliance/UNDERWRITING_SCENARIOS.md) — scenario catalog + the
  no-citation-no-implementation contract.
- [SCENARIO_ARCHITECT.md](compliance/SCENARIO_ARCHITECT.md) · [REGULATORY_MONITORING.md](compliance/REGULATORY_MONITORING.md)
  · [SAFE_MLO_COMPLIANCE_MAP.md](compliance/SAFE_MLO_COMPLIANCE_MAP.md) · [COMPLIANCE_COUNSEL_REVIEW.md](compliance/COMPLIANCE_COUNSEL_REVIEW.md)
- [security/threat_model.md](compliance/security/threat_model.md)

### Governance — policies & session rules · [`governance/`](governance/)
- [TEAM_PRACTICES.md](governance/TEAM_PRACTICES.md) — how we work (the house-style exemplar).
- [AI_GOVERNANCE_POLICY.md](governance/AI_GOVERNANCE_POLICY.md) · [MODEL_RISK_GOVERNANCE.md](governance/MODEL_RISK_GOVERNANCE.md)
  · [ASSUMPTIONS.md](governance/ASSUMPTIONS.md) · [ARMED_LAUNCH_CHARTER_2026-07-07.md](governance/ARMED_LAUNCH_CHARTER_2026-07-07.md)

### Runbooks — operational how-to · [`runbooks/`](runbooks/)
- [CICD.md](runbooks/CICD.md) · [ROLLBACK.md](runbooks/ROLLBACK.md) · [LOCAL_DEV.md](runbooks/LOCAL_DEV.md)
  · [TEST_ACCOUNTS.md](runbooks/TEST_ACCOUNTS.md) · [PRE_PRODUCTION_OPS_ROUTINES.md](runbooks/PRE_PRODUCTION_OPS_ROUTINES.md)
- [support-playbooks/](runbooks/support-playbooks/) — locked-out user, discrimination/credit-error escalation.

### Specs — L3 feature specs · [`specs/`](specs/)
- [FREE_DATA_MOAT.md](specs/FREE_DATA_MOAT.md) — HMDA + Fannie loan-performance data pipelines.

### Logs — dated, immutable snapshots · [`logs/`](logs/)
> Point-in-time records. Never rewritten; supersession goes in a top banner (TEAM_PRACTICES §2).
- [logs/assessments/](logs/assessments/) — one-time platform/lender/UI audits (several superseded).
- [logs/founder-routines/](logs/founder-routines/) · [logs/lo-audit/](logs/lo-audit/) · [logs/ux-audit/](logs/ux-audit/) — dated routine + audit runs.

### Research — scratch + strategy collateral · [`research/`](research/)
- [research/my-research/](research/my-research/) — scratch (nothing load-bearing).
- [research/gtm/](research/gtm/) — GTM battlecards + competitive briefs.

### Archive — obsolete, quarantined · [`archive/`](./archive/)
Superseded docs kept for provenance. Never act on these.

## The rule (continuous update)

Per **TEAM_PRACTICES.md**: every new doc lives in this tree, gets one line in this index (or sits
under an indexed section directory), and — for `compliance/`/`governance/` docs — cites its L1/L2
authority. Dated snapshots are archived, never rewritten. The doc + its index line land in the
**same commit**. `scripts/kb-index-guard.cjs` (run by `npm run checkup`) fails the build on an
un-indexed doc or a dead index link.
