import { CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStatusColor, getStatusLabel } from "@/lib/formatters";
import type { InviteWithStatus } from "./types";

export function InviteStatusBadge({ invite }: { invite: InviteWithStatus }) {
  if (invite.isExpired && invite.status !== "applied") {
    return <Badge variant="secondary" data-testid={`badge-status-expired-${invite.id}`}><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
  }
  switch (invite.status) {
    case "applied":
      // Partner progress signal: show how far the client's application has
      // actually progressed, not just that they applied.
      return (
        <span className="inline-flex items-center gap-1.5">
          <Badge variant="default" data-testid={`badge-status-applied-${invite.id}`}><CheckCircle2 className="w-3 h-3 mr-1" />Applied</Badge>
          {invite.applicationStatus && (
            <Badge
              variant="secondary"
              className={`no-default-hover-elevate no-default-active-elevate ${getStatusColor(invite.applicationStatus)}`}
              data-testid={`badge-app-progress-${invite.id}`}
            >
              {getStatusLabel(invite.applicationStatus)}
            </Badge>
          )}
        </span>
      );
    case "clicked":
      return <Badge variant="secondary" data-testid={`badge-status-clicked-${invite.id}`}><ExternalLink className="w-3 h-3 mr-1" />Clicked</Badge>;
    default:
      return <Badge variant="outline" data-testid={`badge-status-pending-${invite.id}`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
  }
}
