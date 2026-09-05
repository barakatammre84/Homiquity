import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { friendlyApiError } from "@/lib/errorMessage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Icons } from "@/lib/icons";
import { FILE_REVIEW_LABELS, FILE_REVIEW_SECTIONS, type FileReviewWorkspace } from "@shared/fileReview";
import type { DocumentSubjectOption } from "@shared/documentLineage";

type ReviewDocument = FileReviewWorkspace["documents"][number];
const DOCUMENT_PAGE_SIZE = 25;

function periodLabel(document: ReviewDocument) {
  const lineage = document.lineage;
  if (lineage.taxYear) return `Tax year ${lineage.taxYear}`;
  if (lineage.periodStart && lineage.periodEnd) return `${lineage.periodStart} through ${lineage.periodEnd}`;
  if (lineage.periodStart) return `From ${lineage.periodStart}`;
  if (lineage.periodEnd) return `Through ${lineage.periodEnd}`;
  return "No period recorded";
}

function LineageEditor({
  applicationId,
  document,
  options,
}: {
  applicationId: string;
  document: ReviewDocument;
  options: DocumentSubjectOption[];
}) {
  const cache = useQueryClient();
  const currentSubject = document.lineage.subjectType && document.lineage.subjectId
    ? `${document.lineage.subjectType}:${document.lineage.subjectId}`
    : "";
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(currentSubject);
  const [periodStart, setPeriodStart] = useState(document.lineage.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(document.lineage.periodEnd ?? "");
  const [taxYear, setTaxYear] = useState(document.lineage.taxYear?.toString() ?? "");
  const save = useMutation({
    mutationFn: async () => {
      const [subjectType, ...subjectIdParts] = subject.split(":");
      return apiRequest("PATCH", `/api/loan-applications/${applicationId}/documents/${document.id}/lineage`, {
        subjectType,
        subjectId: subjectIdParts.join(":"),
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        taxYear: taxYear ? Number(taxYear) : null,
      });
    },
    onSuccess: async () => {
      setOpen(false);
      await cache.invalidateQueries({ queryKey: loanApplicationKeys.fileReview(applicationId) });
    },
  });
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild>
      <Button variant="outline" size="sm" className="touch-target" data-testid={`file-review-edit-lineage-${document.id}`}>Edit evidence details</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Evidence details</DialogTitle>
        <DialogDescription>Identify who or what this document supports and the period it covers.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`lineage-subject-${document.id}`}>Applies to</Label>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger id={`lineage-subject-${document.id}`} data-testid={`file-review-lineage-subject-${document.id}`}><SelectValue placeholder="Choose a borrower, business, property, or the whole file" /></SelectTrigger>
            <SelectContent>{options.map(option => <SelectItem key={`${option.type}:${option.id}`} value={`${option.type}:${option.id}`}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor={`lineage-start-${document.id}`}>Period start</Label><Input id={`lineage-start-${document.id}`} type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor={`lineage-end-${document.id}`}>Period end</Label><Input id={`lineage-end-${document.id}`} type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label htmlFor={`lineage-tax-year-${document.id}`}>Tax year, when applicable</Label><Input id={`lineage-tax-year-${document.id}`} inputMode="numeric" value={taxYear} onChange={event => setTaxYear(event.target.value.replace(/\D/g, "").slice(0, 4))} /></div>
        {save.isError && <p role="alert" data-testid={`file-review-lineage-error-${document.id}`}>{friendlyApiError(save.error, "The evidence details were not saved.")}</p>}
      </div>
      <DialogFooter><Button disabled={!subject || save.isPending} onClick={() => save.mutate()} data-testid={`file-review-save-lineage-${document.id}`}>{save.isPending ? "Saving…" : "Save evidence details"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}

export function FileReviewTab({ applicationId, onNavigate }: { applicationId: string; onNavigate: (tab: string) => void }) {
  const cache = useQueryClient();
  const [acknowledgedRevision, setAcknowledgedRevision] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [documentQuery, setDocumentQuery] = useState("");
  const [visibleDocumentCount, setVisibleDocumentCount] = useState(DOCUMENT_PAGE_SIZE);
  const query = useQuery<FileReviewWorkspace>({
    queryKey: loanApplicationKeys.fileReview(applicationId), enabled: !!applicationId,
    staleTime: 0, refetchOnMount: "always", refetchInterval: 30000,
  });
  const save = useMutation({
    mutationFn: async (expectedRevision: string) => apiRequest("POST", `/api/loan-applications/${applicationId}/file-review`, { expectedRevision, acknowledged: true }),
    onSuccess: async () => { setAcknowledgedRevision(null); setSaved(true); await cache.invalidateQueries({ queryKey: loanApplicationKeys.fileReview(applicationId) }); },
    onError: async () => { setAcknowledgedRevision(null); setSaved(false); await cache.invalidateQueries({ queryKey: loanApplicationKeys.fileReview(applicationId) }); },
  });
  if (query.isLoading) return <Skeleton className="h-40 w-full" data-testid="file-review-loading" />;
  // A failed refresh must not leave stale evidence looking current.
  if (query.isError || !query.data) return <Alert variant="destructive" data-testid="file-review-error">
    <AlertTitle>File review is unavailable</AlertTitle>
    <AlertDescription>We could not check the current file. <Button variant="outline" onClick={() => query.refetch()} data-testid="file-review-retry">Try again</Button></AlertDescription>
  </Alert>;
  const data = query.data;
  const latest = data.checkpoints[0];
  const acknowledged = acknowledgedRevision === data.revision;
  const normalizedDocumentQuery = documentQuery.trim().toLocaleLowerCase();
  const matchingDocuments = normalizedDocumentQuery
    ? data.documents.filter(document => [
        document.name,
        document.documentType,
        document.status,
        document.lineage.subjectLabel ?? "",
      ].some(value => value.toLocaleLowerCase().includes(normalizedDocumentQuery)))
    : data.documents;
  const visibleDocuments = matchingDocuments.slice(0, visibleDocumentCount);
  return <div className="space-y-6" data-testid="file-review-tab">
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>File review</CardTitle>
          <Badge variant={!latest ? "secondary" : latest.isStale ? "warning" : "info"} data-testid="file-review-status">
            {!latest ? "No review recorded" : latest.isStale ? "Changed since review" : "Matches last review"}
          </Badge>
        </div>
        <CardDescription>Review the application summary and uploaded evidence in this existing file. Save a checkpoint to see what changes before your next visit.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest?.isStale && <Alert variant="warning" data-testid="file-review-changes">
          <AlertTitle>Review these changes</AlertTitle>
          <AlertDescription><ul className="list-disc space-y-1 pl-5">{latest.staleReasons.map(reason => <li key={reason}>{reason}</li>)}</ul></AlertDescription>
        </Alert>}
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FILE_REVIEW_SECTIONS.map(section => <div key={section} className="rounded-md border p-4">
            <dt className="text-sm text-muted-foreground">{FILE_REVIEW_LABELS[section]}</dt>
            <dd className="text-lg font-semibold tabular-nums">{data.manifest[section].count}</dd>
          </div>)}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onNavigate("overview")} data-testid="file-review-open-application">Review application</Button>
          <Button variant="outline" onClick={() => onNavigate("documents")} data-testid="file-review-open-documents">Review documents ({data.unreviewedDocumentCount} need attention)</Button>
          <Button variant="outline" onClick={() => onNavigate("tax-intel")} data-testid="file-review-open-values">Open income review</Button>
          <Button variant="ghost" disabled={query.isFetching} onClick={() => query.refetch()} data-testid="file-review-refresh">Refresh</Button>
        </div>
        <p className="text-sm text-muted-foreground" data-testid="file-review-open-facts">{data.unreviewedFactCount} extracted values have no recorded human confirmation. Document acceptance and value confirmation are separate checks.</p>
      </CardContent>
    </Card>
    <Card>
      <CardHeader>
        <CardTitle>Supporting documents</CardTitle>
        <CardDescription>Search the current versions already attached to this application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!data.documents.length ? <EmptyState bordered={false} icon={Icons.document} title="No documents attached" description="Use the existing Documents area to collect supporting evidence." data-testid="file-review-empty" /> :
          <>
          <div className="space-y-2">
            <Label htmlFor="file-review-document-search">Find a document</Label>
            <Input
              id="file-review-document-search"
              type="search"
              value={documentQuery}
              placeholder="Search by file, type, status, or evidence subject"
              onChange={event => {
                setDocumentQuery(event.target.value);
                setVisibleDocumentCount(DOCUMENT_PAGE_SIZE);
              }}
              data-testid="file-review-document-search"
            />
            <p className="text-sm text-muted-foreground" role="status">
              Showing {visibleDocuments.length} of {matchingDocuments.length} matching current documents
            </p>
          </div>
          {!matchingDocuments.length ? <EmptyState bordered={false} icon={Icons.document} title="No matching documents" description="Try a filename, document type, status, borrower, business, or property." data-testid="file-review-no-matches" /> :
          <ul className="divide-y">{visibleDocuments.map(doc => <li key={doc.id} className="space-y-3 py-4" data-testid={`file-review-document-${doc.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1">
                <p className="break-words font-medium">{doc.name}</p>
                <p className="text-sm text-muted-foreground" data-testid={`file-review-lineage-summary-${doc.id}`}>
                  Version {doc.lineage.versionNumber} of {doc.lineage.history.length} · {doc.lineage.subjectLabel ?? "Needs evidence assignment"} · {periodLabel(doc)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {doc.lineage.changedSinceLatestReview && <Badge variant="warning">Changed since last review</Badge>}
                {doc.lineage.needsAssignment && <Badge variant="warning">Needs assignment</Badge>}
                <Badge variant={doc.status === "verified" ? "info" : "warning"}>{doc.status === "verified" ? "Document accepted" : doc.status === "rejected" ? "Replacement requested" : "Needs document review"}</Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span>{doc.lineage.contentFingerprintRecorded ? "Content fingerprint recorded" : "Fingerprint unavailable for this older upload"}</span>
              <LineageEditor applicationId={applicationId} document={doc} options={data.subjectOptions} />
            </div>
            {doc.lineage.history.length > 1 && <details className="text-sm" data-testid={`file-review-history-${doc.id}`}>
              <summary className="cursor-pointer font-medium">Version history</summary>
              <ol className="mt-2 space-y-2 border-l pl-4">{[...doc.lineage.history].reverse().map(version => <li key={version.documentId}>
                <a className="underline underline-offset-4" href={`/api/documents/${version.documentId}/download`} target="_blank" rel="noreferrer">Version {version.versionNumber}: {version.fileName}</a>{version.isCurrent ? " · current" : " · replaced"}
              </li>)}</ol>
            </details>}
          </li>)}</ul>}
          {visibleDocuments.length < matchingDocuments.length && <Button
            variant="outline"
            onClick={() => setVisibleDocumentCount(count => count + DOCUMENT_PAGE_SIZE)}
            data-testid="file-review-show-more"
          >Show {Math.min(DOCUMENT_PAGE_SIZE, matchingDocuments.length - visibleDocuments.length)} more documents</Button>}
          </>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle>Record this review</CardTitle><CardDescription>A checkpoint records your review progress. Open items remain open; it does not verify values, approve the loan, or freeze a lender package.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {data.canSave && <div className="flex items-start gap-3">
          <Checkbox id="file-review-ack" checked={acknowledged} disabled={save.isPending || query.isFetching} onCheckedChange={checked => { setAcknowledgedRevision(checked === true ? data.revision : null); setSaved(false); }} data-testid="file-review-ack" />
          <Label htmlFor="file-review-ack" className="min-h-11 cursor-pointer leading-relaxed">I reviewed the current application summary and supporting evidence, including the open items shown above.</Label>
        </div>}
        {data.saveBlockedReason && <p className="text-sm text-muted-foreground" data-testid="file-review-save-reason">{data.saveBlockedReason}</p>}
        {save.isError && <p role="alert" data-testid="file-review-save-error">{friendlyApiError(save.error, "The review was not saved. Please try again.")}</p>}
        {saved && !latest?.isStale && <p role="status" data-testid="file-review-saved">Review checkpoint saved.</p>}
        <Button disabled={!data.canSave || !acknowledged || save.isPending || query.isFetching} onClick={() => save.mutate(data.revision)} data-testid="file-review-save">{save.isPending ? "Saving…" : "Save review checkpoint"}</Button>
        {data.checkpoints.length > 0 && <ol className="space-y-3" data-testid="file-review-history">{data.checkpoints.map(checkpoint => <li key={checkpoint.id} className="flex flex-wrap justify-between gap-2 border-t pt-3 text-sm">
          <span>Review {checkpoint.version} · {new Date(checkpoint.reviewedAt).toLocaleString()}</span>
          <span>{checkpoint.isStale ? "File has changed" : "Matches current file"}</span>
        </li>)}</ol>}
      </CardContent>
    </Card>
  </div>;
}
