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
import { apiRequest, queryClient, loanApplicationKeys, dashboardKeys } from "@/lib/queryClient";
import { useActiveApplication } from "@/hooks/useActiveApplication";
import type { Document, LoanApplication, LoanCondition } from "@shared/schema";
import { canonicalDocumentType } from "@shared/documentTypes";
import { validateUploadFile } from "@shared/uploads";
import { PageShell } from "@/components/PageShell";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { DocumentItemRow, type DocRow } from "@/components/DocumentItemRow";
import { DocumentRequestReasons } from "@/components/borrower/DocumentRequestReasons";
import {
  DOCUMENT_CATEGORIES,
  CONDITION_CATEGORY_META,
  docTypeName,
  getUploadNextStep,
} from "./documentCategories";
import {
  groupDocumentsByType,
  countPendingCatalogDocs,
  countPendingChecklistItems,
  buildPersonalizedGroups,
  rowFromChecklistItem,
  rowFromCatalogDoc,
  getChecklistStatusInfo,
  getCategoryStatus,
  type ChecklistItemView,
} from "@/lib/documentChecklist";
import {
  FileText,
  Download,
  Upload,
  CheckCircle2,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  FileCheck,
} from "lucide-react";

interface DashboardData {
  documents: Document[];
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
    queryKey: dashboardKeys.root(),
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
    queryKey: loanApplicationKeys.all(),
    enabled: !authLoading,
  });
  const { activeApplication } = useActiveApplication(myApps ?? []);
  const focusAppId = activeApplication?.id;

  const { data: focusPipeline, isLoading: focusLoading } = useQuery<{ conditions: LoanCondition[] }>({
    queryKey: loanApplicationKeys.pipeline(focusAppId!),
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
      queryClient.invalidateQueries({ queryKey: dashboardKeys.root() });
      // Refresh pipeline data too — a matching upload moves the focused
      // condition to "submitted" and the banner should say so.
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.all() });
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

  const documentsByType = groupDocumentsByType(documents);

  // Calculate current status - count pending required items. Personalized
  // mode counts the pipeline's own items instead of the static catalog.
  const pendingCount = personalized
    ? countPendingChecklistItems(personalizedItems)
    : countPendingCatalogDocs(DOCUMENT_CATEGORIES.flatMap((cat) => cat.documents), documentsByType);
  const isAllCaughtUp = pendingCount === 0;

  const personalizedGroups = personalized ? buildPersonalizedGroups(personalizedItems) : new Map<string, ChecklistItemView[]>();

  const rowFromItem = (item: ChecklistItemView): DocRow => rowFromChecklistItem(item, conditionId);

  const statusInfo = getChecklistStatusInfo(isAllCaughtUp, pendingCount);
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

        {/* Why-we-need-these: tie-out-driven reasons from the borrower's own
            SituationProfile (owner-readable endpoint; renders nothing when the
            file has no generated requests). */}
        <div className="mb-6">
          <DocumentRequestReasons />
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
          const pendingInCategory = countPendingCatalogDocs(category.documents, documentsByType);
          const uploadedCount = category.documents.filter(d => documentsByType[d.type]?.length > 0).length;

          const allCaughtUp = pendingInCategory === 0;
          const hasUploads = uploadedCount > 0;

          const categoryStatus = getCategoryStatus(requiredInCategory.length, pendingInCategory);

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
                        const row = rowFromCatalogDoc(docType, documentsByType, focusTypes);
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
