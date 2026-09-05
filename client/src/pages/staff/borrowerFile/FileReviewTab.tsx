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
import { Icons } from "@/lib/icons";
import { FILE_REVIEW_LABELS, FILE_REVIEW_SECTIONS, type FileReviewWorkspace } from "@shared/fileReview";

export function FileReviewTab({ applicationId, onNavigate }: { applicationId: string; onNavigate: (tab: string) => void }) {
  const cache = useQueryClient();
  const [acknowledgedRevision, setAcknowledgedRevision] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
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
      <CardHeader><CardTitle>Supporting documents</CardTitle><CardDescription>These are the documents already attached to this application.</CardDescription></CardHeader>
      <CardContent>
        {!data.documents.length ? <EmptyState bordered={false} icon={Icons.document} title="No documents attached" description="Use the existing Documents area to collect supporting evidence." data-testid="file-review-empty" /> :
          <ul className="divide-y">{data.documents.map(doc => <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
            <span className="min-w-0 break-words font-medium">{doc.name}</span>
            <Badge variant={doc.status === "verified" ? "info" : "warning"}>{doc.status === "verified" ? "Document accepted" : doc.status === "rejected" ? "Replacement requested" : "Needs document review"}</Badge>
          </li>)}</ul>}
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
