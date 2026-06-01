import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useRoute } from "wouter";
import { isStaffRole } from "@shared/schema";
import type { Task, Document, TaskDocument } from "@shared/schema";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Calendar,
  X,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";

interface TaskWithDocs extends Task {
  documents: (TaskDocument & { document: Document })[];
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    pending: { variant: "secondary", label: "Pending" },
    in_progress: { variant: "default", label: "In Progress" },
    submitted: { variant: "outline", label: "Submitted - Awaiting Review" },
    verified: { variant: "default", label: "Verified" },
    rejected: { variant: "destructive", label: "Rejected" },
    completed: { variant: "default", label: "Completed" },
  };
  const config = statusConfig[status] || { variant: "secondary" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

function getPriorityBadge(priority: string) {
  const config: Record<string, { className: string; label: string }> = {
    low: { className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300", label: "Low Priority" },
    normal: { className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "Normal Priority" },
    high: { className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300", label: "High Priority" },
    urgent: { className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Urgent" },
  };
  const p = config[priority] || config.normal;
  return <Badge className={p.className}>{p.label}</Badge>;
}

export default function TaskDetail() {
  const [, params] = useRoute("/task/:id");
  const taskId = params?.id;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");

  const { data: task, isLoading } = useQuery<TaskWithDocs>({
    queryKey: ['/api/tasks', taskId],
    enabled: !authLoading && !!taskId,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentType", task?.documentCategory || "other");
      formData.append("applicationId", task?.applicationId || "");

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const document = await response.json();

      const linkResponse = await apiRequest("POST", `/api/tasks/${taskId}/documents`, {
        documentId: document.id,
      });

      return linkResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Document Uploaded",
        description: "Your document has been uploaded and is pending review.",
      });
      setIsUploading(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
      setIsUploading(false);
    },
  });

  const verifyDocumentMutation = useMutation({
    mutationFn: async ({ docId, isVerified }: { docId: string; isVerified: boolean }) => {
      const response = await apiRequest("PATCH", `/api/tasks/${taskId}/documents/${docId}/verify`, {
        isVerified,
        verificationNotes,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks', taskId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Document Updated",
        description: "The document verification status has been updated.",
      });
      setVerificationNotes("");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      uploadDocumentMutation.mutate(file);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Task Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The task you're looking for doesn't exist or you don't have access.
            </p>
            <Button onClick={() => navigate("/tasks")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Tasks
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isStaff = isStaffRole(user?.role || "");
  const isAssignedUser = task.assignedToUserId === user?.id;
  const canUpload = isAssignedUser && ["pending", "in_progress", "rejected"].includes(task.status);
  const canVerify = isStaff && task.status === "submitted";

  return (
    <>
      <div className="border-b p-4 sm:p-6 lg:p-8">
            <Button
              variant="ghost"
              onClick={() => navigate(isStaff ? "/staff-dashboard" : "/tasks")}
              className="mb-4"
              data-testid="button-back"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" data-testid="text-task-title">
                  {task.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {getStatusBadge(task.status)}
                  {getPriorityBadge(task.priority || "normal")}
                  {task.dueDate && (
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Due: {format(new Date(task.dueDate), "MMMM d, yyyy")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                {task.documentInstructions && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Instructions</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground" data-testid="text-instructions">
                        {task.documentInstructions}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {task.description && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Description</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{task.description}</p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Uploaded Documents</CardTitle>
                    <CardDescription>
                      {task.documents?.length || 0} document(s) uploaded for this task
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(!task.documents || task.documents.length === 0) ? (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                        <FileText className="mx-auto h-12 w-12 mb-4" />
                        <p>No documents uploaded yet</p>
                        {canUpload && (
                          <p className="text-sm mt-2">
                            Click the upload button to add your document
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {task.documents.map((taskDoc) => (
                          <div
                            key={taskDoc.id}
                            className={`flex items-center justify-between rounded-lg border p-4 ${
                              taskDoc.isVerified
                                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                : ""
                            }`}
                            data-testid={`document-${taskDoc.id}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div>
                                <p className="font-medium">{taskDoc.document.fileName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {format(new Date(taskDoc.createdAt!), "MMM d, yyyy 'at' h:mm a")}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {taskDoc.isVerified ? (
                                <Badge variant="default" className="bg-green-600">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Verified
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Pending Review</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {canUpload && (
                      <div className="mt-6">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                          className="hidden"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          data-testid="input-file-upload"
                        />
                        <Button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploading}
                          className="w-full"
                          data-testid="button-upload-document"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload Document
                            </>
                          )}
                        </Button>
                        <p className="text-sm text-muted-foreground text-center mt-2">
                          Supported formats: PDF, JPG, PNG, DOC, DOCX
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {canVerify && task.documents && task.documents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Verify Documents</CardTitle>
                      <CardDescription>
                        Review the uploaded documents and verify or reject them
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="notes">Verification Notes (Optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Add any notes about the verification..."
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          data-testid="input-verification-notes"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            const lastDoc = task.documents?.[task.documents.length - 1];
                            if (lastDoc) {
                              verifyDocumentMutation.mutate({ docId: lastDoc.id, isVerified: false });
                            }
                          }}
                          disabled={verifyDocumentMutation.isPending}
                          data-testid="button-reject-document"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                        <Button
                          onClick={() => {
                            const lastDoc = task.documents?.[task.documents.length - 1];
                            if (lastDoc) {
                              verifyDocumentMutation.mutate({ docId: lastDoc.id, isVerified: true });
                            }
                          }}
                          disabled={verifyDocumentMutation.isPending}
                          data-testid="button-approve-document"
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve & Verify
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Task Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Task Type</p>
                      <p className="font-medium capitalize">{task.taskType.replace(/_/g, " ")}</p>
                    </div>
                    {task.documentCategory && (
                      <div>
                        <p className="text-sm text-muted-foreground">Document Type</p>
                        <p className="font-medium capitalize">{task.documentCategory.replace(/_/g, " ")}</p>
                      </div>
                    )}
                    {task.documentYear && (
                      <div>
                        <p className="text-sm text-muted-foreground">Year</p>
                        <p className="font-medium">{task.documentYear}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {format(new Date(task.createdAt!), "MMMM d, yyyy")}
                      </p>
                    </div>
                    {task.verifiedAt && (
                      <div>
                        <p className="text-sm text-muted-foreground">Verified</p>
                        <p className="font-medium">
                          {format(new Date(task.verifiedAt), "MMMM d, yyyy")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {task.verificationNotes && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Verification Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground" data-testid="text-verification-notes">
                        {task.verificationNotes}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {task.status === "rejected" && (
                  <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-red-700 dark:text-red-400">
                            Document Rejected
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                            Please review the notes and upload a new document.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {task.status === "verified" && (
                  <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-700 dark:text-green-400">
                            Task Complete
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                            Your document has been verified and accepted.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
    </>
  );
}
