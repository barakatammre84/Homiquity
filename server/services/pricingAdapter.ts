import type { IStorage } from "../storage";
import { calculateLLPA } from "../pricing";
import type { RateSheetProduct, LenderPricingAdjustment, WholesaleLender } from "@shared/schema";
import { monthlyPrincipalAndInterest } from "@shared/lib/amortization";
import { isApprovedLender, isLenderApprovalStatus } from "@shared/wholesaleLenders";
import { offerMonthlyMI } from "./mortgageInsurance";

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
  /**
   * True only when this offer's lender is an APPROVED, non-demo counterparty.
   *
   * Offers are selected on `status: "ACTIVE"`, which is row liveness and not
   * an agreement — so today every quote comes from a seeded demo company.
   * That is fine for a quote and fatal for a sufficiency count: §1026.36(e)(3)(i)
   * measures creditors "with which the originator regularly does business",
   * and the anti-steering option set reads this flag rather than counting
   * lender rows (2026-08-07 audit, F-0807-01).
   */
  lenderApproved: boolean;
}

/** @see {@link monthlyPrincipalAndInterest} — annualRate is a PERCENT here. */
const calculateMonthlyPayment = monthlyPrincipalAndInterest;

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

  const llpaResult = await calculateLLPA(
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
      // A vendor sheet with a null/garbage base rate must not poison the
      // output — skip it rather than emit a NaN rate downstream.
      if (!Number.isFinite(baseRate) || baseRate <= 0) continue;

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
      // Guard against a non-finite adjustment (e.g. a malformed lender rule)
      // producing a bogus final rate.
      if (!Number.isFinite(adjustedRate) || adjustedRate <= 0) continue;

      const monthlyPI = calculateMonthlyPayment(profile.loanAmount, adjustedRate, product.loanTerm);

      // Product-aware MI (F-087): the matrix-resolved conventional PMI this
      // function already computed (llpaResult.pricing), FHA MIP at all LTVs,
      // and none on VA/HELOC — never a flat rate on every product.
      const monthlyMI = offerMonthlyMI({
        productType: product.productType,
        loanAmount: profile.loanAmount,
        ltvPct: ltv,
        conventionalMonthlyPMI: llpaResult.pricing.pmiMonthlyPayment,
      });

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
        // Derived from the shared counterparty rule, never re-hand-rolled:
        // approved AND not a demo row. An unrecognised approval_status falls
        // back to "target", so a typo can never mark an offer deliverable.
        lenderApproved: isApprovedLender({
          lenderId: lender.lenderId,
          lenderName: lender.lenderName,
          approvalStatus: isLenderApprovalStatus(lender.approvalStatus)
            ? lender.approvalStatus
            : "target",
          isDemo: lender.isDemo,
        }),
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
