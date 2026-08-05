import { db } from "../db";
import { storage } from "../storage";
import { getCoachIntakeSnapshots } from "./coachIntake";
import {
  readinessChecklist,
  intentEvents,
  borrowerStateHistory,
  lenderMatchResults,
  lenderProducts,
  anonymizedBorrowerFacts,
  users,
  loanApplications,
  brokerCommissions,
  wholesaleLenders,
  documents,
  pickActiveLoanApplication,
} from "@shared/schema";
import type { BorrowerState, TransitionTrigger } from "@shared/schema";
import { eq, and, sql, gte, lte, desc, lt, isNull, ne, count, avg } from "drizzle-orm";
import { updateReadinessField, getReadinessScore, initializeReadinessChecklist } from "./intentTracker";
import { transitionState, getCurrentState } from "./borrowerStateMachine";
import { buildBorrowerGraph } from "./borrowerGraph";
import { sendNotificationEmail } from "./emailService";
import crypto from "crypto";

const DOCUMENT_FIELD_MAP: Record<string, { fields: Array<{ fieldName: string; sourceField: string }> }> = {
  tax_return: {
    fields: [
      { fieldName: "annual_income", sourceField: "totalIncome" },
      { fieldName: "income_sources", sourceField: "incomeBreakdown" },
      { fieldName: "tax_returns", sourceField: "documentPresence" },
    ],
  },
  pay_stub: {
    fields: [
      { fieldName: "annual_income", sourceField: "grossPay" },
      { fieldName: "employer_name", sourceField: "employerName" },
      { fieldName: "employment_type", sourceField: "payFrequency" },
      { fieldName: "pay_stubs", sourceField: "documentPresence" },
    ],
  },
  bank_statement: {
    fields: [
      { fieldName: "total_assets", sourceField: "totalBalance" },
      { fieldName: "bank_accounts", sourceField: "accounts" },
      { fieldName: "bank_statements", sourceField: "documentPresence" },
      { fieldName: "down_payment_source", sourceField: "accountType" },
    ],
  },
  w2: {
    fields: [
      { fieldName: "annual_income", sourceField: "wagesTipsOtherCompensation" },
      { fieldName: "employer_name", sourceField: "employerName" },
      { fieldName: "w2_forms", sourceField: "documentPresence" },
    ],
  },
  government_id: {
    fields: [
      { fieldName: "full_name", sourceField: "fullName" },
      { fieldName: "date_of_birth", sourceField: "dateOfBirth" },
      { fieldName: "government_id", sourceField: "documentPresence" },
    ],
  },
};

export async function wireExtractionToReadiness(
  userId: string,
  documentId: string,
  documentType: string,
  extractedFields: Record<string, any>,
  confidence: string
): Promise<{ fieldsUpdated: string[]; skipped: string[] }> {
  if (confidence === "low") {
    return { fieldsUpdated: [], skipped: ["all - low confidence"] };
  }

  await initializeReadinessChecklist(userId);

  const mapping = DOCUMENT_FIELD_MAP[documentType];
  if (!mapping) {
    return { fieldsUpdated: [], skipped: [`unknown document type: ${documentType}`] };
  }

  const fieldsUpdated: string[] = [];
  const skipped: string[] = [];

  for (const { fieldName, sourceField } of mapping.fields) {
    const hasData = sourceField === "documentPresence" || 
      (extractedFields[sourceField] !== undefined && extractedFields[sourceField] !== null && extractedFields[sourceField] !== "");

    if (hasData) {
      try {
        await updateReadinessField(userId, fieldName, {
          verificationStatus: "document_extracted",
          sourceTable: "documents",
          sourceField: sourceField,
          sourceRecordId: documentId,
        });
        fieldsUpdated.push(fieldName);
      } catch (err) {
        skipped.push(`${fieldName}: update failed`);
      }
    } else {
      skipped.push(`${fieldName}: no data in extracted fields`);
    }
  }

  return { fieldsUpdated, skipped };
}

