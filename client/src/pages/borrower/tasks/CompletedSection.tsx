import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Task } from "@shared/schema";
import { getDocumentCategoryLabel } from "./documentCategoryLabels";
import { getTaskStatusBadge } from "./TaskBadges";

export function CompletedSection({ tasks }: { tasks: Task[] }) {
  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <CheckCircle2 className="h-5 w-5 text-status-success" />
        Completed ({tasks.length})
      </h2>
      <div className="space-y-4">
        {tasks.map((task) => (
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
  );
}
