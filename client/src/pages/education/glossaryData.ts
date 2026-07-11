// Homeownership and mortgage glossary content.
//
// Kept as a standalone data module so the Glossary page component stays focused
// on presentation/interaction. Definitions are plain prose; `related` and `see`
// reference other entries by their slug (see `slugifyTerm`) so the page can wire
// up in-page cross-links without hardcoding anchors here.

export interface GlossaryTerm {
  /** Display name, e.g. "Adjustable-rate mortgage (ARM)". */
  term: string;
  /** Definition body. */
  definition: string;
  /** Slugs of related terms to surface as cross-links. */
  related?: string[];
  /** For pure cross-reference entries ("See X"), the slug of the target term. */
  see?: string;
  /**
   * Inline-tooltip form, when this term is surfaced via <TermTooltip>. `key` is
   * the identifier passed as <TermTooltip term="key">, `label` is the short
   * visible text, and `short` is a plain-language blurb sized for a hover card.
   * lib/glossary.ts derives the tooltip glossary from these, so the full (page)
   * and short (tooltip) definitions live in one place and never drift.
   */
  tooltip?: { key: string; label: string; short: string };
}

/** Stable anchor/id derived from a term's display name. */
export function slugifyTerm(term: string): string {
  return term
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    term: "Adjustable-rate mortgage (ARM)",
    definition:
      "An adjustable-rate mortgage (ARM) is a loan that offers an initial period of fixed interest that then resets at a specified interval. Typically, you'll see an ARM expressed as two numbers. For example, a 5/1 ARM has a fixed interest rate for the first 5 years that then adjusts based on market rates every year after that. An ARM tends to have a lower initial interest rate than a fixed-rate mortgage. However, it does come with a certain amount of unpredictability. That's because when an ARM enters its adjustable period, its interest rate may trend up or down depending on the state of the market.",
  },
  {
    term: "Amortization",
    definition:
      "Amortization is the process of paying off the principal and interest on your loan. You may see it expressed as an amortization schedule—essentially an outlook of every payment you need to make until you've paid off the balance of the loan in full.",
  },
  {
    term: "Annual percentage rate (APR)",
    tooltip: { key: "apr", label: "APR", short: "Annual Percentage Rate — the yearly cost of the loan including the interest rate plus most fees. It's the best number for comparing loans." },
    definition:
      "The annual percentage rate (APR) is your interest rate plus ancillary charges and fees—such as closing costs and discount points—expressed as a yearly rate. By law, a loan's APR is always expressed as a percentage next to the interest rate. The APR gives the best indication of the total cost of your mortgage.",
  },
  {
    term: "Appraisal",
    definition:
      "An appraisal is an unbiased estimate of your property's fair market value by a licensed professional. It's something that is typically required by all lenders during the mortgage process to ensure that the loan amount does not exceed the value of the home. A property's appraisal is based on a number of factors—including location, condition, and sales of similar homes in the area.",
  },
  {
    term: "Appreciation",
    definition:
      "Appreciation is the increase in the value of your home over time. It can be affected by all kinds of events—from property renovations to changes in the housing market.",
  },
  {
    term: "Basis points or BPs",
    definition:
      'Basis points (also known as BPs, and pronounced as "bips") are a unit of measurement. They\'re equal to one one-hundredth of one percentage point (0.01%)—one permyriad if we really want to get technical. Basis points are used to remove any kind of ambiguity when referring to the specifics of an interest rate.',
  },
  {
    term: "Cash-out refinance",
    definition:
      "A cash-out refinance is when a mortgage is refinanced for more than the outstanding balance—converting home equity into cash. Cash-out refinancing can be a great way to free up money for outstanding debt or to make an investment in home improvements.",
    related: ["refinance", "equity"],
  },
  {
    term: "Cash reserve",
    definition:
      'A cash reserve (also known as a mortgage reserve) is the "rainy day" savings you\'ve set aside for emergencies—such as the loss of a job. Lenders typically require you to have 2 months of mortgage payments on hand in case of emergency.',
  },
  {
    term: "Cash to close",
    tooltip: { key: "cashToClose", label: "cash to close", short: "The total money you bring on closing day: your down payment plus closing costs, minus any deposits or credits already applied." },
    definition:
      "Cash to close is the total amount needed to bring to the closing attorney's office on closing day. It typically includes down payment, fees, pre-paid taxes, homeowner's insurance, and any homeowners association fees that may be applicable. Cash to close is usually paid in the form of a wire transfer or a certified bank or cashier's check.",
    related: ["closing", "wire-transfer"],
  },
  {
    term: "Close of escrow",
    definition:
      "Close of escrow is the point in the homebuying process when everything is finalized. The funds held in escrow and the loan amount are transferred to the seller, and all outstanding third-party costs, such as taxes and HOA fees, are settled.",
    related: ["escrow-impounds", "closing"],
  },
  {
    term: "Closing",
    definition:
      "Closing is the final step of the homebuying transaction. All outstanding fees listed in the closing disclosure are paid, the escrow funds are cleared to be delivered to the seller, and the buyer and seller sign documents to transfer ownership of the property. The buyer signs the mortgage loan, and the title company registers the title deed to the property in the buyer's name.",
    related: ["closing-disclosure", "cash-to-close"],
  },
  {
    term: "Closing costs",
    definition:
      "Closing costs are the one-time fees you pay when your loan finalizes — things like the appraisal, title services, and lender fees. They're separate from your down payment and are usually a few percent of the loan amount, though the exact total varies by lender and location. Your Loan Estimate and Closing Disclosure both itemize them.",
    tooltip: { key: "closingCosts", label: "closing costs", short: "One-time fees paid when the loan finalizes — things like appraisal, title, and lender fees. Often 2–5% of the loan." },
    related: ["closing", "cash-to-close", "closing-disclosure"],
  },
  {
    term: "Closing disclosure",
    definition:
      "A closing disclosure (CD) is a standardized document from the lender that provides final details about the mortgage loan. It includes the loan terms, projected monthly payments, fees, and other closing costs. The lender is required to give you the CD at least 3 business days before the date of close so you can compare it against the loan estimate (LE). If something on your CD doesn't look right, be sure to ask your lender about it prior to close.",
    related: ["loan-estimate-le", "closing"],
  },
  {
    term: "Co-applicant",
    definition:
      "A co-applicant is someone whose income and credit history are put on the loan application in addition to the primary borrower. Co-applicants are a common addition when the primary borrower may not qualify for the mortgage on their own.",
    related: ["co-borrower"],
  },
  {
    term: "Co-borrower",
    definition:
      "A co-borrower is a spouse whose income and credit history are put on the loan application in addition to the primary borrower.",
    related: ["co-applicant"],
  },
  {
    term: "Collateral",
    definition:
      "Collateral is an asset that a lender accepts as security for a loan. In a traditional mortgage, the collateral is the home itself. If you fail to make loan payments to your lender, they have the option to repossess or claim ownership of the collateral—i.e. the property.",
  },
  {
    term: "Comparable sale/comp",
    definition:
      'A comparable sale (also known as a "comp") is a recently sold property in the area with similar features to the home you\'re looking to buy. Appraisers use comparable sales to help estimate the fair market value of a home.',
    related: ["appraisal", "market-value"],
  },
  {
    term: "Condo insurance",
    definition:
      "Condominium insurance (also known as an HO-6 insurance policy) protects the interior of a condo unit—usually defined as everything within its four walls. Since the common areas outside the condo are collectively owned by the condo association, those are covered under separate policies. Check your condo association bylaws to find more specific information regarding required insurance.",
    related: ["condominium-condo"],
  },
  {
    term: "Condominium (condo)",
    definition:
      "A condominium (also known as a condo) is a privately-owned home within a multi-unit development. Each owner has a shared interest in the common areas of the building—such as elevators, garages, gyms, etc.—which are typically maintained through monthly homeowners association (HOA) fees.",
    related: ["condo-insurance", "cooperative-co-op"],
  },
  {
    term: "Conforming loan",
    definition:
      "A conforming loan is any type of home loan that meets the mortgage limits set by the Federal Housing Finance Agency (FHFA)—an independent government agency. These limits are based on property size and location and change annually with home prices. Conforming loans also require you to meet Fannie Mae and Freddie Mac lending guidelines. Home loans that fall outside the set limits (non-conforming) are called jumbo loans and tend to come with a few extra hurdles.",
    related: ["nonconforming-loan", "jumbo-loan", "fannie-mae", "freddie-mac"],
  },
  {
    term: "Contingency",
    definition:
      "A contingency is a condition in a purchase contract that needs to be met by you or the seller before you're obligated to buy the home. Contingencies protect both parties in a real estate transaction and often include clauses that allow you to back out of the sale if you're unable to secure financing or if the home fails to pass inspections.",
    related: ["purchase-contract"],
  },
  {
    term: "Conventional mortgage",
    definition:
      "A conventional mortgage (also known as a non-FHA loan) is a type of home loan that is not insured or guaranteed by the federal government. Instead, it's backed by a private lender—such as Homiquity. Conventional loans are the most common type of home loan, making up nearly three quarters of home loans. If you apply for a conventional loan with less than a 20% down payment, you'll be required to pay for private mortgage insurance (PMI).",
    related: ["private-mortgage-insurance-pmi", "federal-housing-administration-loans"],
  },
  {
    term: "Cooperative/co-op",
    definition:
      'A cooperative (also known as a co-op) is a multi-unit development where owners technically don\'t "own" their units outright. Instead, owners are allotted shares in a corporation (the building), along with the right to live in one of the units. Shareholders periodically pay fees that cover everything from the door person\'s salary to the maintenance of common areas in the building. These operations are handled by a governing board that is also in charge of setting all the building rules and requirements for moving in, as well as screening potential residents.',
    related: ["condominium-condo"],
  },
  {
    term: "Credit check",
    definition:
      'A credit check (also known as a credit inquiry or credit pull) is when a lender looks into your financial history with credit reporting agencies to determine your creditworthiness. Homiquity uses both "soft" and "hard" credit checks to see if you qualify for a loan. For pre-approval, we issue a soft credit check that does not impact your credit score. Once you actually apply for a mortgage, we issue a hard credit check that can negatively impact your score for a short time.',
    related: ["credit-score", "fico-score"],
  },
  {
    term: "Credit score",
    definition:
      "Your credit score (also known as a FICO score) is a number that reflects your financial history. Scores range from 300–850, with a high credit score indicating that you have consistently repaid debts and other loans on time.",
    related: ["fico-score", "credit-check"],
  },
  {
    term: "Credits/lender credits",
    definition:
      "A credit (also known as a lender credit) is money that the lender provides to lower your closing costs in exchange for a higher interest rate. Credits are inverse to points.",
    related: ["points"],
  },
  {
    term: "Debt-to-income ratio (DTI)",
    tooltip: { key: "dti", label: "DTI", short: "Debt-to-Income ratio — how much of your monthly income goes to debt payments. Lenders usually want this at or below 43%." },
    definition:
      "Your debt-to-income ratio (DTI) is a measure of your monthly debt compared to your monthly income, calculated by your monthly debt divided by your monthly gross (pre-tax) income. DTI is one of the factors used to determine how much you can afford in a monthly mortgage payment.",
    related: ["qualifying-ratios"],
  },
  {
    term: "Default",
    definition:
      "A default is when a borrower fails to pay their mortgage. At this point, the borrower risks foreclosure, whereby the lender has the option to repossess the home.",
    related: ["foreclosure", "notice-of-default"],
  },
  {
    term: "Depreciation",
    definition: "Depreciation refers to the loss of value on an asset over time.",
    related: ["appreciation"],
  },
  {
    term: "Down payment",
    definition:
      'A down payment is the amount of cash you pay upfront toward the purchase of a home. It\'s often expressed as a percentage of the selling price of a home—typically 5–20% depending on the type of loan. The difference between your down payment and the price of the home is what you finance with a mortgage. Generally, if you put less than 20% "down" on a home, private mortgage insurance (PMI) is required in addition to your monthly payment.',
    related: ["private-mortgage-insurance-pmi"],
  },
  {
    term: "Earnest money/good faith deposit",
    definition:
      "Earnest money (also known as a good faith deposit) is money that the buyer gives the seller when a sales contract is drawn to show intent to purchase. The money is deposited into a third-party account, known as escrow, and held until closing. Once contracts are signed, the earnest money becomes part of the down payment. If the contract falls through, the earnest money is either forfeited and the seller keeps it or the money has to be returned to the buyer, dependent on the contract.",
    related: ["escrow-impounds", "down-payment"],
  },
  {
    term: "Equity",
    definition:
      "Equity is the difference between the amount you owe on a property and its current market value. In other words, your equity is the amount of ownership you have in your property.",
    related: ["cash-out-refinance", "market-value"],
  },
  {
    term: "Escrow/impounds",
    tooltip: { key: "escrow", label: "escrow", short: "An account your lender uses to collect and pay your property taxes and insurance for you, spread across your monthly payment." },
    definition:
      "An escrow (also known as an impound account) is a third-party account where money between two or more parties is managed. Escrow accounts may be used to hold a buyer's deposits while a real estate transaction is being processed. Escrow accounts are also commonly used to hold property taxes and insurance premiums (collected as part of the monthly mortgage payment) until the payments are due.",
    related: ["close-of-escrow", "prepaid-costs"],
  },
  {
    term: "Fannie Mae",
    definition:
      "Fannie Mae is the nickname for the Federal National Mortgage Association—the government sponsored entity that provides funding to mortgage lenders by buying mortgages and selling the debt to investors. The primary purpose of Fannie Mae is to ensure that there are affordable housing options and programs for homebuyers, sellers, and renters. They do this by setting lending guidelines to ensure that loans are originated fairly and that home loans are not given to those who cannot afford them.",
    related: ["freddie-mac", "conforming-loan"],
  },
  {
    term: "Federal Housing Administration loans",
    definition:
      "The Federal Housing Administration (FHA) is a government agency that promotes affordable, easy-to-qualify-for home loans. FHA loans are only available through approved lenders. If you're a first-time homebuyer without a substantial credit history, an FHA loan could be an attractive option. You can qualify for an FHA loan with a minimum credit score of 500 and a 3.5% down payment. FHA loans require an upfront mortgage insurance premium and, if there's less than a 10% down payment, require mortgage insurance for the life of the loan. At Homiquity, we require a minimum credit score of 620.",
    related: ["mortgage-insurance-premium-mip", "conventional-mortgage"],
  },
  {
    term: "FICO score",
    definition:
      "The Fair Isaac Corporation (FICO) generates credit scores based on information collected by three national credit reporting agencies: Experian, Equifax, and TransUnion. Typical FICO scores are in the 300–850 range. However, FICO has variations of scoring for different types of lenders. Credit scores are designed to give lenders an evaluation of your likelihood to pay your bills on time. A higher credit score indicates a more favorable borrower.",
    related: ["credit-score", "credit-check"],
  },
  {
    term: "Fixed-rate mortgage",
    definition:
      "A fixed-rate mortgage is a home loan that has a constant interest rate for the lifetime of the loan. Fixed-rate mortgages are typically offered in 10-, 15-, 20-, 25-, and 30-year terms—giving homebuyers the security of a predictable monthly payment. Shorter-term fixed-rate loans typically carry the lowest interest rates and are more desirable if you're comfortable handling a larger monthly payment.",
    related: ["adjustable-rate-mortgage-arm", "interest-rate"],
  },
  {
    term: "Flood certification",
    definition:
      "Flood certification (also known as a flood determination and certification) is a document issued to certify whether a property is located in a flood zone based on FEMA (Federal Emergency Management Association) flood maps. A flood certification is required by your lender and determines whether special flood insurance is needed for your home.",
    related: ["flood-insurance"],
  },
  {
    term: "Flood insurance",
    definition:
      "Flood insurance is special coverage that covers water damage caused by flooding. If your home is found to be located within a flood zone, your lender will likely require you to have a flood insurance policy. Premiums vary depending on how prone the property is to flooding.",
    related: ["flood-certification", "homeowners-insurance"],
  },
  {
    term: "Foreclosure",
    definition:
      "Foreclosure is the process of repossessing a home after the borrower defaults on their mortgage.",
    related: ["default", "notice-of-default", "short-sale"],
  },
  {
    term: "Freddie Mac",
    definition:
      "Freddie Mac is the nickname for the Federal Home Loan Mortgage Corporation, a government-sponsored entity that provides funding to smaller mortgage banks and lenders by buying their loans. The primary purpose of Freddie Mac is to ensure that there are affordable housing options and programs for low-income homebuyers, sellers, and renters.",
    related: ["fannie-mae", "conforming-loan"],
  },
  {
    term: "Gift letter",
    definition:
      "A gift letter documents money that has been given to you by a family member, spouse, or partner to support your down payment or closing costs. Its purpose is to assure the lender that the gift funds have no expectation of being repaid—otherwise they would be classified as debt and included in your debt-to-income ratio.",
    related: ["down-payment", "debt-to-income-ratio-dti"],
  },
  {
    term: "Home inspection",
    definition:
      "A home inspection is an examination of a home's physical condition in connection with its sale. It's on the homebuyer to organize and pay for a home inspection after their offer has been accepted but before they sign on the dotted line. The purpose is to uncover any potential issues with the home before finalizing the purchase. There are no federal regulations governing home inspectors, and licensing requirements vary by state.",
    related: ["pest-inspection", "walk-through", "contingency"],
  },
  {
    term: "Homeowners insurance",
    definition:
      "Homeowners insurance is a form of financial protection against loss or damage to your home in the event of burglary, fire, or natural disaster. Most lenders require proof of a homeowners insurance policy prior to closing. That's because the lender wants to protect their investment as much as you do—and if something ever happened to your home, they want to know that you'll have the resources to pay off your loan. Homiquity has an in-house insurance agency with an online process that allows you to shop for policies right alongside your home loan application.",
    related: ["flood-insurance", "condo-insurance"],
  },
  {
    term: "Interest rate",
    definition:
      "When a lender offers you an interest rate for a mortgage, the interest rate is the cost of borrowing money, expressed as a percentage of the loan. Most consumer mortgages use simple interest which is defined as paying interest only on the principal. Some loans use compound interest which is applied to the principal and also to the accumulated interest of previous periods (this is also known as a negative amortization loan). Borrowers are often quoted interest rates in addition to annual percentage rates (APRs), which are interest rates plus lender fees and charges.",
    related: ["annual-percentage-rate-apr", "principal", "negative-amortization"],
  },
  {
    term: "Investment property",
    definition:
      "An investment property is real estate that's purchased with the exclusive purpose of generating a profit. Unlike a primary residence or a secondary home, an investment property is not something you'd typically own for personal use. More likely, the property would be rented out, sold for a return on investment, or both. Investment properties tend to have the highest interest rates and down payment requirements of all property types.",
    related: ["primary-residence", "secondary-home", "owner-occupancy"],
  },
  {
    term: "Jumbo loan",
    definition:
      "A jumbo loan (also known as a non-conforming loan) is a home loan that exceeds the maximum Federal Housing Administration (FHA) limit. Jumbo loans are not guaranteed by Fannie Mae or Freddie Mac, which means that the lender has no protection in the event that the borrower defaults. The maximum limit depends on the location of the home and what the conforming loan limit is for that area. Typically, more expensive areas of the country have higher conforming loan limits.",
    related: ["conforming-loan", "nonconforming-loan"],
  },
  {
    term: "Lien",
    definition:
      "A lien is a legal claim to an item of property until an owed debt is paid off. When you take out a home loan, your lender has a lien on your home. This gives them the right to seize your home if you fail to repay your loan.",
    related: ["collateral", "title"],
  },
  {
    term: "Listing agent",
    definition:
      "Listing agents (also known as seller's agents) work on behalf of someone who is selling a property. They are authorized to handle negotiations and meet with potential buyers on behalf of the property owner.",
    related: ["real-estate-agent"],
  },
  {
    term: "Loan-to-value (LTV)",
    definition:
      "A loan-to-value (LTV) ratio is an equation that lenders use to assess the amount of risk associated with a home loan. LTV is calculated by dividing the total home loan amount by the appraised market value of the home. Typically, if the LTV ratio is higher than 0.8, lenders require private mortgage insurance (PMI) to offset the higher risk of default.",
    related: ["private-mortgage-insurance-pmi", "appraisal"],
  },
  {
    term: "Loan commitment",
    definition:
      "A loan commitment is a letter from a lender indicating your eligibility for a home loan. In essence, it is the lender's promise to fund the loan as stated by the terms in the letter. You receive a loan commitment letter once your application has been reviewed and the underwriting process is complete.",
    related: ["underwriting", "pre-approval-letter"],
  },
  {
    term: "Loan Consultant",
    definition:
      "A Loan Consultant (also known as a Mortgage Expert) is a lender representative who serves as your primary point of contact until you lock a rate, at which point a Processing Expert takes over.",
    related: ["loan-processor", "rate-lock"],
  },
  {
    term: "Loan estimate (LE)",
    definition:
      "A loan estimate (also known as an LE) is a standardized 3-page form that details the interest rate, term, monthly payment, and closing costs associated with your loan. Lenders are required by law to provide you with a loan estimate within three days of your application. At Homiquity, we deliver loan estimates online within minutes.",
    related: ["closing-disclosure"],
  },
  {
    term: "Loan Processor",
    definition:
      "A Loan Processor (also known as a Processing Expert) is the person responsible for preparing your mortgage application and documentation before it goes to the Underwriter. It's their job to collect and review your income, credit, and asset documentation and ensure that everything aligns with what you stated on the application. You can reach Homiquity Processing Experts via call, text, or email at any time during your application process.",
    related: ["loan-consultant", "underwriter"],
  },
  {
    term: "Loan term",
    definition: "A loan term is the length of time over which the loan is to be repaid.",
    related: ["fixed-rate-mortgage", "amortization"],
  },
  {
    term: "Market value",
    definition:
      "Market value is the amount of money that a property would be sold for on the open market. This is determined by an appraiser based on its condition and comparable properties that have recently sold. Note that market value may not match the purchase price.",
    related: ["appraisal", "comparable-sale-comp"],
  },
  {
    term: "Mortgage Expert",
    definition: "See Loan Consultant.",
    see: "loan-consultant",
  },
  {
    term: "Mortgage insurance premium (MIP)",
    definition:
      "Mortgage insurance premium (MIP) is an upfront and annual insurance premium that's required for any Federal Housing Administration (FHA) home loan—regardless of the size of the down payment. It protects the lender in case the borrower defaults on the loan. MIP differs from private mortgage insurance (PMI), which is reserved for conventional loans.",
    related: ["federal-housing-administration-loans", "private-mortgage-insurance-pmi"],
  },
  {
    term: "Mortgage note",
    definition:
      'A mortgage note (also known as a "note") is a document signed at closing outlining the complete terms of your new home loan. Think of it like an official "IOU." A mortgage note states how much you are borrowing from the lender, whether the loan has a fixed or adjustable interest rate, and when you are expected to pay it back.',
    related: ["closing", "principal"],
  },
  {
    term: "Negative amortization",
    definition:
      'Negative amortization describes the process that causes a loan balance to increase over time, despite regular payments being made. This occurs when your monthly payments do not cover all the interest you\'ve been charged that month. The unpaid interest is added to the principal, and the following month you\'ll be charged interest on the new, higher balance (the principal plus the previous month\'s unpaid interest). Negative amortization may also be referred to as "NegAm" or "deferred interest" or "compound interest."',
    related: ["amortization", "interest-rate", "principal"],
  },
  {
    term: "Nonconforming loan",
    definition:
      "Nonconforming loans do not meet the mortgage guidelines set by Fannie Mae and Freddie Mac. As such, they're considered higher risk and tend to have higher interest rates than conforming loans. The most popular type of nonconforming loan is the jumbo loan, which is for a property that is more expensive than the mortgage limits set by Fannie Mae and Freddie Mac. Jumbo loans usually come with fairly stringent credit score, down payment, and debt-to-income ratio (DTI) requirements. Other types of nonconforming loans include government-backed loans, such as FHA loans, USDA loans, and VA loans. These kinds of mortgages are designed to provide affordable housing options for those who may not qualify for a conforming loan.",
    related: ["conforming-loan", "jumbo-loan", "federal-housing-administration-loans", "va-loans"],
  },
  {
    term: "Notice of default",
    definition:
      "A notice of default is a public notice that a borrower is behind on their mortgage payments. (Also known as being in default on their loan.) It's typically filed with a court and regarded as the first step in the foreclosure process. If the borrower comes to a payment agreement with the lender or pays the outstanding balance within 14 days, the lender will stop foreclosure proceedings. However, if the borrower does not take these steps, the default is registered with the credit reporting agencies and the lender will continue proceedings to repossess the home.",
    related: ["default", "foreclosure"],
  },
  {
    term: "Occupancy date",
    definition:
      "Your occupancy date is the day you'll be able to move into your new home. It may not align with closing day, despite the transfer of ownership that is taking place. Some counties require the title deed to be recorded in court before the new homeowner can move in.",
    related: ["closing", "owner-occupancy"],
  },
  {
    term: "Origination fee/loan origination fee",
    definition:
      "Origination fees are the one-time costs you pay to a lender for processing your home loan.",
    related: ["settlement-costs", "third-party-fees"],
  },
  {
    term: "Owner-occupancy",
    definition:
      "Owner-occupancy refers to the concept of living in the home that you own. It is crucial information from the lender's point of view because if you weren't planning to live at the home you were purchasing or refinancing, you would be classed as an absentee owner. In that instance, the home may be considered an investment property and you would not be eligible for the same types of home loan products or rates available for a primary residence.",
    related: ["primary-residence", "investment-property", "secondary-home"],
  },
  {
    term: "Pest inspection",
    definition:
      "In the due diligence process, a pest inspection is performed by a certified pest inspector to determine whether a property has an active or previous infestation. Pest inspections are a part of closing costs but may be paid for by either the buyer or seller.",
    related: ["termite-letter", "home-inspection"],
  },
  {
    term: "PITI",
    tooltip: { key: "piti", label: "PITI", short: "Your full monthly housing payment: Principal, Interest, property Taxes, and homeowners Insurance." },
    definition:
      "PITI is short for Principal, Interest, Taxes, and Insurance—the four aspects of a monthly home loan payment. Principal and interest are based on the loan amount and terms of your mortgage. Taxes and insurance are directly related to the value of your property and the levies that your local government applies.",
    related: ["principal", "interest-rate", "qualifying-ratios"],
  },
  {
    term: "Planned unit development (PUD)",
    definition:
      "A planned unit development (PUD) is a cohesively designed community that consists of townhouses, detached homes, or condos, as well as public spaces and commercial real estate.",
    related: ["condominium-condo"],
  },
  {
    term: "Points",
    tooltip: { key: "points", label: "points", short: "An optional upfront fee you can pay to lower your interest rate. One point costs 1% of the loan amount." },
    definition:
      "Points (also known as discount points and mortgage points) are a way to lower the interest rate on your home loan by agreeing to pay more at closing. One mortgage point is equal to 1% of the mortgage amount and can lower your interest rate by up to 0.25%. The more points you pay, the lower your payment and rate will be. Points are the inverse of credits.",
    related: ["credits-lender-credits", "interest-rate"],
  },
  {
    term: "Pre-approval letter",
    definition:
      "A pre-approval letter is a document from a lender that states the exact amount you're approved to borrow once your stated information is verified. Getting a pre-approval letter is an essential time-saving first step in the home shopping process.",
    related: ["verified-pre-approval", "loan-commitment"],
  },
  {
    term: "Prepaid costs",
    definition:
      'Prepaid costs are payments made at closing for upcoming line items of your new home loan. They\'re called "prepaid" costs because you\'re paying for them before they are technically due. The most common kinds of prepaid costs are homeowners insurance, property taxes, and mortgage interest. These are paid into an escrow account to ensure that you have money to pay your bills when they become due.',
    related: ["escrow-impounds", "closing"],
  },
  {
    term: "Prepayment penalty",
    definition:
      "A prepayment penalty is a fee that's charged when you pay off your mortgage early. Homiquity home loans have no prepayment penalties so you can pay off the balance or refinance at anytime.",
    related: ["refinance"],
  },
  {
    term: "Primary residence",
    definition:
      "A primary residence is a home in which you live for the majority of the year. It could be a free-standing home, a condo, a co-op... it could even be a boat—but you can only have one primary residence. Home loan rates tend to be lower for primary residences, so it's important that you let your lender know this information in your application. The interest that you pay on a home loan for a primary residence may also be tax deductible.",
    related: ["secondary-home", "investment-property", "owner-occupancy"],
  },
  {
    term: "Principal",
    definition:
      "When referring to a home loan, the principal is the amount of money borrowed excluding taxes, interest, or homeowners insurance. In other words, it's what you originally borrowed from your lender when you first took out your home loan. If you borrowed $250,000, then your principal is $250,000.",
    related: ["interest-rate", "amortization", "piti"],
  },
  {
    term: "Private mortgage insurance (PMI)",
    tooltip: { key: "pmi", label: "PMI", short: "Private Mortgage Insurance — an added monthly cost when your down payment is under 20%. It protects the lender, not you, and can usually be removed later." },
    definition:
      "Private mortgage insurance (PMI) is insurance required by lenders when a borrower puts less than 20% down on a conventional loan. It's meant to protect the lender in the event that the borrower defaults. PMI can be cancelled once the borrower has at least 20% equity in the property. The PMI amount is determined by many different factors, similar to your interest rate—including FICO score, loan-to-value ratio, debt-to-income ratio, property type, and occupancy.",
    related: ["conventional-mortgage", "loan-to-value-ltv", "mortgage-insurance-premium-mip"],
  },
  {
    term: "Purchase contract",
    definition:
      "A purchase contract (also known as a contract to purchase real estate) is a legal written agreement between a buyer and seller. Purchase contracts vary state to state depending on local law. When both the buyer and seller finish negotiating terms and stipulations, they sign the purchase contract and it becomes legally binding—contingent upon the terms in the contract being met. Some states allow real estate agents to draw up purchase contracts but others only allow lawyers to write contracts.",
    related: ["contingency", "earnest-money-good-faith-deposit"],
  },
  {
    term: "Qualifying ratios",
    definition:
      "A qualifying ratio is a measurement that mortgage lenders use to help decide if you qualify for the loans they offer. The qualifying ratio consists of 2 subcomponents; the housing expense ratio, which is made up of monthly principal, interest, property taxes, and insurance payments (PITI); and the debt-to-income ratio (DTI). Most lenders prefer you to spend no more than 28% of your gross monthly income on PITI payments (the housing expense ratio), and spend no more than 36% of your gross monthly income paying your total debt (the debt-to-income ratio). For this reason, the qualifying ratio may be referred to as the 28/36 rule.",
    related: ["piti", "debt-to-income-ratio-dti"],
  },
  {
    term: "Rate lock",
    definition:
      "A rate lock is a guarantee from a lender that the offered interest rate with the associated points and credits for a mortgage is the rate that they will receive, so long as their financial information matches what was provided during the rate lock process. Rate locks are good for a pre-set length of time, such as 30, 45, or 60 days. Homiquity offers a 24/7 online mortgage rate lock to protect you from rising interest rates.",
    related: ["interest-rate", "points", "credits-lender-credits"],
  },
  {
    term: "Real estate agent",
    definition:
      "Real estate agents are the state-licensed officials that are authorized to act as a buyer's agent in the negotiation and purchase of a home, as opposed to listing agents or seller's agents who act on behalf of the seller. Homiquity Real Estate has a network of top-rated local agents who can guide you through the home buying process. Ask your Loan Consultant about how you can be matched.",
    related: ["listing-agent", "loan-consultant"],
  },
  {
    term: "Refinance",
    definition:
      "A refinance (also known as a refi) is the process of applying for a new home loan to replace an existing home loan. Homeowners generally refinance to change the rate or term of their home loan (rate/term refinance) or to take cash out of the equity that they've built (cash-out refinance).",
    related: ["cash-out-refinance", "equity"],
  },
  {
    term: "Secondary home",
    definition:
      "A secondary home is, simply put, a vacation home. You must have sole control over the property, meaning that it cannot be a full-time rental, timeshare, or managed by a property management company. Secondary homes must be suitable for year-round occupancy. If you intend to rent out a secondary home for the majority of the year, it may be considered an investment property.",
    related: ["primary-residence", "investment-property"],
  },
  {
    term: "Settlement costs",
    definition:
      "Settlement costs (also known as closing costs) are the fees that the buyer and/or seller have to pay to complete the sale of the property. Depending on the lender, these may include origination fees, credit report fees, and appraisal fees, as well as property taxes and recording fees.",
    related: ["closing", "third-party-fees", "origination-fee-loan-origination-fee"],
  },
  {
    term: "Short sale",
    definition:
      "A short sale is when a homeowner sells their home for a price less than the balance of their current mortgage. If a lender agrees to a short sale, the homeowner will typically owe the bank or lender the remaining balance due on their home loan after the sale. If a borrower has had a short sale in the past, there is a 4-year waiting period to qualify for a new mortgage.",
    related: ["foreclosure", "default"],
  },
  {
    term: "Survey",
    definition:
      "A survey is a drawing of your property that details the location of the lot, property lines, home, and any other structures within its bounds. The purpose of a survey is to confirm land boundaries in the event of a legal dispute. Surveys are typically held by the local county tax collector and are part of the closing costs associated with buying a free-standing home.",
    related: ["title", "closing"],
  },
  {
    term: "Termite letter",
    definition:
      "A termite letter is a document issued by a professional inspector to certify that the property was inspected and found to have no termites or wood-boring insects such as powder-post beetles. Pest inspections are a part of closing costs but may be paid for by either the buyer or seller.",
    related: ["pest-inspection"],
  },
  {
    term: "Third-party fees",
    definition:
      "Third-party fees are the fees not paid to the lender to complete the sale of the property. Depending on the lender, these fees may cover your credit report, appraisal, land survey, recording fee for county, and transfer taxes.",
    related: ["settlement-costs", "transfer-taxes"],
  },
  {
    term: "Title",
    definition:
      "Title is the legal concept of property ownership. States and counties require legal recording of property ownership for tax purposes. Having a record of ownership also ensures that the person holding the deed is the uncontested legal owner.",
    related: ["title-insurance", "title-vesting", "lien"],
  },
  {
    term: "Title insurance",
    definition:
      "Title insurance (also known as owner's title insurance) protects borrowers and lenders against financial loss from past defects or problems with the ownership of a property—typically back taxes, liens, and conflicting wills. Most lenders require title insurance to protect their interest in the property until the home loan is paid off. You can also purchase borrower's title insurance to protect yourself.",
    related: ["title", "lien"],
  },
  {
    term: "Title vesting",
    definition:
      "Title vesting defines who owns a certain property and thus who is liable for property taxes and other legal matters, as well as how the property can be sold. There can be multiple owners of a single property.",
    related: ["title"],
  },
  {
    term: "Transfer taxes",
    definition:
      "A transfer tax is a real estate tax usually paid at closing to facilitate the transfer of the property deed from the seller to the buyer. Depending on where you live, you may have to pay transfer taxes at the city, county, and state level. In special circumstances—such as the inheritance of a property—you may also encounter transfer taxes at a federal level.",
    related: ["third-party-fees", "settlement-costs"],
  },
  {
    term: "Underwriter",
    definition:
      "An Underwriter is a member of your loan team who assesses your loan application and the appraisal of the property you are trying to finance. It's their job to determine whether or not you qualify for a home loan.",
    related: ["underwriting", "loan-processor"],
  },
  {
    term: "Underwriting",
    definition:
      "Underwriting is the process of evaluating a complete and verified home loan application as well as the appraisal of the property being financed. Underwriting is the assessment of risk in a home loan and a borrower's ability to repay it. The process ends with an approval or denial of a home loan.",
    related: ["underwriter", "loan-commitment"],
  },
  {
    term: "VA loans",
    definition:
      "VA loans are home loans with lenient qualifying guidelines and favorable terms for active military service members, veterans, and eligible military spouses. Because VA loans are backed in part by the federal government, lenders and banks are able to offer reduced interest rates.",
    related: ["nonconforming-loan", "federal-housing-administration-loans"],
  },
  {
    term: "Verified pre-approval",
    definition:
      "A verified pre-approval letter provides you and your real estate agent the clearest idea of what you can afford. It's based on verified information and requires a hard credit check.",
    related: ["pre-approval-letter", "credit-check"],
  },
  {
    term: "Walk-through",
    definition:
      "A walk-through is the final time a buyer can inspect the property, prior to closing. The purpose of the walk-through is to make sure the home is in the condition you agreed to buy it in and that the seller has completed any repairs or replacements they agreed to make. It is also your last chance to ensure there are no new issues in the home.",
    related: ["home-inspection", "closing"],
  },
  {
    term: "Wire transfer",
    definition:
      "A wire transfer is an electronic transfer of money between two banks. It is often used when you need to complete a large transaction, such as making an earnest money deposit, a down payment, or to refinance a mortgage. Domestic wire transfers are typically processed on the same day they're initiated. International wire transfers are usually delivered to the recipient within 2 days.",
    related: ["earnest-money-good-faith-deposit", "down-payment", "refinance"],
  },
  {
    term: "Year-end statement",
    definition:
      "Your year-end statement is the annual summary of your mortgage account. It encapsulates the previous 12 months of mortgage payments, taxes, and interest. Lenders are required to send out year-end statements by January 31. For taxation purposes, a year-end statement is also referred to as form 1098.",
  },
];
