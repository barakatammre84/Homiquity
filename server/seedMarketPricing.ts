import { and, eq, lte, inArray } from "drizzle-orm";
import { db } from "./db";
import { wholesaleLenders, rateSheets, rateSheetProducts, lenderPricingAdjustments } from "@shared/schema";

// =============================================================================
// MARKET PRICING SAMPLE DATA (demo-grade, vendor-shaped)
//
// Seeds the SAME tables a live pricing vendor will populate: wholesale lenders,
// dated rate sheets, per-product base rates with lock-term grids, and lender
// overlay adjustments. pricingAdapter.computeOffers() reads these tables on
// every request, so swapping this sample data for a vendor feed (API pull or
// sheet upload via POST /api/rate-sheets + /products/bulk) changes what
// borrowers see with zero code changes.
//
// Lender names are fictional. Rates are plausible market levels, not quotes.
// Rate sheets are seeded with a 90-day validity window from seed date; expired
// demo sheets simply stop pricing (same behavior as a stale vendor sheet).
// =============================================================================

function isoDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}

const STANDARD_LOCK_GRID = { "15": -0.125, "30": 0, "45": 0.125, "60": 0.25 };
const CONFORMING_LIMIT = 806500; // FHFA 2026 baseline, one-unit

// Demo sheets carry this version so the refresher can find them without ever
// touching a real vendor sheet (which uses any other version string).
const DEMO_SHEET_VERSION = "1.0-demo";
const DEMO_WINDOW_DAYS = 90;
// Refresh a demo sheet once it's within this many days of expiring (or expired).
const REFRESH_WHEN_WITHIN_DAYS = 14;

