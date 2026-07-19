import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { StaffSignalsPanel } from "@/components/StaffSignalsPanel";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { isStaffRole, isInternalStaffRole, ROLE_DISPLAY_NAMES } from "@shared/roles";
import IntelligenceTab from "./IntelligenceTab";
import type { Task, LoanApplication, User } from "@shared/schema";
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  Eye,
  Inbox,
  Shield,
  ClipboardCheck,
  DollarSign,
  Timer,
  RefreshCw,
  Activity,
  BarChart3,
  Sparkles,
  Users,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { formatCurrency, getStatusLabel } from "@/lib/formatters";
import { SLA_SORT_ORDER } from "@/lib/sla";
import {
  type QueueTask,
  type QueueData,
  type ComplianceData,
  complianceScorePercent,
  coApplicantNames,
  STAGE_ORDER,
  getRoleDefaultTab,
} from "./staffDashboard/model";
import { ComplianceChecklistInline } from "./staffDashboard/badges";
import { CreateTaskDialog } from "./staffDashboard/CreateTaskDialog";
import { MyQueueTab } from "./staffDashboard/MyQueueTab";
import { ReviewTab } from "./staffDashboard/ReviewTab";
import { ComplianceTab } from "./staffDashboard/ComplianceTab";

export default function StaffDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [complianceDetailApp, setComplianceDetailApp] = useState<string | null>(null);

  const isStaff = isStaffRole(user?.role || "");
  // Internal staff (admin, lo, loa, processor, underwriter, closer) only — external
  // partner roles (broker, lender) must NOT hit the platform-wide staff endpoints,
  // which are gated to internal staff on the server.
  const isInternalStaff = isInternalStaffRole(user?.role || "");
  const userRole = user?.role || "";
  // Admins see every application platform-wide; every other internal-staff role is
  // scoped to their deal-team files (see GET /api/staff/applications). Labels below
  // are role-aware so the UI never implies broader visibility than the data allows.
  const isAdmin = userRole === "admin";
  const ownerRole = userRole.toUpperCase();

  const [activeTab, setActiveTab] = useState(() => getRoleDefaultTab(userRole));

  useEffect(() => {
    if (!authLoading && !isStaff) {
      navigate("/dashboard");
    }
  }, [authLoading, isStaff, navigate]);

  useEffect(() => {
    if (userRole) {
      setActiveTab(getRoleDefaultTab(userRole));
    }
  }, [userRole]);

  const { data: tasksData, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !authLoading && !!user,
  });

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<LoanApplication[]>({
    queryKey: ["/api/staff/applications"],
    enabled: !authLoading && !!user && isInternalStaff,
  });

  const { data: usersData } = useQuery<User[]>({
    queryKey: ["/api/staff/users"],
    enabled: !authLoading && !!user && isInternalStaff,
  });

  const { data: queueTasks, isLoading: queueLoading } = useQuery<QueueTask[]>({
    queryKey: ["/api/task-engine/tasks/by-role", ownerRole],
    enabled: !authLoading && !!user && isInternalStaff && !!ownerRole,
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/queue"],
    enabled: !authLoading && !!user && isInternalStaff,
    refetchInterval: 30000,
  });

  const { data: complianceData } = useQuery<ComplianceData>({
    queryKey: ["/api/compliance/dashboard"],
    enabled: !authLoading && !!user && isInternalStaff,
  });

  const tasks = tasksData || [];
  const applications = applicationsData || [];
  const users = usersData || [];
  const pipeline = pipelineData?.queue || [];
  const byStage = pipelineData?.byStage || {};

  const sortedQueueTasks = useMemo(() =>
    (queueTasks || [])
      .filter(t => t.status !== "COMPLETED" && t.status !== "EXPIRED")
      .sort((a, b) => {
        const aOrder = SLA_SORT_ORDER[a.slaStatus] ?? 2;
        const bOrder = SLA_SORT_ORDER[b.slaStatus] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.timeRemaining ?? Infinity) - (b.timeRemaining ?? Infinity);
      }),
    [queueTasks]
  );

  const queueBreached = sortedQueueTasks.filter(t => t.slaStatus === "red").length;
  // Awaiting review = doc submitted (IN_PROGRESS) with the verification
  // verdict still pending — the old check compared status === "submitted",
  // a value the canonical vocabulary never contained.
  const submittedTasks = tasks.filter(
    t => t.status === "IN_PROGRESS" && t.verificationStatus === "pending",
  );
  const automatedTasks = sortedQueueTasks.filter(t => t.triggerSource && t.triggerSource !== "MANUAL");

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "Unknown";
  };

  const totalVolume = pipeline.reduce((sum, l) => sum + (parseFloat(l.loanAmount || "0") || 0), 0);
  const complianceScore = complianceScorePercent(complianceData);

  if (authLoading || tasksLoading || applicationsLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-5 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (<Skeleton key={i} className="h-24" />))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You do not have permission to access the staff dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // External partners (broker, lender) pass the page guard but the operations
  // dashboard is internal-staff only. Brokers are routed to /broker-dashboard;
  // lender is a deferred persona with no product surface yet — show a neutral
  // partner landing instead of an empty internal shell.
  if (!isInternalStaff) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Partner workspace</h2>
            <p className="text-muted-foreground mb-6">
              Your partner workspace is being set up. The operations dashboard is
              reserved for internal staff.
            </p>
            {userRole === "broker" && (
              <Button onClick={() => navigate("/broker-dashboard")} data-testid="button-go-broker-dashboard">
                Go to Broker Dashboard
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/90">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

        <div className="relative px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary-foreground/80 mb-1">
                <BarChart3 className="h-4 w-4" />
                <span className="text-sm font-medium">Unified Command Center</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" data-testid="text-staff-dashboard-title">
                {ROLE_DISPLAY_NAMES[userRole as keyof typeof ROLE_DISPLAY_NAMES] || "Staff"} Dashboard
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                Pipeline, tasks, compliance, and activity in one view
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/20 text-white"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/compliance/dashboard"] });
                }}
                data-testid="button-refresh-all"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh All
              </Button>
              <CreateTaskDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                selectedApplication={selectedApplication}
                onSelectedApplicationChange={setSelectedApplication}
                applications={applications}
                getUserName={getUserName}
              />
            </div>
          </div>
        </div>
      </div>

      <PageShell width="full" contentClassName="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5" data-testid="section-kpi-cards">
          <Card data-testid="card-kpi-pipeline">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pipeline-count">{pipeline.length}</p>
                  <p className="text-xs text-muted-foreground">Active Loans</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{formatCurrency(totalVolume)} volume</p>
            </CardContent>
          </Card>

          <Card data-testid="card-kpi-queue">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-subtle">
                  <Inbox className="h-5 w-5 text-warning-subtle-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-queue-count">{sortedQueueTasks.length}</p>
                  <p className="text-xs text-muted-foreground">My Queue</p>
                </div>
              </div>
              {queueBreached > 0 && (
                <p className="text-xs text-destructive mt-2">{queueBreached} SLA breached</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-kpi-review">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle">
                  <Eye className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-review-count">{submittedTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Awaiting Review</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-kpi-compliance">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle">
                  <Shield className="h-5 w-5 text-success-subtle-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-compliance-score">{complianceScore}%</p>
                  <p className="text-xs text-muted-foreground">Compliance</p>
                </div>
              </div>
              {(complianceData?.needsAttention || 0) > 0 && (
                <p className="text-xs text-warning-subtle-foreground mt-2">{complianceData?.needsAttention} need attention</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-kpi-automated">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Sparkles className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-automated-count">{automatedTasks.length}</p>
                  <p className="text-xs text-muted-foreground">Auto-tasks</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Rule engine triggered</p>
            </CardContent>
          </Card>
        </div>

        <Card data-testid="card-stage-distribution">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pipeline Stage Distribution</span>
            </div>
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-7">
              {STAGE_ORDER.map((stage) => {
                const count = byStage[stage]?.length || 0;
                return (
                  <div
                    key={stage}
                    className={`flex flex-col items-center justify-center rounded-lg border p-2.5 ${
                      count > 0 ? "border-border" : "border-border opacity-50"
                    }`}
                    data-testid={`stage-count-${stage}`}
                  >
                    <span className="text-xl font-bold">{count}</span>
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">
                      {getStatusLabel(stage)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <StaffSignalsPanel />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4" data-testid="tabs-main">
            <TabsTrigger value="pipeline" data-testid="tab-pipeline">
              <FileText className="mr-1.5 h-4 w-4" />
              Pipeline ({pipeline.length})
            </TabsTrigger>
            <TabsTrigger value="my-queue" data-testid="tab-my-queue">
              <Inbox className="mr-1.5 h-4 w-4" />
              My Queue ({sortedQueueTasks.length})
            </TabsTrigger>
            <TabsTrigger value="conditions" data-testid="tab-conditions">
              <ClipboardCheck className="mr-1.5 h-4 w-4" />
              Review ({submittedTasks.length})
            </TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">
              <Shield className="mr-1.5 h-4 w-4" />
              Compliance
            </TabsTrigger>
            <TabsTrigger value="intelligence" data-testid="tab-intelligence">
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Intelligence
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h2 className="text-lg font-semibold" data-testid="text-pipeline-heading">Active Loans</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search loans..."
                      className="pl-9 w-48"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      data-testid="input-search-pipeline"
                    />
                  </div>
                </div>
                {pipelineLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>
                ) : pipeline.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                      <CheckCircle2 className="mb-4 h-12 w-12 text-muted-foreground" />
                      <p className="text-lg font-medium">No active loans</p>
                      <p className="text-muted-foreground">Pipeline is clear</p>
                    </CardContent>
                  </Card>
                ) : (
                  pipeline
                    .filter(item => {
                      if (!searchTerm) return true;
                      const s = searchTerm.toLowerCase();
                      return (item.borrowerName || "").toLowerCase().includes(s) ||
                        item.currentStage.toLowerCase().includes(s) ||
                        item.applicationId.toLowerCase().includes(s);
                    })
                    .map((item) => {
                      const compApp = complianceData?.applications?.find(a => a.applicationId === item.applicationId);
                      const appTasks = sortedQueueTasks.filter(t => t.applicationId === item.applicationId);
                      return (
                        <Card
                          key={item.applicationId}
                          className={`${complianceDetailApp === item.applicationId ? "ring-2 ring-primary" : ""}`}
                          data-testid={`card-loan-${item.applicationId}`}
                        >
                          <CardContent className="p-4">
                            <div className="flex flex-wrap items-start gap-4">
                              <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                                item.priority === "urgent" ? "bg-destructive" : item.priority === "high" ? "bg-warning" : "bg-info"
                              }`} />

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link href={`/borrower-file/${item.applicationId}`}>
                                    <span className="font-medium hover:underline cursor-pointer" data-testid={`link-loan-${item.applicationId}`}>
                                      {item.borrowerName || `Loan #${item.applicationId.slice(0, 8)}`}
                                    </span>
                                  </Link>
                                  <Badge variant="outline">{getStatusLabel(item.currentStage)}</Badge>
                                  {compApp?.gseReady && (
                                    <Badge variant="secondary" className="gap-1 text-xs bg-success-subtle text-success-subtle-foreground" data-testid={`badge-gse-${item.applicationId}`}>
                                      <CheckCircle2 className="h-3 w-3" />
                                      GSE Ready
                                    </Badge>
                                  )}
                                  {compApp?.gseGatingFailed && (
                                    <Badge variant="destructive" className="gap-1 text-xs" data-testid={`badge-gating-${item.applicationId}`}>
                                      <ShieldAlert className="h-3 w-3" />
                                      Gating Failed
                                    </Badge>
                                  )}
                                  {compApp?.qmStatus === "Non-QM" && (
                                    <Badge variant="destructive" className="gap-1 text-xs" data-testid={`badge-qm-${item.applicationId}`}>
                                      <Scale className="h-3 w-3" />
                                      Non-QM
                                    </Badge>
                                  )}
                                  {compApp?.qmStatus === "QM" && (
                                    <Badge variant="secondary" className="gap-1 text-xs bg-info-subtle text-info" data-testid={`badge-qm-${item.applicationId}`}>
                                      <Scale className="h-3 w-3" />
                                      QM
                                    </Badge>
                                  )}
                                  {(compApp?.coApplicantCount || 0) > 0 &&
                                    coApplicantNames(compApp?.coApplicants).map((name, i) => (
                                      <Badge
                                        key={i}
                                        variant="outline"
                                        className="gap-1 text-xs"
                                        data-testid={`badge-coapplicant-${item.applicationId}-${i}`}
                                      >
                                        <Users className="h-3 w-3" />
                                        {name}
                                      </Badge>
                                    ))}
                                  {(compApp?.criticalCount || 0) > 0 && (
                                    <Badge variant="destructive" className="text-xs" data-testid={`badge-critical-${item.applicationId}`}>
                                      {compApp?.criticalCount} critical
                                    </Badge>
                                  )}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="h-3 w-3" />
                                    {item.loanAmount ? formatCurrency(item.loanAmount) : "N/A"}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Timer className="h-3 w-3" />
                                    Day {item.daysInPipeline}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <ClipboardCheck className="h-3 w-3" />
                                    {item.conditionsCleared}/{item.conditionsTotal} conditions
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {item.documentsReceived}/{item.documentsRequired} docs
                                  </span>
                                  {appTasks.length > 0 && (
                                    <span className="flex items-center gap-1">
                                      <Inbox className="h-3 w-3" />
                                      {appTasks.length} open task{appTasks.length !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2.5">
                                  <Progress value={item.completionPercentage} className="h-1.5" />
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-muted-foreground">{item.completionPercentage}% complete</p>
                                    {compApp && (
                                      <p className="text-xs text-muted-foreground">ULAD: {compApp.score}%</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col gap-1.5 shrink-0">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/borrower-file/${item.applicationId}`)}
                                  data-testid={`button-view-file-${item.applicationId}`}
                                >
                                  <Eye className="mr-1 h-4 w-4" />
                                  View
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setComplianceDetailApp(
                                    complianceDetailApp === item.applicationId ? null : item.applicationId
                                  )}
                                  data-testid={`button-compliance-${item.applicationId}`}
                                >
                                  <Shield className="mr-1 h-4 w-4" />
                                  Checklist
                                </Button>
                              </div>
                            </div>

                            {complianceDetailApp === item.applicationId && (
                              <div className="mt-4 pt-4 border-t">
                                <ComplianceChecklistInline
                                  stage={item.currentStage}
                                  completionPct={item.completionPercentage}
                                />
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="my-queue">
            <MyQueueTab
              sortedQueueTasks={sortedQueueTasks}
              queueLoading={queueLoading}
              queueBreached={queueBreached}
              automatedTasks={automatedTasks}
            />
          </TabsContent>

          <TabsContent value="conditions">
            <ReviewTab
              submittedTasks={submittedTasks}
              applications={applications}
              tasks={tasks}
              isAdmin={isAdmin}
              getUserName={getUserName}
              onAddTask={(applicationId) => {
                setSelectedApplication(applicationId);
                setCreateDialogOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="compliance">
            <ComplianceTab complianceData={complianceData} />
          </TabsContent>

          <TabsContent value="intelligence">
            <IntelligenceTab />
          </TabsContent>
        </Tabs>
      </PageShell>
    </>
  );
}
