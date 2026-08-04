import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, taskKeys } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import type { LoanApplication } from "@shared/schema";
import { documentCategories, documentYears, priorityOptions } from "./model";

/**
 * "Create Task" dialog (extracted from StaffDashboard.tsx). Document-request
 * tasks derive their title from category+year and carry borrower-facing
 * instructions; other task types take a free title/description. Priority
 * options come from the shared model so the picker can never drift from the
 * task-engine vocabulary. The application select is CONTROLLED by the parent —
 * the Review tab's "Add Task" buttons preselect an application before opening.
 */
export function CreateTaskDialog({
  open,
  onOpenChange,
  selectedApplication,
  onSelectedApplicationChange,
  applications,
  getUserName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedApplication: string;
  onSelectedApplicationChange: (id: string) => void;
  applications: LoanApplication[];
  getUserName: (userId: string) => string | null;
}) {
  const { toast } = useToast();
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
    onSelectedApplicationChange("");
  };

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: { applicationId: string; assignedToUserId: string; title: string; description: string; taskType: string; priority: string; dueDate: Date | string | null; documentCategory?: string | null; documentYear?: string | null; documentInstructions?: string | null }) => {
      const response = await apiRequest("POST", "/api/tasks", taskData);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all() });
      toast({ title: "Task Created", description: "The task has been created and assigned." });
      onOpenChange(false);
      resetNewTaskForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message || "Failed to create task", variant: "destructive" });
    },
  });

  const handleCreateTask = () => {
    if (!selectedApplication) {
      toast({ title: "Error", description: "Please select an application", variant: "destructive" });
      return;
    }
    const application = applications.find(app => app.id === selectedApplication);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            <Select value={selectedApplication} onValueChange={onSelectedApplicationChange}>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreateTask} disabled={createTaskMutation.isPending} data-testid="button-submit-task">
            {createTaskMutation.isPending ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