// Full pipeline coverage — previously only the pre-approval-and-terminal
// subset was mapped, so the borrower journey state machine froze at
// pre-qualification for any loan that progressed. Called from
// updatePipelineStage on every status change; this map is the single
// translation between pipeline status and journey state.
const APP_STATUS_TO_STATE_MAP: Record<string, { state: BorrowerState; trigger: TransitionTrigger }> = {
  submitted: { state: "profiling", trigger: "application_started" },
  analyzing: { state: "pre_qualification", trigger: "application_submitted" },
  under_review: { state: "pre_qualification", trigger: "application_submitted" },
  pre_approved: { state: "pre_approval", trigger: "pre_approval_issued" },
  doc_collection: { state: "pre_approval", trigger: "documents_uploaded" },
  processing: { state: "in_contract", trigger: "offer_accepted" },
  underwriting: { state: "underwriting", trigger: "underwriting_submitted" },
  conditional: { state: "conditional_approval", trigger: "conditions_cleared" },
  clear_to_close: { state: "clear_to_close", trigger: "clear_to_close_issued" },
  closing: { state: "closing", trigger: "closing_scheduled" },
  denied: { state: "denied", trigger: "application_denied" },
  funded: { state: "funded", trigger: "funded" },
  withdrawn: { state: "withdrawn", trigger: "borrower_withdrew" },
  expired: { state: "expired", trigger: "application_expired" },
};

export async function syncApplicationStatusToStateMachine(
  userId: string,
  applicationId: string,
  newApplicationStatus: string
): Promise<{ synced: boolean; fromState: string; toState: string; error?: string }> {
  const mapping = APP_STATUS_TO_STATE_MAP[newApplicationStatus];
  if (!mapping) {
    return { synced: false, fromState: "", toState: "", error: `No state mapping for status: ${newApplicationStatus}` };
  }

  const currentState = await getCurrentState(userId);

  if (currentState === mapping.state) {
    return { synced: true, fromState: currentState, toState: mapping.state };
  }

  const result = await transitionState(userId, mapping.state, mapping.trigger, {
    applicationId,
    metadata: { source: "application_status_sync", applicationStatus: newApplicationStatus },
  });

  return {
    synced: result.success,
    fromState: result.fromState,
    toState: result.toState,
    error: result.error,
  };
}

export async function getCoachPreFillData(userId: string): Promise<{
  preFillFields: Record<string, { value: any; source: string; confidence: string }>;
  completionHint: string;
}> {
  const preFillFields: Record<string, { value: any; source: string; confidence: string }> = {};

  try {
    // One conversations query + one batched messages query (was an N+1 loop).
    const { snapshots } = await getCoachIntakeSnapshots(userId);

    const PREFILL_FIELDS = [
      "annualIncome", "monthlyDebts", "creditScore", "purchasePrice", "downPayment",
      "propertyType", "employmentType", "employmentYears", "isFirstTimeBuyer",
      "isVeteran", "loanPurpose",
    ] as const;

    for (const intake of snapshots) {
      for (const field of PREFILL_FIELDS) {
        if ((intake as any)[field] && !(field in preFillFields)) {
          preFillFields[field] = {
            value: (intake as any)[field],
            source: "coach_conversation",
            confidence: "tier3",
          };
        }
      }
    }
  } catch (err) {
    console.warn("[PreFill] Coach data retrieval failed:", err);
  }

  try {
    const applications = await storage.getLoanApplicationsByUser(userId);
    // Pre-fill source: the in-flight file if one exists, else the most recent
    // file of any status — old figures are still the borrower's figures.
    const activeApp = pickActiveLoanApplication(applications) || applications[0];

    if (activeApp) {
      const appFieldMap: Record<string, { value: any; key: string }> = {
        annualIncome: { value: activeApp.annualIncome, key: "annualIncome" },
        monthlyDebts: { value: activeApp.monthlyDebts, key: "monthlyDebts" },
        purchasePrice: { value: activeApp.purchasePrice, key: "purchasePrice" },
        downPayment: { value: activeApp.downPayment, key: "downPayment" },
        propertyType: { value: activeApp.propertyType, key: "propertyType" },
      };

      for (const [_, { value, key }] of Object.entries(appFieldMap)) {
        if (value && !(key in preFillFields)) {
          preFillFields[key] = {
            value,
            source: "existing_application",
            confidence: "tier2",
          };
        }
      }
    }
  } catch (err) {
    console.warn("[PreFill] Application data retrieval failed:", err);
  }

  const fieldCount = Object.keys(preFillFields).length;
  const completionHint = fieldCount > 5
    ? "We've pre-filled most of your application from previous conversations"
    : fieldCount > 0
      ? `We've pre-filled ${fieldCount} fields from your previous data`
      : "Start your application from scratch";

  return { preFillFields, completionHint };
}

