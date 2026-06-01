import type { IStorage } from "../storage";
import { calculateLLPA } from "../pricing";
import type { RateSheetProduct, LenderPricingAdjustment, WholesaleLender } from "@shared/schema";

export interface BorrowerPricingProfile {
  creditScore: number;
  loanAmount: number;
  propertyValue: number;
  propertyType?: "single_family" | "condo" | "townhouse" | "multi_family";
  occupancyType?: "primary_residence" | "second_home" | "investment";
  loanPurpose?: "purchase" | "refinance" | "cash_out_refinance";
  isFirstTimeHomeBuyer?: boolean;
  borrowerIncome?: number;
  areaMedianIncome?: number;
  lockTermDays?: number;
  productTypes?: string[];
  lenderIds?: string[];
}

export interface ComputedOffer {
  lenderName: string;
  lenderCode: string;
  lenderId: string;
  productId: string;
  productCode: string;
  productName: string;
  productType: string;
  loanTerm: number;
  amortizationType: string | null;
  baseRate: number;
  adjustedRate: number;
  lockTerm: number;
  pricingBreakdown: {
    baseRate: number;
    llpaAdjustment: number;
    lockTermAdjustment: number;
    lenderAdjustments: { name: string; value: number }[];
    totalAdjustments: number;
    finalRate: number;
  };
  estimatedMonthlyPI: number;
  estimatedMonthlyMI: number;
  estimatedMonthlyTotal: number;
  lenderFees: RateSheetProduct["lenderFees"];
  eligibilityConstraints: RateSheetProduct["eligibilityConstraints"];
  labels: string[];
}

function calculateMonthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (annualRate <= 0) return principal / termMonths;
  const monthlyRate = annualRate / 100 / 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
}

function checkEligibility(product: RateSheetProduct, profile: BorrowerPricingProfile): boolean {
  const constraints = product.eligibilityConstraints as any;
  if (!constraints) return true;

  const ltv = (profile.loanAmount / profile.propertyValue) * 100;

  if (constraints.minLoanAmount && profile.loanAmount < constraints.minLoanAmount) return false;
  if (constraints.maxLoanAmount && profile.loanAmount > constraints.maxLoanAmount) return false;
  if (constraints.minCreditScore && profile.creditScore < constraints.minCreditScore) return false;
  if (constraints.maxLTV && ltv > constraints.maxLTV) return false;
  if (constraints.maxDTI) { /* DTI not in profile, skip */ }
  if (constraints.occupancyTypes?.length) {
    const occ = profile.occupancyType || "primary_residence";
    if (!constraints.occupancyTypes.includes(occ.toUpperCase()) &&
        !constraints.occupancyTypes.includes(occ)) return false;
  }
  if (constraints.propertyTypes?.length) {
    const pt = profile.propertyType || "single_family";
    if (!constraints.propertyTypes.includes(pt.toUpperCase()) &&
        !constraints.propertyTypes.includes(pt)) return false;
  }
  return true;
}

function matchLenderAdjustments(
  adjustments: LenderPricingAdjustment[],
  profile: BorrowerPricingProfile,
): { name: string; value: number }[] {
  const ltv = (profile.loanAmount / profile.propertyValue) * 100;
  const matched: { name: string; value: number }[] = [];

  for (const adj of adjustments) {
    const cond = adj.condition as any;
    if (!cond) continue;

    let applies = true;
    if (cond.creditScoreMin !== undefined && profile.creditScore < cond.creditScoreMin) applies = false;
    if (cond.creditScoreMax !== undefined && profile.creditScore > cond.creditScoreMax) applies = false;
    if (cond.ltvMin !== undefined && ltv < cond.ltvMin) applies = false;
    if (cond.ltvMax !== undefined && ltv > cond.ltvMax) applies = false;
    if (cond.occupancy && profile.occupancyType && cond.occupancy !== profile.occupancyType) applies = false;
    if (cond.propertyType && profile.propertyType && cond.propertyType !== profile.propertyType) applies = false;
    if (cond.loanPurpose && profile.loanPurpose && cond.loanPurpose !== profile.loanPurpose) applies = false;

    if (applies) {
      matched.push({
        name: adj.adjustmentName,
        value: parseFloat(adj.adjustmentValue),
      });
    }
  }
  return matched;
}

