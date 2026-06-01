import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatTimeRemaining } from "@/lib/formatters";
import { type SlaStatus, SLA_DOT_COLORS, SLA_STATUS_LABELS } from "@/lib/sla";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ArrowUp,
  Users,
  FileText,
  TrendingUp,
  Activity,
  Filter,
  RefreshCw
} from "lucide-react";

interface TaskWithSlaStatus {
  id: string;
  applicationId: string;
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  triggerSource?: string;
  ownerRole?: string;
  slaClass?: string;
  slaDueAt?: string;
  escalationLevel?: number;
  status: string;
  priority?: string;
  createdAt?: string;
  slaStatus: SlaStatus;
  timeRemaining: number | null;
  percentageElapsed: number | null;
}

interface TaskMetrics {
  total: number;
  open: number;
  inProgress: number;
  completed: number;
  breached: number;
  byRole: Record<string, number>;
  bySlaClass: Record<string, number>;
  byStatus: Record<string, { green: number; amber: number; red: number }>;
}

interface SlaClassConfig {
  id: string;
  slaClass: string;
  name: string;
  description?: string;
  targetResolutionMinutes?: number;
  escalationStartMinutes?: number;
  hardBreachMinutes?: number;
  blocksLoanProgress?: boolean;
  colorCode?: string;
}


const ROLE_LABELS: Record<string, string> = {
  LO: "Loan Officer",
  LOA: "LO Assistant",
  PROCESSOR: "Processor",
  UW: "Underwriter",
  CLOSER: "Closer",
  ADMIN: "Admin",
  BORROWER: "Borrower",
  SYSTEM: "System",
};

const USER_ROLE_TO_TASK_ROLE: Record<string, string> = {
  lo: "LO",
  loa: "LOA",
  processor: "PROCESSOR",
  underwriter: "UW",
  closer: "CLOSER",
  admin: "ADMIN",
};

function SlaStatusBadge({ status }: { status: SlaStatus }) {
  return (
    <Badge 
      variant="outline" 
      className={`${SLA_DOT_COLORS[status]} text-white border-0`}
      data-testid={`badge-sla-${status}`}
    >
      {SLA_STATUS_LABELS[status]}
    </Badge>
  );
}

function MetricsCard({ 
  title, 
  value, 
  icon: Icon, 
  description,
  trend 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ElementType;
  description?: string;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function SlaHeatmap({ data }: { data: Record<string, { green: number; amber: number; red: number }> }) {
  const roles = Object.keys(data);
  
  if (roles.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No task data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {roles.map(role => {
        const stats = data[role];
        const total = stats.green + stats.amber + stats.red;
        if (total === 0) return null;
        
        return (
          <div key={role} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{ROLE_LABELS[role] || role}</span>
              <span className="text-xs text-muted-foreground">{total} tasks</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {stats.green > 0 && (
                <div 
                  className="bg-emerald-500 transition-all" 
                  style={{ width: `${(stats.green / total) * 100}%` }}
                  title={`${stats.green} on track`}
                />
              )}
              {stats.amber > 0 && (
                <div 
                  className="bg-amber-500 transition-all" 
                  style={{ width: `${(stats.amber / total) * 100}%` }}
                  title={`${stats.amber} at risk`}
                />
              )}
              {stats.red > 0 && (
                <div 
                  className="bg-red-500 transition-all" 
                  style={{ width: `${(stats.red / total) * 100}%` }}
                  title={`${stats.red} breached`}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskTable({ 
  tasks, 
  onEscalate, 
  onUpdateStatus 
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

export default function TaskOperations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = user?.role || "";
  const taskRole = USER_ROLE_TO_TASK_ROLE[userRole] || "all";
  const [selectedRole, setSelectedRole] = useState<string>(taskRole);
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
    <div className="flex-1 overflow-auto">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">
              Task Operations
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor SLAs, manage escalations, and track task progress
            </p>
          </div>
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
          </div>
        </div>

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
                        className={`bg-${sla.colorCode}-500/10 text-${sla.colorCode}-600 border-${sla.colorCode}-500/20`}
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
                  <SelectItem value="LO">Loan Officer</SelectItem>
                  <SelectItem value="LOA">LO Assistant</SelectItem>
                  <SelectItem value="PROCESSOR">Processor</SelectItem>
                  <SelectItem value="UW">Underwriter</SelectItem>
                  <SelectItem value="CLOSER">Closer</SelectItem>
                  <SelectItem value="BORROWER">Borrower</SelectItem>
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
                onClick={() => {
                  if (selectedTaskId) {
                    escalateMutation.mutate({ 
                      taskId: selectedTaskId, 
                      reason: escalationReason 
                    });
                  }
                }}
                disabled={escalateMutation.isPending}
                data-testid="button-confirm-escalate"
              >
                {escalateMutation.isPending ? "Escalating..." : "Escalate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
