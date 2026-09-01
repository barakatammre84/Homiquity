import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, loanApplicationKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import { type LoanCondition } from "@shared/schema";
import { canSetConditionVerdict } from "@shared/statusVocabularies";

/**
 * Conditions tab + its clear/waive/N-A action dialog (extracted from
 * BorrowerFile.tsx). Waive and N/A require a reason for the audit trail;
 * clearing takes optional notes — the confirm button enforces it.
 */
export function ConditionsTab({
  applicationId,
  conditions,
  userRole,
}: {
  applicationId: string;
  conditions: LoanCondition[];
  /**
   * The viewer's role — each verdict button renders only when the server's
   * role policy (CONDITION_VERDICT_ROLES) permits it. The previous `isStaff`
   * gate offered Clear/Waive/N-A to every staff role while the route 403'd
   * an LO on all three and an LOA at the route gate itself (offered-and-
   * refused; 2026-08-23 walk record, GATES).
   */
  userRole: string | undefined;
}) {
  const canClear = canSetConditionVerdict(userRole, "cleared");
  const canWaive = canSetConditionVerdict(userRole, "waived");
  const canMarkNa = canSetConditionVerdict(userRole, "not_applicable");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [conditionAction, setConditionAction] = useState<{
    condition: LoanCondition | null;
    action: "cleared" | "waived" | "not_applicable" | null;
    notes: string;
  }>({ condition: null, action: null, notes: "" });

  const outstandingConditions = conditions.filter(c => c.status === "outstanding" || c.status === "submitted");
  const clearedConditions = conditions.filter(c => c.status === "cleared" || c.status === "waived" || c.status === "not_applicable");

  const updateConditionMutation = useMutation({
    mutationFn: async ({ id, status, clearanceNotes }: { id: string; status: string; clearanceNotes?: string }) => {
      return apiRequest("PATCH", `/api/conditions/${id}`, { status, clearanceNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.pipeline(applicationId) });
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.detail(applicationId) });
      const actionLabel = conditionAction.action === "cleared" ? "Cleared" : conditionAction.action === "waived" ? "Waived" : "Marked N/A";
      toast({
        title: `Condition ${actionLabel}`,
        description: `"${conditionAction.condition?.title}" has been ${actionLabel.toLowerCase()}.`,
      });
      setConditionAction({ condition: null, action: null, notes: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update condition",
        variant: "destructive",
      });
    },
  });

  const handleConditionAction = () => {
    if (!conditionAction.condition || !conditionAction.action) return;
    updateConditionMutation.mutate({
      id: conditionAction.condition.id,
      status: conditionAction.action,
      clearanceNotes: conditionAction.notes || undefined,
    });
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-warning-subtle-foreground" />
              Outstanding ({outstandingConditions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {outstandingConditions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No outstanding conditions
                </p>
              ) : (
                <div className="space-y-2">
                  {outstandingConditions.map((cond) => (
                    <div
                      key={cond.id}
                      className="rounded-lg border p-3"
                      data-testid={`condition-outstanding-${cond.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{cond.title}</p>
                          {cond.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cond.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{cond.category}</Badge>
                            <Badge variant={cond.priority === "prior_to_approval" ? "destructive" : "secondary"} className="text-xs">
                              {cond.priority?.replace(/_/g, " ")}
                            </Badge>
                            {cond.status === "submitted" && (
                              <Badge variant="default" className="text-xs">Submitted</Badge>
                            )}
                          </div>
                        </div>
                        {(canClear || canWaive || canMarkNa) && (
                          <div className="flex items-center gap-1 shrink-0">
                            {canClear && (
                              <Button
                                size="sm" className="touch-target"
                                variant="default"
                                onClick={() => setConditionAction({ condition: cond, action: "cleared", notes: "" })}
                                data-testid={`button-clear-condition-${cond.id}`}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Clear
                              </Button>
                            )}
                            {canWaive && (
                              <Button
                                size="sm" className="touch-target"
                                variant="outline"
                                onClick={() => setConditionAction({ condition: cond, action: "waived", notes: "" })}
                                data-testid={`button-waive-condition-${cond.id}`}
                              >
                                Waive
                              </Button>
                            )}
                            {canMarkNa && (
                              <Button
                                size="sm" className="touch-target"
                                variant="ghost"
                                onClick={() => setConditionAction({ condition: cond, action: "not_applicable", notes: "" })}
                                data-testid={`button-na-condition-${cond.id}`}
                              >
                                N/A
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success-subtle-foreground" />
              Resolved ({clearedConditions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              {clearedConditions.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No resolved conditions yet
                </p>
              ) : (
                <div className="space-y-2">
                  {clearedConditions.map((cond) => (
                    <div
                      key={cond.id}
                      className="rounded-lg border border-border/20 p-3"
                      data-testid={`condition-resolved-${cond.id}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{cond.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-xs">{cond.category}</Badge>
                            <Badge
                              variant={cond.status === "cleared" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {cond.status === "cleared" ? "Cleared" : cond.status === "waived" ? "Waived" : "N/A"}
                            </Badge>
                          </div>
                          {cond.clearanceNotes && (
                            <p className="text-xs text-muted-foreground mt-1">{cond.clearanceNotes}</p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0">
                          {formatDate(cond.clearedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!conditionAction.condition && !!conditionAction.action}
        onOpenChange={(open) => {
          if (!open) setConditionAction({ condition: null, action: null, notes: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {conditionAction.action === "cleared" && "Clear Condition"}
              {conditionAction.action === "waived" && "Waive Condition"}
              {conditionAction.action === "not_applicable" && "Mark as Not Applicable"}
            </DialogTitle>
            <DialogDescription>
              {conditionAction.action === "cleared" && "Confirm this condition has been satisfied and all required documentation is in place."}
              {conditionAction.action === "waived" && "Waiving removes this requirement. Provide a reason for the audit trail."}
              {conditionAction.action === "not_applicable" && "Mark this condition as not applicable to this loan file. Provide a reason for the audit trail."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-sm">{conditionAction.condition?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {conditionAction.condition?.category} · {conditionAction.condition?.priority?.replace(/_/g, " ")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                {conditionAction.action === "cleared" ? "Notes (optional)" : "Reason (required for audit)"}
              </Label>
              <Textarea
                value={conditionAction.notes}
                onChange={(e) => setConditionAction(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={
                  conditionAction.action === "cleared"
                    ? "Any notes about how the condition was satisfied..."
                    : "Explain why this condition is being waived or marked N/A..."
                }
                data-testid="input-condition-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConditionAction({ condition: null, action: null, notes: "" })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConditionAction}
              disabled={
                updateConditionMutation.isPending ||
                (conditionAction.action !== "cleared" && !conditionAction.notes.trim())
              }
              variant={conditionAction.action === "cleared" ? "default" : "outline"}
              data-testid="button-confirm-condition-action"
            >
              {updateConditionMutation.isPending ? "Updating..." : (
                conditionAction.action === "cleared" ? "Confirm Clear" :
                conditionAction.action === "waived" ? "Confirm Waive" :
                "Confirm N/A"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
