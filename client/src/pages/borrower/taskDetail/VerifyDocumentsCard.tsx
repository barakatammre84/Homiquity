import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, X } from "lucide-react";
import type { TaskDocumentWithFile } from "./DocumentsCard";

/**
 * Staff verify/reject controls. Rendered only when the page has established
 * that the viewer is internal staff and a submission is awaiting a verdict —
 * the server re-checks both (role gate plus deal-team membership) on
 * PATCH /api/tasks/:taskId/documents/:docId/verify.
 *
 * KNOWN LIMITATION, carried over unchanged. Both buttons act on the LAST
 * document in the list, so on a task with more than one upload the earlier
 * ones can never be verified or rejected individually — despite the card
 * saying "Review the uploaded documents and verify or reject them". The
 * endpoint already takes a docId, so fixing this means per-row controls, which
 * is a product change rather than a refactor; flagged rather than silently
 * left to look intentional.
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
  const lastDoc = documents[documents.length - 1];

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
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => { if (lastDoc) onVerify(lastDoc.id, false); }}
            disabled={isPending}
            data-testid="button-reject-document"
          >
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={() => { if (lastDoc) onVerify(lastDoc.id, true); }}
            disabled={isPending}
            data-testid="button-approve-document"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve & Verify
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
