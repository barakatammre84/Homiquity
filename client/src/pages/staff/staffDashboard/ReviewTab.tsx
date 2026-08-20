import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, taskKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Plus, Upload, User as UserIcon, X } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { Task, LoanApplication } from "@shared/schema";
import { getStatusBadge } from "./badges";

/**
 * "Review" tab (extracted from StaffDashboard.tsx): tasks whose uploaded
 * documents await a human verdict (two-axis doctrine — lifecycle in status,
 * verdict in verificationStatus: IN_PROGRESS + pending awaits review; verify ⇒
 * COMPLETED/verified, reject ⇒ back to OPEN/rejected), plus the applications
 * list with per-file "Add Task" (opens the parent's CreateTaskDialog with the
 * application preselected).
 */
export function ReviewTab({
  submittedTasks,
  applications,
  tasks,
  isAdmin,
  getUserName,
  onAddTask,
}: {
  submittedTasks: Task[];
  applications: LoanApplication[];
  tasks: Task[];
  isAdmin: boolean;
  getUserName: (userId: string) => string | null;
  onAddTask: (applicationId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
      toast({ title: "Task Updated", description: "The task has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Tasks Awaiting Review</CardTitle>
          <CardDescription>Review uploaded documents and verify borrower information</CardDescription>
        </CardHeader>
        <CardContent>
          {submittedTasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
              <p className="font-medium">Nothing awaiting review</p>
              <p className="text-sm mt-1">When a borrower submits a requested document, it lands here for your review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submittedTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4 bg-info-subtle border-border"
                  data-testid={`review-task-${task.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle">
                      <Upload className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted by: {getUserName(task.assignedToUserId ?? "")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm" className="touch-target"
                      variant="outline"
                      onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "OPEN", verificationStatus: "rejected" } })}
                      data-testid={`button-reject-${task.id}`}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      size="sm" className="touch-target"
                      onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "COMPLETED", verificationStatus: "verified" } })}
                      data-testid={`button-verify-${task.id}`}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Verify
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isAdmin ? "All Applications" : "Team Applications"}</CardTitle>
          <CardDescription>
            {isAdmin
              ? "View every borrower application and assign tasks"
              : "View your deal-team applications and assign tasks"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserIcon className="mx-auto h-12 w-12 mb-4" />
              <p className="font-medium">{isAdmin ? "No applications yet" : "No applications assigned to your team"}</p>
              <p className="text-sm mt-1">Applications assigned to your deal team will appear here as borrowers apply.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {applications.map(app => (
                <div
                  key={app.id}
                  className="flex items-center justify-between gap-4 rounded-lg border p-4 hover-elevate"
                  data-testid={`application-row-${app.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <UserIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{getUserName(app.userId)}</p>
                      <p className="text-sm text-muted-foreground">
                        {app.propertyState ? `Property in ${app.propertyState}` : "No property"}
                        {app.purchasePrice ? ` - ${formatCurrency(app.purchasePrice)}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {getStatusBadge(app.status)}
                    <span className="text-sm text-muted-foreground">
                      {tasks.filter(t => t.applicationId === app.id).length} tasks
                    </span>
                    <Button
                      size="sm" className="touch-target"
                      variant="outline"
                      onClick={() => onAddTask(app.id)}
                      data-testid={`button-add-task-${app.id}`}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add Task
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
