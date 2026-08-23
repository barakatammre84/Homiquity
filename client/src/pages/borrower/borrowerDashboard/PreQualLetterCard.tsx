import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { formatDate } from "@/lib/formatters";
import {
  selectBorrowerLetterState,
  canDownloadLetter,
  canRequestLetter,
  describeUnusableLetter,
  type LetterStatusResponse,
} from "@/lib/letterStatus";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";

/** Pre-qualification letter card (extracted from Dashboard.tsx): generate on
 * first use, then download the PDF. Owns its status query and mutation.
 *
 * What it may say about the letter comes from the one shared selector
 * (lib/letterStatus.ts) — this card used to read `hasLetter` alone, so an
 * expired letter still read "ready to download" with no path to a fresh one. */
export function PreQualLetterCard({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const statusQuery = useQuery<LetterStatusResponse & { estimatedAmount?: string }>({
    queryKey: loanApplicationKeys.prequalStatus(applicationId),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-prequal`);
      return res.json();
    },
    onSuccess: (data: { letterNumber: string }) => {
      toast({ title: "Letter Ready", description: `Your pre-qualification letter #${data.letterNumber} has been generated.` });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.prequalStatus(applicationId) });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await apiRequest("GET", `/api/loan-applications/${applicationId}/prequal-pdf`);
      await downloadResponseAsFile(res, "pre-qualification-letter.pdf");
    } catch {
      toast({ title: "Error", description: "Could not download letter.", variant: "destructive" });
    }
  };

  const letterState = selectBorrowerLetterState(statusQuery.data, statusQuery.isError);
  const unusable = describeUnusableLetter(letterState, formatDate);
  const canDownload = canDownloadLetter(letterState);

  return (
    <Card className="hover-elevate" data-testid="card-prequal-letter">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-border">
              <FileText className="h-4 w-4 text-warning-subtle-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm" data-testid="text-prequal-title">
                Pre-Qualification Letter
              </p>
              <p className="text-xs text-muted-foreground" data-testid="text-prequal-subtitle">
                {unusable
                  ?? (canDownload
                    ? letterState.kind === "current" && letterState.expiresOn
                      ? `Ready to download · valid through ${formatDate(letterState.expiresOn)}`
                      : "Your letter is ready to download"
                    : "Get a preliminary qualification letter")}
              </p>
            </div>
          </div>
          {canDownload && (
            <Button onClick={handleDownload} variant="outline" size="sm" className="touch-target gap-2" data-testid="button-download-prequal-dash">
              <Download className="h-4 w-4" />
              Download
            </Button>
          )}
          {canRequestLetter(letterState) && (
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              variant="outline"
              size="sm"
              className="touch-target gap-2"
              data-testid="button-generate-prequal-dash"
            >
              {generateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {generateMutation.isPending
                ? "Generating..."
                : letterState.kind === "expired"
                  ? "Get an updated letter"
                  : "Generate"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
