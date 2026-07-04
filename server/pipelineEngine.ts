import { storage } from "./storage";
import type {
  LoanApplication,
  LoanCondition,
  LoanMilestone,
  User,
  InsertLoanCondition,
  InsertLoanMilestone,
  Task,
  InsertTask,
} from "@shared/schema";
import { loanConditions, loanMilestones, users, dealActivities } from "@shared/schema";
import { db } from "./db";
import { inArray, desc, eq, max } from "drizzle-orm";
import { computeFileHealth, daysSince, type FileHealth } from "./services/fileHealth";
import {
  LOAN_APP_TRANSITIONS,
  isLoanAppStatus,
  isValidLoanAppTransition,
  type LoanAppStatus,
} from "@shared/schema";
import {
  qualifyIncome,
  verifyAssets,
  assessLiabilities,
  calculateDTI,
} from "./underwriting";

interface DocumentRequirement {
  documentType: string;
  yearsRequired?: number[];
  description: string;
  priority: "prior_to_approval" | "prior_to_docs" | "prior_to_funding";
  conditionCategory: string;
  conditionTitle: string;
}

interface BorrowerProfile {
  employmentType: string | null;
  employmentYears: number | null;
  annualIncome: number;
  creditScore: number | null;
  ltvRatio: number;
  loanPurpose: string | null;
  propertyType: string | null;
  isVeteran: boolean;
  isFirstTimeBuyer: boolean;
  isSelfEmployed: boolean;
}

const currentYear = new Date().getFullYear();

const BASE_DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    documentType: "government_id",
    description: "Valid government-issued photo ID (driver's license or passport)",
    priority: "prior_to_approval",
    conditionCategory: "compliance",
    conditionTitle: "Valid Government ID Required",
  },
  {
    documentType: "pay_stub",
    yearsRequired: [currentYear],
    description: "Most recent 30 days of pay stubs",
    priority: "prior_to_approval",
    conditionCategory: "income",
    conditionTitle: "Recent Pay Stubs Required",
  },
];

const EMPLOYMENT_RULES: Record<string, DocumentRequirement[]> = {
  employed: [
    {
      documentType: "w2",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description: "W-2 forms for the past 2 years",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "W-2 Forms Required",
    },
    {
      documentType: "tax_return",
      yearsRequired: [currentYear - 1],
      description: "Federal tax returns for the most recent year",
      priority: "prior_to_docs",
      conditionCategory: "income",
      conditionTitle: "Tax Return Verification",
    },
  ],
  self_employed: [
    {
      documentType: "tax_return",
      yearsRequired: [currentYear - 1, currentYear - 2],
      description: "Complete federal tax returns for the past 2 years (all schedules)",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "2-Year Tax Returns Required (Self-Employed)",
    },
    {
      documentType: "profit_loss",
      yearsRequired: [currentYear],
      description: "Year-to-date profit and loss statement",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "YTD Profit & Loss Statement Required",
    },
    {
      documentType: "business_license",
      description: "Business license or articles of incorporation",
      priority: "prior_to_docs",
      conditionCategory: "income",
      conditionTitle: "Business Documentation Required",
    },
    {
      documentType: "bank_statement_business",
      description: "3 months of business bank statements",
      priority: "prior_to_approval",
      conditionCategory: "assets",
      conditionTitle: "Business Bank Statements Required",
    },
  ],
  retired: [
    {
      documentType: "social_security_award",
      description: "Social Security award letter",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Social Security Documentation Required",
    },
    {
      documentType: "pension_statement",
      description: "Pension or retirement account statements",
      priority: "prior_to_approval",
      conditionCategory: "income",
      conditionTitle: "Pension/Retirement Income Verification",
    },
  ],
};

const ASSET_REQUIREMENTS: DocumentRequirement[] = [
  {
    documentType: "bank_statement",
    description: "2 months of bank statements for all accounts",
    priority: "prior_to_approval",
    conditionCategory: "assets",
    conditionTitle: "Bank Statements Required",
  },
];

