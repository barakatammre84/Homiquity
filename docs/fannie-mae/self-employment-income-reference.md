# Self-employment income — Fannie Mae Selling Guide reference

Authoritative reference for the deterministic self-employment income calculator
(`server/services/selfEmploymentIncome.ts`) and the self-employed intake/underwriting
path. Per [CLAUDE.md](../../CLAUDE.md) and the `mortgage-calculations` skill
(**no-citation-no-implementation**): every add-back, subtraction, averaging rule, and
threshold in the calculator must cite a section below. **Never invent** a rule, line
number, or threshold — if it is not verified here or in the primary source, stop and flag it.

## Document hierarchy

The Fannie Mae **Selling Guide** is the official policy statement and controls. **Form 1084
(Cash Flow Analysis)** is a worksheet *tool* that implements Selling Guide policy — where the
Guide and any worksheet/job-aid disagree, the Guide controls. This reference is built from the
Selling Guide sections (the controlling authority); Form 1084 is recorded as a secondary,
still-to-be-downloaded artifact (see *Missing artifacts* below).

## ⚠️ Section-numbering correction (verified 2026-07-10)

Fannie Mae **reorganized Income Assessment (Chapter B3-3) effective 03/04/2026.** Self-employment
income no longer lives at "B3-3.2/B3-3.4" (the pre-reorg numbering many secondary sources and
memory still use). The **current** map — verified live against selling-guide.fanniemae.com:

| Section | Title | Effective date¹ |
|---|---|---|
| **B3-3.2** | Standards for Employment and Income Documentation (now *general* employment/income, NOT self-employment) | 03/04/2026 |
| **B3-3.5** | **Self-Employment Income** (section landing) | — |
| B3-3.5-01 | Underwriting Factors and Documentation for a Self-Employed Borrower | 12/13/2023 |
| B3-3.5-02 | Business Structures | 12/16/2014 |
| B3-3.5-03 | IRS Forms Quick Reference | 12/16/2020 |
| **B3-3.6** | **Self-Employment Documentation Requirements for an Individual** (section landing) | — |
| B3-3.6-01 | General Information on Analyzing Individual Tax Returns | — |
| B3-3.6-02 | Income Reported on IRS Form 1040 | — |
| B3-3.6-03 | Income or Loss Reported on IRS Form 1040, Schedule C | 04/01/2009 |
| B3-3.6-04 | Income or Loss Reported on IRS Form 1040, Schedule D | — |
| B3-3.6-05 | Income or Loss Reported on IRS Form 1040, Schedule E | — |
| B3-3.6-06 | Income or Loss Reported on IRS Form 1040, Schedule F | — |
| B3-3.6-07 | Income or Loss Reported on IRS Form 1065 or IRS Form 1120S, Schedule K-1 | 05/07/2025 |

¹ Effective dates as displayed on the Selling Guide page when fetched (2026-07-10); re-confirm on
access — Fannie republishes with new dates. Rental income (Schedule E) is already handled by
`server/services/underwritingNuance.ts` under **B3-3.1-08** and is out of scope for the SE calculator.

**Online source of truth:** <https://selling-guide.fanniemae.com/sel/b3-3.5/self-employment-income>
and <https://selling-guide.fanniemae.com/sel/b3-3.6/self-employment-documentation-requirements-individual>.
The Selling Guide controls over this file; escalate discrepancies rather than picking a side.

## Core rules (verified against B3-3.5-01, 12/13/2023)

- **Self-employed definition:** *"Any individual who has a 25% or greater ownership interest in a
  business is considered to be self-employed."*
- **History / averaging:** generally a **two-year history** of prior earnings is required to
  demonstrate the likelihood of continuance. **Exception:** a borrower with less than two years may
  qualify when the most recent signed personal **and** business federal returns reflect a full year
  (12 months) of self-employment income from the current business **and** documentation shows prior
  income at the same or greater level in the same field/occupation.
- **Written analysis:** the lender must prepare a written evaluation of the borrower's personal
  income including business income/loss from the individual returns. Acceptable methods: **Fannie
  Mae's Cash Flow Analysis (Form 1084)**, another cash-flow analysis applying the same principles,
  or a Fannie Mae-approved vendor tool / the **Income Calculator**.
- **Distributions vs. viability:** the analysis assesses business income distributions that have
  been (or could be) made to the borrower *while maintaining the viability of the underlying business.*

## Business structures & distribution access (B3-3.5-02, 12/16/2014)

- Sole proprietorship (individually owned/managed, unlimited personal liability); partnership
  (general vs. limited partners); S corporation (pass-through gains/losses to stockholders);
  corporation (state-chartered, separate from owners).
