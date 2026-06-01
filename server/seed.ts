import { db } from "./db";
import { contentCategories, articles, faqs, mortgageRatePrograms, mortgageRates, consentTemplates, partnerProviders, properties } from "@shared/schema";
import { refreshRates } from "./services/rateService";

export async function seedDatabase() {
  try {
    const existingCategories = await db.select({ id: contentCategories.id }).from(contentCategories).limit(1);

    if (existingCategories.length === 0) {
      console.log("Seeding Learning Center content...");

      const categoryData = [
        { id: "cat-getting-started", name: "Getting Started", slug: "getting-started", description: "Essential guides for first-time homebuyers", icon: "home", color: "#22c55e", displayOrder: 1 },
        { id: "cat-mortgage-basics", name: "Mortgage Basics", slug: "mortgage-basics", description: "Understanding different loan types and terms", icon: "book-open", color: "#3b82f6", displayOrder: 2 },
        { id: "cat-credit-finance", name: "Credit & Finance", slug: "credit-finance", description: "Tips for improving your financial profile", icon: "dollar-sign", color: "#f59e0b", displayOrder: 3 },
        { id: "cat-home-buying", name: "Home Buying Process", slug: "home-buying", description: "Step-by-step guide to purchasing your home", icon: "file-text", color: "#8b5cf6", displayOrder: 4 },
      ];

      for (const cat of categoryData) {
        await db.insert(contentCategories).values(cat);
      }
      console.log("Seeded content categories");

      const articleData = [
        {
          title: "First-Time Homebuyer's Complete Guide",
          slug: "first-time-homebuyer-guide",
          excerpt: "Everything you need to know about buying your first home, from pre-approval to closing.",
          content: `Buying your first home is an exciting milestone. This comprehensive guide will walk you through every step of the process.

## Getting Started

Before you start looking at homes, you'll want to get your finances in order. This means:

- Checking your credit score
- Saving for a down payment
- Getting pre-approved for a mortgage

## The Pre-Approval Process

A pre-approval letter shows sellers you're a serious buyer. To get pre-approved, you'll need:

- Proof of income (pay stubs, W-2s, tax returns)
- Proof of assets (bank statements)
- Good credit history
- Employment verification

## Finding the Right Home

Work with a real estate agent to find homes in your budget. Consider factors like:

- Location and commute times
- School districts
- Future resale value
- Home condition and age

## Making an Offer

Once you find the right home, your agent will help you make a competitive offer. Be prepared to negotiate on price, closing costs, and contingencies.

## Closing the Deal

The closing process typically takes 30-45 days. During this time, you'll complete a home inspection, finalize your mortgage, and sign lots of paperwork!`,
          categoryId: "cat-getting-started",
          tags: ["first-time buyer", "guide", "pre-approval"],
          status: "published",
          publishedAt: new Date(),
        },
        {
          title: "Understanding Mortgage Types: Fixed vs. Adjustable",
          slug: "fixed-vs-adjustable-rate-mortgages",
          excerpt: "Learn the differences between fixed-rate and adjustable-rate mortgages to make an informed decision.",
          content: `When choosing a mortgage, one of the most important decisions is whether to go with a fixed-rate or adjustable-rate mortgage (ARM).

## Fixed-Rate Mortgages

A fixed-rate mortgage locks in your interest rate for the entire loan term. This means your monthly payment stays the same.

### Pros
- Predictable monthly payments
- Protection from rising interest rates
- Easier to budget

### Cons
- Usually higher initial rates than ARMs
- Less flexibility if rates drop

## Adjustable-Rate Mortgages (ARMs)

ARMs start with a lower fixed rate for an initial period, then adjust periodically based on market conditions.

### Common ARM Types
- 5/1 ARM: Fixed for 5 years, then adjusts annually
- 7/1 ARM: Fixed for 7 years, then adjusts annually
- 10/1 ARM: Fixed for 10 years, then adjusts annually

### Pros
- Lower initial rates
- Good if you plan to sell or refinance before adjustment

### Cons
- Payments can increase significantly
- More complex to understand

## Which Should You Choose?

Choose a fixed-rate mortgage if you plan to stay in your home long-term and want payment stability. Consider an ARM if you plan to move or refinance within the initial fixed period.`,
          categoryId: "cat-mortgage-basics",
          tags: ["mortgage types", "fixed-rate", "adjustable-rate", "ARM"],
          status: "published",
          publishedAt: new Date(),
        },
        {
          title: "How to Improve Your Credit Score for a Better Mortgage Rate",
          slug: "improve-credit-score-mortgage",
          excerpt: "Practical steps to improve your credit score before applying for a mortgage.",
          content: `Your credit score is one of the most important factors in determining your mortgage rate. Here's how to improve it.

## Understanding Credit Scores

Credit scores range from 300 to 850. Higher scores generally correspond to more favorable lending terms.

- 750+
- 700-749
- 650-699
- Below 650

## Quick Wins to Boost Your Score

### 1. Pay Bills On Time
Payment history is 35% of your score. Set up autopay to never miss a payment.

### 2. Reduce Credit Utilization
Keep your credit card balances below 30% of your limits. Below 10% is even better.

### 3. Don't Close Old Accounts
Length of credit history matters. Keep old accounts open even if you don't use them.

### 4. Limit New Credit Applications
Each hard inquiry can temporarily lower your score. Avoid opening new accounts before applying for a mortgage.

## Long-Term Strategies

- Become an authorized user on someone's good credit account
- Dispute any errors on your credit reports
- Pay down debt rather than moving it around

## How Long Does It Take?

Most improvements take 30-60 days to show on your credit report. Start working on your credit at least 6 months before applying for a mortgage.`,
          categoryId: "cat-credit-finance",
          tags: ["credit score", "credit", "rates", "tips"],
          status: "published",
          publishedAt: new Date(),
        },
      ];

      for (const article of articleData) {
        await db.insert(articles).values(article);
      }
      console.log("Seeded articles");

      const faqData = [
        {
          question: "How much house can I afford?",
          answer: "A general rule is that your monthly housing costs (including mortgage, insurance, and taxes) should not exceed 28% of your gross monthly income. Use our affordability calculator to get a personalized estimate based on your income, debts, and down payment.",
          categoryId: "cat-getting-started",
          searchKeywords: ["afford", "budget", "income", "how much"],
          displayOrder: 1,
          isPopular: true,
          status: "published",
        },
        {
          question: "What credit score do I need to buy a house?",
          answer: "Credit score requirements vary by loan program and are evaluated during underwriting review. Conventional loans generally have different minimum requirements than government-backed programs. Your specific terms will be determined during the formal underwriting process.",
          categoryId: "cat-credit-finance",
          searchKeywords: ["credit score", "credit", "minimum", "requirement"],
          displayOrder: 2,
          isPopular: true,
          status: "published",
        },
        {
          question: "How much should I save for a down payment?",
          answer: "While 20% down is traditional, many loans allow for much less. Conventional loans may require as little as 3%, FHA loans 3.5%, and VA/USDA loans can be 0% down. However, putting less than 20% down typically requires private mortgage insurance (PMI).",
          categoryId: "cat-getting-started",
          searchKeywords: ["down payment", "save", "20 percent", "PMI"],
          displayOrder: 3,
          isPopular: true,
          status: "published",
        },
        {
          question: "What documents do I need to apply for a mortgage?",
          answer: "You'll typically need: proof of income (pay stubs, W-2s, tax returns for 2 years), bank statements (2-3 months), identification (driver's license, Social Security card), employment verification, and proof of assets. Self-employed borrowers may need additional documentation.",
          categoryId: "cat-home-buying",
          searchKeywords: ["documents", "paperwork", "requirements", "apply"],
          displayOrder: 4,
          status: "published",
        },
        {
          question: "How long does the mortgage process take?",
          answer: "The typical mortgage process takes 30-45 days from application to closing. Getting pre-approved can take 1-3 days. Factors that can affect timing include document collection, appraisal scheduling, and title search completion.",
          categoryId: "cat-home-buying",
          searchKeywords: ["timeline", "how long", "closing", "process"],
          displayOrder: 5,
          isPopular: true,
          status: "published",
        },
        {
          question: "What is PMI and how can I avoid it?",
          answer: "Private Mortgage Insurance (PMI) protects the lender if you default on your loan. It's required when you put less than 20% down on a conventional loan. To avoid PMI, you can: put 20% or more down, get a VA loan (if eligible), or use a piggyback loan structure.",
          categoryId: "cat-mortgage-basics",
          searchKeywords: ["PMI", "private mortgage insurance", "avoid", "20 percent"],
          displayOrder: 6,
          status: "published",
        },
        {
          question: "Should I get a 15-year or 30-year mortgage?",
          answer: "A 30-year mortgage has lower monthly payments but you pay more interest over time. A 15-year mortgage has higher payments but saves significantly on interest and builds equity faster. Choose based on your budget, financial goals, and how long you plan to stay in the home.",
          categoryId: "cat-mortgage-basics",
          searchKeywords: ["15 year", "30 year", "term", "loan length"],
          displayOrder: 7,
          status: "published",
        },
        {
          question: "What is an escrow account?",
          answer: "An escrow account holds funds for property taxes and homeowner's insurance. Your lender collects a portion with each mortgage payment and pays these bills on your behalf. This spreads out these large expenses and ensures they're always paid on time.",
          categoryId: "cat-mortgage-basics",
          searchKeywords: ["escrow", "taxes", "insurance", "payments"],
          displayOrder: 8,
          status: "published",
        },
      ];

      for (const faq of faqData) {
        await db.insert(faqs).values(faq);
      }
      console.log("Seeded FAQs");
    }

    const existingPrograms = await db.select({ id: mortgageRatePrograms.id }).from(mortgageRatePrograms).limit(1);
    if (existingPrograms.length === 0) {
      console.log("Seeding mortgage rate programs...");

      const ratePrograms = [
        {
          id: "prog-30yr-fixed",
          name: "30-yr fixed",
          slug: "30-yr-fixed",
          description: "Traditional 30-year fixed rate mortgage with consistent monthly payments",
          termYears: 30,
          isAdjustable: false,
          loanType: "conventional",
          displayOrder: 1,
          isActive: true,
        },
        {
          id: "prog-20yr-fixed",
          name: "20-yr fixed",
          slug: "20-yr-fixed",
          description: "20-year fixed rate mortgage for faster payoff",
          termYears: 20,
          isAdjustable: false,
          loanType: "conventional",
          displayOrder: 2,
          isActive: true,
        },
        {
          id: "prog-15yr-fixed",
          name: "15-yr fixed",
          slug: "15-yr-fixed",
          description: "15-year fixed rate mortgage with lower rates",
          termYears: 15,
          isAdjustable: false,
          loanType: "conventional",
          displayOrder: 3,
          isActive: true,
        },
        {
          id: "prog-10yr-fixed",
          name: "10-yr fixed",
          slug: "10-yr-fixed",
          description: "10-year fixed rate mortgage for fastest payoff",
          termYears: 10,
          isAdjustable: false,
          loanType: "conventional",
          displayOrder: 4,
          isActive: true,
        },
        {
          id: "prog-5-6-arm",
          name: "5/6m ARM",
          slug: "5-6-arm",
          description: "Adjustable rate mortgage with 5-year fixed period, then adjusts every 6 months",
          termYears: 30,
          isAdjustable: true,
          adjustmentPeriod: "6m",
          loanType: "conventional",
          displayOrder: 5,
          isActive: true,
        },
        {
          id: "prog-7-6-arm",
          name: "7/6m ARM",
          slug: "7-6-arm",
          description: "Adjustable rate mortgage with 7-year fixed period, then adjusts every 6 months",
          termYears: 30,
          isAdjustable: true,
          adjustmentPeriod: "6m",
          loanType: "conventional",
          displayOrder: 6,
          isActive: true,
        },
        {
          id: "prog-30yr-fha",
          name: "30-yr FHA",
          slug: "30-yr-fha",
          description: "FHA-backed 30-year fixed rate mortgage with lower down payment requirements",
          termYears: 30,
          isAdjustable: false,
          loanType: "fha",
          displayOrder: 7,
          isActive: true,
        },
        {
          id: "prog-30yr-va",
          name: "30-yr VA",
          slug: "30-yr-va",
          description: "VA-backed 30-year fixed rate mortgage for eligible veterans",
          termYears: 30,
          isAdjustable: false,
          loanType: "va",
          displayOrder: 8,
          isActive: true,
        },
      ];

      for (const program of ratePrograms) {
        await db.insert(mortgageRatePrograms).values(program);
      }
      console.log(`Seeded ${ratePrograms.length} mortgage rate programs`);
    }

    console.log("Seeding consent templates...");
    const existingConsentTemplates = await db.select().from(consentTemplates).limit(1);
    if (existingConsentTemplates.length === 0) {
      const templates = [
        {
          consentType: "credit_authorization",
          version: "1.0",
          title: "Credit Report Authorization",
          shortDescription: "Authorization to obtain consumer credit reports from credit bureaus",
          effectiveDate: new Date(),
          fullText: `AUTHORIZATION TO OBTAIN CONSUMER CREDIT REPORTS

I hereby authorize the lender, its agents, successors, and assigns, to obtain my credit report from any consumer reporting agency for the purpose of evaluating my creditworthiness in connection with a mortgage loan application.

I understand that:
1. The lender will obtain credit reports from one or more of the three major credit bureaus (Experian, Equifax, TransUnion)
2. This authorization is valid for the duration of my loan application process
3. My credit information will be used solely for the purpose of evaluating my loan application
4. I have the right to receive a copy of my credit report upon request

This authorization shall remain in effect until my loan transaction is completed or my application is withdrawn.`,
          regulatoryReference: "FCRA Section 604",
          isActive: true,
        },
        {
          consentType: "e_disclosure",
          version: "1.0",
          title: "eDisclosure Consent",
          shortDescription: "Consent to receive disclosures and documents electronically",
          effectiveDate: new Date(),
          fullText: `ELECTRONIC RECORDS AND SIGNATURES DISCLOSURE

By providing your consent, you agree to receive disclosures, notices, and other documents electronically. This includes:

1. Loan Estimates
2. Closing Disclosures
3. Privacy Notices
4. All other legally required disclosures

HARDWARE AND SOFTWARE REQUIREMENTS:
- A computer or mobile device with internet access
- A current web browser (Chrome, Firefox, Safari, Edge)
- Ability to download and save PDF documents

You have the right to:
- Withdraw your consent at any time
- Request paper copies of any document
- Update your contact information`,
          regulatoryReference: "E-Sign Act",
          isActive: true,
        },
        {
          consentType: "privacy_policy",
          version: "1.0",
          title: "Privacy Policy Acknowledgment",
          shortDescription: "Acknowledgment of privacy practices and data handling",
          effectiveDate: new Date(),
          fullText: `PRIVACY POLICY ACKNOWLEDGMENT

We are committed to protecting your personal information. This notice explains how we collect, use, and safeguard your data.

INFORMATION WE COLLECT:
- Personal identification information (name, SSN, date of birth)
- Financial information (income, assets, debts)
- Employment information
- Property information

HOW WE USE YOUR INFORMATION:
- To process your mortgage application
- To verify your identity and financial information
- To comply with legal and regulatory requirements
- To communicate with you about your application

YOUR RIGHTS:
- Access your personal information
- Request correction of inaccurate information
- Opt out of certain data sharing
- Request deletion of your information (subject to legal requirements)`,
          regulatoryReference: "GLBA",
          isActive: true,
        },
        {
          consentType: "fcra_disclosure",
          version: "1.0",
          title: "Fair Credit Reporting Act Disclosure",
          shortDescription: "FCRA rights and responsibilities disclosure",
          effectiveDate: new Date(),
          fullText: `FAIR CREDIT REPORTING ACT DISCLOSURE

Under the Fair Credit Reporting Act (FCRA), you have specific rights regarding the use of your credit information:

YOUR RIGHTS:
1. You have the right to know what is in your file
2. You have the right to dispute incomplete or inaccurate information
3. Consumer reporting agencies must correct or delete inaccurate information
4. You can limit prescreened offers of credit and insurance
5. You can seek damages from violators

ADVERSE ACTION NOTICE:
If we take adverse action based on information in your credit report, we will provide you with a notice containing:
- The name and contact information of the credit bureau
- A statement that the bureau did not make the decision
- Your right to obtain a free copy of your credit report
- Your right to dispute the accuracy of the report

For more information, visit www.consumerfinance.gov/learnmore`,
          regulatoryReference: "FCRA Section 615",
          isActive: true,
        },
      ];

      for (const template of templates) {
        await db.insert(consentTemplates).values(template);
      }
      console.log(`Seeded ${templates.length} consent templates`);
    }

    console.log("Seeding partner providers...");
    const existingProviders = await db.select().from(partnerProviders).limit(1);
    if (existingProviders.length === 0) {
      const providers = [
        {
          name: "CoreLogic Credit",
          code: "corelogic_credit",
          serviceType: "credit_report",
          apiEndpoint: "https://api.corelogic.com/credit",
          baseFee: "35.00",
          expectedTurnaroundHours: 1,
          isActive: true,
          isTestMode: true,
        },
        {
          name: "Experian Mortgage",
          code: "experian_mortgage",
          serviceType: "credit_report",
          apiEndpoint: "https://api.experian.com/mortgage",
          baseFee: "42.00",
          expectedTurnaroundHours: 2,
          isActive: true,
          isTestMode: true,
        },
        {
          name: "First American Title",
          code: "first_american",
          serviceType: "title_search",
          apiEndpoint: "https://api.firstam.com/title",
          baseFee: "350.00",
          expectedTurnaroundHours: 72,
          isActive: true,
          isTestMode: true,
        },
        {
          name: "Stewart Title",
          code: "stewart_title",
          serviceType: "title_search",
          apiEndpoint: "https://api.stewart.com/title",
          baseFee: "375.00",
          expectedTurnaroundHours: 48,
          isActive: true,
          isTestMode: true,
        },
        {
          name: "CoreLogic Appraisal",
          code: "corelogic_appraisal",
          serviceType: "appraisal",
          apiEndpoint: "https://api.corelogic.com/appraisal",
          baseFee: "550.00",
          expectedTurnaroundHours: 168,
          isActive: true,
          isTestMode: true,
        },
        {
          name: "LANDATA Appraisal",
          code: "landata_appraisal",
          serviceType: "appraisal",
          apiEndpoint: "https://api.landata.com/appraisal",
          baseFee: "495.00",
          expectedTurnaroundHours: 120,
          isActive: true,
          isTestMode: true,
        },
        {
          name: "CoreLogic Flood",
          code: "corelogic_flood",
          serviceType: "flood_cert",
          apiEndpoint: "https://api.corelogic.com/flood",
          baseFee: "18.00",
          expectedTurnaroundHours: 1,
          isActive: true,
          isTestMode: true,
        },
      ];

      for (const provider of providers) {
        await db.insert(partnerProviders).values(provider);
      }
      console.log(`Seeded ${providers.length} partner providers`);
    }

    const existingRates = await db.select({ id: mortgageRates.id }).from(mortgageRates).limit(1);
    if (existingRates.length === 0) {
      console.log("Seeding mortgage rates...");
      try {
        const result = await refreshRates();
        console.log(`Seeded ${result.count} mortgage rates (source: ${result.source})`);
      } catch (err) {
        console.error("Rate seeding error:", err);
      }
    }

    const existingProperties = await db.select({ id: properties.id }).from(properties).limit(1);
    if (existingProperties.length === 0) {
      console.log("Seeding sample properties...");

      const sampleProperties = [
        {
          address: "142 Maple Lane",
          city: "Austin",
          state: "TX",
          zipCode: "78701",
          price: "485000.00",
          propertyType: "single_family",
          bedrooms: 3,
          bathrooms: "2.0",
          squareFeet: 1850,
          lotSize: "6500.00",
          yearBuilt: 2018,
          description: "Modern single-family home in a desirable Austin neighborhood. Features an open floor plan, quartz countertops, stainless steel appliances, and a spacious backyard with mature trees. Walking distance to parks and local shops.",
          features: ["Open Floor Plan", "Quartz Countertops", "Stainless Appliances", "Hardwood Floors", "Smart Thermostat", "Two-Car Garage"],
          status: "active",
          listedAt: new Date("2025-12-15"),
        },
        {
          address: "2801 Ocean Drive, Unit 14B",
          city: "Miami",
          state: "FL",
          zipCode: "33139",
          price: "729000.00",
          propertyType: "condo",
          bedrooms: 2,
          bathrooms: "2.5",
          squareFeet: 1420,
          lotSize: "0.00",
          yearBuilt: 2021,
          description: "Luxury waterfront condo with panoramic ocean views from a private balcony. Building amenities include rooftop pool, fitness center, concierge, and secured parking. Hurricane-impact windows throughout.",
          features: ["Ocean View", "Balcony", "Rooftop Pool", "Fitness Center", "Concierge", "Impact Windows", "Secured Parking"],
          status: "active",
          listedAt: new Date("2026-01-05"),
        },
        {
          address: "567 Birchwood Circle",
          city: "Raleigh",
          state: "NC",
          zipCode: "27607",
          price: "375000.00",
          propertyType: "single_family",
          bedrooms: 4,
          bathrooms: "2.5",
          squareFeet: 2200,
          lotSize: "8200.00",
          yearBuilt: 2015,
          description: "Spacious 4-bedroom family home in a top-rated school district. Features a chef's kitchen with island, primary suite with walk-in closet, and a finished bonus room. Fenced backyard with patio.",
          features: ["Chef's Kitchen", "Kitchen Island", "Primary Suite", "Walk-In Closet", "Bonus Room", "Fenced Yard", "Patio"],
          status: "active",
          listedAt: new Date("2026-01-10"),
        },
        {
          address: "89 Summit Ridge Way",
          city: "Denver",
          state: "CO",
          zipCode: "80202",
          price: "620000.00",
          propertyType: "townhouse",
          bedrooms: 3,
          bathrooms: "3.0",
          squareFeet: 2050,
          lotSize: "2400.00",
          yearBuilt: 2022,
          description: "Contemporary townhome with mountain views and rooftop terrace. Three levels of living space with high ceilings, energy-efficient design, and an attached two-car garage. Minutes from downtown dining and trails.",
          features: ["Mountain Views", "Rooftop Terrace", "High Ceilings", "Energy Efficient", "Two-Car Garage", "Modern Finishes"],
          status: "active",
          listedAt: new Date("2026-01-20"),
        },
        {
          address: "1204 Willow Creek Drive",
          city: "Charlotte",
          state: "NC",
          zipCode: "28277",
          price: "445000.00",
          propertyType: "single_family",
          bedrooms: 4,
          bathrooms: "3.0",
          squareFeet: 2650,
          lotSize: "10500.00",
          yearBuilt: 2019,
          description: "Beautiful two-story home in a master-planned community with pool and clubhouse. Open-concept living with a gourmet kitchen, home office, and large owner's suite. Three-car garage and irrigation system.",
          features: ["Community Pool", "Clubhouse", "Gourmet Kitchen", "Home Office", "Owner's Suite", "Three-Car Garage", "Irrigation"],
          status: "active",
          listedAt: new Date("2025-11-28"),
        },
        {
          address: "3150 Lake Shore Blvd, Unit 8C",
          city: "Chicago",
          state: "IL",
          zipCode: "60657",
          price: "550000.00",
          propertyType: "condo",
          bedrooms: 2,
          bathrooms: "2.0",
          squareFeet: 1280,
          lotSize: "0.00",
          yearBuilt: 2017,
          description: "Stunning lakefront condo with floor-to-ceiling windows and skyline views. In-unit laundry, custom built-ins, and a chef's kitchen with waterfall island. Full-amenity building with doorman.",
          features: ["Lake Views", "Floor-to-Ceiling Windows", "In-Unit Laundry", "Custom Built-Ins", "Waterfall Island", "Doorman"],
          status: "active",
          listedAt: new Date("2026-01-15"),
        },
        {
          address: "782 Sagebrush Trail",
          city: "Phoenix",
          state: "AZ",
          zipCode: "85016",
          price: "399000.00",
          propertyType: "single_family",
          bedrooms: 3,
          bathrooms: "2.0",
          squareFeet: 1780,
          lotSize: "7800.00",
          yearBuilt: 2020,
          description: "Desert modern home with a resort-style backyard featuring a heated pool and built-in grill. Split floor plan with tile throughout, plantation shutters, and a three-car garage with epoxy floors.",
          features: ["Heated Pool", "Built-In Grill", "Split Floor Plan", "Plantation Shutters", "Three-Car Garage", "Desert Landscaping"],
          status: "active",
          listedAt: new Date("2026-02-01"),
        },
        {
          address: "45 Cobblestone Court",
          city: "Nashville",
          state: "TN",
          zipCode: "37215",
          price: "525000.00",
          propertyType: "townhouse",
          bedrooms: 3,
          bathrooms: "2.5",
          squareFeet: 1920,
          lotSize: "1800.00",
          yearBuilt: 2023,
          description: "Brand-new luxury townhome in the heart of Nashville. Premium finishes including marble counters, custom cabinetry, and wide-plank hardwood floors. Private courtyard and rooftop deck with city views.",
          features: ["Marble Counters", "Custom Cabinetry", "Wide-Plank Hardwood", "Private Courtyard", "Rooftop Deck", "City Views"],
          status: "active",
          listedAt: new Date("2026-01-25"),
        },
        {
          address: "1600 Peachtree Street NE, Unit 32A",
          city: "Atlanta",
          state: "GA",
          zipCode: "30309",
          price: "475000.00",
          propertyType: "condo",
          bedrooms: 2,
          bathrooms: "2.0",
          squareFeet: 1350,
          lotSize: "0.00",
          yearBuilt: 2020,
          description: "High-rise luxury condo in Midtown Atlanta with a wrap-around balcony. Resort-style amenities include an infinity pool, sky lounge, and co-working space. Steps from Piedmont Park and MARTA.",
          features: ["Wrap-Around Balcony", "Infinity Pool", "Sky Lounge", "Co-Working Space", "Near MARTA", "Pet-Friendly"],
          status: "active",
          listedAt: new Date("2026-02-05"),
        },
        {
          address: "210 Heritage Oak Lane",
          city: "San Antonio",
          state: "TX",
          zipCode: "78258",
          price: "340000.00",
          propertyType: "single_family",
          bedrooms: 4,
          bathrooms: "2.5",
          squareFeet: 2400,
          lotSize: "9000.00",
          yearBuilt: 2016,
          description: "Family-friendly home in a sought-after subdivision with community parks and trails. Features a media room, covered patio, and upgraded kitchen with granite counters. Excellent schools nearby.",
          features: ["Media Room", "Covered Patio", "Granite Counters", "Community Parks", "Walking Trails", "Top Schools"],
          status: "active",
          listedAt: new Date("2025-12-20"),
        },
        {
          address: "9025 Coastal Highway",
          city: "Virginia Beach",
          state: "VA",
          zipCode: "23451",
          price: "695000.00",
          propertyType: "single_family",
          bedrooms: 5,
          bathrooms: "3.5",
          squareFeet: 3200,
          lotSize: "12000.00",
          yearBuilt: 2014,
          description: "Stunning coastal home two blocks from the beach. Large open-concept living with cathedral ceilings, a screened porch, and outdoor shower. Separate guest suite and ample storage. No flood zone.",
          features: ["Near Beach", "Cathedral Ceilings", "Screened Porch", "Outdoor Shower", "Guest Suite", "No Flood Zone"],
          status: "active",
          listedAt: new Date("2026-01-08"),
        },
        {
          address: "4412 Elm Park Drive",
          city: "Minneapolis",
          state: "MN",
          zipCode: "55410",
          price: "425000.00",
          propertyType: "single_family",
          bedrooms: 3,
          bathrooms: "2.0",
          squareFeet: 1950,
          lotSize: "7200.00",
          yearBuilt: 2011,
          description: "Charming renovated craftsman near the Chain of Lakes. Original hardwood floors with modern updates including a gourmet kitchen, spa-like primary bath, and finished basement. Detached two-car garage.",
          features: ["Renovated Craftsman", "Original Hardwood", "Gourmet Kitchen", "Spa Primary Bath", "Finished Basement", "Detached Garage"],
          status: "active",
          listedAt: new Date("2026-01-18"),
        },
      ];

      for (const prop of sampleProperties) {
        await db.insert(properties).values(prop);
      }
      console.log(`Seeded ${sampleProperties.length} sample properties`);
    }

    console.log("Database seeded successfully");
  } catch (error) {
    console.error("Seed error:", error);
  }
}
