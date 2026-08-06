import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { useToast } from "@/hooks/use-toast";
import type { StaffInvite } from "@shared/schema";
import { useAdminUserStats } from "@/hooks/useAdminUserStats";
import type { User } from "./adminUsers/types";
import { UserStatsGrid } from "./adminUsers/UserStatsGrid";
import { UsersTable } from "./adminUsers/UsersTable";
import { InvitesTable } from "./adminUsers/InvitesTable";
import { InviteDialog } from "./adminUsers/InviteDialog";
import { RoleDialog } from "./adminUsers/RoleDialog";

export default function AdminUsers() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !!currentUser && currentUser.role === "admin",
  });

  const { data: invitesData, isLoading: invitesLoading } = useQuery<{ invites: StaffInvite[] }>({
    queryKey: ["/api/staff-invites"],
    enabled: !!currentUser && currentUser.role === "admin",
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("PATCH", `/api/admin/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "User role updated successfully" });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: () => {
      toast({ title: "Failed to update user role", variant: "destructive" });
    },
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

  const handleCreateInvite = () => {
    if (inviteRole) {
      createInviteMutation.mutate({ role: inviteRole, email: inviteEmail || undefined });
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast({ title: "Invite code copied to clipboard" });
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setNewRole(user.role);
    setEditDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (selectedUser && newRole) {
      updateRoleMutation.mutate({ userId: selectedUser.id, role: newRole });
    }
  };

  const { filteredUsers, userStats } = useAdminUserStats(users, searchTerm, roleFilter);

  if (authLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (currentUser?.role !== "admin") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md" data-testid="card-access-denied">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <h2 className="text-xl font-semibold" data-testid="text-access-denied">Access Denied</h2>
            <p className="text-muted-foreground mt-2">
              You don't have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell
      width="full"
      title="User Management"
      subtitle="Manage user accounts and assign roles"
      titleTestId="text-page-title"
      contentClassName="space-y-6"
    >
      <UserStatsGrid stats={userStats} />

      <UsersTable
        filteredUsers={filteredUsers}
        isLoading={usersLoading}
        currentUserId={currentUser?.id}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        onEditRole={openEditDialog}
      />

      <InvitesTable
        invites={invitesData?.invites}
        isLoading={invitesLoading}
        copiedCode={copiedCode}
        onCopy={copyToClipboard}
        onCreateInvite={() => { setInviteDialogOpen(true); setInviteRole(""); setInviteEmail(""); setCopiedCode(""); }}
      />

      <InviteDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        inviteRole={inviteRole}
        onInviteRoleChange={setInviteRole}
        inviteEmail={inviteEmail}
        onInviteEmailChange={setInviteEmail}
        copiedCode={copiedCode}
        onCopy={copyToClipboard}
        onGenerate={handleCreateInvite}
        isPending={createInviteMutation.isPending}
      />

      <RoleDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        selectedUser={selectedUser}
        newRole={newRole}
        onNewRoleChange={setNewRole}
        onSave={handleUpdateRole}
        isPending={updateRoleMutation.isPending}
      />
    </PageShell>
  );
}
