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
- [design/design_guidelines.md](handbook/design/design_guidelines.md) — the design system (the *language*).
- [design/visual-consistency-standard.md](handbook/design/visual-consistency-standard.md) — the operational
  *checklist*: spacing/elevation scales, the icon registry (one glyph per concept), the brand/`<Logo>`/
  white-label mechanism, empty-state + illustration standards, and the PageShell adoption checklist.

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
- [CHANNEL_DECISION.md](governance/CHANNEL_DECISION.md) — **OPEN, founder-owned:** broker or
  mini-correspondent. One constant in `shared/businessChannel.ts`; the largest unanswered question
  about the capital structure. The Fannie delivery stack is frozen (`pnpm guard:channel`) until it lands.
- [CONTINGENT_LIABILITY_REGISTER.md](governance/CONTINGENT_LIABILITY_REGISTER.md) — what we could owe and
  whether the reserve covers it. For an asset-light broker the contingent exposures *are* the balance
  sheet; live figures at `GET /api/reports/contingent-liabilities`.
- [UNCONSUMED_CAPABILITIES.md](governance/UNCONSUMED_CAPABILITIES.md) — capability built ahead of a
  consumer, each with a **decide-by date**: wire a consumer or freeze it. Exists because the Fannie
  delivery stack accreted to 1,482 lines with zero callers before anyone asked "who calls this?".

> The living docs above carry a **Freshness** line (`pnpm guard:docs`). Dated logs under
> [`logs/`](logs/) deliberately do not — a log is history, not a claim about the present.
- [security/](governance/security/) — the security governance pack (vendor-diligence ready; drafted for the Plaid
  clearance): [Information Security Policy](governance/security/INFORMATION_SECURITY_POLICY.md)
  · [Access Control Policy](governance/security/ACCESS_CONTROL_POLICY.md) · [Asset & Endpoint Register](governance/security/ASSET_REGISTER.md)
  · [Incident Response Plan](governance/security/INCIDENT_RESPONSE_PLAN.md) · [Plaid questionnaire answers + pre-submit checklist](governance/security/PLAID_SECURITY_QUESTIONNAIRE_ANSWERS.md)

### Runbooks — operational how-to · [`runbooks/`](runbooks/)
- [CICD.md](runbooks/CICD.md) · [DB_MIGRATIONS.md](runbooks/DB_MIGRATIONS.md) — schema-gated, auto-applied to prod · [ROLLBACK.md](runbooks/ROLLBACK.md) · [LOCAL_DEV.md](runbooks/LOCAL_DEV.md)
  · [TEST_ACCOUNTS.md](runbooks/TEST_ACCOUNTS.md) · [PRE_PRODUCTION_OPS_ROUTINES.md](runbooks/PRE_PRODUCTION_OPS_ROUTINES.md)
  · [PROD_ACCEPTANCE_TEST.md](runbooks/PROD_ACCEPTANCE_TEST.md) — the F1 launch-gate checklist
  · [NEON_PREVIEW_DB.md](runbooks/NEON_PREVIEW_DB.md) — PII-free preview databases: the preview-seed branch + founder cutover
  · [BETA_GO_LIVE_READINESS.md](runbooks/BETA_GO_LIVE_READINESS.md) — dated beta-readiness snapshot (verified workflows + founder decisions)
- [support-playbooks/](runbooks/support-playbooks/) — locked-out user, discrimination/credit-error escalation.

### Specs — L3 feature specs · [`specs/`](specs/)
- [_TEMPLATE.md](specs/_TEMPLATE.md) — the L3 spec skeleton (cite L1 loop + L2 invariants).
- [FREE_DATA_MOAT.md](specs/FREE_DATA_MOAT.md) — HMDA + Fannie loan-performance data pipelines.
- [UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md](specs/UNIVERSAL_ADAPTATION_LAYER_PROGRAM.md) — program charter + 8 build prompts: complex-tax-return intelligence, multi-path income engine, non-QM/halal product lanes (broker-safe).
- [LO_ADVISOR_PROGRAM.md](specs/LO_ADVISOR_PROGRAM.md) — LO Advisor program charter — six build prompts wiring the advisory cockpit (what-if simulator, client reports, proactive signals, comms lint, lock-desk completion) onto existing engines.
- [PARTNER_HUB_PROGRAM.md](specs/PARTNER_HUB_PROGRAM.md) — COI PartnerHub program charter — six build prompts unifying the existing partner rails (CPA channel, agent co-branding, referral codes, waitlist) into one identity/attribution spine + persona toolkits, with binding doctrine corrections (§5) to the 2026-07-11 partner-tools draft.

