import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, ArrowUp, CheckCircle2, Eye, Sparkles } from "lucide-react";
import { formatTimeRemaining } from "@/lib/formatters";
import { SLA_STATUS_COLORS, SLA_DOT_COLORS } from "@/lib/sla";
import { type QueueTask } from "./model";
import { AutomationBadge } from "./badges";

/**
 * "My Queue" tab (extracted from StaffDashboard.tsx): the role-scoped
 * task-engine queue, SLA-sorted by the parent (red → yellow → green, then
 * time remaining). Pure render + navigation.
 */
export function MyQueueTab({
  sortedQueueTasks,
  queueLoading,
  queueBreached,
  automatedTasks,
}: {
  sortedQueueTasks: QueueTask[];
  queueLoading: boolean;
  queueBreached: number;
  automatedTasks: QueueTask[];
}) {
  const [, navigate] = useLocation();
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle data-testid="text-my-queue-title">My Queue</CardTitle>
            <CardDescription>Tasks assigned to your role, sorted by SLA urgency</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {queueBreached > 0 && (
              <Badge variant="destructive" data-testid="badge-breached-alert">
                <AlertCircle className="h-3 w-3 mr-1" />
                {queueBreached} SLA breached
              </Badge>
            )}
            {automatedTasks.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="gap-1 bg-secondary text-primary border-border" data-testid="badge-auto-tasks-count">
                    <Sparkles className="h-3 w-3" />
                    {automatedTasks.length} automated
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  <p>{automatedTasks.length} tasks were auto-created by the rule engine or document processing</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {queueLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
        ) : sortedQueueTasks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
            <p className="font-medium">Queue is clear</p>
            <p className="text-sm mt-1">No open tasks assigned to your role</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedQueueTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-4 rounded-lg border p-4 hover-elevate cursor-pointer"
                onClick={() => navigate(`/borrower-file/${task.applicationId}`)}
                data-testid={`queue-task-${task.id}`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`flex h-3 w-3 rounded-full shrink-0 ${SLA_DOT_COLORS[task.slaStatus]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{task.title}</p>
                      {task.slaClass && (
                        <Badge variant="outline" className="text-xs shrink-0">{task.slaClass}</Badge>
                      )}
                      <AutomationBadge source={task.triggerSource} />
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {task.taskType === "document_request" ? "Document Request" : task.taskType}
                      {task.triggerSource && task.triggerSource !== "MANUAL" && ` · ${task.triggerSource.replace(/_/g, " ").toLowerCase()}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 flex-wrap">
                  <span className={`text-sm font-medium ${SLA_STATUS_COLORS[task.slaStatus]}`} data-testid={`text-sla-status-${task.id}`}>
                    {task.slaStatus === "red" ? (
                      <span className="flex items-center gap-1">
                        <ArrowUp className="h-3 w-3" />
                        {formatTimeRemaining(task.timeRemaining)}
                      </span>
                    ) : formatTimeRemaining(task.timeRemaining)}
                  </span>
                  {(task.escalationLevel ?? 0) > 0 && (
                    <Badge variant="destructive" className="text-xs" data-testid={`badge-escalation-${task.id}`}>
                      L{task.escalationLevel}
                    </Badge>
                  )}
                  <Badge variant={task.status === "OPEN" ? "outline" : "secondary"}>
                    {task.status === "OPEN" ? "Open" : task.status === "IN_PROGRESS" ? "In Progress" : task.status}
                  </Badge>
                  <Button
                    size="icon" aria-label="View"
                    variant="ghost"
                    onClick={(e) => { e.stopPropagation(); navigate(`/borrower-file/${task.applicationId}`); }}
                    data-testid={`button-view-file-${task.id}`}
                  >
                    <Eye className="h-4 w-4" />
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