const LTV_BASED_REQUIREMENTS: { threshold: number; requirements: DocumentRequirement[] }[] = [
  {
    threshold: 80,
    requirements: [
      {
        documentType: "gift_letter",
        description: "Gift letter if using gift funds for down payment",
        priority: "prior_to_docs",
        conditionCategory: "assets",
        conditionTitle: "Gift Fund Documentation (if applicable)",
      },
    ],
  },
  {
    threshold: 95,
    requirements: [
      {
        documentType: "reserves_proof",
        description: "Proof of 2 months PITI reserves",
        priority: "prior_to_docs",
        conditionCategory: "assets",
        conditionTitle: "Reserve Funds Verification",
      },
    ],
  },
];

const PROPERTY_REQUIREMENTS: DocumentRequirement[] = [
  {
    documentType: "purchase_contract",
    description: "Signed purchase contract",
    priority: "prior_to_docs",
    conditionCategory: "property",
    conditionTitle: "Purchase Contract Required",
  },
  {
    documentType: "homeowners_insurance",
    description: "Homeowners insurance binder",
    priority: "prior_to_funding",
    conditionCategory: "insurance",
    conditionTitle: "Homeowners Insurance Required",
  },
];

const CREDIT_BASED_REQUIREMENTS: { minScore: number; maxScore: number; requirements: DocumentRequirement[] }[] = [
  {
    minScore: 0,
    maxScore: 680,
    requirements: [
      {
        documentType: "letter_of_explanation",
        description: "Letter of explanation for any derogatory credit items",
        priority: "prior_to_docs",
        conditionCategory: "credit",
        conditionTitle: "Credit Explanation Letter Required",
      },
    ],
  },
];

export function determineDocumentRequirements(profile: BorrowerProfile): DocumentRequirement[] {
  const requirements: DocumentRequirement[] = [...BASE_DOCUMENT_REQUIREMENTS];

  const employmentType = profile.employmentType || "employed";
  if (EMPLOYMENT_RULES[employmentType]) {
    requirements.push(...EMPLOYMENT_RULES[employmentType]);
  } else {
    requirements.push(...EMPLOYMENT_RULES["employed"]);
  }

  requirements.push(...ASSET_REQUIREMENTS);

  for (const ltvRule of LTV_BASED_REQUIREMENTS) {
    if (profile.ltvRatio > ltvRule.threshold) {
      requirements.push(...ltvRule.requirements);
    }
  }

  requirements.push(...PROPERTY_REQUIREMENTS);

  if (profile.creditScore) {
    for (const creditRule of CREDIT_BASED_REQUIREMENTS) {
      if (profile.creditScore >= creditRule.minScore && profile.creditScore <= creditRule.maxScore) {
        requirements.push(...creditRule.requirements);
      }
    }
  }

  if (profile.isVeteran) {
    requirements.push({
      documentType: "dd214",
      description: "DD-214 Certificate of Release or Discharge",
      priority: "prior_to_approval",
      conditionCategory: "compliance",
      conditionTitle: "VA Eligibility Documentation Required",
    });
    requirements.push({
      documentType: "coe",
      description: "VA Certificate of Eligibility (COE)",
      priority: "prior_to_approval",
      conditionCategory: "compliance",
      conditionTitle: "VA Certificate of Eligibility Required",
    });
  }

  return requirements;
}

export async function generateConditionsFromRequirements(
  applicationId: string,
  requirements: DocumentRequirement[]
): Promise<LoanCondition[]> {
  const conditions: LoanCondition[] = [];

  for (const req of requirements) {
    const conditionData: InsertLoanCondition = {
      applicationId,
      category: req.conditionCategory,
      title: req.conditionTitle,
      description: req.description,
      priority: req.priority,
      status: "outstanding",
      requiredDocumentTypes: [req.documentType],
      isAutoGenerated: true,
      sourceRule: `DOC_REQ_${req.documentType.toUpperCase()}`,
    };

    const condition = await storage.createLoanCondition(conditionData);
    conditions.push(condition);
  }

  return conditions;
}

