import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, MessageSquare } from "lucide-react";
import { formatDateSafe } from "@/lib/dates";
import { NewScenarioDialog, emptyScenarioDraft } from "./NewScenarioDialog";
import type { DealDeskThread } from "./types";

export function DealDeskTab() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newThread, setNewThread] = useState(emptyScenarioDraft);

  const { data: threads = [], isLoading, isError, error, refetch } = useQuery<DealDeskThread[]>({
    queryKey: ["/api/deal-desk/threads"],
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/deal-desk/threads", {
      ...newThread,
      loanAmount: newThread.loanAmount || null,
      creditScore: newThread.creditScore ? parseInt(newThread.creditScore) : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/threads"] });
      toast({ title: "Scenario submitted", description: "Your question has been sent to the loan team." });
      setDialogOpen(false);
      setNewThread(emptyScenarioDraft());
    },
    onError: () => toast({ title: "Error", description: "Failed to create scenario", variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="deal-desk-tab">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="font-semibold text-foreground">Deal Desk</h3>
          <p className="text-sm text-muted-foreground">Quick scenario questions for the loan team.</p>
        </div>
        <NewScenarioDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          draft={newThread}
          onDraftChange={setNewThread}
          onSubmit={() => createMutation.mutate()}
          isPending={createMutation.isPending}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}</div>
      ) : isError ? (
        // "No scenarios yet" on a failed load would hide an outstanding
        // question the loan team may already have answered (ux-01).
        <QueryErrorState
          error={error}
          onRetry={() => refetch()}
          title="We couldn't load your scenarios"
          data-testid="deal-desk-error"
        />
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No scenarios yet</p>
            <p className="text-sm text-muted-foreground mt-1">Ask the loan team quick scenario questions to help your clients.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card key={thread.id} className="hover-elevate" data-testid={`card-thread-${thread.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{thread.subject}</p>
                      <Badge variant={thread.status === "open" ? "default" : "secondary"}>
                        {thread.status === "open" ? "Open" : "Closed"}
                      </Badge>
                      {thread.scenarioType && (
                        <Badge variant="outline" className="text-[10px]">{thread.scenarioType}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {thread.loanAmount && <span>${Number(thread.loanAmount).toLocaleString()}</span>}
                      {thread.creditScore && <span>Score: {thread.creditScore}</span>}
                      <span>{formatDateSafe(thread.createdAt, "MMM d, yyyy")}</span>
                    </div>
                  </div>
                  <Button size="icon" aria-label="Next" variant="ghost" data-testid={`button-view-thread-${thread.id}`}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
