import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DealTeam } from "@/components/DealTeam";
import { DealTeamManagement } from "@/components/DealTeamManagement";
import {
  FileText,
  User,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Upload,
  Download,
  MessageSquare,
  ArrowLeft,
  Briefcase,
  CreditCard,
  Home,
  Shield,
  RefreshCw,
  AlertOctagon,
  FileWarning,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { isStaffRole } from "@shared/schema";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { LoanApplication, Document, LoanCondition, UrlaPersonalInfo } from "@shared/schema";

interface ActivityItem {
  id?: string;
  activityType: string;
  title: string;
  description?: string;
  createdAt: string;
}

interface LoanOption {
  id: string;
  loanType: string;
  interestRate: string;
  term: number;
  monthlyPayment: string;
}

interface ApplicationData {
  application: LoanApplication;
  options: LoanOption[];
  documents: Document[];
  activities: ActivityItem[];
}

interface PersonalInfoData {
  personalInfo: UrlaPersonalInfo | null;
}

interface PipelineData {
  progress: {
    completionPercentage: number;
    documentsReceived: number;
    documentsRequired: number;
    conditionsCleared: number;
    conditionsTotal: number;
    readyForNextStage: boolean;
    blockers: string[];
    nextSteps: string[];
  };
  summary: Record<string, unknown> | null;
  milestones: Record<string, Date | null>;
  conditions: LoanCondition[];
}

interface CreditSummary {
  hasActiveConsent: boolean;
  consent: {
    id: string;
    consentTimestamp: string;
    borrowerFullName: string;
    disclosureVersion: string;
  } | null;
  latestPull: {
    id: string;
    status: string;
    pullType: string;
    bureaus: string[];
    representativeScore: number | null;
    experianScore: number | null;
    equifaxScore: number | null;
    transunionScore: number | null;
    totalTradelines: number | null;
    openTradelines: number | null;
    derogatoryCount: number | null;
    totalDebt: string | null;
    monthlyPayments: string | null;
    completedAt: string | null;
    expiresAt: string | null;
  } | null;
  pullCount: number;
  adverseActionCount: number;
  latestAdverseAction: {
    id: string;
    actionType: string;
    primaryReason: string;
    noticeDate: string;
    deliveredAt: string | null;
  } | null;
}

interface CreditAuditEntry {
  id: string;
  action: string;
  actionDetails: Record<string, any> | null;
  timestamp: string;
  performedBy: string | null;
}

export default function BorrowerFile() {
  const params = useParams();
  const applicationId = params.id as string;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const { data: appData, isLoading: appLoading } = useQuery<ApplicationData>({
    queryKey: ['/api/loan-applications', applicationId],
    enabled: !!applicationId && !authLoading,
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<PipelineData>({
    queryKey: ['/api/loan-applications', applicationId, 'pipeline'],
    enabled: !!applicationId && !authLoading,
  });

  const { data: urlaData } = useQuery<{ personalInfo: UrlaPersonalInfo | null }>({
    queryKey: ['/api/urla', applicationId],
    enabled: !!applicationId && !authLoading,
  });

  const { data: creditData, isLoading: creditLoading, refetch: refetchCredit } = useQuery<CreditSummary>({
    queryKey: ['/api/loan-applications', applicationId, 'credit', 'summary'],
    enabled: !!applicationId && !authLoading,
  });

  const { data: auditLog } = useQuery<{ auditLog: CreditAuditEntry[] }>({
    queryKey: ['/api/loan-applications', applicationId, 'credit', 'audit-log'],
    enabled: !!applicationId && !authLoading,
  });

  const [conditionAction, setConditionAction] = useState<{
    condition: LoanCondition | null;
    action: "cleared" | "waived" | "not_applicable" | null;
    notes: string;
  }>({ condition: null, action: null, notes: "" });

  const [statusUpdate, setStatusUpdate] = useState({ open: false, status: "", notes: "" });
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ status, notes }: { status: string; notes?: string }) => {
      return apiRequest("PATCH", `/api/loan-applications/${applicationId}/status`, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId] });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'pipeline'] });
      toast({ title: "Status Updated", description: `Application status has been changed.` });
      setStatusUpdate({ open: false, status: "", notes: "" });
    },
    onError: (error: Error) => {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateConditionMutation = useMutation({
    mutationFn: async ({ id, status, clearanceNotes }: { id: string; status: string; clearanceNotes?: string }) => {
      return apiRequest("PATCH", `/api/conditions/${id}`, { status, clearanceNotes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId] });
      const actionLabel = conditionAction.action === "cleared" ? "Cleared" : conditionAction.action === "waived" ? "Waived" : "Marked N/A";
      toast({
        title: `Condition ${actionLabel}`,
        description: `"${conditionAction.condition?.title}" has been ${actionLabel.toLowerCase()}.`,
      });
      setConditionAction({ condition: null, action: null, notes: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update condition",
        variant: "destructive",
      });
    },
  });

  const handleConditionAction = () => {
    if (!conditionAction.condition || !conditionAction.action) return;
    updateConditionMutation.mutate({
      id: conditionAction.condition.id,
      status: conditionAction.action,
      clearanceNotes: conditionAction.notes || undefined,
    });
  };

  const pullCreditMutation = useMutation({
    mutationFn: async (pullType: string) => {
      const response = await apiRequest("POST", `/api/loan-applications/${applicationId}/credit/pull`, {
        pullType,
        bureaus: ["experian", "equifax", "transunion"],
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'credit', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId, 'credit', 'audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['/api/loan-applications', applicationId] });
      toast({
        title: "Credit Pull Complete",
        description: "Credit report has been successfully retrieved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Credit Pull Failed",
        description: error.message || "Failed to pull credit report",
        variant: "destructive",
      });
    },
  });

  const isLoading = authLoading || appLoading || pipelineLoading;

  if (isLoading) {
    return (
      <div className="overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  const application = appData?.application;
  const documents = appData?.documents || [];
  const activities = appData?.activities || [];
  const conditions = pipelineData?.conditions || [];
  const progress = pipelineData?.progress;
  const personalInfo = urlaData?.personalInfo;

  if (!application) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>File Not Found</CardTitle>
            <CardDescription>
              This borrower file could not be found.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/staff-dashboard">Back to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const outstandingConditions = conditions.filter(c => c.status === "outstanding" || c.status === "submitted");
  const clearedConditions = conditions.filter(c => c.status === "cleared" || c.status === "waived" || c.status === "not_applicable");
  const isStaff2 = isStaffRole(user?.role || "");

  return (
    <>
      <div className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/staff-dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="button-export-mismo">
            <Download className="mr-2 h-4 w-4" />
            Export MISMO
          </Button>
          <Button size="sm" data-testid="button-generate-le">
            <FileText className="mr-2 h-4 w-4" />
            Generate LE
          </Button>
        </div>
      </div>

      <div className="p-6">
            <div className="mx-auto max-w-6xl space-y-6">
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
                  <Dialog open={statusUpdate.open} onOpenChange={(o) => setStatusUpdate(prev => ({ ...prev, open: o }))}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" data-testid="button-update-status">
                        <RefreshCw className="mr-1 h-3 w-3" /> Update Status
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Update Application Status</DialogTitle>
                        <DialogDescription>
                          Change the application status. The borrower will be notified.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>New Status</Label>
                          <Select value={statusUpdate.status} onValueChange={(v) => setStatusUpdate(prev => ({ ...prev, status: v }))}>
                            <SelectTrigger data-testid="select-new-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="submitted">Submitted</SelectItem>
                              <SelectItem value="in_review">In Review</SelectItem>
                              <SelectItem value="underwriting">Underwriting</SelectItem>
                              <SelectItem value="conditional_approval">Conditional Approval</SelectItem>
                              <SelectItem value="pre_approved">Pre-Approved</SelectItem>
                              <SelectItem value="approved">Approved</SelectItem>
                              <SelectItem value="denied">Denied</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                              <SelectItem value="withdrawn">Withdrawn</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes (optional)</Label>
                          <Textarea
                            value={statusUpdate.notes}
                            onChange={(e) => setStatusUpdate(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="Reason for status change..."
                            data-testid="input-status-notes"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setStatusUpdate({ open: false, status: "", notes: "" })}>
                          Cancel
                        </Button>
                        <Button
                          disabled={!statusUpdate.status || statusUpdateMutation.isPending}
                          onClick={() => statusUpdateMutation.mutate({ status: statusUpdate.status, notes: statusUpdate.notes || undefined })}
                          data-testid="button-confirm-status-update"
                        >
                          {statusUpdateMutation.isPending ? "Updating..." : "Update Status"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Loan Amount</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-loan-amount">
                      {formatCurrency(
                        application.purchasePrice && application.downPayment
                          ? Number(application.purchasePrice) - Number(application.downPayment)
                          : application.purchasePrice
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {application.loanPurpose === "purchase" ? "Purchase" : "Refinance"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-credit-score">
                      {application.creditScore || "---"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {application.creditScore && application.creditScore >= 740 ? "740+" :
                       application.creditScore && application.creditScore >= 680 ? "680-739" :
                       application.creditScore && application.creditScore >= 620 ? "620-679" : "Pending"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Documents</CardTitle>
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-doc-count">
                      {progress?.documentsReceived || 0}/{progress?.documentsRequired || 0}
                    </div>
                    <Progress 
                      value={progress?.documentsRequired ? (progress.documentsReceived / progress.documentsRequired) * 100 : 0} 
                      className="mt-2 h-2" 
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Conditions</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-condition-count">
                      {progress?.conditionsCleared || 0}/{progress?.conditionsTotal || 0}
                    </div>
                    <Progress 
                      value={progress?.conditionsTotal ? (progress.conditionsCleared / progress.conditionsTotal) * 100 : 0} 
                      className="mt-2 h-2" 
                    />
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="overview" className="space-y-4">
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
                  <TabsTrigger value="team" data-testid="tab-team">
                    <Users className="mr-2 h-4 w-4" />
                    Team
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <User className="h-5 w-5" />
                          Borrower Information
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Name:</span>
                          <span>{personalInfo?.firstName || "N/A"} {personalInfo?.lastName || ""}</span>
                          <span className="text-muted-foreground">Email:</span>
                          <span>{personalInfo?.email || "N/A"}</span>
                          <span className="text-muted-foreground">Phone:</span>
                          <span>{personalInfo?.cellPhone || personalInfo?.homePhone || "N/A"}</span>
                          <span className="text-muted-foreground">SSN:</span>
                          <span>XXX-XX-{personalInfo?.ssn?.slice(-4) || "XXXX"}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Briefcase className="h-5 w-5" />
                          Employment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="capitalize">{application.employmentType || "N/A"}</span>
                          <span className="text-muted-foreground">Employer:</span>
                          <span>{application.employerName || "N/A"}</span>
                          <span className="text-muted-foreground">Years:</span>
                          <span>{application.employmentYears || 0} years</span>
                          <span className="text-muted-foreground">Income:</span>
                          <span>{formatCurrency(application.annualIncome)}/year</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Home className="h-5 w-5" />
                          Property
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Address:</span>
                          <span>{application.propertyAddress || "N/A"}</span>
                          <span className="text-muted-foreground">City/State:</span>
                          <span>{application.propertyCity}, {application.propertyState}</span>
                          <span className="text-muted-foreground">Value:</span>
                          <span>{formatCurrency(application.propertyValue)}</span>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="capitalize">{application.propertyType || "SFR"}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <DollarSign className="h-5 w-5" />
                          Loan Details
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <span className="text-muted-foreground">Purpose:</span>
                          <span className="capitalize">{application.loanPurpose || "Purchase"}</span>
                          <span className="text-muted-foreground">Down Payment:</span>
                          <span>{formatCurrency(application.downPayment)}</span>
                          <span className="text-muted-foreground">LTV:</span>
                          <span>{application.ltvRatio ? `${(Number(application.ltvRatio) * 100).toFixed(1)}%` : "N/A"}</span>
                          <span className="text-muted-foreground">DTI:</span>
                          <span>{application.dtiRatio ? `${(Number(application.dtiRatio) * 100).toFixed(1)}%` : "N/A"}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Uploaded Documents</CardTitle>
                        <Button size="sm" data-testid="button-request-docs">
                          <Upload className="mr-2 h-4 w-4" />
                          Request Documents
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {documents.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                          No documents uploaded yet.
                        </p>
                      ) : (
                        <ScrollArea className="h-[400px]">
                          <div className="space-y-2">
                            {documents.map((doc) => (
                              <div
                                key={doc.id}
                                className="flex items-center justify-between rounded-lg border p-3"
                              >
                                <div className="flex items-center gap-3">
                                  <FileText className="h-5 w-5 text-muted-foreground" />
                                  <div>
                                    <p className="font-medium">{doc.fileName}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {doc.documentType} • {formatDate(doc.createdAt)}
                                    </p>
                                  </div>
                                </div>
                                <Badge variant={
                                  doc.status === "verified" ? "default" :
                                  doc.status === "rejected" ? "destructive" : "secondary"
                                }>
                                  {doc.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="conditions" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertCircle className="h-5 w-5 text-amber-500" />
                          Outstanding ({outstandingConditions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px]">
                          {outstandingConditions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                              No outstanding conditions
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {outstandingConditions.map((cond) => (
                                <div
                                  key={cond.id}
                                  className="rounded-lg border p-3"
                                  data-testid={`condition-outstanding-${cond.id}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium">{cond.title}</p>
                                      {cond.description && (
                                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cond.description}</p>
                                      )}
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <Badge variant="outline" className="text-xs">{cond.category}</Badge>
                                        <Badge variant={cond.priority === "prior_to_approval" ? "destructive" : "secondary"} className="text-xs">
                                          {cond.priority?.replace(/_/g, " ")}
                                        </Badge>
                                        {cond.status === "submitted" && (
                                          <Badge variant="default" className="text-xs">Submitted</Badge>
                                        )}
                                      </div>
                                    </div>
                                    {isStaff2 && (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                          size="sm"
                                          variant="default"
                                          onClick={() => setConditionAction({ condition: cond, action: "cleared", notes: "" })}
                                          data-testid={`button-clear-condition-${cond.id}`}
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Clear
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setConditionAction({ condition: cond, action: "waived", notes: "" })}
                                          data-testid={`button-waive-condition-${cond.id}`}
                                        >
                                          Waive
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => setConditionAction({ condition: cond, action: "not_applicable", notes: "" })}
                                          data-testid={`button-na-condition-${cond.id}`}
                                        >
                                          N/A
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                          Resolved ({clearedConditions.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-[400px]">
                          {clearedConditions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-4">
                              No resolved conditions yet
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {clearedConditions.map((cond) => (
                                <div
                                  key={cond.id}
                                  className="rounded-lg border border-green-500/20 p-3"
                                  data-testid={`condition-resolved-${cond.id}`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="font-medium">{cond.title}</p>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <Badge variant="outline" className="text-xs">{cond.category}</Badge>
                                        <Badge
                                          variant={cond.status === "cleared" ? "default" : "secondary"}
                                          className="text-xs"
                                        >
                                          {cond.status === "cleared" ? "Cleared" : cond.status === "waived" ? "Waived" : "N/A"}
                                        </Badge>
                                      </div>
                                      {cond.clearanceNotes && (
                                        <p className="text-xs text-muted-foreground mt-1">{cond.clearanceNotes}</p>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground shrink-0">
                                      {formatDate(cond.clearedAt)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="timeline" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Activity Timeline
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        {activities.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No activity recorded yet.
                          </p>
                        ) : (
                          <div className="space-y-4">
                            {activities.map((activity: ActivityItem, index: number) => (
                              <div
                                key={activity.id || index}
                                className="relative flex gap-4 pb-4 last:pb-0"
                              >
                                <div className="flex flex-col items-center">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                    {activity.activityType === "status_change" ? (
                                      <Shield className="h-4 w-4 text-primary" />
                                    ) : activity.activityType === "document_uploaded" ? (
                                      <Upload className="h-4 w-4 text-primary" />
                                    ) : (
                                      <MessageSquare className="h-4 w-4 text-primary" />
                                    )}
                                  </div>
                                  {index < activities.length - 1 && (
                                    <div className="flex-1 w-px bg-border" />
                                  )}
                                </div>
                                <div className="flex-1 pt-1">
                                  <p className="font-medium">{activity.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {activity.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {formatDate(activity.createdAt)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="credit" className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            Consent Status
                          </CardTitle>
                          {creditLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {creditData?.hasActiveConsent ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                              <span className="font-medium text-green-700 dark:text-green-400" data-testid="text-consent-status">
                                Consent Active
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p>Signed by: {creditData.consent?.borrowerFullName}</p>
                              <p>Date: {creditData.consent?.consentTimestamp && format(new Date(creditData.consent.consentTimestamp), "MMM d, yyyy 'at' h:mm a")}</p>
                              <p>Version: {creditData.consent?.disclosureVersion}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-5 w-5 text-amber-500" />
                              <span className="font-medium text-amber-700 dark:text-amber-400" data-testid="text-consent-status">
                                No Active Consent
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Borrower must provide credit authorization before a credit pull can be performed.
                            </p>
                            <Button variant="outline" size="sm" asChild>
                              <Link href={`/credit-consent/${applicationId}`}>
                                Request Consent
                              </Link>
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center gap-2">
                            <CreditCard className="h-5 w-5" />
                            Credit Report
                          </CardTitle>
                          <Button
                            size="sm"
                            disabled={!creditData?.hasActiveConsent || pullCreditMutation.isPending}
                            onClick={() => pullCreditMutation.mutate("tri_merge")}
                            data-testid="button-pull-credit"
                          >
                            {pullCreditMutation.isPending ? (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                Pulling...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Pull Credit
                              </>
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {creditData?.latestPull ? (
                          <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-4 text-center">
                              <div>
                                <p className="text-xs text-muted-foreground">Representative</p>
                                <p className="text-2xl font-bold" data-testid="text-rep-score">
                                  {creditData.latestPull.representativeScore || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Experian</p>
                                <p className="text-lg font-semibold" data-testid="text-exp-score">
                                  {creditData.latestPull.experianScore || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Equifax</p>
                                <p className="text-lg font-semibold" data-testid="text-eqf-score">
                                  {creditData.latestPull.equifaxScore || "—"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">TransUnion</p>
                                <p className="text-lg font-semibold" data-testid="text-tu-score">
                                  {creditData.latestPull.transunionScore || "—"}
                                </p>
                              </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Tradelines:</span>
                                <span className="ml-2 font-medium">
                                  {creditData.latestPull.openTradelines}/{creditData.latestPull.totalTradelines}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Derogatory:</span>
                                <span className="ml-2 font-medium">
                                  {creditData.latestPull.derogatoryCount || 0}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Total Debt:</span>
                                <span className="ml-2 font-medium">
                                  {formatCurrency(creditData.latestPull.totalDebt)}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Monthly Payments:</span>
                                <span className="ml-2 font-medium">
                                  {formatCurrency(creditData.latestPull.monthlyPayments)}
                                </span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Pulled: {creditData.latestPull.completedAt && format(new Date(creditData.latestPull.completedAt), "MMM d, yyyy")}
                              {creditData.latestPull.expiresAt && ` • Expires: ${format(new Date(creditData.latestPull.expiresAt), "MMM d, yyyy")}`}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">
                              No credit report on file
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {creditData?.pullCount || 0} previous pull(s)
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {creditData?.adverseActionCount && creditData.adverseActionCount > 0 && (
                    <Card className="border-red-200 dark:border-red-800">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                          <AlertOctagon className="h-5 w-5" />
                          Adverse Action Notices ({creditData.adverseActionCount})
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {creditData.latestAdverseAction && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium capitalize">
                                {creditData.latestAdverseAction.actionType.replace(/_/g, " ")}
                              </span>
                              <Badge variant={creditData.latestAdverseAction.deliveredAt ? "default" : "secondary"}>
                                {creditData.latestAdverseAction.deliveredAt ? "Delivered" : "Pending Delivery"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {creditData.latestAdverseAction.primaryReason}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Generated: {format(new Date(creditData.latestAdverseAction.noticeDate), "MMM d, yyyy")}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <FileWarning className="h-5 w-5" />
                        Credit Audit Log
                      </CardTitle>
                      <CardDescription>
                        Immutable record of all credit-related actions for FCRA compliance
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[200px]">
                        {auditLog?.auditLog && auditLog.auditLog.length > 0 ? (
                          <div className="space-y-2">
                            {auditLog.auditLog.map((entry) => (
                              <div
                                key={entry.id}
                                className="flex items-start justify-between text-sm border-b pb-2 last:border-0"
                              >
                                <div>
                                  <p className="font-medium capitalize">
                                    {entry.action.replace(/_/g, " ")}
                                  </p>
                                  {entry.actionDetails && (
                                    <p className="text-xs text-muted-foreground">
                                      {JSON.stringify(entry.actionDetails)}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center text-muted-foreground py-8">
                            No credit activity recorded yet.
                          </p>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="team" className="space-y-4">
                  {isStaffRole(user?.role || "") ? (
                    <DealTeamManagement applicationId={applicationId} />
                  ) : (
                    <DealTeam applicationId={applicationId} />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

      <Dialog
        open={!!conditionAction.condition && !!conditionAction.action}
        onOpenChange={(open) => {
          if (!open) setConditionAction({ condition: null, action: null, notes: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {conditionAction.action === "cleared" && "Clear Condition"}
              {conditionAction.action === "waived" && "Waive Condition"}
              {conditionAction.action === "not_applicable" && "Mark as Not Applicable"}
            </DialogTitle>
            <DialogDescription>
              {conditionAction.action === "cleared" && "Confirm this condition has been satisfied and all required documentation is in place."}
              {conditionAction.action === "waived" && "Waiving removes this requirement. Provide a reason for the audit trail."}
              {conditionAction.action === "not_applicable" && "Mark this condition as not applicable to this loan file. Provide a reason for the audit trail."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg border p-3">
              <p className="font-medium text-sm">{conditionAction.condition?.title}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {conditionAction.condition?.category} · {conditionAction.condition?.priority?.replace(/_/g, " ")}
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                {conditionAction.action === "cleared" ? "Notes (optional)" : "Reason (required for audit)"}
              </Label>
              <Textarea
                value={conditionAction.notes}
                onChange={(e) => setConditionAction(prev => ({ ...prev, notes: e.target.value }))}
                placeholder={
                  conditionAction.action === "cleared"
                    ? "Any notes about how the condition was satisfied..."
                    : "Explain why this condition is being waived or marked N/A..."
                }
                data-testid="input-condition-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConditionAction({ condition: null, action: null, notes: "" })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConditionAction}
              disabled={
                updateConditionMutation.isPending ||
                (conditionAction.action !== "cleared" && !conditionAction.notes.trim())
              }
              variant={conditionAction.action === "cleared" ? "default" : "outline"}
              data-testid="button-confirm-condition-action"
            >
              {updateConditionMutation.isPending ? "Updating..." : (
                conditionAction.action === "cleared" ? "Confirm Clear" :
                conditionAction.action === "waived" ? "Confirm Waive" :
                "Confirm N/A"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
