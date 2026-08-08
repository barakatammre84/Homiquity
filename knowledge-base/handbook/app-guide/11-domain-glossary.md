# 11 — Mortgage Domain Glossary

The industry terms this codebase assumes you know, decoded.

## The loan process

| Term | Meaning |
|------|---------|
| **Origination** | The whole process of creating a new loan, from application to funding |
| **Pre-qualification** | Informal estimate of what a borrower can afford (self-reported data) |
| **Pre-approval** | Stronger: lender has reviewed credit/income/assets and commits conditionally in writing — Homiquity's core product output |
| **URLA / Form 1003** | Uniform Residential Loan Application — the standard mortgage application form. Our `urla_*` tables mirror its sections |
| **Underwriting** | Evaluating whether a loan meets guidelines (credit, capacity, collateral) |
| **AUS** | Automated Underwriting System — Fannie's **DU** (Desktop Underwriter) and Freddie's **LPA** (Loan Product Advisor) |
| **Conditions** | Requirements attached to an approval ("provide 2023 W-2") |
| **Rate lock** | Freezing an interest rate for N days while the loan closes |
| **Closing / funding** | Signing + disbursement; post-close is the "homeowner" phase |

## Parties & products

| Term | Meaning |
|------|---------|
| **GSE** | Government-Sponsored Enterprise — Fannie Mae & Freddie Mac, who buy conforming loans from lenders |
| **FHA / VA** | Government-insured loan programs (first-time-buyer-friendly / veterans) |
| **IMB** | Independent Mortgage Bank — non-depository lender |
| **Wholesale lender** | Funds loans sourced by brokers; our rate sheets model their pricing |
| **Broker vs lender** | Broker arranges loans with others' money; lender funds them |
| **LO / LOS** | Loan Officer / Loan Origination System (Homiquity *is* an LOS) |
| **Conforming loan** | Meets GSE guidelines (limits, DTI, credit) so it can be sold to them |

## Numbers underwriters care about

| Term | Meaning |
|------|---------|
| **DTI** | Debt-To-Income ratio — monthly debts ÷ gross monthly income; the central affordability gate |
| **LTV** | Loan-To-Value — loan amount ÷ property value; drives PMI and pricing |
| **PMI / MI** | (Private) Mortgage Insurance, usually required above 80% LTV |
| **FICO / VantageScore** | Credit score models; mortgage lending traditionally uses "Classic FICO", with VantageScore 4.0 being phased in by FHFA |
| **LLPA** | Loan-Level Price Adjustment — GSE-defined rate/fee adjustments based on risk factors (credit score × LTV, occupancy, etc.). Implemented in `server/pricing.ts` |
| **Basis point (bp)** | 0.01% — pricing adjustments are quoted in bps |
| **P&I / PITI** | Principal & Interest / plus Taxes & Insurance — the monthly payment components our calculators produce |

## Compliance (why the code is careful)

| Term | Meaning |
|------|---------|
| **FCRA** | Fair Credit Reporting Act — governs credit pulls: consent, disclosures, adverse-action notices. Implemented in the `server/services/credit*.ts` family |
| **ECOA / Fair Lending** | Equal Credit Opportunity Act — no discrimination on protected bases. **This is why underwriting is a deterministic rules engine, not an LLM**: decisions must be explainable, repeatable, and auditable |
| **Adverse action** | Formal notice required when credit is denied or terms worsen based on credit data |
| **Soft vs hard pull** | Soft credit inquiry doesn't affect score or alert competitors; hard does. Hard pulls generate **trigger leads** (bureaus sell the inquiry to rival lenders) |
| **Trigger leads** | The lead-poaching mechanism above; the Homeowners Privacy Protection Act (2026) restricts it — why a soft-pull-first strategy matters |
| **TCPA** | Telephone Consumer Protection Act — consent rules for automated calls/SMS ($500–$1,500 per violation) |
| **HMDA** | Home Mortgage Disclosure Act — demographic data reporting on lending decisions |
| **NMLS** | Nationwide Multistate Licensing System — companies and loan officers must hold licenses. Homiquity is **NMLS #427468** (`shared/companyIdentity.ts`), licensed in Illinois only (`LICENSED_STATES`, IL license #3423789); the footer renders it via `companyNmlsDisplay()`. Per-LO NMLS ids bind as LOs join |
| **TRID / LE / CD** | TILA-RESPA disclosure rules; Loan Estimate & Closing Disclosure documents with strict timing requirements |

## Data standards

| Term | Meaning |
|------|---------|
| **MISMO 3.4** | The mortgage industry's XML data standard; our export target for lender/GSE handoff (`server/mismo.ts`) |
| **ULDD** | Uniform Loan Delivery Dataset — GSE delivery data requirements layered on MISMO |
| **Day 1 Certainty / AIM** | Fannie/Freddie programs granting liability relief when income/assets are digitally verified (Plaid-style data instead of paper) |

## Homiquity-specific vocabulary

| Term | Meaning |
|------|---------|
| **Borrower Graph** | Our unified, trust-tiered borrower profile (`borrowerGraph.ts`) |
| **3-tier trust** | Every fact is self-reported → documented → verified |
| **Borrower Package** | The lender-ready MISMO 3.4 output delivered to a wholesale lender (see [L1](../../L1_VISION_AND_SCOPE.md) §2) |
| **Calm Path** | The borrower-portal design principle: one dominant CTA, steppers, no clutter |
| **Rules DSL** | The editable deterministic underwriting rule language (`ruleEngine.ts`) |
| **Lookup matrix** | Grid-based guideline lookups (e.g. price adjustments by score×LTV) |
