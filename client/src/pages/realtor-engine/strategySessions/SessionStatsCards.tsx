import { Calendar, CheckCircle2, Clock } from "lucide-react";
import { formatDateSafe } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import type { StrategySession } from "./types";

export function SessionStatsCards({
  upcomingCount,
  completedCount,
  next,
}: {
  upcomingCount: number;
  /** Genuinely completed only — cancelled sessions are archived, not achieved. */
  completedCount: number;
  next: StrategySession | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Card data-testid="card-stat-upcoming">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-info/10">
              <Calendar className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-upcoming-count">
                {upcomingCount}
              </p>
              <p className="text-xs text-muted-foreground">Upcoming Sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-stat-completed">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-success/10">
              <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground" data-testid="text-completed-count">
                {completedCount}
              </p>
              <p className="text-xs text-muted-foreground">Completed Sessions</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card data-testid="card-stat-next">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground" data-testid="text-next-session">
                {next ? formatDateSafe(next.scheduledAt, "MMM d, h:mm a", "Not scheduled") : "None"}
              </p>
              <p className="text-xs text-muted-foreground">Next Session</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
