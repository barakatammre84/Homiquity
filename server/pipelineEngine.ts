import { storage } from "./storage";
import type { 
  LoanApplication, 
  LoanCondition, 
  InsertLoanCondition,
  InsertLoanMilestone,
  Task,
  InsertTask,
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

export async function updatePipelineStage(
  applicationId: string,
  newStage: string
): Promise<void> {
  const now = new Date();
  
  // Get current stage before update for event
  const application = await storage.getLoanApplication(applicationId);
  const previousStage = application?.status || "unknown";
  
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
      break;
    case "denied":
      milestoneUpdate.deniedAt = now;
      break;
  }

  if (Object.keys(milestoneUpdate).length > 0) {
    await storage.updateLoanMilestones(applicationId, milestoneUpdate);
  }

  await storage.updateLoanApplication(applicationId, { status: newStage });
  
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
}

export async function getPipelineSummary(applicationId: string): Promise<PipelineSummary | null> {
  const application = await storage.getLoanApplication(applicationId);
  if (!application) return null;

  const milestones = await storage.getLoanMilestones(applicationId);
  const conditions = await storage.getLoanConditionsByApplication(applicationId);

  const user = await storage.getUser(application.userId);
  const borrowerName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown" : "Unknown";

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

  return {
    applicationId,
    borrowerName,
    currentStage,
    daysInPipeline,
    targetCloseDate: milestones?.targetCloseDate || null,
    conditionsOutstanding,
    conditionsTotal,
    percentComplete,
    nextAction,
    priority,
  };
}