export async function generateDocumentTasks(
  applicationId: string,
  userId: string,
  requirements: DocumentRequirement[],
  createdByUserId: string
): Promise<Task[]> {
  const tasks: Task[] = [];

  for (const req of requirements) {
    const yearsDescription = req.yearsRequired 
      ? ` (${req.yearsRequired.join(", ")})`
      : "";

    const taskData: InsertTask = {
      applicationId,
      assignedToUserId: userId,
      createdByUserId,
      title: `Upload: ${req.conditionTitle}`,
      description: req.description + yearsDescription,
      taskType: "document_request",
      documentCategory: req.documentType,
      documentYear: req.yearsRequired?.[0]?.toString(),
      status: "pending",
      priority: req.priority === "prior_to_approval" ? "high" : "normal",
    };

    const task = await storage.createTask(taskData);
    tasks.push(task);
  }

  return tasks;
}

export function getBorrowerProfileFromApplication(app: LoanApplication): BorrowerProfile {
  const purchasePrice = app.purchasePrice ? parseFloat(app.purchasePrice.toString()) : 0;
  const downPayment = app.downPayment ? parseFloat(app.downPayment.toString()) : 0;
  const loanAmount = purchasePrice - downPayment;
  const ltvRatio = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const annualIncome = app.annualIncome ? parseFloat(app.annualIncome.toString()) : 0;

  return {
    employmentType: app.employmentType,
    employmentYears: app.employmentYears,
    annualIncome,
    creditScore: app.creditScore,
    ltvRatio,
    loanPurpose: app.loanPurpose,
    propertyType: app.propertyType,
    isVeteran: app.isVeteran || false,
    isFirstTimeBuyer: app.isFirstTimeBuyer || false,
    isSelfEmployed: app.employmentType === "self_employed",
  };
}

export async function initializeLoanPipeline(
  application: LoanApplication,
  createdByUserId: string
): Promise<{
  milestones: any;
  conditions: LoanCondition[];
  tasks: Task[];
}> {
  const milestone = await storage.createLoanMilestone({
    applicationId: application.id,
    submittedAt: new Date(),
  });

  const profile = getBorrowerProfileFromApplication(application);
  const requirements = determineDocumentRequirements(profile);

  const conditions = await generateConditionsFromRequirements(application.id, requirements);

  const tasks = await generateDocumentTasks(
    application.id,
    application.userId,
    requirements,
    createdByUserId
  );

  return { milestones: milestone, conditions, tasks };
}

/**
 * Zero-touch intake: when a borrower uploads a document, match its type
 * against the application's outstanding conditions and move matches to
 * "submitted" (ready for underwriter review — clearing remains a human
 * judgment, never automated). Active deal-team staff get one notification
 * per upload event so nothing sits unnoticed.
 */
export async function matchUploadedDocumentToConditions(args: {
  applicationId: string;
  documentType: string;
  fileName: string;
  uploadedBy: string;
}): Promise<{ matchedConditionIds: string[] }> {
  const { applicationId, documentType, fileName, uploadedBy } = args;

  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  const matches = conditions.filter(
    (c) => c.status === "outstanding" && (c.requiredDocumentTypes ?? []).includes(documentType),
  );
  if (matches.length === 0) return { matchedConditionIds: [] };

  for (const condition of matches) {
    await storage.updateLoanCondition(condition.id, { status: "submitted" });
    await storage.createDealActivity({
      applicationId,
      activityType: "note",
      title: `Condition ready for review: ${condition.title}`,
      description: `${fileName} (${documentType.replace(/_/g, " ")}) was uploaded — the condition moved to "submitted" and awaits underwriter review.`,
      performedBy: uploadedBy,
    });
  }

  try {
    const team = await storage.getDealTeamMembers(applicationId);
    const activeStaff = team.filter(
      (m): m is typeof m & { userId: string } =>
        m.isActive === true && !!m.userId && m.userId !== uploadedBy,
    );
    for (const member of activeStaff) {
      await storage.createNotification({
        userId: member.userId,
        type: "document_review",
        title: `${matches.length} condition${matches.length === 1 ? "" : "s"} ready for review`,
        body: `${fileName} was uploaded and matched: ${matches.map((c) => c.title).join("; ")}.`,
        entityType: "loan_application",
        entityId: applicationId,
        metadata: { documentType, conditionIds: matches.map((c) => c.id) },
      });
    }
  } catch (notifyErr) {
    console.error("[PipelineEngine] Condition-match notification failed (non-fatal):", notifyErr);
  }

  console.log(
    `[pipeline] ${fileName} (${documentType}) matched ${matches.length} condition(s) on ${applicationId} → submitted`,
  );
  return { matchedConditionIds: matches.map((c) => c.id) };
}

