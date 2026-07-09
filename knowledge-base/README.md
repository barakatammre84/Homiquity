# Knowledge Base (KB)

The single home for all Homiquity documentation. Every `.md` here is indexed below — an
unindexed doc is an unread doc (enforced by `scripts/kb-index-guard.cjs` via `npm run checkup`).
Three living docs live outside this tree, deliberately: **`CLAUDE.md`** (Claude Code auto-loads
it from repo root), **`README.md`** (the repo landing page), and **`CTO_ROADMAP.md`** (the live
work queue). A fourth, **`PRODUCT_SPINE.md`**, is a one-line pointer stub retained only so old
links resolve — its content moved to [L1](L1_VISION_AND_SCOPE.md). Regulatory source binaries
stay in **`docs/`** (fannie-mae / nmls / nmls-safe). App-data (not docs) lives in
**`data/regulatory/`**.

## Precedence hierarchy (which doc wins)

Decisions flow **L1 → L2 → L3**, and **code wins over any doc on a stale fact** (that's a
doc-drift bug to fix):

- **L1 — [Vision & Scope](L1_VISION_AND_SCOPE.md)** — decides what we build (the cut-line).
- **L2 — [Compliance & Logic](L2_COMPLIANCE_AND_LOGIC.md)** — the guardrails that override any feature.
- **L3 — Feature specs** — [`specs/`](specs/), template [`specs/_TEMPLATE.md`](specs/_TEMPLATE.md) —
  each cites its L1 loop + L2 invariants.

## Sections

### Handbook — how the system is built · [`handbook/`](handbook/)
- [DEVELOPER_PLAYBOOK.md](handbook/DEVELOPER_PLAYBOOK.md) — the map: where code lives, the core
  workflows, the golden rules.
- [app-guide/](handbook/app-guide/) — the 11-chapter subsystem handbook (read in order, or jump):
  - [01 — Start Here](handbook/app-guide/01-start-here.md) · [02 — Architecture, Entry & Exit Points](handbook/app-guide/02-architecture.md) · [03 — Database & Schema](handbook/app-guide/03-database.md)
  - [04 — API Surface](handbook/app-guide/04-api-routes.md) · [05 — Data Flow: A Loan's Journey](handbook/app-guide/05-data-flow.md) · [06 — Auth, Security & Secrets](handbook/app-guide/06-auth-security-secrets.md)
  - [07 — Frontend](handbook/app-guide/07-frontend.md) · [08 — Service Catalog](handbook/app-guide/08-services.md) · [09 — External Integrations](handbook/app-guide/09-integrations.md)
  - [10 — Deploy & Operations](handbook/app-guide/10-deploy-ops.md) · [11 — Mortgage Domain Glossary](handbook/app-guide/11-domain-glossary.md)
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
  · [PROD_ACCEPTANCE_TEST.md](runbooks/PROD_ACCEPTANCE_TEST.md) — the F1 launch-gate checklist
- [support-playbooks/](runbooks/support-playbooks/) — locked-out user, discrimination/credit-error escalation.

### Specs — L3 feature specs · [`specs/`](specs/)
- [_TEMPLATE.md](specs/_TEMPLATE.md) — the L3 spec skeleton (cite L1 loop + L2 invariants).
- [FREE_DATA_MOAT.md](specs/FREE_DATA_MOAT.md) — HMDA + Fannie loan-performance data pipelines.

### Feature Review — the durable QA program · [`feature-review/`](feature-review/)
The re-runnable QA teams (agents in `.claude/agents/`) that review every feature vs intended use.
- [CHARTER.md](feature-review/CHARTER.md) — program rules, severity scale, the Reality Map.
- [DOMAINS.md](feature-review/DOMAINS.md) — the 13 domain charters + UX lens.
- [FINDINGS.md](feature-review/FINDINGS.md) — the verified findings register (seeded from the audit).
- [WORKFLOWS.md](feature-review/WORKFLOWS.md) — the ~14 E2E workflow scripts + wiring status.

### Logs — dated, immutable snapshots · [`logs/`](logs/)
> Point-in-time records. Never rewritten; supersession goes in a top banner (TEAM_PRACTICES §2).
- [logs/ux-audit/](logs/ux-audit/) — dated UX audit + design routine runs.
> The launch-era operational logs (founder-routines, lo-audit) and one-time platform assessments (2026-07-02 → 07-06) were archived 2026-07-08 — see the Archive section below.

### Research — scratch + strategy collateral · [`research/`](research/)
- [research/my-research/](research/my-research/) — scratch (nothing load-bearing).
- [research/gtm/](research/gtm/) — GTM battlecards + competitive briefs.
- [research/islamic-finance/](research/islamic-finance/) — alternative / Shariah-compliant (Musharaka/Ijara/Murabaha) "Universal Adaptation Layer" as a **broker-triage future moat**: feasibility + compliance-gap map (post-launch; below the L1 cut-line; authorizes nothing).

### Archive — obsolete, quarantined · [`archive/`](./archive/)
Superseded docs kept for provenance. Never act on these. Includes the launch-era
operational logs quarantined 2026-07-08: [archive/founder-routines/](archive/founder-routines/),
[archive/lo-audit/](archive/lo-audit/), [archive/assessments/](archive/assessments/).

## The rule (continuous update)

Per **TEAM_PRACTICES.md**: every new doc lives in this tree, gets one line in this index (or sits
under an indexed section directory), and — for `compliance/`/`governance/` docs — cites its L1/L2
authority. Dated snapshots are archived, never rewritten. The doc + its index line land in the
**same commit**. `scripts/kb-index-guard.cjs` (run by `npm run checkup`) fails the build on an
un-indexed doc or a dead index link.
