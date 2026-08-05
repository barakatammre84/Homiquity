import { AlertCircle, CheckCircle2, Clock, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DocumentRequestData } from "@shared/schema";
import {
  UploadDocumentDialog,
  toUploadableDocumentType,
} from "@/components/UploadDocumentDialog";

// Document Request Message Card Component
export function DocumentRequestCard({
  data,
  isFromCurrentUser,
  messageId,
  applicationId,
  partnerId,
}: {
  data: DocumentRequestData;
  isFromCurrentUser: boolean;
  messageId: string;
  applicationId?: string | null;
  partnerId: string;
}) {
  const getStatusBadge = () => {
    switch (data.status) {
      case "pending":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      case "submitted":
        return <Badge className="bg-info-subtle text-info gap-1"><Upload className="h-3 w-3" />Submitted</Badge>;
      case "approved":
        return <Badge className="bg-success-subtle text-success-subtle-foreground gap-1"><CheckCircle2 className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return null;
    }
  };

  const canUpload = !isFromCurrentUser && (data.status === "pending" || data.status === "rejected");

  return (
    <Card className={`max-w-sm ${isFromCurrentUser ? 'bg-primary/5' : 'bg-muted/50'}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-sm">{data.documentName}</span>
              {getStatusBadge()}
            </div>
            {data.description && (
              <p className="text-xs text-muted-foreground mb-2">{data.description}</p>
            )}
            {canUpload && (
              <UploadDocumentDialog
                applicationId={applicationId}
                defaultDocumentType={toUploadableDocumentType(data.documentType)}
                requestMessageId={messageId}
                confirmToRecipientId={partnerId}
                trigger={
                  <Button size="sm" className="w-full mt-2" data-testid="button-upload-doc">
                    <Upload className="h-4 w-4 mr-2" />
                    {data.status === "rejected" ? "Re-upload Document" : "Upload Document"}
                  </Button>
                }
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