/**
 * Thrown when a caller asks for a stage move the transition table forbids.
 * Carries the allowed targets so endpoints can return them — staff UIs can
 * grey out impossible moves instead of discovering them by error.
 */
export class PipelineTransitionError extends Error {
  constructor(
    public readonly fromStage: string,
    public readonly toStage: string,
    public readonly allowed: readonly LoanAppStatus[],
  ) {
    super(
      `Invalid stage transition from '${fromStage}' to '${toStage}'. Allowed from '${fromStage}': ${allowed.length ? allowed.join(", ") : "none (terminal state)"}`,
    );
    this.name = "PipelineTransitionError";
  }
}

/**
 * THE single writer for loanApplications.status. Every status change — staff
 * endpoints, borrower withdraw, automated analysis — funnels through here so
 * milestones, HMDA codes, task-engine events, the borrower state machine, and
 * homeowner graduation can never drift apart. Direct storage.updateLoanApplication
 * calls with a status field are forbidden (see tests/statusVocabulary.test.ts).
 */
export async function updatePipelineStage(
  applicationId: string,
  newStage: LoanAppStatus,
  options?: {
    denialReasons?: string[];
    /** Admin escape hatch: skip transition validation (still runs all side effects). */
    force?: boolean;
  }
): Promise<void> {
  const now = new Date();

  if (!isLoanAppStatus(newStage)) {
    throw new PipelineTransitionError("unknown", newStage, []);
  }

  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error(`Application not found: ${applicationId}`);
  }
  const previousStage = application.status;

  // Idempotent: re-asserting the current stage is a no-op, not an error.
  if (previousStage === newStage) return;

  if (!options?.force && isLoanAppStatus(previousStage) && !isValidLoanAppTransition(previousStage, newStage)) {
    throw new PipelineTransitionError(previousStage, newStage, LOAN_APP_TRANSITIONS[previousStage]);
  }

  const milestoneUpdate: Record<string, any> = {};
  
  switch (newStage) {
    case "pre_approved":
      milestoneUpdate.preApprovedAt = now;
      break;
    case "doc_collection":
      milestoneUpdate.docCollectionStartedAt = now;
      break;
    case "processing":
      milestoneUpdate.processingStartedAt = now;
      break;
    case "underwriting":
      milestoneUpdate.underwritingStartedAt = now;
      break;
    case "conditional":
      milestoneUpdate.conditionalApprovedAt = now;
      break;
    case "clear_to_close":
      milestoneUpdate.clearToCloseAt = now;
      break;
    case "closing":
      milestoneUpdate.closingScheduledAt = now;
      break;
    case "funded":
      milestoneUpdate.fundedAt = now;
      milestoneUpdate.actualCloseDate = now;
      // Lifecycle graduation: funding a loan lights up the Homeowner Hub
      // automatically (profile + welcome notification). Non-fatal.
      try {
        const { graduateClosedLoan } = await import("./services/lifecycleEngine");
        await graduateClosedLoan(applicationId);
      } catch (gradErr) {
        console.error("[PipelineEngine] Homeowner graduation failed (non-fatal):", gradErr);
      }
      break;
    case "denied":
      milestoneUpdate.deniedAt = now;
      break;
  }

  if (Object.keys(milestoneUpdate).length > 0) {
    await storage.updateLoanMilestones(applicationId, milestoneUpdate);
  }

  // Populate HMDA Reg C "action taken" codes for the Loan Application Register.
  // "funded" is the correct point to record code 1 (loan originated); "denied"
  // records code 3 along with the denial reasons required for LAR reporting —
  // but only when reasons are supplied (staff decision paths always supply
  // them; the automated analysis path must NOT fabricate a LAR entry, its
  // "denied" is finalized through the formal adverse-action flow). "withdrawn"
  // records code 4 regardless of who initiated it (staff or borrower).
  const applicationUpdate: Record<string, any> = { status: newStage };
  if (newStage === "funded") {
    applicationUpdate.hmdaActionTaken = "1";
  } else if (newStage === "denied" && options?.denialReasons && options.denialReasons.length > 0) {
    applicationUpdate.hmdaActionTaken = "3";
    applicationUpdate.hmdaDenialReasons = options.denialReasons;
  } else if (newStage === "withdrawn") {
    applicationUpdate.hmdaActionTaken = "4";
  }

  await storage.updateLoanApplication(applicationId, applicationUpdate);

  // Keep the borrower journey state machine in lockstep with the pipeline —
  // previously synced only at creation, which froze Intelligence surfaces at
  // pre-qualification for any loan that progressed. Best-effort by design.
  try {
    const { syncApplicationStatusToStateMachine } = await import("./services/optimizationEngine");
    await syncApplicationStatusToStateMachine(application.userId, applicationId, newStage);
  } catch (syncErr) {
    console.warn("[PipelineEngine] State-machine sync failed (non-fatal):", syncErr);
  }
  
  // Emit workflow event for Task Engine integration
  try {
    const { taskEventEmitter } = await import("./services/taskEventEmitter");
    
    // Map stage to event type
    const stageEventMap: Record<string, string> = {
      "pre_approved": "APPLICATION_PRE_APPROVED",
      "doc_collection": "STAGE_DOC_COLLECTION",
      "processing": "STAGE_PROCESSING",
      "underwriting": "STAGE_UNDERWRITING",
      "conditional": "STAGE_CONDITIONAL",
      "clear_to_close": "STAGE_CLEAR_TO_CLOSE",
      "closing": "STAGE_CLOSING",
      "funded": "STAGE_FUNDED",
      "denied": "APPLICATION_DENIED",
    };
    
    const eventType = stageEventMap[newStage];
    if (eventType) {
      await taskEventEmitter.emitWorkflowEvent(eventType as any, {
        applicationId,
        previousStage,
        newStage,
      });
    }
  } catch (error) {
    console.error("[PipelineEngine] Failed to emit workflow event:", error);
    // Don't fail the stage update if event emission fails
  }
}

