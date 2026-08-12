import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { friendlyApiError } from "@/lib/errorMessage";
import { Icons, iconSize } from "@/lib/icons";
import {
  isTerminalSubmissionStatus,
  nextSubmissionStatuses,
  type LenderSubmissionStatus,
} from "@shared/wholesaleLenders";

// -----------------------------------------------------------------------------
// Lender-submission lifecycle control (WF2-F5).
//
// PATCH /api/lender-submissions/:submissionId existed with ZERO client callers:
// once staff submitted a file to a wholesale lender the row was inert in the
// product — nobody could walk acknowledged → in_underwriting → conditions_issued
// → conditions_cleared → clear_to_close → funded, and because the funded
// transition is the only writer of fundedLoanAmount / compensationReceivedAmount
// (F-6), the compensation report could never be populated from the UI at all.
//
// The offered set is DERIVED from shared/wholesaleLenders.ts —
// `nextSubmissionStatuses` filters through the same `isValidSubmissionTransition`
// predicate the service enforces, so this UI cannot offer a move the server
// would 422. The table is not restated here.
//
// Refusals are surfaced, never swallowed: an illegal/terminal transition (422),
// a funded transition missing figures (400), or a role refusal (403) all reach
// the user as the server's own message via friendlyApiError.
// -----------------------------------------------------------------------------

/** "conditions_issued" → "conditions issued" — the spelling already used in the row. */
function humanize(status: string): string {
  return status.replace(/_/g, " ");
}

/** Blank-safe numeric parse: "" is absent, not 0. */
function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export function SubmissionLifecycleControl({
  applicationId,
  submissionId,
  status,
  lenderName,
}: {
  applicationId: string;
  submissionId: string;
  status: LenderSubmissionStatus;
  lenderName: string;
}) {
  const queryClient = useQueryClient();
  const [toStatus, setToStatus] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [fundedLoanAmount, setFundedLoanAmount] = useState("");
  const [compensationReceived, setCompensationReceived] = useState("");
  const { toast } = useToast();

  const options = nextSubmissionStatuses(status);
  const isFunding = toStatus === "funded";
  const fundedAmount = parseAmount(fundedLoanAmount);
  const compensationAmount = parseAmount(compensationReceived);
  // Mirrors the server's Zod exactly: fundedLoanAmount positive,
  // compensationReceivedAmount >= 0 — but PRESENT. A lender that remitted
  // nothing is a real, recordable outcome; a blank box is not.
  const fundingReady =
    fundedAmount !== null && fundedAmount > 0 && compensationAmount !== null && compensationAmount >= 0;

  const advanceMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/lender-submissions/${submissionId}`, {
        status: toStatus,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(isFunding
          ? {
              funding: {
                fundedLoanAmount: fundedAmount,
                compensationReceivedAmount: compensationAmount,
              },
            }
          : {}),
      });
      return res.json();
    },
    onSuccess: (updated: { status?: string }) => {
      queryClient.invalidateQueries({
        queryKey: loanApplicationKeys.lenderSubmissions(applicationId),
      });
      // The status change writes a deal activity (and, on funded, the revenue
      // figures) — both read through the pipeline query that feeds the file's
      // Timeline tab.
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.pipeline(applicationId) });
      setToStatus("");
      setNotes("");
      setFundedLoanAmount("");
      setCompensationReceived("");
      toast({
        title: `Submission ${humanize(updated.status ?? toStatus)}`,
        description: `${lenderName}: ${humanize(status)} → ${humanize(updated.status ?? toStatus)}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Status not changed",
        description: friendlyApiError(error, "The lender submission could not be updated."),
        variant: "destructive",
      });
    },
  });

  if (isTerminalSubmissionStatus(status) || options.length === 0) {
    return (
      <p
        className="text-xs text-muted-foreground"
        data-testid={`submission-terminal-${submissionId}`}
      >
        {humanize(status)} is final — this submission accepts no further status changes.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={`next-status-${submissionId}`} className="sr-only">
          Next status for the {lenderName} submission
        </Label>
        <Select value={toStatus} onValueChange={setToStatus}>
          <SelectTrigger
            id={`next-status-${submissionId}`}
            className="h-8 flex-1 text-xs"
            data-testid={`next-status-${submissionId}`}
          >
            <SelectValue placeholder="Advance to…" />
          </SelectTrigger>
          <SelectContent>
            {options.map(option => (
              <SelectItem
                key={option}
                value={option}
                data-testid={`option-next-status-${option}`}
              >
                {humanize(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          className="h-8"
          onClick={() => advanceMutation.mutate()}
          disabled={!toStatus || advanceMutation.isPending || (isFunding && !fundingReady)}
          data-testid={`advance-submission-${submissionId}`}
        >
          <Icons.next className={`mr-1 ${iconSize.inline}`} aria-hidden="true" />
          {advanceMutation.isPending ? "Saving…" : "Advance"}
        </Button>
      </div>

      {isFunding && (
        <div className="space-y-2" data-testid={`funding-form-${submissionId}`}>
          <p className="text-xs text-muted-foreground">
            Funding is where revenue is realised — both figures are required, and the server
            refuses the transition without them.
          </p>
          <div className="space-y-1">
            <Label htmlFor={`funded-amount-${submissionId}`} className="text-xs">
              Funded loan amount ($, from the lender's closing figures)
            </Label>
            <Input
              id={`funded-amount-${submissionId}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={fundedLoanAmount}
              onChange={e => setFundedLoanAmount(e.target.value)}
              data-testid={`funded-amount-${submissionId}`}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`compensation-received-${submissionId}`} className="text-xs">
              Compensation actually remitted by the lender ($)
            </Label>
            <Input
              id={`compensation-received-${submissionId}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={compensationReceived}
              onChange={e => setCompensationReceived(e.target.value)}
              data-testid={`compensation-received-${submissionId}`}
            />
          </div>
        </div>
      )}

      {toStatus === "denied" && (
        <p
          className="rounded-md bg-warning-subtle p-2 text-xs text-warning-subtle-foreground"
          data-testid={`denial-notice-${submissionId}`}
        >
          Recording a denial flags this file for the ECOA §1002.9 adverse-action notice, due
          within 30 days. The borrower is not notified of the denial automatically — staff
          prepare and deliver the notice through the credit adverse-action flow.
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor={`status-notes-${submissionId}`} className="text-xs">
          Notes (optional — what the lender said)
        </Label>
        <Textarea
          id={`status-notes-${submissionId}`}
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          data-testid={`status-notes-${submissionId}`}
        />
      </div>
    </div>
  );
}
