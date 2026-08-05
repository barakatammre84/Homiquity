import { CheckCircle2, Edit, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LifecycleStatus } from "./types";

export function StatusBadge({ status }: { status: LifecycleStatus }) {
  const config = {
    DRAFT: { variant: "secondary" as const, icon: Edit },
    ACTIVE: { variant: "default" as const, icon: CheckCircle2 },
    RETIRED: { variant: "outline" as const, icon: XCircle },
  };
  const { variant, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className="gap-1" data-testid={`badge-status-${status}`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}
