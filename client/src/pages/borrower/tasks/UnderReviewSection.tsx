import { File, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@shared/schema";
import { getDocumentCategoryLabel } from "./documentCategoryLabels";
import { getTaskStatusBadge } from "./TaskBadges";

export function UnderReviewSection({ tasks }: { tasks: Task[] }) {
  return (
    <div className="mb-8">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <File className="h-5 w-5 text-primary" />
        Under Review ({tasks.length})
      </h2>
      <div className="space-y-4">
        {tasks.map((task) => (
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
  );
}
