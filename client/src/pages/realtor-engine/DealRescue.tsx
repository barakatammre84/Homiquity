import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  sortEscalations,
  summariseEscalations,
  type DealRescueEscalation,
} from "./dealRescue/escalations";
import { EscalationStats } from "./dealRescue/EscalationStats";
import { EscalationCard } from "./dealRescue/EscalationCard";
import { CreateEscalationDialog } from "./dealRescue/CreateEscalationDialog";
import { ResolveDialog } from "./dealRescue/ResolveDialog";

export default function DealRescue() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<DealRescueEscalation | null>(null);

  const {
    data: escalations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<DealRescueEscalation[]>({
    queryKey: ["/api/deal-rescue"],
  });

  const sorted = sortEscalations(escalations);
  const stats = summariseEscalations(escalations);

  // A failed load must not render as "0 open, 0 critical" — on an escalation
  // desk that reads as an all-clear when the API is actually down (ux-01).
  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load deal rescue escalations"
          data-testid="deal-rescue-error"
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <PageShell
      width="content"
      icon={<AlertTriangle className="h-6 w-6 text-destructive" />}
      title="Deal Rescue Hotline"
      subtitle="Urgent escalation for at-risk deals"
      titleTestId="text-page-title"
      headerAction={
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-report-issue">
          <Plus className="h-4 w-4 mr-1" /> Report Issue
        </Button>
      }
    >

      <EscalationStats {...stats} />

      {sorted.length === 0 ? (
        <Card data-testid="card-no-escalations">
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No escalations</p>
            <p className="text-sm text-muted-foreground mt-1">All deals are on track. Report an issue if something needs attention.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((esc) => (
            <EscalationCard key={esc.id} esc={esc} onResolve={setResolveTarget} />
          ))}
        </div>
      )}

      <CreateEscalationDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {resolveTarget && (
        <ResolveDialog
          escalation={resolveTarget}
          open={!!resolveTarget}
          onOpenChange={(v) => { if (!v) setResolveTarget(null); }}
        />
      )}
    </PageShell>
  );
}
