# Universal Adaptation Layer (UAL) — Alternative / Shariah-Compliant Financing

**Type:** exploratory research · **Dated:** 2026-07-08 · **Owner:** engineering (feasibility map)

> **Status — read this before acting on anything below.**
> This is a **feasibility and architecture map**, not a spec and not committed scope. Alternative /
> Shariah-compliant financing (Musharaka, Ijara, Murabaha) sits **below the L1 cut-line**
> ([L1_VISION_AND_SCOPE.md](../../L1_VISION_AND_SCOPE.md) §3) and Homiquity is **pre-license**
> (every soliciting surface is behind `PRELAUNCH_GATED` until F1). **This document authorizes
> nothing** — no product code, no schema/migration, no MISMO change, no marketing, no
> origination — until (a) compliance **counsel ratifies** the legal determinations in §5 **and**
> (b) the work is **promoted through the L1 cut-line**. It exists so a future scoping decision
> starts from an honest map instead of a marketing manifesto.

Source: an internal strategy paper, *"Standardizing Alternative Risk: Homiquity's Universal
Adaptation Layer."* That paper is a vision; this document is the reconciliation of that vision
with **what actually exists in this repository** and **what a regulator/counsel would have to
sign off on first.**

---

## 1. Why this exists (business intent)

There is real, under-served demand for home financing that avoids *riba* (interest), *gharar*
(excessive contractual uncertainty), and *maysir* (speculation). The strategy paper argues a
"Universal Adaptation Layer" could originate, underwrite, and securitize these asset-backed
structures at conventional-mortgage speed and cost, removing the "piety premium" borrowers pay
today, and eventually license that layer B2B to other lenders.

The intent of **this** artifact is narrower and prescriptive: **before any of that is built,
separate the three things that get conflated in the vision** —

1. what is **deterministic math** we could build safely (small),
2. what is **greenfield engineering** with no legal novelty (medium), and
3. what is a **legal/regulatory determination** engineering must not make alone (large, and it
   dominates the vision).

If a reader takes one thing from this doc: the hard part of alternative finance here is **not the
code** — the amortization/translation math is tractable — it is the **legal characterization**
(is rent "interest"? is a broker covered by the OCC bank letters? is a token a security?). Those
are §5, and they gate everything downstream.

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
| PII rails | [`encryptionService.ts`](../../../server/services/encryptionService.ts), [`ssnVault.ts`](../../../server/services/ssnVault.ts), [`auditLog.ts`](../../../server/auditLog.ts) | Anything touching SSNs (e.g. SSN-as-trust-tax-ID) must route through these and emit an audit entry (CLAUDE.md). |
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
| **Ijara** (lease-to-own) | LARIBA, Ijara CDC | Rent **+** principal contribution; title transfers at full acquisition; SPV/trust holds title | Same decomposition as Musharaka; the **SPV/trust** is the differentiator (§4 LTOE, counsel-gated). |
| **Murabaha** (cost-plus installment sale) | Devon Bank | Fixed installment on a **marked-up price declared upfront** | Simplest: fixed markup → a single fixed **equivalent rate factor** feeding `calculateMortgageAPR`. |

**Where the translation math would live (P1, buildable):** a new **pure, cited** converter next
to the amortization primitives in [`server/services/apr.ts`](../../../server/services/apr.ts) —
e.g. `rentalYieldToEquivalentRate(...)` / `structureToPaymentStream(...)` — producing a
`noteRatePct`-equivalent and an `Aₜ` stream that the existing `buildMortgagePaymentStream` /
`calculateMortgageAPR` and `loanEstimate.ts` already know how to consume. It must carry a
citation before implementation (no-citation-no-implementation, enforced by
[`tests/complianceInvariants.test.ts`](../../../tests/complianceInvariants.test.ts)) and an
anchor unit test in the shape of [`tests/apr.test.ts`](../../../tests/apr.test.ts).

---

## 4. The four engines, mapped onto this codebase

For each engine: **what it touches**, whether it **extends existing code or is greenfield**, and
**the gate**. "Gate = counsel" means engineering must not proceed on the legal question alone.

### 4.1 Contract Translation Engine (CTE) — *mostly buildable*
- **Touches:** `apr.ts` (equivalent-rate converter), `loanEstimate.ts` (PITI/TRID Loan Estimate),
  `shared/mismo.ts` + `server/mismo.ts` (representation), `PRODUCT_TYPES` (internal taxonomy).