export async function seedMarketPricing(): Promise<void> {
  const existing = await db
    .select({ id: wholesaleLenders.id })
    .from(wholesaleLenders)
    .where(eq(wholesaleLenders.lenderCode, "SWL"))
    .limit(1);
  if (existing.length > 0) {
    // Already seeded — but a 90-day window seeded once silently expires, and an
    // expired sheet makes best-execution pricing return "no products". Roll the
    // demo window forward so the storefront keeps quoting until a real vendor
    // sheet replaces it.
    await refreshDemoRateSheets();
    return;
  }

  console.log("Seeding market pricing sample data (wholesale lenders + rate sheets)...");

  const effectiveDate = isoDate(0);
  const expirationDate = isoDate(90);

  // --- Lenders: one per integration tier to demo the vendor-onboarding story.
  const [summit] = await db.insert(wholesaleLenders).values({
    lenderId: "SAMPLE-SUMMIT-001",
    lenderName: "Summit Wholesale Lending",
    lenderCode: "SWL",
    primaryContact: "Demo Account Team",
    contactEmail: "demo@summitwholesale.example",
    integrationTier: "API",
    apiConfig: {
      baseUrl: "https://api.summitwholesale.example/v1",
      authType: "API_KEY",
      endpoints: { pricing: "/pricing/quote", lock: "/locks", productEligibility: "/eligibility" },
    },
    capabilities: {
      productTypes: ["CONVENTIONAL", "FHA", "VA"],
      occupancyTypes: ["PRIMARY_RESIDENCE", "SECOND_HOME"],
      statesLicensed: ["CA", "TX", "FL", "NY", "WA", "CO", "AZ", "NC", "GA", "MN"],
      minLoanAmount: 100000,
      maxLoanAmount: CONFORMING_LIMIT,
      minCreditScore: 620,
    },
    brokerCompensation: { compensationType: "LENDER_PAID", defaultBps: 200, minBps: 100, maxBps: 275 },
    status: "ACTIVE",
    isPreferred: true,
  }).returning();

  const [blueriver] = await db.insert(wholesaleLenders).values({
    lenderId: "SAMPLE-BLUERIVER-001",
    lenderName: "BlueRiver Capital Markets",
    lenderCode: "BRC",
    primaryContact: "Demo Account Team",
    contactEmail: "demo@blueriver.example",
    integrationTier: "PORTAL",
    capabilities: {
      productTypes: ["CONVENTIONAL", "JUMBO"],
      occupancyTypes: ["PRIMARY_RESIDENCE", "SECOND_HOME", "INVESTMENT"],
      statesLicensed: ["CA", "TX", "FL", "NY", "WA", "CO", "IL", "MA"],
      minLoanAmount: 150000,
      maxLoanAmount: 3000000,
      minCreditScore: 660,
    },
    brokerCompensation: { compensationType: "EITHER", defaultBps: 175, minBps: 100, maxBps: 250 },
    status: "ACTIVE",
    isPreferred: false,
  }).returning();

  const [atlas] = await db.insert(wholesaleLenders).values({
    lenderId: "SAMPLE-ATLAS-001",
    lenderName: "Atlas Home Funding",
    lenderCode: "AHF",
    primaryContact: "Demo Account Team",
    contactEmail: "demo@atlashomefunding.example",
    integrationTier: "MANUAL",
    capabilities: {
      productTypes: ["CONVENTIONAL", "FHA", "VA"],
      occupancyTypes: ["PRIMARY_RESIDENCE"],
      statesLicensed: ["CA", "TX", "FL", "AZ", "NV", "OR", "UT", "NM", "MN", "NC"],
      minLoanAmount: 75000,
      maxLoanAmount: CONFORMING_LIMIT,
      minCreditScore: 580,
    },
    brokerCompensation: { compensationType: "LENDER_PAID", defaultBps: 225, minBps: 150, maxBps: 275 },
    status: "ACTIVE",
    isPreferred: false,
  }).returning();

  // --- One active, dated rate sheet per lender (what a vendor feed refreshes daily).
  const [summitSheet] = await db.insert(rateSheets).values({
    sheetId: `SWL-${effectiveDate}-DEMO`,
    lenderId: summit.id,
    version: "1.0-demo",
    effectiveDate,
    expirationDate,
    uploadMethod: "API",
    sourceFileName: "summit-demo-feed.json",
    productTypes: ["CONVENTIONAL", "FHA", "VA"],
    lockTerms: [15, 30, 45, 60],
    status: "ACTIVE",
  }).returning();

  const [blueriverSheet] = await db.insert(rateSheets).values({
    sheetId: `BRC-${effectiveDate}-DEMO`,
    lenderId: blueriver.id,
    version: "1.0-demo",
    effectiveDate,
    expirationDate,
    uploadMethod: "PORTAL",
    sourceFileName: "blueriver-demo-sheet.pdf",
    productTypes: ["CONVENTIONAL", "JUMBO"],
    lockTerms: [15, 30, 45, 60],
    status: "ACTIVE",
  }).returning();

  const [atlasSheet] = await db.insert(rateSheets).values({
    sheetId: `AHF-${effectiveDate}-DEMO`,
    lenderId: atlas.id,
    version: "1.0-demo",
    effectiveDate,
    expirationDate,
    uploadMethod: "MANUAL",
    sourceFileName: "atlas-demo-sheet.xlsx",
    productTypes: ["CONVENTIONAL", "FHA", "VA", "ARM"],
    lockTerms: [15, 30, 45],
    status: "ACTIVE",
  }).returning();

  // --- Products. Eligibility values are matched (case-tolerantly) by
  // pricingAdapter.checkEligibility against the borrower profile.
  const conformingEligibility = {
    minLoanAmount: 100000,
    maxLoanAmount: CONFORMING_LIMIT,
    minCreditScore: 620,
    maxLTV: 97,
    occupancyTypes: ["PRIMARY_RESIDENCE", "SECOND_HOME"],
    propertyTypes: ["SINGLE_FAMILY", "CONDO", "TOWNHOUSE"],
  };
  const standardFees = {
    originationFee: 1095,
    underwritingFee: 995,
    processingFee: 495,
    floodCertFee: 12,
    appraisalFee: 650,
  };

  const products = [
    // Summit — mid-market rates, full agency menu
    { rateSheetId: summitSheet.id, productCode: "SWL-C30", productName: "Conforming 30-Year Fixed", productType: "CONVENTIONAL", loanTerm: 360, baseRate: "6.6250", eligibilityConstraints: conformingEligibility },
    { rateSheetId: summitSheet.id, productCode: "SWL-C15", productName: "Conforming 15-Year Fixed", productType: "CONVENTIONAL", loanTerm: 180, baseRate: "5.8750", eligibilityConstraints: conformingEligibility },
    { rateSheetId: summitSheet.id, productCode: "SWL-F30", productName: "FHA 30-Year Fixed", productType: "FHA", loanTerm: 360, baseRate: "6.2500", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 580, maxLTV: 96.5 } },
    { rateSheetId: summitSheet.id, productCode: "SWL-V30", productName: "VA 30-Year Fixed", productType: "VA", loanTerm: 360, baseRate: "6.1250", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 580, maxLTV: 100 } },
    // BlueRiver — sharpest conforming rate, tighter box; jumbo coverage
    { rateSheetId: blueriverSheet.id, productCode: "BRC-C30", productName: "Conforming 30-Year Fixed", productType: "CONVENTIONAL", loanTerm: 360, baseRate: "6.5000", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 680, maxLTV: 95 } },
    { rateSheetId: blueriverSheet.id, productCode: "BRC-C15", productName: "Conforming 15-Year Fixed", productType: "CONVENTIONAL", loanTerm: 180, baseRate: "5.7500", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 680, maxLTV: 95 } },
    { rateSheetId: blueriverSheet.id, productCode: "BRC-J30", productName: "Jumbo 30-Year Fixed", productType: "JUMBO", loanTerm: 360, baseRate: "6.8750", eligibilityConstraints: { minLoanAmount: CONFORMING_LIMIT + 1, maxLoanAmount: 3000000, minCreditScore: 700, maxLTV: 89.99, occupancyTypes: ["PRIMARY_RESIDENCE", "SECOND_HOME"], propertyTypes: ["SINGLE_FAMILY", "CONDO", "TOWNHOUSE"] } },
    // Atlas — widest credit box, slightly higher rates; ARM option
    { rateSheetId: atlasSheet.id, productCode: "AHF-C30", productName: "Conforming 30-Year Fixed", productType: "CONVENTIONAL", loanTerm: 360, baseRate: "6.7500", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 600, occupancyTypes: ["PRIMARY_RESIDENCE"] } },
    { rateSheetId: atlasSheet.id, productCode: "AHF-F30", productName: "FHA 30-Year Fixed", productType: "FHA", loanTerm: 360, baseRate: "6.3750", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 580, maxLTV: 96.5, occupancyTypes: ["PRIMARY_RESIDENCE"] } },
    { rateSheetId: atlasSheet.id, productCode: "AHF-V30", productName: "VA 30-Year Fixed", productType: "VA", loanTerm: 360, baseRate: "6.2500", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 580, maxLTV: 100, occupancyTypes: ["PRIMARY_RESIDENCE"] } },
    { rateSheetId: atlasSheet.id, productCode: "AHF-A56", productName: "5/6 ARM (30-Year Term)", productType: "ARM", loanTerm: 360, baseRate: "5.9900", amortizationType: "ARM", eligibilityConstraints: { ...conformingEligibility, minCreditScore: 640, maxLTV: 90, occupancyTypes: ["PRIMARY_RESIDENCE"] } },
  ];

  for (const p of products) {
    await db.insert(rateSheetProducts).values({
      amortizationType: "FIXED",
      ...p,
      lockTermAdjustments: STANDARD_LOCK_GRID,
      pointsGrid: [
        { rate: parseFloat(p.baseRate) - 0.25, points: 1.0, rebate: 0 },
        { rate: parseFloat(p.baseRate), points: 0, rebate: 0 },
        { rate: parseFloat(p.baseRate) + 0.25, points: 0, rebate: 0.75 },
      ],
      lenderFees: standardFees,
    });
  }

  // --- Lender overlay adjustments (rate, in points of rate, not price):
  // what makes each lender's final rate differ per borrower profile.
  const adjustments = [
    { lenderId: summit.id, rateSheetId: summitSheet.id, adjustmentType: "CREDIT_OVERLAY", adjustmentName: "FICO 620-659 with LTV > 80%", condition: { creditScoreMin: 620, creditScoreMax: 659, ltvMin: 80.01 }, adjustmentValue: "0.3750", guidelineReference: "SWL overlay matrix §2.1" },
    { lenderId: summit.id, rateSheetId: summitSheet.id, adjustmentType: "PROMO", adjustmentName: "Preferred-partner rate credit", condition: { creditScoreMin: 740, ltvMax: 80 }, adjustmentValue: "-0.1250", guidelineReference: "SWL broker bulletin 2026-03" },
    { lenderId: blueriver.id, rateSheetId: blueriverSheet.id, adjustmentType: "OCCUPANCY", adjustmentName: "Investment property", condition: { occupancy: "investment" }, adjustmentValue: "0.5000", guidelineReference: "BRC guide §4.3" },
    { lenderId: blueriver.id, rateSheetId: blueriverSheet.id, adjustmentType: "PROMO", adjustmentName: "First-time homebuyer credit", condition: { loanPurpose: "purchase", creditScoreMin: 700 }, adjustmentValue: "-0.1250", guidelineReference: "BRC FTHB program 2026" },
    { lenderId: atlas.id, rateSheetId: atlasSheet.id, adjustmentType: "CREDIT_OVERLAY", adjustmentName: "FICO below 640", condition: { creditScoreMax: 639 }, adjustmentValue: "0.5000", guidelineReference: "AHF overlay grid rev. 7" },
    { lenderId: atlas.id, rateSheetId: atlasSheet.id, adjustmentType: "LTV_OVERLAY", adjustmentName: "LTV above 95%", condition: { ltvMin: 95.01 }, adjustmentValue: "0.2500", guidelineReference: "AHF overlay grid rev. 7" },
  ];

  for (const adj of adjustments) {
    await db.insert(lenderPricingAdjustments).values({
      ...adj,
      isStackable: true,
      effectiveDate,
      expirationDate,
    });
  }

  console.log(`Seeded ${products.length} rate-sheet products across 3 sample wholesale lenders`);
}