export async function computeOffers(
  storage: IStorage,
  profile: BorrowerPricingProfile,
): Promise<ComputedOffer[]> {
  const ltv = (profile.loanAmount / profile.propertyValue) * 100;
  const lockTerm = profile.lockTermDays || 30;

  const activeSheets = await storage.getActiveRateSheets();
  if (activeSheets.length === 0) return [];

  const activeLenders = await storage.getWholesaleLenders({ status: "ACTIVE" });
  const lenderMap = new Map<string, WholesaleLender>();
  for (const l of activeLenders) lenderMap.set(l.id, l);

  const llpaResult = calculateLLPA(
    profile.loanAmount,
    profile.creditScore,
    ltv,
    profile.propertyType || "single_family",
    profile.occupancyType || "primary_residence",
    profile.isFirstTimeHomeBuyer || false,
    profile.borrowerIncome || 0,
    profile.areaMedianIncome || 0,
  );

  const offers: ComputedOffer[] = [];

  for (const sheet of activeSheets) {
    const lender = lenderMap.get(sheet.lenderId);
    if (!lender) continue;

    if (profile.lenderIds?.length && !profile.lenderIds.includes(lender.id)) continue;

    const products = await storage.getRateSheetProducts(sheet.id);
    const lenderAdjustments = await storage.getLenderPricingAdjustments({ lenderId: lender.id });

    for (const product of products) {
      if (profile.productTypes?.length && !profile.productTypes.includes(product.productType)) continue;

      if (!checkEligibility(product, profile)) continue;

      const baseRate = parseFloat(product.baseRate);

      let lockAdj = 0;
      const lockAdjMap = product.lockTermAdjustments as Record<string, number> | null;
      if (lockAdjMap) {
        lockAdj = lockAdjMap[String(lockTerm)] ?? 0;
      }

      const matchedAdj = matchLenderAdjustments(lenderAdjustments, profile);
      const totalLenderAdj = matchedAdj.reduce((sum, a) => sum + a.value, 0);

      const llpaAdj = llpaResult.totalLLPA / 100;

      const adjustedRate = baseRate + llpaAdj + lockAdj + totalLenderAdj;
      const totalAdjustments = llpaAdj + lockAdj + totalLenderAdj;

      const monthlyPI = calculateMonthlyPayment(profile.loanAmount, adjustedRate, product.loanTerm);

      let monthlyMI = 0;
      if (ltv > 80) {
        const pmiRate = 0.6;
        monthlyMI = (profile.loanAmount * pmiRate) / 12 / 100;
      }

      offers.push({
        lenderName: lender.lenderName,
        lenderCode: lender.lenderCode,
        lenderId: lender.id,
        productId: product.id,
        productCode: product.productCode,
        productName: product.productName,
        productType: product.productType,
        loanTerm: product.loanTerm,
        amortizationType: product.amortizationType,
        baseRate,
        adjustedRate: Math.round(adjustedRate * 10000) / 10000,
        lockTerm,
        pricingBreakdown: {
          baseRate,
          llpaAdjustment: Math.round(llpaAdj * 10000) / 10000,
          lockTermAdjustment: lockAdj,
          lenderAdjustments: matchedAdj,
          totalAdjustments: Math.round(totalAdjustments * 10000) / 10000,
          finalRate: Math.round(adjustedRate * 10000) / 10000,
        },
        estimatedMonthlyPI: Math.round(monthlyPI * 100) / 100,
        estimatedMonthlyMI: Math.round(monthlyMI * 100) / 100,
        estimatedMonthlyTotal: Math.round((monthlyPI + monthlyMI) * 100) / 100,
        lenderFees: product.lenderFees as any,
        eligibilityConstraints: product.eligibilityConstraints as any,
        labels: [],
      });
    }
  }

  offers.sort((a, b) => a.adjustedRate - b.adjustedRate);

  if (offers.length > 0) {
    offers[0].labels.push("LOWEST_RATE");

    const byPayment = [...offers].sort((a, b) => a.estimatedMonthlyTotal - b.estimatedMonthlyTotal);
    if (byPayment[0]) {
      const lowest = offers.find(o => o.productId === byPayment[0].productId && o.lenderId === byPayment[0].lenderId);
      if (lowest && !lowest.labels.includes("LOWEST_RATE")) {
        lowest.labels.push("LOWEST_PAYMENT");
      }
    }
  }

  return offers;
}
