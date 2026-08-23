import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  selectBorrowerLetterState,
  canDownloadLetter,
  canRequestLetter,
  describeUnusableLetter,
  type LetterStatusResponse,
} from "@/lib/letterStatus";
import { useToast } from "@/hooks/use-toast";

import { CardLabel } from "./CardLabel";

interface PreApprovedCardProps {
  applicationId: string;
  /** application.preApprovalAmount (or purchasePrice fallback). */
  amount: string | null | undefined;
  /** Human "valid until" label from getExpirationInfo, if any. */
  validUntil?: string | null;
}

/**
 * "YOU'RE PRE-APPROVED" — the pre-approval amount + the letter action, reusing
 * the existing prequal endpoints (prequal-status / generate-prequal / prequal-pdf).
 *
 * Terminology note: the downloadable artifact keeps its existing name
 * ("pre-qualification letter"). Normalizing pre-approval vs pre-qualification is
 * the deferred, compliance-gated COPY track — this visual card must not rename a
 * regulated artifact. The heading "You're Pre-Approved" is the real `pre_approved`
 * application status (already used in the dashboard greeting), not a new claim.
 *
 * The reference's "Edit pre-approval letter" is a staff-only action (no borrower
 * edit route) and is intentionally omitted.
 *
 * What the button may offer comes from the one shared selector
 * (lib/letterStatus.ts), not from `hasLetter`: an expired letter offers a fresh
 * one, and a letter the loan team withdrew offers neither a download nor a
 * re-mint.
 */
export function PreApprovedCard({ applicationId, amount, validUntil }: PreApprovedCardProps) {
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
      toast({
        title: "Letter ready",
        description: `Your pre-qualification letter #${data.letterNumber} is ready to download.`,
      });
      queryClient.invalidateQueries({
        queryKey: loanApplicationKeys.prequalStatus(applicationId),
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate your letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await apiRequest("GET", `/api/loan-applications/${applicationId}/prequal-pdf`);
      await downloadResponseAsFile(res, "pre-qualification-letter.pdf");
    } catch {
      toast({ title: "Error", description: "Could not download your letter.", variant: "destructive" });
    }
  };

  const letterState = selectBorrowerLetterState(statusQuery.data, statusQuery.isError);
  const unusable = describeUnusableLetter(letterState, formatDate);
  const canDownload = canDownloadLetter(letterState);
  const canRequest = canRequestLetter(letterState);
  const busy = generateMutation.isPending;

  return (
    <Card className="shadow-card-lg" data-testid="card-pre-approved">
      <CardContent className="p-5">
        <CardLabel>You're Pre-Approved</CardLabel>
        <p
          className="text-3xl font-bold tracking-tight tabular-nums text-foreground"
          data-testid="text-preapproval-amount"
        >
          {amount ? formatCurrency(amount) : "—"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Your pre-approved loan amount
          {validUntil ? ` · valid until ${validUntil}` : ""}
        </p>
        {unusable && (
          <p className="mt-3 text-xs text-muted-foreground" data-testid="text-letter-unusable">
            {unusable}
          </p>
        )}
        {(canDownload || canRequest) && (
          <Button
            onClick={() => (canDownload ? handleDownload() : generateMutation.mutate())}
            disabled={busy}
            variant="outline"
            className="mt-4 w-full"
            data-testid="button-view-preapproval-letter"
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : canDownload ? (
              <Download className="mr-2 h-4 w-4" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            {busy
              ? "Preparing…"
              : canDownload
                ? "Download pre-qualification letter"
                : letterState.kind === "expired"
                  ? "Get an updated pre-qualification letter"
                  : "View pre-qualification letter"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
