import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, CircleDot, Clock, XCircle } from "lucide-react";

export function getCheckStatusIcon(status: string) {
  switch (status) {
    case "cleared":
    case "passed":
    case "verified":
      return <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground" />;
    case "in_progress":
    case "pending":
      return <Clock className="h-4 w-4 text-warning-subtle-foreground" />;
    case "flagged":
      return <AlertTriangle className="h-4 w-4 text-warning-subtle-foreground" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  }
}

/**
 * An unmapped status falls through to a neutral badge showing the raw value —
 * visibly odd, but never silently absent. On a compliance screen a missing
 * badge would read as "no finding", which is the one thing it must not do.
 */
export function getStatusBadge(status: string) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Not Started" },
    in_progress: { variant: "outline", label: "In Progress" },
    passed: { variant: "default", label: "Passed" },
    verified: { variant: "default", label: "Verified" },
    cleared: { variant: "default", label: "Cleared" },
    failed: { variant: "destructive", label: "Failed" },
    flagged: { variant: "destructive", label: "Flagged" },
    expired: { variant: "secondary", label: "Expired" },
    not_started: { variant: "secondary", label: "Not Started" },
  };
  const c = config[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={c.variant} data-testid={`badge-status-${status}`}>{c.label}</Badge>;
}
