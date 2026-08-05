import { AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@shared/schema";
import { getPriorityBadge, getTaskStatusBadge } from "./TaskBadges";

export function RejectedTasksSection({
  tasks,
  onUpload,
}: {
  tasks: Task[];
  onUpload: (task: Task) => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-destructive">
        <AlertCircle className="h-5 w-5" />
        Needs Your Attention ({tasks.length})
      </h2>
      <div className="space-y-4">
        {tasks.map((task) => (
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
                  {/* Never tasks.verificationNotes here — staff
                      review free text is embargoed from borrower
                      payloads (borrowerTaskView); the staff→
                      borrower channel is documentInstructions. */}
                  <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">
                    We couldn't verify this document — please upload a new copy.
                  </p>
                  {task.documentInstructions && (
                    <p className="text-xs text-muted-foreground mt-2 italic">
                      {task.documentInstructions}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => onUpload(task)}
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
  );
}
