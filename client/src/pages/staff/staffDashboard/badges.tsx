// Staff-dashboard badge renderers and inline compliance checklist.
// Extracted verbatim from StaffDashboard.tsx.
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, Shield, CircleCheck } from "lucide-react";
import { type TaskPriority } from "@shared/schema";
import { COMPLIANCE_CHECKLIST_ITEMS, AUTOMATION_LABELS, STAGE_ORDER } from "./model";

export function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    in_progress: { variant: "default", label: "In Progress" },
    submitted: { variant: "outline", label: "Submitted" },
    verified: { variant: "default", label: "Verified" },
    rejected: { variant: "destructive", label: "Rejected" },
    completed: { variant: "default", label: "Completed" },
  };
  const config = statusConfig[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function getPriorityBadge(priority: TaskPriority) {
  const config: Record<TaskPriority, { className: string; label: string }> = {
    low: { className: "bg-muted text-muted-foreground", label: "Low" },
    normal: { className: "bg-info-subtle text-info", label: "Normal" },
    high: { className: "bg-warning-subtle text-warning-subtle-foreground", label: "High" },
    urgent: { className: "bg-destructive-subtle text-destructive", label: "Urgent" },
  };
  const p = config[priority] ?? config.normal; // runtime guard: pre-0034 legacy rows
  return <Badge className={p.className}>{p.label}</Badge>;
}

export function AutomationBadge({ source }: { source?: string }) {
  if (!source || source === "MANUAL") return null;
  const info = AUTOMATION_LABELS[source];
  if (!info) return null;
  const Icon = info.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 text-xs bg-secondary text-primary border-border" data-testid="badge-automation">
          <Icon className="h-3 w-3" />
          Automated
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-xs">
        <p>{info.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ComplianceChecklistInline({ stage, completionPct }: { stage: string; completionPct: number }) {
  const normalizedStage = stage === "analyzing" ? "pre_approved" : stage === "closing" ? "clear_to_close" : stage;
  const stageIdx = STAGE_ORDER.indexOf(normalizedStage);
  const effectiveIdx = stageIdx >= 0 ? stageIdx : 0;
  const items = COMPLIANCE_CHECKLIST_ITEMS.map(item => {
    const itemStageIdx = STAGE_ORDER.indexOf(item.stage);
    const isComplete = itemStageIdx < effectiveIdx || (itemStageIdx === effectiveIdx && completionPct > 50);
    const isCurrentStage = item.stage === normalizedStage;
    const isOverdue = isCurrentStage && !isComplete && completionPct > 75;
    return { ...item, isComplete, isCurrentStage, isOverdue };
  });

  const completed = items.filter(i => i.isComplete).length;
  const total = items.length;

  return (
    <div className="space-y-3" data-testid="compliance-checklist">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Compliance Checklist</span>
        </div>
        <span className="text-xs text-muted-foreground">{completed}/{total} complete</span>
      </div>
      <Progress value={(completed / total) * 100} className="h-1.5" />
      <div className="space-y-1.5">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
              item.isOverdue
                ? "bg-destructive-subtle"
                : item.isCurrentStage && !item.isComplete
                  ? "bg-warning-subtle"
                  : ""
            }`}
            data-testid={`compliance-item-${item.id}`}
          >
            {item.isComplete ? (
              <CircleCheck className="h-3.5 w-3.5 text-success-subtle-foreground shrink-0" />
            ) : item.isOverdue ? (
              <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
            )}
            <span className={`flex-1 ${item.isComplete ? "text-muted-foreground line-through" : ""}`}>
              {item.label}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help shrink-0" data-testid={`tooltip-regulation-${item.id}`}>
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                <p>{item.regulation}</p>
              </TooltipContent>
            </Tooltip>
            {item.isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
