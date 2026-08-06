import { useState } from "react";
import { friendlyApiError } from "@/lib/errorMessage";
import { useParams, useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, ApiError, loanApplicationKeys } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { DealTeam } from "@/components/DealTeam";
import { DealTeamManagement } from "@/components/DealTeamManagement";
import {
  FileText,
  User,
  CheckCircle2,
  Clock,
  CreditCard,
  Users,
  Brain,
  Receipt,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { isStaffRole, isInternalStaffRole } from "@shared/roles";
import { canReviewDocuments } from "@shared/documentStatus";
import { CREDIT_DECISION_ROLES, FINANCIAL_VERIFICATION_ROLES, type UrlaPersonalInfo } from "@shared/schema";

import { type ApplicationData, type PipelineData } from "./borrowerFile/model";
import { StatusUpdateDialog } from "./borrowerFile/StatusUpdateDialog";
import { ConditionsTab } from "./borrowerFile/ConditionsTab";
import { CreditTab } from "./borrowerFile/CreditTab";
import { FinancialsTab } from "./borrowerFile/FinancialsTab";
import { TimelineTab } from "./borrowerFile/TimelineTab";
import { FileHeaderBar } from "./borrowerFile/FileHeaderBar";
import { FileSummaryCards } from "./borrowerFile/FileSummaryCards";
import { OverviewTab } from "./borrowerFile/OverviewTab";
import { DocumentsTab } from "./borrowerFile/DocumentsTab";
import { TaxIntelTab } from "./borrowerFile/TaxIntelTab";
import { FileNotFoundCard } from "./borrowerFile/FileNotFoundCard";

const TAB_VALUES = ["overview", "documents", "conditions", "timeline", "credit", "financials", "tax-intel", "team"];

export default function BorrowerFile() {
  const params = useParams();
  const applicationId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // ?tab= deep-link (e.g. the staff docs-ready signal links straight to the
  // Documents tab). Tabs are controlled so the link works after hydration too.
  const search = useSearch();
  const requestedTab = new URLSearchParams(search).get("tab");
  const [activeTab, setActiveTab] = useState(
    requestedTab && TAB_VALUES.includes(requestedTab) ? requestedTab : "overview",
  );
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const { data: appData, isLoading: appLoading } = useQuery<ApplicationData>({
    queryKey: loanApplicationKeys.detail(applicationId),
    enabled: !!applicationId && !authLoading,
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<PipelineData>({
    queryKey: loanApplicationKeys.pipeline(applicationId),
    enabled: !!applicationId && !authLoading,
  });

  const { data: urlaData } = useQuery<{ personalInfo: UrlaPersonalInfo | null }>({
    queryKey: ['/api/urla', applicationId],
    enabled: !!applicationId && !authLoading,
  });

  const [exportingMismo, setExportingMismo] = useState(false);
  const handleExportMismo = async () => {
    setExportingMismo(true);
    try {
      const res = await apiRequest("GET", `/api/loan-applications/${applicationId}/mismo-export`).catch(
        (err: unknown) => {
          if (err instanceof ApiError && err.status === 403) {
            throw new Error(
              "MISMO export is restricted to internal staff with access to this application.",
            );
          }
          throw new Error(friendlyApiError(err, "Failed to generate the MISMO file."));
        },
      );
      await downloadResponseAsFile(res, `mismo-${applicationId}.xml`);
      toast({
        title: "MISMO 3.4 exported",
        description: "The lender-ready XML file has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setExportingMismo(false);
    }
  };

  const verifyFinancialsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/loan-applications/${applicationId}/verify-financials`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: loanApplicationKeys.detail(applicationId) });
      toast({
        title: "Financials Verified",
        description: "This application can now proceed to approval.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
    },
  });

  const isLoading = authLoading || appLoading || pipelineLoading;

  if (isLoading) {
    return (
      <PageShell width="wide" contentClassName="space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96 w-full" />
      </PageShell>
    );
  }

  const application = appData?.application;
  const documents = appData?.documents || [];
  const activities = appData?.activities || [];
  const conditions = pipelineData?.conditions || [];
  const progress = pipelineData?.progress;
  const personalInfo = urlaData?.personalInfo;

  if (!application) {
    return <FileNotFoundCard />;
  }

  // ---------------------------------------------------------------------
  // Role gates. Every one is computed HERE rather than inside the component
  // that renders the control, so the whole set is greppable in one place and
  // each can be read against the server route it mirrors. Sub-components take
  // booleans, never the user object.
  //
  // canVerifyFinancials and the {canVerifyFinancials && ( ... )} block below
  // must additionally stay in THIS FILE: tests/routeGateDrift.test.ts reads
  // this source by path and asserts both. Moving either into ./borrowerFile/
  // takes it out of that guard's view.
  // ---------------------------------------------------------------------
  const isStaff2 = isStaffRole(user?.role || "");
  // Mirrors the server's role gate on PATCH /:id/status (statusDecisions.ts):
  // final credit decisions are 403'd for everyone else, so grey them out here.
  const canSetCreditDecisions = CREDIT_DECISION_ROLES.includes(user?.role || "");
  // Mirrors requireRole on POST /:id/verify-financials — closer, broker, and lender
  // are 403'd there, so they must not be offered the button. Both sides read
  // FINANCIAL_VERIFICATION_ROLES (shared/schema/lendingCore.ts) so they can't drift.
  const canVerifyFinancials = FINANCIAL_VERIFICATION_ROLES.includes(user?.role || "");
  // GSE delivery is internal-staff-only; the server route rejects broker/lender.
  const canExportMismo = isInternalStaffRole(user?.role || "");
  const canReviewDocs = canReviewDocuments(user?.role);

  // Pre-underwriting validator flags (loan_applications.pre_uw_flags) — the
  // machine-readable signal staff should see before opening any tab.
  const preUwFlags: Array<{ code: string; severity: string; reason: string }> =
    ((appData?.application as { preUwFlags?: { flags?: Array<{ code: string; severity: string; reason: string }> } } | undefined)
      ?.preUwFlags?.flags) ?? [];

  return (
    <>
      <FileHeaderBar
        applicationId={applicationId}
        preUwFlags={preUwFlags}
        canExportMismo={canExportMismo}
        onExportMismo={handleExportMismo}
        exportingMismo={exportingMismo}
      />

      <PageShell width="wide" contentClassName="space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold" data-testid="text-borrower-name">
                    {personalInfo?.firstName || "Borrower"} {personalInfo?.lastName || ""}
                  </h1>
                  <p className="text-muted-foreground">
                    Loan #{application.id.substring(0, 8).toUpperCase()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={application.status === "pre_approved" ? "default" : "secondary"}>
                    {application.status?.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                  <Badge variant="outline">
                    {application.preferredLoanType?.toUpperCase() || "CONVENTIONAL"}
                  </Badge>
                  {application.financialDataProvenance === "verified" ? (
                    <Badge
                      className="bg-success-subtle text-success-subtle-foreground"
                      data-testid="badge-financials-verified"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Financials Verified
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="outline" className="border-border text-warning-subtle-foreground">
                        Financials Unverified
                      </Badge>
                      {canVerifyFinancials && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={verifyFinancialsMutation.isPending}
                          onClick={() => verifyFinancialsMutation.mutate()}
                          data-testid="button-verify-financials"
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {verifyFinancialsMutation.isPending ? "Verifying..." : "Mark Financials Verified"}
                        </Button>
                      )}
                    </>
                  )}
                  <StatusUpdateDialog
                    applicationId={applicationId}
                    financialDataProvenance={application.financialDataProvenance}
                    canSetCreditDecisions={canSetCreditDecisions}
                  />
                </div>
              </div>

              <FileSummaryCards application={application} progress={progress} />

              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                  <TabsTrigger value="overview" data-testid="tab-overview">
                    <User className="mr-2 h-4 w-4" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="documents" data-testid="tab-documents">
                    <FileText className="mr-2 h-4 w-4" />
                    Documents
                  </TabsTrigger>
                  <TabsTrigger value="conditions" data-testid="tab-conditions">
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Conditions
                  </TabsTrigger>
                  <TabsTrigger value="timeline" data-testid="tab-timeline">
                    <Clock className="mr-2 h-4 w-4" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="credit" data-testid="tab-credit">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Credit
                  </TabsTrigger>
                  <TabsTrigger value="financials" data-testid="tab-financials">
                    <Receipt className="mr-2 h-4 w-4" />
                    Financials
                  </TabsTrigger>
                  <TabsTrigger value="tax-intel" data-testid="tab-tax-intel">
                    <Brain className="mr-2 h-4 w-4" />
                    Tax Intel
                  </TabsTrigger>
                  <TabsTrigger value="team" data-testid="tab-team">
                    <Users className="mr-2 h-4 w-4" />
                    Team
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <OverviewTab application={application} personalInfo={personalInfo} />
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <DocumentsTab
                    applicationId={applicationId}
                    documents={documents}
                    application={application}
                    canReview={canReviewDocs}
                    selectedDocumentId={selectedDocumentId}
                    onSelectDocument={setSelectedDocumentId}
                  />
                </TabsContent>

                <TabsContent value="conditions" className="space-y-4">
                  <ConditionsTab
                    applicationId={applicationId}
                    conditions={conditions}
                    isStaff={isStaff2}
                  />
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  <TimelineTab activities={activities} />
                </TabsContent>

                <TabsContent value="credit" className="space-y-4">
                  <CreditTab applicationId={applicationId} canRevokeLetter={canSetCreditDecisions} />
                </TabsContent>

                <TabsContent value="financials" className="space-y-4">
                  {/* F-4 tolerance posture + F-11 per-file cost ledger — the
                      last two UNCONSUMED_CAPABILITIES entries, consumed. */}
                  <FinancialsTab applicationId={applicationId} />
                </TabsContent>

                <TabsContent value="tax-intel" className="space-y-4">
                  <TaxIntelTab
                    borrowerUserId={application?.userId}
                    applicationId={application.id}
                  />
                </TabsContent>

                <TabsContent value="team" className="space-y-4">
                  {isStaff2 ? (
                    <DealTeamManagement applicationId={applicationId} />
                  ) : (
                    <DealTeam applicationId={applicationId} />
                  )}
                </TabsContent>
              </Tabs>
      </PageShell>

    </>
  );
}
