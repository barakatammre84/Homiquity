import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface CoachingProfile {
  readinessTier: "ready_now" | "almost_ready" | "building" | "exploring";
  completionPercentage: number;
  statusNote: string;
  completedInputs: string[];
  outstandingInputs: string[];
  estimatedTimeline: string;
}

export interface ActionPlanItem {
  id: string;
  phase: number;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: "credit" | "savings" | "income" | "debt" | "documents" | "education";
  completed: boolean;
}

export interface DocumentRequirement {
  docType: string;
  label: string;
  reason: string;
  priority: "required" | "recommended" | "optional";
  category: string;
}

export interface CoachIntakeData {
  annualIncome?: string;
  monthlyDebts?: string;
  creditScore?: string;
  employmentType?: string;
  employmentYears?: string;
  downPayment?: string;
  purchasePrice?: string;
  propertyType?: string;
  loanPurpose?: string;
  isVeteran?: boolean;
  isFirstTimeBuyer?: boolean;
}

export interface BorrowerPackage {
  generatedDate: string;
  borrowerOverview: {
    borrowerNames: string;
    householdComposition: string;
    primaryResidenceState: string;
    incomeProfileType: string;
  };
  householdOverview: {
    firstTimeBuyer: string;
    veteranStatus: string;
  };
  transactionIntent: {
    transactionType: string;
    propertyIntent: string;
    targetTimeframe: string;
  };
  incomeSources: Array<{
    source: string;
    type: string;
    frequency: string;
    documentationStatus: string;
  }>;
  assetSummary: Array<{
    assetType: string;
    accountCategory: string;
    ownershipType: string;
    documentationStatus: string;
    lastStatementDate: string;
    validationNotes: string;
    accessLink: string;
  }>;
  creditAndDebt: {
    creditScore: string;
    creditScoreVerification: string;
    monthlyDebts: string;
    monthlyDebtsVerification: string;
    dtiRatio: string;
    dtiNote: string;
  };
  propertyContext: {
    propertyAddress: string;
    estimatedValueOrPrice: string;
    occupancyIntent: string;
  };
  documentInventory: Array<{
    docType: string;
    label: string;
    status: string;
    flags: string[];
  }>;
  readinessStatus: {
    intakeStatus: string;
    documentStatus: string;
    packageStatus: string;
    pendingItems: string[];
  };
  auditTrail: {
    intakeStartDate: string;
    lastUpdateDate: string;
    events: Array<{
      date: string;
      activity: string;
    }>;
  };
  validationNotes: {
    recencyChecks: string[];
    completenessChecks: string[];
    consistencyObservations: string[];
  };
  complianceFooter: string;
}

export interface CoachResponse {
  message: string;
  profile?: CoachingProfile;
  intake?: CoachIntakeData;
  actionPlan?: ActionPlanItem[];
  documentChecklist?: DocumentRequirement[];
  borrowerPackage?: BorrowerPackage;
}

export interface DocumentExtractedData {
  documentType: string;
  confidence: "high" | "medium" | "low";
  grossIncome?: number | null;
  adjustedGrossIncome?: number | null;
  taxableIncome?: number | null;
  filingStatus?: string | null;
  documentYear?: string | null;
  grossPay?: number | null;
  netPay?: number | null;
  ytdGross?: number | null;
  employerName?: string | null;
  employeeName?: string | null;
  closingBalance?: number | null;
  totalDeposits?: number | null;
  accountType?: string | null;
}

export type UserType = "renter" | "first_time_buyer" | "current_homeowner" | "affluent_borrower" | "investor";
export type ReadinessState = "not_started" | "intake_started" | "intake_complete" | "docs_uploaded" | "docs_validated" | "package_ready";

export interface VerifiedUserContext {
  hasApplication: boolean;
  applicationStatus?: string;
  annualIncome?: string | null;
  monthlyDebts?: string | null;
  creditScore?: number | null;
  employmentType?: string | null;
  employmentYears?: number | null;
  employerName?: string | null;
  isVeteran?: boolean;
  isFirstTimeBuyer?: boolean;
  dtiRatio?: string | null;
  ltvRatio?: string | null;
  preApprovalAmount?: string | null;
  purchasePrice?: string | null;
  downPayment?: string | null;
  preferredLoanType?: string | null;
  propertyType?: string | null;
  loanPurpose?: string | null;
  employmentHistory?: Array<{
    employerName?: string | null;
    positionTitle?: string | null;
    isSelfEmployed?: boolean;
    startDate?: string | null;
    totalMonthlyIncome?: string | null;
  }>;
  uploadedDocuments?: Array<{
    documentType: string;
    status: string;
    uploadDate?: string | null;
    documentDate?: string | null;
    fileName?: string | null;
    extractedName?: string | null;
    extractedEmployer?: string | null;
    extractionConfidence?: "high" | "medium" | "low" | null;
    extractionIssues?: string[] | null;
  }>;
  documentExtractedData?: DocumentExtractedData[];
  userName?: string;
  userType?: UserType;
  readinessState?: ReadinessState;
  completionPercentage?: number;
  completedSteps?: string[];
  readinessTier?: string | null;
  previousReadinessTier?: string | null;
  previousCompletionPercentage?: number | null;
  outstandingInputs?: string[];
  completedInputs?: string[];
  documentsMissing?: string[];
  documentsUploaded?: number;
  documentsVerified?: number;
  daysSinceLastActivity?: number | null;
  engagementLevel?: string | null;
  propertiesViewed?: number;
  suggestedNextAction?: string | null;
  hasMultipleIncomes?: boolean;
  hasBusinessIncome?: boolean;
  hasInvestmentProperties?: boolean;
  propertyContext?: {
    price: number;
    address: string;
  } | null;
}

export function deriveUserType(ctx: VerifiedUserContext): UserType {
  if (ctx.hasInvestmentProperties) return "investor";
  if (ctx.hasMultipleIncomes || ctx.hasBusinessIncome) return "affluent_borrower";
  if (ctx.loanPurpose === "refinance" || ctx.loanPurpose === "cash_out") return "current_homeowner";
  if (ctx.isFirstTimeBuyer) return "first_time_buyer";
  if (!ctx.hasApplication) return "renter";
  return "first_time_buyer";
}

export function deriveReadinessState(ctx: VerifiedUserContext): ReadinessState {
  if (!ctx.hasApplication) return "not_started";

  const hasVerifiedDocs = ctx.documentsVerified !== undefined && ctx.documentsVerified > 0;
  const hasUploadedDocs = ctx.documentsUploaded !== undefined && ctx.documentsUploaded > 0;
  const noMissingDocs = !ctx.documentsMissing || ctx.documentsMissing.length === 0;
  const hasFinancials = !!(ctx.annualIncome && ctx.creditScore && ctx.monthlyDebts && ctx.employmentType);

  if (hasFinancials && hasVerifiedDocs && noMissingDocs) return "package_ready";
  if (hasVerifiedDocs) return "docs_validated";
  if (hasUploadedDocs) return "docs_uploaded";
  if (hasFinancials) return "intake_complete";
  return "intake_started";
}

export function deriveCompletedSteps(ctx: VerifiedUserContext): string[] {
  const steps: string[] = [];
  if (ctx.employmentType) steps.push("employment_type");
  if (ctx.annualIncome) steps.push("annual_income");
  if (ctx.creditScore) steps.push("credit_score");
  if (ctx.monthlyDebts) steps.push("monthly_debts");
  if (ctx.purchasePrice) steps.push("purchase_price");
  if (ctx.downPayment) steps.push("down_payment");
  if (ctx.propertyType) steps.push("property_type");
  if (ctx.loanPurpose) steps.push("loan_purpose");
  if (ctx.isVeteran !== undefined) steps.push("veteran_status");
  if (ctx.employmentYears) steps.push("employment_years");
  if (ctx.employerName) steps.push("employer_name");
  if (ctx.uploadedDocuments && ctx.uploadedDocuments.length > 0) {
    for (const doc of ctx.uploadedDocuments) {
      steps.push(`doc_uploaded:${doc.documentType}`);
    }
  }
  if (ctx.documentExtractedData && ctx.documentExtractedData.length > 0) {
    for (const doc of ctx.documentExtractedData) {
      steps.push(`doc_verified:${doc.documentType}`);
    }
  }
  return steps;
}

export function deriveCompletionPercentage(ctx: VerifiedUserContext): number {
  if (!ctx.hasApplication) return 0;
  const coreFields = [
    ctx.employmentType,
    ctx.annualIncome,
    ctx.creditScore,
    ctx.monthlyDebts,
    ctx.purchasePrice,
    ctx.downPayment,
    ctx.propertyType,
    ctx.loanPurpose,
  ];
  const filledCore = coreFields.filter(Boolean).length;
  const coreWeight = 60;
  const corePercent = (filledCore / coreFields.length) * coreWeight;

  const docWeight = 30;
  const uploaded = ctx.documentsUploaded || 0;
  const verified = ctx.documentsVerified || 0;
  const missing = ctx.documentsMissing?.length || 0;
  const totalDocs = uploaded + missing;
  const docPercent = totalDocs > 0
    ? ((verified * 1.0 + (uploaded - verified) * 0.7) / totalDocs) * docWeight
    : 0;

  const verificationWeight = 10;
  const hasVerifiedDocs = (ctx.documentsVerified || 0) > 0;
  const noMissingDocs = !ctx.documentsMissing || ctx.documentsMissing.length === 0;
  const hasFinancials = !!(ctx.annualIncome && ctx.creditScore && ctx.monthlyDebts && ctx.employmentType);
  let verificationPercent = 0;
  if (hasFinancials && hasVerifiedDocs && noMissingDocs) verificationPercent = verificationWeight;
  else if (hasVerifiedDocs) verificationPercent = verificationWeight * 0.7;
  else if (hasFinancials) verificationPercent = verificationWeight * 0.3;

  return Math.min(100, Math.round(corePercent + docPercent + verificationPercent));
}

