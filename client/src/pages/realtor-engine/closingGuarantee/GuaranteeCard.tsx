import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Shield } from "lucide-react";
import { format } from "date-fns";
import { formatDateSafe } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { GuaranteeTypeBadge, StatusBadge } from "./badges";
import { elapsedPercent, remainingUntil } from "./countdown";
import { GUARANTEE_ICONS, type ClosingGuaranteeRecord } from "./types";

/** Re-renders the card's clock-derived values once a minute. */
function useNow(intervalMs = 60000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function GuaranteeCard({ guarantee }: { guarantee: ClosingGuaranteeRecord }) {
  const now = useNow();
  const remaining = remainingUntil(guarantee.targetDate, now);
  const progressPercent = elapsedPercent(guarantee.createdAt, guarantee.targetDate, now);
  const Icon = GUARANTEE_ICONS[guarantee.guaranteeType] || Shield;

  return (
    <Card data-testid={`card-guarantee-${guarantee.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
              <GuaranteeTypeBadge type={guarantee.guaranteeType} />
              <StatusBadge status={guarantee.status} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span data-testid={`text-app-id-${guarantee.id}`}>
                  Application: {guarantee.applicationId}
                </span>
                <span data-testid={`text-target-date-${guarantee.id}`}>
                  Target: {formatDateSafe(guarantee.targetDate, "MMM d, yyyy h:mm a")}
                </span>
                {guarantee.targetHours && (
                  <span data-testid={`text-target-hours-${guarantee.id}`}>
                    ({guarantee.targetHours}h window)
                  </span>
                )}
              </div>

              {guarantee.status === "active" && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-info shrink-0" />
                  <span className="text-sm font-medium text-info" data-testid={`text-countdown-${guarantee.id}`}>
                    {remaining}
                  </span>
                </div>
              )}

              {guarantee.isAtRisk && guarantee.riskReason && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning-subtle-foreground shrink-0" />
                  <span className="text-sm text-warning-subtle-foreground" data-testid={`text-risk-reason-${guarantee.id}`}>
                    {guarantee.riskReason}
                  </span>
                </div>
              )}

              {guarantee.isMet && guarantee.actualDate && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success-subtle-foreground shrink-0" />
                  <span className="text-sm text-success-subtle-foreground" data-testid={`text-actual-date-${guarantee.id}`}>
                    Completed: {format(new Date(guarantee.actualDate), "MMM d, yyyy h:mm a")}
                  </span>
                </div>
              )}

              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Progress</span>
                  <span>{Math.round(progressPercent)}%</span>
                </div>
                <Progress
                  value={progressPercent}
                  className="h-1.5"
                  data-testid={`progress-${guarantee.id}`}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
