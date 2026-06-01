import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Link } from "wouter";
import { isStaffRole, ROLE_DISPLAY_NAMES } from "@shared/schema";
import IntelligenceTab from "./IntelligenceTab";
import type { Task, LoanApplication, User } from "@shared/schema";
import {
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  User as UserIcon,
  Search,
  Upload,
  Eye,
  X,
  ArrowUp,
  Inbox,
  Shield,
  Zap,
  Bot,
  FileCheck,
  ClipboardCheck,
  DollarSign,
  Timer,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Activity,
  BarChart3,
  CircleCheck,
  Sparkles,
  ScanLine,
  Brain,
  Database,
  Archive,
} from "lucide-react";
import { formatCurrency, formatTimeRemaining } from "@/lib/formatters";
import { type SlaStatus, SLA_STATUS_COLORS, SLA_DOT_COLORS, SLA_SORT_ORDER } from "@/lib/sla";

interface QueueTask {
  id: string;
  applicationId: string;
  title: string;
  description?: string;
  taskType: string;
  taskTypeCode?: string;
  triggerSource?: string;
  ownerRole?: string;
  slaClass?: string;
  slaDueAt?: string;
  escalationLevel?: number;
  status: string;
  priority?: string;
  createdAt?: string;
  assignedToUserId?: string;
  slaStatus: SlaStatus;
  timeRemaining: number | null;
  percentageElapsed: number | null;
}

interface PipelineSummary {
  applicationId: string;
  currentStage: string;
  priority: "urgent" | "high" | "normal";
  daysInPipeline: number;
  estimatedClosingDays: number;
  completionPercentage: number;
  documentsRequired: number;
  documentsReceived: number;
  conditionsTotal: number;
  conditionsCleared: number;
  lastActivityAt: Date;
  assignedLO: string | null;
  targetCloseDate: Date | null;
  borrowerName?: string;
  loanAmount?: string;
}

interface QueueData {
  total: number;
  byPriority: {
    urgent: number;
    high: number;
    normal: number;
  };
  byStage: Record<string, PipelineSummary[]>;
  queue: PipelineSummary[];
}

interface ComplianceData {
  total: number;
  gseReady: number;
  ulddCompliant: number;
  needsAttention: number;
  applications: {
    applicationId: string;
    borrowerName: string;
    status: string;
    loanAmount: number | null;
    score: number;
    gseReady: boolean;
    ulddCompliant: boolean;
    criticalCount: number;
    warningCount: number;
    missingDocsCount: number;
  }[];
}

interface RetentionPolicy {
  dataType: string;
  retentionPeriodDays: number;
  archiveAfterDays: number;
  deleteAfterDays: number | null;
  legalBasis: string;
  regulatoryReference: string;
}

interface RetentionReport {
  generatedAt: string;
  policies: RetentionPolicy[];
  recordCounts: Record<string, number>;
  archiveEligibleCounts: Record<string, number>;
  deleteEligibleCounts: Record<string, number>;
  retentionReviewCounts: Record<string, number>;
  recommendations: string[];
}


