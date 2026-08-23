# Homiquity — Vision & Scope (L1)

> **Freshness:** last verified 2026-08-23 · review every 90 days — enforced by `scripts/doc-freshness-guard.cjs`.

> **This is L1 — the top of the source-of-truth hierarchy.** It decides *what we build*.
> **L2 `L2_COMPLIANCE_AND_LOGIC.md`** (the regulatory/financial guardrails) overrides anything
> here when they conflict. **L3 `[Feature]_SPECS.md`** files execute under both and MUST cite the
> L1 loop they serve and the L2 constraints they obey. If a proposal doesn't advance the core loop
> in §2 — the Selling-Guide-complete three-party system — or the platform quality it rides on, it
> is deferred; see the cut-line in §3.
>
> *Supersedes `PRODUCT_SPINE.md`, which it absorbs; PRODUCT_SPINE becomes a pointer here during
> the Knowledge Base consolidation.*

---

## 1. Business Intent — why Homiquity exists

**Getting a mortgage is slow, opaque, and anxiety-ridden because the borrower's file is a mess of
scattered documents that no two parties see the same way.** A borrower waits days not knowing where
they stand; a lender receives a disorganized packet and sends it back for what's missing; everyone
re-keys the same data.

**Homiquity removes that friction by turning a borrower's raw inputs into one organized,
lender-ready mortgage package — fast, honest, and compliant — and delivering it straight to a
wholesale lender.** Our edge is *certainty and speed*: a borrower knows where they stand in one
session, and a lender opens a package that is complete, standards-valid, and decision-ready on the
first pass. Everything we build either sharpens that certainty or gets out of the way.

## 2. The core loop (the product, in one sentence)

> **A borrower completes intake → gets an instant, deterministic pre-approval read → their file
> becomes a standards-valid MISMO package → we deliver it to a wholesale lender.**

Homiquity is a **mortgage broker**: the spine runs **borrower ↔ wholesale lender**. This is the
loop every MVP decision serves. What each link MUST do:

- **Intake** MUST capture a complete, consented URLA and start the TRID clock at exactly the six
  application pieces — no sooner, no later.
- **Decision** MUST be deterministic and AI-free (same inputs → same outcome), route ambiguity to a
  human, and never take adverse action without the required notice.
- **Package** MUST produce MISMO 3.4 / ULDD-valid output — it is rejected at the lender if it isn't.
- **Delivery** MUST gate submission until intake, AUS, and lender-package stages are clean, and
  carry an audit trail. The platform packages, validates, hashes, and tracks every submission
  in-app; transmission itself is a staff hand-off through the lender's own portal until broker
  agreements unlock the direct integration (`CTO_ROADMAP.md` LS-10 slice 3).

Agents, sellers, listings, and homeowner tools are **peripheral** (they feed or extend the loop);
they are never on the critical path to a funded loan.

## 3. The cut-line (scope discipline — how we decide what ships)

**If a feature does not advance the Selling-Guide-complete three-party system (borrower · broker ·
wholesale lender) or the platform quality it rides on, it is deferred.** Full stop. This is the
test every proposal passes before it gets engineering time (founder directive 2026-08-23, CHARTER
§1a — launch left the test; the Guide-conformant deliverable replaced it). It replaces "is this a
good idea?" (everything is) with "does this move a borrower toward a delivered, fundable package —
or make one of the three parties' surfaces genuinely better?" **Business events are never part of
this test**: licensing, contracts, counsel and go-live live in the roadmap's founder lane
(`CTO_ROADMAP.md` §1) and neither qualify nor disqualify engineering work.

For work already in flight, the MVP scope is locked:

