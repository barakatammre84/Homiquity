import { Download, FileCheck, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentStatusBadge } from "@/components/DocumentStatusBadge";
import { formatDate } from "@/lib/formatters";
import type { Document } from "@shared/schema";

export function UploadedDocumentsTable({ documents }: { documents: Document[] }) {
  return (
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
  );
}
