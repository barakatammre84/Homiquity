import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { formatDateSafe } from "@/lib/dates";
import type { Task } from "@shared/schema";

export function TaskDetailsCard({ task }: { task: Task }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Task Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Task Type</p>
          <p className="font-medium capitalize">{task.taskType.replace(/_/g, " ")}</p>
        </div>
        {task.documentCategory && (
          <div>
            <p className="text-sm text-muted-foreground">Document Type</p>
            <p className="font-medium capitalize">{task.documentCategory.replace(/_/g, " ")}</p>
          </div>
        )}
        {task.documentYear && (
          <div>
            <p className="text-sm text-muted-foreground">Year</p>
            <p className="font-medium">{task.documentYear}</p>
          </div>
        )}
        <div>
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="font-medium">
            {formatDateSafe(task.createdAt, "MMMM d, yyyy")}
          </p>
        </div>
        {task.verifiedAt && (
          <div>
            <p className="text-sm text-muted-foreground">Verified</p>
            <p className="font-medium">
              {format(new Date(task.verifiedAt), "MMMM d, yyyy")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Staff-only. The server already strips verificationNotes for client roles
 * (borrowerTaskView); the isStaff guard the page applies states that intent on
 * this side too rather than relying on the payload being empty.
 */
export function VerificationNotesCard({ notes }: { notes: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Verification Notes</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground" data-testid="text-verification-notes">
          {notes}
        </p>
      </CardContent>
    </Card>
  );
}

export function RejectedBanner() {
  return (
    <Card className="border-border bg-destructive-subtle">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <p className="font-medium text-destructive">
              Document Rejected
            </p>
            <p className="text-sm text-destructive mt-1">
              Please upload a new copy of this document.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompletedBanner() {
  return (
    <Card className="border-border bg-success-subtle">
      <CardContent className="p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground mt-0.5" />
          <div>
            <p className="font-medium text-success-subtle-foreground">
              Task Complete
            </p>
            <p className="text-sm text-success-subtle-foreground mt-1">
              Your document has been verified and accepted.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
