# Homiquity (MortgageStream)

An AI-native mortgage **brokerage** platform: borrower intake (digital 1003), document
collection, deterministic underwriting, MISMO 3.4 packaging, and delivery of complete
loan files to wholesale lenders. Deployed at <https://www.homiquity.com>
(Vercel; the `mortgage-stream.vercel.app` platform domain still resolves).

**Current status (2026-07-19): company NMLS licensure is real — NMLS #427468, Illinois
(`shared/companyIdentity.ts`, #154/#201) — and the site remains in pre-launch gated mode
pending the founder go-live flips.** The public site is live in production behind the
**pre-launch gate** (`server/services/prelaunchGate.ts` — flag-driven, with a fail-safe
that re-gates production if the NMLS id ever reads `PENDING`), so a stranger reaches
educational content and a waitlist, never a mortgage-solicitation surface. The full
commercial machine — intake, deterministic pre-approval, LO claim/handoff, dual-AUS run,
MISMO packaging, wholesale delivery — is **built and verified end-to-end behind the gate
against simulated vendors** (2026-07-12 founder walkthrough, PRs #135–#139; see
[BETA_GO_LIVE_READINESS.md](knowledge-base/runbooks/BETA_GO_LIVE_READINESS.md)), one config
flip from go-live (`VITE_PRELAUNCH_GATED` + beta access code — founder-only). Nothing
commercial is legally real until that flip — see
[ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md) for what is real, simulated, or
pending, and [CTO_ROADMAP.md](CTO_ROADMAP.md) for the live work queue.

## Quick start

```bash
corepack enable            # one-time: activates the pinned pnpm (ships with Node)
pnpm install && pnpm dev   # dev server on port 5001 — full setup in LOCAL_DEV.md
pnpm check                 # typecheck
pnpm test                  # unit tests
```

Dev logins: see [TEST_ACCOUNTS.md](knowledge-base/runbooks/TEST_ACCOUNTS.md) (requires `DEV_TEST_PASSWORD` in `.env`).

## Which document do I trust?

**All documentation lives in [`knowledge-base/`](knowledge-base/)** (see its
[index](knowledge-base/README.md)). Three *living* docs stay at the repo root: this **README.md**
(landing), **[CLAUDE.md](CLAUDE.md)** (Claude Code auto-loads it here), and
**[CTO_ROADMAP.md](CTO_ROADMAP.md)** (the live work queue). A fourth root file,
**[PRODUCT_SPINE.md](PRODUCT_SPINE.md)**, is a one-line pointer stub kept only so old links
resolve — its content moved to [L1](knowledge-base/L1_VISION_AND_SCOPE.md); do not add to it.
Regulatory source binaries stay in **[`docs/`](docs/)**; app-data (not docs) in
`data/regulatory/`.

Two axes of authority:

- **Precedence** (which doc wins on intent): **L1 → L2 → L3** —
  L1 Vision & Scope (scope/cut-line) → L2 Compliance & Logic (guardrails override features) →
  L3 feature specs (cite L1 + L2). See the [KB index](knowledge-base/README.md) for their status.
- **Freshness** (which doc is current): the tiers below. **When a document disagrees with the
  code, the code is the truth and the document is a bug** — fix or flag it.

### Tier 1 — Live sources of truth (kept current, trust these)

| Document | What it governs |
|---|---|
| [CTO_ROADMAP.md](CTO_ROADMAP.md) | **The work queue.** Launch sprint + ordered backlog. Updated in the same commit that completes an item. |
| [CLAUDE.md](CLAUDE.md) | Non-negotiable session rules: compliance-first doctrine, architecture ground rules, DB rules. |
| [handbook/DEVELOPER_PLAYBOOK.md](knowledge-base/handbook/DEVELOPER_PLAYBOOK.md) | The deep engineering map — layers, engines, conventions. |
| [handbook/app-guide/](knowledge-base/handbook/app-guide/) | The 11-chapter subsystem handbook. Start at [01-start-here](knowledge-base/handbook/app-guide/01-start-here.md). |
| [governance/ASSUMPTIONS.md](knowledge-base/governance/ASSUMPTIONS.md) | The fact/assumption register: what is simulated, pending, or verified-when. |

### Tier 2 — Doctrine (decisions; change deliberately, never casually)

| Document | What it decides |
|---|---|
| [L1 — Vision & Scope](knowledge-base/L1_VISION_AND_SCOPE.md) *(supersedes `PRODUCT_SPINE.md`)* | Product modules, roles, the core loop, AI boundaries (AI never decides lending outcomes). |
| [governance/TEAM_PRACTICES.md](knowledge-base/governance/TEAM_PRACTICES.md) | How every session works: doc-staleness rules, branch/worktree lifecycle, definition of done, push policy. |
| [compliance/UNDERWRITING_SCENARIOS.md](knowledge-base/compliance/UNDERWRITING_SCENARIOS.md) | Living scenario registry — the "no citation → not implemented" contract. |
| [governance/AI_GOVERNANCE_POLICY.md](knowledge-base/governance/AI_GOVERNANCE_POLICY.md) · [governance/MODEL_RISK_GOVERNANCE.md](knowledge-base/governance/MODEL_RISK_GOVERNANCE.md) | Adopted AI governance policy + model inventory under it. |
| [compliance/REGULATORY_MONITORING.md](knowledge-base/compliance/REGULATORY_MONITORING.md) | How statutory constants stay verifiably aligned with official sources. |
| [compliance/SCENARIO_ARCHITECT.md](knowledge-base/compliance/SCENARIO_ARCHITECT.md) | Operating instructions for scenario/guardian work. |
| [compliance/SAFE_MLO_COMPLIANCE_MAP.md](knowledge-base/compliance/SAFE_MLO_COMPLIANCE_MAP.md) · [compliance/COMPLIANCE_COUNSEL_REVIEW.md](knowledge-base/compliance/COMPLIANCE_COUNSEL_REVIEW.md) | SAFE Act / MLO advertising crosswalk + the standing compliance-counsel review. |
| [runbooks/PRE_PRODUCTION_OPS_ROUTINES.md](knowledge-base/runbooks/PRE_PRODUCTION_OPS_ROUTINES.md) | The founder's pre-launch operating routines (current: 5-routine launch suite). |
| [docs/fannie-mae/](docs/fannie-mae/) · [docs/nmls/](docs/nmls/) · [docs/nmls-safe/](docs/nmls-safe/) | Official GSE + NMLS reference documents — never work from memory on ULDD/UCD/URLA/MISMO or NMLS licensing. |
| [handbook/design/design_guidelines.md](knowledge-base/handbook/design/design_guidelines.md) | Design system rules. |
| [compliance/security/threat_model.md](knowledge-base/compliance/security/threat_model.md) | Security threat model. |

### Tier 3 — Runbooks (operational how-to)

[runbooks/LOCAL_DEV.md](knowledge-base/runbooks/LOCAL_DEV.md) · [runbooks/CICD.md](knowledge-base/runbooks/CICD.md) · [runbooks/ROLLBACK.md](knowledge-base/runbooks/ROLLBACK.md) · [runbooks/TEST_ACCOUNTS.md](knowledge-base/runbooks/TEST_ACCOUNTS.md)

### Tier 4 — Dated snapshots (true as of their date only)

Everything under [knowledge-base/logs/](knowledge-base/logs/) — currently the dated
UX audit + design routine runs ([logs/ux-audit/](knowledge-base/logs/ux-audit/)). The
launch-era operational logs (founder-routines, lo-audit) and one-time platform assessments
(2026-07-02 → 07-06) were quarantined 2026-07-08 to
[knowledge-base/archive/](knowledge-base/archive/) (banner-marked; never act on them).
The [governance/ARMED_LAUNCH_CHARTER_2026-07-07.md](knowledge-base/governance/ARMED_LAUNCH_CHARTER_2026-07-07.md)
is filed under `governance/` for its locked launch *decisions*, but its execution log is a dated
snapshot — read its status banner, not it, for the current launch state.

**Snapshot rule:** these are never silently edited to look current. When reality moves on,
they get a dated **superseded/status banner** at the top pointing to the live source.
Verify any "X is missing" claim against the code before acting on it.

### Tier 5 — Archive

[knowledge-base/archive/](knowledge-base/archive/) — factually obsolete documents retained for
history. Never act on these.

## Repository ground rules (summary — full rules in CLAUDE.md)

- `main` is production and protected: every merge deploys to Vercel. Land work via
  short-lived PR branches through the required `gate` check — direct pushes are rejected.
- `client/` and `server/` never import from each other; both import from `shared/`.
- Vendor integrations are deterministic simulations behind adapters until real contracts exist.
- Borrower PII goes through `server/services/encryptionService.ts` / `ssnVault.ts` + audit log.
- Migrations are hand-authored SQL in `migrations/` (`pnpm db:migrate`). Never `db:push`
  from a worktree against the shared dev database.
