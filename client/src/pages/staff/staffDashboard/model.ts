// Staff-dashboard data model: queue/pipeline/compliance types, the stage and
// compliance catalogs, filter options, and role→default-tab routing.
// Extracted verbatim from StaffDashboard.tsx.
import { Zap, Bot, ArrowRight, ScanLine, Brain } from "lucide-react";
import { type SlaStatus } from "@/lib/sla";

export interface QueueTask {
  id: string;
  applicationId: string;
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  triggerSource?: string;
  ownerRole?: string;
  slaClass?: string;
  slaDueAt?: string;
  escalationLevel?: number;
  status: string;
  priority?: string;
  createdAt?: string;
  assignedToUserId?: string;
  slaStatus: SlaStatus;
  timeRemaining: number | null;
  percentageElapsed: number | null;
}

export interface PipelineSummary {
  applicationId: string;
  currentStage: string;
  priority: "urgent" | "high" | "normal";
  daysInPipeline: number;
  estimatedClosingDays: number;
  completionPercentage: number;
  documentsRequired: number;
  documentsReceived: number;
  conditionsTotal: number;
  conditionsCleared: number;
  lastActivityAt: Date;
  assignedLO: string | null;
  targetCloseDate: Date | null;
  borrowerName?: string;
  loanAmount?: string;
}

export interface QueueData {
  total: number;
  byPriority: {
    urgent: number;
    high: number;
    normal: number;
  };
  byStage: Record<string, PipelineSummary[]>;
  queue: PipelineSummary[];
}

export interface ComplianceData {
  total: number;
  gseReady: number;
  ulddCompliant: number;
  needsAttention: number;
  applications: {
    applicationId: string;
    borrowerName: string;
    status: string;
    loanAmount: number | null;
    score: number;
    gseReady: boolean;
    gseGatingFailed?: boolean;
    ulddCompliant: boolean;
    qmStatus?: "QM" | "Non-QM" | "Unknown";
    criticalCount: number;
    warningCount: number;
    missingDocsCount: number;
    coApplicantCount?: number;
    coApplicants?: { borrowerSequenceNumber: number; name: string | null }[];
  }[];
}

export interface RetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number | null;
  legalBasis: string;
  regulatoryReference: string;
}

export interface RetentionReport {
  generatedAt: string;
  policies: RetentionPolicy[];
  recordCounts: Record<string, number>;
  archiveEligibleCounts: Record<string, number>;
  deleteEligibleCounts: Record<string, number>;
  retentionReviewCounts: Record<string, number>;
  recommendations: string[];
}

// Stage labels come from getStatusLabel — the pipeline stage IS
// application.status, and LoanPipeline renders the same value.

export function coApplicantNames(
  coApplicants?: { borrowerSequenceNumber: number; name: string | null }[]
): string[] {
  if (!coApplicants) return [];
  return coApplicants.map((co, i) => {
    const trimmed = co.name?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : `Co-applicant #${i + 1}`;
  });
}

export const STAGE_ORDER = [
  "pre_approved",
  "doc_collection",
  "processing",
  "underwriting",
  "conditional",
  "clear_to_close",
  "funded",
];

export const COMPLIANCE_CHECKLIST_ITEMS = [
  { id: "le_issued", label: "Loan Estimate Issued", regulation: "TRID - within 3 business days of application", stage: "pre_approved" },
  { id: "intent_to_proceed", label: "Intent to Proceed Received", regulation: "TRID - required before charging fees", stage: "pre_approved" },
  { id: "income_verified", label: "Income Verification", regulation: "ATR/QM Rule - Ability to Repay", stage: "doc_collection" },
  { id: "asset_verified", label: "Asset Verification", regulation: "Fannie Mae B3-4 / Freddie Mac 5501", stage: "doc_collection" },
  { id: "employment_verified", label: "Employment Verification", regulation: "Fannie Mae B3-3 / VOIE", stage: "processing" },
  { id: "credit_report_pulled", label: "Credit Report Obtained", regulation: "FCRA - Fair Credit Reporting Act", stage: "processing" },
  { id: "appraisal_ordered", label: "Appraisal Ordered", regulation: "FIRREA / Dodd-Frank Section 1471", stage: "underwriting" },
  { id: "title_search", label: "Title Search Complete", regulation: "ALTA Best Practices", stage: "underwriting" },
  { id: "flood_cert", label: "Flood Certification", regulation: "National Flood Insurance Act", stage: "underwriting" },
  { id: "mismo_valid", label: "MISMO 3.4 Data Complete", regulation: "GSE Submission Requirement", stage: "conditional" },
  { id: "cd_issued", label: "Closing Disclosure Issued", regulation: "TRID - 3 business days before closing", stage: "clear_to_close" },
  { id: "final_review", label: "Final Underwriting Review", regulation: "QC/QA Requirements", stage: "clear_to_close" },
];

export const AUTOMATION_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  "AUTO_RULE": { label: "Auto-triggered by rule engine", icon: Zap },
  "STAGE_TRANSITION": { label: "Triggered by stage change", icon: ArrowRight },
  "DOCUMENT_UPLOAD": { label: "Auto-detected from document", icon: ScanLine },
  "SYSTEM": { label: "System automated", icon: Bot },
  "AI_EXTRACTION": { label: "AI-extracted data", icon: Brain },
};

export const documentCategories = [
  { value: "tax_return", label: "Tax Return" },
  { value: "w2", label: "W-2 Form" },
  { value: "pay_stub", label: "Pay Stub" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "id", label: "Government ID" },
  { value: "other", label: "Other Document" },
];

export const documentYears = ["2025", "2024", "2023", "2022"];

export const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function getRoleDefaultTab(role: string): string {
  switch (role) {
    case "underwriter":
      return "conditions";
    case "processor":
    case "loa":
      return "my-queue";
    case "lo":
    case "broker":
      return "pipeline";
    default:
      return "pipeline";
  }
}
