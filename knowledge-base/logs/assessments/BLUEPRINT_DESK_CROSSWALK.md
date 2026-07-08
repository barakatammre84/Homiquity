# Blueprint 18-Desk Crosswalk

**Date:** 2026-07-03 · **Lens:** the "Master Homiquity Autonomous Enterprise Blueprint" (18 specialized desks) mapped onto code that exists today
**Companion docs:** [STATE_OF_THE_PLATFORM.md](./STATE_OF_THE_PLATFORM.md) (CTO assessment — P0/P1 inventory) · [LENDER_READINESS_GAP_ANALYSIS.md](./LENDER_READINESS_GAP_ANALYSIS.md) (vendor-review lens) · [CTO_ROADMAP.md](../../../CTO_ROADMAP.md) (living checklist)

## Why this doc exists

The blueprint reads as a from-scratch org plan ("stand up 18 isolated Claude workspaces"). It is mostly a **description of a platform that already exists.** This crosswalk exists so we don't rebuild what's built, and so the genuinely-missing desks are visible against the two constraints that actually govern our work:

1. **The freeze** — [PRODUCT_SPINE.md](../../../PRODUCT_SPINE.md): *"Nothing new ships unless it improves correctness, compliance, or reliability. Feature development is frozen."*
2. **The real P0 list** — licensing, vendor contracts, uploads, auth recovery, email, observability, CI ([STATE_OF_THE_PLATFORM.md](./STATE_OF_THE_PLATFORM.md) §3). None of these is a new desk; all block every desk.

Legend: ✅ built · 🟡 partial · ❌ absent · 🔒 net-new (would violate the freeze) · ⚖️ framable as compliance/correctness (freeze-allowed)

## The crosswalk