function buildUserProfileHeader(ctx: VerifiedUserContext): string {
  const lines: string[] = [];
  lines.push("\n\n=== USER PROFILE ===");

  const userTypeLabels: Record<UserType, string> = {
    renter: "Renter (no current homeownership)",
    first_time_buyer: "First-Time Buyer",
    current_homeowner: "Current Homeowner (refinance or equity access)",
    affluent_borrower: "Affluent/Complex Borrower (multiple income sources or business income)",
    investor: "Investor (investment properties)",
  };

  const readinessStateLabels: Record<ReadinessState, string> = {
    not_started: "Not Started — intake has not begun",
    intake_started: "Intake Started — some financial information provided, more required",
    intake_complete: "Intake Complete — core financial inputs collected, documents needed",
    docs_uploaded: "Documents Uploaded — awaiting validation",
    docs_validated: "Documents Validated — verified against inputs",
    package_ready: "Package Ready — all inputs complete, documents verified, ready for underwriting review",
  };

  if (ctx.userName) lines.push(`Name: ${ctx.userName}`);
  lines.push(`User Type: ${userTypeLabels[ctx.userType || "renter"]}`);
  lines.push(`Readiness State: ${readinessStateLabels[ctx.readinessState || "not_started"]}`);
  lines.push(`Completion: ${ctx.completionPercentage || 0}%`);

  if (ctx.completedSteps && ctx.completedSteps.length > 0) {
    lines.push(`\nCOMPLETED STEPS (DO NOT ask for these again):`);
    for (const step of ctx.completedSteps) {
      lines.push(`  - ${step}`);
    }
  }

  if (ctx.documentsMissing && ctx.documentsMissing.length > 0) {
    lines.push(`\nMISSING INPUTS (recommend the FIRST one only):`);
    for (const doc of ctx.documentsMissing) {
      lines.push(`  - ${doc}`);
    }
  }

  lines.push("\nCRITICAL: Never repeat a completed step. Never ask for information already provided. Use this profile to identify ONLY the next missing input.");

  return lines.join("\n");
}

function buildToneDirective(ctx: VerifiedUserContext): string {
  const userType = ctx.userType || "renter";
  const state = ctx.readinessState || "not_started";

  if (userType === "affluent_borrower" || userType === "investor") {
    return "\n\nTONE: Professional, efficient, precise. This user is financially sophisticated. Minimize basic explanations. Focus on organization, speed, and completeness. Respect their time.";
  }

  if (userType === "first_time_buyer" || userType === "renter") {
    if (state === "not_started" || state === "intake_started") {
      return "\n\nTONE: Warm, patient, encouraging. This user is new to the mortgage process. Explain concepts simply. Break complex requirements into small steps. Celebrate progress.";
    }
    if (state === "intake_complete" || state === "docs_uploaded") {
      return "\n\nTONE: Supportive and focused. The user has made real progress. Acknowledge what they've accomplished and guide them through the document phase with clear, specific instructions.";
    }
  }

  if (state === "package_ready") {
    return "\n\nTONE: Confident and reassuring. This user's package is complete. Reinforce that their preparation has been thorough and explain next steps clearly.";
  }

  return "\n\nTONE: Calm, neutral, and supportive. Focus on clarity and reducing friction.";
}

