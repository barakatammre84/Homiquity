# 2026-07-19 — External "plug-and-play modular architecture" pitch: adjudication

> **Dated snapshot** (Tier 4). Facts verified against the code on 2026-07-19; verdicts govern
> until a reopen gate below fires. Same protocol as
> [2026-07-17-external-agentic-mortgage-artifacts-evaluation.md](./2026-07-17-external-agentic-mortgage-artifacts-evaluation.md):
> adopt nothing wholesale, verify every claim in code, extract what survives, record binding
> rejections with reopen conditions.

## 0. What arrived, and the ask

An external AI-generated architecture proposal ("decoupled micro-pipelines"): ingestion
adapters normalizing to a common format, RabbitMQ/Redis-Queue transformation workers,
PostgreSQL + PostGIS storage, JSONB schema-on-read for "alternative data" (social sentiment,
foot traffic, job postings), dependency-injected swappable risk-scoring, Docker-containerized
scrapers. Its closing move: "shall we draft the database schema with the specific JSONB
flexibility needed for these future-proofed datasets?"

The founder's framing alongside it: **no more assumption-driven building — facts only**;
evolve with *absolute minimums*; and the lived pain that **even simple UI changes are very
time-consuming**. This memo answers both: §1–§3 adjudicate the pitch; §4 is the measured
UI-velocity investigation (where the real pain is).

