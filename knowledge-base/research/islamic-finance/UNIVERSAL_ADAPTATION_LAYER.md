# Universal Adaptation Layer (UAL) — Alternative / Shariah-Compliant Financing

**Type:** exploratory research · **Dated:** 2026-07-09 (rev. 2 — broker-triage strategy) · **Owner:** engineering (feasibility map)

> **Status — read this before acting on anything below.**
> This is a **feasibility and architecture map**, not a spec and not committed scope. Alternative /
> Shariah-compliant financing (Musharaka, Ijara, Murabaha) sits **below the L1 cut-line**
> ([L1_VISION_AND_SCOPE.md](../../L1_VISION_AND_SCOPE.md) §3) and Homiquity is **pre-license**
> (every soliciting surface is behind `PRELAUNCH_GATED` until F1). **This document authorizes
> nothing** — no product code, no schema/migration, no MISMO change, no marketing, no
> origination — until (a) compliance **counsel ratifies** the legal determinations in §5 **and**
> (b) the work is **promoted through the L1 cut-line**. It exists so a future scoping decision
> starts from an honest map instead of a marketing manifesto.
>
> **This is a future moat, not a launch item.** Homiquity's core business is **traditional
> brokerage**, and the **active go-to-market launch is not touched, derailed, or re-prioritized by
> anything here.** The UAL is a deliberately-deferred competitive moat — a traditional broker that
> can *also* serve non-traditional (halal) borrowers **after** we are live. It **layers on top of**
> the core broker model; it does not replace or compete with it. Everything below is
> "someday-after-F1," by design, and this document pulls **zero** engineering, roadmap, or attention
> from the launch.

Source: an internal strategy paper, *"Standardizing Alternative Risk: Homiquity's Universal
Adaptation Layer"* (revised to a **broker-triage** thesis). That paper is a vision; this document is
the reconciliation of that vision with **what actually exists in this repository** and **what a
regulator/counsel would have to sign off on first.**

---

## 1. Why this exists, and the operating model