export async function detectStaleApplications(): Promise<Array<{
  userId: string;
  email: string | null;
  userName: string;
  applicationId: string;
  currentState: string;
  readinessScore: number;
  daysSinceLastActivity: number;
  nextMissingField: string | null;
}>> {
  const staleDays = 3;
  const minReadiness = 30;
  const cutoffDate = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

  const activeApps = await db.select({
    userId: loanApplications.userId,
    applicationId: loanApplications.id,
    status: loanApplications.status,
    updatedAt: loanApplications.updatedAt,
  })
    .from(loanApplications)
    .where(and(
      sql`${loanApplications.status} IN ('draft', 'submitted', 'analyzing')`,
      lte(loanApplications.updatedAt, cutoffDate),
    ));

  const staleResults: Array<{
    userId: string;
    email: string | null;
    userName: string;
    applicationId: string;
    currentState: string;
    readinessScore: number;
    daysSinceLastActivity: number;
    nextMissingField: string | null;
  }> = [];

  // Batch-load users once rather than one getUser per application in the loop.
  const reengageUsers = await storage.getUsersByIds([...new Set(activeApps.map((a) => a.userId))]);
  const reengageUserById = new Map(reengageUsers.map((u) => [u.id, u]));

  for (const app of activeApps) {
    try {
      const readiness = await getReadinessScore(app.userId);
      if (readiness.overallScore < minReadiness) continue;

      const user = reengageUserById.get(app.userId);
      if (!user?.email) continue;

      const currentState = await getCurrentState(app.userId);
      const terminalStates: BorrowerState[] = ["withdrawn", "denied", "expired", "funded", "homeowner"];
      if (terminalStates.includes(currentState)) continue;

      const daysSinceLastActivity = Math.floor(
        (Date.now() - new Date(app.updatedAt || 0).getTime()) / (24 * 60 * 60 * 1000)
      );

      staleResults.push({
        userId: app.userId,
        email: user.email,
        userName: user.firstName || user.email?.split("@")[0] || "Borrower",
        applicationId: app.applicationId,
        currentState,
        readinessScore: readiness.overallScore,
        daysSinceLastActivity,
        nextMissingField: readiness.missingRequired[0] || null,
      });
    } catch (err) {
      console.warn(`[ReEngagement] Error processing user ${app.userId}:`, err);
    }
  }

  return staleResults;
}

export async function sendReEngagementEmails(): Promise<{ sent: number; errors: number }> {
  const staleApps = await detectStaleApplications();
  let sent = 0;
  let errors = 0;

  for (const app of staleApps) {
    try {
      if (!app.email) continue;

      sendNotificationEmail({
        type: "status_update",
        recipientEmail: app.email,
        data: {
          borrowerName: app.userName,
          statusLabel: `You're ${app.readinessScore}% ready! ${app.nextMissingField ? `Next step: provide your ${app.nextMissingField}` : "Continue your application to get pre-approved."}`,
          applicationId: app.applicationId,
        },
      });

      await db.insert(intentEvents).values({
        userId: app.userId,
        eventType: "return_visit",
        eventCategory: "engagement",
        metadata: {
          source: "re_engagement_email",
          readinessScore: app.readinessScore,
          daysSinceLastActivity: app.daysSinceLastActivity,
        },
      });

      sent++;
    } catch (err) {
      errors++;
      console.error(`[ReEngagement] Email send error for ${app.userId}:`, err);
    }
  }

  return { sent, errors };
}

