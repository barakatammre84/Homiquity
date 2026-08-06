import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle, Target, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { PHASE_NAMES, type AcceleratorMilestone } from "./types";

export function MilestonesSection({ enrollmentId }: { enrollmentId: string }) {
  const { toast } = useToast();

  const {
    data: milestones = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<AcceleratorMilestone[]>({
    queryKey: ["/api/accelerator/milestones", enrollmentId],
  });

  const toggleMilestone = useMutation({
    mutationFn: (milestone: AcceleratorMilestone) =>
      apiRequest("PUT", `/api/accelerator/milestones/${milestone.id}`, {
        isCompleted: !milestone.isCompleted,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/milestones", enrollmentId] });
      queryClient.invalidateQueries({ queryKey: ["/api/accelerator/enrollment"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update milestone.", variant: "destructive" }),
  });

  const milestonesByPhase = milestones.reduce<Record<number, AcceleratorMilestone[]>>((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = [];
    acc[m.phase].push(m);
    return acc;
  }, {});

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
        <Trophy className="h-5 w-5 text-primary" />
        Phase Milestones
      </h2>
      {/* `milestones` defaults to [], so without this branch a failed load would
          render "No milestones yet" — telling someone mid-program their plan is
          empty rather than that it didn't load (ux-01). */}
      {isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load your milestones"
          data-testid="milestones-error"
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : milestones.length === 0 ? (
        <Card data-testid="card-no-milestones">
          <CardContent className="py-8 text-center">
            <Target className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No milestones yet</p>
            <p className="text-sm text-muted-foreground mt-1">Milestones will appear as your program progresses.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4" data-testid="milestones-list">
          {Object.keys(milestonesByPhase)
            .map(Number)
            .sort((a, b) => a - b)
            .map((phase) => (
              <div key={phase} data-testid={`milestone-phase-${phase}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" data-testid={`badge-phase-${phase}`}>
                    Phase {phase}
                  </Badge>
                  <span className="text-sm font-medium text-muted-foreground">
                    {PHASE_NAMES[phase] || ""}
                  </span>
                </div>
                <div className="space-y-1">
                  {milestonesByPhase[phase].map((milestone) => (
                    <Card key={milestone.id} data-testid={`card-milestone-${milestone.id}`}>
                      <CardContent className="py-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleMilestone.mutate(milestone)}
                            className="shrink-0"
                            data-testid={`button-toggle-milestone-${milestone.id}`}
                          >
                            {milestone.isCompleted ? (
                              <CheckCircle2 className="h-5 w-5 text-primary" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-sm font-medium ${milestone.isCompleted ? "line-through text-muted-foreground" : "text-foreground"}`}
                                data-testid={`text-milestone-title-${milestone.id}`}
                              >
                                {milestone.title}
                              </span>
                              <Badge variant="secondary" className="text-[10px]" data-testid={`badge-milestone-category-${milestone.id}`}>
                                {milestone.category}
                              </Badge>
                            </div>
                            {(milestone.targetValue || milestone.currentValue) && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                {milestone.currentValue && (
                                  <span data-testid={`text-milestone-current-${milestone.id}`}>
                                    Current: {milestone.currentValue}
                                  </span>
                                )}
                                {milestone.targetValue && (
                                  <span data-testid={`text-milestone-target-${milestone.id}`}>
                                    Target: {milestone.targetValue}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
