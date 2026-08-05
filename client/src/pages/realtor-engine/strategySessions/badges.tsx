import { Video } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SESSION_TYPE_CONFIG } from "./types";

export function SessionTypeBadge({ type }: { type: string }) {
  // Unknown types show the raw value with a neutral icon rather than blanking.
  const config = SESSION_TYPE_CONFIG[type] || { label: type, icon: Video };
  const Icon = config.icon;
  return (
    <Badge variant="outline" data-testid={`badge-session-type-${type}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = status === "completed" ? "default" : status === "cancelled" ? "secondary" : "outline";
  const className =
    status === "scheduled"
      ? "border-border/50 text-info"
      : status === "completed"
        ? "bg-success text-success-foreground border-border"
        : "";
  return (
    <Badge variant={variant} className={className} data-testid={`badge-status-${status}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
