import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, taskKeys } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { useLocation, useRoute } from "wouter";
import { isStaffRole } from "@shared/roles";
import type { Task, Document, TaskDocument } from "@shared/schema";
import { ArrowLeft, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { PageShell } from "@/components/PageShell";
import { getPriorityBadge, getStatusBadge } from "./taskDetail/taskBadges";
import { DocumentsCard } from "./taskDetail/DocumentsCard";
import { VerifyDocumentsCard } from "./taskDetail/VerifyDocumentsCard";
import {
  CompletedBanner,
  RejectedBanner,
  TaskDetailsCard,
  VerificationNotesCard,
} from "./taskDetail/TaskSidebar";

interface TaskWithDocs extends Task {
  documents: (TaskDocument & { document: Document })[];
}

export default function TaskDetail() {
  const [, params] = useRoute("/task/:id");
  const taskId = params?.id;
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { uploadFile } = useUpload();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");

  const { data: task, isLoading } = useQuery<TaskWithDocs>({
    queryKey: taskKeys.detail(taskId!),
    enabled: !authLoading && !!taskId,
  });

  const uploadDocumentMutation = useMutation({
    mutationFn: async (file: File) => {
      // Presigned flow: the file goes browser → object storage directly, then
      // the JSON call registers it as a document (the multipart leg is gone).
      const stored = await uploadFile(file);
      if (!stored) {
        throw new Error("The file could not be uploaded to secure storage. Please try again.");
      }

      const response = await apiRequest("POST", "/api/documents/upload", {
        objectPath: stored.objectPath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        documentType: task?.documentCategory || "other",
        applicationId: task?.applicationId || undefined,
      });

      const document = await response.json();

      const linkResponse = await apiRequest("POST", `/api/tasks/${taskId}/documents`, {
        documentId: document.id,
      });

      return linkResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId!) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
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
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId!) });
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
      toast({
        title: "Document Updated",
        description: "The document verification status has been updated.",
      });
      setVerificationNotes("");
    },
    // Silent before. The server rejects this for a staff member who is not on
    // the deal team (403), and a verdict that never landed looked identical to
    // one that did — on the action that completes or reopens the task.
    onError: (error: Error) => {
      toast({
        title: "Verification Failed",
        description: error.message || "The verification status could not be updated.",
        variant: "destructive",
      });
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
      <PageShell width="wide">
        <Skeleton className="mb-8 h-8 w-48" />
        <Skeleton className="h-64" />
      </PageShell>
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
  // Upload while the ball is in the borrower's court (OPEN covers both the
  // initial request and a reopened-after-rejection task); verify once a
  // document is submitted and the verdict is still pending.
  const canUpload = isAssignedUser && task.status === "OPEN";
  const canVerify = isStaff && task.status === "IN_PROGRESS" && task.verificationStatus === "pending";

  return (
    <PageShell
      width="wide"
      title={task.title}
      titleTestId="text-task-title"
      headerLead={
        <Button
          variant="ghost"
          onClick={() => navigate(isStaff ? "/staff-dashboard" : "/tasks")}
          className="-ml-2"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      }
      headerMeta={
        <div className="flex flex-wrap items-center gap-2">
          {getStatusBadge(task)}
          {getPriorityBadge(task.priority || "normal")}
          {task.dueDate && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Due: {format(new Date(task.dueDate), "MMMM d, yyyy")}
            </span>
          )}
        </div>
      }
    >
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

          <DocumentsCard
            documents={task.documents}
            canUpload={canUpload}
            isUploading={isUploading}
            fileInputRef={fileInputRef}
            onFileSelect={handleFileSelect}
          />

          {canVerify && task.documents && task.documents.length > 0 && (
            <VerifyDocumentsCard
              documents={task.documents}
              verificationNotes={verificationNotes}
              onVerificationNotesChange={setVerificationNotes}
              onVerify={(docId, isVerified) => verifyDocumentMutation.mutate({ docId, isVerified })}
              isPending={verifyDocumentMutation.isPending}
            />
          )}
        </div>

        <div className="space-y-6">
          <TaskDetailsCard task={task} />

          {/* Server strips verificationNotes for client roles
              (borrowerTaskView); the isStaff guard states the intent. */}
          {isStaff && task.verificationNotes && (
            <VerificationNotesCard notes={task.verificationNotes} />
          )}

          {task.verificationStatus === "rejected" && task.status !== "COMPLETED" && <RejectedBanner />}

          {task.status === "COMPLETED" && <CompletedBanner />}
        </div>
      </div>
    </PageShell>
  );
}
