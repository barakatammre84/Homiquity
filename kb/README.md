# Knowledge Base

Onboarding, doctrine, and assessment material for the Homiquity platform. **Authority
tiers and the "which doc do I trust" rules live in the root [README.md](../README.md)**;
the fact/assumption register is [ASSUMPTIONS.md](../ASSUMPTIONS.md).

## Layout

| Directory | What goes in it |
|-----------|-----------------|
| [`app-guide/`](app-guide/) | **The application handbook** (Tier 1 — kept current): architecture, data flow, schema, APIs, security, ops |
| [`my-research/`](my-research/) | The founder's own notes, research, questions |
| [`founder-routines/`](founder-routines/) | Dated reports emitted by the scheduled launch routines (snapshots) |
| [`lo-audit/`](lo-audit/) · [`ux-audit/`](ux-audit/) | Dated audit reports (snapshots) |
| [`support-playbooks/`](support-playbooks/) | Operational playbooks for support escalations |
| [`archive/`](archive/) | Factually obsolete docs — never act on these |

## Top-level documents

**Doctrine (Tier 2 — decisions in force):**

| Doc | Status |
|---|---|
| [TEAM_PRACTICES.md](TEAM_PRACTICES.md) | **How every session works** — doc rules, branch lifecycle, definition of done, push policy (adopted 2026-07-04) |
| [UNDERWRITING_SCENARIOS.md](UNDERWRITING_SCENARIOS.md) | **Living registry** — the "no citation → not implemented" contract |
| [SCENARIO_ARCHITECT.md](SCENARIO_ARCHITECT.md) | Operating instructions for scenario/guardian sessions |
| [AI_GOVERNANCE_POLICY.md](AI_GOVERNANCE_POLICY.md) | Adopted 2026-07-04 (v1.0), annual review |
| [MODEL_RISK_GOVERNANCE.md](MODEL_RISK_GOVERNANCE.md) | Model inventory under the AI governance policy |
| [REGULATORY_MONITORING.md](REGULATORY_MONITORING.md) | How statutory constants stay aligned with official sources |
| [PRE_PRODUCTION_OPS_ROUTINES.md](PRE_PRODUCTION_OPS_ROUTINES.md) | Founder operating routines (current: 5-routine launch suite incl. the sprint-blitz builder) |
| [FREE_DATA_MOAT.md](FREE_DATA_MOAT.md) | HMDA + GSE public-data ingestion design |

**Dated snapshots (Tier 4 — true as of their date; verify against code before acting):**

| Doc | Date | Notes |
|---|---|---|
| [STATE_OF_THE_PLATFORM.md](STATE_OF_THE_PLATFORM.md) | 2026-07-03 | CTO assessment; carries a resolution banner — many P0s since shipped |
| [LENDER_READINESS_GAP_ANALYSIS.md](LENDER_READINESS_GAP_ANALYSIS.md) | 2026-07-03 | Partially superseded (banner) — L1–L5 shipped |
| [BLUEPRINT_DESK_CROSSWALK.md](BLUEPRINT_DESK_CROSSWALK.md) | 2026-07-03 | 18-desk blueprint mapped to code |
| [COMPLIANCE_COUNSEL_REVIEW.md](COMPLIANCE_COUNSEL_REVIEW.md) | 2026-07-03 | Counsel review package, pending legal ratification |
| [BACKEND_UI_OPTIMIZATION_AUDIT.md](BACKEND_UI_OPTIMIZATION_AUDIT.md) | 2026-07-02 | Executed same night (banner) |

## Reading order (new developer path)

1. Root [README.md](../README.md) — status, doc tiers, ground rules
2. [ASSUMPTIONS.md](../ASSUMPTIONS.md) — what is real vs simulated vs pending
3. [app-guide/01-start-here.md](app-guide/01-start-here.md) → the numbered chapters in order (02-architecture, 05-data-flow, 03-database, 04-api-routes, 06-auth-security-secrets, 07-frontend, 08-services, 09-integrations, 10-deploy-ops, 11-domain-glossary)
4. [CTO_ROADMAP.md](../CTO_ROADMAP.md) — the work queue, launch sprint first
5. [PRODUCT_SPINE.md](../PRODUCT_SPINE.md), [LOCAL_DEV.md](../LOCAL_DEV.md), [CICD.md](../CICD.md), [ROLLBACK.md](../ROLLBACK.md), [threat_model.md](../threat_model.md)
