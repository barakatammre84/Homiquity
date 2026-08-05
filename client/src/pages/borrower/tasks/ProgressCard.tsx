import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function ProgressCard({
  completedCount,
  totalTasks,
  progressPercent,
}: {
  completedCount: number;
  totalTasks: number;
  progressPercent: number;
}) {
  return (
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
  );
}