export async function matchAndPriceBorrower(
  userId: string,
  options?: { lockTermDays?: number; productTypes?: string[] }
): Promise<{
  matches: Array<{
    lenderProductId: string;
    lenderName: string;
    productName: string;
    matchScore: number;
    matchStatus: string;
    offers: Array<{
      productId: string;
      productName: string;
      adjustedRate: number;
      estimatedMonthlyTotal: number;
      lenderFees: any;
    }>;
  }>;
  totalEligible: number;
  totalOffers: number;
}> {
  const { matchBorrowerToLenders } = await import("./lenderMatchingEngine");
  const { computeOffers } = await import("./pricingAdapter");

  const matchResults = await matchBorrowerToLenders(userId, { forceRefresh: true });
  const eligibleMatches = matchResults.filter(m => m.status === "eligible" || m.status === "conditionally_eligible");

  const graph = await buildBorrowerGraph(userId);
  const activeApp = graph.applications.find(a => a.id === graph.activeApplicationId);

  if (!activeApp || !activeApp.purchasePrice || !activeApp.downPayment) {
    return {
      matches: eligibleMatches.map(m => ({
        lenderProductId: m.product.id,
        lenderName: m.product.lenderName,
        productName: m.product.productName,
        matchScore: m.score,
        matchStatus: m.status,
        offers: [],
      })),
      totalEligible: eligibleMatches.length,
      totalOffers: 0,
    };
  }

  const loanAmount = activeApp.purchasePrice - activeApp.downPayment;

  const lenderIdSet = new Set<string>();
  for (const match of eligibleMatches) {
    if (match.product.lenderId) {
      lenderIdSet.add(match.product.lenderId);
    }
  }

  let offers: any[] = [];
  try {
    const lenderIds = Array.from(lenderIdSet);

    const wholesaleLendersList = await storage.getWholesaleLenders({ status: "ACTIVE" });
    const matchedWholesaleIds = wholesaleLendersList
      .filter(wl => lenderIds.some(lid => 
        wl.lenderId === lid || wl.lenderName.toLowerCase().includes(lid.toLowerCase())
      ))
      .map(wl => wl.id);

    if (matchedWholesaleIds.length > 0) {
      offers = await computeOffers(storage as any, {
        creditScore: graph.eligibility.creditScore || 700,
        loanAmount,
        propertyValue: activeApp.purchasePrice,
        propertyType: (activeApp.propertyType as any) || "single_family",
        occupancyType: "primary_residence",
        loanPurpose: (activeApp.loanPurpose as any) || "purchase",
        isFirstTimeHomeBuyer: activeApp.isFirstTimeBuyer || false,
        borrowerIncome: graph.bestAnnualIncome || 0,
        lockTermDays: options?.lockTermDays || 30,
        lenderIds: matchedWholesaleIds,
        productTypes: options?.productTypes,
      });
    }
  } catch (err) {
    console.warn("[MatchAndPrice] Offer computation failed:", err);
  }

  const combined = eligibleMatches.map(match => {
    const matchOffers = offers.filter(o =>
      o.lenderName.toLowerCase() === match.product.lenderName.toLowerCase()
    );

    return {
      lenderProductId: match.product.id,
      lenderName: match.product.lenderName,
      productName: match.product.productName,
      matchScore: match.score,
      matchStatus: match.status,
      offers: matchOffers.map(o => ({
        productId: o.productId,
        productName: o.productName,
        adjustedRate: o.adjustedRate,
        estimatedMonthlyTotal: o.estimatedMonthlyTotal,
        lenderFees: o.lenderFees,
      })),
    };
  });

  return {
    matches: combined,
    totalEligible: eligibleMatches.length,
    totalOffers: offers.length,
  };
}

export async function wirePlaidToReadiness(
  userId: string,
  verificationType: "identity" | "income" | "employment" | "assets",
  verifiedData: Record<string, any>
): Promise<{ fieldsUpdated: string[] }> {
  await initializeReadinessChecklist(userId);

  const fieldsUpdated: string[] = [];

  const plaidFieldMap: Record<string, string[]> = {
    identity: ["full_name", "date_of_birth"],
    income: ["annual_income", "income_sources"],
    employment: ["employer_name", "employment_type", "employment_duration"],
    assets: ["total_assets", "bank_accounts", "down_payment_source"],
  };

  const fields = plaidFieldMap[verificationType] || [];

  for (const fieldName of fields) {
    try {
      await updateReadinessField(userId, fieldName, {
        verificationStatus: "third_party_verified",
        sourceTable: "plaid_verification",
        sourceField: verificationType,
        sourceRecordId: verifiedData.itemId || undefined,
      });
      fieldsUpdated.push(fieldName);
    } catch (err) {
      console.warn(`[Plaid] Failed to update readiness field ${fieldName}:`, err);
    }
  }

  return { fieldsUpdated };
}

