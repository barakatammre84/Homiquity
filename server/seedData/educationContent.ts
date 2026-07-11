// Evergreen education content (roadmap Phase 5 — content depth).
//
// A starter topical cluster: affordability -> debt-to-income -> down payment
// assistance, cross-linked to each other, to the calculators, and to the down
// payment wizard so readers move through the hub instead of hitting a dead end.
//
// Compliance (seo-content skill / kb/L2_COMPLIANCE_AND_LOGIC.md): NO Reg Z trigger
// terms — no specific rates, APRs, monthly payment amounts, loan terms, or program
// down-payment percentages presented as an offer. Framing is qualitative and
// educational. NO Reg N approval/guarantee language — "estimate", "may", "could".
// This content is drafted for human + legal review before it goes live.
//
// Unlike server/seedData/illinoisDpa.ts, these bodies USE the Phase 4 markdown
// renderer: [links](/path), **bold**, and GFM tables are supported and encouraged
// (internal linking is the point). State-specific DPA program facts are NOT
// invented here — the national explainer links to the primary-source-verified
// Illinois articles and the wizard instead.
import type { InsertArticle } from "@shared/schema";

export const EDUCATION_ARTICLES: InsertArticle[] = [
  {
    title: "How Much House Can You Afford?",
    slug: "how-much-house-can-you-afford",
    excerpt:
      "Affordability comes down to four things: your income, your existing debts, your down payment, and your credit. Here is how each one moves the number — and how to estimate yours.",
    content: `Before you fall in love with a listing, it helps to know what a comfortable budget actually looks like. "How much house can I afford?" is really four smaller questions, and you can get a solid estimate for each in a few minutes.

## The four things that set your budget

Lenders and calculators look at the same handful of inputs. None of them requires guessing — you can estimate every one today.

| Factor | How it affects your budget |
| --- | --- |
| Income | Steady, documentable income supports a larger monthly housing payment |
| Monthly debts | Car loans, student loans, and credit-card minimums leave less room for a mortgage |
| Down payment | A larger down payment lowers the amount you need to borrow |
| Credit profile | A stronger credit history can improve the rate a lender offers you |

The fastest way to see these interact is to run the numbers in the **[home affordability calculator](/calculators/affordability)** — it turns your income, debts, and down payment into an estimated price range, no sign-up required.

## Why debt-to-income matters most

The single biggest lever is your **debt-to-income ratio (DTI)** — the share of your monthly income already going to debt payments. Most lenders look for a back-end DTI at or below roughly 43%, though some programs allow more. Lowering your monthly debts, or raising your income, moves this number more than almost anything else. There is a deeper walkthrough in [Understanding your debt-to-income ratio](/learn/understanding-debt-to-income-ratio).

## Don't forget the costs beyond the price

Your monthly payment is more than principal and interest. It usually also includes property taxes, homeowners insurance, and — if your down payment is under 20% — private mortgage insurance. Closing costs are a separate, one-time expense due at the finish line. If saving the down payment is the hard part, you may have more options than you think: see [Down payment assistance, explained](/learn/down-payment-assistance-explained).

## A sensible way to decide

1. Estimate your price range with the [affordability calculator](/calculators/affordability).
2. Pressure-test the monthly payment against your real budget — not just what a lender might allow.
3. If you're weighing whether to keep renting, compare the trade-offs with the [rent vs. buy calculator](/calculators/rent-vs-buy).
4. When the numbers feel right, the [first-time homebuyer guide](/learn/first-time-homebuyer-guide) walks through what comes next.

This is general education, not a loan offer, rate quote, or approval. Your situation is unique — a licensed loan officer or a HUD-approved housing counselor can help you turn these estimates into a plan.`,
    categoryId: "cat-getting-started",
    tags: ["affordability", "budgeting", "first-time buyer", "DTI"],
    metaTitle: "How Much House Can You Afford? A Plain-English Guide",
    metaDescription:
      "The four things that set your homebuying budget — income, debts, down payment, and credit — and how to estimate your price range for free.",
    status: "published",
    publishedAt: new Date(),
    readTimeMinutes: 5,
  },
  {
    title: "Understanding Your Debt-to-Income Ratio (DTI)",
    slug: "understanding-debt-to-income-ratio",
    excerpt:
      "Your debt-to-income ratio is the number lenders lean on most. Here is what it measures, the guideline most lenders use, and the fastest ways to improve it.",
    content: `If there is one number worth knowing before you apply for a mortgage, it's your **debt-to-income ratio (DTI)**. It's how lenders gauge whether a new housing payment will fit comfortably alongside your existing obligations.

## What DTI actually measures

DTI is the share of your gross monthly income that goes to debt payments. Lenders usually look at it two ways:

- **Front-end DTI** counts just your expected housing payment — principal, interest, property taxes, and insurance.
- **Back-end DTI** counts your housing payment plus every other monthly debt: car loans, student loans, credit-card minimums, and similar.

The back-end number is the one that carries the most weight.

## The guideline most lenders use

As a rule of thumb, many lenders look for a back-end DTI at or below roughly 43%. Some loan programs allow a higher ratio when the rest of the file is strong — solid credit, savings in reserve, or a larger down payment. A lower DTI generally gives you more room and more options.

## How to improve it before you apply

You can move your DTI in a few weeks with focused effort:

- **Pay down revolving balances** — credit cards affect both your DTI and your credit score.
- **Avoid taking on new monthly payments** — a new car loan right before applying can shrink your budget noticeably.
- **Document all your income** — side income and bonuses may count if you can show a reliable history.

Strengthening your credit at the same time compounds the benefit; the [guide to improving your credit score](/learn/improve-credit-score-mortgage) covers that side.

## See it in your own numbers

The **[affordability calculator](/calculators/affordability)** uses your income and monthly debts to estimate a comfortable price range, so you can watch how paying down a balance changes what you can afford. For the bigger picture, start with [How much house can you afford?](/learn/how-much-house-can-you-afford).

This article is general education, not financial advice or a lending decision. A licensed loan officer can tell you how your specific DTI fits a specific program.`,
    categoryId: "cat-credit-finance",
    tags: ["DTI", "credit", "qualifying", "budgeting"],
    metaTitle: "Debt-to-Income Ratio (DTI), Explained — and How to Improve It",
    metaDescription:
      "What your debt-to-income ratio measures, the guideline most lenders use, and practical ways to lower it before you apply for a mortgage.",
    status: "published",
    publishedAt: new Date(),
    readTimeMinutes: 4,
  },
  {
    title: "Down Payment Assistance, Explained",
    slug: "down-payment-assistance-explained",
    excerpt:
      "Down payment assistance can cover part of your down payment or closing costs — and it isn't only for first-time buyers. Here are the common types and how to find a program where you live.",
    content: `For many buyers, saving the down payment is the hardest part of getting into a home. Down payment assistance (DPA) exists to help with exactly that — and a lot of people who qualify never realize it's available.

## What down payment assistance is

DPA is money from a government agency, nonprofit, or sometimes an employer that covers part of your down payment or closing costs. It's used alongside a regular mortgage from a participating lender. Programs are run locally, so what's offered — and who qualifies — varies widely by state, county, and city.

## The common types

Assistance usually arrives in one of a few forms:

- **Grants** — money you never repay.
- **Forgivable loans** — a loan that is gradually forgiven the longer you stay in the home.
- **Deferred (silent second) loans** — a no-monthly-payment loan repaid only when you sell or refinance.
- **Repayable second loans** — a low- or no-interest loan you pay back in installments.

## Where it comes from

Most assistance flows through **state Housing Finance Agencies (HFAs)**, but county and city housing departments, nonprofits, and even some employers run their own programs too. A HUD-approved housing counselor can point you to options in your area at no cost.

## Who it's for

A common myth is that DPA is only for first-time buyers. Many programs also serve repeat buyers — especially in targeted neighborhoods — as well as teachers, first responders, veterans, and buyers under local income limits. Most programs share a few themes: a household income limit, a homebuyer education course, a minimum credit profile, and the requirement that the home be your primary residence.

## How to find a program

Start with the **[down payment assistance finder](/down-payment-wizard)** to explore programs by state and situation, then estimate what you'd still need to bring with the [down payment calculator](/calculators/down-payment).

For a look at how real programs work in one state, these Illinois guides walk through specific, verified examples:

- [Illinois down payment assistance in 2026](/learn/illinois-down-payment-assistance-2026)
- [Chicago's HomeGrown program](/learn/chicago-homegrown-purchase-assistance)
- [Cook County down payment assistance](/learn/cook-county-down-payment-assistance-2026)

## Before you count on any single program

Assistance programs change often, and funding can pause without notice. Program terms are set by the administering agency, not by any lender. Confirm current details with the agency or a HUD-approved housing counselor before you make decisions. This article is general education, not a loan offer or a promise of assistance.`,
    categoryId: "cat-getting-started",
    tags: ["down payment assistance", "first-time buyer", "grants", "closing costs"],
    metaTitle: "Down Payment Assistance, Explained: Grants, Forgivable Loans & More",
    metaDescription:
      "The common types of down payment assistance, where programs come from, who qualifies, and how to find one where you live — plus verified state examples.",
    status: "published",
    publishedAt: new Date(),
    readTimeMinutes: 5,
  },
];
