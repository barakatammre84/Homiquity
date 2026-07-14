import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
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
 */
export function PreApprovedCard({ applicationId, amount, validUntil }: PreApprovedCardProps) {
  const { toast } = useToast();

  const statusQuery = useQuery<{ hasLetter: boolean; letterNumber?: string; estimatedAmount?: string }>({
    queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
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
        queryKey: ["/api/loan-applications", applicationId, "prequal-status"],
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not generate your letter. Please try again.", variant: "destructive" });
    },
  });

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/prequal-pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pre-qualification-letter.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Error", description: "Could not download your letter.", variant: "destructive" });
    }
  };

  const hasLetter = statusQuery.data?.hasLetter;
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
        <Button
          onClick={() => (hasLetter ? handleDownload() : generateMutation.mutate())}
          disabled={busy}
          variant="outline"
          className="mt-4 w-full"
          data-testid="button-view-preapproval-letter"
        >
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : hasLetter ? (
            <Download className="mr-2 h-4 w-4" />
          ) : (
            <FileText className="mr-2 h-4 w-4" />
          )}
          {busy
            ? "Preparing…"
            : hasLetter
            ? "Download pre-qualification letter"
            : "View pre-qualification letter"}
        </Button>
      </CardContent>
    </Card>
  );
}
