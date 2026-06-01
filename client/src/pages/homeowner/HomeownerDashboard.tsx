import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  TrendingUp,
  Calendar,
  Bell,
  BarChart3,
  CheckCircle2,
  XCircle,
  Plus,
  CalendarClock,
  Wallet,
  Building2,
  CreditCard,
  MapPin,
} from "lucide-react";
import { format } from "date-fns";

interface HomeownerProfile {
  id: string;
  userId: string;
  originalLoanAmount: string | null;
  currentLoanBalance: string | null;
  interestRate: string | null;
  monthlyPayment: string | null;
  propertyValue: string | null;
  purchasePrice: string | null;
  purchaseDate: string | null;
  loanCloseDate: string | null;
  propertyAddress: string | null;
  nextReviewDate: string | null;
  lastReviewDate: string | null;
}

interface RefiAlert {
  id: string;
  homeownerProfileId: string;
  currentRate: string;
  marketRate: string;
  potentialSavingsMonthly: string | null;
  potentialSavingsLifetime: string | null;
  isActionable: boolean;
  isDismissed: boolean;
  createdAt: string;
}

interface EquitySnapshot {
  id: string;
  homeownerProfileId: string;
  snapshotDate: string;
  estimatedValue: string | null;
  loanBalance: string | null;
  equityAmount: string | null;
  equityPercent: string | null;
}

const fmtCurrency = (value: string | number | null) => {
  if (value === null || value === undefined) return "$0";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "$0";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(num);
};