function formatStageLabel(stage: string): string {
  return STAGE_DISPLAY[stage] || stage.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

const STAGE_ORDER = [
  "pre_approved",
  "doc_collection",
  "processing",
  "underwriting",
  "conditional",
  "clear_to_close",
  "funded",
];

const STAGE_DISPLAY: Record<string, string> = {
  pre_approved: "Pre-Approved",
  doc_collection: "Doc Collection",
  processing: "Processing",
  underwriting: "Underwriting",
  conditional: "Conditional Approval",
  clear_to_close: "Clear to Close",
  funded: "Funded",
};

const COMPLIANCE_CHECKLIST_ITEMS = [
  { id: "le_issued", label: "Loan Estimate Issued", regulation: "TRID - within 3 business days of application", stage: "pre_approved" },
  { id: "intent_to_proceed", label: "Intent to Proceed Received", regulation: "TRID - required before charging fees", stage: "pre_approved" },
  { id: "income_verified", label: "Income Verification", regulation: "ATR/QM Rule - Ability to Repay", stage: "doc_collection" },
  { id: "asset_verified", label: "Asset Verification", regulation: "Fannie Mae B3-4 / Freddie Mac 5501", stage: "doc_collection" },
  { id: "employment_verified", label: "Employment Verification", regulation: "Fannie Mae B3-3 / VOIE", stage: "processing" },
  { id: "credit_report_pulled", label: "Credit Report Obtained", regulation: "FCRA - Fair Credit Reporting Act", stage: "processing" },
  { id: "appraisal_ordered", label: "Appraisal Ordered", regulation: "FIRREA / Dodd-Frank Section 1471", stage: "underwriting" },
  { id: "title_search", label: "Title Search Complete", regulation: "ALTA Best Practices", stage: "underwriting" },
  { id: "flood_cert", label: "Flood Certification", regulation: "National Flood Insurance Act", stage: "underwriting" },
  { id: "mismo_valid", label: "MISMO 3.4 Data Complete", regulation: "GSE Submission Requirement", stage: "conditional" },
  { id: "cd_issued", label: "Closing Disclosure Issued", regulation: "TRID - 3 business days before closing", stage: "clear_to_close" },
  { id: "final_review", label: "Final Underwriting Review", regulation: "QC/QA Requirements", stage: "clear_to_close" },
];

const AUTOMATION_LABELS: Record<string, { label: string; icon: typeof Zap }> = {
  "AUTO_RULE": { label: "Auto-triggered by rule engine", icon: Zap },
  "STAGE_TRANSITION": { label: "Triggered by stage change", icon: ArrowRight },
  "DOCUMENT_UPLOAD": { label: "Auto-detected from document", icon: ScanLine },
  "SYSTEM": { label: "System automated", icon: Bot },
  "AI_EXTRACTION": { label: "AI-extracted data", icon: Brain },
};

const documentCategories = [
  { value: "tax_return", label: "Tax Return" },
  { value: "w2", label: "W-2 Form" },
  { value: "pay_stub", label: "Pay Stub" },
  { value: "bank_statement", label: "Bank Statement" },
  { value: "id", label: "Government ID" },
  { value: "other", label: "Other Document" },
];

const documentYears = ["2025", "2024", "2023", "2022"];

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    in_progress: { variant: "default", label: "In Progress" },
    submitted: { variant: "outline", label: "Submitted" },
    verified: { variant: "default", label: "Verified" },
    rejected: { variant: "destructive", label: "Rejected" },
    completed: { variant: "default", label: "Completed" },
  };
  const config = statusConfig[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const config: Record<string, { className: string; label: string }> = {
    low: { className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Low" },
    normal: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "Normal" },
    high: { className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", label: "High" },
    urgent: { className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Urgent" },
  };
  const p = config[priority] || config.normal;
  return <Badge className={p.className}>{p.label}</Badge>;
}

function AutomationBadge({ source }: { source?: string }) {
  if (!source || source === "MANUAL") return null;
  const info = AUTOMATION_LABELS[source];
  if (!info) return null;
  const Icon = info.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="gap-1 text-xs bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" data-testid="badge-automation">
          <Icon className="h-3 w-3" />
          Automated
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-xs">
        <p>{info.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function ComplianceChecklistInline({ stage, completionPct }: { stage: string; completionPct: number }) {
  const normalizedStage = stage === "analyzing" ? "pre_approved" : stage === "closing" ? "clear_to_close" : stage;
  const stageIdx = STAGE_ORDER.indexOf(normalizedStage);
  const effectiveIdx = stageIdx >= 0 ? stageIdx : 0;
  const items = COMPLIANCE_CHECKLIST_ITEMS.map(item => {
    const itemStageIdx = STAGE_ORDER.indexOf(item.stage);
    const isComplete = itemStageIdx < effectiveIdx || (itemStageIdx === effectiveIdx && completionPct > 50);
    const isCurrentStage = item.stage === normalizedStage;
    const isOverdue = isCurrentStage && !isComplete && completionPct > 75;
    return { ...item, isComplete, isCurrentStage, isOverdue };
  });

  const completed = items.filter(i => i.isComplete).length;
  const total = items.length;

  return (
    <div className="space-y-3" data-testid="compliance-checklist">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Compliance Checklist</span>
        </div>
        <span className="text-xs text-muted-foreground">{completed}/{total} complete</span>
      </div>
      <Progress value={(completed / total) * 100} className="h-1.5" />
      <div className="space-y-1.5">
        {items.map(item => (
          <div
            key={item.id}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
              item.isOverdue
                ? "bg-red-50 dark:bg-red-900/20"
                : item.isCurrentStage && !item.isComplete
                  ? "bg-amber-50 dark:bg-amber-900/20"
                  : ""
            }`}
            data-testid={`compliance-item-${item.id}`}
          >
            {item.isComplete ? (
              <CircleCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : item.isOverdue ? (
              <AlertCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
            )}
            <span className={`flex-1 ${item.isComplete ? "text-muted-foreground line-through" : ""}`}>
              {item.label}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="text-muted-foreground/60 hover:text-muted-foreground underline decoration-dotted underline-offset-2 cursor-help shrink-0" data-testid={`tooltip-regulation-${item.id}`}>
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                <p>{item.regulation}</p>
              </TooltipContent>
            </Tooltip>
            {item.isOverdue && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Overdue</Badge>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function getRoleDefaultTab(role: string): string {
  switch (role) {
    case "underwriter":
      return "conditions";
    case "processor":
    case "loa":
      return "my-queue";
    case "lo":
    case "broker":
      return "pipeline";
    default:
      return "pipeline";
  }
}

export default function StaffDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [complianceDetailApp, setComplianceDetailApp] = useState<string | null>(null);

  const isStaff = isStaffRole(user?.role || "");
  const userRole = user?.role || "";
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

  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    taskType: "document_request",
    documentCategory: "",
    documentYear: "",
    documentInstructions: "",
    priority: "normal",
    dueDate: "",
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !authLoading && !!user,
  });

  const { data: applicationsData, isLoading: applicationsLoading } = useQuery<LoanApplication[]>({
    queryKey: ["/api/admin/applications"],
    enabled: !authLoading && !!user && isStaff,
  });

  const { data: usersData } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    enabled: !authLoading && !!user && isStaff,
  });

  const { data: queueTasks, isLoading: queueLoading } = useQuery<QueueTask[]>({
    queryKey: ["/api/task-engine/tasks/by-role", ownerRole],
    enabled: !authLoading && !!user && isStaff && !!ownerRole,
  });

  const { data: pipelineData, isLoading: pipelineLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/queue"],
    enabled: !authLoading && !!user && isStaff,
    refetchInterval: 30000,
  });

  const { data: complianceData } = useQuery<ComplianceData>({
    queryKey: ["/api/compliance/dashboard"],
    enabled: !authLoading && !!user && isStaff,
  });

  const { data: retentionReport, isLoading: retentionLoading, refetch: refetchRetention } = useQuery<RetentionReport>({
    queryKey: ["/api/credit/retention-report"],
    enabled: !authLoading && !!user && isStaff,
  });

  const { data: retentionPoliciesData } = useQuery<{ policies: Record<string, RetentionPolicy> }>({
    queryKey: ["/api/credit/retention-policies"],
    enabled: !authLoading && !!user && isStaff,
  });

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { applicationId: string; assignedToUserId: string; title: string; description: string; taskType: string; priority: string; dueDate: Date | string | null; documentCategory?: string | null; documentYear?: string | null; documentInstructions?: string | null }) => {
      const response = await apiRequest("POST", "/api/tasks", taskData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task Created", description: "The task has been created and assigned." });
      setCreateDialogOpen(false);
      resetNewTaskForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task Updated", description: "The task has been updated successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to update task", variant: "destructive" });
    },
  });

  const resetNewTaskForm = () => {
    setNewTask({
      title: "",
      description: "",
      taskType: "document_request",
      documentCategory: "",
      documentYear: "",
      documentInstructions: "",
      priority: "normal",
      dueDate: "",
    });
    setSelectedApplication("");
  };

  const handleCreateTask = () => {
    if (!selectedApplication) {
      toast({ title: "Error", description: "Please select an application", variant: "destructive" });
      return;
    }
    const application = applicationsData?.find(app => app.id === selectedApplication);
    if (!application) return;
    const taskTitle = newTask.documentCategory && newTask.documentYear
      ? `Upload ${newTask.documentYear} ${documentCategories.find(c => c.value === newTask.documentCategory)?.label}`
      : newTask.title;
    createTaskMutation.mutate({
      applicationId: selectedApplication,
      assignedToUserId: application.userId,
      title: taskTitle,
      description: newTask.description,
      taskType: newTask.taskType,
      documentCategory: newTask.documentCategory || null,
      documentYear: newTask.documentYear || null,
      documentInstructions: newTask.documentInstructions || null,
      priority: newTask.priority,
      dueDate: newTask.dueDate ? new Date(newTask.dueDate) : null,
    });
  };

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
  const queueAtRisk = sortedQueueTasks.filter(t => t.slaStatus === "amber").length;
  const submittedTasks = tasks.filter(t => t.status === "submitted");
  const automatedTasks = sortedQueueTasks.filter(t => t.triggerSource && t.triggerSource !== "MANUAL");

  const getUserName = (userId: string) => {
    const u = users.find(u => u.id === userId);
    return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "Unknown";
  };

  const totalVolume = pipeline.reduce((sum, l) => sum + (parseFloat(l.loanAmount || "0") || 0), 0);
  const complianceScore = complianceData
    ? Math.round(((complianceData.gseReady + complianceData.ulddCompliant) / Math.max(complianceData.total, 1)) * 100)
    : 0;

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
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-white text-primary shadow-lg" data-testid="button-create-task">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                    <DialogDescription>Assign a task to a borrower for document collection or verification.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="application">Select Application</Label>
                      <Select value={selectedApplication} onValueChange={setSelectedApplication}>
                        <SelectTrigger data-testid="select-application">
                          <SelectValue placeholder="Choose an application" />
                        </SelectTrigger>
                        <SelectContent>
                          {applications.map(app => (
                            <SelectItem key={app.id} value={app.id}>
                              {getUserName(app.userId)} - {app.status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taskType">Task Type</Label>
                      <Select value={newTask.taskType} onValueChange={(v) => setNewTask({ ...newTask, taskType: v })}>
                        <SelectTrigger data-testid="select-task-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document_request">Document Request</SelectItem>
                          <SelectItem value="verification">Verification</SelectItem>
                          <SelectItem value="review">Review</SelectItem>
                          <SelectItem value="action">Action Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {newTask.taskType === "document_request" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Document Type</Label>
                            <Select value={newTask.documentCategory} onValueChange={(v) => setNewTask({ ...newTask, documentCategory: v })}>
                              <SelectTrigger data-testid="select-document-category"><SelectValue placeholder="Select type" /></SelectTrigger>
                              <SelectContent>
                                {documentCategories.map(cat => (<SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Year</Label>
                            <Select value={newTask.documentYear} onValueChange={(v) => setNewTask({ ...newTask, documentYear: v })}>
                              <SelectTrigger data-testid="select-document-year"><SelectValue placeholder="Select year" /></SelectTrigger>
                              <SelectContent>
                                {documentYears.map(year => (<SelectItem key={year} value={year}>{year}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Instructions for Borrower</Label>
                          <Textarea
                            placeholder="e.g., Please upload your complete tax return including all schedules..."
                            value={newTask.documentInstructions}
                            onChange={(e) => setNewTask({ ...newTask, documentInstructions: e.target.value })}
                            data-testid="input-document-instructions"
                          />
                        </div>
                      </>
                    )}
                    {newTask.taskType !== "document_request" && (
                      <>
                        <div className="space-y-2">
                          <Label>Task Title</Label>
                          <Input placeholder="Enter task title" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} data-testid="input-task-title" />
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Textarea placeholder="Describe what needs to be done..." value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} data-testid="input-task-description" />
                        </div>
                      </>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                          <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {priorityOptions.map(opt => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} data-testid="input-due-date" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending} data-testid="button-submit-task">
                      {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Inbox className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-queue-count">{sortedQueueTasks.length}</p>
                  <p className="text-xs text-muted-foreground">My Queue</p>
                </div>
              </div>
              {queueBreached > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-2">{queueBreached} SLA breached</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-kpi-review">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Eye className="h-5 w-5 text-blue-600 dark:text-blue-400" />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold" data-testid="text-compliance-score">{complianceScore}%</p>
                  <p className="text-xs text-muted-foreground">Compliance</p>
                </div>
              </div>
              {(complianceData?.needsAttention || 0) > 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{complianceData?.needsAttention} need attention</p>
              )}
            </CardContent>
          </Card>

          <Card data-testid="card-kpi-automated">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
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
                      {formatStageLabel(stage)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

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
                                item.priority === "urgent" ? "bg-red-500" : item.priority === "high" ? "bg-orange-500" : "bg-blue-500"
                              }`} />

                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Link href={`/borrower-file/${item.applicationId}`}>
                                    <span className="font-medium hover:underline cursor-pointer" data-testid={`link-loan-${item.applicationId}`}>
                                      {item.borrowerName || `Loan #${item.applicationId.slice(0, 8)}`}
                                    </span>
                                  </Link>
                                  <Badge variant="outline">{formatStageLabel(item.currentStage)}</Badge>
                                  {compApp?.gseReady && (
                                    <Badge variant="secondary" className="gap-1 text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" data-testid={`badge-gse-${item.applicationId}`}>
                                      <CheckCircle2 className="h-3 w-3" />
                                      GSE Ready
                                    </Badge>
                                  )}
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
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle data-testid="text-my-queue-title">My Queue</CardTitle>
                    <CardDescription>Tasks assigned to your role, sorted by SLA urgency</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {queueBreached > 0 && (
                      <Badge variant="destructive" data-testid="badge-breached-alert">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        {queueBreached} SLA breached
                      </Badge>
                    )}
                    {automatedTasks.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="outline" className="gap-1 bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800" data-testid="badge-auto-tasks-count">
                            <Sparkles className="h-3 w-3" />
                            {automatedTasks.length} automated
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <p>{automatedTasks.length} tasks were auto-created by the rule engine or document processing</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {queueLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}</div>
                ) : sortedQueueTasks.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
                    <p className="font-medium">Queue is clear</p>
                    <p className="text-sm mt-1">No open tasks assigned to your role</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sortedQueueTasks.map(task => (
                      <div
                        key={task.id}
                        className="flex items-center justify-between gap-4 rounded-lg border p-4 hover-elevate cursor-pointer"
                        onClick={() => navigate(`/borrower-file/${task.applicationId}`)}
                        data-testid={`queue-task-${task.id}`}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className={`flex h-3 w-3 rounded-full shrink-0 ${SLA_DOT_COLORS[task.slaStatus]}`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium truncate">{task.title}</p>
                              {task.slaClass && (
                                <Badge variant="outline" className="text-xs shrink-0">{task.slaClass}</Badge>
                              )}
                              <AutomationBadge source={task.triggerSource} />
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {task.taskType === "document_request" ? "Document Request" : task.taskType}
                              {task.triggerSource && task.triggerSource !== "MANUAL" && ` · ${task.triggerSource.replace(/_/g, " ").toLowerCase()}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 flex-wrap">
                          <span className={`text-sm font-medium ${SLA_STATUS_COLORS[task.slaStatus]}`} data-testid={`text-sla-status-${task.id}`}>
                            {task.slaStatus === "red" ? (
                              <span className="flex items-center gap-1">
                                <ArrowUp className="h-3 w-3" />
                                {formatTimeRemaining(task.timeRemaining)}
                              </span>
                            ) : formatTimeRemaining(task.timeRemaining)}
                          </span>
                          {(task.escalationLevel ?? 0) > 0 && (
                            <Badge variant="destructive" className="text-xs" data-testid={`badge-escalation-${task.id}`}>
                              L{task.escalationLevel}
                            </Badge>
                          )}
                          <Badge variant={task.status === "OPEN" ? "outline" : "secondary"}>
                            {task.status === "OPEN" ? "Open" : task.status === "IN_PROGRESS" ? "In Progress" : task.status}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); navigate(`/borrower-file/${task.applicationId}`); }}
                            data-testid={`button-view-file-${task.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conditions">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Tasks Awaiting Review</CardTitle>
                  <CardDescription>Review uploaded documents and verify borrower information</CardDescription>
                </CardHeader>
                <CardContent>
                  {submittedTasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="mx-auto h-12 w-12 mb-4" />
                      <p>No tasks awaiting review</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {submittedTasks.map(task => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between gap-4 rounded-lg border p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          data-testid={`review-task-${task.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-800">
                              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-sm text-muted-foreground">
                                Submitted by: {getUserName(task.assignedToUserId ?? "")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "rejected", verificationStatus: "rejected" } })}
                              data-testid={`button-reject-${task.id}`}
                            >
                              <X className="mr-1 h-4 w-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => updateTaskMutation.mutate({ id: task.id, data: { status: "verified", verificationStatus: "verified" } })}
                              data-testid={`button-verify-${task.id}`}
                            >
                              <CheckCircle2 className="mr-1 h-4 w-4" />
                              Verify
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>All Applications</CardTitle>
                  <CardDescription>View borrower applications and assign tasks</CardDescription>
                </CardHeader>
                <CardContent>
                  {applications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <UserIcon className="mx-auto h-12 w-12 mb-4" />
                      <p>No applications found</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {applications.map(app => (
                        <div
                          key={app.id}
                          className="flex items-center justify-between gap-4 rounded-lg border p-4 hover-elevate"
                          data-testid={`application-row-${app.id}`}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <UserIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{getUserName(app.userId)}</p>
                              <p className="text-sm text-muted-foreground">
                                {app.propertyState ? `Property in ${app.propertyState}` : "No property"}
                                {app.purchasePrice ? ` - ${formatCurrency(app.purchasePrice)}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {getStatusBadge(app.status)}
                            <span className="text-sm text-muted-foreground">
                              {tasks.filter(t => t.applicationId === app.id).length} tasks
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedApplication(app.id); setCreateDialogOpen(true); }}
                              data-testid={`button-add-task-${app.id}`}
                            >
                              <Plus className="mr-1 h-4 w-4" />
                              Add Task
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compliance">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">GSE Ready</p>
                        <p className="text-2xl font-bold text-emerald-600" data-testid="text-gse-ready">{complianceData?.gseReady || 0}</p>
                      </div>
                      <CheckCircle2 className="h-8 w-8 text-emerald-500/30" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Ready for Fannie/Freddie</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">ULDD Compliant</p>
                        <p className="text-2xl font-bold text-blue-600" data-testid="text-uldd-compliant">{complianceData?.ulddCompliant || 0}</p>
                      </div>
                      <FileCheck className="h-8 w-8 text-blue-500/30" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Minimum data met</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Needs Attention</p>
                        <p className="text-2xl font-bold text-amber-600" data-testid="text-needs-attention">{complianceData?.needsAttention || 0}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-amber-500/30" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Missing critical data</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Regulatory Compliance Overview
                  </CardTitle>
                  <CardDescription>TRID timing, MISMO validation, and document compliance per loan</CardDescription>
                </CardHeader>
                <CardContent>
                  {(complianceData?.applications || []).length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="mx-auto h-12 w-12 mb-4" />
                      <p>No active loans to validate</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(complianceData?.applications || []).map(app => (
                        <div key={app.applicationId} className="rounded-lg border p-4" data-testid={`compliance-app-${app.applicationId}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium">{app.borrowerName}</p>
                              <p className="text-xs text-muted-foreground">
                                {app.status?.toUpperCase().replace(/_/g, " ")} {app.loanAmount ? `- ${formatCurrency(app.loanAmount)}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {app.gseReady ? (
                                <Badge data-testid={`badge-gse-${app.applicationId}`}>GSE Ready</Badge>
                              ) : app.ulddCompliant ? (
                                <Badge variant="secondary">ULDD Compliant</Badge>
                              ) : (
                                <Badge variant="destructive">Incomplete</Badge>
                              )}
                              <Button size="sm" variant="outline" asChild>
                                <Link href={`/borrower-file/${app.applicationId}`}>View</Link>
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>ULAD Completeness</span>
                              <span>{app.score}%</span>
                            </div>
                            <Progress value={app.score} className="h-1.5" />
                          </div>
                          {(app.criticalCount > 0 || app.missingDocsCount > 0) && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {app.criticalCount > 0 && (
                                <Badge variant="outline" className="text-xs text-destructive">{app.criticalCount} critical errors</Badge>
                              )}
                              {app.missingDocsCount > 0 && (
                                <Badge variant="outline" className="text-xs">{app.missingDocsCount} missing docs</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Data Retention & Archival
                      </CardTitle>
                      <CardDescription>FCRA, ECOA, and GLBA compliance tracking</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchRetention()}
                      data-testid="button-refresh-retention"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {retentionLoading ? (
                    <div className="grid gap-4 md:grid-cols-4">
                      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-muted-foreground">Total Records</p>
                            <Database className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="text-2xl font-bold" data-testid="text-total-records">
                            {Object.values(retentionReport?.recordCounts || {}).reduce((a, b) => a + b, 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-muted-foreground">Archive Eligible</p>
                            <Archive className="h-4 w-4 text-amber-500" />
                          </div>
                          <p className="text-2xl font-bold text-amber-600" data-testid="text-archive-eligible">
                            {Object.values(retentionReport?.archiveEligibleCounts || {}).reduce((a, b) => a + b, 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-muted-foreground">Retention Review</p>
                            <Clock className="h-4 w-4 text-blue-500" />
                          </div>
                          <p className="text-2xl font-bold text-blue-600" data-testid="text-retention-review">
                            {Object.values(retentionReport?.retentionReviewCounts || {}).reduce((a, b) => a + b, 0)}
                          </p>
                        </div>
                        <div className="rounded-lg border p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm text-muted-foreground">Delete Eligible</p>
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          </div>
                          <p className="text-2xl font-bold text-red-600" data-testid="text-delete-eligible">
                            {Object.values(retentionReport?.deleteEligibleCounts || {}).reduce((a, b) => a + b, 0)}
                          </p>
                        </div>
                      </div>

                      {retentionReport?.recommendations && retentionReport.recommendations.length > 0 && (
                        <div className="space-y-2">
                          {retentionReport.recommendations.map((rec, idx) => (
                            <div
                              key={idx}
                              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                              data-testid={`alert-recommendation-${idx}`}
                            >
                              {rec.includes("No action") ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                              ) : (
                                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                              )}
                              <span className="text-sm">{rec}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium mb-2">Record Counts by Type</p>
                          <div className="space-y-2">
                            {Object.entries(retentionReport?.recordCounts || {}).map(([type, count]) => (
                              <div
                                key={type}
                                className="flex items-center justify-between p-2 rounded-lg border"
                                data-testid={`row-record-${type}`}
                              >
                                <div>
                                  <p className="text-sm font-medium capitalize">{type.replace(/_/g, " ")}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {retentionPoliciesData?.policies?.[type]?.regulatoryReference || "N/A"}
                                  </p>
                                </div>
                                <Badge variant="secondary">{count}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Retention Policies</p>
                          <ScrollArea className="h-[250px]">
                            <div className="space-y-2">
                              {Object.entries(retentionPoliciesData?.policies || {}).map(([type, policy]) => (
                                <div
                                  key={type}
                                  className="p-2 rounded-lg border"
                                  data-testid={`row-policy-${type}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="text-sm font-medium capitalize">{type.replace(/_/g, " ")}</p>
                                    <Badge variant="outline">
                                      {Math.round(policy.retentionPeriodDays / 365)} years
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground mb-1">{policy.legalBasis}</p>
                                  <div className="flex gap-2 text-xs">
                                    <span className="text-muted-foreground">Archive: {policy.archiveAfterDays} days</span>
                                    <span className="text-muted-foreground">Delete: {policy.deleteAfterDays ? `${policy.deleteAfterDays} days` : "Never"}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Compliance Audit Log
                  </CardTitle>
                  <CardDescription>Track all compliance-related activities with cryptographic verification</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3 mb-6">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-green-500" />
                        <span className="font-medium text-sm">Hash Chain Verified</span>
                      </div>
                      <p className="text-xs text-muted-foreground">All audit entries are cryptographically linked</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <FileCheck className="h-5 w-5 text-blue-500" />
                        <span className="font-medium text-sm">Export Ready</span>
                      </div>
                      <p className="text-xs text-muted-foreground">CSV and JSON formats for regulatory exams</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-5 w-5 text-amber-500" />
                        <span className="font-medium text-sm">7-Year Retention</span>
                      </div>
                      <p className="text-xs text-muted-foreground">FCRA compliant data retention</p>
                    </div>
                  </div>
                  <div className="text-center text-muted-foreground py-4">
                    <p className="text-sm">Access individual loan audit logs from the Borrower File page.</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-violet-500" />
                    Automation Activity
                  </CardTitle>
                  <CardDescription>Tasks and checks handled automatically by the platform</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <ScanLine className="h-5 w-5 text-violet-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Document Classification</p>
                        <p className="text-xs text-muted-foreground">
                          Incoming documents are automatically classified (W-2, pay stub, bank statement) using AI. Up to 40% of manual document processing is eliminated.
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Active</Badge>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <Brain className="h-5 w-5 text-violet-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Income Verification</p>
                        <p className="text-xs text-muted-foreground">
                          AI extracts income data from uploaded documents, cross-references with application data, and flags discrepancies automatically.
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Active</Badge>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <Zap className="h-5 w-5 text-violet-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Compliance Rule Engine</p>
                        <p className="text-xs text-muted-foreground">
                          TRID timelines, disclosure deadlines, and regulatory checklists are auto-tracked. Tasks are auto-generated when deadlines approach.
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Active</Badge>
                    </div>
                    <div className="flex items-start gap-3 rounded-lg border p-3">
                      <Bot className="h-5 w-5 text-violet-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Form Pre-fill</p>
                        <p className="text-xs text-muted-foreground">
                          Borrower data from verified documents automatically pre-fills application fields, reducing data entry and errors across the lifecycle.
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">Active</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="intelligence">
            <IntelligenceTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
