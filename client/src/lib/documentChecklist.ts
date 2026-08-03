import {
  User,
  DollarSign,
  Building2,
  CreditCard,
  Home,
  Shield,
  FileText,
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { titleCaseFromSnake } from "@/lib/formatters";
import { canonicalDocumentType } from "@shared/documentTypes";
import type { Document } from "@shared/schema";

export type DocumentStatus = "needed" | "uploaded" | "verifying" | "verified" | "rejected";

// Personalized checklist item as served by /document-checklist (built from the
// pipeline engine's loan_conditions — see server/services/documentChecklist.ts).
export interface ChecklistItemView {
  id: string;
  source: "condition" | "standard" | "task";
  conditionId?: string;
  category: string;
  documentType: string;
  acceptedTypes: string[];
  label: string;
  description?: string;
  required: boolean;
  status: DocumentStatus;
  documentId?: string;
  fileName?: string;
  uploadedAt?: string;
  rejectionReason?: string | null;
}

// One row model feeding one row component, whichever path produced it — the
// static catalog and the personalized checklist must never render differently.
export interface DocRow {
  /** Readable key used in data-testids (document type). */
  key: string;
  /** Identifies THIS row's in-flight upload (unique per row). */
  uploadKey: string;
  /** documentType POSTed on upload. */
  uploadType: string;
  name: string;
  description?: string;
  required: boolean;
  status: DocumentStatus;
  fileName?: string;
  uploadedAt?: string | Date | null;
  documentId?: string;
  rejectionReason?: string | null;
  focused?: boolean;
}

// Document categories with their required document types
export const DOCUMENT_CATEGORIES = [
  {
    id: "identity",
    name: "Identity & Compliance",
    description: "Government-issued ID and identity verification",
    icon: User,
    color: "text-chart-1",
    bgColor: "bg-chart-1/10",
    documents: [
      { type: "drivers_license", name: "Driver's License", required: true, description: "Valid state-issued driver's license" },
      { type: "passport", name: "Passport", required: false, description: "Valid passport (alternative to driver's license)" },
      { type: "ssn_card", name: "Social Security Card", required: false, description: "Social Security card if available" },
    ]
  },
  {
    id: "income",
    name: "Income Verification",
    description: "Pay stubs, tax returns, and employment documents",
    icon: DollarSign,
    color: "text-chart-2",
    bgColor: "bg-chart-2/10",
    documents: [
      { type: "paystub", name: "Recent Pay Stubs", required: true, description: "Last 30 days of pay stubs" },
      { type: "w2", name: "W-2 Forms", required: true, description: "W-2s from the last 2 years" },
      { type: "tax_return_1040", name: "Tax Returns (1040)", required: true, description: "Personal tax returns from last 2 years" },
      { type: "1099_misc", name: "1099 Forms", required: false, description: "1099 forms if you have additional income" },
      { type: "profit_loss_statement", name: "Profit & Loss Statement", required: false, description: "For self-employed borrowers" },
      { type: "social_security_award_letter", name: "Social Security Award Letter", required: false, description: "If receiving Social Security income" },
    ]
  },
  {
    id: "assets",
    name: "Assets & Savings",
    description: "Bank statements, retirement accounts, and investments",
    icon: Building2,
    color: "text-chart-4",
    bgColor: "bg-chart-4/10",
    documents: [
      { type: "bank_statement_checking", name: "Checking Account Statements", required: true, description: "Last 2 months of statements" },
      { type: "bank_statement_savings", name: "Savings Account Statements", required: true, description: "Last 2 months of statements" },
      { type: "retirement_statement_401k", name: "401(k) Statement", required: false, description: "Most recent quarterly statement" },
      { type: "retirement_statement_ira", name: "IRA Statement", required: false, description: "Most recent quarterly statement" },
      { type: "brokerage_statement", name: "Brokerage Statement", required: false, description: "Investment account statements" },
      { type: "gift_letter", name: "Gift Letter", required: false, description: "If receiving gift funds for down payment" },
    ]
  },
  {
    id: "liabilities",
    name: "Current Debts",
    description: "Existing mortgages, loans, and credit obligations",
    icon: CreditCard,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    documents: [
      { type: "mortgage_statement", name: "Mortgage Statement", required: false, description: "Current mortgage payment info (if applicable)" },
      { type: "auto_loan_statement", name: "Auto Loan Statement", required: false, description: "Current auto loan info (if applicable)" },
      { type: "student_loan_statement", name: "Student Loan Statement", required: false, description: "Student loan payment info (if applicable)" },
      { type: "credit_card_statement", name: "Credit Card Statements", required: false, description: "Most recent statements" },
    ]
  },
  {
    id: "property",
    name: "Property & Transaction",
    description: "Purchase contract, insurance, and property documents",
    icon: Home,
    color: "text-chart-5",
    bgColor: "bg-chart-5/10",
    documents: [
      { type: "purchase_contract", name: "Purchase Contract", required: true, description: "Signed purchase agreement" },
      { type: "earnest_money_receipt", name: "Earnest Money Receipt", required: true, description: "Proof of earnest money deposit" },
      { type: "homeowners_insurance_binder", name: "Homeowners Insurance Binder", required: true, description: "Proof of insurance coverage" },
      { type: "appraisal_report", name: "Appraisal Report", required: false, description: "Provided by lender" },
      { type: "title_commitment", name: "Title Commitment", required: false, description: "Provided by title company" },
    ]
  },
];

// Workflow-triggered education: after an upload, tell the borrower what the
// team actually does with that document, keyed by category. Factual process
// descriptions only — no approval promises or timelines we can't keep.
export const UPLOAD_NEXT_STEPS: Record<string, string> = {
  identity:
    "We'll use this to confirm your identity — a standard step for every mortgage. You'll be notified once it's verified.",
  income:
    "Our team will use this to verify your income, which is what turns your estimated numbers into a documented pre-approval. You'll be notified when it's reviewed.",
  assets:
    "We'll review this to document your funds for the down payment and closing costs. If we have questions about any deposits, we'll reach out — that's routine.",
  liabilities:
    "We'll use this to confirm your monthly payments so your debt-to-income numbers are accurate. You'll be notified when it's reviewed.",
  property:
    "This moves your file forward toward final review. We'll let you know if the underwriter needs anything else about the property.",
};

// Friendly names for document types, falling back to prettified snake_case for
// condition-required types that aren't in the static catalog (e.g. a letter of
// explanation added by an underwriter).
const DOC_TYPE_NAMES: Record<string, string> = Object.fromEntries(
  DOCUMENT_CATEGORIES.flatMap((cat) => cat.documents.map((d) => [d.type, d.name])),
);

export function docTypeName(type: string): string {
  return DOC_TYPE_NAMES[type] ?? titleCaseFromSnake(type);
}

export function getUploadNextStep(docType: string): string {
  const category = DOCUMENT_CATEGORIES.find(cat =>
    cat.documents.some(d => d.type === docType)
  );
  return (
    (category && UPLOAD_NEXT_STEPS[category.id]) ||
    "We'll review it shortly. You'll be notified when it's processed."
  );
}

// Category shells for the personalized path — same visual system as the
// static catalog (CONDITION_CATEGORIES vocabulary from the pipeline engine).
export const CONDITION_CATEGORY_META: Record<
  string,
  { name: string; description: string; icon: typeof User; color: string; bgColor: string }
> = {
  income: { name: "Income Verification", description: "Pay stubs, tax returns, and employment documents", icon: DollarSign, color: "text-chart-2", bgColor: "bg-chart-2/10" },
  assets: { name: "Assets & Savings", description: "Bank statements, gift funds, and reserves", icon: Building2, color: "text-chart-4", bgColor: "bg-chart-4/10" },
  credit: { name: "Credit & Liabilities", description: "Statements and explanations for credit items", icon: CreditCard, color: "text-chart-3", bgColor: "bg-chart-3/10" },
  property: { name: "Property & Transaction", description: "Contract, appraisal, and property documents", icon: Home, color: "text-chart-5", bgColor: "bg-chart-5/10" },
  insurance: { name: "Insurance", description: "Homeowners and other required coverage", icon: Shield, color: "text-chart-1", bgColor: "bg-chart-1/10" },
  title: { name: "Title", description: "Title and closing documentation", icon: FileText, color: "text-chart-4", bgColor: "bg-chart-4/10" },
  compliance: { name: "Identity & Compliance", description: "Government-issued ID and identity verification", icon: User, color: "text-chart-1", bgColor: "bg-chart-1/10" },
  other: { name: "Other Requests", description: "Additional items your loan team asked for", icon: ClipboardList, color: "text-chart-2", bgColor: "bg-chart-2/10" },
};

export function groupDocumentsByType(documents: Document[]): Record<string, Document[]> {
  return documents.reduce((acc, doc) => {
    if (!acc[doc.documentType]) {
      acc[doc.documentType] = [];
    }
    acc[doc.documentType].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);
}

// A required item is pending when nothing was uploaded OR the latest upload
// bounced (rejected latest = action still needed, not "complete").
export function countPendingCatalogDocs(
  docs: { type: string; required: boolean }[],
  documentsByType: Record<string, Document[]>,
): number {
  return docs.filter((d) => {
    if (!d.required) return false;
    const uploaded = documentsByType[d.type];
    return !uploaded?.length || uploaded[0]?.status === "rejected";
  }).length;
}

export function countPendingChecklistItems(items: ChecklistItemView[]): number {
  return items.filter((i) => i.status === "needed" || i.status === "rejected").length;
}

// Group personalized items into the same visual category cards the static
// catalog uses (unknown categories fold into "other").
export function buildPersonalizedGroups(items: ChecklistItemView[]): Map<string, ChecklistItemView[]> {
  const groups = new Map<string, ChecklistItemView[]>();
  for (const item of items) {
    const cat = CONDITION_CATEGORY_META[item.category] ? item.category : "other";
    const group = groups.get(cat) ?? [];
    group.push(item);
    groups.set(cat, group);
  }
  return groups;
}

export function rowFromChecklistItem(item: ChecklistItemView, focusedConditionId: string | null): DocRow {
  return {
    key: item.documentType,
    uploadKey: item.id,
    uploadType: item.documentType,
    name: item.label,
    description: item.description,
    required: item.required,
    status: item.status,
    fileName: item.fileName,
    uploadedAt: item.uploadedAt,
    documentId: item.documentId,
    rejectionReason: item.rejectionReason,
    focused: !!focusedConditionId && item.conditionId === focusedConditionId,
  };
}

export function rowFromCatalogDoc(
  docType: { type: string; name: string; description: string; required: boolean },
  documentsByType: Record<string, Document[]>,
  focusTypes: Set<string>,
): DocRow {
  const uploadedDocs = documentsByType[docType.type] || [];
  // The dashboard document list is newest-first, so the latest upload of a
  // type is [0] — [length - 1] was the OLDEST, which froze the row on a
  // re-upload's stale status.
  const latestDoc = uploadedDocs[0];
  return {
    key: docType.type,
    uploadKey: docType.type,
    uploadType: docType.type,
    name: docType.name,
    description: docType.description,
    required: docType.required,
    status: latestDoc ? ((latestDoc.status as DocumentStatus) || "uploaded") : "needed",
    fileName: latestDoc?.fileName,
    uploadedAt: latestDoc?.createdAt,
    documentId: latestDoc?.id,
    rejectionReason: latestDoc?.rejectionReason,
    focused: focusTypes.has(canonicalDocumentType(docType.type)),
  };
}

export interface StatusInfo {
  icon: typeof CheckCircle2;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  title: string;
  subtitle: string;
  badgeText: string;
  badgeColor: string;
}

export function getChecklistStatusInfo(isAllCaughtUp: boolean, pendingCount: number): StatusInfo {
  if (isAllCaughtUp) {
    return {
      icon: CheckCircle2,
      iconColor: "text-success-subtle-foreground",
      bgColor: "bg-success/20",
      borderColor: "border-border/30",
      title: "You're all caught up!",
      subtitle: "All currently requested documents have been submitted",
      badgeText: "Complete",
      badgeColor: "bg-success text-success-foreground",
    };
  } else if (pendingCount <= 3) {
    return {
      icon: Clock,
      iconColor: "text-warning-subtle-foreground",
      bgColor: "bg-warning/20",
      borderColor: "border-border/30",
      title: "Almost there!",
      subtitle: `${pendingCount} document${pendingCount > 1 ? "s" : ""} still needed`,
      badgeText: "Action Needed",
      badgeColor: "bg-warning text-warning-foreground",
    };
  }
  return {
    icon: AlertCircle,
    iconColor: "text-destructive",
    bgColor: "bg-destructive/20",
    borderColor: "border-border/30",
    title: "Documents needed",
    subtitle: `${pendingCount} documents still required`,
    badgeText: "Pending",
    badgeColor: "bg-destructive text-destructive-foreground",
  };
}

export interface CategoryStatus {
  text: string;
  color: string;
}

export function getCategoryStatus(requiredCount: number, pendingInCategory: number): CategoryStatus {
  if (requiredCount === 0) {
    return { text: "Optional", color: "bg-muted text-muted-foreground" };
  }
  if (pendingInCategory === 0) {
    return { text: "Complete", color: "bg-success-subtle text-success-subtle-foreground" };
  }
  if (pendingInCategory === 1) {
    return { text: "1 needed", color: "bg-warning-subtle text-warning-subtle-foreground" };
  }
  return { text: `${pendingInCategory} needed`, color: "bg-warning-subtle text-warning-subtle-foreground" };
}
