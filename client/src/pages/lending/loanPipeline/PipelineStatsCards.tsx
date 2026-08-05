import { Clock, CheckCheck, FileText, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export interface PipelineStatsCardsProps {
  documentsComplete: number;
  documentsTotal: number;
  conditionsCleared: number;
  conditionsTotal: number;
  daysInPipeline: number;
  estimatedClosingDays: number;
}

export function PipelineStatsCards({
  documentsComplete,
  documentsTotal,
  conditionsCleared,
  conditionsTotal,
  daysInPipeline,
  estimatedClosingDays,
}: PipelineStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card data-testid="card-stat-documents">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-docs-count">
                {documentsComplete}/{documentsTotal}
              </p>
              <p className="text-sm text-muted-foreground">Documents Submitted</p>
            </div>
          </div>
          <Progress
            value={documentsTotal > 0 ? (documentsComplete / documentsTotal) * 100 : 0}
            className="mt-4"
          />
        </CardContent>
      </Card>

      <Card data-testid="card-stat-conditions">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
              <CheckCheck className="h-6 w-6 text-success-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-conditions-count">
                {conditionsCleared}/{conditionsTotal}
              </p>
              <p className="text-sm text-muted-foreground">Conditions Cleared</p>
            </div>
          </div>
          <Progress
            value={conditionsTotal > 0 ? (conditionsCleared / conditionsTotal) * 100 : 0}
            className="mt-4"
          />
        </CardContent>
      </Card>

      <Card data-testid="card-stat-timeline">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
              <Timer className="h-6 w-6 text-warning-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-days-pipeline">
                Day {daysInPipeline}
              </p>
              <p className="text-sm text-muted-foreground">In Pipeline</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-xs text-muted-foreground">
            <Clock className="mr-1 h-3 w-3" />
            Target: {estimatedClosingDays} days to close
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
