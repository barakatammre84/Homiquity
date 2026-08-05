import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Users,
  FileText,
  TrendingUp,
  Activity,
  Filter,
  RefreshCw,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { formatTimeRemaining } from "@/lib/formatters";
import { ROLE_LABELS } from "./taskOperations/model";
import { MetricsCard } from "./taskOperations/MetricsCard";
import { SlaHeatmap } from "./taskOperations/SlaHeatmap";
import { slaBadgeClass } from "./taskOperations/slaClassBadge";
import { TaskTable } from "./taskOperations/TaskTable";
import { useTaskOperations } from "./taskOperations/useTaskOperations";

export default function TaskOperations() {
  const {
    isAdmin,
    taskRole,
    selectedRole,
    setSelectedRole,
    metrics,
    metricsLoading,
    slaClasses,
    allTasks,
    tasksLoading,
    myTasks,
    escalateDialogOpen,
    setEscalateDialogOpen,
    escalationReason,
    setEscalationReason,
    escalateMutation,
    runEscalationMutation,
    handleEscalate,
    handleUpdateStatus,
    handleRefresh,
    confirmEscalate,
  } = useTaskOperations();

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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricsCard
            title="Total Active"
            value={metrics?.total || 0}
            icon={FileText}
            description="Active tasks"
          />
          <MetricsCard
            title="Open"
            value={metrics?.open || 0}
            icon={Clock}
            description="Awaiting action"
          />
          <MetricsCard
            title="In Progress"
            value={metrics?.inProgress || 0}
            icon={Activity}
            description="Being worked on"
          />
          <MetricsCard
            title="Completed"
            value={metrics?.completed || 0}
            icon={CheckCircle2}
            description="All time"
          />
          <MetricsCard
            title="Breached"
            value={metrics?.breached || 0}
            icon={AlertTriangle}
            description="SLA exceeded"
          />
        </div>

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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                SLA Classes
              </CardTitle>
              <CardDescription>
                Response time requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {slaClasses?.map((sla) => (
                  <div
                    key={sla.id}
                    className="flex items-center justify-between p-2 rounded-md border"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={slaBadgeClass(sla.colorCode)}
                      >
                        {sla.slaClass}
                      </Badge>
                      <span className="text-sm font-medium">{sla.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {sla.targetResolutionMinutes
                        ? formatTimeRemaining(sla.targetResolutionMinutes)
                        : "No limit"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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

        <Dialog open={escalateDialogOpen} onOpenChange={setEscalateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Escalate Task</DialogTitle>
              <DialogDescription>
                Escalating this task will notify the next level of management and may reassign the task.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Reason for escalation (optional)"
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                data-testid="input-escalation-reason"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEscalateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmEscalate}
                disabled={escalateMutation.isPending}
                data-testid="button-confirm-escalate"
              >
                {escalateMutation.isPending ? "Escalating..." : "Escalate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </PageShell>
  );
}