### Feature Review — the durable QA program · [`feature-review/`](feature-review/)
The re-runnable QA teams (agents in `.claude/agents/`) that review every feature vs intended use.
- [CHARTER.md](feature-review/CHARTER.md) — program rules, severity scale, the Reality Map.
- [DOMAINS.md](feature-review/DOMAINS.md) — the 13 domain charters + UX lens.
- [FINDINGS.md](feature-review/FINDINGS.md) — the verified findings register (seeded from the audit).
- [WORKFLOWS.md](feature-review/WORKFLOWS.md) — the ~14 E2E workflow scripts + wiring status.

### Logs — dated, immutable snapshots · [`logs/`](logs/)
> Point-in-time records. Never rewritten; supersession goes in a top banner (TEAM_PRACTICES §2).
- [logs/ux-audit/](logs/ux-audit/) — dated UX audit + design routine runs.
- [logs/2026-07-12-external-strategy-adjudication.md](logs/2026-07-12-external-strategy-adjudication.md) — external L1 critique + broker-bottleneck memo adjudicated against code: verdicts, the AUS-gate fix, the Reg N binding correction, and what stays deliberately unbuilt.
- [logs/2026-07-17-external-agentic-mortgage-artifacts-evaluation.md](logs/2026-07-17-external-agentic-mortgage-artifacts-evaluation.md) — IBM / Confluent / Lendtrain "agentic mortgage" artifacts adjudicated against code: nothing vendored, four gaps extracted (risk-brief narration, coach input guard + disclosure, licensed-state footprint), seven house designs validated, binding rejections for LLM-in-decision-path proposals.
- [logs/2026-07-17-underwriter-splitscreen-vendor-pitch-adjudication.md](logs/2026-07-17-underwriter-splitscreen-vendor-pitch-adjudication.md) — vendor pitch (split-screen underwriter doc review, OCR bounding boxes, Textract + WebSockets) adjudicated against code: schema/OCR-vendor/WebSockets rejected as already-shipped-or-barred, three gaps adopted (staff doc-review workbench A6, docs-ready signal A7, missing-docs nudge A8), bounding boxes and SMS parked with reopen gates.
- [logs/2026-07-17-prod-api-outage-uuid-esm-postmortem.md](logs/2026-07-17-prod-api-outage-uuid-esm-postmortem.md) — ≈16-minute prod `/api` outage: a newly-activated `pnpm.overrides` **floor** resolved to ESM-only uuid@14 and crashed gaxios's CJS require in the Vercel function loader, behind READY/aliased deploys; timeline, why every safety net missed it, the #222 forward fix, and the binding lessons now enforced in [runbooks/CICD.md](runbooks/CICD.md) (post-deploy health check; no floors in overrides).
- [logs/2026-07-19-modular-architecture-pitch-adjudication.md](logs/2026-07-19-modular-architecture-pitch-adjudication.md) — external "plug-and-play micro-pipelines" pitch (queues, PostGIS, Docker scrapers, speculative JSONB) adjudicated against code: the modularity already exists repo-native (adapters, rules-as-data, moat pipeline, provenance gating); infra prescriptions rejected with reopen gates; "no speculative schema" restated; plus the measured UI-velocity investigation (2,586 unused `data-testid` hooks, zero component tests) and the minimal-intervention plan.
- [logs/2026-08-04-rate-com-competitive-pitch-adjudication.md](logs/2026-08-04-rate-com-competitive-pitch-adjudication.md) — external "beat Rate.com on complex borrowers" pitch adjudicated against code: the pitched SAM/1084 engine already ships (deliberately human-gated — MR-2); instant pre-underwrite, live borrower math, realtor letter hub, CPA attestation portal, and the 50+ investor matrix engine rejected under standing rulings (with reopen gates); the one extraction is the Borrower Clarity program (contextual doc requests, honest milestones, post-decision income transparency); four defects found in passing feed the hardening leg.
- [logs/2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md](logs/2026-08-04-sovereign-underwriting-stack-pitch-adjudication.md) — external "sovereign underwriting stack" pitch (Cloudflare R2/Workers, direct IRS IVES A2A, Google Document AI, Python microservice, SAM + Non-QM router) adjudicated against code: the "core IP" it says to build first already ships richer (its SAM formula would overstate income); R2/Document-AI/new-stack rejected under standing rulings; the one extraction is roadmap **F12 — IRS IVES transcript access** (founder-enrollment + counsel gated, then a simulated adapter); defects found in passing: the borrower-reachable legacy calculation routes (→ hardening leg), the `documents.notes` overload, four stale briefing claims (→ supersession banner), and the new §9 PII sub-processor trigger.
- [logs/2026-08-04-cross-sector-fintech-frameworks-pitch-adjudication.md](logs/2026-08-04-cross-sector-fintech-frameworks-pitch-adjudication.md) — external "cross-sector fintech frameworks" pitch (Stripe/Shopify revenue telemetry, MCA bank-statement forensics, brokerage-API asset depletion, DeFi live proof-of-funds certificates) adjudicated against code: every mechanism is shipped, chartered under the adopted #238 plan, or doctrine-barred; **nothing adopted for build** (a null program); the one new idea — debit-side MCA-stacking detection — parked at the §5.2 activation gate; new binding restatement: **no machine-issued financial attestations to third parties**; defects found in passing feed the letters hardening leg (pre-approval PDF regeneration drift + ungated no-row minting; zero-writer letter status lifecycle).
- [logs/2026-08-04-renter-incubation-pitch-adjudication.md](logs/2026-08-04-renter-incubation-pitch-adjudication.md) — external "Renter Incubation & Access Engine" pitch adjudicated against code: the pitched path-to-purchase simulator already ships as the Incubator (readiness /100, gap analysis, coach action plans); rent-history-to-DU deferred behind the missing Fannie authority corpus (never from memory); nationwide DPR matrix rejected as pitched (IL footprint + vendor doctrine); 1099 program numbers held in Appendix-A quarantine and Truv-for-gig rejected under the §5.5 ruling; "$420"/"60 days away" borrower math rejected — binding (C2, Reg N); "never flat-deny" rejected (ECOA adverse action is mandatory and unburiable — new binding) with the post-notice re-entry kernel adopted; the **Renter Ramp** legs fix eight defects found in passing (wizard honesty + DPA route hardening, the unreachable adverse-action notice, the denied-borrower dead end, coach DPA grounding).
- [logs/2026-08-04-financial-architecture-capital-structure-audit.md](logs/2026-08-04-financial-architecture-capital-structure-audit.md) — financial architecture & capital structure audit of the business model as implemented in code: 16 findings across capital flow, risk/liability, unit economics and balance sheet; F-1…F-13 remediated same-day (dual compensation, the QM points-and-fees floor, the phantom lock, cure baselines, counterparty gating, the comp/cost ledgers, the contingent-liability register), F-14 escalated to [CHANNEL_DECISION.md](governance/CHANNEL_DECISION.md), F-15/F-16 found sound.
- [logs/2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md](logs/2026-08-05-financial-architecture-reaudit-qm-loan-size-floor.md) — one-day re-audit verifying the 08-04 remediation holds at HEAD (2,071 tests green; the F-3 lock and F-5 counterparty gates intact), and calculating the minimum viable loan amount that audit left open: **$207k at the default comp plan, $276k at the highest** — below which the platform's own fixed fees exhaust the QM cap, excluding the DPA/first-time-buyer band the product targets (F-17); plus the sequencing defect that the QM check runs only after its own remedy is frozen by LE issuance (F-18) and the tax-service-fee numerator/denominator inconsistency (F-19).

