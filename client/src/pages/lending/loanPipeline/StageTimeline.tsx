import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStatusLabel } from "@/lib/formatters";
import { STAGE_ORDER } from "./stageOrder";

export interface StageTimelineProps {
  currentStage: string;
  currentStageIndex: number;
}

export function StageTimeline({ currentStage, currentStageIndex }: StageTimelineProps) {
  return (
    <Card data-testid="card-stage-timeline">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg">Stage Timeline</CardTitle>
          <Badge
            variant={currentStage === "funded" ? "default" : "secondary"}
            data-testid="badge-current-stage"
          >
            {getStatusLabel(currentStage)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="flex items-center justify-between">
            {STAGE_ORDER.map((stage, idx) => {
              const isComplete = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isPending = idx > currentStageIndex;
              const Icon = stage.icon;

              return (
                <div key={stage.key} className="flex flex-col items-center relative z-10">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      isComplete
                        ? "border-primary bg-primary text-primary-foreground"
                        : isCurrent
                        ? "border-primary bg-background text-primary"
                        : "border-muted bg-muted text-muted-foreground"
                    }`}
                    data-testid={`stage-indicator-${stage.key}`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium text-center max-w-[60px] ${
                      isCurrent ? "text-primary" : isPending ? "text-muted-foreground" : ""
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="absolute top-5 left-0 right-0 h-0.5 bg-muted -z-0 mx-5">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width: `${(currentStageIndex / (STAGE_ORDER.length - 1)) * 100}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
