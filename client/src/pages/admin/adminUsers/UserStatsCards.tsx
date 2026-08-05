import { Home, UserCheck, Users, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminUserStats } from "@/hooks/useAdminUserStats";

export function UserStatsCards({ userStats }: { userStats: AdminUserStats }) {
  return (
    <>
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-users">{userStats.total}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-admins">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive-subtle">
                <Wrench className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-admin-count">{userStats.admins}</p>
                <p className="text-sm text-muted-foreground">Tech/Ops Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-staff">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-info-subtle">
                <UserCheck className="h-5 w-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-staff-count">{userStats.totalStaff}</p>
                <p className="text-sm text-muted-foreground">Staff Members</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-stat-clients">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success-subtle">
                <Home className="h-5 w-5 text-success-subtle-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-client-count">{userStats.totalClients}</p>
                <p className="text-sm text-muted-foreground">Clients</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Role Breakdown */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-lo-count">{userStats.loanOfficers}</p>
              <p className="text-xs text-muted-foreground">Loan Officers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-loa-count">{userStats.loas}</p>
              <p className="text-xs text-muted-foreground">LOAs</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-processor-count">{userStats.processors}</p>
              <p className="text-xs text-muted-foreground">Processors</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-underwriter-count">{userStats.underwriters}</p>
              <p className="text-xs text-muted-foreground">Underwriters</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-closer-count">{userStats.closers}</p>
              <p className="text-xs text-muted-foreground">Closers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center border-l-2 border-muted pl-2">
              <p className="text-xl font-bold" data-testid="text-aspiring-count">{userStats.aspiringOwners}</p>
              <p className="text-xs text-muted-foreground">Aspiring</p>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardContent className="pt-3 pb-3">
            <div className="text-center">
              <p className="text-xl font-bold" data-testid="text-active-buyer-count">{userStats.activeBuyers}</p>
              <p className="text-xs text-muted-foreground">Active Buyers</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