> The launch-era operational logs (founder-routines, lo-audit) and one-time platform assessments (2026-07-02 → 07-06) were archived 2026-07-08 — see the Archive section below.

### Research — scratch + strategy collateral · [`research/`](research/)
- [research/my-research/](research/my-research/) — scratch (nothing load-bearing).
- [research/gtm/](research/gtm/) — GTM battlecards + competitive briefs.
- [research/islamic-finance/](research/islamic-finance/) — alternative / Shariah-compliant (Musharaka/Ijara/Murabaha) "Universal Adaptation Layer" as a **broker-triage** lane: feasibility + compliance-gap map (§3 payment-decomposition table = the citation authority for the P7 translation calculators) + lender-channel validation (route is the Ijara-CDC/CMG ecosystem; the 2 founder calls are the channel gates) + Shariah-governance validation (structure cert = the funder's). Productized as UAL program prompt P7 — funder-agnostic build only until a founder-call "yes".
- [research/NON_W2_LENDING_RESEARCH_BRIEFING.md](research/NON_W2_LENDING_RESEARCH_BRIEFING.md) — dated (2026-07-17, pinned to `main` @ `98a9674`) inventory of everything built for the non-W2 / self-employed beachhead — the UAL income engine, document intelligence, decisioning→delivery pipeline, surfaces, the real-vs-simulated vendor map, and code-verified gaps — plus the research questions handed to the outside research team. Code wins over this snapshot.
- [research/NON_W2_TECH_OPTIMIZATION_PLAN.md](research/NON_W2_TECH_OPTIMIZATION_PLAN.md) — **ADOPTED (2026-07-17): the governing plan for the non-W2 program**, adjudicated and code-corrected from the returned outside research. Four corrected phases (income-engine wiring → tax-reconciliation depth + new paths → vendor activation → commercial un-gating), a Phase-0 citable-artifacts pipeline, and an Appendix-A quarantine of every externally claimed program number pending in-repo sources. Supersedes conflicting prior non-W2 framing; the briefing's §1 box and KB precedence still bind.

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
