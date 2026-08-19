import { Ban, Copy, Mail, MoreHorizontal, Phone, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { InviteStatusBadge } from "./InviteStatusBadge";
import type { InviteWithStatus } from "./types";

export interface InviteTableProps {
  invites: InviteWithStatus[];
  onCopy: (text: string) => void;
  onResend: (id: string) => void;
  onRevoke: (id: string) => void;
  isResending: boolean;
  isRevoking: boolean;
}

export function InviteTable({
  invites,
  onCopy,
  onResend,
  onRevoke,
  isResending,
  isRevoking,
}: InviteTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Client</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {invites.map((invite) => (
          <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
            <TableCell className="font-medium">
              {invite.clientName || <span className="text-muted-foreground">Not specified</span>}
            </TableCell>
            <TableCell>
              <div className="flex flex-col gap-1">
                {invite.clientEmail && (
                  <span className="flex items-center gap-1 text-sm">
                    <Mail className="h-3 w-3" />
                    {invite.clientEmail}
                  </span>
                )}
                {invite.clientPhone && (
                  <span className="flex items-center gap-1 text-sm">
                    <Phone className="h-3 w-3" />
                    {invite.clientPhone}
                  </span>
                )}
                {!invite.clientEmail && !invite.clientPhone && (
                  <span className="text-muted-foreground">-</span>
                )}
              </div>
            </TableCell>
            <TableCell><InviteStatusBadge invite={invite} /></TableCell>
            <TableCell className="text-sm">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-default">
                    {invite.createdAt ? formatDistanceToNow(new Date(invite.createdAt), { addSuffix: true }) : "-"}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {invite.createdAt ? format(new Date(invite.createdAt), "MMM d, yyyy 'at' h:mm a") : "-"}
                </TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell className="text-sm">
              {invite.expiresAt ? (
                invite.isExpired && invite.status !== "applied" ? (
                  <span className="text-muted-foreground">Expired</span>
                ) : invite.status === "applied" ? (
                  <span className="text-muted-foreground">-</span>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">
                        {formatDistanceToNow(new Date(invite.expiresAt), { addSuffix: true })}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      {format(new Date(invite.expiresAt), "MMM d, yyyy")}
                    </TooltipContent>
                  </Tooltip>
                )
              ) : "-"}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-1">
                {!invite.isExpired && invite.status !== "applied" && (
                  <Button
                    size="sm" className="touch-target"
                    variant="ghost"
                    onClick={() => onCopy(`${window.location.origin}/apply/${invite.token}`)}
                    data-testid={`button-copy-${invite.id}`}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                )}
                {invite.status !== "applied" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" aria-label="More options" variant="ghost" data-testid={`button-more-${invite.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => onResend(invite.id)}
                        disabled={isResending}
                        data-testid={`menu-resend-${invite.id}`}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Resend (extend 30 days)
                      </DropdownMenuItem>
                      {!invite.isExpired && (
                        <DropdownMenuItem
                          onClick={() => onRevoke(invite.id)}
                          disabled={isRevoking}
                          className="text-destructive"
                          data-testid={`menu-revoke-${invite.id}`}
                        >
                          <Ban className="h-4 w-4 mr-2" />
                          Revoke Link
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
