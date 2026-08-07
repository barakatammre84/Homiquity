import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { ALL_ROLES } from "@shared/schema";
import { useAdminUserStats } from "@/hooks/useAdminUserStats";
import type { AdminUser } from "./adminUsers/types";
import { UserStatsSummary } from "./adminUsers/UserStatsSummary";
import { UsersTable } from "./adminUsers/UsersTable";
import { RoleChangeDialog } from "./adminUsers/RoleChangeDialog";
import { StaffInvitesCard } from "./adminUsers/StaffInvitesCard";

export default function AdminUsers() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [newRole, setNewRole] = useState<string>("");

  const { data: users, isLoading: usersLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users"],
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

  const openEditDialog = (user: AdminUser) => {
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
      <UserStatsSummary stats={userStats} />

      <UsersTable
        users={filteredUsers}
        isLoading={usersLoading}
        currentUserId={currentUser?.id}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        roles={ALL_ROLES}
        onEditUser={openEditDialog}
      />

      <StaffInvitesCard />

      <RoleChangeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        newRole={newRole}
        onNewRoleChange={setNewRole}
        roles={ALL_ROLES}
        onSave={handleUpdateRole}
        isSaving={updateRoleMutation.isPending}
      />
    </PageShell>
  );
}
