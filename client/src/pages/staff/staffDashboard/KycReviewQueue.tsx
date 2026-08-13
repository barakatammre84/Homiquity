import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

/**
 * KYC/AML compliance clearance queue (finding F-044).
 *
 * The screening simulator deliberately refuses to auto-clear a borrower and
 * defers to "the admin compliance workflow" — which did not exist. Every
 * screening therefore parked at `pending_review` forever, and the borrower's
 * Identity Verification page had a terminal state nobody could resolve. This is
 * that workflow: the only surface from which a human decision reaches
 * `kyc_screenings.overall_status`.
 *
 * Visible to admin + underwriter only, mirroring the server's `requireRole` on
 * /api/compliance/kyc/*. The server is the gate; this is presentation.
 */

const REVIEW_ROLES = ["admin", "underwriter"];

/** One sub-check's outcome, as recorded by the screening. */
type CheckStatus = string | null;

interface PendingScreening {
  id: string;
  userId: string;
  applicationId: string | null;
  overallStatus: string;
  ofacStatus: CheckStatus;
  sanctionsStatus: CheckStatus;
  pepStatus: CheckStatus;
  adverseMediaStatus: CheckStatus;
  riskLevel: string | null;
  riskScore: number | null;
  createdAt: string | null;
  borrower: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

const KYC_PENDING_KEY = ["/api/compliance/kyc/pending"];

const SUB_CHECKS: Array<{ key: keyof PendingScreening; label: string }> = [
  { key: "ofacStatus", label: "OFAC" },
  { key: "sanctionsStatus", label: "Sanctions" },
  { key: "pepStatus", label: "PEP" },
  { key: "adverseMediaStatus", label: "Adverse media" },
];

/** An adverse sub-check is the thing a reviewer must not miss — surface it loudly. */
function isAdverse(status: CheckStatus) {
  return status === "flagged" || status === "failed";
}

function SubCheckBadge({ label, status }: { label: string; status: CheckStatus }) {
  if (isAdverse(status)) {
    return (
      <Badge variant="destructive" className="gap-1" data-testid={`kyc-check-${label.toLowerCase()}`}>
        <AlertTriangle className="h-3 w-3" />
        {label}: {status}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1" data-testid={`kyc-check-${label.toLowerCase()}`}>
      {label}: {status ?? "—"}
    </Badge>
  );
}

function borrowerLabel(screening: PendingScreening) {
  const b = screening.borrower;
  if (!b) return "Unknown borrower";
  const name = [b.firstName, b.lastName].filter(Boolean).join(" ");
  return name || b.email || b.id;
}

export function KycReviewQueue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [active, setActive] = useState<PendingScreening | null>(null);
  const [decision, setDecision] = useState<"cleared" | "failed" | null>(null);
  const [notes, setNotes] = useState("");

  const canReview = REVIEW_ROLES.includes(user?.role || "");

  const query = useQuery<{ screenings: PendingScreening[] }>({
    queryKey: KYC_PENDING_KEY,
    enabled: canReview,
  });

  const decideMutation = useMutation({
    mutationFn: async (vars: { screeningId: string; decision: "cleared" | "failed"; notes: string }) => {
      const response = await apiRequest("POST", `/api/compliance/kyc/${vars.screeningId}/decision`, {
        decision: vars.decision,
        notes: vars.notes,
      });
      return await response.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: KYC_PENDING_KEY });
      toast({
        title: vars.decision === "cleared" ? "Borrower cleared" : "Screening marked failed",
        description: "The decision and your notes are recorded on the screening record.",
      });
      closeDialog();
    },
    onError: (error: unknown) => {
      toast({
        title: "Decision not recorded",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    },
  });

  const closeDialog = () => {
    setActive(null);
    setDecision(null);
    setNotes("");
  };

  const openDialog = (screening: PendingScreening, next: "cleared" | "failed") => {
    setActive(screening);
    setDecision(next);
    setNotes("");
  };

  // Not an error state — staff without clearance authority simply don't see the
  // queue. The server refuses them regardless.
  if (!canReview) return null;

  const screenings = query.data?.screenings ?? [];
  // Notes are the record of WHY a sanctions screening was adjudicated; the
  // server rejects anything shorter, so mirror the rule rather than let the
  // reviewer type into a submit that will bounce.
  const notesTooShort = notes.trim().length < 10;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          KYC / AML Clearance Queue
          {screenings.length > 0 && (
            <Badge variant="secondary" data-testid="badge-kyc-pending-count">
              {screenings.length}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Borrowers whose OFAC, sanctions, PEP and adverse-media screening needs a human decision.
          Nothing else in the system can clear a borrower.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isError ? (
          <QueryErrorState
            error={query.error}
            onRetry={query.refetch}
            title="We couldn't load the clearance queue"
            data-testid="kyc-queue-error"
          />
        ) : query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : screenings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground" data-testid="kyc-queue-empty">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
            <p>No screenings awaiting review</p>
          </div>
        ) : (
          <div className="space-y-3">
            {screenings.map((screening) => (
              <div
                key={screening.id}
                className="rounded-lg border p-4"
                data-testid={`kyc-screening-${screening.id}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{borrowerLabel(screening)}</p>
                    <p className="text-xs text-muted-foreground">
                      {screening.borrower?.email}
                      {screening.riskLevel ? ` · risk: ${screening.riskLevel}` : ""}
                      {screening.createdAt
                        ? ` · screened ${new Date(screening.createdAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openDialog(screening, "failed")}
                      data-testid={`button-kyc-fail-${screening.id}`}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Fail
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => openDialog(screening, "cleared")}
                      data-testid={`button-kyc-clear-${screening.id}`}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {SUB_CHECKS.map(({ key, label }) => (
                    <SubCheckBadge key={label} label={label} status={screening[key] as CheckStatus} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={active !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent data-testid="dialog-kyc-decision">
          <DialogHeader>
            <DialogTitle>
              {decision === "cleared" ? "Clear" : "Fail"} {active ? borrowerLabel(active) : ""}
            </DialogTitle>
            <DialogDescription>
              {decision === "cleared"
                ? `This records a human AML clearance valid for 365 days. Sub-checks that returned an adverse finding keep that finding — clearing does not erase it.`
                : "This records a failed screening. The borrower's onboarding will not advance."}
            </DialogDescription>
          </DialogHeader>

          {active && SUB_CHECKS.some(({ key }) => isAdverse(active[key] as CheckStatus)) && (
            <div
              className="rounded-md border border-transparent bg-destructive-subtle p-3 text-sm text-destructive-subtle-foreground"
              data-testid="kyc-adverse-warning"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                This screening returned an adverse finding
              </p>
              <p className="mt-1">
                Confirm the disposition against the underlying list match before clearing.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="kyc-decision-notes">
              Basis for this decision <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="kyc-decision-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What was reviewed, what the match resolved to, and who confirmed it."
              rows={4}
              data-testid="input-kyc-notes"
            />
            <p className="text-xs text-muted-foreground">
              Required (10+ characters). This is the audit record of the adjudication.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-kyc-cancel">
              Cancel
            </Button>
            <Button
              variant={decision === "failed" ? "destructive" : "default"}
              disabled={notesTooShort || decideMutation.isPending || !active || !decision}
              onClick={() =>
                active &&
                decision &&
                decideMutation.mutate({ screeningId: active.id, decision, notes: notes.trim() })
              }
              data-testid="button-kyc-confirm"
            >
              {decideMutation.isPending
                ? "Recording…"
                : decision === "cleared"
                  ? "Record clearance"
                  : "Record failure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
