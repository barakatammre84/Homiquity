import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GUARANTEE_LABELS } from "./types";

export function GuaranteeTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    underwriting_24h: "bg-info/10 text-info",
    appraisal_48h: "bg-primary/10 text-primary",
    closing_10day: "bg-success/10 text-success-subtle-foreground",
    communication_daily: "bg-warning/10 text-warning-subtle-foreground",
  };
  return (
    <Badge variant="secondary" className={styles[type] || ""} data-testid={`badge-type-${type}`}>
      {GUARANTEE_LABELS[type] || type}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
    active: { label: "Active", variant: "default" },
    at_risk: { label: "At Risk", variant: "secondary" },
    met: { label: "Met", variant: "outline" },
    missed: { label: "Missed", variant: "destructive" },
  };
  const c = config[status] || { label: status, variant: "secondary" as const };

  const statusStyles: Record<string, string> = {
    active: "bg-info/10 text-info",
    at_risk: "bg-warning/10 text-warning-subtle-foreground",
    met: "bg-success/10 text-success-subtle-foreground",
    missed: "",
  };

  return (
    <Badge variant={c.variant} className={statusStyles[status] || ""} data-testid={`badge-status-${status}`}>
      {status === "met" && <CheckCircle2 className="h-3 w-3 mr-1" />}
      {status === "at_risk" && <AlertTriangle className="h-3 w-3 mr-1" />}
      {status === "missed" && <XCircle className="h-3 w-3 mr-1" />}
      {status === "active" && <Clock className="h-3 w-3 mr-1" />}
      {c.label}
    </Badge>
  );
}
