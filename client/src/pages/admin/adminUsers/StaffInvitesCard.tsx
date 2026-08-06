import { Check, Copy, Plus, Ticket } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRoleConfig } from "@/lib/adminUserDisplay";
import type { StaffInvite } from "@shared/schema";

export function StaffInvitesCard({
  invites,
  isLoading,
  copiedCode,
  onCopyCode,
  onCreateInvite,
}: {
  invites: StaffInvite[] | undefined;
  isLoading: boolean;
  copiedCode: string;
  onCopyCode: (code: string) => void;
  onCreateInvite: () => void;
}) {
  return (
    <Card data-testid="card-staff-invites">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Staff Invites
            </CardTitle>
            <CardDescription>Generate invite codes for new staff members</CardDescription>
          </div>
          <Button onClick={onCreateInvite} data-testid="button-create-invite">
            <Plus className="h-4 w-4 mr-2" />
            Create Invite
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : invites && invites.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite: StaffInvite) => {
                const isUsed = !!invite.usedAt;
                const isExpired = invite.expiresAt && new Date(invite.expiresAt) < new Date();
                return (
                  <TableRow key={invite.id} data-testid={`row-invite-${invite.id}`}>
                    <TableCell>
                      <code className="px-2 py-1 rounded bg-muted text-sm font-mono" data-testid={`text-invite-code-${invite.id}`}>
                        {invite.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getRoleConfig(invite.role).label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invite.email || "Any"}
                    </TableCell>
                    <TableCell>
                      {isUsed ? (
                        <Badge variant="success">Used</Badge>
                      ) : isExpired ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="info">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {invite.expiresAt ? format(new Date(invite.expiresAt), "MMM d, yyyy") : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {/* A used or expired code cannot be redeemed, so offering
                          copy on one would only hand out a dead code. */}
                      {!isUsed && !isExpired && (
                        <Button
                          variant="ghost"
                          size="icon" aria-label="Copy"
                          onClick={() => onCopyCode(invite.code)}
                          data-testid={`button-copy-invite-${invite.id}`}
                        >
                          {copiedCode === invite.code ? <Check className="h-4 w-4 text-success-subtle-foreground" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Ticket className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No invites created yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
