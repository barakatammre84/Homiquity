// Illinois DPA seed data — facts verified 2026-07-06 against the administering
// agencies (IHDA, City of Chicago DOH / NHS Chicago, Cook County / Club 720).
// Kept separate from seed.ts so tests can validate this content without
// importing the database connection. Article content must stay renderer-safe
// for ArticleDetail.tsx's line parser: headings, "- " lists, and plain
// paragraphs only — no markdown links, bold, or tables.
import type { InsertArticle, InsertDpaProgram } from "@shared/schema";

export const ILLINOIS_DPA_ARTICLES: InsertArticle[] = [
  {
    title: "Illinois Down Payment Assistance in 2026: IHDA Programs Explained",
    slug: "illinois-down-payment-assistance-2026",
    excerpt:
      "Illinois offers four statewide down payment assistance programs through IHDA, from a 10-year forgivable loan to the new IHDAccess Home. Here is how they compare, as of July 2026.",
    content: `Saving a down payment is the single biggest hurdle for most Illinois buyers. What many people never learn is that the state runs its own assistance programs — and using one does not require luck or connections, just a lender who participates and a little paperwork.

## What down payment assistance is

Down payment assistance (DPA) is money from a government agency or nonprofit that covers part of your down payment or closing costs. Depending on the program it arrives as a grant you never repay, a loan that is forgiven over time, or a no-interest loan you repay later. In Illinois, the statewide programs come from the Illinois Housing Development Authority (IHDA) and are used together with a standard 30-year fixed mortgage from a participating lender.

## The four IHDAccess programs

### IHDAccess Home

The newest program, launched in March 2026. It provides 6% of the purchase price, up to $15,000, as a no-interest, no-monthly-payment second loan. Nothing is due until you sell, refinance, or reach 30 years, and there is no penalty for paying it off earlier.

### IHDAccess Forgivable

Provides 4% of the purchase price, up to $6,000, as a loan that is forgiven gradually over 10 years. Stay in the home for the full period and you repay nothing. Sell or refinance earlier and the remaining balance comes due.

### IHDAccess Deferred

Provides 5% of the purchase price, up to $7,500, as a no-interest loan with no monthly payment. The balance is repaid when you sell or refinance.

### IHDAccess Repayable

The largest amount: 10% of the purchase price, up to $10,000, as a zero-interest loan repaid in monthly installments over 10 years.

## What every IHDA program requires

- A credit score of 640 or higher (the middle score from the three bureaus)
- A pre-purchase homebuyer education course
- The home must become your primary residence
- A minimum contribution of 1% of the sale price or $1,000, whichever is greater
- A debt-to-income ratio of 50% or lower
- Household income and purchase price within limits that vary by county — in Cook County the income limit is roughly $137,885 for IHDAccess Home

The programs are open to first-time buyers, qualified veterans, and repeat buyers purchasing in targeted areas.

## How to actually use one

You do not apply to IHDA directly. The assistance is delivered through a statewide network of more than 160 participating lenders — you ask the lender to write your mortgage with an IHDAccess program attached. IHDA also allows its programs to be combined with local assistance, which matters in Chicago and Cook County, where separate city and county programs exist. The Learning Center has related guides covering the Chicago HomeGrown grant program and the Cook County Down Payment Assistance Program.

## Before you rely on any number here

This article is educational information current as of July 2026. Program terms are set by IHDA and can change, and funding can pause without notice. Confirm current details at ihdamortgage.org or with a HUD-approved housing counselor before making decisions.`,
    categoryId: "cat-getting-started",
    tags: ["down payment assistance", "Illinois", "IHDA", "first-time buyer"],
    metaTitle: "Illinois Down Payment Assistance 2026: All 4 IHDA Programs Compared",
    metaDescription:
      "IHDAccess Home, Forgivable, Deferred, and Repayable compared: amounts, credit score requirements, and how to use Illinois down payment assistance in 2026.",
    status: "published",
    publishedAt: new Date(),
    readTimeMinutes: 6,
  },
  {
    title: "Chicago's HomeGrown Program: Up to $70,000 Toward Buying a Home",
    slug: "chicago-homegrown-purchase-assistance",
    excerpt:
      "Chicago's new HomeGrown Purchase Assistance Program, launched June 2026, offers grants — not loans — of up to $70,000 for down payment and closing costs. Here is who qualifies.",
    content: `In June 2026 the City of Chicago launched its largest homebuyer assistance effort in years: the HomeGrown Purchase Assistance Program. Unlike most down payment help, HomeGrown is a grant — money you do not repay as long as you keep the home as your primary residence for five years.

## How much it provides

The city divides Chicago into two zones, and the grant amount and income limit depend on where the home sits.

- Zone A, covering higher-cost areas with rising prices: up to $70,000, for households earning up to 120% of the area median income
- Zone B, covering lower-income census tracts: up to $50,000, for households earning up to 150% of the area median income

In both zones the grant cannot exceed 25% of the purchase price. The program is funded with $21 million from the city's Housing and Economic Development Bond.

## Who qualifies

- You cannot own another home, investment property, or vacation property at the time of purchase — but you do not have to be a first-time buyer
- You must complete 6 to 8 hours of homebuyer education through a HUD-approved counseling agency, with additional training required for condominiums and two-unit buildings
- The home must be in Chicago and become your primary residence for at least 5 years, certified by an annual affidavit
- Eligible properties: single-family homes, condominiums, townhomes, and two-unit buildings

## How the process works

Applications opened June 8, 2026 and run through the program's administering lenders, Neighborhood Lending Services and TRP Lending. Processing typically takes 5 to 10 business days, and once approved you must close within 90 days, with one 30-day extension available. Details and applications are at chicago.gov/homegrown or by phone at 312-744-3653.

## Can you combine it with other programs?

The state's IHDA programs are designed to be combined with local assistance, and Cook County runs a separate program of its own. Whether a specific combination is allowed depends on the administering agencies and your lender, so ask before you plan around it. The Learning Center has related guides covering the IHDA statewide programs and the Cook County Down Payment Assistance Program.

## Before you rely on any number here

This article is educational information current as of July 2026. Program terms are set by the Chicago Department of Housing and its administering agencies and can change, and grant funding can run out. Confirm current details at chicago.gov/homegrown or with a HUD-approved housing counselor before making decisions.`,
    categoryId: "cat-getting-started",
    tags: ["down payment assistance", "Chicago", "grants", "HomeGrown"],
    metaTitle: "Chicago HomeGrown Program 2026: Up to $70,000 in Grant Assistance",
    metaDescription:
      "Chicago's HomeGrown Purchase Assistance Program explained: Zone A and B grant amounts, income limits, homebuyer education, and how to apply in 2026.",
    status: "published",
    publishedAt: new Date(),
    readTimeMinutes: 5,
  },
  {
    title: "Cook County Down Payment Assistance Reopens July 20, 2026",
    slug: "cook-county-down-payment-assistance-2026",
    excerpt:
      "Cook County's Down Payment Assistance Program re-opens July 20, 2026, offering 5% of the first loan amount — up to $25,000 — to first-time and repeat buyers alike.",
    content: `Cook County runs its own down payment assistance program, separate from both the State of Illinois and the City of Chicago — and after a pause, it re-opens on July 20, 2026. If you are buying anywhere in Cook County this year, it belongs on your checklist.

## What it offers

The program provides 5% of the home's final first loan amount, up to $25,000, which can go toward your down payment, closing costs, or a mortgage rate buydown.

## Who qualifies

- Households earning up to 120% of the county's area median income
- Buyers purchasing in Disproportionately Impacted Areas or Qualified Census Tracts face no income limit at all
- Both first-time and repeat buyers may apply — this is unusual, as most assistance programs exclude current or recent homeowners
- First-time purchasers (including anyone who has not owned a home in the past three years) must complete a homebuyer education course before closing

## How the process works

The program is administered by Club 720 alongside Stifel, Nicolaus and Company. Applications and program details are at club720.org/cookcounty-dpa, and the county lists paul.elue@cookcountyil.gov for program questions. Because assistance programs draw from limited funding pools and this one has closed before, applying early after the July 20 re-opening matters.

## If you are buying in Chicago

City of Chicago buyers should also look at the HomeGrown Purchase Assistance Program and the statewide IHDA programs — the Learning Center has related guides covering both. Which programs can stack depends on the administering agencies and your lender, so ask before you plan around a combination.

## Before you rely on any number here

This article is educational information current as of July 2026. Program terms are set by Cook County and its administering partners and can change, and funding can pause without notice. Confirm current details at club720.org or with a HUD-approved housing counselor before making decisions.`,
    categoryId: "cat-getting-started",
    tags: ["down payment assistance", "Cook County", "first-time buyer"],
    metaTitle: "Cook County Down Payment Assistance 2026: Reopens July 20",
    metaDescription:
      "Cook County's DPA program re-opens July 20, 2026: 5% of the loan amount up to $25,000, open to first-time and repeat buyers. Eligibility and how to apply.",
    status: "published",
    publishedAt: new Date(),
    readTimeMinutes: 5,
  },
];

