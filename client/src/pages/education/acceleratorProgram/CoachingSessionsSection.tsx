import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { format } from "date-fns";
import { ScheduleSessionDialog } from "./ScheduleSessionDialog";
import type { CoachingSession } from "./types";
import { isSessionStatus, type SessionStatus } from "@shared/acceleratorProgram";

// The badge is the whole honesty of this surface: "Requested" and "Confirmed"
// are different facts, and the product used to render the first as the second.
// Keyed off SESSION_STATUSES in shared/acceleratorProgram.ts so a status the
// server can write always has a label here (the #247 phantom-status class).
const SESSION_STATUS_BADGE: Record<
  SessionStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  requested: { label: "Requested", variant: "outline" },
  confirmed: { label: "Confirmed", variant: "secondary" },
  completed: { label: "Completed", variant: "default" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  no_show: { label: "Missed", variant: "destructive" },
};

function SessionStatusBadge({ status }: { status: string }) {
  // Rows created before the request → confirm split carry the old "scheduled"
  // default. Showing the raw value is honest; inventing a label is not.
  const c = isSessionStatus(status)
    ? SESSION_STATUS_BADGE[status]
    : { label: status, variant: "secondary" as const };
  return <Badge variant={c.variant} data-testid={`badge-session-status-${status}`}>{c.label}</Badge>;
}

export function CoachingSessionsSection({ enrollmentId }: { enrollmentId: string }) {
  const {
    data: sessions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CoachingSession[]>({
    queryKey: ["/api/accelerator/coaching", enrollmentId],
  });

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Sessions with your loan officer
        </h2>
        <ScheduleSessionDialog enrollmentId={enrollmentId} />
      </div>
      {/* `sessions` defaults to [], so without this branch a failed load would
          render "No sessions yet" — hiding a request already in flight
          behind what looks like an empty calendar (ux-01). */}
      {isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load your sessions"
          data-testid="sessions-error"
        />
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card data-testid="card-no-sessions">
          <CardContent className="py-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ask for a time and a loan officer will confirm it with you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2" data-testid="sessions-list">
          {sessions.map((session) => (
            <Card key={session.id} data-testid={`card-session-${session.id}`}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground" data-testid={`text-session-topic-${session.id}`}>
                        {session.topic || "1:1 session"}
                      </span>
                      <SessionStatusBadge status={session.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="flex items-center gap-1" data-testid={`text-session-date-${session.id}`}>
                        <Calendar className="h-3 w-3" />
                        {format(new Date(session.scheduledAt), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                      <span className="flex items-center gap-1" data-testid={`text-session-duration-${session.id}`}>
                        <Clock className="h-3 w-3" />
                        {session.durationMinutes} min
                      </span>
                    </div>
                    {session.notes && (
                      <p className="text-xs text-muted-foreground mt-2" data-testid={`text-session-notes-${session.id}`}>
                        {session.notes}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