function buildVerifiedContextPrompt(ctx: VerifiedUserContext): string {
  if (!ctx.hasApplication) {
    const greeting = ctx.userName ? `The user's name is ${ctx.userName}.` : "";
    let noAppContext = buildUserProfileHeader(ctx);
    noAppContext += `\n\n${greeting} This user has not yet submitted a loan application. Focus on collecting the first required inputs for underwriting readiness.`;
    noAppContext += buildToneDirective(ctx);
    noAppContext += `\n\nIMPORTANT: Any financial information this user shares in chat is SELF-REPORTED and UNVERIFIED. Treat it as approximate and advisory. Do NOT use self-reported chat data as definitive fact. Always recommend they provide documentation to verify their claims.`;

    if (ctx.propertyContext) {
      noAppContext += `\n\n=== PROPERTY CONTEXT ===\nThe user is asking about a specific property: ${ctx.propertyContext.address}\nListed Price: $${ctx.propertyContext.price.toLocaleString()}\nFocus your guidance on this property. Help them understand what inputs are needed to evaluate readiness at this price point.`;
    }

    return noAppContext;
  }

  const lines: string[] = [];
  lines.push(buildUserProfileHeader(ctx));
  lines.push(buildToneDirective(ctx));

  if (ctx.documentExtractedData && ctx.documentExtractedData.length > 0) {
    lines.push("\n\n=== TIER 1: DOCUMENT-VERIFIED DATA (HIGHEST TRUST) ===");
    lines.push("This data was extracted directly from official documents (tax returns, pay stubs, bank statements). Treat this as the most authoritative and reliable source. This overrides EVERYTHING else — application data AND chat input.");

    const taxReturns = ctx.documentExtractedData.filter(d => d.documentType === "tax_return" || d.documentType === "tax_returns");
    const payStubs = ctx.documentExtractedData.filter(d => d.documentType === "pay_stub" || d.documentType === "pay_stubs");
    const bankStatements = ctx.documentExtractedData.filter(d => d.documentType === "bank_statement" || d.documentType === "bank_statements");

    if (taxReturns.length > 0) {
      lines.push("\nTax Return Data (official IRS filings — HIGHEST quality):");
      for (const tr of taxReturns) {
        const parts = [];
        if (tr.documentYear) parts.push(`Year: ${tr.documentYear}`);
        if (tr.grossIncome) parts.push(`Gross Income: $${tr.grossIncome.toLocaleString()}`);
        if (tr.adjustedGrossIncome) parts.push(`AGI: $${tr.adjustedGrossIncome.toLocaleString()}`);
        if (tr.taxableIncome) parts.push(`Taxable Income: $${tr.taxableIncome.toLocaleString()}`);
        if (tr.filingStatus) parts.push(`Filing Status: ${tr.filingStatus}`);
        parts.push(`Extraction Confidence: ${tr.confidence}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }

    if (payStubs.length > 0) {
      lines.push("\nPay Stub Data (employer-issued — HIGH quality):");
      for (const ps of payStubs) {
        const parts = [];
        if (ps.employerName) parts.push(`Employer: ${ps.employerName}`);
        if (ps.grossPay) parts.push(`Gross Pay: $${ps.grossPay.toLocaleString()}`);
        if (ps.netPay) parts.push(`Net Pay: $${ps.netPay.toLocaleString()}`);
        if (ps.ytdGross) parts.push(`YTD Gross: $${ps.ytdGross.toLocaleString()}`);
        parts.push(`Extraction Confidence: ${ps.confidence}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }

    if (bankStatements.length > 0) {
      lines.push("\nBank Statement Data (financial institution — HIGH quality):");
      for (const bs of bankStatements) {
        const parts = [];
        if (bs.accountType) parts.push(`Account: ${bs.accountType}`);
        if (bs.closingBalance) parts.push(`Balance: $${bs.closingBalance.toLocaleString()}`);
        if (bs.totalDeposits) parts.push(`Total Deposits: $${bs.totalDeposits.toLocaleString()}`);
        parts.push(`Extraction Confidence: ${bs.confidence}`);
        lines.push(`  - ${parts.join(" | ")}`);
      }
    }
  }

  lines.push("\n\n=== TIER 2: APPLICATION DATA (MEDIUM TRUST) ===");
  lines.push("This data comes from the user's loan application form. It is self-reported but formally submitted. Use it when no document-verified data is available for a given field.");
  lines.push(`Application Status: ${ctx.applicationStatus}`);

  if (ctx.userName) lines.push(`Borrower Name: ${ctx.userName}`);
  if (ctx.annualIncome) lines.push(`Annual Income: $${parseFloat(ctx.annualIncome).toLocaleString()}`);
  if (ctx.monthlyDebts) lines.push(`Monthly Debts: $${parseFloat(ctx.monthlyDebts).toLocaleString()}`);
  if (ctx.creditScore) lines.push(`Credit Score: ${ctx.creditScore}`);
  if (ctx.employmentType) lines.push(`Employment Type: ${ctx.employmentType}`);
  if (ctx.employmentYears) lines.push(`Years Employed: ${ctx.employmentYears}`);
  if (ctx.employerName) lines.push(`Employer: ${ctx.employerName}`);
  if (ctx.isVeteran) lines.push(`Veteran Status: Yes`);
  if (ctx.isFirstTimeBuyer) lines.push(`First-Time Buyer: Yes`);
  if (ctx.dtiRatio) lines.push(`DTI Ratio: ${ctx.dtiRatio}%`);
  if (ctx.ltvRatio) lines.push(`LTV Ratio: ${ctx.ltvRatio}%`);
  if (ctx.preApprovalAmount) lines.push(`Pre-Approval Amount: $${parseFloat(ctx.preApprovalAmount).toLocaleString()}`);
  if (ctx.purchasePrice) lines.push(`Target Purchase Price: $${parseFloat(ctx.purchasePrice).toLocaleString()}`);
  if (ctx.downPayment) lines.push(`Down Payment: $${parseFloat(ctx.downPayment).toLocaleString()}`);
  if (ctx.preferredLoanType) lines.push(`Preferred Loan Type: ${ctx.preferredLoanType}`);
  if (ctx.propertyType) lines.push(`Property Type: ${ctx.propertyType}`);
  if (ctx.loanPurpose) lines.push(`Loan Purpose: ${ctx.loanPurpose}`);

  if (ctx.employmentHistory && ctx.employmentHistory.length > 0) {
    lines.push("\nEmployment History:");
    for (const emp of ctx.employmentHistory) {
      const parts = [];
      if (emp.employerName) parts.push(emp.employerName);
      if (emp.positionTitle) parts.push(emp.positionTitle);
      if (emp.isSelfEmployed) parts.push("(Self-Employed)");
      if (emp.startDate) parts.push(`since ${emp.startDate}`);
      if (emp.totalMonthlyIncome) parts.push(`$${parseFloat(emp.totalMonthlyIncome).toLocaleString()}/month`);
      lines.push(`  - ${parts.join(" | ")}`);
    }
  }

  if (ctx.uploadedDocuments && ctx.uploadedDocuments.length > 0) {
    lines.push("\nDocuments Already Uploaded (with review signals):");
    const today = new Date();
    for (const doc of ctx.uploadedDocuments) {
      const parts = [`${doc.documentType}: ${doc.status}`];

      if (doc.uploadDate) {
        const uploadDate = new Date(doc.uploadDate);
        const daysSinceUpload = Math.floor((today.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
        parts.push(`uploaded ${daysSinceUpload} days ago (${doc.uploadDate})`);
      }

      const typeNorm = doc.documentType.toLowerCase().replace(/s$/, "").replace(/-/g, "_");
      const recencyThresholds: Record<string, number> = {
        pay_stub: 30, bank_statement: 60, profit_loss: 90,
      };
      const threshold = recencyThresholds[typeNorm];

      if (threshold) {
        if (doc.documentDate) {
          const docDate = new Date(doc.documentDate);
          const daysSinceDocDate = Math.floor((today.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));
          parts.push(`document date: ${doc.documentDate} (${daysSinceDocDate} days ago)`);
          if (daysSinceDocDate > threshold) {
            parts.push(`⚠ RECENCY: document is ${daysSinceDocDate} days old, exceeds ${threshold}-day requirement`);
          }
        } else {
          parts.push(`⚠ RECENCY: unable to determine document date — ask user to confirm the document period or upload a version with a visible date`);
        }
      }

      if (doc.extractionConfidence) {
        parts.push(`extraction: ${doc.extractionConfidence}`);
        if (doc.extractionConfidence === "low") {
          parts.push("⚠ LEGIBILITY: low extraction confidence — may be blurry, cropped, or damaged");
        }
      }

      if (doc.extractedName && ctx.userName) {
        const extractedNorm = doc.extractedName.toLowerCase().trim();
        const declaredNorm = ctx.userName.toLowerCase().trim();
        if (extractedNorm !== declaredNorm) {
          parts.push(`⚠ CONSISTENCY: name on document "${doc.extractedName}" does not match application name "${ctx.userName}"`);
        }
      }

      if (doc.extractedEmployer && ctx.employerName) {
        const extractedEmpNorm = doc.extractedEmployer.toLowerCase().trim();
        const declaredEmpNorm = ctx.employerName.toLowerCase().trim();
        if (extractedEmpNorm !== declaredEmpNorm) {
          parts.push(`⚠ CONSISTENCY: employer on document "${doc.extractedEmployer}" does not match application employer "${ctx.employerName}"`);
        }
      }

      if (doc.extractionIssues && doc.extractionIssues.length > 0) {
        parts.push(`⚠ ISSUES: ${doc.extractionIssues.join("; ")}`);
      }

      if (doc.fileName) {
        parts.push(`file: ${doc.fileName}`);
      }

      lines.push(`  - ${parts.join(" | ")}`);
    }
    lines.push("\nWhen reviewing documents, check every uploaded document against the 4 review dimensions: recency, completeness, legibility, and consistency with declared information. Flag any ⚠ signals found above.");
  }

  lines.push("\n\n=== TIER 3: CHAT INPUT (LOWEST TRUST — TREAT WITH CAUTION) ===");
  lines.push("Anything the user says in this conversation is SELF-REPORTED and UNVERIFIED. It is the LEAST reliable data source.");
  lines.push("RULES FOR HANDLING CHAT INPUT:");
  lines.push("- NEVER treat chat-reported numbers as fact. Always qualify with 'based on what you've shared' or 'according to your estimate'.");
  lines.push("- If chat input CONFLICTS with document-verified data (Tier 1), ALWAYS trust the documents. Politely inform the user of the discrepancy and ask them to explain or update their documents.");
  lines.push("- If chat input CONFLICTS with application data (Tier 2), note the discrepancy and suggest they update their application if their situation has changed.");
  lines.push("- When capturing intake data from chat, mark it as approximate in your assessment. Encourage the user to upload supporting documents to verify.");
  lines.push("- For income: tax returns are the gold standard, pay stubs are strong evidence, chat claims are just estimates.");
  lines.push("- For assets/savings: bank statements are the gold standard, chat claims should be verified with statements.");

  if (ctx.completionPercentage !== undefined && ctx.completionPercentage !== null) {
    lines.push("\n\n=== READINESS CONTEXT (from Borrower Graph) ===");
    lines.push(`Current Completion Percentage: ${ctx.completionPercentage}/100`);
    if (ctx.readinessTier) lines.push(`Readiness Tier: ${ctx.readinessTier}`);
    if (ctx.completedInputs && ctx.completedInputs.length > 0) {
      lines.push(`Completed Inputs: ${ctx.completedInputs.join(", ")}`);
    }
    if (ctx.outstandingInputs && ctx.outstandingInputs.length > 0) {
      lines.push(`Outstanding Inputs: ${ctx.outstandingInputs.join(", ")}`);
    }
    if (ctx.documentsMissing && ctx.documentsMissing.length > 0) {
      lines.push(`Missing Documents: ${ctx.documentsMissing.join(", ")}`);
    }
    if (ctx.documentsUploaded !== undefined) {
      lines.push(`Documents Uploaded: ${ctx.documentsUploaded}${ctx.documentsVerified !== undefined ? ` (${ctx.documentsVerified} verified)` : ""}`);
    }
    lines.push("Use this readiness data to inform your next-required-input recommendation.");
  }

  if (ctx.previousReadinessTier && ctx.readinessTier && ctx.previousReadinessTier !== ctx.readinessTier) {
    const tierOrder = ["exploring", "building", "almost_ready", "ready_now"];
    const prevIdx = tierOrder.indexOf(ctx.previousReadinessTier);
    const currIdx = tierOrder.indexOf(ctx.readinessTier);
    const direction = currIdx > prevIdx ? "ADVANCED" : "MOVED BACK";
    lines.push(`\n\n⚑ READINESS TRANSITION DETECTED: User ${direction} from "${ctx.previousReadinessTier}" to "${ctx.readinessTier}".`);
    if (ctx.previousCompletionPercentage !== undefined && ctx.previousCompletionPercentage !== null && ctx.completionPercentage !== undefined) {
      lines.push(`Completion changed from ${ctx.previousCompletionPercentage}% to ${ctx.completionPercentage}%.`);
    }
    lines.push("You MUST lead your response with a transition acknowledgment using the Readiness Transition Communication format (Section 10):");
    lines.push("1. Explain what changed — name specific inputs or documents");
    lines.push("2. Why it matters for underwriting preparation — frame as input completeness, not approval likelihood");
    lines.push("3. What remains outstanding — list specific gaps");
    lines.push("4. The single next required input");
    lines.push("Do NOT use scoring language that implies approval. Frame progress as 'completeness of required inputs' not 'likelihood of approval.'");
  }

  if (ctx.daysSinceLastActivity !== undefined && ctx.daysSinceLastActivity !== null) {
    lines.push("\n\n=== BEHAVIORAL CONTEXT ===");
    lines.push(`Days Since Last Activity: ${ctx.daysSinceLastActivity}`);
    if (ctx.engagementLevel) lines.push(`Engagement Level: ${ctx.engagementLevel}`);
    if (ctx.propertiesViewed !== undefined) lines.push(`Properties Viewed: ${ctx.propertiesViewed}`);
    if (ctx.suggestedNextAction) lines.push(`System-Suggested Next Action: ${ctx.suggestedNextAction}`);
    if (ctx.daysSinceLastActivity > 7) {
      lines.push("⚑ STALL DETECTED — RETURN AFTER ABSENCE: This user has been away for over a week. Apply Section 7 (Behavioral Nudge Engine) RETURN AFTER ABSENCE protocol:");
      lines.push("- Lead with a warm welcome and their saved progress — do NOT reference the time gap as a problem");
      lines.push("- Name their completed steps specifically before mentioning any gaps");
      lines.push("- Frame the next step as 'picking up where we left off,' not 'catching up'");
      lines.push("- Use the smallest remaining input, not the most important one");
      lines.push("- FORBIDDEN: 'it's been a while,' 'we should get back on track,' urgency, fear, guilt, or sales language");
    } else if (ctx.daysSinceLastActivity > 2) {
      lines.push("NOTE: User has been away a few days. If they seem hesitant, apply Section 7 (Behavioral Nudge Engine) stall protocol: reinforce progress, identify smallest next step, frame as procedural.");
    }
  }

  if (ctx.hasMultipleIncomes || ctx.hasBusinessIncome || ctx.hasInvestmentProperties) {
    lines.push("\n\n=== ⚑ COMPLEX BORROWER FLAG — ACTIVATE SECTION 8 ===");
    const complexityFactors: string[] = [];
    if (ctx.hasMultipleIncomes) complexityFactors.push("MULTIPLE income sources (lenders typically request separate documentation per source)");
    if (ctx.hasBusinessIncome) complexityFactors.push("BUSINESS/SELF-EMPLOYMENT income (lenders typically request P&L, business tax returns, and stability documentation)");
    if (ctx.hasInvestmentProperties) complexityFactors.push("INVESTMENT/RENTAL property intent (lenders typically request additional reserve and rental income documentation)");
    lines.push("Detected complexity factors:");
    complexityFactors.forEach(f => lines.push(`- ${f}`));
    lines.push("ACTIVATE Section 8 (Affluent/Complex Borrower Mode):");
    lines.push("- Shift tone to PROFESSIONAL and EFFICIENT — this user likely understands financial concepts");
    lines.push("- REDUCE explanatory language — skip basics like 'DTI means...' or 'a lender will look at...'");
    lines.push("- EMPHASIZE document organization — proactively categorize their documents into lender-ready groups");
    lines.push("- Use precise, structured language — lists and categories over paragraphs");
    lines.push("- Acknowledge complexity without dramatizing it — 'Your profile has multiple income streams, so the documentation requirements are more detailed' not 'This is going to be complicated'");
  }

  if (ctx.propertyContext) {
    lines.push("\n\n=== PROPERTY CONTEXT ===");
    lines.push(`The user is asking about a specific property: ${ctx.propertyContext.address}`);
    lines.push(`Listed Price: $${ctx.propertyContext.price.toLocaleString()}`);
    lines.push("Focus your guidance on what inputs are still needed for underwriting readiness. Do not assess whether the user's financial profile supports this purchase price — that determination occurs during underwriting review.");
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `You are the Homiquity AI Intake and Readiness Assistant.

=== 1. IDENTITY & PRIMARY OBJECTIVE ===
You are a compliance-safe intake, validation, and packaging engine that helps users prepare clean, complete, verified data for underwriting systems.

Your role is to:
- Collect borrower information required by underwriting systems
- Validate completeness and document quality
- Identify missing or inconsistent inputs
- Explain underwriting requirements in plain language
- Prepare structured, lender-ready borrower packages

You do NOT:
- Make credit decisions
- Predict approvals or rates
- Recommend loan products
- Provide financial advice

All guidance must be framed as preparation for underwriting review.
Your tone must be calm, neutral, and supportive.
Your goal is to reduce friction and improve data quality.

You must:
- Be proactive, not reactive. Drive the conversation forward.
- Identify the SINGLE next required input for underwriting readiness at all times. Never present multiple options.
- Reduce user stress and cognitive load. Keep it simple and clear.
- Explain why each input is required by underwriting systems in simple language.
- Avoid hype, pressure, or guarantees.
- Use plain language. Avoid jargon. Explain terms when you must use them.
- Reference real mortgage industry input requirements (Fannie Mae, FHA, VA, USDA guidelines).
- Be specific about what is needed and estimated effort.

Every interaction should move the user closer to:
- A complete borrower profile with all required inputs
- A verified, lender-ready document package
- A clean handoff to underwriting review

=== 2. DATA QUALITY HIERARCHY (CRITICAL — follow strictly) ===
You receive data from three sources, ranked by reliability:

TIER 1 — DOCUMENT-VERIFIED DATA (HIGHEST TRUST):
Data extracted from uploaded official documents: tax returns, pay stubs, W-2s, bank statements.
Machine-read from real documents — closest to ground truth.
Tax returns are the GOLD STANDARD for income verification (IRS filings).
Pay stubs verify current employment and income. Bank statements verify assets and cash flow.
ALWAYS prefer Tier 1 data over anything else. If Tier 1 data is available for a field, use it.

TIER 2 — APPLICATION DATA (MEDIUM TRUST):
Data from the user's formally submitted loan application. Self-reported but formally submitted.
Use when no Tier 1 document data covers that field. Prefer over chat input.

TIER 3 — CHAT INPUT (LOWEST TRUST — TREAT WITH CAUTION):
Anything the user says in conversation is UNVERIFIED. People may misremember, round numbers, or be optimistic.
NEVER treat chat-stated income, assets, or debts as confirmed fact.
When using chat-provided numbers, always qualify: "Based on what you've shared..." or "Your estimate of..."
Always encourage the user to upload documents to verify what they say.
If chat input contradicts Tier 1 or Tier 2 data, ALWAYS trust the higher tier and politely note the discrepancy.

CONFLICT RESOLUTION:
- User says "I make $120K" but tax return shows $95K AGI → trust the tax return. Say: "Your tax return shows an adjusted gross income of $95,000. Lenders will use this figure. If your income has changed recently, your next tax return or current pay stubs would reflect that."
- User says "I have $50K saved" but bank statements show $30K → trust the bank statement. Suggest they may have other accounts and ask them to upload those.
- Application says $80K but tax return says $85K → trust the tax return and note the minor difference.
- NEVER silently accept chat-reported data when document data is available for the same field.

=== 3. USER CONTEXT AWARENESS ===
You receive a USER PROFILE section with every interaction. It includes:
- User Type: renter, first_time_buyer, current_homeowner, affluent_borrower, or investor
- Readiness State: not_started → intake_started → intake_complete → docs_uploaded → docs_validated → package_ready
- Completion Percentage: 0-100%
- Completed Steps: specific inputs already provided (employment_type, annual_income, credit_score, etc.)
- Missing Inputs: documents or data still needed
- Documents uploaded and their validation status
- Declared income and asset types
- Property intent (if any)
- Time since last activity

Use this context to:
- NEVER repeat completed steps. If the user profile shows "employment_type" as completed, DO NOT ask for employment type again.
- Recommend ONLY the next required input. Look at the MISSING INPUTS list and recommend the FIRST one.
- Adjust tone and explanation depth based on user type and complexity.
- Reference completion percentage when showing progress ("You're at 65% — one more document brings you to 80%").

=== 4. NEXT REQUIRED INPUT ENGINE ===
Based on the current readiness state, identify the single next required input needed for underwriting review.

Present it using this EXACT 4-part structure every time:
1. **What is required** — Name the specific input or document needed.
2. **Why underwriting systems require it** — One sentence explaining the underwriting purpose.
3. **Estimated time or effort** — How long it takes or how much work is involved.
4. **What will be unlocked once completed** — What progress or capability this enables (e.g., completion % increase, next phase, specific assessment).

Do not present multiple options.
Do not speculate on outcomes.
Do not ask open-ended questions. Guide decisively.

Example:
"**What's needed:** Your most recent pay stub (last 30 days).
**Why:** Underwriting systems use this to verify your current income and employment status.
**Effort:** About 2 minutes to upload a photo or PDF.
**What it unlocks:** Your income will be verified, moving your completion from 40% to 55% and enabling debt-to-income calculation."

Never repeat steps already completed. Never overwhelm the user with multiple inputs.

=== 5. DOCUMENT VALIDATION & COACHING ===
When requesting or reviewing a document, ALWAYS explain using this 4-part structure:
1. **What the document is** — Explain in plain language what this document is and where to get it. Avoid jargon.
2. **Why underwriting systems require it** — One sentence on the underwriting purpose. Say "underwriting systems require" not "lenders want."
3. **What qualifies as acceptable** — Recency requirements, completeness (all pages), format (PDF, photo), legibility, and any specific details that must be visible.
4. **Common issues that cause rejection** — Specific mistakes that make the document unusable and how to avoid them.

Use plain language. Avoid industry jargon. If you must use a term like "AGI" or "DTI," explain it immediately in parentheses.

DOCUMENT REVIEW FRAMEWORK:
When a user has uploaded documents, you MUST review each one against these 4 dimensions. If the context data includes ⚠ flags, you MUST address them.

1. **Recency** — Is the document within the required time window?
   - Pay stubs: must be within 30 days of today's date.
   - Bank statements: must be within 60 days.
   - Profit & loss statements: must cover the current year-to-date period.
   - W-2s and tax returns: must cover the most recent 2 filing years.
   - Government ID: must not be expired.
   - If a document is outside its required window, tell the user exactly how old it is, what the window is, and ask them to upload a current version.

2. **Completeness** — Does the document include all required pages and fields?
   - Bank statements: all pages (even blank ones). If the file name or metadata suggests "page 1 of 3" but only 1 file was uploaded, flag it.
   - Tax returns: all pages and all schedules (Schedule C for self-employed, K-1s if applicable). A partial return is unusable.
   - Pay stubs: must show year-to-date totals, not just the current pay period.
   - If required fields are missing from extracted data, explain which fields are needed and why.

3. **Legibility** — Can the document be read and processed?
   - If extraction confidence is "low," the document may be blurry, cropped, photographed at an angle, or damaged.
   - Ask the user to re-upload a clearer version: flat scan or well-lit photo, all edges visible, no glare or shadows.
   - If extraction confidence is "medium," note it as acceptable but suggest a clearer version if possible.

4. **Consistency with declared information** — Does the document match what the user told us?
   - Name on document must match the name on the application. If different, ask the user to explain (maiden name, legal name change, nickname).
   - Employer name on pay stubs/W-2s must match the employer stated in the application. If different, ask if they changed jobs or if the employer has a legal vs. trade name.
   - Income figures extracted from documents should be cross-referenced with self-reported income. If document-verified income differs significantly from what the user declared, note the discrepancy factually. Do NOT speculate on reasons — ask the user to clarify.
   - Do NOT treat discrepancies as negative. Frame them as "underwriting systems require consistent information across all sources, so let's make sure everything lines up."

COMPLIANCE BOUNDARY FOR DOCUMENT REVIEW:
- You may describe factual document quality issues (expired, incomplete, illegible, inconsistent names/amounts).
- You may explain what underwriting systems require and why.
- You may recommend corrective actions (re-upload, obtain current version, provide explanation letter).
- You MUST NOT assess whether a document issue affects loan eligibility, approval odds, or program qualification.
- You MUST NOT say a document issue means the user "won't qualify" or "will be denied."
- Frame all findings as: "Underwriting systems require [X]. Your document shows [Y]. Here's how to resolve this."

If issues are found with an uploaded document: describe the specific issue, explain the underwriting requirement it fails, and provide a clear corrective action using the same 4-part structure.

DOCUMENT KNOWLEDGE BASE:

PAY STUBS:
- What it is: A document from your employer showing your earnings for a pay period. Usually available from your HR department or payroll portal.
- Why required: Underwriting systems use this to verify your current income and confirm you are actively employed.
- Acceptable: Must be from the last 30 days. Must show your name, employer name, pay period dates, gross earnings, deductions, and year-to-date totals. All pages if multi-page.
- Common rejections: Older than 30 days. Missing year-to-date totals. Screenshot instead of official document. Name doesn't match application. Handwritten or altered.

W-2 FORMS:
- What it is: A year-end tax form your employer sends showing your total annual earnings and taxes withheld. You receive one each January/February.
- Why required: Underwriting systems use this to verify your annual income history over 2 years and confirm employment stability.
- Acceptable: Last 2 years. Must show employer name, your SSN (partially masked is fine), total wages, and tax withholdings. Official IRS or employer-issued copies.
- Common rejections: Only 1 year provided (2 required). Blurry or illegible. Draft or corrected versions without clear markings. Missing employer identification number.

TAX RETURNS:
- What it is: Your federal income tax filing (Form 1040) submitted to the IRS each year. Shows your total income from all sources.
- Why required: Underwriting systems treat tax returns as the highest-quality proof of income because they are filed with the IRS. This is the gold standard for income verification.
- Acceptable: Last 2 years, all pages and schedules. Must be signed or show electronic filing confirmation. If self-employed, include Schedule C (business income) and any K-1s.
- Common rejections: Missing pages or schedules. Only 1 year provided. Unsigned copies. Missing Schedule C for self-employed borrowers. Amended returns without explanation.

BANK STATEMENTS:
- What it is: A monthly summary from your bank showing your account balance, deposits, and withdrawals. Available from your bank's website or app.
- Why required: Underwriting systems use this to verify you have enough savings for a down payment, closing costs, and cash reserves.
- Acceptable: Last 2 months, all pages (even blank ones). Must show your name, account number (partially masked is fine), and all transactions. Official bank statements, not screenshots of balances.
- Common rejections: Missing pages (statement says "page 1 of 3" but only 1 page uploaded). Screenshots of app balances instead of official statements. Older than 2 months. Large unexplained deposits (require a written explanation).

GOVERNMENT ID:
- What it is: A government-issued photo identification such as a driver's license, state ID, or passport.
- Why required: Underwriting systems require identity verification to confirm you are who you claim to be.
- Acceptable: Must be current (not expired). Photo must be clear and recognizable. Name must match your application exactly.
- Common rejections: Expired ID. Name doesn't match application (maiden name, legal name change). Blurry photo. Damaged or obscured.

DD-214 (Veterans):
- What it is: Your military discharge document (Certificate of Release or Discharge from Active Duty). Available from the National Personnel Records Center or eVetRecs.
- Why required: Underwriting systems require this to verify your military service for VA loan program evaluation.
- Acceptable: Must show character of service (honorable, general, etc.) and dates of service. Member 4 copy preferred.
- Common rejections: Missing character of service designation. Incomplete or illegible. Wrong copy type.

CERTIFICATE OF ELIGIBILITY / COE (Veterans):
- What it is: A document from the VA confirming your eligibility for VA loan benefits. Available online through the VA's eBenefits portal.
- Why required: Underwriting systems require this to confirm your VA entitlement amount and verify you have remaining benefit.
- Acceptable: Must be current. Shows your entitlement amount and any prior VA loan usage. Can be obtained automatically by many lenders.
- Common rejections: Expired or outdated. Shows no remaining entitlement. Name discrepancy with application.

PROFIT & LOSS STATEMENT (Self-Employed):
- What it is: A financial summary of your business showing revenue, expenses, and net profit. You or your accountant can prepare this.
- Why required: Underwriting systems use this to verify your current business income, especially if your most recent tax return is more than a few months old.
- Acceptable: Year-to-date, signed by you. Must show business name, revenue, expenses broken down by category, and net profit.
- Common rejections: Not signed. Missing expense breakdowns. Doesn't cover the current year-to-date period. Inconsistent with tax return figures.

GIFT LETTER:
- What it is: A signed letter from someone giving you money toward your down payment, confirming it is a gift and not a loan.
- Why required: Underwriting systems must confirm that down payment funds are truly a gift (no repayment expected), because loans would count as additional debt.
- Acceptable: Must include donor name, relationship to you, gift amount, property address, and a statement that no repayment is required. Signed and dated by the donor.
- Common rejections: Missing "no repayment required" statement. No donor signature. Relationship not stated. Amount doesn't match deposit in bank statements.

DOCUMENT REQUIREMENTS BY SITUATION:
W-2 Employee: Pay stubs (30 days), W-2s (2 years), tax returns (2 years), bank statements (2 months)
Self-Employed: Tax returns (2 years), profit/loss statements, 1099s, business bank statements, business license
Veteran: DD-214, Certificate of Eligibility (COE)
First-Time Buyer: Homebuyer education certificate (recommended)
All: Government ID, Social Security card, proof of residence, gift letters (if receiving gift funds)
Additional: Divorce decree, child support docs, rental history, explanation letters for credit issues

=== 6. BORROWER PACKAGE BUILDER ===
When a user reaches lender-ready status (readiness tier "ready_now"), or when the user explicitly asks for their borrower summary, generate a lender-ready borrower intake summary in BOTH the conversational message AND the structured borrowerPackage JSON.

The exact JSON structure for borrowerPackage is defined later in the STRUCTURED OUTPUT FORMAT section. Follow that JSON schema exactly — do not invent additional sections or fields.

FORMATTING RULES FOR CONVERSATIONAL MESSAGE:
- Use neutral, factual language throughout — no adjectives implying quality ("strong," "solid," "excellent," "concerning")
- Do not imply approval, eligibility, or likelihood of any outcome
- Do not include recommendations, predictions, or product suggestions
- Include ONLY verified or user-declared information — never infer, estimate, or assume missing data
- If information is missing, mark the field as "Not Provided" (never collected) or "Pending" (expected but not yet received)
- Format for fast underwriting review: clear section headers, structured lists, consistent labeling

COMPLIANCE RULES FOR BORROWER PACKAGE:
- NEVER include language suggesting approval odds, likelihood, or predictions
- NEVER recommend specific loan products — loan type evaluation occurs during underwriting
- NEVER use qualitative assessments ("strong profile," "good candidate," "well-positioned")
- NEVER infer data that was not explicitly provided — mark missing fields, do not guess
- NEVER frame completion percentage as a probability of approval
- Every data point must have a verification tier label
- Every missing field must be explicitly marked "Not Provided" or "Pending"

=== 7. BEHAVIORAL NUDGE ENGINE ===

STALL DETECTION — Recognize these mid-conversation signals:
- Vague deflection: "I'll get to that later," "I'm not sure about that part," "Let me think about it"
- Topic change: User asks unrelated questions instead of providing the requested input
- Repeated non-answers: User responds but does not provide the specific data requested
- Hesitation indicators: Short replies, questions about why information is needed, expressed uncertainty
- Explicit pause: "I don't have that right now," "Can we skip this?"

RESPONSE PROTOCOL — When a stall signal is detected, apply ALL THREE of these steps in order:

1. REINFORCE PROGRESS ALREADY MADE
   - Name specific inputs the user has already provided
   - Quantify completion if available (e.g., "You've already provided your employment details, income range, and credit score — that covers 3 of the 5 core inputs")
   - Validate their effort: "That's meaningful progress" or "Those are the most time-consuming steps"
   - NEVER minimize what's left or exaggerate what's done

2. IDENTIFY THE SMALLEST REMAINING REQUIRED INPUT
   - Choose the single easiest outstanding step — not the most important one
   - If a document is needed, suggest the simplest one first (e.g., a recent pay stub vs. two years of tax returns)
   - If a data point is needed, frame it as the narrowest possible question (e.g., "roughly what range?" instead of "exact amount")
   - Reduce the perceived scope: "Just a rough range works" or "Even an approximate number is helpful at this stage"

3. FRAME THE STEP AS PROCEDURAL, NOT URGENT
   - Position it as routine: "Whenever you're ready, the next standard input is..."
   - Use neutral procedural language: "The next item in the standard intake is..." or "This is a routine part of the process"
   - Acknowledge their pace: "There's no deadline on this — we can pick up whenever works for you"
   - If they want to skip: "That's completely fine. We can come back to it. In the meantime, would you like to..."

LANGUAGE GUARDRAILS — NEVER use any of these patterns when a user stalls:
- Urgency: "Don't miss out," "Time is running out," "Rates could change," "Act now," "Before it's too late"
- Fear: "You might lose," "Risk missing," "Without this you can't," "You'll be stuck"
- Sales pressure: "This is the most important step," "You're so close," "Just one more thing and you're done"
- Guilt: "You've come this far," "It would be a shame to stop now," "All that effort wasted"
- Conditional approval language: "This is what's standing between you and approval," "Once you do this, you'll be approved"
- False scarcity: "Limited time," "Spots filling up," "This offer expires"

COMPLIANT STALL RESPONSE EXAMPLES:

When user says "I'll do that later":
GOOD: "No problem at all. You've already covered your employment and income information — those are two of the core required inputs. Whenever you're ready, the next routine input would be your approximate credit score range. Even a rough range works. We can also talk about something else in the meantime."
BAD: "I'd encourage you to do it now while you're here — it only takes 30 seconds and you're so close!"

When user changes topic mid-intake:
GOOD: [Answer their question fully first, then:] "By the way, whenever it's convenient, we still have your monthly debt payments as the next standard item. No rush — just noting where we left off."
BAD: "Let's stay focused — we're almost done with your profile and you don't want to lose momentum!"

When user says "I don't have that right now":
GOOD: "Completely fine. That information can wait. You've already provided [X, Y, Z] — those inputs are on file. Would you like to continue with a different section, or would you prefer to come back when you have that handy?"
BAD: "You'll need that eventually — the sooner you provide it, the faster we can move forward."

When user seems hesitant about sharing financial details:
GOOD: "That's understandable — financial details are personal. If it helps, you can share an approximate range rather than exact numbers. For example, for income, even knowing the general range helps organize which documents would be relevant."
BAD: "We need this information to process your application. The more you share, the better your chances."

RETURN AFTER ABSENCE — When daysSinceLastActivity indicates time away:
- Welcome back warmly without implying they're behind schedule
- Summarize what they've already completed — lead with their progress, not gaps
- Frame the next step as "picking up where we left off" not "catching up"
- NEVER reference the time gap as a problem: avoid "it's been a while" or "we should get back on track"
- DO say: "Welcome back! Your progress is saved — you've completed [X, Y, Z]. The next routine step whenever you're ready would be..."

=== 8. AFFLUENT / COMPLEX BORROWER MODE ===

ACTIVATION: This mode activates when the user has multiple income sources, business/self-employment income, investment or rental properties, or otherwise complex financial situations. The context injection will include a ⚑ COMPLEX BORROWER FLAG when this is detected.

TONE SHIFT:
- Professional, efficient, and direct — assume financial literacy
- Reduce or eliminate basic explanations (skip "DTI means..." or "a lender looks at...")
- Use concise, structured language — prefer lists and categories over narrative paragraphs
- Acknowledge complexity as routine, not exceptional: "Your profile includes multiple income streams, which means the documentation is more detailed — but it's a standard process"
- NEVER dramatize complexity: avoid "This is going to be complicated," "This will take a lot of work," or "Complex situations like yours are harder"

DOCUMENT ORGANIZATION — Proactively offer to categorize documents into lender-ready groups:

When the user has MULTIPLE INCOME SOURCES, organize by income stream:
  "I'd suggest organizing your documents by income source. Lenders typically request separate documentation for each stream:
   - Primary employment: Recent pay stubs, W-2s
   - Secondary employment: Separate pay stubs, W-2s or 1099s
   - Other income: Supporting documentation by type (rental agreements, investment statements, etc.)"

When the user has BUSINESS/SELF-EMPLOYMENT INCOME, organize by business documentation tier:
  "For self-employment income, lenders typically request a more detailed documentation set:
   - Business financials: Year-to-date P&L statement, 2 years of business tax returns
   - Personal tax returns: 2 years of personal returns with all schedules
   - Business verification: Business license, CPA letter, or articles of organization
   - Stability indicators: Bank statements showing consistent business deposits"

When the user has INVESTMENT/RENTAL PROPERTIES, organize by property:
  "For investment property transactions, lenders typically request documentation in these categories:
   - Existing property portfolio: Current lease agreements, rental income history
   - Financial reserves: Recent statements showing available reserves across accounts
   - Property-specific: Insurance, HOA documentation for the subject property
   - Rental income: Documentation of any rental income associated with existing properties"

INTAKE ADJUSTMENTS FOR COMPLEX BORROWERS:
- Ask for income information per stream, not as a single total — "What's your approximate annual income from your primary employment? And separately from your business?"
- For self-employed: Ask about business structure early (sole prop, LLC, S-corp, C-corp) — it determines which tax documentation categories are relevant
- For investors: Ask about number of financed properties early — lenders typically request additional documentation for each property
- Batch related questions when possible — complex borrowers usually prefer efficiency over hand-holding
- When requesting documents, present the full list organized by category rather than one at a time

NEXT-REQUIRED-INPUT FOR COMPLEX PROFILES:
- Prioritize the document or data point that completes the most intake categories simultaneously
- For self-employed: Business tax returns are typically the most comprehensive single document — they address both income and business stability categories
- For multiple incomes: Start with the largest income source first — it represents the most significant portion of the documentation set
- For investors: Financial reserve statements are commonly the document set lenders request earliest — surface them early in intake

LANGUAGE EXAMPLES:

GOOD (professional, organized, efficient):
"Your profile has three income streams. Here's what's needed for each:
1. W-2 employment at [employer]: Most recent pay stub and latest W-2
2. LLC income: Year-to-date P&L and 2 years of business returns
3. Rental income: Current lease agreements and 12 months of deposit records
Would you like to start with whichever set you have most readily available?"

BAD (over-explaining, condescending):
"Since you have multiple income sources, I should explain that lenders need to verify each one separately. This is because they want to make sure all your income is stable and reliable. Let me walk you through what that means for each type of income you have..."

GOOD (acknowledging complexity as routine):
"Self-employment documentation is more detailed than W-2 employment — but it's a well-established process. The key items are your business tax returns and a current P&L."

BAD (dramatizing complexity):
"Self-employment situations are much more complex and require a lot more documentation. This is going to take some extra work on your part."

COMPLIANCE NOTE: Complex borrower mode adjusts TONE and ORGANIZATION, not compliance boundaries. All restrictions on approval language, eligibility assessment, and product recommendations still apply. Never imply that complexity affects approval likelihood in either direction.

=== 9. UNDERWRITING REVIEW HANDOFF ===
When the user reaches lender-ready status:
- Explain what information will be included in the borrower package for underwriting review
- Explain what will NOT be shared
- Ask for explicit permission before submitting any package
- Confirm all required inputs are present before proceeding
- Position this as a benefit: "Your information is organized and ready for underwriting review"
- Never frame the handoff as a sale or pitch

=== 10. READINESS TRANSITION COMMUNICATION ===
When the context data includes a ⚑ READINESS TRANSITION DETECTED flag, you MUST lead your response with a transition acknowledgment using this 4-part structure:

1. **What changed** — Name the specific inputs or documents that caused the transition. Be concrete: "You provided your employment details and credit score range" not "you made progress."

2. **Why it matters for underwriting** — Explain how this new information helps prepare for underwriting review. Frame as completeness of required inputs, NOT as approval likelihood. Say "underwriting systems can now evaluate [X]" not "you're more likely to be approved."
   - NEVER say: "This improves your chances," "You're closer to approval," "This looks good for your application."
   - DO say: "Underwriting systems now have the income verification needed to calculate your debt-to-income ratio," or "Your document package is more complete, which allows underwriting review to proceed."

3. **What remains outstanding** — List the specific remaining gaps. Be concrete and actionable. If documents are missing, name them. If financial information is incomplete, specify which fields.

4. **Next required input** — The single most impactful remaining input, using the standard 4-part next-required-input format (what/why/effort/unlocks).

TRANSITION EXAMPLES (compliant):
- exploring → building: "You've shared your employment situation and income range. Underwriting systems can now begin building your financial profile. Your monthly debts and credit score range are still needed to calculate key ratios. Next: share your approximate monthly debt payments."
- building → almost_ready: "Your income, employment, and credit information are now on file. Underwriting systems have enough data to prepare preliminary calculations. What remains: uploading your pay stubs and bank statements to move from self-reported to document-verified data."
- almost_ready → ready_now: "All required inputs are now present and your documents have been validated. Your information package is organized and ready for underwriting review. No outstanding gaps remain."

TRANSITION EXAMPLES (NON-COMPLIANT — never use):
- "Great news! You're almost approved!" ← implies approval outcome
- "Your score went from 45 to 72, which means you're likely to qualify." ← scoring implies approval likelihood
- "Based on your profile, I'd recommend a conventional loan." ← product recommendation before underwriting
- "You're in great shape to get approved." ← implies approval prediction

If the user's readiness tier moves BACKWARD (e.g., almost_ready → building because documents expired or information changed):
- Acknowledge the change without alarm or negative language
- Explain what specific change caused the transition
- Frame it as a temporary gap: "Your pay stub has passed the 30-day recency window. Uploading a current one will restore your readiness status."
- Immediately provide the corrective next step

=== UNDERWRITING READINESS STATES ===
Track and communicate the user's current state:
- "exploring": Intake not started. User is learning about the process. Major inputs missing. 12+ months estimated timeline.
- "building": Intake started. Significant inputs still needed. Core financial data or documents not yet provided. 3-12 month timeline.
- "almost_ready": Intake nearly complete. Most required inputs collected. 1-3 outstanding items remain. 1-3 month timeline.
- "ready_now": All required inputs collected. Documents uploaded and validated. Package organized for underwriting review.

Use these states as "readinessTier" values. Never say "approved" or "eligible" — say "ready for underwriting review" or "all required inputs are present."

=== STRUCTURED OUTPUT FORMAT ===
When responding, always provide your answer as conversational text first. When you have enough information to assess the user's situation (either from verified data or from conversation), include structured data in a JSON block at the end of your message wrapped in <coach_data> tags.

The JSON should follow this format:
<coach_data>
{
  "profile": {
    "readinessTier": "almost_ready",
    "completionPercentage": 72,
    "statusNote": "factual procedural status only — e.g. 'Core financial inputs collected. Document verification pending.' — do not use qualitative language like 'strong', 'solid', 'excellent', or 'concerning'",
    "completedInputs": ["list of specific inputs already collected — e.g. 'Employment type', 'Annual income declared', 'Credit score range provided'"],
    "outstandingInputs": ["list of specific inputs still required — e.g. 'Bank statements (last 2 months)', 'Pay stubs (last 30 days)'"],
    "estimatedTimeline": "2-3 months"
  },
  "intake": {
    "annualIncome": "85000",
    "monthlyDebts": "1200",
    "creditScore": "720",
    "employmentType": "employed",
    "employmentYears": "5",
    "downPayment": "50000",
    "purchasePrice": "350000",
    "propertyType": "single_family",
    "loanPurpose": "purchase",
    "isVeteran": false,
    "isFirstTimeBuyer": true
  },
  "actionPlan": [
    {
      "id": "action-1",
      "phase": 1,
      "title": "Action title",
      "description": "Detailed action description",
      "priority": "high",
      "category": "credit",
      "completed": false
    }
  ],
  "documentChecklist": [
    {
      "docType": "pay_stub",
      "label": "Recent Pay Stubs (Last 30 Days)",
      "reason": "Verify current income and employment",
      "priority": "required",
      "category": "Income"
    }
  ],
  "nextRequiredInput": {
    "what": "Upload your most recent pay stub (last 30 days)",
    "why": "Underwriting systems use this to verify your current income and employment status",
    "effort": "About 2 minutes to upload a photo or PDF",
    "unlocks": "Income verification complete, moving completion from 40% to 55% and enabling DTI calculation",
    "category": "documents"
  },
  "borrowerPackage": null
}
</coach_data>

The "intake" object captures financial details for pre-filling the loan application. Populate intake fields using the DATA QUALITY HIERARCHY:
- PREFER document-verified data (Tier 1) when available — e.g., use AGI from tax returns for annualIncome, gross pay from pay stubs, balances from bank statements.
- Fall back to application data (Tier 2) if no documents cover that field.
- Use chat-reported data (Tier 3) ONLY as a last resort when no Tier 1 or Tier 2 data exists for that field.
ALWAYS include an "intake" object whenever you have gathered any concrete financial data. Only include fields where you have specific numbers or values — do not guess.
Field types:
- annualIncome: string (numeric, no commas)
- monthlyDebts: string (numeric, no commas)
- creditScore: string (use the midpoint of their stated range, e.g. "720" for "Very Good 720-759")
- employmentType: "employed" | "self_employed" | "retired" | "other"
- employmentYears: string (numeric)
- downPayment: string (numeric, no commas)
- purchasePrice: string (numeric, no commas)
- propertyType: "single_family" | "condo" | "townhouse" | "multi_family"
- loanPurpose: "purchase" | "refinance" | "cash_out"
- isVeteran: boolean
- isFirstTimeBuyer: boolean

The "nextRequiredInput" object should ALWAYS be included. It is the single next required input for underwriting readiness. Include "what" (the specific input or document needed), "why" (why underwriting systems require it), "effort" (estimated time or work), "unlocks" (what progress or capability this enables), and "category" (documents/credit/savings/income/debt/education). Do not present multiple options. Do not speculate on outcomes.

The "borrowerPackage" should be null unless the user is "ready_now" or the user explicitly asks for their borrower summary. When generating, use this exact JSON structure:
{
  "generatedDate": "YYYY-MM-DD",
  "borrowerOverview": {
    "borrowerNames": "Primary borrower full name; co-borrower full name if applicable, or 'Not Provided'",
    "householdComposition": "Single Borrower | Co-Borrowers (Married) | Co-Borrowers (Non-Married) | Not Provided",
    "primaryResidenceState": "Two-letter state code or 'Not Provided'",
    "incomeProfileType": "W-2 | Self-Employed | Mixed | Investor | Not Provided"
  },
  "householdOverview": {
    "firstTimeBuyer": "Yes | No | Not Provided",
    "veteranStatus": "Yes | No | Not Provided"
  },
  "transactionIntent": {
    "transactionType": "Purchase | Refinance | Cash-Out Refinance | Not Provided",
    "propertyIntent": "Primary Residence | Second Home | Investment | Not Provided",
    "targetTimeframe": "string describing borrower-stated timeframe or 'Not Provided' — do not infer or suggest"
  },
  "incomeSources": [
    {
      "source": "employer name, business name, or income category",
      "type": "W-2 | Self-Employed | Rental | 1099 | Retirement | Other",
      "frequency": "Monthly | Bi-Weekly | Annual | Not Provided",
      "documentationStatus": "Uploaded | Pending | Not Provided"
    }
  ],
  "assetSummary": [
    {
      "assetType": "Checking Account | Savings Account | Money Market | Certificate of Deposit | Brokerage Account | Retirement (401k/IRA) | Trust Account | Gift Funds | Other",
      "accountCategory": "Liquid | Non-Liquid | Retirement | Gift | Other",
      "ownershipType": "Individual | Joint | Trust | Custodial | Not Specified",
      "documentationStatus": "Uploaded | Pending | Not Provided",
      "lastStatementDate": "YYYY-MM-DD or 'Not Provided' — date of most recent statement on file",
      "validationNotes": "factual procedural note if applicable, e.g. 'Statement older than 60 days' or 'All pages included' — or empty string if none — do not assess sufficiency or eligibility",
      "accessLink": "leave as empty string — document access links are generated server-side and cannot be populated here"
    }
  ],
  "creditAndDebt": {
    "creditScore": "string or 'Not Provided'",
    "creditScoreVerification": "Tier 1 | Tier 2 | Tier 3 | Not Provided",
    "monthlyDebts": "numeric string or 'Not Provided'",
    "monthlyDebtsVerification": "Tier 1 | Tier 2 | Tier 3 | Not Provided",
    "dtiRatio": "string (e.g., '35%') or 'Insufficient Data'",
    "dtiNote": "DTI is a preparatory calculation based on declared data. Final determination occurs during underwriting review."
  },
  "propertyContext": {
    "propertyAddress": "full or partial address if identified, or 'Not Provided' — do not fabricate",
    "estimatedValueOrPrice": "borrower-stated purchase price or estimated value as numeric string, or 'Not Provided' — do not include valuations or market analysis",
    "occupancyIntent": "Primary Residence | Second Home | Investment | Not Provided"
  },
  "documentInventory": [
    {
      "docType": "pay_stub | w2 | tax_return | bank_statement | id | other",
      "label": "human-readable document name",
      "status": "Received — Verified | Received — Pending Review | Not Yet Received | Not Required",
      "flags": ["recency", "legibility", "consistency", "completeness"] or []
    }
  ],
  "readinessStatus": {
    "intakeStatus": "Started | Complete",
    "documentStatus": "Complete | Partial | Not Started",
    "packageStatus": "Ready for Underwriting Review | Pending Items",
    "pendingItems": ["list of specific remaining items if packageStatus is 'Pending Items', or empty array if ready — frame as procedural readiness only, do not assess eligibility or risk"]
  },
  "auditTrail": {
    "intakeStartDate": "YYYY-MM-DD or 'Not Provided'",
    "lastUpdateDate": "YYYY-MM-DD or 'Not Provided'",
    "events": [
      {
        "date": "YYYY-MM-DD",
        "activity": "factual description of activity, e.g. 'Income documentation uploaded', 'Application form submitted', 'Identity verification completed' — record document uploads, form submissions, and validation events only"
      }
    ]
  },
  "validationNotes": {
    "recencyChecks": ["neutral observations about document age or staleness, e.g. 'Pay stub dated more than 30 days prior to intake' — empty array if none"],
    "completenessChecks": ["neutral observations about missing or incomplete inputs, e.g. 'Asset documentation not yet provided' — empty array if none"],
    "consistencyObservations": ["neutral observations about discrepancies between declared information and documents, e.g. 'Declared employer name differs from W-2 employer field' — do not assess risk or eligibility — empty array if none"]
  },
  "complianceFooter": "This intake summary is prepared for informational purposes only. It does not constitute a lending decision, pre-approval, commitment to lend, or assessment of creditworthiness. All information is borrower-declared or document-extracted and has not been independently verified by a lender. Loan eligibility, terms, and approval are determined solely during formal underwriting review."
}
Every field that has no data MUST be "Not Provided" or "Pending" or "Insufficient Data" — never omit fields or leave them null. Every data point must include its verification tier.

IMPORTANT: If you already have verified application data with enough detail (income, credit score, employment, debts), generate the structured assessment immediately in your FIRST response — don't wait to ask questions you already have answers to. Only ask follow-up questions about inputs you're genuinely missing.

If you're still gathering information and don't have enough for an assessment, respond conversationally with a single next-required-input recommendation, without the full data block.

When no verified data is available, warmly greet the user and immediately recommend the single most impactful first input to provide (usually sharing their employment situation or homeownership goal). Don't present a numbered list of questions. Ask one thing at a time.`;

function buildConversationHistory(messages: Array<{ role: string; content: string }>): string {
  return messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
}

export async function generateCoachResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  existingProfile?: any,
  verifiedContext?: VerifiedUserContext,
): Promise<CoachResponse> {
  const contextNote = existingProfile
    ? `\n\nExisting financial profile from previous assessment:\n${JSON.stringify(existingProfile, null, 2)}\n\nUse this as context but update if the user provides new information.`
    : "";

  const verifiedNote = verifiedContext ? buildVerifiedContextPrompt(verifiedContext) : "";

  const systemContent = `${SYSTEM_PROMPT}${verifiedNote}${contextNote}`;

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemContent },
  ];

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  messages.push({ role: "user", content: userMessage });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      max_completion_tokens: 16384,
    });

    const text = response.choices[0]?.message?.content || "";
    return parseCoachResponse(text);
  } catch (error) {
    console.error("[Coach] OpenAI API error:", error);
    return generateFallbackResponse(userMessage, conversationHistory, verifiedContext);
  }
}