**The launch firewall (first, because it's the point).** Homiquity's core business is a
**traditional mortgage brokerage**, and that is what the current go-to-market launch delivers.
Alternative / halal financing is a **future moat, not a launch feature** — a traditional broker
that can *also* route non-traditional (halal) borrowers to the right place, added **after** we are
live. It does not change the core product, the launch roadmap, or the licensing path.

**The demand.** There is real, under-served demand for home financing that avoids *riba* (interest),
*gharar* (excessive contractual uncertainty), and *maysir* (speculation) — transactions must be
asset-backed and risk-sharing rather than interest-bearing.

**The operating model: broker-triage, not lender.** The revised strategy is explicit and correct on
this — Homiquity operates **strictly as a broker**. The UAL is a **front-end pre-underwriting triage
and packaging layer** that normalizes messy self-employed / 1099 files and formats an
alternative-structure application so it can be handed to one of the few **legacy Shariah wholesale
lenders** (e.g. University Islamic Financial, Devon Bank, Guidance) who already hold the
title-holding licenses, the Shariah-board sign-off, and the privately-negotiated GSE approvals.
Homiquity does **not** hold title, provision SPVs, act as landlord, submit directly to DU/LPA, or
issue securities. This shrinks the legal surface from "become an Islamic bank" to "clean up the
intake" — see §4 for what that means engine-by-engine.

**The core bottleneck is legal characterization, not code.** Conventional consumer-finance law
(TILA / RESPA / TRID) is built for a lender–debtor relationship secured by a lien; true Shariah
structures use co-ownership, lease-to-own, or installment sale where the financier holds a property
stake. That is a structural paradox: characterize the deal by its **form** (a JV or a lease) and the
financing entity inherits **property-owner liabilities and loses expedited foreclosure remedies**;
characterize it strictly as a **loan** to escape state property-holding law and you violate the
*riba* prohibition. Legacy lenders bridged this with OCC "functional-equivalence" letters — but that
federal preemption is **bank-only** (§5.2): a non-bank digital broker is governed by **state SAFE
Acts**, many of which bar non-banks from holding residential title or acting as a commercial
landlord without local licensure. **This is precisely why the broker-triage model exists** — it
keeps Homiquity out of the characterization trap entirely.

If a reader takes one thing from this doc: the hard part is **not the code** — the amortization /
translation math is tractable — it is the **legal characterization**, and broker-triage is the
deliberate answer to it. The open determinations (and who owns them) are §5.

---

## 2. Ground truth: what exists in the codebase today

A whole-repo search for `islamic | shariah | halal | musharaka | ijara | murabaha | sukuk | riba`
returns **zero** product references — this is greenfield. The relevant *conventional* seams the
UAL would have to plug into:

| Concern | Where it lives today | Constraint that matters |
|---|---|---|
| Loan program (GSE-facing) | `MortgageType` enum, [`shared/mismo.ts:234`](../../../shared/mismo.ts) | **Closed ULDD enum**: `Conventional · FHA · USDA · VA · Other`. No alternative-structure value exists. (ULDD data-point map, `shared/mismo.ts:1139`.) |
| Amortization type (MISMO XML) | [`server/mismo.ts:657`](../../../server/mismo.ts) | **Hardcoded to `"Fixed"`** in the XML builder; `MortgageType` emitted via `mapMortgageType()` (`server/mismo.ts:143`, default `Conventional`). |
| Internal product taxonomy | `PRODUCT_TYPES`, [`shared/schema/underwriting.ts:989`](../../../shared/schema/underwriting.ts) | The **extensible** allow-list (conventional/FHA/VA/USDA/HELOC/DSCR/bank_statement/…). This — not the ULDD enum — is where a new *internal* product type would be added. |
| Note terms (rate/amount/term) | `loan_options` table, [`shared/schema/lending.ts:402`](../../../shared/schema/lending.ts) | Per-scenario, not on the application row. |
| Amortization / APR math | [`server/services/apr.ts`](../../../server/services/apr.ts) | Canonical, cited (Reg Z §1026.22 / App. J). Exports `monthlyPrincipalAndInterest` (:16), `buildMortgagePaymentStream` (:33), `solveAPRFromStream` (:57), `calculateMortgageAPR` (:102). |
| Instant decision | [`server/underwritingEngine.ts`](../../../server/underwritingEngine.ts) + [`decisionEngine.ts`](../../../server/services/decisionEngine.ts) | **Forks only `CONVENTIONAL` vs `VA`** (`underwritingEngine.ts:248`) — there is **no generic product dispatch**. |
| Program derivation at intake | [`server/services/loanAnalysis.ts:22`](../../../server/services/loanAnalysis.ts) | Program is **derived server-side** from `loanPurpose` + `isVeteran` (union `"conventional"|"fha"|"va"`). There is **no borrower "pick your program" UI** and `preferredLoanType` is never written at intake. |
| PII rails | [`encryptionService.ts`](../../../server/services/encryptionService.ts), [`ssnVault.ts`](../../../server/services/ssnVault.ts), [`auditLog.ts`](../../../server/auditLog.ts) | Any SSN handling must route through these and emit an audit entry (CLAUDE.md). (SSN-as-trust-tax-ID itself is out of the broker lane — §4.3.) |
| Pre-license gate | `PRELAUNCH_GATED` ([`server/services/prelaunchGate.ts`](../../../server/services/prelaunchGate.ts), client `<Gated>`) | The established mechanism to hide an in-progress soliciting surface. |

---

## 3. The three structures — and how their cash flows *would* map

The mechanical insight the UAL depends on: each structure produces a monthly cash flow that can
be **decomposed into a principal-like component and a return-like component**, which is what the
conventional engine already consumes. This mapping is *arithmetic* — it is safe to model. What is
**not** safe is asserting that this mapping makes the product legally an interest-bearing loan for
disclosure/tax purposes (that is §5).

| Structure | Providers (per source paper — unverified) | Monthly cash flow | Candidate mapping to existing fields |
|---|---|---|---|
| **Musharaka** (diminishing co-ownership) | Guidance Residential, UIF | Acquisition payment `Aₜ` (buys down financier's equity share) **+** rental payment `Rₜ` (for use of the still-owned share) | `Aₜ → principalAndInterest` principal portion; `Rₜ →` return component → synthesize an equivalent-rate factor via `apr.ts`. Losses shared by ownership %. |
| **Ijara** (lease-to-own) | LARIBA, Ijara CDC | Rent **+** principal contribution; title transfers at full acquisition; SPV/trust holds title | Same decomposition as Musharaka; the **SPV/trust** is the differentiator — and it is the **funding lender's** to hold/administer (§4.3, out of our lane). |
| **Murabaha** (cost-plus installment sale) | Devon Bank | Fixed installment on a **marked-up price declared upfront** | Simplest: fixed markup → a single fixed **equivalent rate factor** feeding `calculateMortgageAPR`. |

**Where the translation math would live (P1, buildable):** a new **pure, cited** converter next
to the amortization primitives in [`server/services/apr.ts`](../../../server/services/apr.ts) —
e.g. `rentalYieldToEquivalentRate(...)` / `structureToPaymentStream(...)` — producing a
`noteRatePct`-equivalent and an `Aₜ` stream that the existing `buildMortgagePaymentStream` /
`calculateMortgageAPR` and `loanEstimate.ts` already know how to consume. It must carry a
citation before implementation — the **no-citation-no-implementation contract** lives in
[`compliance/UNDERWRITING_SCENARIOS.md`](../../compliance/UNDERWRITING_SCENARIOS.md). Note that
this is **not** auto-enforced for a new file: the grep-style guard in
[`tests/complianceInvariants.test.ts`](../../../tests/complianceInvariants.test.ts) is hardcoded
to read `underwritingNuance.ts` and would not cover an `apr.ts` converter, so the P1 author must
(a) add an anchor unit test in the shape of [`tests/apr.test.ts`](../../../tests/apr.test.ts) and
(b) extend that guard to read the new file.

---

## 4. The four engines, mapped onto this codebase

The broker-triage model splits the four engines into **two that are in Homiquity's lane** (the
front-end triage / packaging value) and **two that are not** (functions that belong to the funding
legacy lender, who holds title, the licenses, and the GSE approvals). For each: **what it touches**,
**extend-vs-greenfield**, and **the gate**.

> **v2 internal tension to resolve.** The revised paper's headline recommendation is broker-triage
> (Homiquity avoids title-holding and liability), yet its engine prose still describes the LTOE
> (SPV provisioning, SSN-as-trust-tax-ID, transfer-tax parsing) and parts of the CTE (generating
> Closing Disclosures / IRS Form 1098) **as Homiquity functions**. Those two things cannot both be
> true. This doc resolves it the safe way: under broker-triage, **§4.3 and §4.4 are the funding
> lender's, not ours.**

### 4.1 Contract Translation Engine (CTE) — *in lane; mostly buildable*
- **Touches:** `apr.ts` (equivalent-rate converter), `PRODUCT_TYPES` (internal taxonomy), and — for
  the *hand-off packet* only — `shared/mismo.ts` / `server/mismo.ts`.
- **Narrowed by broker-triage:** the CTE's job is **translation and packaging for lender intake** —
  turn an alternative structure's `Aₜ`/rent stream into the normalized fields a wholesale lender
  needs. It is **not** the consumer-disclosure engine: the binding TILA/Loan-Estimate/Closing-
  Disclosure and **IRS Form 1098** are the **funding lender's** obligation (§5.1), not the broker's.
- **Extend vs greenfield:** the **math** extends `apr.ts` (P1, still deferred). The **MISMO
  representation** is blocked by the closed `MortgageType` enum and the hardcoded
  `LoanAmortizationType="Fixed"` — any delivery must route through `MortgageType="Other"`, which is a
  GSE / lender question, **not** an enum we may invent (CLAUDE.md).
- **Gate:** the *math* is buildable behind the pre-license gate; the *disclosure* mapping is the
  lender's determination.

### 4.2 Alternative Risk Underwriting Engine (ARUE) — *in lane; the real value*
- **Touches:** `underwritingNuance.ts` (DTI / cash-flow math — the cited-function home);
  optionally a product branch in `underwritingEngine.ts` / `decisionEngine.ts` (today Conventional/
  VA only, `underwritingEngine.ts:248`).
- **This is the moat's actual value:** normalizing **self-employed / 1099** chaos — doc-AI
  extraction + cash-flow normalization over 12–24 months of bank statements — so a clean, decision-
  ready packet reaches the wholesale lender. Greenfield, but there is prior art in the tax-insight
  pipeline ([CTO_ROADMAP.md](../../../CTO_ROADMAP.md)); reuse before rebuild. The **"usufruct yield"**
  model (`annual market rent ÷ purchase price`) is greenfield **and** citation-required before any
  number lands.
- **Gate:** engineering for the ratio math; **counsel** for using rent-coverage in any ability-to-
  repay signal (ATR/Reg Z, ECOA/Reg B) — and note a broker produces *pre-underwriting triage*, the
  binding credit decision stays with the lender.

### 4.3 Legal & Tax Orchestration Engine (LTOE) — *OUT of lane (funding lender's)*
- Under broker-triage, **Homiquity does not build this.** SPV/trust provisioning, **SSN-as-trust-
  tax-ID** (§5.3), and "substance-over-form" **single-conveyance transfer-tax** treatment (§5.4) are
  title-holding-entity functions that belong to the legacy lender / aggregator who actually holds
  title. A broker that provisioned these would re-enter the exact liability trap §1 avoids.
- *If it were ever in scope,* anything touching SSNs would have to route through the PII rails
  (`encryptionService.ts`, `ssnVault.ts`, `auditLog.ts`) — but it is not in the broker-triage lane.

### 4.4 Liquidity & Securitization Bridge (LSB) — *OUT of lane (legacy lender / capital markets)*
- Also **not Homiquity's to build.** The GSE **"negotiated variances"** that let Fannie/Freddie buy
  Musharaka/Ijara contracts are **proprietary and exclusive** to the legacy firms who negotiated
  them over years of legal/Shariah review (§5.5) — a startup cannot inherit or programmatically use
  them. Homiquity's role is to **route the packaged file to a legacy lender who holds those
  approvals**, not to be a direct GSE seller/servicer.
- Tokenized Sukuk / ERC-3643 issuance and "true-sale" securitization are securities-law
  determinations, and the precedents the paper cites (**East Cameron, Arcapita**) are **inapposite
  to retail residential** (§5.7). Out of lane regardless.

---

## 5. Compliance-gap register (what counsel must ratify)

Register style follows [`compliance/COMPLIANCE_COUNSEL_REVIEW.md`](../../compliance/COMPLIANCE_COUNSEL_REVIEW.md).
The broker-triage pivot **resolves or reassigns** several v1 items — the **Owner** column is the
point: many determinations belong to the **funding legacy lender**, not Homiquity. Anything still
marked **OPEN** for **Homiquity** is a real gate before promotion.

| # | Item in the paper | Where it stands now | Owner |
|---|---|---|---|
| 5.1 | Map `Rₜ`/markup to an "interest rate"; emit TRID APR + IRS **Form 1098** | Broker triage produces a normalized packet; the **binding consumer disclosures + 1098** are the funding lender's compliance obligation, not the broker's. Disclosure treatment still needs counsel confirmation. | **Funding lender** (OPEN) |
| 5.2 | OCC "functional-equivalence" (**IL 806/1997**, **IL 867/1999**, to the NY branch of United Bank of Kuwait) | **Resolved direction:** those letters preempt only for *banks* — Homiquity does **not** rely on them. Operate as a **state-licensed broker** routing to lenders that hold the authority. New open item → **state-by-state SAFE licensing + non-bank title/landlord prohibitions**. | **Homiquity** (OPEN — state licensing) |
| 5.3 | Assign borrower **SSN as the trust's tax ID** | Out of the broker-triage lane — a title-holding-entity function; the funding lender/aggregator's determination. | **Funding lender** (out of lane) |
| 5.4 | "Substance-over-form" **single-conveyance transfer tax** | Same — the title-holding entity's problem, jurisdiction-by-jurisdiction; not the broker's. | **Funding lender** (out of lane) |
| 5.5 | GSE **Rep & Warranty relief** via "negotiated variances" | **Resolved:** variances are **proprietary/exclusive** to legacy lenders (years of legal/Shariah review) and are **not inheritable**. Homiquity routes files to them; it is **not** a direct GSE seller/servicer. | **Legacy lender** (resolved) |
| 5.6 | Deliver via MISMO `MortgageType="Other"` / non-`Fixed` amortization | The delivery representation is the funding lender's; needs GSE confirmation. **Never invent enums** (CLAUDE.md). | **Funding lender** (OPEN) |
| 5.7 | "True sale" precedents **East Cameron / Arcapita** | **Verified — inapposite.** East Cameron = oil-&-gas project finance ($165.7M ORRI, offshore Gulf, W.D. La. 2009); Arcapita = wholesale commodity Murabaha (LME metals, S.D.N.Y. 2012). Neither binds **retail consumer residential**; securitization is out of lane regardless. | **N/A** — do not cite as residential precedent |
| 5.8 | Faith-targeted marketing of the product | Genuinely open: ECOA/fair-lending review of targeting / steering / redlining exposure. | **Homiquity** (OPEN) |
| 5.9 | Broker these products | State **SAFE** broker licensure + any per-structure authority (**pre-license today**). | **Homiquity** (OPEN — licensing) |

**Unverified factual claims.** Every statistic, fee schedule, market-size figure, delinquency
number, and provider credit-overlay in the source paper remains **unverified** — *cite the primary
source before reuse*, and do not repeat them as fact in specs, marketing, or code comments. (The
two court **cases** are now verified — and, per 5.7, inapposite to retail residential.)

---

## 6. Phased roadmap (post-F1; broker-triage lane)

**Sequencing first: every phase here is post-F1 / post-launch.** None of it contends with the
active launch roadmap or the core traditional-broker build — this is the moat we add *after* the
core business is live. Phases gate left-to-right.

| Phase | Scope (all post-launch) | Gate |
|---|---|---|
| **P0 — now** | This map; §5 items routed to the funding-lender / counsel / founder. | none (done) |
| **P1** | Deterministic **CTE translation math** only: `apr.ts` converter + anchor tests, internal, `PRELAUNCH_GATED`. Math for lender packaging — no product. | L2 determinism + `UNDERWRITING_SCENARIOS.md` citation contract — author adds the anchor test **and** extends the grep guard to the new file (not auto-enforced) |
| **P2** | **ARUE** normalization: doc-AI / cash-flow extraction for self-employed & 1099 packaging (reuse tax-insight prior art) + `PRODUCT_TYPES` plumbing. | L1 promotion |
| **P3** | **Lender hand-off packet**: normalized MISMO/packet formatting for delivery to a legacy wholesale lender. | **funding lender + counsel (§5.1, 5.6)** |
| **— not ours —** | **LTOE** (SPV/tax) and **LSB** (securitization/Sukuk) are the **funding lender's / capital-markets'** functions — Homiquity does not build these under broker-triage (§4.3–4.4). | n/a |

Nothing past P1 begins until its gate clears **and** the work is promoted above the L1 cut-line —
and all of it waits until after launch.

---

## 7. What this document does **not** authorize

- No product code, calculator, schema change, or migration.
- No change to `PRODUCT_TYPES`, `MortgageType`, or the MISMO XML builder.
- No borrower-facing intake field, persona page, education content, or marketing.
- No representation — internal or external — that Homiquity offers, or is building, Shariah-
  compliant financing.
- **No title-holding, SPV provisioning, direct GSE/DU/LPA submission, or Sukuk issuance** — those
  are outside the broker-triage lane (§4.3–4.4).
- **No effect on the active launch or the core traditional-broker business** — this is a future-moat
  research artifact, nothing here is a launch dependency.
- No reliance on any §5 assumption as settled.

---

## 8. Authority & references

- **Precedence:** [L1_VISION_AND_SCOPE.md](../../L1_VISION_AND_SCOPE.md) §3 (cut-line — this is
  below it) · [L2_COMPLIANCE_AND_LOGIC.md](../../L2_COMPLIANCE_AND_LOGIC.md) (invariants any build
  must satisfy) · [CLAUDE.md](../../../CLAUDE.md) (compliance-first; never invent MISMO enums;
  no-citation-no-implementation).
- **Related:** [compliance/UNDERWRITING_SCENARIOS.md](../../compliance/UNDERWRITING_SCENARIOS.md)
  (the citation contract) · [compliance/COMPLIANCE_COUNSEL_REVIEW.md](../../compliance/COMPLIANCE_COUNSEL_REVIEW.md)
  (register format) · [compliance/SAFE_MLO_COMPLIANCE_MAP.md](../../compliance/SAFE_MLO_COMPLIANCE_MAP.md)
  (state SAFE licensing — bears on §5.2/§5.9) · [handbook/DEVELOPER_PLAYBOOK.md](../../handbook/DEVELOPER_PLAYBOOK.md)
  + [CTO_ROADMAP.md](../../../CTO_ROADMAP.md) (the committed traditional-broker posture this moat
  layers onto) · [handbook/app-guide/03-database.md](../../handbook/app-guide/03-database.md)
  (schema rules if P2 ever runs).
- **Primary sources still needed** (obtain before promoting any phase): OCC **IL 806 (1997)** and
  **IL 867 (1999)** verbatim; **state SAFE Act** broker-licensing + non-bank title/landlord rules
  by state; state/county transfer-tax rulings by jurisdiction; current Fannie Mae / Freddie Mac
  guidance on non-conventional delivery (obtained **via the funding lender**, not us); and securities
  counsel on token characterization / true-sale. Store regulatory binaries under `docs/`, not here.
