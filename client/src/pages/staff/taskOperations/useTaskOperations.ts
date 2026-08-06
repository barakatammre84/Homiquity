import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, taskEngineKeys } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { USER_ROLE_TO_TASK_ROLE, type TaskMetrics, type SlaClassConfig, type TaskWithSlaStatus } from "./model";

export function useTaskOperations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const userRole = user?.role || "";
  const taskRole = USER_ROLE_TO_TASK_ROLE[userRole] || "all";
  const [selectedRole, setSelectedRole] = useState<string>(taskRole);
  // POST /api/task-engine/run-escalation is admin-only (inline check in
  // server/routes/task-engine.ts), and canAccessRoleQueue (server/services/taskEngine.ts)
  // lets a non-admin read ONLY its own role's queue. This page is admin+underwriter, so
  // an underwriter must not be offered the escalation trigger or the other roles' queues.
  const isAdmin = userRole === "admin";
  const [escalateDialogOpen, setEscalateDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [escalationReason, setEscalationReason] = useState("");

  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<TaskMetrics>({
    queryKey: taskEngineKeys.metrics(),
    refetchInterval: 30000,
  });

  const { data: slaClasses } = useQuery<SlaClassConfig[]>({
    queryKey: taskEngineKeys.slaClasses(),
  });

  const { data: allTasks, isLoading: tasksLoading, refetch: refetchTasks } = useQuery<TaskWithSlaStatus[]>({
    queryKey: taskEngineKeys.tasksByRole(selectedRole),
    enabled: selectedRole !== "all",
  });

  const { data: myTasks } = useQuery<TaskWithSlaStatus[]>({
    queryKey: taskEngineKeys.myTasks(),
  });

  const escalateMutation = useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      return apiRequest("POST", `/api/task-engine/tasks/${taskId}/escalate`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskEngineKeys.all() });
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
      queryClient.invalidateQueries({ queryKey: taskEngineKeys.all() });
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
      queryClient.invalidateQueries({ queryKey: taskEngineKeys.all() });
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

  const confirmEscalate = () => {
    if (selectedTaskId) {
      escalateMutation.mutate({ taskId: selectedTaskId, reason: escalationReason });
    }
  };

  return {
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
  };
}
