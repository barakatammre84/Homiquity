import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CalendarClock } from "lucide-react";
import { COC_REASONS, cocReasonById } from "@shared/compliance/changeOfCircumstance";

// -----------------------------------------------------------------------------
// TRID change-of-circumstance panel (staff, BorrowerFile overview tab).
//
// Records a changed circumstance (Reg Z §1026.19(e)(3)(iv)(A)–(F)) and tracks
// the 3-business-day revised-LE deadline (§1026.19(e)(4)(i)). The server
// computes the due date; delivery is stamped when the borrower next retrieves
// the regenerated Loan Estimate. An open record past its deadline blocks
// wholesale submission via broker readiness stage 1. Fee-tolerance impact is
// manual review by design — this panel records and tracks, it does not price.
// -----------------------------------------------------------------------------

interface CocRow {
  id: string;
  reasonType: string;
  description: string;
  informationReceivedAt: string;
  revisedLeDueDate: string;
  revisedLeDeliveredAt: string | null;
  status: "open" | "redisclosed" | "voided";
  voidReason: string | null;
}

const dateLabel = (iso: string) => new Date(iso).toISOString().split("T")[0];

export function ChangeOfCircumstancePanel({ applicationId }: { applicationId: string }) {
  const queryClient = useQueryClient();
  const [recordOpen, setRecordOpen] = useState(false);
  const [reasonType, setReasonType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [receivedOn, setReceivedOn] = useState(() => new Date().toISOString().split("T")[0]);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const { toast } = useToast();

  const listKey = loanApplicationKeys.changeOfCircumstances(applicationId);
  const { data: rows } = useQuery<CocRow[]>({ queryKey: listKey });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: listKey });
    queryClient.invalidateQueries({
      queryKey: loanApplicationKeys.submissionReadiness(applicationId),
    });
  };

  const recordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/change-of-circumstances`, {
        reasonType,
        description,
        informationReceivedAt: `${receivedOn}T12:00:00Z`,
      });
      return res.json();
    },
    onSuccess: (coc: CocRow) => {
      invalidate();
      setRecordOpen(false);
      setReasonType("");
      setDescription("");
      toast({
        title: "Change of circumstance recorded",
        description: `Revised Loan Estimate due by ${dateLabel(coc.revisedLeDueDate)} (3 business days).`,
      });
    },
    onError: (error: Error) => {
      toast({ title: "Could not record the change", description: error.message, variant: "destructive" });
    },
  });

  const voidMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/change-of-circumstances/${id}/void`, { reason });
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setVoidingId(null);
      setVoidReason("");
      toast({ title: "Change of circumstance voided" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not void", description: error.message, variant: "destructive" });
    },
  });

  const now = Date.now();
  const isOverdue = (r: CocRow) => {
    if (r.status !== "open") return false;
    const end = new Date(r.revisedLeDueDate);
    end.setUTCHours(23, 59, 59, 999);
    return now > end.getTime();
  };

  return (
    <Card data-testid="coc-panel">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
          Changes of circumstance (TRID)
        </CardTitle>
        <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="touch-target" variant="outline" data-testid="record-coc">
              Record change of circumstance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Record a change of circumstance</DialogTitle>
              <DialogDescription>
                Reg Z §1026.19(e)(3)(iv) reasons only. The revised Loan Estimate is due 3 business
                days from when the establishing information was received (§1026.19(e)(4)(i)).
                Fee-tolerance impact routes to manual review.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="coc-reason">Reason</Label>
                <Select value={reasonType} onValueChange={setReasonType}>
                  <SelectTrigger id="coc-reason" data-testid="coc-reason-select">
                    <SelectValue placeholder="Select the authorizing reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {COC_REASONS.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.label} — {r.cite}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="coc-description">What changed</Label>
                <Textarea
                  id="coc-description"
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  data-testid="coc-description"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="coc-received-on">Information received on</Label>
                <Input
                  id="coc-received-on"
                  type="date"
                  value={receivedOn}
                  max={new Date().toISOString().split("T")[0]}
                  onChange={e => setReceivedOn(e.target.value)}
                  data-testid="coc-received-on"
                />
              </div>
              <Button
                onClick={() => recordMutation.mutate()}
                disabled={recordMutation.isPending || !reasonType || description.trim().length === 0 || !receivedOn}
                data-testid="coc-save"
              >
                {recordMutation.isPending ? "Recording…" : "Record — start the 3-business-day clock"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {(rows?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="coc-empty">
            None recorded. Record one when information changes eligibility, settlement charges, or
            terms — the revised-LE clock starts from receipt of that information.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows!.map(r => {
              const reason = cocReasonById(r.reasonType);
              const overdue = isOverdue(r);
              return (
                <li key={r.id} className="rounded-md border border-border p-3 text-sm" data-testid={`coc-row-${r.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{reason?.label ?? r.reasonType}</span>
                    <Badge variant="outline">
                      {r.status === "open" ? (overdue ? "Overdue" : "Open") : r.status === "redisclosed" ? "Redisclosed" : "Voided"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted-foreground">{r.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {reason?.cite} · info received {dateLabel(r.informationReceivedAt)} · revised LE due {dateLabel(r.revisedLeDueDate)}
                    {r.revisedLeDeliveredAt && ` · delivered ${dateLabel(r.revisedLeDeliveredAt)}`}
                  </p>
                  {overdue && (
                    <p className="mt-1 text-xs text-destructive" data-testid={`coc-overdue-${r.id}`}>
                      Past the 3-business-day deadline — deliver the revised Loan Estimate; wholesale
                      submission is blocked until then.
                    </p>
                  )}
                  {r.status === "voided" && r.voidReason && (
                    <p className="mt-1 text-xs text-muted-foreground">Voided: {r.voidReason}</p>
                  )}
                  {r.status === "open" && (
                    voidingId === r.id ? (
                      <div className="mt-2 space-y-2">
                        <Label htmlFor={`coc-void-reason-${r.id}`} className="text-xs">
                          Why is this record being voided?
                        </Label>
                        <Input
                          id={`coc-void-reason-${r.id}`}
                          value={voidReason}
                          onChange={e => setVoidReason(e.target.value)}
                          data-testid={`coc-void-reason-${r.id}`}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm" className="touch-target"
                            variant="outline"
                            disabled={voidMutation.isPending || voidReason.trim().length === 0}
                            onClick={() => voidMutation.mutate({ id: r.id, reason: voidReason })}
                            data-testid={`coc-void-confirm-${r.id}`}
                          >
                            Void record
                          </Button>
                          <Button
                            size="sm" className="touch-target"
                            variant="ghost"
                            onClick={() => {
                              setVoidingId(null);
                              setVoidReason("");
                            }}
                            data-testid={`coc-void-cancel-${r.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="touch-target mt-1 h-7 px-2 text-xs"
                        onClick={() => setVoidingId(r.id)}
                        data-testid={`coc-void-${r.id}`}
                      >
                        Void (recorded in error)
                      </Button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