export async function checkPipelineProgress(applicationId: string): Promise<{
  currentStage: string;
  conditions: {
    total: number;
    outstanding: number;
    cleared: number;
    categories: Record<string, { total: number; cleared: number }>;
  };
  readyForNextStage: boolean;
  blockers: string[];
}> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) {
    throw new Error("Application not found");
  }

  const conditions = await storage.getLoanConditionsByApplication(applicationId);
  
  const conditionStats = {
    total: conditions.length,
    outstanding: conditions.filter(c => c.status === "outstanding").length,
    cleared: conditions.filter(c => c.status === "cleared").length,
    categories: {} as Record<string, { total: number; cleared: number }>,
  };

  for (const condition of conditions) {
    if (!conditionStats.categories[condition.category]) {
      conditionStats.categories[condition.category] = { total: 0, cleared: 0 };
    }
    conditionStats.categories[condition.category].total++;
    if (condition.status === "cleared") {
      conditionStats.categories[condition.category].cleared++;
    }
  }

  const blockers: string[] = [];
  let readyForNextStage = true;

  const currentStage = application.status || "draft";

  switch (currentStage) {
    case "pre_approved":
    case "doc_collection":
      const priorToApproval = conditions.filter(c => 
        c.priority === "prior_to_approval" && c.status !== "cleared" && c.status !== "waived"
      );
      if (priorToApproval.length > 0) {
        readyForNextStage = false;
        blockers.push(`${priorToApproval.length} prior-to-approval conditions outstanding`);
      }
      break;

    case "processing":
    case "underwriting":
      const priorToDocs = conditions.filter(c => 
        (c.priority === "prior_to_approval" || c.priority === "prior_to_docs") && 
        c.status !== "cleared" && c.status !== "waived"
      );
      if (priorToDocs.length > 0) {
        readyForNextStage = false;
        blockers.push(`${priorToDocs.length} conditions must be cleared before docs`);
      }
      break;

    case "conditional":
    case "clear_to_close":
      const allOutstanding = conditions.filter(c => 
        c.status !== "cleared" && c.status !== "waived" && c.status !== "not_applicable"
      );
      if (allOutstanding.length > 0) {
        readyForNextStage = false;
        blockers.push(`${allOutstanding.length} conditions still outstanding`);
      }
      break;
  }

  return {
    currentStage,
    conditions: conditionStats,
    readyForNextStage,
    blockers,
  };
}

