# Homiquity (MortgageStream)

An AI-native mortgage **brokerage** platform: borrower intake (digital 1003), document
collection, deterministic underwriting, MISMO 3.4 packaging, and delivery of complete
loan files to wholesale lenders. Deployed at <https://mortgage-stream.vercel.app>.

**Current status (2026-07-04): built, deployed, pre-launch.** All four core lending
workflows run end-to-end against **simulated vendors**. The platform cannot legally or
commercially process a real loan yet — see [ASSUMPTIONS.md](ASSUMPTIONS.md) for exactly
what is real, what is simulated, and what is pending. The active plan to get live is the
**🚀 Launch sprint** section at the top of [CTO_ROADMAP.md](CTO_ROADMAP.md).

## Quick start

```bash
npm ci && npm run dev   # dev server on port 5001 — full setup in LOCAL_DEV.md
npm run check           # typecheck
npm test                # unit tests
```

Dev logins: see [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md) (requires `DEV_TEST_PASSWORD` in `.env`).

## Which document do I trust?

Documentation is tiered by authority. **When a document disagrees with the code, the code
is the truth and the document is a bug** — fix or flag it.

### Tier 1 — Live sources of truth (kept current, trust these)

| Document | What it governs |
|---|---|
| [CTO_ROADMAP.md](CTO_ROADMAP.md) | **The work queue.** Launch sprint + ordered backlog. Updated in the same commit that completes an item. |
| [CLAUDE.md](CLAUDE.md) | Non-negotiable session rules: compliance-first doctrine, architecture ground rules, DB rules. |
| [DEVELOPER_PLAYBOOK.md](DEVELOPER_PLAYBOOK.md) | The deep engineering map — layers, engines, conventions. |
| [kb/app-guide/](kb/app-guide/) | The 11-chapter subsystem handbook (architecture → schema → routes → services → ops). Start at [01-start-here](kb/app-guide/01-start-here.md). |
| [ASSUMPTIONS.md](ASSUMPTIONS.md) | The fact/assumption register: what is simulated, what is pending business, what was verified when. |

### Tier 2 — Doctrine (decisions; change deliberately, never casually)

| Document | What it decides |
|---|---|
| [PRODUCT_SPINE.md](PRODUCT_SPINE.md) | Product modules, roles, AI boundaries (AI never decides lending outcomes). |
| [kb/TEAM_PRACTICES.md](kb/TEAM_PRACTICES.md) | How every session works: doc-staleness rules, branch/worktree lifecycle, definition of done, push policy. |
| [kb/UNDERWRITING_SCENARIOS.md](kb/UNDERWRITING_SCENARIOS.md) | Living scenario registry — the "no citation → not implemented" contract. |
| [kb/AI_GOVERNANCE_POLICY.md](kb/AI_GOVERNANCE_POLICY.md) · [kb/MODEL_RISK_GOVERNANCE.md](kb/MODEL_RISK_GOVERNANCE.md) | Adopted AI governance policy + model inventory under it. |
| [kb/REGULATORY_MONITORING.md](kb/REGULATORY_MONITORING.md) | How statutory constants stay verifiably aligned with official sources. |
| [kb/SCENARIO_ARCHITECT.md](kb/SCENARIO_ARCHITECT.md) | Operating instructions for scenario/guardian work. |
| [kb/PRE_PRODUCTION_OPS_ROUTINES.md](kb/PRE_PRODUCTION_OPS_ROUTINES.md) | The founder's pre-launch operating routines (current: 5-routine launch suite). |
| [docs/fannie-mae/](docs/fannie-mae/) | Official GSE reference documents — never work from memory on ULDD/UCD/URLA/MISMO. |
| [design_guidelines.md](design_guidelines.md) | Obsidian Indigo design system rules. |
| [threat_model.md](threat_model.md) | Security threat model. |

### Tier 3 — Runbooks (operational how-to)

[LOCAL_DEV.md](LOCAL_DEV.md) · [CICD.md](CICD.md) · [ROLLBACK.md](ROLLBACK.md) · [TEST_ACCOUNTS.md](TEST_ACCOUNTS.md)

### Tier 4 — Dated snapshots (true as of their date only)

Point-in-time assessments and audit reports: [kb/STATE_OF_THE_PLATFORM.md](kb/STATE_OF_THE_PLATFORM.md),
[kb/LENDER_READINESS_GAP_ANALYSIS.md](kb/LENDER_READINESS_GAP_ANALYSIS.md),
[kb/BLUEPRINT_DESK_CROSSWALK.md](kb/BLUEPRINT_DESK_CROSSWALK.md), and everything under
[kb/founder-routines/](kb/founder-routines/), [kb/lo-audit/](kb/lo-audit/), [kb/ux-audit/](kb/ux-audit/).

**Snapshot rule:** these are never silently edited to look current. When reality moves on,
they get a dated **superseded/status banner** at the top pointing to the live source.
Verify any "X is missing" claim against the code before acting on it.

### Tier 5 — Archive

[kb/archive/](kb/archive/) — factually obsolete documents (e.g. Replit-era launch
checklists) retained for history. Never act on these.

## Repository ground rules (summary — full rules in CLAUDE.md)

- `main` is production: every push deploys to Vercel. Land work via short-lived PR branches.
- `client/` and `server/` never import from each other; both import from `shared/`.
- Vendor integrations are deterministic simulations behind adapters until real contracts exist.
- Borrower PII goes through `server/services/encryptionService.ts` / `ssnVault.ts` + audit log.
- Migrations are hand-authored SQL in `migrations/` (`npm run db:migrate`). Never `db:push`
  from a worktree against the shared dev database.
