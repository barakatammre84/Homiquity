import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { friendlyApiError } from "@/lib/errorMessage";
import { titleCaseFromSnake } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import type { Task, LoanApplication, TaskPriority } from "@shared/schema";
import { pickWorkableLoanApplication } from "@shared/schema";
import {
  CheckCircle2,
  Clock,
  FileText,
  Upload,
  AlertCircle,
  Calendar,
  File,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { PageShell } from "@/components/PageShell";
import { QueryErrorState } from "@/components/ui/query-boundary";

interface DashboardData {
  applications: LoanApplication[];
}

// Badge over both task axes: lifecycle (tasks.status, canonical uppercase) and
// the verification verdict (verificationStatus) — a rejection outranks the
// lifecycle label because it is the thing the borrower must act on.
function getTaskStatusBadge(task: Pick<Task, "status" | "verificationStatus">) {
  if (task.verificationStatus === "rejected" && task.status !== "COMPLETED") {
    return <Badge variant="destructive">Needs Attention</Badge>;
  }
  const config: Record<Task["status"], { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    OPEN: { variant: "secondary", label: "Pending" },
    IN_PROGRESS:
      task.verificationStatus === "pending"
        ? { variant: "default", label: "Submitted" }
        : { variant: "outline", label: "In Progress" },
    BLOCKED: { variant: "secondary", label: "Blocked" },
    COMPLETED: { variant: "default", label: "Completed" },
    EXPIRED: { variant: "secondary", label: "Expired" },
  };
  const c = config[task.status] || { variant: "secondary" as const, label: task.status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function getPriorityBadge(priority: TaskPriority) {
  const config: Record<TaskPriority, { className: string; label: string }> = {
    low: { className: "bg-muted text-muted-foreground", label: "Low" },
    normal: { className: "bg-primary/10 text-primary", label: "Normal" },
    high: { className: "bg-status-warning/10 text-status-warning", label: "High" },
    urgent: { className: "bg-status-danger/10 text-status-danger", label: "Urgent" },
  };
  const p = config[priority] ?? config.normal; // runtime guard: pre-0034 legacy rows
  return <Badge className={`no-default-hover-elevate no-default-active-elevate ${p.className}`}>{p.label}</Badge>;
}

function getDocumentCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    tax_return: "Tax Return",
    pay_stub: "Pay Stub",
    bank_statement: "Bank Statement",
    bank_statement_business: "Business Bank Statement",
    w2: "W-2 Form",
    id: "Government ID",
    government_id: "Government ID",
    homeowners_insurance: "Homeowners Insurance",
    purchase_contract: "Purchase Contract",
    gift_letter: "Gift Letter",
    profit_loss: "Profit & Loss Statement",
    business_license: "Business License",
    reserves_proof: "Proof of Reserves",
    social_security_award: "Social Security Award Letter",
    pension_statement: "Pension Statement",
    letter_of_explanation: "Letter of Explanation",
    other: "Other Document",
  };
  // Fallback: humanize unknown snake_case types instead of showing raw keys.
  return labels[category] || titleCaseFromSnake(category);
}

export default function Tasks() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { uploadFile } = useUpload();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksIsError,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    enabled: !authLoading && !!user,
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Task> }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Task updated", description: "Your task has been updated." });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async () => {
    if (!selectedTask || !selectedFile) return;

    setIsUploading(true);
    try {
      // Presigned flow: the file goes browser → object storage directly, then
      // the JSON call registers it as a document (the multipart leg is gone).
      const stored = await uploadFile(selectedFile);
      if (!stored) {
        throw new Error("The file could not be uploaded to secure storage. Please try again.");
      }

      const uploadResponse = await apiRequest("POST", "/api/documents/upload", {
        objectPath: stored.objectPath,
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        mimeType: selectedFile.type,
        documentType: selectedTask.documentCategory || "other",
        applicationId: selectedTask.applicationId,
      });

      const document = await uploadResponse.json();

      // Linking the document is what advances the task (IN_PROGRESS +
      // verification pending) — done server-side by this POST. The old
      // follow-up PATCH { status: "submitted" } always 403'd for borrowers
      // (status is a staff-only field), surfacing a spurious failure toast
      // after a successful upload.
      const linkResponse = await apiRequest("POST", `/api/tasks/${selectedTask.id}/documents`, {
        documentId: document.id,
      });
      await linkResponse.json();

      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });

      toast({
        title: "Document Uploaded",
        description: "Your document has been submitted for review.",
      });

      setUploadDialogOpen(false);
      setSelectedFile(null);
      setSelectedTask(null);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: friendlyApiError(error, "There was an error uploading your document."),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (authLoading || dashboardLoading || tasksLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // A server failure on the tasks query used to fall through to the "No Tasks
  // Yet" empty state — misleading. Show an honest error + retry instead (ux-01).
  if (tasksIsError) {
    return (
      <PageShell width="wide" title="My Tasks" subtitle="Complete these tasks to move forward with your loan application">
        <QueryErrorState
          error={tasksError}
          onRetry={() => refetchTasks()}
          title="We couldn't load your tasks"
          data-testid="tasks-error"
        />
      </PageShell>
    );
  }

  const applications = dashboardData?.applications || [];
  const activeApplication = pickWorkableLoanApplication(applications);

  // Scope to the ACTIVE application — tasks from old/denied applications are
  // noise, not next steps (the "56 pending tasks" defect). EXPIRED tasks are
  // dead, not to-dos, so they don't count against progress either.
  const myTasks = (tasks || []).filter(
    (t) =>
      (!activeApplication || t.applicationId === activeApplication.id) &&
      t.status !== "EXPIRED",
  );
  // Buckets over the canonical vocabulary (the old lowercase groups matched
  // zero engine-written tasks, leaving every OPEN task invisible on this page).
  // A "rejected" verdict on a non-completed task outranks its lifecycle bucket.
  const rejectedTasks = myTasks.filter(
    (t) => t.verificationStatus === "rejected" && t.status !== "COMPLETED",
  );
  const pendingTasks = myTasks.filter(
    (t) => (t.status === "OPEN" || t.status === "BLOCKED") && t.verificationStatus !== "rejected",
  );
  const submittedTasks = myTasks.filter(
    (t) => t.status === "IN_PROGRESS" && t.verificationStatus !== "rejected",
  );
  const completedTasks = myTasks.filter((t) => t.status === "COMPLETED");

  // Milestone grouping: document requests collapse into ONE checklist card
  // instead of a wall of near-identical task rows.
  const pendingDocTasks = pendingTasks.filter((t) => t.taskType === "document_request");
  const pendingOtherTasks = pendingTasks.filter((t) => t.taskType !== "document_request");

  const totalTasks = myTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const openUploadDialog = (task: Task) => {
    setSelectedTask(task);
    setUploadDialogOpen(true);
  };

  return (
    <>
      <PageShell width="wide" title="My Tasks" subtitle="Complete these tasks to move forward with your loan application">
            {myTasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="mb-4 h-12 w-12 text-status-success" />
                  <h3 className="mb-2 text-lg font-semibold">No Tasks Yet</h3>
                  <p className="text-center text-muted-foreground">
                    {activeApplication
                      ? "Your loan officer will assign tasks as your application progresses."
                      : "Start a loan application to receive your first tasks."}
                  </p>
                  {!activeApplication && (
                    <Link href="/apply">
                      <Button className="mt-4" data-testid="button-start-application">
                        Start Application
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="mb-8">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold">Your Progress</h3>
                        <p className="text-sm text-muted-foreground">
                          {completedCount} of {totalTasks} tasks completed
                        </p>
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {Math.round(progressPercent)}%
                      </div>
                    </div>
                    <Progress value={progressPercent} className="mt-4" />
                  </CardContent>
                </Card>

                {rejectedTasks.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-destructive">
                      <AlertCircle className="h-5 w-5" />
                      Needs Your Attention ({rejectedTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {rejectedTasks.map((task) => (
                        <Card key={task.id} className="border-destructive">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h4 className="font-medium">{task.title}</h4>
                                  {getTaskStatusBadge(task)}
                                  {task.priority && getPriorityBadge(task.priority)}
                                </div>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                                )}
                                {task.verificationNotes && (
                                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                                    {task.verificationNotes}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => openUploadDialog(task)}
                                data-testid={`button-reupload-${task.id}`}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Re-upload
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {pendingDocTasks.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      Document Checklist ({pendingDocTasks.length})
                    </h2>
                    <Card data-testid="card-document-milestone">
                      <CardContent className="p-4 sm:p-5">
                        <p className="mb-4 text-sm text-muted-foreground">
                          One milestone, {pendingDocTasks.length} item{pendingDocTasks.length === 1 ? "" : "s"} —
                          upload what you have and each one checks itself off.
                        </p>
                        <div className="divide-y">
                          {pendingDocTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                              data-testid={`checklist-item-${task.id}`}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                                  <FileText className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">
                                    {task.documentCategory
                                      ? getDocumentCategoryLabel(task.documentCategory)
                                      : task.title}
                                    {task.documentYear && (
                                      <span className="text-muted-foreground"> · {task.documentYear}</span>
                                    )}
                                  </p>
                                  {task.documentInstructions && (
                                    <p className="truncate text-xs text-muted-foreground">
                                      {task.documentInstructions}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openUploadDialog(task)}
                                data-testid={`button-upload-${task.id}`}
                              >
                                <Upload className="mr-2 h-4 w-4" />
                                Upload
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {pendingOtherTasks.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      To Do ({pendingOtherTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {pendingOtherTasks.map((task) => (
                        <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h4 className="font-medium">{task.title}</h4>
                                  {getTaskStatusBadge(task)}
                                  {task.priority && getPriorityBadge(task.priority)}
                                </div>
                                {task.description && (
                                  <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                                )}
                                {task.documentCategory && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    {getDocumentCategoryLabel(task.documentCategory)}
                                    {task.documentYear && ` (${task.documentYear})`}
                                  </div>
                                )}
                                {task.dueDate && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Calendar className="h-4 w-4" />
                                    Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                                  </div>
                                )}
                                {task.documentInstructions && (
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    {task.documentInstructions}
                                  </p>
                                )}
                              </div>
                              {task.taskType === "document_request" && (
                                <Button
                                  size="sm"
                                  onClick={() => openUploadDialog(task)}
                                  data-testid={`button-upload-${task.id}`}
                                >
                                  <Upload className="mr-2 h-4 w-4" />
                                  Upload
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {submittedTasks.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <File className="h-5 w-5 text-primary" />
                      Under Review ({submittedTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {submittedTasks.map((task) => (
                        <Card key={task.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h4 className="font-medium">{task.title}</h4>
                                  {getTaskStatusBadge(task)}
                                </div>
                                {task.documentCategory && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <FileText className="h-4 w-4" />
                                    {getDocumentCategoryLabel(task.documentCategory)}
                                    {task.documentYear && ` (${task.documentYear})`}
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                Awaiting review
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {completedTasks.length > 0 && (
                  <div>
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <CheckCircle2 className="h-5 w-5 text-status-success" />
                      Completed ({completedTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {completedTasks.map((task) => (
                        <Card key={task.id} className="opacity-75">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <CheckCircle2 className="h-5 w-5 text-status-success flex-shrink-0" />
                              <div className="flex-1">
                                <h4 className="font-medium">{task.title}</h4>
                                {task.documentCategory && (
                                  <p className="text-sm text-muted-foreground">
                                    {getDocumentCategoryLabel(task.documentCategory)}
                                  </p>
                                )}
                              </div>
                              {getTaskStatusBadge(task)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
      </PageShell>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              {selectedTask?.title}
              {selectedTask?.documentCategory && (
                <span className="block mt-1">
                  Required: {getDocumentCategoryLabel(selectedTask.documentCategory)}
                  {selectedTask.documentYear && ` for ${selectedTask.documentYear}`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedTask?.documentInstructions && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <strong>Instructions:</strong> {selectedTask.documentInstructions}
              </div>
            )}
            <div>
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-2"
                data-testid="input-file-upload"
              />
              {selectedFile && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <File className="h-4 w-4" />
                  {selectedFile.name}
                  <Button
                    variant="ghost"
                    size="icon" aria-label="Close"
                    className="h-6 w-6"
                    onClick={() => setSelectedFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFileUpload}
              disabled={!selectedFile || isUploading}
              data-testid="button-confirm-upload"
            >
              {isUploading ? "Uploading..." : "Upload Document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