- **Extend vs greenfield:** the **math** extends `apr.ts` (P1). The **MISMO representation** is
  blocked by the closed `MortgageType` enum and the hardcoded `LoanAmortizationType="Fixed"` — any
  delivery would have to route through `MortgageType="Other"`, which is a GSE question, **not** an
  enum we may invent (CLAUDE.md).
- **Gate:** the *math* is buildable behind the pre-license gate. The *disclosure equivalence*
  (calling `Rₜ` an "interest rate," generating a TRID APR and IRS Form 1098) is **counsel** (§5.1).

### 4.2 Alternative Risk Underwriting Engine (ARUE) — *partly buildable, partly greenfield*
- **Touches:** `underwritingEngine.ts` / `decisionEngine.ts` (decision core, today Conventional/VA
  only), `underwritingNuance.ts` (DTI/residual math — the cited-function home).
- **Extend vs greenfield:** adding a product branch/dispatch to the decision core is engineering,
  not legal novelty (P3). **Bank-statement / 1099 cash-flow underwriting** and the **document-AI
  extraction** the paper describes are greenfield — but there is prior art in the tax-insight
  pipeline (see [CTO_ROADMAP.md](../../../CTO_ROADMAP.md)); reuse before rebuild. The **"usufruct
  yield" risk model** (`annual market rent ÷ purchase price`) is greenfield **and**
  citation-required before any number lands.
- **Gate:** engineering for the ratio math; **counsel** for using rent-coverage in an ability-to-
  repay determination (ATR/Reg Z, ECOA/Reg B).

### 4.3 Legal & Tax Orchestration Engine (LTOE) — *greenfield, heavily counsel-gated*
- **Touches:** greenfield; if built, must respect the PII rails (`encryptionService.ts`,
  `ssnVault.ts`, `auditLog.ts`).
- **Gate — counsel dominates:** programmatic SPV/trust provisioning, **assigning a borrower's SSN
  as the trust's tax ID**, and "substance-over-form" **single-conveyance transfer-tax** treatment
  are legal determinations that vary by state/county and that engineering cannot make (§5.3, §5.4).

### 4.4 Liquidity & Securitization Bridge (LSB) — *greenfield, entirely counsel-gated*
- **Touches:** greenfield; a GSE path would run through `server/mismo.ts`.
- **Gate — counsel + false premise:** the paper says the UAL would "apply the customized
  underwriting variances **negotiated by legacy providers** with Fannie/Freddie" to obtain Rep &
  Warranty relief. **Homiquity has negotiated no such variances** — that claim is false as applied
  to us and must not be coded against. Tokenized Sukuk / ERC-3643 issuance, "true-sale" structuring
  (East Cameron / Arcapita are *cited but unverified*), and digital-asset custody are securities-law
  determinations (§5.7).

---

## 5. Compliance-gap register (what counsel must ratify)

Format follows [`compliance/COMPLIANCE_COUNSEL_REVIEW.md`](../../compliance/COMPLIANCE_COUNSEL_REVIEW.md):
*what the source paper claims → what it assumes → the specific question for counsel → status.*
**Every item below is unratified.** None may be implemented until answered.

