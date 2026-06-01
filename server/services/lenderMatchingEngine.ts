import { db } from "../db";
import {
  lenderProducts,
  lenderMatchResults,
  type LenderProduct,
  type MatchStatus,
} from "@shared/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { buildBorrowerGraph, type BorrowerGraph } from "./borrowerGraph";
import crypto from "crypto";

interface MatchEvaluation {
  factor: string;
  passed: boolean;
  detail: string;
  severity: "disqualifying" | "conditional" | "info";
}

interface ProductMatch {
  product: LenderProduct;
  status: MatchStatus;
  score: number;
  evaluations: MatchEvaluation[];
  estimatedRate: number | null;
  estimatedMonthlyPayment: number | null;
  estimatedClosingCosts: number | null;
}

function computeSnapshotHash(graph: BorrowerGraph): string {
  const key = JSON.stringify({
    creditScore: graph.eligibility.creditScore,
    dti: graph.eligibility.estimatedDTI,
    ltv: graph.eligibility.estimatedLTV,
    income: graph.bestAnnualIncome,
    debts: graph.totalMonthlyDebts,
    assets: graph.totalVerifiedAssets,
    citizenship: graph.profile.citizenshipStatus,
    military: graph.profile.militaryStatus,
    employment: graph.eligibility.employmentStable,
    reoCount: graph.realEstateOwned.length,
  });
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function evaluateProduct(graph: BorrowerGraph, product: LenderProduct, loanAmount: number | null): ProductMatch {
  const evaluations: MatchEvaluation[] = [];
  const creditScore = graph.eligibility.creditScore;
  const dti = graph.eligibility.estimatedDTI;
  const ltv = graph.eligibility.estimatedLTV;
  const activeApp = graph.applications.find(a => a.id === graph.activeApplicationId);

  if (product.minCreditScore && creditScore !== null) {
    const passed = creditScore >= product.minCreditScore;
    evaluations.push({
      factor: "credit_score",
      passed,
      detail: passed
        ? `Credit score ${creditScore} meets minimum ${product.minCreditScore}`
        : `Credit score ${creditScore} below minimum ${product.minCreditScore}`,
      severity: passed ? "info" : "disqualifying",
    });
  } else if (product.minCreditScore && creditScore === null) {
    evaluations.push({
      factor: "credit_score",
      passed: false,
      detail: "Credit score not available for evaluation",
      severity: "conditional",
    });
  }

  if (product.maxDti && dti !== null) {
    const maxDtiNum = parseFloat(product.maxDti);
    const passed = dti <= maxDtiNum;
    evaluations.push({
      factor: "dti_ratio",
      passed,
      detail: passed
        ? `DTI ${dti}% within maximum ${maxDtiNum}%`
        : `DTI ${dti}% exceeds maximum ${maxDtiNum}%`,
      severity: passed ? "info" : "disqualifying",
    });
  }

  if (product.maxLtv && ltv !== null) {
    const maxLtvNum = parseFloat(product.maxLtv);
    const passed = ltv <= maxLtvNum;
    evaluations.push({
      factor: "ltv_ratio",
      passed,
      detail: passed
        ? `LTV ${ltv}% within maximum ${maxLtvNum}%`
        : `LTV ${ltv}% exceeds maximum ${maxLtvNum}%`,
      severity: passed ? "info" : "disqualifying",
    });
  }

  if (product.minLoanAmount && loanAmount !== null) {
    const minAmt = parseFloat(product.minLoanAmount);
    const passed = loanAmount >= minAmt;
    evaluations.push({
      factor: "loan_amount_min",
      passed,
      detail: passed
        ? `Loan amount $${loanAmount.toLocaleString()} meets minimum $${minAmt.toLocaleString()}`
        : `Loan amount $${loanAmount.toLocaleString()} below minimum $${minAmt.toLocaleString()}`,
      severity: passed ? "info" : "disqualifying",
    });
  }

  if (product.maxLoanAmount && loanAmount !== null) {
    const maxAmt = parseFloat(product.maxLoanAmount);
    const passed = loanAmount <= maxAmt;
    evaluations.push({
      factor: "loan_amount_max",
      passed,
      detail: passed
        ? `Loan amount $${loanAmount.toLocaleString()} within maximum $${maxAmt.toLocaleString()}`
        : `Loan amount $${loanAmount.toLocaleString()} exceeds maximum $${maxAmt.toLocaleString()}`,
      severity: passed ? "info" : "disqualifying",
    });
  }

  if (product.allowedStates && product.allowedStates.length > 0 && activeApp?.propertyState) {
    const passed = product.allowedStates.includes(activeApp.propertyState);
    evaluations.push({
      factor: "property_state",
      passed,
      detail: passed
        ? `Property state ${activeApp.propertyState} is in allowed states`
        : `Property state ${activeApp.propertyState} not in allowed states`,
      severity: passed ? "info" : "disqualifying",
    });
  }

  if (product.excludedStates && product.excludedStates.length > 0 && activeApp?.propertyState) {
    const passed = !product.excludedStates.includes(activeApp.propertyState);
    evaluations.push({
      factor: "excluded_state",
      passed,
      detail: passed
        ? `Property state ${activeApp.propertyState} not in excluded states`
        : `Property state ${activeApp.propertyState} is excluded`,
      severity: passed ? "info" : "disqualifying",
    });
  }

  if (product.occupancyTypes && product.occupancyTypes.length > 0 && activeApp?.propertyType) {
    const passed = product.occupancyTypes.includes(activeApp.propertyType);
    evaluations.push({
      factor: "occupancy_type",
      passed,
      detail: passed
        ? `Property type ${activeApp.propertyType} is eligible`
        : `Property type ${activeApp.propertyType} not eligible for this product`,
      severity: passed ? "info" : "conditional",
    });
  }

  const citizenship = graph.profile.citizenshipStatus;
  if (citizenship === "foreign_national" && !product.allowsForeignNational) {
    evaluations.push({
      factor: "citizenship",
      passed: false,
      detail: "Product does not allow foreign national borrowers",
      severity: "disqualifying",
    });
  }
  if (citizenship === "non_permanent_resident" && !product.allowsNonPermanentResident) {
    evaluations.push({
      factor: "citizenship",
      passed: false,
      detail: "Product does not allow non-permanent resident borrowers",
      severity: "disqualifying",
    });
  }

  if (activeApp?.employmentType === "self_employed" && !product.allowsSelfEmployed) {
    evaluations.push({
      factor: "employment",
      passed: false,
      detail: "Product does not allow self-employed borrowers",
      severity: "disqualifying",
    });
  }

  if (product.veteranOnly && !graph.profile.vaEligible) {
    evaluations.push({
      factor: "veteran_status",
      passed: false,
      detail: "Product requires veteran eligibility",
      severity: "disqualifying",
    });
  }

  if (product.firstTimeBuyerOnly) {
    const isFirstTime = activeApp?.isFirstTimeBuyer || false;
    if (!isFirstTime) {
      evaluations.push({
        factor: "first_time_buyer",
        passed: false,
        detail: "Product requires first-time homebuyer status",
        severity: "disqualifying",
      });
    }
  }

  if (graph.profile.hasBankruptcyHistory && product.bankruptcySeasoningMonths) {
    evaluations.push({
      factor: "bankruptcy_history",
      passed: false,
      detail: `Bankruptcy history detected; requires ${product.bankruptcySeasoningMonths} months seasoning`,
      severity: "conditional",
    });
  }

  if (graph.profile.hasForeclosureHistory && product.foreclosureSeasoningMonths) {
    evaluations.push({
      factor: "foreclosure_history",
      passed: false,
      detail: `Foreclosure history detected; requires ${product.foreclosureSeasoningMonths} months seasoning`,
      severity: "conditional",
    });
  }

  const disqualifying = evaluations.filter(e => !e.passed && e.severity === "disqualifying");
  const conditional = evaluations.filter(e => !e.passed && e.severity === "conditional");
  const passed = evaluations.filter(e => e.passed);

  let status: MatchStatus;
  let score: number;

  if (disqualifying.length > 0) {
    status = "ineligible";
    score = Math.max(0, 100 - disqualifying.length * 30 - conditional.length * 10);
  } else if (conditional.length > 0) {
    status = "conditionally_eligible";
    score = Math.max(40, 100 - conditional.length * 15);
  } else if (evaluations.length === 0) {
    status = "needs_review";
    score = 50;
  } else {
    status = "eligible";
    score = Math.min(100, 60 + passed.length * 5);
  }

  let estimatedRate: number | null = null;
  if (product.baseRate) {
    estimatedRate = parseFloat(product.baseRate);
    if (creditScore) {
      if (creditScore >= 760) estimatedRate -= 0.25;
      else if (creditScore >= 720) estimatedRate -= 0.125;
      else if (creditScore < 680) estimatedRate += 0.25;
      else if (creditScore < 640) estimatedRate += 0.5;
    }
    if (ltv && ltv > 80) estimatedRate += 0.125;
  }

  let estimatedMonthlyPayment: number | null = null;
  if (loanAmount && estimatedRate) {
    const monthlyRate = estimatedRate / 100 / 12;
    const term = 360;
    estimatedMonthlyPayment = Math.round(
      loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, term)) / (Math.pow(1 + monthlyRate, term) - 1)
    );
  }

  let estimatedClosingCosts: number | null = null;
  if (loanAmount) {
    estimatedClosingCosts = Math.round(loanAmount * 0.025);
  }

  return {
    product,
    status,
    score,
    evaluations,
    estimatedRate,
    estimatedMonthlyPayment,
    estimatedClosingCosts,
  };
}

