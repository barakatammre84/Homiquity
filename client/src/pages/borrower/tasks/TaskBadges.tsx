import { Badge } from "@/components/ui/badge";
import type { Task, TaskPriority } from "@shared/schema";

// Badge over both task axes: lifecycle (tasks.status, canonical uppercase) and
// the verification verdict (verificationStatus) — a rejection outranks the
// lifecycle label because it is the thing the borrower must act on.
export function getTaskStatusBadge(task: Pick<Task, "status" | "verificationStatus">) {
  if (task.verificationStatus === "rejected" && task.status !== "COMPLETED") {
    return <Badge variant="destructive">Needs Attention</Badge>;
  }
  const config: Record<Task["status"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    OPEN: { variant: "secondary", label: "Pending" },
    IN_PROGRESS:
      task.verificationStatus === "pending"
        ? { variant: "default", label: "Submitted" }
        : { variant: "outline", label: "In Progress" },
    BLOCKED: { variant: "secondary", label: "Blocked" },
    COMPLETED: { variant: "default", label: "Completed" },
    EXPIRED: { variant: "secondary", label: "Expired" },
  };
  const c = config[task.status] || { variant: "secondary" as const, label: task.status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

export function getPriorityBadge(priority: TaskPriority) {
  const config: Record<TaskPriority, { className: string; label: string }> = {
    low: { className: "bg-muted text-muted-foreground", label: "Low" },
    normal: { className: "bg-primary/10 text-primary", label: "Normal" },
    high: { className: "bg-status-warning/10 text-status-warning", label: "High" },
    urgent: { className: "bg-status-danger/10 text-status-danger", label: "Urgent" },
  };
  const p = config[priority] ?? config.normal; // runtime guard: pre-0034 legacy rows
  return <Badge className={`no-default-hover-elevate no-default-active-elevate ${p.className}`}>{p.label}</Badge>;
}
