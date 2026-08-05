import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Shield } from "lucide-react";
import type { EscalationStatsSummary } from "./escalations";

/** The three desk counters above the escalation list. */
export function EscalationStats({ openCount, criticalCount, avgResolution }: EscalationStatsSummary) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Card data-testid="card-stat-open">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-warning/10 p-2">
              <Shield className="h-5 w-5 text-warning-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-stat-open-count">{openCount}</p>
              <p className="text-xs text-muted-foreground">Open Escalations</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-stat-critical">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-destructive/10 p-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-stat-critical-count">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-stat-resolution">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-success/10 p-2">
              <Clock className="h-5 w-5 text-success-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-stat-avg-resolution">{avgResolution}</p>
              <p className="text-xs text-muted-foreground">Avg Resolution Time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