export async function matchBorrowerToLenders(
  userId: string,
  options?: { forceRefresh?: boolean }
): Promise<ProductMatch[]> {
  const graph = await buildBorrowerGraph(userId);
  const snapshotHash = computeSnapshotHash(graph);

  if (!options?.forceRefresh) {
    const [cached] = await db.select({ hash: lenderMatchResults.borrowerSnapshotHash })
      .from(lenderMatchResults)
      .where(and(
        eq(lenderMatchResults.userId, userId),
        eq(lenderMatchResults.borrowerSnapshotHash, snapshotHash),
        gte(lenderMatchResults.expiresAt, sql`now()`)
      ))
      .limit(1);

    if (cached) {
      const cachedResults = await db.select()
        .from(lenderMatchResults)
        .where(and(
          eq(lenderMatchResults.userId, userId),
          eq(lenderMatchResults.borrowerSnapshotHash, snapshotHash)
        ))
        .orderBy(desc(lenderMatchResults.matchScore));

      const products = await db.select().from(lenderProducts)
        .where(eq(lenderProducts.isActive, true));

      const productMap = new Map(products.map(p => [p.id, p]));

      return cachedResults.map(r => ({
        product: productMap.get(r.lenderProductId)!,
        status: r.matchStatus as MatchStatus,
        score: parseFloat(r.matchScore || "0"),
        evaluations: (r.eligibilityDetails as MatchEvaluation[]) || [],
        estimatedRate: r.estimatedRate ? parseFloat(r.estimatedRate) : null,
        estimatedMonthlyPayment: r.estimatedMonthlyPayment ? parseFloat(r.estimatedMonthlyPayment) : null,
        estimatedClosingCosts: r.estimatedClosingCosts ? parseFloat(r.estimatedClosingCosts) : null,
      })).filter(r => r.product);
    }
  }

  const activeProducts = await db.select().from(lenderProducts)
    .where(eq(lenderProducts.isActive, true));

  const activeApp = graph.applications.find(a => a.id === graph.activeApplicationId);
  const loanAmount = activeApp?.purchasePrice && activeApp?.downPayment
    ? activeApp.purchasePrice - activeApp.downPayment
    : null;

  const matches = activeProducts.map(product => evaluateProduct(graph, product, loanAmount));
  matches.sort((a, b) => b.score - a.score);

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (const match of matches) {
    await db.insert(lenderMatchResults).values({
      userId,
      applicationId: graph.activeApplicationId || undefined,
      lenderProductId: match.product.id,
      matchStatus: match.status,
      matchScore: match.score.toFixed(2),
      eligibilityDetails: match.evaluations,
      disqualifyingFactors: match.evaluations.filter(e => e.severity === "disqualifying" && !e.passed),
      conditionalFactors: match.evaluations.filter(e => e.severity === "conditional" && !e.passed),
      estimatedRate: match.estimatedRate?.toFixed(3) || undefined,
      estimatedMonthlyPayment: match.estimatedMonthlyPayment?.toFixed(2) || undefined,
      estimatedClosingCosts: match.estimatedClosingCosts?.toFixed(2) || undefined,
      borrowerSnapshotHash: snapshotHash,
      expiresAt,
    });
  }

  return matches;
}

export async function getTopMatches(userId: string, limit: number = 5): Promise<ProductMatch[]> {
  const matches = await matchBorrowerToLenders(userId);
  return matches
    .filter(m => m.status !== "ineligible")
    .slice(0, limit);
}
