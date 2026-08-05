import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  if (status === "affordable") {
    return (
      <Badge variant="default" className="bg-success text-success-foreground gap-1" data-testid="badge-affordable">
        <CheckCircle2 className="h-3 w-3" />
        Within Your Budget
      </Badge>
    );
  }
  if (status === "stretch") {
    return (
      <Badge variant="default" className="bg-warning text-warning-foreground gap-1" data-testid="badge-stretch">
        <AlertTriangle className="h-3 w-3" />
        Stretch Budget
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1" data-testid="badge-over-budget">
      <XCircle className="h-3 w-3" />
      Over Budget
    </Badge>
  );
}
