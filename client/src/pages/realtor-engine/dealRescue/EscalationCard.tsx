import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckCircle2, Clock, MapPin, User } from "lucide-react";
import { format } from "date-fns";
import { formatDistanceToNowSafe } from "@/lib/dates";
import {
  formatIssueType,
  formatStatusLabel,
  getStatusClassName,
  getStatusVariant,
  getUrgencyClassName,
  getUrgencyVariant,
  slaRemaining,
  type DealRescueEscalation,
} from "./escalations";

export function SlaCountdown({ deadline }: { deadline: string }) {
  const { expired, hours, minutes, isUrgent } = slaRemaining(deadline, new Date());

  if (expired) {
    return <span className="text-xs font-medium text-destructive" data-testid="text-sla-expired">SLA Expired</span>;
  }

  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${isUrgent ? "text-destructive" : "text-muted-foreground"}`} data-testid="text-sla-countdown">
      <Clock className="h-3 w-3" />
      {hours}h {minutes}m remaining
    </span>
  );
}

export function EscalationCard({ esc, onResolve }: { esc: DealRescueEscalation; onResolve: (esc: DealRescueEscalation) => void }) {
  return (
    <Card data-testid={`card-escalation-${esc.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground" data-testid={`text-subject-${esc.id}`}>{esc.subject}</p>
              <Badge
                variant={getUrgencyVariant(esc.urgency)}
                className={getUrgencyClassName(esc.urgency)}
                data-testid={`badge-urgency-${esc.id}`}
              >
                {esc.urgency.charAt(0).toUpperCase() + esc.urgency.slice(1)}
              </Badge>
              <Badge variant="outline" data-testid={`badge-issue-type-${esc.id}`}>
                {formatIssueType(esc.issueType)}
              </Badge>
              <Badge
                variant={getStatusVariant(esc.status)}
                className={getStatusClassName(esc.status)}
                data-testid={`badge-status-${esc.id}`}
              >
                {formatStatusLabel(esc.status)}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground" data-testid={`text-description-${esc.id}`}>{esc.description}</p>

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {esc.borrowerName && (
                <span className="flex items-center gap-1" data-testid={`text-borrower-${esc.id}`}>
                  <User className="h-3 w-3" /> {esc.borrowerName}
                </span>
              )}
              {esc.propertyAddress && (
                <span className="flex items-center gap-1" data-testid={`text-address-${esc.id}`}>
                  <MapPin className="h-3 w-3" /> {esc.propertyAddress}
                </span>
              )}
              {esc.slaDeadline && (
                <SlaCountdown deadline={esc.slaDeadline} />
              )}
              {esc.closingDate && (
                <span className="flex items-center gap-1" data-testid={`text-closing-date-${esc.id}`}>
                  <Calendar className="h-3 w-3" /> Closing: {format(new Date(esc.closingDate), "MMM d, yyyy")}
                </span>
              )}
              <span data-testid={`text-created-${esc.id}`}>
                Reported {formatDistanceToNowSafe(esc.createdAt, { addSuffix: true })}
              </span>
            </div>

            {esc.resolution && (
              <div className="mt-2 rounded-md bg-muted p-2">
                <p className="text-xs font-medium text-foreground">Resolution:</p>
                <p className="text-xs text-muted-foreground" data-testid={`text-resolution-${esc.id}`}>{esc.resolution}</p>
              </div>
            )}
          </div>

          {esc.status !== "resolved" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onResolve(esc)}
              data-testid={`button-resolve-${esc.id}`}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
