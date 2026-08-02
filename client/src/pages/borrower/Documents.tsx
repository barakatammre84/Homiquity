import { useState, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDate, titleCaseFromSnake } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pickWorkableLoanApplication } from "@shared/schema";
import type { Document, LoanApplication, LoanCondition } from "@shared/schema";
import { canonicalDocumentType } from "@shared/documentTypes";
import { validateUploadFile } from "@shared/uploads";
import { PageShell } from "@/components/PageShell";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { DocumentDropzone, UploadProgressCard } from "@/components/DocumentDropzone";
import { QueryErrorState } from "@/components/ui/query-boundary";
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  Circle,
  AlertCircle,
  User,
  DollarSign,
  Building2,
  CreditCard,
  Home,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Clock,
  Shield,
  ClipboardList,
} from "lucide-react";

interface DashboardData {
  documents: Document[];
}

// Document categories with their required document types
const DOCUMENT_CATEGORIES = [
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
const UPLOAD_NEXT_STEPS: Record<string, string> = {
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

function docTypeName(type: string): string {
  return DOC_TYPE_NAMES[type] ?? titleCaseFromSnake(type);
}

function getUploadNextStep(docType: string): string {
  const category = DOCUMENT_CATEGORIES.find(cat =>
    cat.documents.some(d => d.type === docType)
  );
  return (
    (category && UPLOAD_NEXT_STEPS[category.id]) ||
    "We'll review it shortly. You'll be notified when it's processed."
  );
}

// Personalized checklist item as served by /document-checklist (built from the
// pipeline engine's loan_conditions — see server/services/documentChecklist.ts).
interface ChecklistItemView {
  id: string;
  source: "condition" | "standard" | "task";
  conditionId?: string;
  category: string;
  documentType: string;
  acceptedTypes: string[];
  label: string;
  description?: string;
  required: boolean;
  status: "needed" | "uploaded" | "verifying" | "verified" | "rejected";
  documentId?: string;
  fileName?: string;
  uploadedAt?: string;
  rejectionReason?: string | null;
}

// Category shells for the personalized path — same visual system as the
// static catalog (CONDITION_CATEGORIES vocabulary from the pipeline engine).
const CONDITION_CATEGORY_META: Record<
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

// One row model feeding one row component, whichever path produced it — the
// static catalog and the personalized checklist must never render differently.
interface DocRow {
  /** Readable key used in data-testids (document type). */
  key: string;
  /** Identifies THIS row's in-flight upload (unique per row). */
  uploadKey: string;
  /** documentType POSTed on upload. */
  uploadType: string;
  name: string;
  description?: string;
  required: boolean;
  status: "needed" | "uploaded" | "verifying" | "verified" | "rejected";
  fileName?: string;
  uploadedAt?: string | Date | null;
  documentId?: string;
  rejectionReason?: string | null;
  focused?: boolean;
}

function DocumentItemRow({
  row,
  uploading,
  uploadingFile,
  progress,
  anyUploadBusy,
  onFile,
  onBrowse,
  onCancel,
}: {
  row: DocRow;
  uploading: boolean;
  uploadingFile: { fileName: string; fileSize: number } | null;
  progress: number;
  anyUploadBusy: boolean;
  onFile: (file: File) => void;
  onBrowse: () => void;
  onCancel: () => void;
}) {
  const hasUpload = row.status !== "needed";
  const isRejected = row.status === "rejected";
  // Pending items and bounced items invite a (re-)upload right in the row;
  // accepted/in-review items stay calm.
  const showDropzone = !uploading && (!hasUpload || isRejected);

  return (
    <div
      className={`p-4 rounded-lg transition-colors ${
        isRejected
          ? "bg-destructive/5"
          : hasUpload
          ? "bg-success-subtle/50"
          : row.required
          ? "bg-warning-subtle/50"
          : "bg-muted/30"
      } ${row.focused ? "ring-2 ring-primary" : ""}`}
      data-testid={`row-doctype-${row.key}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          {isRejected ? (
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          ) : hasUpload ? (
            <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground shrink-0" />
          ) : row.required ? (
            <AlertCircle className="h-5 w-5 text-warning-subtle-foreground shrink-0" />
          ) : (
            <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{row.name}</span>
              {row.required && !hasUpload && (
                <Badge variant="outline" className="text-xs border-border text-warning-subtle-foreground">
                  Required
                </Badge>
              )}
              {row.required && hasUpload && !isRejected && (
                <Badge variant="outline" className="text-xs border-border text-success-subtle-foreground">
                  Complete
                </Badge>
              )}
            </div>
            {row.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{row.description}</p>
            )}
            {hasUpload && (
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {row.fileName && (
                  <span className="flex items-center gap-1">
                    <FileCheck className="h-3 w-3" />
                    {row.fileName}
                  </span>
                )}
                {row.uploadedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(row.uploadedAt)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  <DocumentStatusBadge status={row.status} data-testid={`badge-doc-status-${row.key}`} />
                </span>
              </div>
            )}
            {isRejected && row.rejectionReason && (
              <p
                className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive"
                data-testid={`text-reject-reason-${row.key}`}
              >
                {row.rejectionReason} — please upload a new copy.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {hasUpload && row.documentId && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5"
              data-testid={`button-download-${row.key}`}
              onClick={() => window.open(`/api/documents/${row.documentId}/download`, "_blank")}
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">View</span>
            </Button>
          )}
          {hasUpload && !isRejected && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              data-testid={`button-upload-${row.key}`}
              disabled={anyUploadBusy}
              onClick={onBrowse}
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Replace</span>
            </Button>
          )}
        </div>
      </div>
      {uploading && uploadingFile && (
        <div className="mt-3">
          <UploadProgressCard
            fileName={uploadingFile.fileName}
            fileSize={uploadingFile.fileSize}
            progress={progress}
            onCancel={onCancel}
            data-testid={`upload-progress-${row.key}`}
          />
        </div>
      )}
      {showDropzone && (
        <div className="mt-3">
          <DocumentDropzone
            compact
            disabled={anyUploadBusy}
            onFileAccepted={onFile}
            idleLabel={
              isRejected
                ? "Upload a new copy — drag & drop, or browse"
                : `Drag & drop your ${row.name.toLowerCase()}, or browse`
            }
            data-testid={`dropzone-${row.key}`}
          />
        </div>
      )}
    </div>
  );
}

export default function Documents() {
  const { isLoading: authLoading } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["income", "assets"]);
  const [activeDocType, setActiveDocType] = useState<{ type: string; rowKey: string } | null>(null);
  // The row whose file is in flight — it swaps its dropzone for the live
  // progress card. One upload at a time keeps the page state honest.
  // rowKey identifies the ROW (two personalized items can accept one type).
  const [activeUpload, setActiveUpload] = useState<{
    rowKey: string;
    docType: string;
    fileName: string;
    fileSize: number;
  } | null>(null);
  const cancelledRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadFile, isUploading, progress, cancel } = useUpload();

  const {
    data,
    isLoading,
    isError: docsError,
    error: docsErrorObj,
    refetch: refetchDocs,
  } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  // Condition-focus mode: the pipeline's per-condition "Upload" button links
  // here with ?condition=<id>. Resolve it through the same pipeline endpoint
  // the Loan Progress page uses (one deterministic source), then spotlight the
  // document types that clear it. Uploads of a matching type flip the
  // condition to "submitted" server-side (matchUploadedDocumentToConditions).
  const search = useSearch();
  const conditionId = new URLSearchParams(search).get("condition");

  // Always know the borrower's open application (not just in focus mode):
  // registrations carry its id so uploads land on the loan file explicitly.
  // This MUST skip closed files — the list is newest-created-first, so taking
  // [0] attached uploads to a denied/withdrawn/funded loan whenever the
  // borrower's most recent file was the closed one.
  const { data: myApps } = useQuery<LoanApplication[]>({
    queryKey: ["/api/loan-applications"],
    enabled: !authLoading,
  });
  const focusAppId = pickWorkableLoanApplication(myApps ?? [])?.id;

  const { data: focusPipeline, isLoading: focusLoading } = useQuery<{ conditions: LoanCondition[] }>({
    queryKey: ["/api/loan-applications", focusAppId, "pipeline"],
    enabled: !!conditionId && !!focusAppId,
  });

  // Personalized checklist: same endpoint the messaging surface uses, now
  // built from the pipeline engine's loan_conditions (self-employed borrowers
  // see P&L/business items). Falls back to the static catalog below when the
  // application has no document-bearing conditions or there's no application.
  const { data: checklistData } = useQuery<{ documents: ChecklistItemView[] }>({
    queryKey: ["/api/applications", focusAppId, "document-checklist"],
    enabled: !!focusAppId && !authLoading,
  });
  const personalizedItems = (checklistData?.documents ?? []).filter(
    (i) =>
      i.source === "condition" ||
      // Custom document-request tasks join the list, but internal review
      // tasks surface with documentType "other" and are staff work, not
      // borrower uploads — same rule as outstandingItems() in
      // UploadDocumentDialog.
      (i.source === "task" && i.documentType !== "other"),
  );
  const personalized = personalizedItems.some((i) => i.source === "condition");

  const focusedCondition = conditionId
    ? (focusPipeline?.conditions ?? []).find((c) => c.id === conditionId) ?? null
    : null;
  // Canonical set so catalog types ("paystub") match condition requirements
  // ("pay_stub") — same bridge the server-side auto-matcher uses.
  const focusTypes = new Set(
    (focusedCondition?.requiredDocumentTypes ?? []).map(canonicalDocumentType),
  );

  // Open the categories that contain the spotlighted document types.
  useEffect(() => {
    if (!focusedCondition) return;
    const types = new Set(focusedCondition.requiredDocumentTypes ?? []);
    const cats = DOCUMENT_CATEGORIES.filter((c) => c.documents.some((d) => types.has(d.type))).map(
      (c) => c.id,
    );
    if (cats.length) {
      setExpandedCategories((prev) => Array.from(new Set([...prev, ...cats])));
    }
  }, [focusedCondition?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUploadClick = (docType: string, rowKey: string = docType) => {
    setActiveDocType({ type: docType, rowKey });
    fileInputRef.current?.click();
  };

  // One shared upload path for every affordance on this page (row dropzones,
  // Replace buttons, the condition-focus banner): validate → presigned PUT
  // with real byte-level progress → JSON registration.
  const startUpload = async (docType: string, file: File, rowKey: string = docType) => {
    if (isUploading) {
      toast({
        title: "One upload at a time",
        description: "Let the current file finish (or cancel it), then try again.",
      });
      return;
    }
    const check = validateUploadFile(file);
    if (!check.ok) {
      toast({ title: "That file won't work", description: check.message, variant: "destructive" });
      return;
    }
    cancelledRef.current = false;
    setActiveUpload({ rowKey, docType, fileName: file.name, fileSize: file.size });
    try {
      const response = await uploadFile(file);
      if (!response) {
        // A user cancel resets quietly; a real failure gets an honest toast.
        if (!cancelledRef.current) {
          toast({
            title: "Upload didn't complete",
            description: "The file never reached storage. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }
      try {
        await apiRequest("POST", "/api/documents/upload", {
          objectPath: response.objectPath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          documentType: docType,
          ...(focusAppId ? { applicationId: focusAppId } : {}),
        });
      } catch {
        // Never claim success on a failed registration — that's how files get lost.
        toast({
          title: "Upload didn't complete",
          description: "The file reached storage but couldn't be filed on your loan. Please try again.",
          variant: "destructive",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      // Refresh pipeline data too — a matching upload moves the focused
      // condition to "submitted" and the banner should say so.
      queryClient.invalidateQueries({ queryKey: ["/api/loan-applications"] });
      if (focusAppId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/applications", focusAppId, "document-checklist"],
        });
      }
      toast({ title: "Document uploaded", description: getUploadNextStep(docType) });
    } finally {
      setActiveUpload(null);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const picked = activeDocType;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setActiveDocType(null);
    if (!file || !picked) return;
    await startUpload(picked.type, file, picked.rowKey);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // A server failure on the dashboard query used to render the checklist as if
  // nothing was submitted (all "pending") — show an honest error + retry (ux-01).
  if (docsError) {
    return (
      <PageShell width="wide" title="Document Checklist" subtitle="Submit required documents as requested — we may ask for more as your application progresses">
        <QueryErrorState
          error={docsErrorObj}
          onRetry={() => refetchDocs()}
          title="We couldn't load your documents"
          data-testid="documents-error"
        />
      </PageShell>
    );
  }

  const documents = data?.documents || [];

  // Create a map of uploaded documents by type
  const documentsByType = documents.reduce((acc, doc) => {
    if (!acc[doc.documentType]) {
      acc[doc.documentType] = [];
    }
    acc[doc.documentType].push(doc);
    return acc;
  }, {} as Record<string, Document[]>);

  // Calculate current status - count pending required items
  const allRequiredDocs = DOCUMENT_CATEGORIES.flatMap(cat =>
    cat.documents.filter(d => d.required)
  );
  // A required item is pending when nothing was uploaded OR the latest upload
  // bounced (rejected latest = action still needed, not "complete").
  const pendingRequiredDocs = allRequiredDocs.filter(d => {
    const docs = documentsByType[d.type];
    return !docs?.length || docs[0]?.status === "rejected";
  });
  // Personalized mode counts the pipeline's own items instead.
  const personalizedPending = personalizedItems.filter(
    (i) => i.status === "needed" || i.status === "rejected",
  ).length;
  const pendingCount = personalized ? personalizedPending : pendingRequiredDocs.length;
  const isAllCaughtUp = pendingCount === 0;

  // Group personalized items into the same visual category cards the static
  // catalog uses (unknown categories fold into "other").
  const personalizedGroups = new Map<string, ChecklistItemView[]>();
  if (personalized) {
    for (const item of personalizedItems) {
      const cat = CONDITION_CATEGORY_META[item.category] ? item.category : "other";
      const group = personalizedGroups.get(cat) ?? [];
      group.push(item);
      personalizedGroups.set(cat, group);
    }
  }

  const rowFromItem = (item: ChecklistItemView): DocRow => ({
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
    focused: !!conditionId && item.conditionId === conditionId,
  });

  // Determine status message and styling
  const getStatusInfo = () => {
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
    } else {
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
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelected}
        data-testid="input-file-upload"
      />
      <PageShell width="wide" title="Document Checklist" subtitle="Submit required documents as requested — we may ask for more as your application progresses">
        {/* Condition-focus banner: arrived from a specific outstanding item */}
        {conditionId && focusedCondition && (
          <Card
            className={
              focusedCondition.status === "outstanding"
                ? "mb-6 border-primary/50"
                : "mb-6"
            }
            data-testid="card-condition-focus"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">
                  {focusedCondition.status === "outstanding"
                    ? `Uploading for: ${focusedCondition.title}`
                    : focusedCondition.status === "submitted"
                      ? `Under review: ${focusedCondition.title}`
                      : `Cleared: ${focusedCondition.title}`}
                </CardTitle>
              </div>
              {focusedCondition.description && (
                <CardDescription>{focusedCondition.description}</CardDescription>
              )}
            </CardHeader>
            {focusedCondition.status === "outstanding" ? (
              <CardContent className="space-y-3">
                {(focusedCondition.requiredDocumentTypes ?? []).length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Any one of these documents can clear this item — it moves to
                      "Under Review" automatically the moment a match is uploaded.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {(focusedCondition.requiredDocumentTypes ?? []).map((type) => (
                        <Button
                          key={type}
                          size="sm"
                          variant="outline"
                          onClick={() => handleUploadClick(type)}
                          disabled={isUploading}
                          data-testid={`button-focus-upload-${type}`}
                        >
                          <Upload className="mr-1.5 h-3.5 w-3.5" />
                          {docTypeName(type)}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Your loan team will review this item — no specific document is
                    mapped to it, but you can upload anything relevant below.
                  </p>
                )}
              </CardContent>
            ) : (
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {focusedCondition.status === "submitted"
                    ? "Your upload is with the team — nothing more is needed on this item right now."
                    : "This item is done. Anything still outstanding is listed below."}
                </p>
              </CardContent>
            )}
          </Card>
        )}
        {conditionId && !focusedCondition && !focusLoading && myApps && (
          <div className="mb-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground" data-testid="text-condition-gone">
            That item is no longer on your list — the checklist below is current.
          </div>
        )}

        {/* Status Summary */}
        <div className={`mb-6 inline-flex items-center gap-4 rounded-xl px-5 py-3 ${statusInfo.bgColor} border ${statusInfo.borderColor}`} data-testid="status-summary">
          <StatusIcon className={`h-8 w-8 ${statusInfo.iconColor}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-foreground" data-testid="status-title">{statusInfo.title}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusInfo.badgeColor}`}>
                {statusInfo.badgeText}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{statusInfo.subtitle}</p>
          </div>
        </div>

        <div className="space-y-4">
        {personalized
          ? [...personalizedGroups.entries()].map(([catId, items]) => {
              const meta = CONDITION_CATEGORY_META[catId];
              const CategoryIcon = meta.icon;
              const pendingInGroup = items.filter(
                (i) => i.status === "needed" || i.status === "rejected",
              ).length;
              return (
                <Card key={catId} className="shadow-lg border-0" data-testid={`card-category-${catId}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-lg ${meta.bgColor}`}>
                          <CategoryIcon className={`h-5 w-5 ${meta.color}`} />
                        </div>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {meta.name}
                            {pendingInGroup === 0 && (
                              <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />
                            )}
                          </CardTitle>
                          <CardDescription>{meta.description}</CardDescription>
                        </div>
                      </div>
                      <Badge
                        className={
                          pendingInGroup === 0
                            ? "bg-success-subtle text-success-subtle-foreground"
                            : "bg-warning-subtle text-warning-subtle-foreground"
                        }
                      >
                        {pendingInGroup === 0 ? "Complete" : `${pendingInGroup} needed`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="border-t pt-4">
                      <div className="space-y-3">
                        {items.map((item) => {
                          const row = rowFromItem(item);
                          return (
                            <DocumentItemRow
                              key={item.id}
                              row={row}
                              uploading={activeUpload?.rowKey === row.uploadKey}
                              uploadingFile={activeUpload}
                              progress={progress}
                              anyUploadBusy={isUploading}
                              onFile={(file) => startUpload(row.uploadType, file, row.uploadKey)}
                              onBrowse={() => handleUploadClick(row.uploadType, row.uploadKey)}
                              onCancel={() => {
                                cancelledRef.current = true;
                                cancel();
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          : DOCUMENT_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const isExpanded = expandedCategories.includes(category.id);

          // Calculate category status
          const requiredInCategory = category.documents.filter(d => d.required);
          const pendingInCategory = requiredInCategory.filter(d => {
            const docs = documentsByType[d.type];
            return !docs?.length || docs[0]?.status === "rejected";
          }).length;
          const uploadedCount = category.documents.filter(d => documentsByType[d.type]?.length > 0).length;

          const allCaughtUp = pendingInCategory === 0;
          const hasUploads = uploadedCount > 0;

          // Category status badge
          const getCategoryStatus = () => {
            if (requiredInCategory.length === 0) {
              return { text: "Optional", color: "bg-muted text-muted-foreground" };
            }
            if (allCaughtUp) {
              return { text: "Complete", color: "bg-success-subtle text-success-subtle-foreground" };
            }
            if (pendingInCategory === 1) {
              return { text: "1 needed", color: "bg-warning-subtle text-warning-subtle-foreground" };
            }
            return { text: `${pendingInCategory} needed`, color: "bg-warning-subtle text-warning-subtle-foreground" };
          };

          const categoryStatus = getCategoryStatus();

          return (
            <Card key={category.id} className="shadow-lg border-0" data-testid={`card-category-${category.id}`}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${category.bgColor}`}>
                      <CategoryIcon className={`h-5 w-5 ${category.color}`} />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {category.name}
                        {allCaughtUp && requiredInCategory.length > 0 && (
                          <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />
                        )}
                      </CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={categoryStatus.color}>
                      {categoryStatus.text}
                    </Badge>
                    {hasUploads && !isExpanded && (
                      <Badge variant="secondary" className="text-xs">
                        {category.documents.filter(d => documentsByType[d.type]?.length > 0).length} uploaded
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <div className="space-y-3">
                      {category.documents.map((docType) => {
                        const uploadedDocs = documentsByType[docType.type] || [];
                        // The dashboard document list is newest-first, so the
                        // latest upload of a type is [0] — [length - 1] was the
                        // OLDEST, which froze the row on a re-upload's stale status.
                        const latestDoc = uploadedDocs[0];
                        const row: DocRow = {
                          key: docType.type,
                          uploadKey: docType.type,
                          uploadType: docType.type,
                          name: docType.name,
                          description: docType.description,
                          required: docType.required,
                          status: latestDoc
                            ? ((latestDoc.status as DocRow["status"]) || "uploaded")
                            : "needed",
                          fileName: latestDoc?.fileName,
                          uploadedAt: latestDoc?.createdAt,
                          documentId: latestDoc?.id,
                          rejectionReason: latestDoc?.rejectionReason,
                          focused: focusTypes.has(canonicalDocumentType(docType.type)),
                        };
                        return (
                          <DocumentItemRow
                            key={row.key}
                            row={row}
                            uploading={activeUpload?.rowKey === row.uploadKey}
                            uploadingFile={activeUpload}
                            progress={progress}
                            anyUploadBusy={isUploading}
                            onFile={(file) => startUpload(row.uploadType, file, row.uploadKey)}
                            onBrowse={() => handleUploadClick(row.uploadType, row.uploadKey)}
                            onCancel={() => {
                              cancelledRef.current = true;
                              cancel();
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {/* Uploaded Documents Summary */}
        {documents.length > 0 && (
          <Card className="shadow-lg border-0 mt-8" data-testid="card-all-documents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                All Uploaded Documents
              </CardTitle>
              <CardDescription>
                {documents.length} document{documents.length !== 1 ? "s" : ""} in your file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Document Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        File Name
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Uploaded
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b transition-colors hover:bg-muted/50"
                        data-testid={`row-document-${doc.id}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <FileCheck className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium capitalize">
                              {doc.documentType.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm">{doc.fileName}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-muted-foreground">
                            {formatDate(doc.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <DocumentStatusBadge status={doc.status} />
                          {doc.status === "rejected" && doc.rejectionReason && (
                            <p className="mt-1 max-w-[240px] text-xs text-destructive">
                              {doc.rejectionReason}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-2"
                            data-testid={`button-download-doc-${doc.id}`}
                            onClick={() => window.open(`/api/documents/${doc.id}/download`, "_blank")}
                          >
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      </PageShell>
    </>
  );
}
