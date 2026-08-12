import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Copy, Check, Ticket } from "lucide-react";
import { format } from "date-fns";
import { STAFF_ROLES } from "@shared/roles";
import type { StaffInvite } from "@shared/schema";
import { getRoleConfig } from "@/lib/adminUserDisplay";

// Self-contained: only mounted once the caller has already confirmed an admin
// session, so the invites query and mutation need no separate auth gate.
export function StaffInvitesCard() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const { data: invitesData, isLoading } = useQuery<{ invites: StaffInvite[] }>({
    queryKey: ["/api/staff-invites"],
  });

  const createInviteMutation = useMutation({
    mutationFn: async (data: { role: string; email?: string }) => {
      return apiRequest("POST", "/api/staff-invites", data);
    },
    onSuccess: async (response) => {
      const result = await response.json();
      queryClient.invalidateQueries({ queryKey: ["/api/staff-invites"] });
      setCopiedCode(result.invite.code);
      toast({ title: "Invite created successfully" });
    },
    onError: () => {
      toast({ title: "Failed to create invite", variant: "destructive" });
    },
  });

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({ title: "Invite code copied to clipboard" });
  };

  const openCreateDialog = () => {
    setDialogOpen(true);
    setInviteRole("");
    setInviteEmail("");
    setCopiedCode("");
  };

  const handleCreateInvite = () => {
    if (inviteRole) {
      createInviteMutation.mutate({ role: inviteRole, email: inviteEmail || undefined });
    }
  };

  return (
    <>
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
            <Button onClick={openCreateDialog} data-testid="button-create-invite">
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
          ) : invitesData?.invites && invitesData.invites.length > 0 ? (
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
                {invitesData.invites.map((invite: StaffInvite) => {
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
                        {!isUsed && !isExpired && (
                          <Button
                            variant="ghost"
                            size="icon" aria-label="Copy"
                            onClick={() => copyToClipboard(invite.code)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Staff Invite</DialogTitle>
            <DialogDescription>
              Generate an invite code that a user can redeem to get a staff role
            </DialogDescription>
          </DialogHeader>
          {copiedCode ? (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">Share this invite code:</p>
              <div className="flex items-center justify-center gap-2">
                <code className="px-4 py-2 rounded-lg bg-muted text-lg font-mono font-bold tracking-widest" data-testid="text-new-invite-code">
                  {copiedCode}
                </code>
                <Button variant="ghost" size="icon" aria-label="Copy" onClick={() => copyToClipboard(copiedCode)} data-testid="button-copy-new-code">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                The recipient can enter this code in their account settings to activate their staff role.
              </p>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Staff Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger data-testid="select-invite-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {STAFF_ROLES.filter(r => r !== "admin").map((role) => {
                      const config = getRoleConfig(role);
                      const Icon = config.icon;
                      return (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email (optional)</label>
                <Input
                  placeholder="Restrict to specific email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  data-testid="input-invite-email"
                />
                <p className="text-xs text-muted-foreground">Leave blank to allow anyone with the code to redeem it</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-invite">
              {copiedCode ? "Done" : "Cancel"}
            </Button>
            {!copiedCode && (
              <Button onClick={handleCreateInvite} disabled={!inviteRole || createInviteMutation.isPending} data-testid="button-generate-invite">
                {createInviteMutation.isPending ? "Creating..." : "Generate Code"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
