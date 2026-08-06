import { ClipboardList, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoanCondition } from "@shared/schema";
import { docTypeName } from "../documentCategories";

/**
 * Condition-focus mode: the pipeline's per-condition "Upload" button links here
 * with ?condition=<id>. This banner spotlights the document types that clear
 * that condition — an upload of a matching type flips it to "submitted"
 * server-side (matchUploadedDocumentToConditions).
 */
export function ConditionFocusBanner({
  condition,
  onUploadType,
  isUploading,
}: {
  condition: LoanCondition;
  onUploadType: (type: string) => void;
  isUploading: boolean;
}) {
  return (
    <Card
      className={
        condition.status === "outstanding"
          ? "mb-6 border-primary/50"
          : "mb-6"
      }
      data-testid="card-condition-focus"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">
            {condition.status === "outstanding"
              ? `Uploading for: ${condition.title}`
              : condition.status === "submitted"
                ? `Under review: ${condition.title}`
                : `Cleared: ${condition.title}`}
          </CardTitle>
        </div>
        {condition.description && (
          <CardDescription>{condition.description}</CardDescription>
        )}
      </CardHeader>
      {condition.status === "outstanding" ? (
        <CardContent className="space-y-3">
          {(condition.requiredDocumentTypes ?? []).length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                Any one of these documents can clear this item — it moves to
                "Under Review" automatically the moment a match is uploaded.
              </p>
              <div className="flex flex-wrap gap-2">
                {(condition.requiredDocumentTypes ?? []).map((type) => (
                  <Button
                    key={type}
                    size="sm"
                    variant="outline"
                    onClick={() => onUploadType(type)}
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
            {condition.status === "submitted"
              ? "Your upload is with the team — nothing more is needed on this item right now."
              : "This item is done. Anything still outstanding is listed below."}
          </p>
        </CardContent>
      )}
    </Card>
  );
}

/** Shown when ?condition=<id> no longer resolves to anything on the file. */
export function ConditionGoneNotice() {
  return (
    <div className="mb-6 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground" data-testid="text-condition-gone">
      That item is no longer on your list — the checklist below is current.
    </div>
  );
}
