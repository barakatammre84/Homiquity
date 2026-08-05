import { type SlaStatus, SLA_DOT_COLORS, SLA_STATUS_LABELS } from "@/lib/sla";
import { Badge } from "@/components/ui/badge";

export function SlaStatusBadge({ status }: { status: SlaStatus }) {
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
