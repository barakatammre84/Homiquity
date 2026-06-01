import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import type { Task, LoanApplication } from "@shared/schema";
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

interface DashboardData {
  applications: LoanApplication[];
}

function getTaskStatusBadge(status: string) {
  const config: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    in_progress: { variant: "outline", label: "In Progress" },
    submitted: { variant: "default", label: "Submitted" },
    verified: { variant: "default", label: "Verified" },
    rejected: { variant: "destructive", label: "Needs Attention" },
    completed: { variant: "default", label: "Completed" },
  };
  const c = config[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const config: Record<string, { className: string; label: string }> = {
    low: { className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Low" },
    normal: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "Normal" },
    high: { className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", label: "High" },
    urgent: { className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Urgent" },
  };
  const p = config[priority || "normal"] || config.normal;
  return <Badge className={p.className}>{p.label}</Badge>;
}

function getDocumentCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    tax_return: "Tax Return",
    pay_stub: "Pay Stub",
    bank_statement: "Bank Statement",
    w2: "W-2 Form",
    id: "Government ID",
    other: "Other Document",
  };
  return labels[category] || category;
}

export default function Tasks() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: ["/api/dashboard"],
    enabled: !authLoading,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery<Task[]>({
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
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("applicationId", selectedTask.applicationId);
      formData.append("category", selectedTask.documentCategory || "other");

      const uploadResponse = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(errorText || "Failed to upload document");
      }

      const document = await uploadResponse.json();

      const linkResponse = await apiRequest("POST", `/api/tasks/${selectedTask.id}/documents`, {
        documentId: document.id,
      });
      await linkResponse.json();

      const updateResponse = await apiRequest("PATCH", `/api/tasks/${selectedTask.id}`, {
        status: "submitted",
      });
      await updateResponse.json();

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
      const errorMessage = error instanceof Error ? error.message : "There was an error uploading your document.";
      toast({
        title: "Upload Failed",
        description: errorMessage,
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

  const applications = dashboardData?.applications || [];
  const activeApplication = applications.find(
    (app) => !["closed", "denied"].includes(app.status)
  );

  const myTasks = tasks || [];
  const pendingTasks = myTasks.filter((t) => ["pending", "in_progress"].includes(t.status));
  const submittedTasks = myTasks.filter((t) => t.status === "submitted");
  const completedTasks = myTasks.filter((t) => ["verified", "completed"].includes(t.status));
  const rejectedTasks = myTasks.filter((t) => t.status === "rejected");

  const totalTasks = myTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  const openUploadDialog = (task: Task) => {
    setSelectedTask(task);
    setUploadDialogOpen(true);
  };

  return (
    <>
      <div className="border-b p-4 sm:p-6 lg:p-8">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-tasks-title">My Tasks</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Complete these tasks to move forward with your loan application
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {myTasks.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
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
                                  {getTaskStatusBadge(task.status)}
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

                {pendingTasks.length > 0 && (
                  <div className="mb-8">
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      To Do ({pendingTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {pendingTasks.map((task) => (
                        <Card key={task.id} className="hover-elevate" data-testid={`card-task-${task.id}`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h4 className="font-medium">{task.title}</h4>
                                  {getTaskStatusBadge(task.status)}
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
                      <File className="h-5 w-5 text-blue-500" />
                      Under Review ({submittedTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {submittedTasks.map((task) => (
                        <Card key={task.id} className="border-blue-200 dark:border-blue-800">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h4 className="font-medium">{task.title}</h4>
                                  {getTaskStatusBadge(task.status)}
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
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      Completed ({completedTasks.length})
                    </h2>
                    <div className="space-y-4">
                      {completedTasks.map((task) => (
                        <Card key={task.id} className="opacity-75">
                          <CardContent className="p-4">
                            <div className="flex items-center gap-4">
                              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                              <div className="flex-1">
                                <h4 className="font-medium">{task.title}</h4>
                                {task.documentCategory && (
                                  <p className="text-sm text-muted-foreground">
                                    {getDocumentCategoryLabel(task.documentCategory)}
                                  </p>
                                )}
                              </div>
                              {getTaskStatusBadge(task.status)}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

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
                    size="icon"
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