| # | Claim in the paper | Load-bearing assumption | Question for counsel | Status |
|---|---|---|---|---|
| 5.1 | Map `Rₜ`/markup to the "interest rate" field; emit TRID APR + IRS **Form 1098** | That a Shariah product may be disclosed *as if* interest-bearing without recharacterizing it | Is TRID/Reg Z disclosure of an equivalent-rate compliant here, and is Form 1098 interest-reporting correct for a non-interest instrument? | **OPEN** |
| 5.2 | Rely on OCC **functional-equivalence** (1997/1999 interpretive letters to United Bank of Kuwait) | That letters issued to a **national bank branch** extend to a fintech **broker** | Do the OCC letters cover Homiquity's role, or is separate authority needed? | **OPEN — high** |
| 5.3 | Assign borrower **SSN as the trust's tax ID** so benefits flow to the borrower | That this is permissible and safe | Is SSN-as-trust-EIN correct tax treatment, and what PII/audit controls are required? | **OPEN** |
| 5.4 | "Substance-over-form" **single-conveyance** transfer-tax treatment (avoid double tax) | That a doctrine applied in some states (e.g. NY rulings) generalizes | Which states/counties actually permit this; where is double-tax unavoidable? | **OPEN — fragmented** |
| 5.5 | GSE **Rep & Warranty relief** via "negotiated variances" | That legacy providers' variances transfer to us | Confirm — **as written this is false for Homiquity**; what would we actually have to negotiate? | **OPEN — premise false** |
| 5.6 | Deliver via MISMO `MortgageType="Other"` / non-`Fixed` amortization | That "Other" is an accepted delivery path for these structures | GSE confirmation of the exact ULDD representation — **never invent enums** (CLAUDE.md). | **OPEN** |
| 5.7 | Tokenized **Sukuk / ERC-3643**, "true sale" (East Cameron, Arcapita) | That these tokens aren't securities / true-sale holds | Securities-law characterization (Reg D/S), true-sale opinion, custody — cases **cited but unverified**. | **OPEN — securities** |
| 5.8 | Faith-targeted marketing of the product | That targeting is permissible | ECOA/fair-lending review of targeting/steering/redlining exposure. | **OPEN** |
| 5.9 | Offer these products | That we may originate them | NMLS product authority + state licensure per structure (**pre-license today**). | **OPEN — licensing** |

**Unverified factual claims.** Every statistic, fee schedule, market-size figure, delinquency
number, provider credit-overlay, and court citation in the source paper is **unverified**. Treat
each as *cite the primary source before reuse* — do not repeat them as fact in specs, marketing,
or code comments.

---

## 6. Phased roadmap (tied to the cut-line and F1)

| Phase | Scope | Gate |
|---|---|---|
| **P0 — now** | This map + the §5 counsel questions delivered to compliance/founder. | none (done) |
| **P1** | Deterministic **Contract-Translation calculator** only: `apr.ts` converter + anchor tests, internal, `PRELAUNCH_GATED`. Math, no product. | passes L2 determinism/citation invariants |
| **P2** | Data-model + product-type plumbing: extend `PRODUCT_TYPES`, add structure/rent-split fields, intake derivation in `loanAnalysis.ts`. | L1 promotion |
| **P3** | Underwriting extension (product dispatch) + MISMO representation. | **counsel (§5.1, 5.6)** |
| **P4 — far** | Tax/SPV orchestration (LTOE), securitization/Sukuk (LSB), consumer marketing. | **counsel + state licensure (§5.2–5.9)** |

Nothing past P1 begins until the item's gate clears. P1 itself does not begin until the work is
promoted above the L1 cut-line.

---

## 7. What this document does **not** authorize

- No product code, calculator, schema change, or migration.
- No change to `PRODUCT_TYPES`, `MortgageType`, or the MISMO XML builder.
- No borrower-facing intake field, persona page, education content, or marketing.
- No representation — internal or external — that Homiquity offers, or is building, Shariah-
  compliant financing.
- No reliance on any §5 assumption as settled.

---

## 8. Authority & references

- **Precedence:** [L1_VISION_AND_SCOPE.md](../../L1_VISION_AND_SCOPE.md) §3 (cut-line — this is
  below it) · [L2_COMPLIANCE_AND_LOGIC.md](../../L2_COMPLIANCE_AND_LOGIC.md) (invariants any build
  must satisfy) · [CLAUDE.md](../../../CLAUDE.md) (compliance-first; never invent MISMO enums;
  no-citation-no-implementation).
- **Related engineering:** [compliance/UNDERWRITING_SCENARIOS.md](../../compliance/UNDERWRITING_SCENARIOS.md)
  (the citation contract) · [compliance/COMPLIANCE_COUNSEL_REVIEW.md](../../compliance/COMPLIANCE_COUNSEL_REVIEW.md)
  (register format) · [handbook/app-guide/03-database.md](../../handbook/app-guide/03-database.md)
  (schema/migration rules for P2).
- **Primary sources still needed** (obtain before promoting any phase): the OCC 1997/1999
  interpretive letters (verbatim); state/county transfer-tax rulings by jurisdiction; current
  Fannie Mae / Freddie Mac guidance on non-conventional structure delivery; and securities counsel
  on token characterization and true-sale. Store regulatory binaries under `docs/`, not here.
