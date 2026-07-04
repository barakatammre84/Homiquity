# State of Homiquity — CTO Platform Assessment

**Date:** 2026-07-03 (point-in-time snapshot — update or supersede, don't let it rot)

> **STATUS 2026-07-04 (source-of-truth audit):** much of §3/§4 has since shipped — trust
> [CTO_ROADMAP.md](../CTO_ROADMAP.md) for current status, this doc for the reasoning.
> Resolved since writing: §3.4 auth recovery ✓ (roadmap #2), §3.5 email code ✓ (ops env
> pending, LS-2), §3.7 error monitoring built (DSN pending, LS-2), §3.9 legal-page shells +
> adverse-action flow ✓ (#26), §4.1 task engine ✓ (#6), §4.2 stage-gated validation ✓ (#7),
> §4.4 leads API ✓ (#8), §4.5 lifecycle jobs ✓ (#9), §4.8 self-cleaning tests ✓ (#10),
> §4.9 demo rate sheets ✓ (#11), and the entire §5 palette sweep ✓ (#12–23). Still true:
> licensing (F1), vendor contracts (F3–F7), uploads (#1 → open PR #44), CI (#5 — workflow
> authored but stranded off-main; see ASSUMPTIONS.md §2).
**Audience:** Frontend, Backend/Platform, Data, DevOps, Compliance, AI, QA, Product
**Production:** https://mortgage-stream.vercel.app (homiquity.com custom domain pending) · **Repo:** single source of truth on `main`, every push deploys
**How to use this doc:** every numbered item in §3/§4 and every row in §5 is scoped to be a single work prompt/session — name the item, point at the files, state the acceptance check.

---

## 1. Executive summary

We have built the **skeleton and nervous system of an AI-native mortgage brokerage** — a Tinman-style architecture with all four core lending workflows implemented end-to-end against **simulated vendors**, deployed and stable on Vercel, with a coherent three-surface product (renter incubator → origination engine → homeowner portfolio) and a monochromatic design system partially rolled out.

The honest one-liner: **the machine is built and running, but it is not yet legally or commercially able to process a real loan.** Nothing blocking is architectural — the blockers are vendor contracts, licensing, a handful of compliance gates deliberately documented as unbuilt, and operational hardening (monitoring, CI, file storage). The codebase itself is in unusually good shape: zero TODOs, zero orphaned files after the 2026-07 hygiene audit, typecheck clean, 85 routes, 13 schema domains.

---

## 2. What is built (inventory)

### Platform & infrastructure
- **Deployment:** Vercel serverless, pnpm frozen-lockfile installs, esbuild pre-bundled server (`api/_app.mjs`), health endpoint, push-to-main pipeline with git-revert rollback. Battle-tested — survived and fixed the npm-on-Vercel bug, read-only filesystem, and module-resolution failures.
- **Database:** Neon Postgres (prod) + local Postgres/Docker (dev), Drizzle ORM with schema shared client/server, hot-path indexes added, `/api/dashboard` hydration rewritten from ~30 serial queries to 2 batched waves.
- **Security actually wired in:** helmet, general + auth rate limiters, CSRF with a webhook carve-out, PG-backed sessions, AES-256-GCM encryption for credit payloads, role-based guards (`requireRole`), audit log module.
- **Docs:** `DEVELOPER_PLAYBOOK.md` + the 11-file `kb/app-guide/` handbook.

### The four lending workflows (all simulated-vendor, all functional)
1. **Soft credit pull** — FCRA consent endpoints (disclosure, state rules, consent, revoke), repeat-billing cache guard, tri-bureau + VantageScore4 + debt ledger + DTI persisted encrypted. Adapter ready for CRS One/iSoftpull.
2. **Day 1 Certainty** — Plaid Link init/exchange, `/api/webhooks/plaid-assets` processor writing `voa_report_id` into `verification_reports`, Truv VOIE slot, 120-day expiry, GSE-eligibility flags.
3. **DU submission** — staff-gated `submit-gse`, Drizzle→DU-12.1-shaped translation, MISMO 3.4 types + validation (tested), per-layer D1C relief persisted, structured commitment letter returned.
4. **Pricing/secondary** — internal PPE (`rate_sheets ⋈ products ⋈ wholesale_lenders`), LLPA matrices, layered margin formula (`P_borrower = R_investor + M_base + ΔM_risk + ΔM_geography`), full rate-lock lifecycle (create/list/expiring/extend/cancel).

### Product surfaces (85 routes)
- **Incubator** (`client/src/pages/borrower/RenterHome.tsx`): goal tracker + readiness passport + calculator toolkit + pre-approval on-ramp for users with no application.
- **Engine** (`client/src/pages/borrower/Dashboard.tsx`): journey tracker, next-step engine, insights (likelihood/timeline/credit standing), financial profile, loan details, activity.
- **Portfolio** (`client/src/pages/homeowner/HomeownerDashboard.tsx`): equity/refi module, linked from closed loans.
- **Funnel:** PreApproval Digital 1003, calculators (rent-vs-buy, affordability, gap, rent-to-own), property browse/detail, AI coach, education hub.
- **Staff-side:** Staff/Admin/Broker/Agent dashboards, task engine, pricing matrices, underwriting rules, document flows, messaging with presence.
- **MCP server** (`server/mcp/`): 3 tools over stdio for agentic workflows, protocol-safe logging.
- **AI:** Gemini + OpenAI-backed coaching service, document extraction, decision/predictive engines.

---

## 3. Launch blockers (P0) — cannot take a real customer without these

| # | Gap | Detail | Owner |
|---|---|---|---|
| 1 | **Licensing** | `server/config/company.ts` says `nmlsId: "PENDING"`. No company NMLS, no state licenses, no licensed-LO roster. Everything else is theater until this exists. | Exec/Compliance |
| 2 | **Vendor contracts** | CRS/iSoftpull, Plaid (real keys), Truv, Fannie DU access, HouseCanary AVM — every adapter throws by design when a real key appears, so each contract triggers a small "implement the real adapter" ticket. | Backend + BD |
| 3 | **Compliance gates (documented as unbuilt)** | Quiet-hours middleware, SMS STOP webhook + queue purge, NMLS state-routing gate. Codified in `DEVELOPER_PLAYBOOK.md` §4 as blockers for any outbound-messaging feature. | Backend |
| 4 | **Auth recovery** | **No password reset and no email verification exist.** A locked-out borrower today is permanently locked out. Pre-beta requirement, not a nice-to-have. | Backend |
| 5 | **Email is a console stub in prod** | `server/services/emailService.ts` falls back to logging when no SendGrid/SMTP env is set — and none is set in production. Every "notification" we think we send is silently discarded. Configure SendGrid + verify domain (SPF/DKIM). | DevOps |
| 6 | **File uploads are broken-by-design on Vercel** | Two parallel paths exist: multer disk storage in `server/routes/utils.ts` (writes to `/tmp` on serverless = **files vanish**) and a GCS presigned-URL flow (`/api/uploads/request-url` in `server/routes/documents.ts` + `server/integrations/object_storage/`) that needs bucket credentials that aren't configured. Decision: configure GCS and **delete the multer path**. Document uploads are core to a mortgage product; this is P0. | Backend + DevOps |
| 7 | **Zero observability** | No Sentry, no uptime monitor, no log drain. A production 500 today is invisible unless a user reports it. Minimum bar: Sentry (client+server) + a free uptime ping on `/api/health`. | DevOps |
| 8 | **Zero CI** | The `.github/` directory doesn't exist — when we simplified to push-to-main we deleted all checks. No deploy gates is accepted policy, but a **non-blocking** typecheck+unit-test action on push costs nothing and catches the "forgot to run tsc" class of breakage before users do. | DevOps |
| 9 | **Legal surface** | No privacy policy, terms, or FCRA adverse-action notice flows in the app. Required before collecting real PII at scale. | Product + Legal |

---

## 4. Workflow issues (P1) — things that work but work wrongly

Found by driving the app as buyer/admin/renter (2026-07):

1. **Task engine over-generation.** The test buyer sees "Complete **56** pending tasks." No borrower will engage with that. The engine needs task caps, grouping into milestones ("3 documents needed," not 14 rows), and stage-based relevance filtering. Biggest borrower-UX defect in the Engine.
2. **Data-quality holes visible on dashboards.** Admin shows "7 Active Loans / **$0 volume**" (loan amounts not set on applications) and "Compliance **0%**, 7 need attention." Either the metrics are wrong or every loan is non-compliant — both readings are bad. Needs stage-gated field validation so an application can't be `pre_approved` with no loan amount.
3. **Contradictory borrower signals.** The buyer dashboard says "Pre-approved ✓" while insights say "0 documents submitted" and "Low engagement may indicate uncertainty." The borrower state machine (`server/services/borrowerStateMachine.ts`) should make these states mutually consistent. *(Partly addressed 2026-07-03: `predictiveEngine` no longer emits engagement-based "uncertainty/inactive" risk factors — or their score penalty — once a borrower reaches a committed stage (pre-approval or later, via `isCommittedStage` in `shared/stageRequirements.ts`). Verified live: 4/4 committed + low/dormant borrowers no longer flagged uncertain. The factual "Few documents submitted" signal is intentionally kept — a pre-approved borrower with no docs genuinely has a next step, not a contradiction.)*
4. **Leads table has no intake API.** The compliant `leads` schema exists (TrustedForm evidence, TCPA text, no SSN/DOB by design) but there are **no `/api/leads` endpoints** — no way for an aggregator, landing page, or partner to create a lead. The front door of the funnel isn't wired to the street.
5. **Deferred lifecycle jobs still deferred:** refi-alert daily job, equity-snapshot job (AVM → snapshots), closed-loan graduation hook (auto-surface Homeowner Hub). The Portfolio surface has no data feed without these.
6. **No LO/staff assignment engine.** Applications exist but nothing routes them to a human; the staff dashboard is a viewer, not a work-distribution system. (This is also where the NMLS gate from §3 must live.)
7. **Messaging is poll-based with presence theater.** Presence dots render but there is no real-time transport (the only WebSocket in the codebase is the Neon driver). Either wire presence to something real or drop the dots.
8. **Integration tests pollute shared data.** Runs create loan applications for `buyer@test.com`, which drifts dashboards between runs. Tests must create-and-clean their own fixtures.
9. **Prod has no rate sheets.** `get_best_execution_rates` correctly returns "no products" in production. Fine until a demo. Seed a marked demo sheet or build the staff rate-sheet upload flow.

---

## 5. UI issues — detailed

**The design system is won; the sweep is not.** Obsidian Indigo tokens, atoms, and scaffolding are done (Phases 1–3). The 2026-07 audit found **~900 hardcoded legacy Tailwind color classes across ~20 files** plus 12 raw hex literals. Heaviest offenders, in user-impact order:

| File | Why it matters |
|---|---|
| `pages/public/Landing.tsx` (hero) | First impression; still dark-gradient + emerald headline/CTA from the old brand |
| `components/HomeReadinessPassport.tsx` | Now renders on RenterHome — most visible violation for brand-new users |
| `components/JourneyTracker.tsx` | Center of the borrower Engine view |
| `pages/homeowner/HomeownerDashboard.tsx` | Whole Portfolio surface off-palette |
| `pages/education/AICoach.tsx`, `FirstTimeBuyerHub.tsx` | High-traffic education surfaces |
| `pages/admin/AdminDashboard.tsx`, StaffDashboard | Pastel blue/purple/green/yellow KPI icon tiles — visibly legacy next to restyled chips |
| `components/TrustLayer.tsx`, `AffordabilityBadge.tsx`, `NotificationsPanel.tsx`, `BorrowerRequests.tsx`, `DealTeam.tsx`, `ui/toast.tsx` | Shared components leaking legacy color into otherwise-clean pages |
| `pages/property/PropertyDetail.tsx`, `LivePropertyDetail.tsx` | Listing surfaces |

Sweep rules (proven on `getStatusColor` in `client/src/lib/formatters.ts`): monochromatic ramp for in-flight/informational states, `status-success/warning/danger` **only** for approval/alert semantics, one route per commit, zero logic changes.

Other UI-layer issues:
- **Dark mode is untested debt.** Legacy classes carry `dark:` variants; token classes intentionally don't. Decide whether dark mode is supported at all; if not, remove the variants during the sweep.
- **Empty states are inconsistent.** RenterHome has a designed empty state; several staff views render bare zeros ("My Queue (0)") with no guidance.
- **Accessibility has never had a pass.** Strong on `data-testid`; unknown on focus order, aria labels, and contrast (precision-ramp mid-values against white need checking).
- **Readiness score is conceptually duplicated.** RenterHome computes a client-side 10–85% score while the Passport shows the server's borrower-graph 0–100 score, and both render on the same screen ("42%" next to "10/100"). Unify on the server-side score with a renter-mode extension.

---

## 6. Team directives

- **Frontend:** Phase 4 palette sweep in the §5 priority order (Landing first, Passport second); unify the readiness scores; empty-state pass on staff views; kill or keep dark mode explicitly.
- **Backend:** password reset + email verification; leads intake API; task-engine caps/grouping; stage-gated field validation; the three compliance gates before any outbound messaging; real vendor adapters as contracts land; graduation hook + the two daily jobs.
- **DevOps:** SendGrid config + domain auth; GCS bucket + credentials, then delete the multer path; Sentry + uptime monitoring; restore a minimal non-blocking GitHub Action (tsc + unit tests); GitHub branch protection against force-pushes.
- **Data:** backfill/require loan amounts; define the compliance-% metric honestly; make integration tests self-cleaning.
- **Compliance/Legal:** NMLS filing is the critical path for everything; privacy/terms/adverse-action content.
- **AI:** MCP tools are ready for real keys; coach and extraction need production key budgets and rate-limit policies before public traffic.
- **QA:** the two unit suites and integration suites are the entire safety net; each of the four workflows in §2 deserves a happy-path + failure-path integration test running in the restored CI.

---

## 7. Recommended sequence

From "working demo" to "product I'd let a stranger touch":

**§3.6 (uploads) → §3.4 (auth recovery) → §3.5 (email) → §3.7/§3.8 (monitoring + CI) → §4.1 (task engine) → Landing redesign** — with licensing (§3.1) and vendor contracts (§3.2) running in parallel on the business side, since they gate everything commercially.