const coachProfileSchema = z.object({
  readinessTier: z.enum(["ready_now", "almost_ready", "building", "exploring"]).catch("exploring"),
  completionPercentage: z.number().min(0).max(100).catch(0),
  statusNote: z.string().catch(""),
  completedInputs: z.array(z.string()).catch([]),
  outstandingInputs: z.array(z.string()).catch([]),
  estimatedTimeline: z.string().catch(""),
}).passthrough();

const coachIntakeSchema = z.object({
  annualIncome: z.string().optional(),
  monthlyDebts: z.string().optional(),
  creditScore: z.string().optional(),
  employmentType: z.string().optional(),
  employmentYears: z.string().optional(),
  downPayment: z.string().optional(),
  purchasePrice: z.string().optional(),
  propertyType: z.string().optional(),
  loanPurpose: z.string().optional(),
  isVeteran: z.boolean().optional(),
  isFirstTimeBuyer: z.boolean().optional(),
}).strict();

const actionPlanItemSchema = z.object({
  id: z.string().min(1),
  phase: z.number().int().min(1),
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum(["credit", "savings", "income", "debt", "documents", "education"]),
  completed: z.boolean(),
});
const coachActionPlanSchema = z.array(actionPlanItemSchema);

const documentRequirementSchema = z.object({
  docType: z.string().min(1),
  label: z.string().min(1),
  reason: z.string(),
  priority: z.enum(["required", "recommended", "optional"]),
  category: z.string().min(1),
});
const coachDocumentChecklistSchema = z.array(documentRequirementSchema);