| IN (serves the loop / the three-party deliverable) | Deferred (good, but not the loop) |
|---|---|
| The core loop (intake → decision → package → delivery) | Borrower data-permission dashboard (PR #62) |
| Acquisition top-of-funnel: Approval Strength (PR #61), Buying Power + SEO (PR #63) | The dead server-only subsystems (Intelligence, Rules authoring, ~~Rate Sheets~~*, Optimization, Market-data) |
| Uploads hardening (PR #67) | The analytics/predictive feedback loop |
| The MISMO delivery-correctness fixes (the 2 P0s: [F-018/F-019](feature-review/FINDINGS.md)) | P2 security/test hardening; running the QA review sweep |
| The lender persona surfaces* (CTO_ROADMAP 2.15 — sanctioned 2026-08-23) | Title / Insurance / Invest and other future modules |

> Parenthetical `PR #NN` are GitHub pull-request numbers (not `CTO_ROADMAP.md` line items — that
> file uses its own `LS-`/`F-`/`G-` numbering). Live status for any of them: the
> [CICD.md](runbooks/CICD.md) production change ledger.
>
> \* "Rate Sheets" meant the unused admin rate-sheet/lender-offer authoring API
> (`server/routes/rate-sheets.ts` — no client callers), **not** the live demo pricing tables (the
> `1.0-demo` sheets seeded by `server/seedMarketPricing.ts` that feed the quote, anti-steering,
> and scenario paths — those were always IN, the clearly-marked simulation behind roadmap F11).
> **As of 2026-08-23 the lender persona over those routes is sanctioned build work** (founder
> directive; CTO_ROADMAP 2.15), so the Rate-Sheets deferral is lifted for that surface set.

## 4. What the platform IS (modules, prescriptively)

| Module | It MUST | Primary user |
|---|---|---|
| **Lend** | Run intake → deterministic pre-approval → package → wholesale delivery. *The core loop.* | Borrower + Staff |
| **Coach** | Structure intake and build the borrower package via AI **extraction only** — never decide (§6). | Borrower |
| **Ops** | Give staff a pipeline, document, and compliance surface with role-accurate gates. | Staff + Admin |
| **Rates / Calculators / Education** | Convert top-of-funnel; every rate/payment shown MUST carry its Reg Z disclosures. | Borrower |
| **Listings / Realtor Engine / Homeowner** | Extend the loop (affordability, agent referral, post-close) — **peripheral, never blocking a funded loan.** | Borrower + Agent |

Roles: **Borrower** (apply, upload, coach), **Staff** (underwriter/processor/LO — review, pipeline),
**Admin** (rules, team, config), **Agent/Broker** (referred borrowers only — external, deal-team
scoped). Client role gates MUST mirror the server gate (`isInternalStaffRole`, not `isStaffRole`).

## 5. What "launched" looks like (definition of done for the MVP)

- **A borrower can**, in one session: complete intake, get an instant pre-approval read, and receive
  a pre-approval letter with correct NMLS identity.
- **Staff can** open the file, see a complete package, and deliver a **standards-valid** MISMO
  package to a wholesale lender — accepted on the first pass, not bounced for structure.
- Every migration and compliance rail for the loop is green, and each vendor seam runs clean
  against its clearly-marked simulation (live keys swap in per `CTO_ROADMAP.md` §4 — never a
  build precondition). NMLS licensure itself cleared 2026-07-13 (#427468). ***Launched* is
  deliberately downstream of *built*** (CHARTER §1a): the go-live flip is founder business in the
  roadmap's §1 lane, and it never gates building.

## 6. Non-negotiable boundaries (L1 states them; L2 owns the detail)

These are absolute. Detail and citations live in **L2 `L2_COMPLIANCE_AND_LOGIC.md`**; L1 names them so
no feature idea can quietly cross one:

- **AI never decides.** AI extracts, structures, and surfaces — it never makes a lending decision,
  implies approval/eligibility, or assesses creditworthiness. Underwriting is deterministic and
  auditable.
- **Compliance overrides features.** Any regulatory/financial guardrail (MISMO/ULDD validity, TRID
  timing, FCRA/ECOA, TCPA, fair lending, NMLS) beats any UX or feature idea. When in doubt, escalate
  — never interpret.
- **PII through the vault.** SSNs/accounts are ciphertext + last4 only, decrypted solely at the
  delivery seam or an audited staff reveal, and every PII mutation is audit-logged.
- **The package makes no promises.** No approval language, no eligibility assessment, neutral
  validation language only, compliance footer on every package.

## 7. How to use this hierarchy

1. **Proposing work?** Run it through §3's cut-line first. If it fails, it's a deferred backlog
   item, not a debate.
2. **Writing a feature spec (L3)?** Open with a Business-Intent line, state the §2 link it serves,
   cite the L2 constraints it's bound by, then the execution detail — or it doesn't merge.
3. **Two docs disagree?** Precedence is L1 → L2 → L3, and **code wins over any doc on a stale fact**
   (that's a doc-drift bug to fix). The live work queue is `CTO_ROADMAP.md`; the knowledge lives in
   the Knowledge Base.
