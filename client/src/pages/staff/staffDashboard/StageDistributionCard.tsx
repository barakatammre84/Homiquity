import { Activity } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getStatusLabel } from "@/lib/formatters";
import { STAGE_ORDER, type PipelineSummary } from "./model";

export function StageDistributionCard({ byStage }: { byStage: Record<string, PipelineSummary[]> }) {
  return (
    <Card data-testid="card-stage-distribution">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pipeline Stage Distribution</span>
        </div>
        <div className="grid gap-2 grid-cols-3 sm:grid-cols-4 md:grid-cols-7">
          {STAGE_ORDER.map((stage) => {
            const count = byStage[stage]?.length || 0;
            return (
              <div
                key={stage}
                className={`flex flex-col items-center justify-center rounded-lg border p-2.5 ${
                  count > 0 ? "border-border" : "border-border opacity-50"
                }`}
                data-testid={`stage-count-${stage}`}
              >
                <span className="text-xl font-bold">{count}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight">
                  {getStatusLabel(stage)}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