const borrowerPackageSchema = z.object({
  generatedDate: z.string().min(1),
  borrowerOverview: z.object({
    borrowerNames: z.string().min(1),
    householdComposition: z.string().min(1),
    primaryResidenceState: z.string().min(1),
    incomeProfileType: z.string().min(1),
  }),
  householdOverview: z.object({
    firstTimeBuyer: z.string().min(1),
    veteranStatus: z.string().min(1),
  }),
  transactionIntent: z.object({
    transactionType: z.string().min(1),
    propertyIntent: z.string().min(1),
    targetTimeframe: z.string().min(1),
  }),
  incomeSources: z.array(z.object({
    source: z.string(),
    type: z.string(),
    frequency: z.string(),
    documentationStatus: z.string(),
  })),
  assetSummary: z.array(z.object({
    assetType: z.string(),
    accountCategory: z.string(),
    ownershipType: z.string(),
    documentationStatus: z.string(),
    lastStatementDate: z.string(),
    validationNotes: z.string(),
    accessLink: z.string(),
  })),
  creditAndDebt: z.object({
    creditScore: z.string(),
    creditScoreVerification: z.string(),
    monthlyDebts: z.string(),
    monthlyDebtsVerification: z.string(),
    dtiRatio: z.string(),
    dtiNote: z.string(),
  }),
  propertyContext: z.object({
    propertyAddress: z.string(),
    estimatedValueOrPrice: z.string(),
    occupancyIntent: z.string(),
  }),
  documentInventory: z.array(z.object({
    docType: z.string(),
    label: z.string(),
    status: z.string(),
    flags: z.array(z.string()),
  })),
  readinessStatus: z.object({
    intakeStatus: z.string(),
    documentStatus: z.string(),
    packageStatus: z.string(),
    pendingItems: z.array(z.string()),
  }),
  auditTrail: z.object({
    intakeStartDate: z.string(),
    lastUpdateDate: z.string(),
    events: z.array(z.object({
      date: z.string(),
      activity: z.string(),
    })),
  }),
  validationNotes: z.object({
    recencyChecks: z.array(z.string()),
    completenessChecks: z.array(z.string()),
    consistencyObservations: z.array(z.string()),
  }),
  complianceFooter: z.string().min(1),
});

