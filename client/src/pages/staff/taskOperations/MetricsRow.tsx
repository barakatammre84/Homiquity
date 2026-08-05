import { Activity, AlertTriangle, CheckCircle2, Clock, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TaskMetrics } from "./types";

function MetricsCard({
  title,
  value,
  icon: Icon,
  description,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export function MetricsRow({ metrics }: { metrics: TaskMetrics | undefined }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <MetricsCard
        title="Total Active"
        value={metrics?.total || 0}
        icon={FileText}
        description="Active tasks"
      />
      <MetricsCard
        title="Open"
        value={metrics?.open || 0}
        icon={Clock}
        description="Awaiting action"
      />
      <MetricsCard
        title="In Progress"
        value={metrics?.inProgress || 0}
        icon={Activity}
        description="Being worked on"
      />
      <MetricsCard
        title="Completed"
        value={metrics?.completed || 0}
        icon={CheckCircle2}
        description="All time"
      />
      <MetricsCard
        title="Breached"
        value={metrics?.breached || 0}
        icon={AlertTriangle}
        description="SLA exceeded"
      />
    </div>
  );
}