export interface PipelineSummary {
  applicationId: string;
  borrowerName: string;
  currentStage: string;
  daysInPipeline: number;
  targetCloseDate: Date | null;
  conditionsOutstanding: number;
  conditionsTotal: number;
  percentComplete: number;
  nextAction: string;
  priority: "normal" | "high" | "urgent";
  /** Most recent touch on the file: latest deal activity or application update. */
  lastActivityAt: Date | null;
  /** Whole days since lastActivityAt; null when no timestamp exists. */
  daysIdle: number | null;
  /** Deterministic green/yellow/red No-Stall signal (services/fileHealth). */
  fileHealth: FileHealth;
}

function resolveBorrowerName(user: User | undefined): string {
  return user
    ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown"
    : "Unknown";
}

/**
 * Pure assembly of a PipelineSummary from already-fetched rows. Kept separate
 * from data access so it can be shared by the single-application path
 * (getPipelineSummary) and the batched path (getPipelineSummaries) without
 * duplicating the stage/priority logic.
 */
function buildPipelineSummary(
  application: LoanApplication,
  milestones: LoanMilestone | undefined,
  conditions: LoanCondition[],
  borrowerName: string,
  latestActivityAt: Date | null,
): PipelineSummary {
  const submittedAt = milestones?.submittedAt || application.createdAt;
  const daysInPipeline = submittedAt
    ? Math.floor((Date.now() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  const conditionsOutstanding = conditions.filter(c => c.status === "outstanding").length;
  const conditionsTotal = conditions.length;
  const clearedCount = conditions.filter(c => c.status === "cleared" || c.status === "waived").length;
  const percentComplete = conditionsTotal > 0 ? Math.round((clearedCount / conditionsTotal) * 100) : 0;

  let nextAction = "Submit application";
  let priority: "normal" | "high" | "urgent" = "normal";

  const currentStage = application.status || "draft";

  switch (currentStage) {
    case "draft":
      nextAction = "Complete and submit application";
      break;
    case "submitted":
    case "analyzing":
      nextAction = "Awaiting pre-approval decision";
      break;
    case "pre_approved":
    case "doc_collection":
      nextAction = conditionsOutstanding > 0 
        ? `Upload ${conditionsOutstanding} required document(s)` 
        : "All documents uploaded - awaiting review";
      priority = conditionsOutstanding > 3 ? "high" : "normal";
      break;
    case "processing":
      nextAction = "Documents being reviewed";
      break;
    case "underwriting":
      nextAction = "In underwriting review";
      priority = "high";
      break;
    case "conditional":
      nextAction = conditionsOutstanding > 0 
        ? `Clear ${conditionsOutstanding} condition(s)` 
        : "Ready for clear-to-close";
      priority = "high";
      break;
    case "clear_to_close":
      nextAction = "Schedule closing";
      priority = "urgent";
      break;
    case "closing":
      nextAction = "Closing scheduled";
      priority = "urgent";
      break;
    case "funded":
      nextAction = "Loan funded - complete";
      break;
    case "denied":
      nextAction = "Application denied";
      break;
  }

  if (daysInPipeline > 30 && currentStage !== "funded" && currentStage !== "denied") {
    priority = "urgent";
  }

  // "Last touch" is the freshest of the activity log and the application row
  // itself, so status flips that never write an activity still reset the
  // idle clock.
  const updatedAt = application.updatedAt ? new Date(application.updatedAt) : null;
  let lastActivityAt = latestActivityAt;
  if (updatedAt && (!lastActivityAt || updatedAt > lastActivityAt)) {
    lastActivityAt = updatedAt;
  }
  const daysIdle = daysSince(lastActivityAt);

  const fileHealth = computeFileHealth({
    status: currentStage,
    daysIdle,
    daysInPipeline,
    conditionsOutstanding,
    preApprovalAmount: application.preApprovalAmount,
    purchasePrice: application.purchasePrice,
  });

  return {
    applicationId: application.id,
    borrowerName,
    currentStage,
    daysInPipeline,
    targetCloseDate: milestones?.targetCloseDate || null,
    conditionsOutstanding,
    conditionsTotal,
    percentComplete,
    nextAction,
    priority,
    lastActivityAt,
    daysIdle,
    fileHealth,
  };
}

export async function getPipelineSummary(applicationId: string): Promise<PipelineSummary | null> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) return null;

  const [milestones, conditions, user, [latestActivity]] = await Promise.all([
    storage.getLoanMilestones(applicationId),
    storage.getLoanConditionsByApplication(applicationId),
    storage.getUser(application.userId),
    db
      .select({ last: max(dealActivities.createdAt) })
      .from(dealActivities)
      .where(eq(dealActivities.applicationId, applicationId)),
  ]);

  return buildPipelineSummary(
    application,
    milestones,
    conditions,
    resolveBorrowerName(user),
    latestActivity?.last ?? null,
  );
}

