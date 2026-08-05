import { Eye, FileText, Inbox, Shield, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

export interface KpiCardsProps {
  pipelineCount: number;
  totalVolume: number;
  queueCount: number;
  queueBreached: number;
  awaitingReviewCount: number;
  complianceScore: number;
  needsAttention: number;
  automatedCount: number;
}

export function KpiCards({
  pipelineCount,
  totalVolume,
  queueCount,
  queueBreached,
  awaitingReviewCount,
  complianceScore,
  needsAttention,
  automatedCount,
}: KpiCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-5" data-testid="section-kpi-cards">
      <Card data-testid="card-kpi-pipeline">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-pipeline-count">{pipelineCount}</p>
              <p className="text-xs text-muted-foreground">Active Loans</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{formatCurrency(totalVolume)} volume</p>
        </CardContent>
      </Card>

      <Card data-testid="card-kpi-queue">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-subtle">
              <Inbox className="h-5 w-5 text-warning-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-queue-count">{queueCount}</p>
              <p className="text-xs text-muted-foreground">My Queue</p>
            </div>
          </div>
          {queueBreached > 0 && (
            <p className="text-xs text-destructive mt-2">{queueBreached} SLA breached</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-kpi-review">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-subtle">
              <Eye className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-review-count">{awaitingReviewCount}</p>
              <p className="text-xs text-muted-foreground">Awaiting Review</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-kpi-compliance">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-subtle">
              <Shield className="h-5 w-5 text-success-subtle-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-compliance-score">{complianceScore}%</p>
              <p className="text-xs text-muted-foreground">Compliance</p>
            </div>
          </div>
          {needsAttention > 0 && (
            <p className="text-xs text-warning-subtle-foreground mt-2">{needsAttention} need attention</p>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-kpi-automated">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold" data-testid="text-automated-count">{automatedCount}</p>
              <p className="text-xs text-muted-foreground">Auto-tasks</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Rule engine triggered</p>
        </CardContent>
      </Card>
    </div>
  );
}