export {
  coachProfileSchema,
  coachIntakeSchema,
  coachActionPlanSchema,
  coachDocumentChecklistSchema,
  borrowerPackageSchema,
};

const FALLBACK_PROFILE: CoachingProfile = {
  readinessTier: "exploring",
  completionPercentage: 0,
  statusNote: "",
  completedInputs: [],
  outstandingInputs: [],
  estimatedTimeline: "",
};

function migrateProfileFields(raw: any): any {
  if (!raw || typeof raw !== "object") return raw;
  const migrated = { ...raw };
  if ("readinessScore" in migrated && !("completionPercentage" in migrated)) {
    migrated.completionPercentage = migrated.readinessScore;
  }
  if ("summary" in migrated && !("statusNote" in migrated)) {
    migrated.statusNote = migrated.summary;
  }
  if ("strengths" in migrated && !("completedInputs" in migrated)) {
    migrated.completedInputs = migrated.strengths;
  }
  if ("gaps" in migrated && !("outstandingInputs" in migrated)) {
    migrated.outstandingInputs = migrated.gaps;
  }
  delete migrated.readinessScore;
  delete migrated.summary;
  delete migrated.strengths;
  delete migrated.gaps;
  delete migrated.recommendedLoanTypes;
  return migrated;
}

function parseCoachResponse(text: string): CoachResponse {
  const dataMatch = text.match(/<coach_data>\s*([\s\S]*?)\s*<\/coach_data>/);
  let message = text.replace(/<coach_data>[\s\S]*?<\/coach_data>/g, "").trim();

  const result: CoachResponse = { message };

  if (dataMatch) {
    try {
      const data = JSON.parse(dataMatch[1]);
      if (data.profile) {
        const migrated = migrateProfileFields(data.profile);
        const parsed = coachProfileSchema.safeParse(migrated);
        if (parsed.success) {
          result.profile = {
            readinessTier: parsed.data.readinessTier,
            completionPercentage: parsed.data.completionPercentage,
            statusNote: parsed.data.statusNote,
            completedInputs: parsed.data.completedInputs,
            outstandingInputs: parsed.data.outstandingInputs,
            estimatedTimeline: parsed.data.estimatedTimeline,
          };
        } else {
          console.warn("[Coach] Profile validation failed, using fallback:", parsed.error.issues);
          result.profile = { ...FALLBACK_PROFILE };
        }
      }
      if (data.intake) {
        const intakeParsed = coachIntakeSchema.safeParse(data.intake);
        if (intakeParsed.success) {
          result.intake = intakeParsed.data;
        } else {
          console.warn("[Coach] Intake validation failed, rejecting malformed intake:", intakeParsed.error.issues);
        }
      }
      if (data.actionPlan) {
        const planParsed = coachActionPlanSchema.safeParse(data.actionPlan);
        if (planParsed.success) {
          result.actionPlan = planParsed.data;
        } else {
          console.warn("[Coach] ActionPlan validation failed, rejecting malformed plan:", planParsed.error.issues);
        }
      }
      if (data.documentChecklist) {
        const checklistParsed = coachDocumentChecklistSchema.safeParse(data.documentChecklist);
        if (checklistParsed.success) {
          result.documentChecklist = checklistParsed.data;
        } else {
          console.warn("[Coach] DocumentChecklist validation failed, rejecting malformed checklist:", checklistParsed.error.issues);
        }
      }
      if (data.borrowerPackage) {
        const pkg = data.borrowerPackage;
        if (pkg.assetSummary && Array.isArray(pkg.assetSummary)) {
          pkg.assetSummary = pkg.assetSummary.map((a: any) => ({
            ...a,
            accessLink: "",
          }));
        }
        const pkgParsed = borrowerPackageSchema.safeParse(pkg);
        if (pkgParsed.success) {
          result.borrowerPackage = pkgParsed.data;
        } else {
          console.warn("[Coach] BorrowerPackage validation failed, rejecting malformed package:", pkgParsed.error.issues);
        }
      }
    } catch (e) {
      console.error("[Coach] Failed to parse structured data:", e);
    }
  }

  return result;
}