| # | Blueprint desk | Reality | Evidence | Gap / already flagged |
|---|---|---|---|---|
| 1 | Core Platform / entity tables | ✅ | 13 schema domains in `shared/schema/*`; unified read layer `server/services/borrowerGraph.ts`. Already entity-centric, not app-file-centric — exactly what the blueprint asks for | Data-quality holes (loan amount unset → "$0 volume") — STATE §4.2 ⚖️ |
| 2 | Data Integration / Open Banking | 🟡 | Plaid Link init/exchange real (`verification.ts`, `ausSubmission.ts`); MISMO 3.4 export built & verified (`server/mismo.ts`) | Asset-report parsing, Truv VOIE, tri-bureau all **simulated** (`server/mcp/vendors.ts`, flagged `simulated:true`); no Finicity/Xactus/FDX. Gated on vendor contracts — STATE §3.2 |
| 3 | Security / DevSecOps | 🟡 | AES-256-GCM on credit payloads, helmet, rate limiters, CSRF, PG sessions, `requireRole`, audit log; presigned-URL vault **architecture** | Field-level encryption is credit-only, not all-PII; **vault credentials unconfigured** + legacy multer path still live (P0.6); **zero observability** (P0.7) |
| 4 | Regulatory Compliance / TRID | ✅ | LE generation (`loanEstimate.ts`), versioned consent ledger, MISMO validation, `complianceInvariants.test.ts`. Consent gate now **wired + tested** (`requireConsent` on LE, roadmap L2) and funnel consent **persisted** (L1) — commit `4d3cc29` | Still open: quiet-hours + SMS STOP gates (roadmap #24/#25) ⚖️ |
| 5 | CFPB neutrality / anti-steering | ✅ | **Anti-steering disclosure BUILT** — `server/consentGate.ts` `ANTI_STEERING_TEMPLATE` (Reg Z §1026.36(e)(3): lowest-rate / lowest-cost / no-risky-features), acknowledged via `borrower_consents`; `LoanOptions.tsx` records it (commit `3211e09`, roadmap L3) | Shipped. LENDER_READINESS H3 ("does not exist") is **stale** |
| 6 | Multi-State NMLS router | 🟡 | Lookup matrix by geography (`lookupResolver.ts`) for underwriting; state-specific consent templates | Company NMLS = `"PENDING"` (P0.1); **no state-license routing gate**, no LO-assignment engine (M3 / F2 / STATE §4.6) |
| 7 | RESPA §8 (co-marketing FMV) | 🔒❌ | Co-branding surfaces exist (`AgentCoBranding.tsx`, `PartnerServices.tsx`) — the risk surface | No FMV / split-billing / pro-rata engine behind them. **Net-new feature** |
| 8 | Deterministic Underwriting | ✅ | `decisionEngine.ts`, `ruleEngine.ts`, `preUnderwriting.ts`, `underwritingNuance.ts`, DU submission (`ausSubmission.ts`), 6+ test suites. AI confined to coach/extraction, never decisioning | Core strength. Nothing flagged |
| 9 | Non-QM / asset depletion | 🟡🔒 | Scenario + schema coverage (`kb/UNDERWRITING_SCENARIOS.md` 84KB, `shared/schema/underwriting.ts`) | No dedicated bank-statement / asset-depletion / 1084 **income-calc engine** confirmed. Net-new as an engine |
| 10 | Anti-Fraud / forensic | 🔒❌ | — | No occupancy-misrep / red-flag / identity-mismatch engine. **Net-new** (some parts framable as compliance) |
| 11 | Pre-Funding QC | 🟡 | `preUnderwriting.ts` covers **pre-underwriting** (intake-time) validation | Pre-*funding* QC (LE↔updated-credit tolerance re-check before close) is a different lifecycle stage — not built |
| 12 | Conversational POS / UX | ✅ | Full funnel (`PreApproval` 1003, calculators), `coachingService.ts`, three surfaces (Incubator/Engine/Portfolio) | Task-engine over-generation ("56 tasks", P1.1); ~900 legacy color classes (STATE §5) — UI polish, freeze-LOW |
| 13 | Lead Gen / Intent | 🟡 | `intentTracker.ts`, `signalEngine.ts`, `predictiveEngine.ts`; compliant `leads` schema (TrustedForm/TCPA, no SSN/DOB) | **No `/api/leads` intake endpoints** — "front door not wired to the street" (STATE §4.4) |
| 14 | B2B Partner API | 🟡🔒 | `agent-broker.ts` routes + co-branding pages | No embeddable white-label widget, partner API keys, or webhook framework. Largely net-new |
| 15 | Portfolio Retention | 🟡 | `lifecycleEngine.ts`, `optimizationEngine.ts`, `outcomeTracker.ts`, Homeowner surface | Refi-alert + equity-snapshot daily jobs + graduation hook **deferred** → surface has no data feed (STATE §4.5) ⚖️(reliability) |
| 16 | Capital Markets / PPE | ✅ | `server/pricing.ts` `calculateLLPA` (full component breakdown), `rate_sheets ⋈ products ⋈ wholesale_lenders`, layered margin formula, full rate-lock lifecycle, `pricingUnderwriting.test.ts` | LLPA not borrower-facing (M5); no prod rate sheets loaded (P1.9) |
| 17 | Ops & Closing | 🟡 | `taskEngine.ts` + event emitter; upload→condition auto-matching **shipped** (roadmap L4) | Still open: settlement/closing state machine, title/escrow coordination ⚖️(reliability) |
| 18 | Post-Closing / Delivery | 🔒❌ | MISMO 3.4 export exists (`server/mismo.ts`) | No LE↔CD fee reconciliation, no MERS delivery packaging, no completeness scanner. **Net-new** |

## The three buckets

**Built & solid (leave alone):** #1, #4, #5, #8, #12, #16 — core platform, compliance/TRID + anti-steering, deterministic underwriting, POS, pricing/PPE. The blueprint's most detailed desks are the ones already strongest here.

**Partial — real work already flagged in existing docs (freeze-allowed where ⚖️):** #2, #3, #6, #11, #13, #15, #17. **None of these need a new desk.** Every gap is already a ticket in STATE_OF_THE_PLATFORM / CTO_ROADMAP. The blueprint adds framing, not new information.

**Genuinely net-new (🔒 — blocked by the freeze):** #7 RESPA §8, #9 Non-QM engine, #10 Anti-Fraud, #14 white-label widget, #18 Post-Closing delivery. These are the only desks the blueprint proposes that don't already exist in some form — and building them is exactly the "new feature" work the freeze prohibits.

## What the blueprint gets wrong about us

- **"Transition away from monolithic application-centric files toward entity-centric tables"** — already done (desk 1). The premise is a year stale relative to the code.
- **"Upload root `CLAUDE.md` to every workspace"** — that file doesn't exist; `kb/app-guide/` (01–11) is the actual anchor and is more useful.
- **"Stand up 18 isolated Claude workspaces"** — an org-workflow choice, not code. In this repo the analog is subagents/skills (`.agents/`, `.claude/`), and spinning up 18 is overkill against a codebase this consolidated.
- **"95%+ calculation precision"** — we already hard-guarantee determinism (AI banned from the math path); the number is marketing, the property is real and tested.

## Recommended focus (freeze-compliant, highest-leverage)

> **Correction (2026-07-03):** an earlier draft of this section recommended the LENDER_READINESS H1→H2→H3 sprint. **That sprint already shipped** (roadmap L1–L5, commits `4d3cc29` + `3211e09`) — the recommendation was built on a stale gap doc. Verified against code and git before rewriting this section. `LENDER_READINESS_GAP_ANALYSIS.md` is superseded by `CTO_ROADMAP.md`, which is the maintained source of truth.

With L1–L5 done, the freeze-compliant next work is whichever **open** roadmap item I can complete without waiting on business/vendor setup:

- **Blocked on you (accounts/credentials), so code-only:** #1 uploads (GCS bucket), #2/#3 auth recovery + real email (SendGrid), #4 monitoring (Sentry).
- **Fully self-ownable now, ⚖️ freeze-allowed:** **#5 restore minimal CI** (reliability — no `.github/workflows` exists), **#7 stage-gated data validation** (correctness — apps reach `pre_approved` with $0 loan amount / 0 documents; admin dashboard reads wrong), **#10 self-cleaning integration tests** (reliability), **#24/#25 quiet-hours + SMS STOP** (compliance, build-ahead).

Recommended order: **#5 (fast reliability safety net) → #7 (core-correctness fix).** Everything under 🔒 waits until the freeze lifts and licensing/vendor P0s clear.
