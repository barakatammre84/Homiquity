import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, ChevronDown, ChevronUp, User } from "lucide-react";
import type { DealActivity } from "@shared/schema";
import { formatActivityTime } from "./model";

/** Collapsed-by-default recent-activity feed (extracted from Dashboard.tsx).
 * System entries (no performedBy) get the bot glyph; human entries the person. */
export function CollapsibleActivity({ activities }: { activities: DealActivity[] }) {
  const [expanded, setExpanded] = useState(false);

  if (activities.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="section-activity">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
        data-testid="button-toggle-activity"
      >
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Recent Activity
        </h3>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        {!expanded && (
          <Badge variant="secondary" className="text-[10px]" data-testid="badge-activity-count">
            {Math.min(activities.length, 5)}
          </Badge>
        )}
      </button>

      {expanded && (
        <Card className="shadow-card animate-in fade-in slide-in-from-top-1 duration-200" data-testid="card-recent-activity">
          <CardContent className="p-4">
            <div className="space-y-2.5">
              {activities.slice(0, 5).map((activity, index) => (
                <div key={activity.id} className="flex items-start gap-2.5" data-testid={`row-activity-${index}`}>
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border mt-0.5">
                    {!activity.performedBy ? (
                      <Bot className="h-2.5 w-2.5 text-muted-foreground" />
                    ) : (
                      <User className="h-2.5 w-2.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground" data-testid={`text-activity-desc-${index}`}>
                      {activity.description || activity.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground" data-testid={`text-activity-time-${index}`}>
                      {formatActivityTime(activity.createdAt!)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
