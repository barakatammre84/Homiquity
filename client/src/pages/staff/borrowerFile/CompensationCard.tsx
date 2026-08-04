import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Icons, iconSize } from "@/lib/icons";
import {
  COMPENSATION_MODELS,
  type CompensationModel,
} from "@shared/compliance/loCompensation";

/**
 * Staff election of the loan-originator compensation model — the client
 * surface for PATCH /api/loan-applications/:id/compensation (audit F-1's
 * route, flagged load-bearing-without-a-UI in
 * kb/governance/UNCONSUMED_CAPABILITIES.md: the Loan Estimate refuses to
 * generate until a model is elected, so without this card no file can price).
 *
 * Server-gate mirroring (the PreApprovalLetterCard rule — never offer an
 * action the server would reject):
 *  - The route is internal-staff + assignment-scoped; BorrowerFile is already
 *    staff-only, and the server re-checks assignment on every call.
 *  - The route 409s (`compensation_locked_after_le`) on a CHANGE after the
 *    Loan Estimate has issued, so once `leIssued` is set and an election
 *    exists the card shows a lock note instead of the edit button.
 *
 * No election is rendered as the blocking state it is — amber, with the
 * regulation named — not as an innocuous empty field.
 */

// One entry per shared COMPENSATION_MODELS — Record keeps it exhaustive at
// compile time; the colocated test pins it against the shared vocabulary.
export const COMPENSATION_MODEL_LABELS: Record<
  CompensationModel,
  { label: string; hint: string }
> = {
  lender_paid: {
    label: "Lender-paid",
    hint: "The wholesale lender pays our compensation. The borrower is charged no origination fee.",
  },
  borrower_paid: {
    label: "Borrower-paid",
    hint: "The borrower pays the origination fee. No compensation from the lender on this file.",
  },
};

function isCompensationModel(value: string): value is CompensationModel {
  return (COMPENSATION_MODELS as readonly string[]).includes(value);
}

export function CompensationCard({
  applicationId,
  model,
  bps,
  leIssued,
}: {
  applicationId: string;
  /** Current election off the staff application row; null = not elected. */
  model: string | null;
  bps: number | null;
  /** True once leIssuedDate is set — a change then needs a CoC, not this card. */
  leIssued: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const elected = model !== null && isCompensationModel(model) && bps !== null;
  const [draftModel, setDraftModel] = useState<CompensationModel>(
    elected ? (model as CompensationModel) : "lender_paid",
  );
  const [draftBps, setDraftBps] = useState<string>(bps !== null ? String(bps) : "");

  const electMutation = useMutation({
    mutationFn: async () => {
      const parsed = Number(draftBps);
      return apiRequest("PATCH", `/api/loan-applications/${applicationId}/compensation`, {
        model: draftModel,
        bps: parsed,
      });
    },
    onSuccess: () => {
      // The election changes the fee schedule, so the LE and everything under
      // the file are stale together.
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.detail(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.loanEstimate(applicationId) });
      setOpen(false);
      toast({ title: "Compensation recorded", description: "The fee schedule now reflects this election." });
    },
    onError: (error: Error) => {
      toast({
        title: "Could not record the election",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bpsNumber = Number(draftBps);
  const draftValid =
    draftBps.trim() !== "" && Number.isInteger(bpsNumber) && bpsNumber >= 0 && bpsNumber <= 1000;

  // Mirror of the server's 409: an elected file with an issued LE is locked.
  const locked = elected && leIssued;

  return (
    <Card data-testid="card-compensation">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icons.money className={iconSize.emphasis} />
          Loan Originator Compensation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {elected ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-muted-foreground">Model:</span>
            <span>
              <Badge variant="secondary" data-testid="badge-compensation-model">
                {COMPENSATION_MODEL_LABELS[model as CompensationModel].label}
              </Badge>
            </span>
            <span className="text-muted-foreground">Rate:</span>
            <span data-testid="text-compensation-bps">{bps} bps</span>
          </div>
        ) : (
          <p className="text-sm text-warning" data-testid="text-compensation-missing">
            No compensation model elected. The Loan Estimate cannot be generated for this file
            until staff record who pays the originator (12 CFR 1026.36(d)(2)).
          </p>
        )}

        {locked ? (
          <p className="text-xs text-muted-foreground" data-testid="text-compensation-locked">
            Locked — the Loan Estimate has issued. Changing the compensation model now requires a
            documented changed circumstance and redisclosure.
          </p>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                variant={elected ? "outline" : "default"}
                size="sm"
                data-testid="button-elect-compensation"
              >
                {elected ? "Edit election" : "Elect compensation"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Loan originator compensation</DialogTitle>
                <DialogDescription>
                  Who pays the originator on this transaction. This drives the borrower-paid
                  origination fee and the QM points-and-fees check — it is a compliance election,
                  not a pricing preference.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Two-option selection as toggle buttons — the ui kit carries
                    no radio-group, and a new Radix dependency is not worth two
                    options. aria-pressed carries the selection state. */}
                <div className="grid gap-2" role="group" aria-label="Compensation model">
                  {COMPENSATION_MODELS.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      onClick={() => setDraftModel(candidate)}
                      aria-pressed={draftModel === candidate}
                      data-testid={`option-${candidate}`}
                      className={`rounded-md border p-3 text-left transition-colors ${
                        draftModel === candidate
                          ? "border-primary bg-primary/5"
                          : "border-border hover-elevate"
                      }`}
                    >
                      <span className="block text-sm font-medium">
                        {COMPENSATION_MODEL_LABELS[candidate].label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {COMPENSATION_MODEL_LABELS[candidate].hint}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="comp-bps">Compensation (basis points of the loan amount)</Label>
                  <Input
                    id="comp-bps"
                    inputMode="numeric"
                    value={draftBps}
                    onChange={(event) => setDraftBps(event.target.value)}
                    placeholder="e.g. 200"
                    data-testid="input-compensation-bps"
                  />
                  <p className="text-xs text-muted-foreground">
                    Whole basis points, 0–1000, from the lender&apos;s comp plan or the
                    borrower-paid agreement.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => electMutation.mutate()}
                  disabled={!draftValid || electMutation.isPending}
                  data-testid="button-save-compensation"
                >
                  {electMutation.isPending ? "Saving…" : "Save election"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
