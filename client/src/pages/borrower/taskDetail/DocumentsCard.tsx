import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { formatDateSafe } from "@/lib/dates";
import type { Document, TaskDocument } from "@shared/schema";

export type TaskDocumentWithFile = TaskDocument & { document: Document };

/**
 * The uploaded-documents list and the borrower's upload control.
 *
 * The upload itself stays on TaskDetail.tsx — this component only renders the
 * hidden file input and the button that opens it, and reports the selection
 * upward. `canUpload` is decided by the page from the task's assignment and
 * lifecycle status; nothing here re-derives permission.
 */
export function DocumentsCard({
  documents,
  canUpload,
  isUploading,
  fileInputRef,
  onFileSelect,
}: {
  documents: TaskDocumentWithFile[] | undefined;
  canUpload: boolean;
  isUploading: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Uploaded Documents</CardTitle>
        <CardDescription>
          {documents?.length || 0} document(s) uploaded for this task
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(!documents || documents.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <FileText className="mx-auto h-12 w-12 mb-4" />
            <p>No documents uploaded yet</p>
            {canUpload && (
              <p className="text-sm mt-2">
                Click the upload button to add your document
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((taskDoc) => (
              <div
                key={taskDoc.id}
                className={`flex items-center justify-between rounded-lg border p-4 ${
                  taskDoc.isVerified
                    ? "bg-success-subtle border-border"
                    : ""
                }`}
                data-testid={`document-${taskDoc.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{taskDoc.document.fileName}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDateSafe(taskDoc.createdAt, "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {taskDoc.isVerified ? (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Verified
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Pending Review</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {canUpload && (
          <div className="mt-6">
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileSelect}
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              data-testid="input-file-upload"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full"
              data-testid="button-upload-document"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center mt-2">
              Supported formats: PDF, JPG, PNG, DOC, DOCX
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