function bucketize(value: number, ranges: Array<{ min: number; max: number; label: string }>): string {
  for (const range of ranges) {
    if (value >= range.min && value < range.max) return range.label;
  }
  return "unknown";
}

export async function aggregateAnonymizedData(): Promise<{
  factsCreated: number;
  borrowersProcessed: number;
}> {
  const PII_SALT = process.env.PII_HASH_SALT || "default-salt";
  const cohortDate = new Date();
  cohortDate.setHours(0, 0, 0, 0);

  const allUsers = await db.select({ id: users.id })
    .from(users)
    .where(eq(users.role, "borrower"));

  const cohortMap = new Map<string, {
    dtis: number[];
    ltvs: number[];
    loanAmounts: number[];
    downPaymentPercents: number[];
    creditScores: number[];
    incomes: number[];
    count: number;
    geoState: string;
    creditBucket: string;
    incomeBucket: string;
    loanPurpose: string;
    propertyType: string;
  }>();

  let borrowersProcessed = 0;

  for (const user of allUsers) {
    try {
      const graph = await buildBorrowerGraph(user.id);
      if (!graph.eligibility.creditScore && !graph.bestAnnualIncome) continue;

      const activeApp = graph.applications.find(a => a.id === graph.activeApplicationId);

      const creditScore = graph.eligibility.creditScore || 0;
      const income = graph.bestAnnualIncome || 0;
      const loanPurpose = activeApp?.loanPurpose || "unknown";
      const propertyType = activeApp?.propertyType || "unknown";
      const dti = graph.eligibility.estimatedDTI || 0;

      const creditBucket = bucketize(creditScore, [
        { min: 0, max: 580, label: "below_580" },
        { min: 580, max: 620, label: "580_619" },
        { min: 620, max: 660, label: "620_659" },
        { min: 660, max: 700, label: "660_699" },
        { min: 700, max: 740, label: "700_739" },
        { min: 740, max: 780, label: "740_779" },
        { min: 780, max: 10000, label: "780_plus" },
      ]);

      const incomeBucket = bucketize(income, [
        { min: 0, max: 30000, label: "below_30k" },
        { min: 30000, max: 50000, label: "30k_50k" },
        { min: 50000, max: 75000, label: "50k_75k" },
        { min: 75000, max: 100000, label: "75k_100k" },
        { min: 100000, max: 150000, label: "100k_150k" },
        { min: 150000, max: 250000, label: "150k_250k" },
        { min: 250000, max: 10000000, label: "250k_plus" },
      ]);

      const cohortKey = `${creditBucket}|${incomeBucket}|${loanPurpose}|${propertyType}`;

      if (!cohortMap.has(cohortKey)) {
        cohortMap.set(cohortKey, {
          dtis: [],
          ltvs: [],
          loanAmounts: [],
          downPaymentPercents: [],
          creditScores: [],
          incomes: [],
          count: 0,
          geoState: "national",
          creditBucket,
          incomeBucket,
          loanPurpose,
          propertyType,
        });
      }

      const cohort = cohortMap.get(cohortKey)!;
      cohort.count++;
      if (dti > 0) cohort.dtis.push(dti);
      if (creditScore > 0) cohort.creditScores.push(creditScore);
      if (income > 0) cohort.incomes.push(income);

      if (activeApp?.purchasePrice && activeApp?.downPayment) {
        const loanAmount = activeApp.purchasePrice - activeApp.downPayment;
        const ltv = (loanAmount / activeApp.purchasePrice) * 100;
        const downPct = (activeApp.downPayment / activeApp.purchasePrice) * 100;
        cohort.loanAmounts.push(loanAmount);
        cohort.ltvs.push(ltv);
        cohort.downPaymentPercents.push(downPct);
      }

      borrowersProcessed++;
    } catch (err) {
      continue;
    }
  }

  let factsCreated = 0;

  const cohortEntries = Array.from(cohortMap.entries());
  for (const [_, cohort] of cohortEntries) {
    if (cohort.count < 5) continue;

    const median = (arr: number[]) => {
      if (arr.length === 0) return null;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    const average = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    await db.insert(anonymizedBorrowerFacts).values({
      cohortDate,
      geoStateBucket: cohort.geoState,
      creditScoreBucket: cohort.creditBucket,
      incomeBucket: cohort.incomeBucket,
      loanPurpose: cohort.loanPurpose,
      propertyType: cohort.propertyType,
      avgDti: average(cohort.dtis)?.toFixed(2) ?? undefined,
      avgLtv: average(cohort.ltvs)?.toFixed(2) ?? undefined,
      avgLoanAmount: average(cohort.loanAmounts)?.toFixed(2) ?? undefined,
      avgDownPaymentPercent: average(cohort.downPaymentPercents)?.toFixed(2) ?? undefined,
      medianCreditScore: median(cohort.creditScores) ? Math.round(median(cohort.creditScores)!) : undefined,
      medianIncome: median(cohort.incomes)?.toFixed(2) ?? undefined,
      borrowerCount: cohort.count,
    });
    factsCreated++;
  }

  return { factsCreated, borrowersProcessed };
}

export async function calculateAgentCommission(
  applicationId: string,
  fundedAmount: number
): Promise<{
  commissionAmount: number;
  commissionRate: number;
  lenderCompensation: any;
  breakdown: Record<string, any>;
} | null> {
  const app = await storage.getLoanApplication(applicationId);
  if (!app) return null;

  const user = await storage.getUser(app.userId);
  if (!user?.referredByUserId) return null;

  const referrer = await storage.getUser(user.referredByUserId);
  if (!referrer || (referrer.role !== "agent" && referrer.role !== "broker")) return null;

  let lenderCompensation: any = null;
  let brokerCompBps = 275;

  try {
    const matchResults = await db.select()
      .from(lenderMatchResults)
      .where(and(
        eq(lenderMatchResults.userId, app.userId),
        eq(lenderMatchResults.applicationId, applicationId),
      ))
      .orderBy(desc(lenderMatchResults.matchScore))
      .limit(1);

    if (matchResults.length > 0) {
      const product = await db.select().from(lenderProducts)
        .where(eq(lenderProducts.id, matchResults[0].lenderProductId))
        .limit(1);

      if (product.length > 0) {
        const wholesaleLendersList = await storage.getWholesaleLenders({ status: "ACTIVE" });
        const matchedWholesale = wholesaleLendersList.find(wl =>
          wl.lenderId === product[0].lenderId || wl.lenderName === product[0].lenderName
        );

        if (matchedWholesale?.brokerCompensation) {
          lenderCompensation = matchedWholesale.brokerCompensation;
          const comp = matchedWholesale.brokerCompensation as any;
          if (comp.defaultBps) brokerCompBps = comp.defaultBps;
        }
      }
    }
  } catch (err) {
    console.warn("[Commission] Failed to lookup lender compensation:", err);
  }

  const totalBrokerRevenue = (fundedAmount * brokerCompBps) / 10000;

  const AGENT_SHARE_PERCENT = 25;
  const agentCommission = (totalBrokerRevenue * AGENT_SHARE_PERCENT) / 100;
  const effectiveRate = (agentCommission / fundedAmount) * 10000;

  try {
    await db.insert(brokerCommissions).values({
      brokerId: referrer.id,
      applicationId,
      loanAmount: fundedAmount.toFixed(2),
      commissionRate: (effectiveRate / 10000).toFixed(4),
      commissionAmount: agentCommission.toFixed(2),
      status: "pending",
      notes: JSON.stringify({
        brokerCompBps,
        totalBrokerRevenue: totalBrokerRevenue.toFixed(2),
        agentSharePercent: AGENT_SHARE_PERCENT,
        lenderCompensation,
        calculatedAt: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.warn("[Commission] Failed to create commission record:", err);
  }

  return {
    commissionAmount: agentCommission,
    commissionRate: effectiveRate,
    lenderCompensation,
    breakdown: {
      fundedAmount,
      brokerCompBps,
      totalBrokerRevenue,
      agentSharePercent: AGENT_SHARE_PERCENT,
      agentCommission,
    },
  };
}
