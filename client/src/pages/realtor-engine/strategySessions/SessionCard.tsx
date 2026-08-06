import { Calendar, CheckCircle2, Clock, FileText, ListChecks, XCircle } from "lucide-react";
import { formatDateSafe } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SessionTypeBadge, StatusBadge } from "./badges";
import type { StrategySession } from "./types";

export function SessionCard({
  session,
  onComplete,
  onCancel,
  onAddNotes,
}: {
  session: StrategySession;
  onComplete: (session: StrategySession) => void;
  onCancel: (id: string) => void;
  onAddNotes: (session: StrategySession) => void;
}) {
  return (
    <Card data-testid={`card-session-${session.id}`}>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground" data-testid={`text-topic-${session.id}`}>
                  {session.topic || "Untitled Session"}
                </p>
                <SessionTypeBadge type={session.sessionType} />
                <StatusBadge status={session.status} />
              </div>
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1" data-testid={`text-date-${session.id}`}>
                  <Calendar className="h-3 w-3" />
                  {formatDateSafe(session.scheduledAt, "MMM d, yyyy 'at' h:mm a", "Not scheduled")}
                </span>
                <span className="flex items-center gap-1" data-testid={`text-duration-${session.id}`}>
                  <Clock className="h-3 w-3" />
                  {session.durationMinutes} min
                </span>
              </div>
            </div>
            {/* Only a scheduled session can be completed or cancelled; an
                archived one keeps Add Notes so the record stays editable. */}
            {session.status === "scheduled" && (
              <div className="flex items-center gap-1 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAddNotes(session)}
                  data-testid={`button-add-notes-${session.id}`}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  Add Notes
                </Button>
                <Button
                  size="sm"
                  onClick={() => onComplete(session)}
                  data-testid={`button-complete-${session.id}`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onCancel(session.id)}
                  data-testid={`button-cancel-${session.id}`}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
              </div>
            )}
            {session.status !== "scheduled" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAddNotes(session)}
                data-testid={`button-add-notes-${session.id}`}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Add Notes
              </Button>
            )}
          </div>

          {session.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2" data-testid={`text-notes-${session.id}`}>
              {session.notes}
            </p>
          )}

          {session.actionItems && session.actionItems.length > 0 && (
            <div data-testid={`list-action-items-${session.id}`}>
              <div className="flex items-center gap-1 mb-1">
                <ListChecks className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Action Items</span>
              </div>
              <ul className="space-y-0.5">
                {session.actionItems.map((item, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                    <span data-testid={`text-action-item-${session.id}-${idx}`}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
