import { CreditCard, PiggyBank, Target, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { TermTooltip } from "@/components/TermTooltip";
import type { GapAnalysis } from "./types";

export interface StatsCardsProps {
  analysis: GapAnalysis["analysis"];
}

export function StatsCards({ analysis }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Credit Score</CardTitle>
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{analysis?.credit.current || 0}</div>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={analysis?.credit.progress || 0} className="flex-1" />
            <span className="text-xs text-muted-foreground">
              /{analysis?.credit.target || 640}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {analysis?.credit.gap || 0} points to go
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Savings Progress</CardTitle>
          <PiggyBank className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            ${(analysis?.savings.current || 0).toLocaleString()}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={analysis?.savings.progress || 0} className="flex-1" />
            <span className="text-xs text-muted-foreground">
              /${(analysis?.savings.target || 0).toLocaleString()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {analysis?.savings.monthsToGoal
              ? `${analysis.savings.monthsToGoal} months to goal`
              : "Set a savings rate"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <TermTooltip term="dti">DTI Ratio</TermTooltip>
          </CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(analysis?.dti.current || 0).toFixed(1)}%
          </div>
          <Badge
            variant={analysis?.dti.status === "within_guideline" ? "default" : "destructive"}
            className="mt-1"
          >
            {analysis?.dti.status === "within_guideline" ? "Within Guideline" : "Above Guideline"}
          </Badge>
          <p className="text-xs text-muted-foreground mt-1">
            Max allowed: {analysis?.dti.maxAllowed || 43}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Progress</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {(analysis?.overall.progress || 0).toFixed(0)}%
          </div>
          <Progress value={analysis?.overall.progress || 0} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            Toward homeownership
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
