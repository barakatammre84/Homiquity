import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import type { EquitySnapshot, EquitySnapshotOutcome } from "./types";

export function EquitySection({ profileId }: { profileId: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: snapshots = [], isLoading, isError, error, refetch } = useQuery<EquitySnapshot[]>({
    queryKey: ["/api/homeowner/equity", profileId],
  });

  // The server measures the snapshot from the profile — there is nothing for the
  // client to supply — and answers with what it actually did. At most one
  // snapshot exists per day, so a second press must not claim a second reading.
  const recordMutation = useMutation({
    mutationFn: async (): Promise<EquitySnapshotOutcome> => {
      const res = await apiRequest("POST", "/api/homeowner/equity", {});
      return (await res.json()) as EquitySnapshotOutcome;
    },
    onSuccess: (outcome) => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/equity", profileId] });
      toast(
        outcome.created
          ? {
              title: "Snapshot recorded",
              description: outcome.pmiAlert
                ? "Your equity reached the 80% mark — we've sent you a note about removing PMI."
                : "Today's equity reading has been saved.",
            }
          : {
              title: "Already up to date",
              description: "Today's snapshot was already recorded — your equity is measured once a day.",
            },
      );
    },
    onError: () => toast({ title: "Error", description: "Failed to record snapshot.", variant: "destructive" }),
  });

  const maxEquity = snapshots.length > 0
    ? Math.max(...snapshots.map((s) => parseFloat(s.equityAmount || "0")))
    : 1;

  return (
    <Card data-testid="card-equity-growth">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base">Equity Growth</CardTitle>
          <CardDescription>Track your home equity over time</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => recordMutation.mutate()}
          disabled={recordMutation.isPending}
          data-testid="button-record-snapshot"
        >
          <Plus className="h-4 w-4 mr-1" /> Record Snapshot
        </Button>
      </CardHeader>
      <CardContent>
        {/* `snapshots` defaults to [], so without this branch a failed load
            would render "No equity snapshots yet" — telling the owner they have
            no equity history rather than that it didn't load (ux-01). */}
        {isError ? (
          <QueryErrorState
            error={error}
            onRetry={() => void refetch()}
            title="We couldn't load your equity history"
            data-testid="equity-error"
          />
        ) : isLoading ? (
          <Skeleton className="h-32" />
        ) : snapshots.length === 0 ? (
          <div className="py-6 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No equity snapshots yet. Record one to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-1 h-32" data-testid="equity-chart">
              {snapshots.slice(-12).map((snap) => {
                const eq = parseFloat(snap.equityAmount || "0");
                const heightPct = maxEquity > 0 ? (eq / maxEquity) * 100 : 0;
                return (
                  <div
                    key={snap.id}
                    className="flex-1 flex flex-col items-center gap-1"
                    data-testid={`bar-equity-${snap.id}`}
                  >
                    <div
                      className="w-full bg-primary/20 rounded-t-sm relative"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    >
                      <div
                        className="absolute bottom-0 w-full bg-primary rounded-t-sm"
                        style={{ height: "100%" }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(snap.snapshotDate), "M/yy")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
              {snapshots.length > 0 && (
                <span data-testid="text-latest-equity">
                  Latest: {formatCurrency(snapshots[snapshots.length - 1]?.equityAmount)} ({snapshots[snapshots.length - 1]?.equityPercent}%)
                </span>
              )}
              <span>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