/**
 * Batched equivalent of mapping getPipelineSummary over a set of applications.
 * Fetches milestones, conditions, and borrowers in one inArray-batched query
 * each (three round trips total) instead of the 4×N serial round trips the
 * per-application path would incur, then assembles every PipelineSummary in
 * memory. Mirrors the batching pattern used by the /api/dashboard endpoint.
 */
export async function getPipelineSummaries(
  applications: LoanApplication[],
): Promise<PipelineSummary[]> {
  if (applications.length === 0) return [];

  const appIds = applications.map(a => a.id);
  const userIds = Array.from(
    new Set(applications.map(a => a.userId).filter((id): id is string => !!id)),
  );

  const [milestoneRows, conditionRows, userRows, activityRows] = await Promise.all([
    db.select().from(loanMilestones).where(inArray(loanMilestones.applicationId, appIds)),
    db
      .select()
      .from(loanConditions)
      .where(inArray(loanConditions.applicationId, appIds))
      // Match storage.getLoanConditionsByApplication's ordering so per-app
      // condition slices line up with the single-application path.
      .orderBy(loanConditions.priority, desc(loanConditions.createdAt)),
    userIds.length > 0
      ? db.select().from(users).where(inArray(users.id, userIds))
      : Promise.resolve([] as User[]),
    db
      .select({
        applicationId: dealActivities.applicationId,
        last: max(dealActivities.createdAt),
      })
      .from(dealActivities)
      .where(inArray(dealActivities.applicationId, appIds))
      .groupBy(dealActivities.applicationId),
  ]);

  // One milestone row per application; keep the first if duplicates exist.
  const milestoneByApp = new Map<string, LoanMilestone>();
  for (const m of milestoneRows) {
    if (!milestoneByApp.has(m.applicationId)) milestoneByApp.set(m.applicationId, m);
  }

  const conditionsByApp = new Map<string, LoanCondition[]>();
  for (const c of conditionRows) {
    const bucket = conditionsByApp.get(c.applicationId);
    if (bucket) bucket.push(c);
    else conditionsByApp.set(c.applicationId, [c]);
  }

  const userById = new Map<string, User>();
  for (const u of userRows) userById.set(u.id, u);

  const latestActivityByApp = new Map<string, Date>();
  for (const row of activityRows) {
    if (row.last) latestActivityByApp.set(row.applicationId, row.last);
  }

  return applications.map(app => {
    const user = app.userId ? userById.get(app.userId) : undefined;
    return buildPipelineSummary(
      app,
      milestoneByApp.get(app.id),
      conditionsByApp.get(app.id) ?? [],
      resolveBorrowerName(user),
      latestActivityByApp.get(app.id) ?? null,
    );
  });
}
