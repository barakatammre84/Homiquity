import { Badge } from "@/components/ui/badge";
import type { Task, TaskPriority } from "@shared/schema";

export interface BadgeSpec {
  variant: "default" | "secondary" | "destructive" | "outline";
  label: string;
}

/**
 * Resolve the badge for a task across both of its axes: lifecycle
 * (tasks.status, canonical uppercase) and the verification verdict
 * (verificationStatus).
 *
 * A rejection outranks the lifecycle label, because it is the thing the
 * borrower must act on — a task the server has reopened to OPEN after a
 * rejection would otherwise read as a bland "Pending" and lose the fact that
 * something was sent back. The one exception is a COMPLETED task, where a
 * stale rejected verdict must not override the finished state.
 */
export function statusBadgeSpec(task: Pick<Task, "status" | "verificationStatus">): BadgeSpec {
  if (task.verificationStatus === "rejected" && task.status !== "COMPLETED") {
    return { variant: "destructive", label: "Rejected" };
  }
  const statusConfig: Record<Task["status"], BadgeSpec> = {
    OPEN: { variant: "secondary", label: "Pending" },
    IN_PROGRESS:
      task.verificationStatus === "pending"
        ? { variant: "outline", label: "Submitted - Awaiting Review" }
        : { variant: "default", label: "In Progress" },
    BLOCKED: { variant: "secondary", label: "Blocked" },
    COMPLETED: { variant: "default", label: "Completed" },
    EXPIRED: { variant: "secondary", label: "Expired" },
  };
  return statusConfig[task.status] || { variant: "secondary" as const, label: task.status };
}

export function getStatusBadge(task: Pick<Task, "status" | "verificationStatus">) {
  const config = statusBadgeSpec(task);
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export interface PriorityBadgeSpec {
  className: string;
  label: string;
}

export function priorityBadgeSpec(priority: TaskPriority): PriorityBadgeSpec {
  const config: Record<TaskPriority, PriorityBadgeSpec> = {
    low: { className: "bg-muted text-muted-foreground", label: "Low Priority" },
    normal: { className: "bg-info-subtle text-info", label: "Normal Priority" },
    high: { className: "bg-warning-subtle text-warning-subtle-foreground", label: "High Priority" },
    urgent: { className: "bg-destructive-subtle text-destructive", label: "Urgent" },
  };
  return config[priority] ?? config.normal; // runtime guard: pre-0034 legacy rows
}

export function getPriorityBadge(priority: TaskPriority) {
  const p = priorityBadgeSpec(priority);
  return <Badge className={p.className}>{p.label}</Badge>;
}