/**
 * Roll the clearly-marked demo rate sheets (version "1.0-demo") forward to a
 * fresh 90-day window whenever they're at or near expiry, keeping best-execution
 * pricing alive in production. Only demo sheets are matched by version, so a
 * real vendor sheet uploaded via POST /api/rate-sheets is never modified.
 */
async function refreshDemoRateSheets(): Promise<void> {
  const today = isoDate(0);
  const soon = isoDate(REFRESH_WHEN_WITHIN_DAYS);
  const freshExpiration = isoDate(DEMO_WINDOW_DAYS);

  const stale = await db
    .select({ id: rateSheets.id })
    .from(rateSheets)
    .where(and(eq(rateSheets.version, DEMO_SHEET_VERSION), lte(rateSheets.expirationDate, soon)));
  if (stale.length === 0) return;

  await db
    .update(rateSheets)
    .set({ effectiveDate: today, expirationDate: freshExpiration, status: "ACTIVE" })
    .where(and(eq(rateSheets.version, DEMO_SHEET_VERSION), lte(rateSheets.expirationDate, soon)));

  // Keep the demo overlay adjustments aligned to the same window.
  const sheetIds = stale.map((s) => s.id);
  await db
    .update(lenderPricingAdjustments)
    .set({ effectiveDate: today, expirationDate: freshExpiration })
    .where(inArray(lenderPricingAdjustments.rateSheetId, sheetIds));

  console.log(`Refreshed ${stale.length} demo rate sheet(s) to a fresh ${DEMO_WINDOW_DAYS}-day window`);
}
