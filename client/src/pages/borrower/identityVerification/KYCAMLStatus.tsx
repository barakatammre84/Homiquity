import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { getCheckStatusIcon, getStatusBadge } from "./statusPresentation";
import type { KycStatus } from "./types";

/** The four screens, each defaulting to "pending" rather than to nothing. */
export function kycChecks(kyc: KycStatus | null) {
  return [
    { key: "ofac", label: "OFAC Watchlist", description: "Office of Foreign Assets Control screening", status: kyc?.ofacStatus || "pending" },
    { key: "sanctions", label: "Sanctions Screening", description: "International sanctions list check", status: kyc?.sanctionsStatus || "pending" },
    { key: "pep", label: "PEP Check", description: "Politically Exposed Person screening", status: kyc?.pepStatus || "pending" },
    { key: "adverseMedia", label: "Adverse Media", description: "Negative news and media screening", status: kyc?.adverseMediaStatus || "pending" },
  ];
}

export function KYCAMLStatus({ kyc, applicationId }: { kyc: KycStatus | null; applicationId: string | null }) {
  const { toast } = useToast();

  const screenMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/onboarding/kyc/screen", { applicationId }),
    onSuccess: () => {
      toast({ title: "Screening Started", description: "Compliance checks are running. This takes about 10 seconds." });
      // No manual re-poll here: IdentityVerification.tsx holds this same query
      // key with refetchInterval: 5000, so the ~10-second screening is already
      // picked up within a tick. The four uncancellable setTimeouts that used
      // to sit here (3s/6s/9s/12s) duplicated that, and kept firing against an
      // unmounted tree if the borrower navigated away mid-screening.
    },
    onError: () => toast({ title: "Error", description: "Failed to start screening", variant: "destructive" }),
  });

  const checks = kycChecks(kyc);
  const allCleared = kyc?.overallStatus === "cleared";

  return (
    <div data-testid="kyc-status-panel">
      {allCleared && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-success/10 rounded-md" data-testid="kyc-cleared-banner">
          <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium text-success-subtle-foreground">All Compliance Checks Passed</p>
            <p className="text-xs text-muted-foreground">Risk Score: {kyc.riskScore}/100 (Low Risk)</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.key} className="flex items-center justify-between gap-2" data-testid={`kyc-check-${check.key}`}>
            <div className="flex items-center gap-3 min-w-0">
              {getCheckStatusIcon(check.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{check.label}</p>
                <p className="text-xs text-muted-foreground truncate">{check.description}</p>
              </div>
            </div>
            {getStatusBadge(check.status)}
          </div>
        ))}
      </div>

      {!kyc || kyc.overallStatus === "pending" ? (
        <Button onClick={() => screenMutation.mutate()} disabled={screenMutation.isPending} className="w-full mt-4" data-testid="button-kyc-start">
          {screenMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Search className="h-4 w-4 mr-2" />
          Run Compliance Checks
        </Button>
      ) : kyc.overallStatus === "in_progress" ? (
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Screening in progress...</span>
        </div>
      ) : null}
    </div>
  );
}
