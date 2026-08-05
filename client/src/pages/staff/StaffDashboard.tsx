import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, taskKeys } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { StaffSignalsPanel } from "@/components/StaffSignalsPanel";
import { useLocation } from "wouter";
import { isStaffRole, isInternalStaffRole } from "@shared/roles";
import IntelligenceTab from "./IntelligenceTab";
import type { Task, LoanApplication, User } from "@shared/schema";
import { BarChart3, ClipboardCheck, FileText, Inbox, Shield } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  type QueueTask,
  type QueueData,
  type ComplianceData,
  complianceScorePercent,
  getRoleDefaultTab,
} from "./staffDashboard/model";
import {
  automatedTasks as selectAutomated,
  awaitingReview,
  countBreached,
  sortQueueTasks,
  totalPipelineVolume,
} from "./staffDashboard/derive";
import { CreateTaskDialog } from "./staffDashboard/CreateTaskDialog";
import { MyQueueTab } from "./staffDashboard/MyQueueTab";
import { ReviewTab } from "./staffDashboard/ReviewTab";
import { ComplianceTab } from "./staffDashboard/ComplianceTab";
import { DashboardHero } from "./staffDashboard/DashboardHero";
import { KpiCards } from "./staffDashboard/KpiCards";
import { StageDistributionCard } from "./staffDashboard/StageDistributionCard";
import { PipelineTab } from "./staffDashboard/PipelineTab";
import { AccessDeniedCard, PartnerWorkspaceCard } from "./staffDashboard/AccessStates";

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
  //
  // This page is one of the surfaces tests/routeGates.test.ts records as
  // "self-defending": the defence is the `enabled: ... && isInternalStaff` on
  // every query below PLUS the !isInternalStaff early return. Both halves must
  // stay here — dropping either would make the client fetch data the server
  // refuses, and there is no separate drift ledger watching this file.
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
    queryKey: taskKeys.all(),
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

  const sortedQueueTasks = useMemo(() => sortQueueTasks(queueTasks), [queueTasks]);

  const queueBreached = countBreached(sortedQueueTasks);
  const submittedTasks = awaitingReview(tasks);
  const automatedTasks = selectAutomated(sortedQueueTasks);

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "Unknown";
  };

  const totalVolume = totalPipelineVolume(pipeline);
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
    return <AccessDeniedCard />;
  }

  if (!isInternalStaff) {
    return (
      <PartnerWorkspaceCard
        userRole={userRole}
        onGoToBrokerDashboard={() => navigate("/broker-dashboard")}
      />
    );
  }

  return (
    <>
      <DashboardHero
        userRole={userRole}
        onRefreshAll={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
          queryClient.invalidateQueries({ queryKey: taskKeys.all() });
          queryClient.invalidateQueries({ queryKey: ["/api/compliance/dashboard"] });
        }}
        action={
          <CreateTaskDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
            selectedApplication={selectedApplication}
            onSelectedApplicationChange={setSelectedApplication}
            applications={applications}
            getUserName={getUserName}
          />
        }
      />

      <PageShell width="full" contentClassName="space-y-6">
        <KpiCards
          pipelineCount={pipeline.length}
          totalVolume={totalVolume}
          queueCount={sortedQueueTasks.length}
          queueBreached={queueBreached}
          awaitingReviewCount={submittedTasks.length}
          complianceScore={complianceScore}
          needsAttention={complianceData?.needsAttention || 0}
          automatedCount={automatedTasks.length}
        />

        <StageDistributionCard byStage={byStage} />

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
            <PipelineTab
              pipeline={pipeline}
              isLoading={pipelineLoading}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              complianceData={complianceData}
              sortedQueueTasks={sortedQueueTasks}
              checklistAppId={complianceDetailApp}
              onToggleChecklist={(applicationId) =>
                setComplianceDetailApp(complianceDetailApp === applicationId ? null : applicationId)
              }
              onViewFile={(applicationId) => navigate(`/borrower-file/${applicationId}`)}
            />
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