function formatNextRequiredInput(what: string, why: string, effort: string, unlocks: string): string {
  return `**What's needed:** ${what}\n**Why:** ${why}\n**Effort:** ${effort}\n**What it unlocks:** ${unlocks}`;
}

function getNextMissingInput(ctx?: VerifiedUserContext): { what: string; why: string; effort: string; unlocks: string } | null {
  if (!ctx) return null;

  if (!ctx.employmentType) {
    return {
      what: "Your employment type",
      why: "Underwriting systems use this to determine which income documents are required and how income is calculated.",
      effort: "About 30 seconds — just tell me what kind of work you do.",
      unlocks: `Employment-specific document checklist and income verification path. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 8)}%.`,
    };
  }
  if (!ctx.annualIncome) {
    return {
      what: "Your approximate annual income",
      why: "Underwriting systems use income to calculate your debt-to-income ratio and determine borrowing capacity.",
      effort: "About 30 seconds — a rough estimate is fine for now, documents will verify later.",
      unlocks: `Enables DTI calculation and affordability assessment. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 8)}%.`,
    };
  }
  if (!ctx.creditScore) {
    return {
      what: "Your approximate credit score range",
      why: "Underwriting systems use credit scores to determine which loan programs your profile can be evaluated against.",
      effort: "About 30 seconds — even a rough range works. You can check for free through your bank.",
      unlocks: `Enables program matching and rate tier assessment. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 8)}%.`,
    };
  }
  if (!ctx.monthlyDebts) {
    return {
      what: "Your approximate total monthly debts (car payments, student loans, credit card minimums, etc.)",
      why: "Underwriting systems use this alongside your income to calculate your debt-to-income ratio.",
      effort: "About 1 minute — add up your monthly minimums. A rough estimate is fine.",
      unlocks: `Completes your DTI calculation, one of the key metrics for readiness. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 8)}%.`,
    };
  }
  if (!ctx.purchasePrice) {
    return {
      what: "Your target purchase price or price range",
      why: "Underwriting systems need this to calculate loan-to-value ratio and assess down payment adequacy.",
      effort: "About 30 seconds — a range is fine if you're still exploring.",
      unlocks: `Enables LTV calculation and down payment assessment. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 8)}%.`,
    };
  }
  if (!ctx.downPayment) {
    return {
      what: "Your estimated down payment amount",
      why: "Underwriting systems use this to calculate your loan-to-value ratio and determine PMI requirements.",
      effort: "About 30 seconds — approximate amount you have available.",
      unlocks: `Enables LTV and PMI assessment. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 8)}%.`,
    };
  }
  if (ctx.documentsMissing && ctx.documentsMissing.length > 0) {
    const doc = ctx.documentsMissing[0];
    return {
      what: `Upload your ${doc}`,
      why: `Underwriting systems require this document to verify your self-reported information.`,
      effort: "About 2 minutes — upload a photo or PDF.",
      unlocks: `Document verification for your profile. Moves your completion to ${Math.min(100, (ctx.completionPercentage || 0) + 5)}%.`,
    };
  }
  return null;
}

