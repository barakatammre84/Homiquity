import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, CircleDashed, Send, XCircle } from "lucide-react";

// -----------------------------------------------------------------------------
// Submission readiness + submit-to-lender dialog.
//
// Lazily fetches the broker workflow report when opened:
//   GET /api/loan-applications/:id/submission-readiness  (stages 1–4)
//   GET /api/loan-applications/:id/lender-submissions    (history)
//   GET /api/wholesale-lenders                           (Target-5 catalog)
// and submits via POST /api/loan-applications/:id/lender-submissions — the
// server re-runs the readiness gate, so this UI is a convenience, not the
// enforcement point.
// -----------------------------------------------------------------------------

type StageStatus = "ready" | "blocked" | "attention" | "not_applicable";

interface SubmissionStage {
  key: string;
  label: string;
  status: StageStatus;
  blockers: string[];
  warnings: string[];
}

interface ReadinessReport {
  applicationId: string;
  readyToSubmitToLender: boolean;
  currentStage: string;
  stages: SubmissionStage[];
  nextActions: string[];
}

interface WholesaleLender {
  id: string;
  name: string;
  specialty: string;
  approvalStatus: string;
}

interface LenderSubmissionRow {
  id: string;
  lenderId: string;
  status: string;
  confirmationId: string | null;
  simulated: boolean;
  submittedAt: string;
}

const STAGE_ICON: Record<StageStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ready: { icon: CheckCircle2, className: "text-success", label: "Ready" },
  attention: { icon: AlertTriangle, className: "text-warning", label: "Attention" },
  blocked: { icon: XCircle, className: "text-destructive", label: "Blocked" },
  not_applicable: { icon: CircleDashed, className: "text-muted-foreground", label: "N/A" },
};

export function SubmissionReadinessDialog({
  applicationId,
  borrowerName,
}: {
  applicationId: string;
  borrowerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [lenderId, setLenderId] = useState<string>("");
  const { toast } = useToast();

  const { data: readiness, isLoading } = useQuery<ReadinessReport>({
    queryKey: [`/api/loan-applications/${applicationId}/submission-readiness`],
    enabled: open,
  });
  const { data: lenders } = useQuery<WholesaleLender[]>({
    queryKey: ["/api/wholesale-lenders"],
    enabled: open,
  });
  const { data: submissions } = useQuery<LenderSubmissionRow[]>({
    queryKey: [`/api/loan-applications/${applicationId}/lender-submissions`],
    enabled: open,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/lender-submissions`, {
        lenderId,
      });
      return res.json();
    },
    onSuccess: (submission: LenderSubmissionRow) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/loan-applications/${applicationId}/lender-submissions`],
      });
      toast({
        title: "Submitted to lender",
        description: `Confirmation ${submission.confirmationId}${submission.simulated ? " (simulated — no broker agreement live yet)" : ""}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Submission blocked",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Run the dual AUS (DU + LPA, simulated behind the adapter) so the AUS stage
  // can be satisfied from the UI. Refreshes the readiness report on success.
  const runAusMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/underwrite/submit-gse", { applicationId });
      return res.json();
    },
    onSuccess: (data: { recommendation?: string; findings?: { simulated?: boolean } }) => {
      queryClient.invalidateQueries({
        queryKey: [`/api/loan-applications/${applicationId}/submission-readiness`],
      });
      toast({
        title: "Automated underwriting complete (DU + LPA)",
        description: `DU recommendation: ${data.recommendation ?? "—"}${data.findings?.simulated ? " (simulated)" : ""}`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Automated underwriting could not run", description: error.message, variant: "destructive" });
    },
  });

  const lenderName = (id: string) => lenders?.find(l => l.id === id)?.name ?? id;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`submission-readiness-${applicationId}`}>
          <Send className="mr-1 h-4 w-4" aria-hidden="true" />
          Lender
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lender submission — {borrowerName}</DialogTitle>
          <DialogDescription>
            Broker workflow: intake → DU → lender package. The delivery pre-flight is the
            lender's-eye view and never blocks a submission.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !readiness ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-2">
              {readiness.stages.map(stage => {
                const meta = STAGE_ICON[stage.status];
                const Icon = meta.icon;
                return (
                  <li key={stage.key} className="rounded-md border border-border p-3" data-testid={`stage-${stage.key}`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${meta.className}`} aria-hidden="true" />
                      <span className="font-medium">{stage.label}</span>
                      <Badge variant="outline" className="ml-auto">{meta.label}</Badge>
                    </div>
                    {(stage.blockers.length > 0 || stage.warnings.length > 0) && (
                      <ul className="mt-2 space-y-1 pl-6 text-sm text-muted-foreground">
                        {stage.blockers.map(b => (
                          <li key={b} className="list-disc text-destructive">{b}</li>
                        ))}
                        {stage.warnings.map(w => (
                          <li key={w} className="list-disc">{w}</li>
                        ))}
                      </ul>
                    )}
                    {stage.key === "aus" && (
                      <div className="mt-2 pl-6">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runAusMutation.mutate()}
                          disabled={runAusMutation.isPending}
                          data-testid="run-aus"
                        >
                          {runAusMutation.isPending ? "Running DU / LPA…" : "Run DU / LPA"}
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {(submissions?.length ?? 0) > 0 && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="mb-1 font-medium">Submissions</p>
                <ul className="space-y-1">
                  {submissions!.map(s => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span>{lenderName(s.lenderId)}</span>
                      <span className="text-muted-foreground">
                        {s.confirmationId} · {s.status.replace(/_/g, " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Select value={lenderId} onValueChange={setLenderId}>
                <SelectTrigger className="flex-1" data-testid="lender-select">
                  <SelectValue placeholder="Choose a wholesale lender" />
                </SelectTrigger>
                <SelectContent>
                  {(lenders ?? []).map(l => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} — {l.specialty}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={!readiness.readyToSubmitToLender || !lenderId || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                data-testid="submit-to-lender"
              >
                {submitMutation.isPending ? "Submitting…" : "Submit"}
              </Button>
            </div>
            {!readiness.readyToSubmitToLender && (
              <p className="text-sm text-muted-foreground">
                Submission unlocks when stages 1–3 have no blockers.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
