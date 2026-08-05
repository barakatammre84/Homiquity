import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@shared/schema";
import { getDocumentCategoryLabel } from "./documentCategoryLabels";

/** All outstanding document requests as ONE milestone, not a wall of task rows. */
export function DocumentChecklistCard({
  tasks,
  onUpload,
}: {
  tasks: Task[];
  onUpload: (task: Task) => void;
}) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <FileText className="h-5 w-5 text-muted-foreground" />
        Document Checklist ({tasks.length})
      </h2>
      <Card data-testid="card-document-milestone">
        <CardContent className="p-4 sm:p-5">
          <p className="mb-4 text-sm text-muted-foreground">
            One milestone, {tasks.length} item{tasks.length === 1 ? "" : "s"} —
            upload what you have and each one checks itself off.
          </p>
          <div className="divide-y">
            {tasks.map((task) => (
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
                  onClick={() => onUpload(task)}
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
  );
}
