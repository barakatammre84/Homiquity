import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { useAuth } from "@/hooks/useAuth";
import type { LoanApplication, User } from "@shared/schema";
import {
  Users,
  FileText,
  DollarSign,
  TrendingUp,
  Shield,
} from "lucide-react";

// recharts (~150KB) lives in its own module so it code-splits out of the admin
// dashboard chunk; the KPI cards and table render without waiting on it.
const AdminCharts = lazy(() => import("./AdminCharts"));

interface AdminStats {
  totalUsers: number;
  totalApplications: number;
  totalLoanVolume: string;
  approvalRate: number;
  averageProcessingTime: number;
  applicationsByStatus: { status: string; count: number }[];
  loansByType: { type: string; count: number; volume: string }[];
  recentApplications: (LoanApplication & { user: User })[];
}

const STATUS_COLORS = {
  draft: "#9ca3af",
  submitted: "#3b82f6",
  analyzing: "#f59e0b",
  pre_approved: "#10b981",
  underwriting: "#8b5cf6",
  approved: "#22c55e",
  denied: "#ef4444",
  closed: "#6b7280",
};

export default function AdminDashboard() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: user?.role === "admin",
  });

  // No role check here on purpose — /admin routes through <AdminPage>. See the
  // note in AdminUsers.tsx; enforced by tests/routeGateDrift.test.ts. (The
  // check that used to sit here also ran BEFORE the isLoading branch below, so
  // had this page ever been mounted outside AdminPage it would have shown a
  // signed-in admin "Access Denied" while their session was still loading.)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <Skeleton className="mb-8 h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pieData = stats?.applicationsByStatus.map((item) => ({
    name: getStatusLabel(item.status),
    value: item.count,
    color: STATUS_COLORS[item.status as keyof typeof STATUS_COLORS] || "#9ca3af",
  })) || [];

  const barData = stats?.loansByType.map((item) => ({
    name: item.type.toUpperCase(),
    count: item.count,
    volume: parseFloat(item.volume) / 1000000,
  })) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Admin Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
        
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-primary-foreground/80 mb-3">
            <Shield className="h-5 w-5" />
            <span className="text-sm font-medium">Administrator</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-primary-foreground/80">
            Monitor loan pipeline, user activity, and system performance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="mx-auto max-w-7xl px-4 -mt-6 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Users"
            value={stats?.totalUsers ?? 0}
            icon={Users}
            tone="info"
            data-testid="text-total-users"
          />
          <StatCard
            label="Applications"
            value={stats?.totalApplications ?? 0}
            icon={FileText}
            tone="primary"
            data-testid="text-total-applications"
          />
          <StatCard
            label="Loan Volume"
            value={formatCurrency(stats?.totalLoanVolume || "0")}
            icon={DollarSign}
            tone="success"
            data-testid="text-loan-volume"
          />
          <StatCard
            label="Approval Rate"
            value={`${stats?.approvalRate || 0}%`}
            icon={TrendingUp}
            tone="warning"
            data-testid="text-approval-rate"
          />
        </div>
      </div>

      {/* Charts and Tables */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Suspense fallback={<Skeleton className="mb-8 h-80 w-full" />}>
          <AdminCharts barData={barData} pieData={pieData} />
        </Suspense>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle>Recent Applications</CardTitle>
                <CardDescription>Latest loan applications in the pipeline</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.recentApplications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={app.user?.profileImageUrl || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {app.user?.firstName?.[0] || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {app.user?.firstName} {app.user?.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {app.user?.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(app.purchasePrice || "0")}
                    </TableCell>
                    <TableCell className="capitalize">
                      {app.preferredLoanType || "Conventional"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(app.status)}>
                        {getStatusLabel(app.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(app.createdAt!).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
