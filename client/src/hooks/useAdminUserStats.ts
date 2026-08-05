import { useMemo } from "react";
import { isStaffRole } from "@shared/schema";

interface AdminUserStatsInput {
  id: string;
  role: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface AdminUserStats {
  total: number;
  admins: number;
  loanOfficers: number;
  loas: number;
  processors: number;
  underwriters: number;
  closers: number;
  aspiringOwners: number;
  activeBuyers: number;
  totalStaff: number;
  totalClients: number;
}

// Extracted from AdminUsers.tsx: the filter + the 10-count stats block were
// plain derived state recomputed on every render (10 separate array passes
// each keystroke). useMemo keyed on the actual inputs fixes that as a side
// effect of pulling the computation out of the component body.
export function useAdminUserStats<TUser extends AdminUserStatsInput>(
  users: TUser[] | undefined,
  searchTerm: string,
  roleFilter: string,
) {
  const filteredUsers = useMemo(
    () =>
      users?.filter((user) => {
        const matchesSearch =
          !searchTerm ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastName?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === "all" || user.role === roleFilter;
        return matchesSearch && matchesRole;
      }),
    [users, searchTerm, roleFilter],
  );

  const userStats = useMemo<AdminUserStats>(
    () => ({
      total: users?.length || 0,
      // Staff roles
      admins: users?.filter((u) => u.role === "admin").length || 0,
      loanOfficers: users?.filter((u) => u.role === "lo").length || 0,
      loas: users?.filter((u) => u.role === "loa").length || 0,
      processors: users?.filter((u) => u.role === "processor").length || 0,
      underwriters: users?.filter((u) => u.role === "underwriter").length || 0,
      closers: users?.filter((u) => u.role === "closer").length || 0,
      // Client roles
      aspiringOwners: users?.filter((u) => u.role === "aspiring_owner").length || 0,
      activeBuyers: users?.filter((u) => u.role === "active_buyer").length || 0,
      // Aggregates
      totalStaff: users?.filter((u) => isStaffRole(u.role)).length || 0,
      totalClients: users?.filter((u) => !isStaffRole(u.role)).length || 0,
    }),
    [users],
  );

  return { filteredUsers, userStats };
}
