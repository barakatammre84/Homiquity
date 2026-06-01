import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Target,
} from "lucide-react";

interface Prediction {
  likelihoodToClose: number;
  estimatedDaysToFund: number;
  riskOfFallout: number;
  conditionDelayRisk: number;
  riskFactors: string[];
  positiveFactors: string[];
  comparisonCohort: string;
  cohortAvgDaysToClose: number | null;
  cohortConversionRate: number | null;
}

interface Benchmark {
  yourMetrics: {
    creditScore: number | null;
    dti: number | null;
    ltv: number | null;
    documentsSubmitted: number;
    daysInProcess: number | null;
  };
  cohortMetrics: {
    avgCreditScore: number | null;
    avgDti: number | null;
    avgLtv: number | null;
    avgDaysToClose: number | null;
    conversionRate: number | null;
    totalBorrowers: number;
  };
  percentiles: {
    creditScorePercentile: number | null;
    dtiPercentile: number | null;
    speedPercentile: number | null;
  };
  insights: string[];
}

export default function PredictionInsights({ applicationId }: { applicationId?: string }) {
  const predUrl = applicationId
    ? `/api/predictions/me?applicationId=${applicationId}`
    : "/api/predictions/me";
  const { data: prediction, isLoading: predLoading } = useQuery<Prediction>({
    queryKey: ["/api/predictions/me", applicationId],
    queryFn: async () => {
      const res = await fetch(predUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch prediction");
      return res.json();
    },
  });

  const { data: benchmark, isLoading: benchLoading } = useQuery<Benchmark>({
    queryKey: ["/api/predictions/benchmark"],
  });

  if (predLoading || benchLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  const likelihoodPct = Math.round(prediction.likelihoodToClose * 100);
  const statusColor = likelihoodPct >= 70 ? "text-emerald-600" : likelihoodPct >= 40 ? "text-yellow-600" : "text-red-500";
  const statusLabel = likelihoodPct >= 70 ? "Strong" : likelihoodPct >= 40 ? "Moderate" : "Needs Attention";

  return (
    <Card data-testid="prediction-insights">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Your Loan Progress Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="space-y-1" data-testid="metric-likelihood">
            <p className="text-xs text-muted-foreground">Likelihood</p>
            <div className="flex items-center gap-1">
              <Target className={`h-4 w-4 ${statusColor}`} />
              <span className={`text-lg font-bold ${statusColor}`}>{likelihoodPct}%</span>
            </div>
            <Badge variant="secondary">{statusLabel}</Badge>
          </div>
          <div className="space-y-1" data-testid="metric-timeline">
            <p className="text-xs text-muted-foreground">Est. Timeline</p>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-lg font-bold">{prediction.estimatedDaysToFund}d</span>
            </div>
            <p className="text-xs text-muted-foreground">to funding</p>
          </div>
          {benchmark?.percentiles?.creditScorePercentile != null && (
            <div className="space-y-1" data-testid="metric-credit-percentile">
              <p className="text-xs text-muted-foreground">Credit Standing</p>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-lg font-bold">{benchmark.percentiles.creditScorePercentile}th</span>
              </div>
              <p className="text-xs text-muted-foreground">percentile</p>
            </div>
          )}
          {benchmark?.yourMetrics.documentsSubmitted !== undefined && (
            <div className="space-y-1" data-testid="metric-docs">
              <p className="text-xs text-muted-foreground">Documents</p>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-lg font-bold">{benchmark.yourMetrics.documentsSubmitted}</span>
              </div>
              <p className="text-xs text-muted-foreground">submitted</p>
            </div>
          )}
        </div>

        {prediction.positiveFactors.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Working in your favor</p>
            <div className="flex flex-wrap gap-1.5">
              {prediction.positiveFactors.slice(0, 4).map((f, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-500" />
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {prediction.riskFactors.length > 0 && prediction.riskFactors[0] !== "Insufficient data for detailed prediction" && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Areas to address</p>
            <div className="flex flex-wrap gap-1.5">
              {prediction.riskFactors.slice(0, 3).map((f, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  <AlertTriangle className="h-3 w-3 mr-1 text-orange-500" />
                  {f}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {benchmark?.insights && benchmark.insights.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Compared to similar borrowers</p>
            {benchmark.insights.slice(0, 2).map((insight, i) => (
              <p key={i} className="text-sm text-muted-foreground">{insight}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
