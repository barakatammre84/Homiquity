import { useState, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { Document, LoanApplication, LoanCondition } from "@shared/schema";
import { canonicalDocumentType } from "@shared/documentTypes";
import { PageShell } from "@/components/PageShell";
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
  return DOC_TYPE_NAMES[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
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

function getStatusBadge(status: string) {
  switch (status) {
    case "verified":
      return <Badge className="bg-success-subtle text-success-subtle-foreground">Verified</Badge>;
    case "rejected":
      return <Badge variant="destructive">Rejected</Badge>;
    case "pending_review":
      return <Badge className="bg-warning-subtle text-warning-subtle-foreground">Under Review</Badge>;
    default:
      return <Badge variant="secondary">Uploaded</Badge>;
  }
}


export default function Documents() {
  const { isLoading: authLoading } = useAuth();
  const [expandedCategories, setExpandedCategories] = useState<string[]>(["income", "assets"]);
  const [activeDocType, setActiveDocType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();

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

  const { data: myApps } = useQuery<LoanApplication[]>({
    queryKey: ["/api/loan-applications"],
    enabled: !!conditionId && !authLoading,
  });
  const focusAppId = myApps?.[0]?.id;

  const { data: focusPipeline, isLoading: focusLoading } = useQuery<{ conditions: LoanCondition[] }>({
    queryKey: ["/api/loan-applications", focusAppId, "pipeline"],
    enabled: !!conditionId && !!focusAppId,
  });

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

  const handleUploadClick = (docType: string) => {
    setActiveDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocType) return;

    const response = await uploadFile(file);
    if (response) {
      const registered = await fetch("/api/documents/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          objectPath: response.objectPath,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          documentType: activeDocType,
        }),
      });
      if (registered.ok) {
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
        // Refresh pipeline data too — a matching upload moves the focused
        // condition to "submitted" and the banner should say so.
        queryClient.invalidateQueries({ queryKey: ["/api/loan-applications"] });
        toast({ title: "Document uploaded", description: getUploadNextStep(activeDocType) });
      } else {
        // Never claim success on a failed registration — that's how files get lost.
        toast({
          title: "Upload didn't complete",
          description: "The file reached storage but couldn't be filed on your loan. Please try again.",
          variant: "destructive",
        });
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setActiveDocType(null);
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
      <PageShell fullHeight width="wide" title="Document Checklist" subtitle="Submit required documents as requested — we may ask for more as your application progresses">
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
  const pendingRequiredDocs = allRequiredDocs.filter(d =>
    !documentsByType[d.type]?.length
  );
  const pendingCount = pendingRequiredDocs.length;
  const isAllCaughtUp = pendingCount === 0;

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
      <PageShell fullHeight width="wide" title="Document Checklist" subtitle="Submit required documents as requested — we may ask for more as your application progresses">
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
        {DOCUMENT_CATEGORIES.map((category) => {
          const CategoryIcon = category.icon;
          const isExpanded = expandedCategories.includes(category.id);

          // Calculate category status
          const requiredInCategory = category.documents.filter(d => d.required);
          const pendingInCategory = requiredInCategory.filter(d =>
            !documentsByType[d.type]?.length
          ).length;
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
                        const hasUpload = uploadedDocs.length > 0;
                        const latestDoc = uploadedDocs[uploadedDocs.length - 1];

                        return (
                          <div
                            key={docType.type}
                            className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
                              hasUpload
                                ? "bg-success-subtle/50"
                                : docType.required
                                ? "bg-warning-subtle/50"
                                : "bg-muted/30"
                            } ${focusTypes.has(canonicalDocumentType(docType.type)) ? "ring-2 ring-primary" : ""}`}
                            data-testid={`row-doctype-${docType.type}`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {hasUpload ? (
                                <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground shrink-0" />
                              ) : docType.required ? (
                                <AlertCircle className="h-5 w-5 text-warning-subtle-foreground shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{docType.name}</span>
                                  {docType.required && !hasUpload && (
                                    <Badge variant="outline" className="text-xs border-border text-warning-subtle-foreground">
                                      Required
                                    </Badge>
                                  )}
                                  {docType.required && hasUpload && (
                                    <Badge variant="outline" className="text-xs border-border text-success-subtle-foreground">
                                      Complete
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {docType.description}
                                </p>
                                {hasUpload && latestDoc && (
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <FileCheck className="h-3 w-3" />
                                      {latestDoc.fileName}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatDate(latestDoc.createdAt)}
                                    </span>
                                    {latestDoc.status && (
                                      <span className="flex items-center gap-1">
                                        <Shield className="h-3 w-3" />
                                        {getStatusBadge(latestDoc.status)}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              {hasUpload && latestDoc && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1.5"
                                  data-testid={`button-download-${docType.type}`}
                                  onClick={() => window.open(`/api/documents/${latestDoc.id}/download`, "_blank")}
                                >
                                  <Download className="h-4 w-4" />
                                  <span className="hidden sm:inline">View</span>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant={hasUpload ? "outline" : "default"}
                                className="gap-1.5"
                                data-testid={`button-upload-${docType.type}`}
                                disabled={isUploading}
                                onClick={() => handleUploadClick(docType.type)}
                              >
                                <Upload className="h-4 w-4" />
                                <span className="hidden sm:inline">
                                  {isUploading && activeDocType === docType.type ? "Uploading..." : hasUpload ? "Replace" : "Upload"}
                                </span>
                              </Button>
                            </div>
                          </div>
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
                          {getStatusBadge(doc.status || "uploaded")}
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
