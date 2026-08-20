# COI PartnerHub Program — Charter & Build Prompts (L3 program spec)

**Status:** in flight (adopted by execution) — **PH-1 merged (#121**, migration `0021`),
**PH-2 merged (#134**, migration `0022`; its consent copy is a standing counsel gate);
**next: PH-3**; PH-4/PH-5/PH-6 open · **Owner:** Amr (founder/PM) · **Roadmap:** tracked in
CTO_ROADMAP "Active program tracks"; executes the partner/COI GTM pivot (partner waitlist PRs
#96–#98) and the agent-B2B2C lane of the borrower-acquisition playbook; consumes the UAL income
engine (#108, merged); resolves roadmap **ARC-1** (leads API has no client binding — the embed
decision) in PH-6 · **Last updated:** 2026-07-12

> This is a *program* spec: six sequenced build prompts, each of which becomes its own one-page
> L3 spec (copy [`_TEMPLATE.md`](_TEMPLATE.md)) when claimed. It executes under
> [L1](../L1_VISION_AND_SCOPE.md) + [L2](../L2_COMPLIANCE_AND_LOGIC.md); where this doc and L2
> disagree, L2 wins. It processes an external AI strategy draft (2026-07-11, "Unified Partner
> Portal & Permission Framework" + 7 tool prompts). That draft's direction is adopted; several
> of its mechanisms are **corrected or cut** below because they reverse settled compliance
> doctrine already encoded in this codebase. §5 is the authoritative list of those corrections —
> a claimed prompt implements the *chartered* version, never the draft's.

## 1. Business Intent

Post-HPPA, our first hundred borrowers come through people they already trust — realtors, CPAs,
financial advisors — not through paid consumer acquisition. Those centers of influence refer to
whoever makes them look good and never makes them look bad: instant, honest numbers for their
client, visibility into where the file stands, and zero risk that we poach the relationship or
drag them into a compliance problem. Today we capture partner *interest* (partner waitlist,
PRs #96–#98) and we have deep but **fragmented** partner rails — a CPA channel, an agent
co-branding system, universal referral codes, application invites — each built separately, none
presented as one product. This program unifies them into **PartnerHub**: one partner identity,
one attribution spine, one masked pipeline view, and per-persona toolkits that wrap engines we
already trust. The moat is the same as everywhere else on this platform: deterministic, cited
math (income orchestrator, pricing, underwriting) delivered at conversation speed — breadth
(self-employed, non-QM, later halal) no competing point-tool gives a referral partner.

## 2. Serves L1 loop

- **Core-loop link:** borrower → **pre-approval** → MISMO package → wholesale delivery. This
  program feeds the *front* of the loop (qualified borrowers arriving with a trusted-referrer
  context and, via the CPA lane, with tax documents already understood) and strengthens
  pull-through (a referrer watching masked milestones keeps their client moving).
- **Cut-line check:** partner-led acquisition **is** the launch GTM (the pre-license
  acquisition target is the referral network, per the partner-waitlist doctrine in
  `shared/schema/admin.ts`). Partner recruitment/onboarding surfaces are B2B and pre-F1-safe;
  every consumer-reaching tool below sits behind the pre-license gate and activates at F1 (I9).
  Nothing here preempts a launch blocker.

## 3. Bound by L2 (the guardrails every prompt obeys)

| L2 invariant | How this program satisfies it |
|---|---|
| **I1 — AI never decides** | Every partner-facing number composes existing deterministic engines (calculators, UAL income orchestrator, `underwritingEngine`, `pricingAdapter`, `apr.ts`). The PH-3 asset guard is a deterministic lexicon scan (shared with LO-5), not an NLP classifier. No model output anywhere in a partner surface. |
| **I2 — No citation, no regulated-math change** | Regulated content this program touches — Reg N no-approval phrasing (12 CFR Part 1014), Reg Z §1026.24 trigger-term lexicon, the §1026.19(e)(2)(ii) pre-LE statement on any cost illustration — lands with `data/regulatory/regulatory-ledger.json` citations in the same commit. Cites in this charter are planning references; implementation verifies against eCFR/primary sources first. |
| **I4 — PII through the vault** | Partners see **no borrower PII, ever** — masked milestone labels only, no financials, no documents, no credit data. The existing CPA posture (progress-only, `shared/schema/cpaPartners.ts`) is the program-wide ceiling, now with an explicit borrower consent artifact. All partner reads are partner-scoped and audit-logged. |
| **I7 — Outbound messaging is TCPA-gated** | v1 partner alerts are in-app + email (`emailService`). No partner SMS leg until finding F-008 (webhook signature verification) closes; any future SMS passes `evaluateOutboundSms`. Partner-shared links to consumers are sent by the partner from their own tools — we never text a consumer a partner asset. |
| **I8 — Fair lending is monitored** | Internally, via the existing aggregate, admin-gated `fairLendingAnalysis` machinery. The draft's partner-facing referral-demographics surveillance is **cut** (§5-C7): inferring protected classes of referred borrowers is itself the hazard. No prohibited-basis variable or proxy in any partner-scoring metric. |
| **I9 — NMLS gates solicitation** | PartnerHub onboarding/dashboard is B2B (recruitment, like the waitlist). Every consumer-reaching surface (Buyer Power Report, co-branded pages, embeds) mounts behind the `prelaunchGate` pattern and activates at F1. Inherits the open calculator-suite counsel-review item. NMLS identifier display comes from `shared/companyIdentity.ts` (renders only when real, per PR #50). |
| **I10 — Simulations never ground a real decision** | Rate sheets are simulated until the PPE contract: therefore **no rate, APR, or payment figure appears in any partner or co-branded asset until PPE + F1** (§5-C4). License "lookup", custodian, and MLS integrations do not exist as contracts — adapter seams + manual queues, honestly labeled, never fabricated validation. |

- **Security-review trigger?** Yes, repeatedly. PH-1 (new self-registering auth surface + role
  gates) is the highest-sensitivity change in the program; PH-2 (partner visibility into
  borrower pipeline), PH-5 (consent-gated data sharing), PH-6 (cross-origin embed + webhooks)
  each run `/security-review` before merge; unresolved CRITICALs block (L2 §4). The UAL
  program's two IDOR findings are the cautionary precedent: every partner read is scoped by
  the partner's own attribution rows, exact-role gated, never `isStaffRole`.
- **Regulated math?** Yes — PH-3 (trigger-term/promise-phrase lexicons), PH-4 (estimate
  labeling + §1026.19(e)(2)(ii) statement), each ledger-cited in the same commit (I2).

## 4. What already exists (build on it, don't rebuild it)

Recorded so no prompt reinvents a rail. **Code wins over this table on any stale fact.**

| Capability | Where it lives today | State |
|---|---|---|
| Partner/COI waitlist (B2B, pre-license-safe) | `partner_waitlist` (`shared/schema/admin.ts`) + `/partners` + `AdminPartnerWaitlist.tsx` | Live (PRs #96–#98); the PH-1 recruitment funnel |
| CPA channel — inviter-only, §7216-clean, no-comp-by-design | `shared/schema/cpaPartners.ts` + `server/routes/cpaPartners.ts` + `CpaPortal.tsx` | Live (PR #66); the **model** for every partner lane |
| Self-registering partner role pattern (exact-role gated, never staff) | `PARTNER_ROLES` in `shared/roles.ts` | Live; extend with `realtor` (PH-1) |
| Universal referral codes + attribution | `users.referralCode` + `/api/my-referral-code`, `/api/referral/:code`, `/api/apply-referral` (`server/routes/agent-broker/`) | Built |
| Co-branding profiles + public co-brand pages | `co_brand_profiles` (`shared/schema/admin.ts:394`) + `/api/co-brand/*` | Built |
| Application invites (token, resend, revoke, applied-tracking) | `/api/application-invites*` (`server/routes/agent-broker/`) | Built |
| Pre-approval letters w/ conditions, expiry, NMLS ids, watermark + **co-brand preview** | `server/services/pdfLetterGenerator.ts`, `PreApproval.tsx`, `/api/pre-approval-letters/:id/co-brand*` (co-brand PUT is staff-gated) | Built — already the compliant shape PH-4 needs |
| Agent directory/profiles/pipeline/deal-desk/milestones | `agentProfiles` (`shared/schema/property.ts`) + `server/routes/agent-broker/` + `agent-broker/*` pages | Built; agents ride ordinary user accounts — no partner role yet (PH-1 formalizes) |
| Borrower-facing masked journey | `client/src/components/JourneyTracker.tsx` | Live; PH-2 reuses its masked stage taxonomy |
| Pre-license gate (server-enforced, fail-safe on NMLS-pending) | `server/services/prelaunchGate.ts` + `client/src/lib/prelaunch.ts` | Live; every consumer-reaching PH surface mounts behind it |
| Deterministic engines: calculators suite, UAL income orchestrator, underwriting, pricing, APR, LE costs | `server/routes/calculators.ts`, PR #108 orchestrator, `underwritingEngine.ts`, `pricingAdapter.ts`, `apr.ts`, `loanEstimate.ts` | Built (pricing simulated — I10) |
| Property data (AVM) behind an adapter | `server/services/valueEstimate.ts` + `server/routes/property.ts` (realty-us RapidAPI) | Built; PH-4's prefill source (no ATTOM/MLS contract exists) |
| Plaid (assets/income/identity verification) | `server/plaid.ts` (`isPlaidConfigured()` env-gated, sandbox default) | Real integration, borrower-initiated flows only |
| Tax-readiness pipeline (consumer-direct upload) + income package builder | PR #55/#66/#108 (`taxInsightService`, P5 capture, P6 `buildIncomeAnalysisPackage`) | Live/merged; PH-5 re-skins derived outputs |
| SEO/content engine (bot head-injection, JSON-LD, DB sitemap) | PR #91 system, `server/routes/seo.ts` | Live; PH-3/PH-4 co-branded pages extend it |
| Comms + compliance rails | `emailService.ts`, `smsCompliance.ts` + `quietHours.ts`, `auditLog.ts`, `fairLendingAnalysis.ts` (aggregate, admin-gated) | Built |

**The genuinely new builds:** the unified partner identity/attribution spine over these rails
(PH-1/PH-2), the partner-asset compliance guard (PH-3), and — later phase — the embed seam
(PH-6). Everything else is composition.

## 5. Doctrine corrections to the draft (binding — the chartered version wins)

| # | Draft proposed | Chartered instead | Authority / why |
|---|---|---|---|
| **C1** | "Incentive management… points balance, tier, rewards," blocked-if-illegal by a rules engine | **No incentive engine at all.** No points, tiers, rewards, or anything of value that varies with referrals. The CPA channel's no-compensation-columns-by-design posture (`cpaPartners.ts`) is program law. Co-marketing tooling (PH-3) is the only "reward," and only under a counsel-approved framework (§8). A rules engine cannot make a per-referral thing-of-value legal, and disclosure does not cure §8. | RESPA §8(a), 12 USC 2607; 12 CFR §1024.14 — §8(c)(2) FMV-for-actual-services is the only lane; counsel-verify |
| **C2** | CPA uploads client tax returns "on behalf of a client"; masked-identity workaround | **Rejected — reverses the settled design.** The CPA lane stays inviter-only: CPA shares a link, the **client** uploads consumer-direct (outside the IRC §7216 preparer-disclosure flow — the documented rationale in `cpaPartners.ts`). Masking identity from us does not cure the CPA's §7216 disclosure. CPA value comes from borrower-consented sharing of *derived* readiness outputs (PH-5), never return access. | IRC §7216; Treas. Reg. §301.7216; existing tax-insight doctrine |
| **C3** | Realtor "one-click pre-approval letter generator" | Letters remain **staff-issued** through the existing `pdfLetterGenerator` path (conditions, expiry, NMLS ids). The realtor sees letter *status* and the existing co-brand preview once the borrower consents. Partner-facing outputs are labeled estimates/readiness — never "approval," "pre-approved," or likelihood language. A broker does not approve loans. | Reg N, 12 CFR Part 1014 (MAP); UDAAP; existing seo-content rails |
| **C4** | Co-branded assets "populated with real-time rate and product data"; payment widgets on listings | **No rate/APR/payment figure in any partner or public co-branded asset until PPE contract + F1.** Simulated sheets are for internal tooling only (I10); a published simulated rate is a false ad. Pre-gate co-branding is education-only (PH-3). When rates go live, every asset passes the §1026.24 trigger-term scan. | I10; Reg Z 12 CFR §1026.24 |
| **C5** | Realtor/partner inputs the buyer's income/debts; CPA runs client analyses | **Partner distributes, consumer inputs — program doctrine.** Financial data enters only through borrower-authenticated flows (the partner shares a link/QR). Keeps partners clear of licensable application-taking (SAFE/Reg H) and keeps every lane consistent with C2. Partner-keyed data is limited to property-side facts (price, taxes, HOA) on non-decisioning illustrations. | SAFE Act, 12 CFR Part 1008 (verify activity boundary at implementation); I4 |
| **C6** | Partner sees referral status by default; "no PII until borrower shares" | Milestone visibility itself is borrower financial information. **Explicit borrower consent artifact, default OFF,** captured in the borrower's own flow, revocable, audited. Stages render from the JourneyTracker masked taxonomy; **wholesale-lender identity appears nowhere** (borrower-transparency doctrine extends to partners); no amounts, no credit data, no documents. | GLBA / Reg P consent-direction posture (counsel-verify); borrower-transparency doctrine |
| **C7** | "Fair lending monitoring… analyzes referral patterns by the COI's borrower demographics" | **Cut from the product.** We do not infer or track protected-class composition of a partner's referrals — the proxy inference is itself a fair-lending/privacy hazard (I8). Internal aggregate monitoring stays where it is (`fairLendingAnalysis`, admin-gated). Partner education (e.g., "halal financing exists") ships as content, not surveillance. | I8; ECOA/Reg B; existing AI_GOVERNANCE_POLICY §8 machinery |
| **C8** | Halal purification reports, Musharaka-vs-conventional tax-deductibility calculator, halal listing widgets | **Gated on P7 (founder calls) and Shariah/tax authority.** We are a broker-triage firewall — no certification authority, no Shariah rulings, and no tax-treatment comparator without citable authority (I2: no citation, no implementation). The UAL P7 lane owns halal productization. | UAL charter P7 hard gates; I2 |
| **C9** | "Using our asset depletion engine"; custodian (Schwab/Fidelity) real-time verification; Monte-Carlo-adjacent ROI/IRR advice | `asset_depletion` exists only as a `PRODUCT_TYPES` enum value (`shared/schema/underwriting.ts`) — **there is no engine.** The advisor suite is deferred until a deterministic asset-depletion qualifying engine lands via a Step-0 primary-source pass (Selling Guide section verified at build, SE-program pattern). Custodian pulls have no contract → adapter seam, advisor-entered assumptions labeled as illustrations for the licensed advisor — the platform gives no investment advice. | I1/I2/I10; SE-income Step-0 precedent |
| **C10** | "License validation via API (NMLS…, state CPA lookup)" | No public real-time NMLS/CPA-license APIs exist to build on. PH-1 captures license identifiers, verifies through a **manual admin queue** behind a `licenseVerification` adapter seam (future data contracts slot in). Never render "verified" from a lookup we didn't perform. | Honest-capability rule; I10 adapter doctrine |

## 6. What this program is NOT (the cut list)

| Cut | Why | Reopens only if |
|---|---|---|
| Points/tiers/rewards incentive engine | §5-C1 — RESPA §8 | Counsel delivers a §8(c)(2)-conformant program design; founder adopts |
| Partner-facing fair-lending/referral-demographics analytics | §5-C7 | AI_GOVERNANCE_POLICY change + counsel design — unlikely |
| CPA-direct tax-return upload | §5-C2 | Counsel-designed §7216 consent capture, and a reason the consumer-direct flow can't serve |
| Attorney portal (v1 draft) | Cites systems that don't exist (contract graph = unpushed research; "Compliance Document Bus" = nothing); closing docs come from the lender/title in a broker model; estate-plan projections are UPL-adjacent | Post-F1 **and** P7 gates clear; then a scoped read-only spec (invitation-only, deal-team-scoped) |
| Builder persona | Named in the draft's signup list, given no tools, no defined workflow | Founder defines the builder workflow; likely a realtor-variant lane |
| Wildcard partner subdomains (`agent123.homiquity.com`) | homiquity.com cutover isn't done; multi-tenant TLS/routing is heavy | Domain cutover complete + partner volume justifies; path-based slugs (`/p/:slug`) serve until then |
| Web-Components SDK with CDN + host-style inheritance | Host-style inheritance lets host CSS suppress required disclosures — the non-removable footer must be ours (iframe). ARC-1 needs the product decision first | PH-6 iframe embed proves demand; then an SDK spec with disclosure-integrity tests |
| Mailchimp/SendGrid co-marketing automation + shared marketing calendar | New outbound vendor + standing co-marketing = RESPA-sensitive; `emailService` covers v1 alerts | Counsel co-marketing framework (§8) + vendor decision |
| Partner-initiated Plaid pulls | Bank linking stays borrower-initiated inside borrower flows (C5); integration already exists | Never partner-initiated |
| "Offer strength score" shared to realtor (credit/assets-derived) | Composite of borrower financial strength disclosed to a third party; consent + Reg B adverse-signal design unresolved | Post-F1, borrower-consent design + counsel review |
| Monte-Carlo/IRR "beat the market" advisor comparisons | Non-deterministic advice surface (LO-program cut precedent); investment-advice line | A real analytics mandate w/ counsel; deterministic illustrations only meanwhile |

## 7. The build prompts

Recommended order: **PH-1 → PH-2 → PH-3 → PH-4 → PH-5 → PH-6.** Identity spine first (everything
hangs off it), dashboard second (the recruitment demo), the asset guard **before** any prompt
that emits co-branded assets, then the persona toolkits, then embeds. Migrations: 0013–0019 are
applied; **claim contiguous numbers at build time** (0020 was next as of 2026-07-11 — the LO
Advisor program draws from the same pool; check `migrations/` when claiming).

### PH-0 — Program framing (directive to: everyone)

Every prompt below answers one question for a referral partner: *"if I send you my client, will
you make me look good?"* That means instant honest numbers, visible progress, zero poaching
risk, zero compliance risk. If a feature doesn't make the partner look better in front of their
client — or protects neither them nor us while doing it — it doesn't belong in this program.

### PH-1 — Partner identity spine & PartnerHub shell (directive to: engineering)

Unify the fragmented partner rails into one identity + attribution model:

- **Role:** add `realtor` to `PARTNER_ROLES` (`shared/roles.ts`) — self-registering, exact-role
  gated, deal/attribution-scoped, never staff (the `cpa` precedent and its schema-comment
  rationale apply verbatim). `advisor` is reserved but NOT added until its suite exists.
- **Data:** generalize the `cpaPartners` shape into a `partner_profiles` table (persona enum,
  firm, license identifiers + `license_verification_status` manual-queue field per §5-C10,
  referral slug, status) with `partner_referrals` as the single attribution read-model over the
  existing rails (`users.referralCode` grants, `cpaReferrals`, `agentReferralRequests`,
  application invites). First-touch-wins stays the rule (the `cpaReferrals` unique constraint).
  Hand-authored migration; number claimed at build.
- **Signup:** self-service at `/partners/join` with persona selection; converts
  `partner_waitlist` rows (invite email via `emailService`); admin approval queue in the
  existing admin surface. B2B — pre-F1-safe, mirrors the waitlist's compliance rationale.
- **Shell:** `/partners/hub` PageShell layout with persona-aware nav; existing CpaPortal
  becomes the CPA tab content. Path-based co-brand slugs (`/p/:slug`) — no subdomains (§6).

Constraints: server gates by exact role + partner-scoping on every read (IDOR precedent, §3);
client gates mirror server; all partner mutations audit-logged.
**Done when:** a realtor and a CPA can each self-register, land in one hub, own a referral
slug, and appear in the admin queue; a waitlist row converts end-to-end; no partner can read
any borrower object they didn't refer (negative tests prove it). DoD per `TEAM_PRACTICES.md`
§5. **Security review: mandatory** (new self-registering auth surface).

### PH-2 — Unified partner dashboard: masked pipeline + consent spine (directive to: engineering)

The referral-status view that makes the program recruitable — built consent-first:

- **Consent artifact:** borrower-side opt-in ("share my progress with ⟨partner⟩"), default
  OFF, per-partner, revocable, timestamped, audit-logged; captured in the borrower flow (not
  by the partner). New table rides the PH-1 migration train.
- **Pipeline view:** the partner's referrals with masked milestone labels reusing the
  JourneyTracker stage taxonomy — Invited → Applied → In Processing → Cleared to Close →
  Closed. **No amounts, rates, documents, credit data, or wholesale-lender identity** (§5-C6).
  Consent-off referrals render as "Invited / Applied" existence-only states defined with
  counsel input (§8) — nothing beyond what the partner already knows because they sent the
  referral.
- **Alerts:** in-app + email digest via `emailService` on milestone transitions (consented
  referrals only). No SMS (F-008, I7).
- **Performance basics:** the partner's own counts/conversion from `partner_referrals`.
  Anonymized peer comparison is a later phase — needs a k-anonymity floor before any
  cross-partner stat renders.

**Done when:** a borrower toggles sharing on and their realtor's dashboard gains exactly the
masked stages (live on :5002); toggling off removes them; a second partner sees nothing;
every partner read of the pipeline writes an audit entry. **Security review: yes.**

### PH-3 — Partner-asset compliance guard + co-branded education engine (directive to: engineering + compliance)

The safety net ships **before** the asset generators (PH-4/PH-5 emit through it):

- **Generator:** partner-branded educational pages and printable one-pagers (QR → the
  partner's `/p/:slug`) composed from the existing SEO/content system — first-time-buyer
  checklists, self-employed borrower guides, market explainers. **Education-only until
  PPE + F1** (§5-C4): no rates, payments, or approval language anywhere.
- **Deterministic guard:** every generated asset passes the Reg Z §1026.24 trigger-term and
  Reg N promise-phrase lexicons (shared implementation with LO-5 — coordinate, don't fork;
  ledger-cited per I2). Partner-uploaded custom assets enter an admin review queue —
  never auto-published.
- **Immutable disclosure footer:** brokerage identification + Equal Housing language +
  NMLS identifier from `shared/companyIdentity.ts` (renders when real, hidden while
  PENDING — PR #50 pattern), rendered server-side into the asset, not client-removable.
- **SEO hygiene:** partner pages are `noindex` or canonical-to-primary at launch — the
  co-branded engine must not spawn a duplicate-content farm under the PR #91 system.

**Done when:** a partner generates a co-branded checklist PDF + page carrying the immutable
footer; a seeded trigger-term draft is blocked with the cited reason; an uploaded flyer lands
in the review queue and cannot go live unreviewed. **Regulated math: yes (lexicons, I2).**

### PH-4 — Realtor toolkit: Buyer Power Report + property scenario (directive to: engineering)

The realtor's "make me look good" tool, composed from existing engines, borrower-input only:

- **Flow (C5):** realtor shares link/QR from their hub → **buyer** authenticates and enters
  their own financials (or connects Plaid — existing borrower-initiated integration; or
  imports their tax-readiness results). Realtor may pre-fill *property-side* facts only:
  price, taxes, HOA, insurance estimate — prefilled from the existing `valueEstimate`/property
  adapter when an address is given (no MLS/ATTOM contract — §5-C10 honesty applies).
- **Report:** co-branded (PH-3 pipeline) Buyer Power Report — affordability band, cash-needed
  band, product-path comparison (conventional/FHA/VA/non-QM as the catalog serves; DSCR shows
  ratio only per the UAL P4 rule; **no halal lane until P7**) — labeled as an estimate with
  Reg N-safe language, **no rate/APR/payment figures until PPE + F1**, carrying the
  §1026.19(e)(2)(ii) statement verbatim (eCFR-verified at build, I2/I5).
- **Engine seam:** consume the LO-2 `scenarioSimulator` service if it has landed (preferred);
  otherwise compose `calculators` + UAL orchestrator + `underwritingEngine` directly behind
  the same interface LO-2 will fill. Persist runs to the same audit substrate.
- **Letters (C3):** the report links the buyer into the real application flow (attribution
  via PH-1); pre-approval letters remain staff-issued; the realtor's hub shows letter status +
  the existing co-brand preview for consented referrals.
- **Gate:** entire consumer-reaching surface behind `prelaunchGate`; activates at F1.

**Done when:** end-to-end on :5002 — realtor sends link, buyer self-enters data, both see the
co-branded report (buyer full, realtor consent-masked), the buyer clicks through into the
application funnel with the realtor attributed; determinism test pins identical inputs →
identical report. **Security review: yes (consumer data + partner visibility).**

### PH-5 — CPA toolkit v2 on the clean rails (directive to: engineering + compliance)

Deepen the existing §7216-clean channel — never reverse it (§5-C2):

- **Readiness share:** when a client completes the consumer-direct tax-readiness flow, offer
  the **client** a consent step to share *derived outputs* with their CPA — qualifying-income
  summary by path (re-skinned from the P6 `buildIncomeAnalysisPackage` shape: numbers +
  citations, no raw documents), readiness band, and the "what's missing" checklist. Consent
  artifact per PH-2's spine; revocable; audited. **Counsel reviews the exact shared-field set
  before this ships (§8).**
- **CPA-branded invite assets:** tax-season "Homeownership Readiness" one-pager + landing page
  through PH-3 (education-only rails, immutable footer).
- **Positioning content, not analysis tools:** the draft's entity-analyzer and
  Musharaka-vs-conventional tax comparator are cut/gated (§5-C8, C9) — the CPA lane's moat is
  the readiness pipeline we already built, presented so the CPA looks like the strategist.

**Done when:** a CPA-referred client finishes the readiness flow, consents, and the CPA's hub
renders the derived summary (nothing more — negative test proves no document/PII path);
revocation removes it; the co-branded one-pager passes the PH-3 guard. **Security review: yes.**

### PH-6 — Embed seam (iframe-first) + ARC-1 resolution (directive to: engineering, last)

Meet partners where they work — after the hosted surfaces prove demand:

- **Iframe embed** of the partner's `/p/:slug` microsite and the PH-4 report entry point:
  our styles, our immutable disclosures (the §6 SDK cut explains why not Web Components),
  height-negotiation via `postMessage` with a per-partner origin allowlist; loads async,
  never blocks the host page.
- **Attribution webhook:** embed submissions attribute through the PH-1 spine; this resolves
  roadmap **ARC-1** by binding `/api/leads` to the partner-embed path (the headless option) —
  with the founder's ARC-1 product decision recorded first.
- **Config:** per-partner embed settings (which tools, default assumptions) in the hub;
  versioned embed URLs so updates never break host pages.

**Done when:** a test page on a foreign origin renders the embed, a submission lands
attributed to the right partner, a non-allowlisted origin is refused, and the disclosure
footer is present in the embedded render. **Security review: yes (cross-origin surface,
webhooks, CSP).**

### Deferred lane — Financial-advisor suite (not claimable yet)

Blocked on three gates, in order: (1) a deterministic **asset-depletion qualifying engine**
built SE-program-style — Step-0 primary-source pass against the current Selling Guide
(section verified at build, never from memory), cited factors in the regulatory ledger,
then the engine, then tests (§5-C9); (2) the illustration-only advice posture (platform
computes, the licensed advisor advises); (3) founder prioritization against the core loop.
Custodian integrations stay adapter-shaped until contracts exist. When the gates clear this
becomes PH-7 with its own spec.

## 8. Dependencies, founder actions & escalations

| Item | Type | Blocks |
|---|---|---|
| **F1 — NMLS licensure** → flip `PRELAUNCH_GATED` | Founder/ops | Consumer-reaching activation of PH-3/PH-4/PH-5 assets, PH-6 |
| **PPE contract** (Lender Price + Mortech per broker-MISMO-PPE strategy) | Founder procurement | Any rate/payment figure in partner assets (§5-C4) |
| **Counsel: RESPA co-marketing framework** — what marketing support we may provide partners, FMV documentation, MSA posture | Founder/counsel | PH-3 co-marketing scope beyond education-only; any §6 incentive reopen |
| **Counsel: consent-share design** — PH-2 consent artifact + existence-only states; PH-5 shared-field set; GLBA/Reg P posture | Founder/counsel | PH-2 consent copy final; PH-5 ship |
| **Counsel: pre-license partner surface scope** — confirm PartnerHub B2B onboarding rides the waitlist rationale; fold into the open calculator-suite review item | Founder/counsel | PH-1 public launch (build can proceed) |
| **Ad-imagery / Fair Housing policy** (existing open item from the lifestyle-photography work) | Founder/counsel | Co-branded assets that use lifestyle imagery |
| Wholesale-lender **masking fix** (`task_fc63d240`) | Engineering (in flight) | PH-2 stage-taxonomy reuse (verify masked labels before partner exposure) |
| **LO-2 scenario simulator** (LO Advisor program) | Engineering (claimable) | Preferred engine seam for PH-4 (soft dependency — PH-4 defines the interface either way) |
| **ARC-1 product decision** (headless/partner-embed vs hosted intake) | Founder | PH-6 |
| homiquity.com **domain cutover** | Founder/ops | Nothing in v1 (path-based slugs); any future subdomain reopen |
| PR #102 (UAL charter doc) | Docs | Nothing — reference only |

**Escalation rule (L2 §3) reminders for claimers:** any RESPA/§7216/Reg N/Reg Z judgment call
not answered by §5 goes to the founder, not to an interpretation; any Selling Guide fact for
the advisor lane is verified at Step 0 against `docs/fannie-mae/` + the current Guide, never
from memory; NMLS policy questions go to `docs/nmls/`.