export const ILLINOIS_DPA_PROGRAMS: InsertDpaProgram[] = [
  {
    name: "IHDAccess Home",
    programType: "state",
    state: "IL",
    description:
      "IHDA's newest statewide program (March 2026): a no-interest, no-monthly-payment second loan for down payment and closing costs, deferred until sale, refinance, or 30 years.",
    assistanceType: "deferred_loan",
    maxAssistanceAmount: "15000",
    maxAssistancePercent: "6",
    minCreditScore: 640,
    firstTimeBuyerOnly: false,
    eligibilityNotes:
      "First-time buyers, qualified veterans, or repeat buyers in targeted areas. Income and purchase-price limits vary by county (Cook County income limit ~$137,885). Homebuyer education, 1%/$1,000 minimum contribution, DTI 50% or lower. Terms as of July 2026 — confirm with IHDA.",
    applicationUrl: "https://www.ihdamortgage.org/homebuyers",
    isActive: true,
  },
  {
    name: "IHDAccess Forgivable",
    programType: "state",
    state: "IL",
    description:
      "4% of the purchase price (up to $6,000) as a no-monthly-payment loan forgiven over 10 years. Sell or refinance earlier and the remaining balance is repaid.",
    assistanceType: "forgivable_loan",
    maxAssistanceAmount: "6000",
    maxAssistancePercent: "4",
    minCreditScore: 640,
    firstTimeBuyerOnly: false,
    eligibilityNotes:
      "First-time buyers, qualified veterans, or repeat buyers in targeted areas. County income/purchase-price limits, homebuyer education, 1%/$1,000 minimum contribution, DTI 50% or lower. Terms as of July 2026 — confirm with IHDA.",
    applicationUrl: "https://www.ihdamortgage.org/homebuyers",
    isActive: true,
  },
  {
    name: "IHDAccess Deferred",
    programType: "state",
    state: "IL",
    description:
      "5% of the purchase price (up to $7,500) as a no-interest, no-monthly-payment loan, repaid when you sell or refinance.",
    assistanceType: "deferred_loan",
    maxAssistanceAmount: "7500",
    maxAssistancePercent: "5",
    minCreditScore: 640,
    firstTimeBuyerOnly: false,
    eligibilityNotes:
      "First-time buyers, qualified veterans, or repeat buyers in targeted areas. County income/purchase-price limits, homebuyer education, 1%/$1,000 minimum contribution, DTI 50% or lower. Terms as of July 2026 — confirm with IHDA.",
    applicationUrl: "https://www.ihdamortgage.org/homebuyers",
    isActive: true,
  },
  {
    name: "IHDAccess Repayable",
    programType: "state",
    state: "IL",
    description:
      "The largest IHDA amount: 10% of the purchase price (up to $10,000) as a zero-interest second loan repaid monthly over 10 years.",
    assistanceType: "second_mortgage",
    maxAssistanceAmount: "10000",
    maxAssistancePercent: "10",
    minCreditScore: 640,
    firstTimeBuyerOnly: false,
    eligibilityNotes:
      "First-time buyers, qualified veterans, or repeat buyers in targeted areas. County income/purchase-price limits, homebuyer education, 1%/$1,000 minimum contribution, DTI 50% or lower. Terms as of July 2026 — confirm with IHDA.",
    applicationUrl: "https://www.ihdamortgage.org/homebuyers",
    isActive: true,
  },
  {
    name: "Chicago HomeGrown Purchase Assistance",
    programType: "local",
    state: "IL",
    description:
      "City of Chicago grant (launched June 2026) of up to $70,000 in Zone A or $50,000 in Zone B toward down payment and closing costs — no repayment if the home stays your primary residence for 5 years.",
    assistanceType: "grant",
    maxAssistanceAmount: "70000",
    maxAssistancePercent: "25",
    firstTimeBuyerOnly: false,
    eligibilityNotes:
      "Chicago properties only (1-2 unit homes, condos, townhomes). Income up to 120% AMI (Zone A) or 150% AMI (Zone B); grant capped at 25% of purchase price. Cannot own another property; 6-8 hours HUD-approved education; 5-year owner occupancy with annual affidavit. Administered by Neighborhood Lending Services and TRP Lending. Terms as of July 2026 — confirm at chicago.gov/homegrown.",
    applicationUrl: "https://www.chicago.gov/homegrown",
    isActive: true,
  },
  {
    name: "Cook County Down Payment Assistance Program",
    programType: "local",
    state: "IL",
    description:
      "Cook County program providing 5% of the final first loan amount (up to $25,000) for down payment, closing costs, or a rate buydown. Re-opens July 20, 2026.",
    assistanceType: "grant",
    maxAssistanceAmount: "25000",
    maxAssistancePercent: "5",
    firstTimeBuyerOnly: false,
    eligibilityNotes:
      "Open to first-time AND repeat buyers county-wide. Income up to 120% AMI; no income limit in Disproportionately Impacted Areas or Qualified Census Tracts. First-time buyers (no home owned in 3 years) must complete homebuyer education. Administered by Club 720 with Stifel Nicolaus. Re-opens July 20, 2026. Terms as of July 2026 — confirm current structure at club720.org/cookcounty-dpa.",
    applicationUrl: "https://club720.org/cookcounty-dpa",
    isActive: true,
  },
];