Domain note before anything else: the pitch is written for a **property-investor
intelligence product** ("stay ahead of other investors"). Homiquity is a **licensed mortgage
brokerage** (NMLS #427468, Illinois-only footprint). That mismatch matters in §2 and §5.

## 1. Facts: the modularity the pitch prescribes largely already exists

Every row verified in code this session, not from memory:

| Pitch concept | Repo-native form that already ships |
|---|---|
| "Ingestion adapters, normalized common format" | The vendor-adapter doctrine: credit/AVM/GSE/pricing calls exist **only** behind adapter functions with typed interfaces (`server/services/pricingAdapter.ts` `BorrowerPricingProfile`→`ComputedOffer`, `server/mcp/vendors.ts`, `server/plaid.ts`), deterministic simulations until a real key exists, `simulated: true` flagged in responses. Stronger than "normalize to JSON": both sides are compile-time typed via `shared/`. |
| "Message-queue workers so ingestion can't take down analysis" | Deliberately deferred, decision recorded: DU submission is synchronous in-request and "when real DU latency arrives, **the adapter is where a queue gets introduced — not the route**" (DEVELOPER_PLAYBOOK §2.3). Async work that exists today runs as 4 Vercel crons + CSRF-exempt webhooks. |
| "Add new tables, join by FK, no refactor" | The Free Data Moat is exactly this, live: `shared/schema/marketData.ts` (3 normalized tables), two offline ingest scripts (`pnpm data:hmda`, `pnpm data:fannie`), staff-only query routes, and a written **compliance invariant** (advisory only — never mutates a quotable rate; Reg Z executability). New source = new table + new script + new route. |
| "JSONB for flexible data" | **165 `jsonb(` columns** already exist across `shared/schema/` — used where a concrete consumer exists (`pre_uw_flags`, `aus_findings`, `liabilities`, `readinessSnapshot`, …). |
| "Dependency-inject the scoring logic" | Scoring is **data, not code**: `UnderwritingRuleDsl` rows (AND/OR condition groups, dotted field paths, actions, execution logs — `server/services/ruleEngine.ts`) + lookup grids + deterministic engines with typed error classification + immutable `decisionSnapshots`, recomputed via `recalculateDecision` on fact change. Adding a risk factor is a rules/data change, not a schema refactor. |
| "Version-controlled pipelines, test new alongside old" | Ingest scripts are git-versioned and run offline; Neon **branch databases** (the preview-DB infra, #239–#244) already provide "run the new pipeline against a copy" without Docker. |

The layering rails (`client/` ⇹ `server/`, both ← `shared/`; storage split into 22 domain
files; route sub-registrar directories) are the decoupling the pitch asks for, enforced by
convention + guards.

## 2. Point-by-point verdicts

| Recommendation | Verdict | Why (evidence) | Reopen gate |
|---|---|---|---|
| Standardized ingestion adapters | ✅ **Exists** | §1 row 1. Codify nothing new — point new sources at the moat pattern. | — |
| RabbitMQ / Redis Queue workers | ❌ **Do not build** | No persistent worker process can run on the deployment target (one serverless function, `maxDuration: 30`, `vercel.json`); binding precedent — the Confluent streaming pitch was rejected 2026-07-17 as "wrong-sized: 3 new vendors to replicate in-process semantics we already have"; the queue-at-the-adapter deferral is already doctrine. | A contracted vendor whose real latency/volume breaks the cron+webhook model — then a queue lands **behind the adapter seam**. |
| PostGIS | ❌ **Do not add** | Zero geospatial consumers in the codebase (0 hits for PostGIS/`ST_*`); licensing footprint uses ZIP3 integer ranges (`shared/companyIdentity.ts`). A dependency without a consumer is precisely the assumption-driven building the founder banned. | A shipped feature that computes spatial relations. |
| JSONB schema-on-read: "dump unstructured data now, structure later" | ⚠️ **Pattern yes, doctrine no** | The pattern exists (165 columns) but "dump now" collides with two hard rails: prod is **migrate-gated** (`guard:schema` — a column lands with its migration, same PR) and **provenance doctrine** (`shared/dataProvenance.ts`: `assertVerifiedForDecisioning` — unverified data can never back a decision, TILA/TRID/ECOA). Rule restated in §3. | — (the rule is the gate) |
| Swappable scoring modules | ✅ **Exists, stronger** | §1 row 5 — and note the constraint the pitch misses: **Reg B — no AI in the decision path** (L1 AI boundaries; memo #206 §4 binding rejections). "Proprietary AI risk-scoring" is barred; deterministic, citable rules are the design. | — |
| Docker-containerized scrapers | ❌ **Do not build** | There are no scrapers; ingestion is offline scripts + webhooks. Parallel-version testing = run the script against a Neon branch DB. Containers add ops surface with no consumer. | A real always-on ingestion service (none planned). |
| "Draft the JSONB-flexible schema now" (the pitch's closing ask) | ❌ **Declined** | Speculative schema for data sources that don't exist = assumption-driven schema. `guard:schema` + same-PR-migration doctrine exists to prevent exactly this. | A named source with a named consumer → normal migration flow. |

## 3. The "facts only" rule — already codified; one restatement

The founder's "no assumptions, build only on facts" is **existing doctrine**, not a new rule:
`ASSUMPTIONS.md` (the fact/assumption register), TEAM_PRACTICES §8 (verify before asserting),
the no-citation-no-implementation contract (UNDERWRITING_SCENARIOS), README's "code wins"
freshness rule, and `dataProvenance.ts` *in code*. One restatement worth carrying forward,
implied by the rails but not written anywhere as a sentence:

> **No speculative schema.** A column (jsonb or otherwise) lands only with a named consumer,
> in the same PR as its migration. "We might ingest X someday" is not a consumer.

New data sources additionally inherit the moat pattern's compliance step: fair-lending review
before anything feeds borrower-facing logic. Sentiment/foot-traffic-style signals are
**proxy-discrimination risks under ECOA/Reg B** if they ever touch decisioning — marketing-side
use and decision-side use are different regulatory universes.

## 4. The real pain, measured: why UI changes are slow

Measurements (2026-07-19):

- **128 page files, 114 routes** (`client/src/App.tsx`, 588 lines, all lazy), 34 token-driven
  primitives, 48 pages on `PageShell`.
- **12 pages ≥ 940 lines** — `staff/BorrowerFile.tsx` 1,432 · `staff/StaffDashboard.tsx` 1,408 ·
  `lending/PreApproval.tsx` 1,371 · `borrower/Dashboard.tsx` 1,092 · 8 more. (The 07-16 hygiene
  sweep took these to their *dedupe* floors; they remain single-file features.)
- **2,586 `data-testid` hooks exist — and zero component-test consumers.** No
  @testing-library, no jsdom/happy-dom, no Playwright/Cypress/Storybook. Vitest runs
  node-side logic only.
- Consequence, per the Definition of Done (TEAM_PRACTICES §5.3–5.4): the **only** way to prove
  any UI change is to boot a worktree dev server and drive a browser. That manual loop — not
  compile time (Vite HMR is fast), not the design system — is the dominant per-change cost.
  Secondary costs: the design-token guard is manual-run with known baseline races, and
  Reg Z/N copy rails require review on public surfaces (necessary; already partially
  test-pinned — `tests/leadNotifications.test.ts` is the precedent).

**Minimal interventions, ranked (recommendations — nothing implemented yet):**

1. **Add a component-test lane.** devDependencies only: `@testing-library/react` +
   `@testing-library/user-event` + `happy-dom`, second vitest project config. Tests assert
   against the **2,586 test hooks that already exist** — the substrate was built and never
   consumed. Runs inside the existing `pnpm test` gate ⇒ UI regressions caught in CI for the
   first time; browser-driving reserved for genuinely visual/E2E acceptance. No runtime deps,
   no schema, no vendors — the absolute-minimum move with the largest velocity effect.
2. **Boy-scout splitting of the 4 giant staff/lending pages** — extract feature components
   *only when a change touches them*, characterization test first, never big-bang (the
   hygiene-sweep lesson applies: splits dodge name-pinned guards — broaden guards to families
   when splitting).
3. **Optional, later:** once (1) stabilizes baselines, revisit promoting
   `design-token-guard` into the CI gate (today deliberately manual per CICD.md).

**Explicitly not recommended for UI velocity:** Storybook (new build surface), a full
Playwright/Cypress E2E suite (the integration suite + in-app browser verification already
cover E2E), and any storage/queue change (unrelated to the measured bottleneck).

## 5. Summary

The pitch's destination — modular, plug-and-play, evolvable — is the architecture this repo
already has, in a compliance-shaped form the pitch doesn't know about (adapters + typed
shared schema + rules-as-data + provenance gating + migrate-gated prod). Its concrete infra
prescriptions (queues, PostGIS, Docker, speculative JSONB) are rejected on facts: no
consumer, wrong deployment model, or collision with binding rails — each with a reopen gate.
The measured evolution bottleneck is elsewhere: **UI verification is 100% manual**. The
minimum-footprint fix is a component-test lane over the existing `data-testid` substrate,
plus opportunistic decomposition of the four ~1,400-line pages.