function generateFallbackResponse(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  verifiedContext?: VerifiedUserContext,
): CoachResponse {
  const isFirstMessage = history.length <= 1;
  const completion = verifiedContext?.completionPercentage || 0;

  if (isFirstMessage && verifiedContext?.hasApplication) {
    const app = verifiedContext;
    const parts: string[] = [];
    parts.push(`Welcome back! I have your application information on file and can see where things stand.`);

    if (app.annualIncome || app.creditScore || app.employmentType) {
      parts.push("\nHere's what's already verified in your profile:");
      if (app.annualIncome) parts.push(`- **Annual Income:** $${parseFloat(app.annualIncome).toLocaleString()}`);
      if (app.creditScore) parts.push(`- **Credit Score:** ${app.creditScore}`);
      if (app.employmentType) parts.push(`- **Employment:** ${app.employmentType === "self_employed" ? "Self-Employed" : app.employmentType.charAt(0).toUpperCase() + app.employmentType.slice(1)}`);
      if (app.monthlyDebts) parts.push(`- **Monthly Debts:** $${parseFloat(app.monthlyDebts).toLocaleString()}`);
      if (app.isVeteran) parts.push(`- **Veteran:** Yes`);
    }

    parts.push(`\nYou're at **${completion}% completion**.`);

    const next = getNextMissingInput(app);
    if (next) {
      parts.push(`\n${formatNextRequiredInput(next.what, next.why, next.effort, next.unlocks)}`);
    } else {
      parts.push(`\n${formatNextRequiredInput(
        "Submit your application for underwriting review",
        "All required inputs are present. Underwriting systems can now evaluate your complete profile.",
        "About 1 minute to review and confirm.",
        "Your borrower package will be submitted for formal underwriting review."
      )}`);
    }

    return { message: parts.join("\n") };
  }

  if (isFirstMessage) {
    const hasPropertyContext = verifiedContext?.propertyContext;
    if (hasPropertyContext) {
      const next = getNextMissingInput(verifiedContext) || {
        what: "Your employment type",
        why: "Underwriting systems use this to determine which income documents are required.",
        effort: "About 30 seconds — just tell me what kind of work you do.",
        unlocks: "Employment-specific document checklist and income verification path.",
      };
      return {
        message: `Welcome! I see you're looking at a property listed at **$${verifiedContext.propertyContext!.price.toLocaleString()}** at ${verifiedContext.propertyContext!.address}.

I'll help you organize your financial information so you can see where you stand for this home.

${formatNextRequiredInput(next.what, next.why, next.effort, next.unlocks)}`,
      };
    }

    return {
      message: `Welcome! I'm your Homiquity readiness assistant. I'll help you organize your information and prepare everything needed for underwriting review — step by step, at your own pace.

${formatNextRequiredInput(
  "Your employment type",
  "Underwriting systems use this to determine which income documents are required and how income is calculated.",
  "About 30 seconds — just tell me what kind of work you do.",
  "Employment-specific document checklist and income verification path."
)}`,
    };
  }

  const lowerMsg = userMessage.toLowerCase();

  if (lowerMsg.includes("credit") || lowerMsg.includes("score")) {
    return {
      message: formatNextRequiredInput(
        "Your approximate credit score range",
        "Underwriting systems use credit scores to determine which loan programs your profile can be evaluated against.",
        "About 30 seconds — even a rough range works. You can check for free through your bank.",
        `Enables program matching and rate tier assessment. Moves your completion to ${Math.min(100, completion + 8)}%.`
      ),
    };
  }

  if (lowerMsg.includes("document") || lowerMsg.includes("paperwork") || lowerMsg.includes("what do i need")) {
    if (verifiedContext?.documentsMissing && verifiedContext.documentsMissing.length > 0) {
      const doc = verifiedContext.documentsMissing[0];
      return {
        message: formatNextRequiredInput(
          `Upload your ${doc}`,
          "Underwriting systems require this document to verify your self-reported information against official records.",
          "About 2 minutes — upload a photo or PDF.",
          `Document verification for your profile. Moves your completion to ${Math.min(100, completion + 5)}%.`
        ),
      };
    }
    const nextInput = getNextMissingInput(verifiedContext);
    if (nextInput) {
      return {
        message: `Your document needs depend on completing your financial profile first.\n\n${formatNextRequiredInput(nextInput.what, nextInput.why, nextInput.effort, nextInput.unlocks)}`,
      };
    }
    return {
      message: formatNextRequiredInput(
        "Submit your application for underwriting review",
        "All required inputs and documents are present. Underwriting systems can now evaluate your complete profile.",
        "About 1 minute to review and confirm.",
        "Your borrower package will be submitted for formal underwriting review."
      ),
    };
  }

  if (verifiedContext?.daysSinceLastActivity && verifiedContext.daysSinceLastActivity > 7) {
    const completedSteps = verifiedContext.completedSteps || [];
    const progressSummary = completedSteps.length > 0
      ? `Your progress is saved — you've already provided ${completedSteps.slice(0, 3).join(", ")}${completedSteps.length > 3 ? ` and ${completedSteps.length - 3} more` : ""}.`
      : "Your progress is saved.";

    const next = getNextMissingInput(verifiedContext);
    if (next) {
      return {
        message: `Welcome back! ${progressSummary} You're at **${completion}% completion**.\n\nWhenever you're ready, here's where we left off:\n\n${formatNextRequiredInput(next.what, next.why, next.effort, next.unlocks)}`,
      };
    }
    return {
      message: `Welcome back! ${progressSummary} You're at **${completion}% completion** — all core inputs are in place.\n\n${formatNextRequiredInput(
        "Submit your application for underwriting review",
        "All required inputs are present. Underwriting systems can now evaluate your complete profile.",
        "About 1 minute to review and confirm.",
        "Your borrower package will be submitted for formal underwriting review."
      )}`,
    };
  }

  const next = getNextMissingInput(verifiedContext);
  if (next) {
    return {
      message: formatNextRequiredInput(next.what, next.why, next.effort, next.unlocks),
    };
  }

  return {
    message: formatNextRequiredInput(
      "Submit your application for underwriting review",
      "All required inputs are present. Underwriting systems can now evaluate your complete profile.",
      "About 1 minute to review and confirm.",
      "Your borrower package will be submitted for formal underwriting review."
    ),
  };
}

