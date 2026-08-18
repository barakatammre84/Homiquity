import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getStatusLabel, getStatusColor } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { LoanApplication, BrokerCommission, User } from "@shared/schema";
import {
  Users,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  Wallet,
  Briefcase,
} from "lucide-react";
import { format } from "date-fns";
import ReferralLink from "@/components/ReferralLink";

interface BrokerStats {
  totalReferrals: number;
  activeReferrals: number;
  closedLoans: number;
  totalLoanVolume: string;
  totalCommissionsEarned: string;
  pendingCommissions: string;
}

interface ReferralWithBorrower extends LoanApplication {
  borrower: User;
}

interface CommissionWithApplication extends BrokerCommission {
  application: LoanApplication;
}

export default function BrokerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<BrokerStats>({
    queryKey: ["/api/broker/stats"],
    enabled: !!user,
  });

  const { data: referrals, isLoading: referralsLoading } = useQuery<ReferralWithBorrower[]>({
    queryKey: ["/api/broker/referrals"],
    enabled: !!user,
  });

  const { data: commissions, isLoading: commissionsLoading } = useQuery<CommissionWithApplication[]>({
    queryKey: ["/api/broker/commissions"],
    enabled: !!user,
  });

  const isLoading = authLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="mt-8 h-64" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Referrals",
      value: stats?.totalReferrals || 0,
      icon: Users,
      color: "blue",
    },
    {
      title: "Active Loans",
      value: stats?.activeReferrals || 0,
      icon: Clock,
      color: "amber",
    },
    {
      title: "Closed Loans",
      value: stats?.closedLoans || 0,
      icon: CheckCircle2,
      color: "emerald",
    },
    {
      title: "Loan Volume",
      value: formatCurrency(stats?.totalLoanVolume || "0"),
      icon: TrendingUp,
      color: "purple",
    },
    {
      title: "Earned",
      value: formatCurrency(stats?.totalCommissionsEarned || "0"),
      icon: DollarSign,
      color: "emerald",
    },
    {
      title: "Pending",
      value: formatCurrency(stats?.pendingCommissions || "0"),
      icon: Wallet,
      color: "amber",
    },
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; icon: string }> = {
      blue: { bg: "bg-info-subtle", icon: "text-info" },
      amber: { bg: "bg-warning-subtle", icon: "text-warning-subtle-foreground" },
      emerald: { bg: "bg-success-subtle", icon: "text-success-subtle-foreground" },
      purple: { bg: "bg-secondary", icon: "text-primary" },
    };
    return colors[color] || colors.blue;
  };

  const getCommissionStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-success-subtle text-success-subtle-foreground";
      case "approved":
        return "bg-info-subtle text-info";
      case "pending":
        return "bg-warning-subtle text-warning-subtle-foreground";
      case "cancelled":
        return "bg-destructive-subtle text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header — calm greeting on the app ground (Calm Emerald) */}
      <div className="mx-auto max-w-7xl px-4 pt-8 sm:pt-10 pb-2 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Briefcase className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Partner Portal</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-dashboard-title">
          Broker Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Track your referrals, commissions, and performance
        </p>
      </div>

      {/* Stats Cards */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {statCards.map((stat) => {
            const colors = getColorClasses(stat.color);
            return (
              <Card key={stat.title}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg}`}>
                      <stat.icon className={`h-5 w-5 ${colors.icon}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{stat.title}</p>
                      <p className="text-lg font-bold truncate" data-testid={`text-stat-${stat.title.toLowerCase().replace(/\s/g, "-")}`}>
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8">
          <ReferralLink />
        </div>

        <Tabs defaultValue="referrals" className="space-y-6">
          <TabsList>
            <TabsTrigger value="referrals" data-testid="tab-referrals">
              <Users className="mr-2 h-4 w-4" />
              Referrals
            </TabsTrigger>
            <TabsTrigger value="commissions" data-testid="tab-commissions">
              <DollarSign className="mr-2 h-4 w-4" />
              Commissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="referrals" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Your Referrals</CardTitle>
                    <CardDescription>
                      Track the status of all borrowers you've referred
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {referralsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : referrals && referrals.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Borrower</TableHead>
                        <TableHead>Loan Purpose</TableHead>
                        <TableHead>Purchase Price</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {referrals.map((referral) => (
                        <TableRow key={referral.id} data-testid={`row-referral-${referral.id}`}>
                          <TableCell className="font-medium">
                            {referral.borrower?.firstName} {referral.borrower?.lastName}
                          </TableCell>
                          <TableCell className="capitalize">
                            {referral.loanPurpose?.replace("_", " ") || "Purchase"}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(referral.purchasePrice || "0")}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(referral.status)}>
                              {getStatusLabel(referral.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {referral.createdAt && format(new Date(referral.createdAt), "MMM d, yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No referrals yet</h3>
                    <p className="text-muted-foreground">
                      Start referring borrowers to build your pipeline
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="commissions" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Commission History</CardTitle>
                    <CardDescription>
                      Track your commission payments and pending earnings
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {commissionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : commissions && commissions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loan Amount</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Commission</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map((commission) => (
                        <TableRow key={commission.id} data-testid={`row-commission-${commission.id}`}>
                          <TableCell className="font-medium">
                            {formatCurrency(commission.loanAmount)}
                          </TableCell>
                          <TableCell>
                            {(Number(commission.commissionRate) * 100).toFixed(2)}%
                          </TableCell>
                          <TableCell className="font-semibold text-success-subtle-foreground">
                            {formatCurrency(commission.commissionAmount)}
                          </TableCell>
                          <TableCell>
                            <Badge className={getCommissionStatusColor(commission.status)}>
                              {commission.status.charAt(0).toUpperCase() + commission.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {commission.paidAt
                              ? format(new Date(commission.paidAt), "MMM d, yyyy")
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold">No commissions yet</h3>
                    <p className="text-muted-foreground">
                      Commissions will appear here when your referrals close
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
