import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest, taskKeys, dashboardKeys } from "@/lib/queryClient";
import { friendlyApiError } from "@/lib/errorMessage";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import type { Task, LoanApplication } from "@shared/schema";
import { useActiveApplication } from "@/hooks/useActiveApplication";
import { PageShell } from "@/components/PageShell";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { bucketTasks } from "./tasks/taskBuckets";
import { EmptyTasksCard } from "./tasks/EmptyTasksCard";
import { ProgressCard } from "./tasks/ProgressCard";
import { RejectedTasksSection } from "./tasks/RejectedTasksSection";
import { DocumentChecklistCard } from "./tasks/DocumentChecklistCard";
import { ToDoSection } from "./tasks/ToDoSection";
import { UnderReviewSection } from "./tasks/UnderReviewSection";
import { CompletedSection } from "./tasks/CompletedSection";
import { UploadDocumentDialog } from "./tasks/UploadDocumentDialog";

interface DashboardData {
  applications: LoanApplication[];
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
    queryKey: dashboardKeys.root(),
    enabled: !authLoading,
  });

  // Resolved up here (not at the point of use) because Rules of Hooks bars a
  // hook call after the loading/error early returns below.
  const applications = dashboardData?.applications || [];
  const { activeApplication } = useActiveApplication(applications);

  const {
    data: tasks,
    isLoading: tasksLoading,
    isError: tasksIsError,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery<Task[]>({
    queryKey: taskKeys.all(),
    enabled: !authLoading && !!user,
  });

  // Kept in the page rather than moved into ./tasks/: uploads are a
  // TEAM_PRACTICES §9 security-review trigger, and the note below about the
  // PATCH that always 403'd is the kind of context that only survives if the
  // flow reads as one piece.
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

      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
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

  const {
    myTasks,
    rejectedTasks,
    pendingDocTasks,
    pendingOtherTasks,
    submittedTasks,
    completedTasks,
    totalTasks,
    completedCount,
    progressPercent,
  } = bucketTasks(tasks, activeApplication?.id);

  const openUploadDialog = (task: Task) => {
    setSelectedTask(task);
    setUploadDialogOpen(true);
  };

  return (
    <>
      <PageShell width="wide" title="My Tasks" subtitle="Complete these tasks to move forward with your loan application">
        {myTasks.length === 0 ? (
          <EmptyTasksCard hasActiveApplication={!!activeApplication} />
        ) : (
          <>
            <ProgressCard
              completedCount={completedCount}
              totalTasks={totalTasks}
              progressPercent={progressPercent}
            />

            {rejectedTasks.length > 0 && (
              <RejectedTasksSection tasks={rejectedTasks} onUpload={openUploadDialog} />
            )}

            {pendingDocTasks.length > 0 && (
              <DocumentChecklistCard tasks={pendingDocTasks} onUpload={openUploadDialog} />
            )}

            {pendingOtherTasks.length > 0 && (
              <ToDoSection tasks={pendingOtherTasks} onUpload={openUploadDialog} />
            )}

            {submittedTasks.length > 0 && <UnderReviewSection tasks={submittedTasks} />}

            {completedTasks.length > 0 && <CompletedSection tasks={completedTasks} />}
          </>
        )}
      </PageShell>

      <UploadDocumentDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        task={selectedTask}
        selectedFile={selectedFile}
        onSelectFile={setSelectedFile}
        onConfirm={handleFileUpload}
        isUploading={isUploading}
      />
    </>
  );
}
