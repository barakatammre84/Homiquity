import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, MoreHorizontal, UserCog, Users, Filter } from "lucide-react";
import { format } from "date-fns";
import { isStaffRole, type UserRole } from "@shared/roles";
import { getRoleConfig, getInitials, getDisplayName } from "@/lib/adminUserDisplay";
import type { AdminUser } from "./types";

interface UsersTableProps {
  users: AdminUser[] | undefined;
  isLoading: boolean;
  currentUserId: string | undefined;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  roles: readonly UserRole[];
  onEditUser: (user: AdminUser) => void;
}

export function UsersTable({
  users,
  isLoading,
  currentUserId,
  searchTerm,
  onSearchTermChange,
  roleFilter,
  onRoleFilterChange,
  roles,
  onEditUser,
}: UsersTableProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle>All Users</CardTitle>
            <CardDescription>View and manage user accounts</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => onSearchTermChange(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-users"
              />
            </div>
            <Select value={roleFilter} onValueChange={onRoleFilterChange}>
              <SelectTrigger className="w-36" data-testid="select-role-filter">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {getRoleConfig(role).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : users && users.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const roleConfig = getRoleConfig(user.role);
                const RoleIcon = roleConfig.icon;
                const isCurrentUser = user.id === currentUserId;

                return (
                  <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.profileImageUrl || undefined} />
                          <AvatarFallback>{getInitials(user)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getDisplayName(user)}</p>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">You</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email || "No email"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isStaffRole(user.role) ? "info" : "secondary"}>
                        <RoleIcon className="h-3 w-3 mr-1" />
                        {roleConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.createdAt
                        ? format(new Date(user.createdAt), "MMM d, yyyy")
                        : "Unknown"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon" aria-label="More options"
                            data-testid={`button-actions-${user.id}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onEditUser(user)}
                            disabled={isCurrentUser}
                            data-testid={`button-change-role-${user.id}`}
                          >
                            <UserCog className="h-4 w-4 mr-2" />
                            Change Role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm || roleFilter !== "all"
                ? "No users match your search criteria"
                : "No users found"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
