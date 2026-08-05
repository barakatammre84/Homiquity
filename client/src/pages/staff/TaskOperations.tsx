import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertTriangle,
  TrendingUp,
  Filter,
  RefreshCw
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  ROLE_LABELS,
  USER_ROLE_TO_TASK_ROLE,
  type SlaClassConfig,
  type TaskMetrics,
  type TaskWithSlaStatus,
} from "./taskOperations/types";
import { MetricsRow } from "./taskOperations/MetricsRow";
import { SlaHeatmap } from "./taskOperations/SlaHeatmap";
import { SlaClassesCard } from "./taskOperations/SlaClassesCard";
import { TaskTable } from "./taskOperations/TaskTable";
import { EscalateTaskDialog } from "./taskOperations/EscalateTaskDialog";

export default function TaskOperations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = user?.role || "";
  const taskRole = USER_ROLE_TO_TASK_ROLE[userRole] || "all";
  const [selectedRole, setSelectedRole] = useState<string>(taskRole);
  // POST /api/task-engine/run-escalation is admin-only (inline check in
  // server/routes/task-engine.ts), and canAccessRoleQueue (server/services/taskEngine.ts)
  // lets a non-admin read ONLY its own role's queue. This page is admin+underwriter, so
  // an underwriter must not be offered the escalation trigger or the other roles' queues.
  //
  // Both isAdmin-gated controls below (the "Run Escalation Check" button and the
  // cross-role SelectItems) deliberately stay INLINE in this file:
  // tests/routeGateDrift.test.ts reads this source by path and asserts the gate
  // wraps them. Extracting either into ./taskOperations/ would move them out of
  // that guard's view — keep them here.
  const isAdmin = userRole === "admin";
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [escalationReason, setEscalationReason] = useState("");

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<TaskMetrics>({
    queryKey: ["/api/task-engine/metrics"],
    refetchInterval: 30000,
  });

  const { data: slaClasses } = useQuery<SlaClassConfig[]>({
    queryKey: ["/api/task-engine/sla-classes"],
  });

  const { data: allTasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<TaskWithSlaStatus[]>({
    queryKey: ["/api/task-engine/tasks/by-role", selectedRole],
    enabled: selectedRole !== "all",
  });

  const { data: myTasks } = useQuery<TaskWithSlaStatus[]>({
    queryKey: ["/api/task-engine/my-tasks"],
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      return apiRequest("POST", `/api/task-engine/tasks/${taskId}/escalate`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-engine"] });
      setEscalateDialogOpen(false);
      setSelectedTaskId(null);
      setEscalationReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Escalation Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      return apiRequest("PATCH", `/api/task-engine/tasks/${taskId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-engine"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Task Status Update Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const runEscalationMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/task-engine/run-escalation");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-engine"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Escalation Check Failed",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    },
  });

  const handleEscalate = (taskId: string) => {
    setSelectedTaskId(taskId);
    setEscalateDialogOpen(true);
  };

  const handleUpdateStatus = (taskId: string, status: string) => {
    updateStatusMutation.mutate({ taskId, status });
  };

  const handleRefresh = () => {
    refetchMetrics();
    refetchTasks();
  };

  return (
    <PageShell
      width="full"
      title="Task Operations"
      subtitle="Monitor SLAs, manage escalations, and track task progress"
      titleTestId="text-page-title"
      contentClassName="space-y-6"
      headerAction={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => runEscalationMutation.mutate()}
              disabled={runEscalationMutation.isPending}
              data-testid="button-run-escalation"
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Run Escalation Check
            </Button>
          )}
        </div>
      }
    >

        <MetricsRow metrics={metrics} />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                SLA Heatmap by Role
              </CardTitle>
              <CardDescription>
                Task distribution and SLA status across teams
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <SlaHeatmap data={metrics?.byStatus || {}} />
              )}
            </CardContent>
          </Card>

          <SlaClassesCard slaClasses={slaClasses} />
        </div>

        <Tabs defaultValue="my" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all-tasks">All Tasks</TabsTrigger>
              <TabsTrigger value="my" data-testid="tab-my-tasks">My Tasks</TabsTrigger>
              <TabsTrigger value="breached" data-testid="tab-breached">Breached</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-[180px]" data-testid="select-role-filter">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {isAdmin ? (
                    <>
                      <SelectItem value="LO">Loan Officer</SelectItem>
                      <SelectItem value="LOA">LO Assistant</SelectItem>
                      <SelectItem value="PROCESSOR">Processor</SelectItem>
                      <SelectItem value="UW">Underwriter</SelectItem>
                      <SelectItem value="CLOSER">Closer</SelectItem>
                      <SelectItem value="BORROWER">Borrower</SelectItem>
                    </>
                  ) : (
                    // Non-admins may only read their own role's queue (canAccessRoleQueue);
                    // every other option here would 403.
                    taskRole !== "all" && (
                      <SelectItem value={taskRole}>{ROLE_LABELS[taskRole] || taskRole}</SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Tasks</CardTitle>
                <CardDescription>
                  {selectedRole !== "all"
                    ? `Showing tasks for ${ROLE_LABELS[selectedRole.toUpperCase()] || selectedRole}`
                    : "Showing all active tasks"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasksLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <TaskTable
                    tasks={allTasks || []}
                    onEscalate={handleEscalate}
                    onUpdateStatus={handleUpdateStatus}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>My Assigned Tasks</CardTitle>
                <CardDescription>Tasks assigned to you</CardDescription>
              </CardHeader>
              <CardContent>
                <TaskTable
                  tasks={myTasks || []}
                  onEscalate={handleEscalate}
                  onUpdateStatus={handleUpdateStatus}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breached" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Breached Tasks</CardTitle>
                <CardDescription>Tasks that have exceeded their SLA</CardDescription>
              </CardHeader>
              <CardContent>
                <TaskTable
                  tasks={(allTasks || []).filter(t => t.slaStatus === "red")}
                  onEscalate={handleEscalate}
                  onUpdateStatus={handleUpdateStatus}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <EscalateTaskDialog
          open={escalateDialogOpen}
          onOpenChange={setEscalateDialogOpen}
          reason={escalationReason}
          onReasonChange={setEscalationReason}
          onConfirm={() => {
            if (selectedTaskId) {
              escalateMutation.mutate({
                taskId: selectedTaskId,
                reason: escalationReason
              });
            }
          }}
          isPending={escalateMutation.isPending}
        />
    </PageShell>
  );
}
