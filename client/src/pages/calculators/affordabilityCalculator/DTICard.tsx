import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TermTooltip } from "@/components/TermTooltip";
import type { AffordabilityResults } from "./types";

export interface DTICardProps {
  results: AffordabilityResults;
}

function getDTIColor(dti: number) {
  if (dti <= 28) return "text-success-subtle-foreground";
  if (dti <= 36) return "text-warning-subtle-foreground";
  return "text-destructive";
}

export function DTICard({ results }: DTICardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          <TermTooltip term="dti">Debt-to-Income</TermTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Housing (Front-End)</span>
            <span className={`font-medium ${getDTIColor(results.frontEndDTI)}`}>
              {results.frontEndDTI.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(results.frontEndDTI, 50)} max={50} />
          <p className="text-xs text-muted-foreground mt-0.5">Target: 28% or less</p>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Total (Back-End)</span>
            <span className={`font-medium ${getDTIColor(results.backEndDTI)}`}>
              {results.backEndDTI.toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(results.backEndDTI, 50)} max={50} />
          <p className="text-xs text-muted-foreground mt-0.5">Target: 43% or less</p>
        </div>
      </CardContent>
    </Card>
  );
}
