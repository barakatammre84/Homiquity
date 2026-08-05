import { lazy, Suspense } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentReviewPanel } from "@/components/staff/DocumentReviewPanel";
import type { Document, LoanApplication } from "@shared/schema";

// Lazy so pdfjs-dist stays in a staff-only async chunk, off every borrower
// bundle and off this page's own initial render.
const DocumentViewer = lazy(() => import("@/components/staff/DocumentViewer"));

export interface DocumentsTabProps {
  applicationId: string;
  documents: Document[];
  application: LoanApplication;
  canReview: boolean;
  selectedDocumentId: string | null;
  onSelectDocument: (id: string | null) => void;
}

export function DocumentsTab({
  applicationId,
  documents,
  application,
  canReview,
  selectedDocumentId,
  onSelectDocument,
}: DocumentsTabProps) {
  const selectedDocument = documents.find((d) => d.id === selectedDocumentId);

  return (
    /* Split workbench (roadmap A6): review list left, safe
       rasterizing viewer right. Stacks on narrow viewports. */
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <DocumentReviewPanel
        applicationId={applicationId}
        documents={documents}
        application={application}
        canReview={canReview}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={onSelectDocument}
      />
      {selectedDocument ? (
        <Suspense
          fallback={<Skeleton className="h-[560px] w-full" data-testid="viewer-suspense" />}
        >
          <DocumentViewer
            documentId={selectedDocument.id}
            fileName={selectedDocument.fileName}
            mimeType={selectedDocument.mimeType}
          />
        </Suspense>
      ) : (
        <Card className="flex min-h-[320px] items-center justify-center">
          <CardContent className="py-10 text-sm text-muted-foreground" data-testid="viewer-placeholder">
            Select a document to preview it here.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
