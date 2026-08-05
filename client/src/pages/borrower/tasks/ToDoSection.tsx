import { Calendar, Clock, FileText, Upload } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@shared/schema";
import { getDocumentCategoryLabel } from "./documentCategoryLabels";
import { getPriorityBadge, getTaskStatusBadge } from "./TaskBadges";

/** Pending work that isn't a document request — those live in the checklist card. */
export function ToDoSection({
  tasks,
  onUpload,
}: {
  tasks: Task[];
  onUpload: (task: Task) => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <Clock className="h-5 w-5 text-muted-foreground" />
        To Do ({tasks.length})
      </h2>
      <div className="space-y-4">
        {tasks.map((task) => (
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
                    onClick={() => onUpload(task)}
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
  );
}
