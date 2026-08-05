import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, X } from "lucide-react";
import type { TaskDocumentWithFile } from "./DocumentsCard";

/**
 * Staff verify/reject controls, one row per uploaded document.
 *
 * Both buttons used to act on the LAST document in the list, so on a task with
 * more than one upload the earlier ones could never be actioned — despite this
 * card saying "verify or reject them". The endpoint has always taken a docId;
 * only the UI was collapsing the choice.
 *
 * Rendered only when the page has established that the viewer is internal
 * staff and a submission is awaiting a verdict — the server re-checks both (a
 * role gate plus deal-team membership) on
 * PATCH /api/tasks/:taskId/documents/:docId/verify.
 *
 * The notes field is shared across the rows on purpose: the mutation sends
 * whatever is typed alongside the verdict, and the server writes it to the
 * task, not to the individual document. One task, one set of notes.
 */
export function VerifyDocumentsCard({
  documents,
  verificationNotes,
  onVerificationNotesChange,
  onVerify,
  isPending,
}: {
  documents: TaskDocumentWithFile[];
  verificationNotes: string;
  onVerificationNotesChange: (v: string) => void;
  onVerify: (docId: string, isVerified: boolean) => void;
  isPending: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Verify Documents</CardTitle>
        <CardDescription>
          Review the uploaded documents and verify or reject them
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="notes">Verification Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add any notes about the verification..."
            value={verificationNotes}
            onChange={(e) => onVerificationNotesChange(e.target.value)}
            data-testid="input-verification-notes"
          />
        </div>

        <div className="space-y-3">
          {documents.map((taskDoc) => (
            <div
              key={taskDoc.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              data-testid={`verify-row-${taskDoc.id}`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="truncate text-sm font-medium">{taskDoc.document.fileName}</p>
                {taskDoc.isVerified && (
                  <Badge variant="success">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Verified
                  </Badge>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onVerify(taskDoc.id, false)}
                  disabled={isPending}
                  data-testid={`button-reject-document-${taskDoc.id}`}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={() => onVerify(taskDoc.id, true)}
                  disabled={isPending}
                  data-testid={`button-approve-document-${taskDoc.id}`}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve & Verify
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