- **Access-to-income requirement:** for partnerships, LLCs, and S corporations the lender must
  *"determine whether the borrower actually received a cash distribution"* — profits may or may not
  be distributed to the member-owners. For sole proprietorships, determine whether the business can
  accommodate the withdrawal of assets/revenues if needed to pay the mortgage.

## Per-form treatment (for the calculator)

### Schedule C — sole proprietorship / single-member LLC (B3-3.6-03, 04/01/2009)
Starting from Schedule C net profit/loss:
- **Add back (recurring, non-cash):** depreciation, depletion, business use of a home, amortization,
  and casualty losses. *(Verbatim: "the following recurring items … must be added back … :
  depreciation, depletion, business use of a home, amortization, and casualty losses.")*
- **Subtract (non-recurring / non-cash-benefit):** non-recurring income, and the meals &
  entertainment exclusion reported on Schedule C. *(Verbatim: "Non-recurring income must be deducted
  … including any exclusion for meals and entertainment expenses reported … on Schedule C.")*
- The resulting annual cash flow is averaged over the documented history (see two-year rule) and
  divided by 12 for monthly qualifying income.

> **IRS line numbers:** the specific Schedule C line references for each item live on Form 1084 /
> the IRS Schedule C form itself. The calculator collects each adjustment **by named category**
> (depreciation, depletion, business-use-of-home, amortization/casualty, meals exclusion), so it
> never hardcodes an unverified Fannie/IRS line number. Any line-number label in the UI must be
> confirmed against the current IRS Schedule C, not memory.

### Schedule K-1 — partnership (1065) / S corporation (1120S) (B3-3.6-07, 05/07/2025)
- Usable income: ordinary business income, net rental real-estate income, and other net rental
  income reported on Schedule K-1 — **only** where the business demonstrates adequate liquidity to
  support the withdrawal of earnings.
- **Two documentation pathways to use ordinary income:**
  1. **Guaranteed payments to the partner** received continuously for two years may be added
     without additional liquidity documentation.
  2. A **documented, stable history of cash distributions** consistent with the level of business
     income being used to qualify requires no further documentation. **Otherwise**, the lender must
     confirm adequate business liquidity.
- **Business-liquidity test** (when distributions don't cover the income used): **Quick Ratio** =
  (current assets − inventory) ÷ current liabilities (inventory-heavy businesses); **Current Ratio**
  = current assets ÷ current liabilities (non-inventory). A ratio of **one or greater** is generally
  sufficient.
- W-2 wages the borrower draws from their own S-corp: treatment is not stated in B3-3.6-07 — confirm
  in the business-return analysis subsections before adding (see *Missing artifacts*).

## Missing artifacts (download manually — Cloudflare blocks programmatic fetch)

Both are behind Fannie's Cloudflare Turnstile challenge, so they could **not** be scripted into the
repo. A human should download them from the URLs below and drop them into `docs/fannie-mae/`, then
add them to the README inventory:

1. **Form 1084 (Cash Flow Analysis)** — the worksheet itself, for line-level confirmation:
   <https://singlefamily.fanniemae.com/media/document/pdf/form-1084> (also
   <https://singlefamily.fanniemae.com/media/7746/display>).
2. **Business-return analysis subsections** — the S-corp/partnership/corporation *business* return
   treatment (adjustments to the 1120S/1065/1120 themselves, and the borrower's-own-S-corp W-2
   question). Locate via the B3-3 chapter index:
   <https://selling-guide.fanniemae.com/sel/b3-3/income-assessment>.

Until #1 and #2 are in-repo, the calculator implements only what is **verified above** — Schedule C
add-backs/subtractions and K-1 ordinary income gated on documented distributions or the liquidity
ratio. It must **not** implement business-return-level add-backs (e.g. adjustments inside the 1120S)
from memory; those are flagged for the human and escalated if a borrower needs them at launch.

## Implementation contract (`server/services/selfEmploymentIncome.ts`)

- **Deterministic, AI-free** (Reg B): same inputs → same output; no vendor calls; typed result.
  Guard with a vitest determinism test, per the `mortgage-calculations` skill.
- Populate the existing `details.selfEmployment` structure in `server/underwriting.ts`
  (`netProfitYear1`, `netProfitYear2`, `avgNetProfit`, `addBacks`, `deductions`, `qualifyingIncome`)
  instead of the current `if (emp.isSelfEmployed) continue;` skip at `server/underwriting.ts:127`.
- Follow the citation pattern already established in `server/services/underwritingNuance.ts`
  ("each rule cites its guideline") — annotate each add-back/subtraction/averaging step with its
  B3-3.x section above.
- Unit-test against Fannie **worked examples** from Form 1084 once it is downloaded; until then,
  test against the verified categorical rules and a declining-income guard (two-year average with the
  lower-year / most-recent-year treatment escalated to manual review when income is declining, per
  the "stable and continuous" standard in B3-3.5-01).
