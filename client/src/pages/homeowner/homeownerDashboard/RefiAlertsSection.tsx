import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCircle2, Plus, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import type { RefiAlert, RefiOpportunityOutcome } from "./types";

export function RefiAlertsSection({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: alerts = [], isLoading, isError, error, refetch } = useQuery<RefiAlert[]>({
    queryKey: ["/api/homeowner/refi-alerts", profileId],
  });

  // Every reason the server can decline to raise an alert, said plainly. The old
  // handler took a client-built alert and always reported success; the rates,
  // the savings figures and the decision are all the server's now, so this
  // surface reports the outcome instead of assuming one.
  const NOT_RAISED: Record<
    Extract<RefiOpportunityOutcome, { created: false }>["reason"],
    { title: string; description: string }
  > = {
    "rate-not-lower": {
      title: "No savings right now",
      description: "Market rates aren't far enough below your rate to be worth a refinance today.",
    },
    "open-alert-exists": {
      title: "You already have this alert",
      description: "Your open alert already reflects the current market rate.",
    },
    "clawback-window": {
      title: "Too soon to compare",
      description: "Your loan closed too recently for us to look at refinancing it. We'll keep checking.",
    },
    "no-market-rate": {
      title: "Rates unavailable",
      description: "We couldn't read current market rates just now. Please try again later.",
    },
    "no-note-rate": {
      title: "We need your rate",
      description: "Add your current interest rate in Quick Actions so we can compare it to the market.",
    },
  };

  const generateMutation = useMutation({
    mutationFn: async (): Promise<RefiOpportunityOutcome> => {
      const res = await apiRequest("POST", "/api/homeowner/refi-alerts", {});
      return (await res.json()) as RefiOpportunityOutcome;
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/refi-alerts", profileId] });
      toast(
        outcome.created
          ? {
              title: "We found a lower rate",
              description: `Market rates are at ${outcome.marketRate.toFixed(3)}% against your ${outcome.currentRate.toFixed(3)}% — an estimated $${Math.round(outcome.monthlySavings).toLocaleString()}/month before closing costs, subject to credit approval.`,
            }
          : NOT_RAISED[outcome.reason],
      );
    },
    onError: () => toast({ title: "Error", description: "Failed to check rates.", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest("PUT", `/api/homeowner/refi-alerts/${alertId}`, { isDismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/refi-alerts", profileId] });
      toast({ title: "Dismissed", description: "Alert has been dismissed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to dismiss alert.", variant: "destructive" }),
  });

  const visibleAlerts = alerts.filter((a) => !a.isDismissed);

  return (
    <Card data-testid="card-refi-alerts">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Refi Alerts
          </CardTitle>
          <CardDescription>Get notified when refinancing could save you money</CardDescription>
        </div>
        <Button
          size="sm" className="touch-target"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-alert"
        >
          <Plus className="h-4 w-4 mr-1" /> Check rates
        </Button>
      </CardHeader>
      <CardContent>
        {/* `alerts` defaults to [], so without this branch a failed load reads
            as "no refi opportunities" — an all-clear the owner may act on by
            doing nothing, when in fact nothing loaded (ux-01). */}
        {isError ? (
          <QueryErrorState
            error={error}
            onRetry={() => void refetch()}
            title="We couldn't load your refi alerts"
            data-testid="refi-alerts-error"
          />
        ) : isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : visibleAlerts.length === 0 ? (
          <div className="py-6 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No refi opportunities right now. Check rates to compare your rate against today's market.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border p-3"
                data-testid={`card-alert-${alert.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-medium text-foreground">Rate Comparison</span>
                      {alert.isActionable && (
                        <Badge variant="default" className="bg-success/10 text-success-subtle-foreground" data-testid={`badge-actionable-${alert.id}`}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Actionable
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Your Rate</p>
                        <p className="font-semibold text-foreground" data-testid={`text-current-rate-${alert.id}`}>{alert.currentRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Market Rate</p>
                        <p className="font-semibold text-foreground" data-testid={`text-market-rate-${alert.id}`}>{alert.marketRate}%</p>
                      </div>
                      {alert.potentialSavingsMonthly && (
                        <div>
                          <p className="text-muted-foreground">Monthly Savings</p>
                          <p className="font-semibold text-success-subtle-foreground" data-testid={`text-monthly-savings-${alert.id}`}>
                            {formatCurrency(alert.potentialSavingsMonthly)}/mo
                          </p>
                        </div>
                      )}
                      {alert.potentialSavingsLifetime && (
                        <div>
                          <p className="text-muted-foreground">Lifetime Savings</p>
                          <p className="font-semibold text-success-subtle-foreground" data-testid={`text-lifetime-savings-${alert.id}`}>
                            {formatCurrency(alert.potentialSavingsLifetime)}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Created: {format(new Date(alert.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button
                    size="sm" className="touch-target"
                    variant="outline"
                    onClick={() => dismissMutation.mutate(alert.id)}
                    disabled={dismissMutation.isPending}
                    data-testid={`button-dismiss-${alert.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
