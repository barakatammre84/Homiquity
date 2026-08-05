import { formatTimeRemaining } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, ArrowUp } from "lucide-react";
import { ROLE_LABELS, type TaskWithSlaStatus } from "./model";
import { SlaStatusBadge } from "./SlaStatusBadge";

export function TaskTable({
  tasks,
  onEscalate,
  onUpdateStatus,
}: {
  tasks: TaskWithSlaStatus[];
  onEscalate: (taskId: string) => void;
  onUpdateStatus: (taskId: string, status: string) => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No tasks found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Task</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Time Remaining</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Escalation</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.taskTypeCode || task.taskType}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <SlaStatusBadge status={task.slaStatus} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-sm">
                    {formatTimeRemaining(task.timeRemaining)}
                  </span>
                  {task.percentageElapsed !== null && (
                    <Progress
                      value={task.percentageElapsed}
                      className="h-1.5 w-20"
                    />
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {ROLE_LABELS[task.ownerRole || ""] || task.ownerRole}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge variant={task.status === "OPEN" ? "default" : "secondary"}>
                  {task.status}
                </Badge>
              </TableCell>
              <TableCell>
                {task.escalationLevel !== undefined && task.escalationLevel > 0 ? (
                  <Badge variant="destructive">Level {task.escalationLevel}</Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {task.status !== "COMPLETED" && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateStatus(task.id, "COMPLETED")}
                        data-testid={`button-complete-${task.id}`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEscalate(task.id)}
                        data-testid={`button-escalate-${task.id}`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