function SetupForm() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    propertyAddress: "",
    originalLoanAmount: "",
    currentLoanBalance: "",
    interestRate: "",
    monthlyPayment: "",
    propertyValue: "",
    purchasePrice: "",
    purchaseDate: "",
    loanCloseDate: "",
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/homeowner/profile", formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/profile"] });
      toast({ title: "Dashboard Created", description: "Your homeowner dashboard is ready." });
    },
    onError: () => toast({ title: "Error", description: "Failed to create profile.", variant: "destructive" }),
  });

  const update = (field: string, value: string) => setFormData((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto" data-testid="homeowner-setup">
      <div className="mb-6 text-center">
        <div className="p-3 bg-primary/10 rounded-lg inline-block mb-3">
          <Home className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-setup-title">
          Your Homeowner Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-setup-subtitle">
          Set up your post-close dashboard to track equity, get refi alerts, and schedule annual reviews
        </p>
      </div>

      <Card data-testid="card-setup-form">
        <CardHeader>
          <CardTitle className="text-base">Property Information</CardTitle>
          <CardDescription>Enter your property and loan details to get started.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground">Property Address</label>
            <AddressInput
              placeholder="Start typing your property address..."
              className="mt-1"
              defaultValue={formData.propertyAddress}
              onSelect={(result) => update("propertyAddress", result.formattedAddress)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Original Loan Amount</label>
              <Input
                type="number"
                value={formData.originalLoanAmount}
                onChange={(e) => update("originalLoanAmount", e.target.value)}
                placeholder="350000"
                className="mt-1"
                data-testid="input-original-loan"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Current Balance</label>
              <Input
                type="number"
                value={formData.currentLoanBalance}
                onChange={(e) => update("currentLoanBalance", e.target.value)}
                placeholder="340000"
                className="mt-1"
                data-testid="input-current-balance"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Interest Rate (%)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.interestRate}
                onChange={(e) => update("interestRate", e.target.value)}
                placeholder="6.5"
                className="mt-1"
                data-testid="input-interest-rate"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Monthly Payment</label>
              <Input
                type="number"
                value={formData.monthlyPayment}
                onChange={(e) => update("monthlyPayment", e.target.value)}
                placeholder="2200"
                className="mt-1"
                data-testid="input-monthly-payment"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Property Value</label>
              <Input
                type="number"
                value={formData.propertyValue}
                onChange={(e) => update("propertyValue", e.target.value)}
                placeholder="450000"
                className="mt-1"
                data-testid="input-property-value"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Purchase Price</label>
              <Input
                type="number"
                value={formData.purchasePrice}
                onChange={(e) => update("purchasePrice", e.target.value)}
                placeholder="400000"
                className="mt-1"
                data-testid="input-purchase-price"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-foreground">Purchase Date</label>
              <Input
                type="date"
                value={formData.purchaseDate}
                onChange={(e) => update("purchaseDate", e.target.value)}
                className="mt-1"
                data-testid="input-purchase-date"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Loan Close Date</label>
              <Input
                type="date"
                value={formData.loanCloseDate}
                onChange={(e) => update("loanCloseDate", e.target.value)}
                className="mt-1"
                data-testid="input-loan-close-date"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!formData.propertyAddress || createMutation.isPending}
              data-testid="button-setup-dashboard"
            >
              {createMutation.isPending ? "Setting Up..." : "Set Up Dashboard"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialCards({ profile }: { profile: HomeownerProfile }) {
  const balance = parseFloat(profile.currentLoanBalance || "0");
  const value = parseFloat(profile.propertyValue || "0");
  const equity = value - balance;
  const equityPercent = value > 0 ? ((equity / value) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="financial-summary">
      <Card data-testid="card-balance">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Current Balance</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-balance">{fmtCurrency(balance)}</p>
        </CardContent>
      </Card>
      <Card data-testid="card-property-value">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Property Value</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-property-value">{fmtCurrency(value)}</p>
        </CardContent>
      </Card>
      <Card data-testid="card-equity">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <p className="text-xs text-muted-foreground">Home Equity</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-equity">{fmtCurrency(equity)}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400" data-testid="text-equity-percent">{equityPercent}%</p>
        </CardContent>
      </Card>
      <Card data-testid="card-monthly-payment">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Monthly Payment</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-monthly-payment">{fmtCurrency(profile.monthlyPayment)}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function EquitySection({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const { data: snapshots = [], isLoading } = useQuery<EquitySnapshot[]>({
    queryKey: ["/api/homeowner/equity", profileId],
  });

  const recordMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/homeowner/equity", { homeownerProfileId: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/equity", profileId] });
      toast({ title: "Snapshot Recorded", description: "Equity snapshot has been saved." });
    },
    onError: () => toast({ title: "Error", description: "Failed to record snapshot.", variant: "destructive" }),
  });

  const maxEquity = snapshots.length > 0
    ? Math.max(...snapshots.map((s) => parseFloat(s.equityAmount || "0")))
    : 1;

  return (
    <Card data-testid="card-equity-growth">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base">Equity Growth</CardTitle>
          <CardDescription>Track your home equity over time</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => recordMutation.mutate()}
          disabled={recordMutation.isPending}
          data-testid="button-record-snapshot"
        >
          <Plus className="h-4 w-4 mr-1" /> Record Snapshot
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-32" />
        ) : snapshots.length === 0 ? (
          <div className="py-6 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No equity snapshots yet. Record one to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-end gap-1 h-32" data-testid="equity-chart">
              {snapshots.slice(-12).map((snap) => {
                const eq = parseFloat(snap.equityAmount || "0");
                const heightPct = maxEquity > 0 ? (eq / maxEquity) * 100 : 0;
                return (
                  <div
                    key={snap.id}
                    className="flex-1 flex flex-col items-center gap-1"
                    data-testid={`bar-equity-${snap.id}`}
                  >
                    <div
                      className="w-full bg-primary/20 rounded-t-sm relative"
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    >
                      <div
                        className="absolute bottom-0 w-full bg-primary rounded-t-sm"
                        style={{ height: "100%" }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground">
                      {format(new Date(snap.snapshotDate), "M/yy")}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
              {snapshots.length > 0 && (
                <span data-testid="text-latest-equity">
                  Latest: {fmtCurrency(snapshots[snapshots.length - 1]?.equityAmount)} ({snapshots[snapshots.length - 1]?.equityPercent}%)
                </span>
              )}
              <span>{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RefiAlertsSection({ profileId }: { profileId: string }) {
  const { toast } = useToast();
  const { data: alerts = [], isLoading } = useQuery<RefiAlert[]>({
    queryKey: ["/api/homeowner/refi-alerts", profileId],
  });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/homeowner/refi-alerts", { homeownerProfileId: profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/refi-alerts", profileId] });
      toast({ title: "Alert Generated", description: "A new refi alert has been created." });
    },
    onError: () => toast({ title: "Error", description: "Failed to generate alert.", variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: (alertId: string) => apiRequest("PUT", `/api/homeowner/refi-alerts/${alertId}`, { isDismissed: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/refi-alerts", profileId] });
      toast({ title: "Dismissed", description: "Alert has been dismissed." });
    },
    onError: () => toast({ title: "Error", description: "Failed to dismiss alert.", variant: "destructive" }),
  });

  const visibleAlerts = alerts.filter((a) => !a.isDismissed);

  return (
    <Card data-testid="card-refi-alerts">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Refi Alerts
          </CardTitle>
          <CardDescription>Get notified when refinancing could save you money</CardDescription>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-alert"
        >
          <Plus className="h-4 w-4 mr-1" /> Generate Alert
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : visibleAlerts.length === 0 ? (
          <div className="py-6 text-center">
            <Bell className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No active refi alerts. Generate one to check current rates.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border p-3"
                data-testid={`card-alert-${alert.id}`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-sm font-medium text-foreground">Rate Comparison</span>
                      {alert.isActionable && (
                        <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" data-testid={`badge-actionable-${alert.id}`}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Actionable
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                      <div>
                        <p className="text-muted-foreground">Your Rate</p>
                        <p className="font-semibold text-foreground" data-testid={`text-current-rate-${alert.id}`}>{alert.currentRate}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Market Rate</p>
                        <p className="font-semibold text-foreground" data-testid={`text-market-rate-${alert.id}`}>{alert.marketRate}%</p>
                      </div>
                      {alert.potentialSavingsMonthly && (
                        <div>
                          <p className="text-muted-foreground">Monthly Savings</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300" data-testid={`text-monthly-savings-${alert.id}`}>
                            {fmtCurrency(alert.potentialSavingsMonthly)}/mo
                          </p>
                        </div>
                      )}
                      {alert.potentialSavingsLifetime && (
                        <div>
                          <p className="text-muted-foreground">Lifetime Savings</p>
                          <p className="font-semibold text-emerald-700 dark:text-emerald-300" data-testid={`text-lifetime-savings-${alert.id}`}>
                            {fmtCurrency(alert.potentialSavingsLifetime)}
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Created: {format(new Date(alert.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dismissMutation.mutate(alert.id)}
                    disabled={dismissMutation.isPending}
                    data-testid={`button-dismiss-${alert.id}`}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnnualReviewSection({ profile }: { profile: HomeownerProfile }) {
  const { toast } = useToast();

  const scheduleMutation = useMutation({
    mutationFn: () => {
      const nextDate = new Date();
      nextDate.setFullYear(nextDate.getFullYear() + 1);
      return apiRequest("PUT", `/api/homeowner/profile/${profile.id}`, {
        nextReviewDate: nextDate.toISOString().split("T")[0],
        lastReviewDate: new Date().toISOString().split("T")[0],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/profile"] });
      toast({ title: "Review Scheduled", description: "Your annual review has been scheduled." });
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule review.", variant: "destructive" }),
  });

  return (
    <Card data-testid="card-annual-review">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4" /> Annual Review
        </CardTitle>
        <CardDescription>Stay on top of your mortgage health with annual check-ins</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Next Review</p>
            <p className="text-sm font-semibold text-foreground" data-testid="text-next-review">
              {profile.nextReviewDate
                ? format(new Date(profile.nextReviewDate), "MMMM d, yyyy")
                : "Not scheduled"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Review</p>
            <p className="text-sm font-semibold text-foreground" data-testid="text-last-review">
              {profile.lastReviewDate
                ? format(new Date(profile.lastReviewDate), "MMMM d, yyyy")
                : "Never"}
            </p>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending}
              data-testid="button-schedule-review"
            >
              <Calendar className="h-4 w-4 mr-1" />
              {scheduleMutation.isPending ? "Scheduling..." : "Schedule Review"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions({ profile }: { profile: HomeownerProfile }) {
  const { toast } = useToast();
  const [balanceDialog, setBalanceDialog] = useState(false);
  const [valueDialog, setValueDialog] = useState(false);
  const [newBalance, setNewBalance] = useState(profile.currentLoanBalance || "");
  const [newValue, setNewValue] = useState(profile.propertyValue || "");

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("PUT", `/api/homeowner/profile/${profile.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/homeowner/profile"] });
      toast({ title: "Updated", description: "Profile has been updated." });
      setBalanceDialog(false);
      setValueDialog(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update.", variant: "destructive" }),
  });

  return (
    <Card data-testid="card-quick-actions">
      <CardHeader>
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={balanceDialog} onOpenChange={setBalanceDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-update-balance">
                <Wallet className="h-4 w-4 mr-1" /> Update Balance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Loan Balance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">New Balance</label>
                  <Input
                    type="number"
                    value={newBalance}
                    onChange={(e) => setNewBalance(e.target.value)}
                    placeholder="Current loan balance"
                    className="mt-1"
                    data-testid="input-new-balance"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate({ currentLoanBalance: newBalance })}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-balance"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={valueDialog} onOpenChange={setValueDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-update-value">
                <Building2 className="h-4 w-4 mr-1" /> Update Property Value
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Update Property Value</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium text-foreground">Estimated Value</label>
                  <Input
                    type="number"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder="Current property value"
                    className="mt-1"
                    data-testid="input-new-value"
                  />
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate({ propertyValue: newValue })}
                    disabled={updateMutation.isPending}
                    data-testid="button-save-value"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardView({ profile }: { profile: HomeownerProfile }) {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6" data-testid="homeowner-dashboard">
      <div className="mb-2">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Home className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-dashboard-title">
              Homeowner Dashboard
            </h1>
            {profile.propertyAddress && (
              <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid="text-property-address">
                <MapPin className="h-3.5 w-3.5" /> {profile.propertyAddress}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap mt-1">
          {profile.purchaseDate && (
            <span data-testid="text-purchase-date">
              Purchased: {format(new Date(profile.purchaseDate), "MMM d, yyyy")}
            </span>
          )}
          {profile.loanCloseDate && (
            <span data-testid="text-close-date">
              Closed: {format(new Date(profile.loanCloseDate), "MMM d, yyyy")}
            </span>
          )}
          {profile.interestRate && (
            <span data-testid="text-interest-rate">
              Rate: {profile.interestRate}%
            </span>
          )}
        </div>
      </div>

      <FinancialCards profile={profile} />
      <EquitySection profileId={profile.id} />
      <RefiAlertsSection profileId={profile.id} />
      <AnnualReviewSection profile={profile} />
      <QuickActions profile={profile} />
    </div>
  );
}

export default function HomeownerDashboard() {
  const { data: profile, isLoading } = useQuery<HomeownerProfile | null>({
    queryKey: ["/api/homeowner/profile"],
  });

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (!profile) {
    return <SetupForm />;
  }

  return <DashboardView profile={profile} />;
}
