import * as React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

// Shared KPI / metric card — the single home for the "icon tile + big number"
// pattern that was hand-rolled across AdminDashboard, staff TaskOperations
// (local MetricsCard), and LoanPipeline. One type scale, one padding, one set
// of AA-safe tones. Reach for this instead of a bespoke <Card><CardContent>.
//
//   <StatCard label="Total Users" value={stats.totalUsers} icon={Users} tone="info" />
//   <StatCard label="Approval Rate" value="72%" tone="success"
//             trend={{ direction: "up", label: "+4%" }} hint="vs. last 30 days" />

type StatTone = "neutral" | "primary" | "success" | "warning" | "info" | "destructive";
type TrendDirection = "up" | "down" | "neutral";

// Icon-tile tints — the *-subtle pairs are the AA-safe status surfaces; primary
// borrows the secondary chip so emerald stays reserved for forward actions.
const TILE_TONES: Record<StatTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-secondary text-primary",
  success: "bg-success-subtle text-success-subtle-foreground",
  warning: "bg-warning-subtle text-warning-subtle-foreground",
  info: "bg-info-subtle text-info-subtle-foreground",
  destructive: "bg-destructive-subtle text-destructive-subtle-foreground",
};

// Trend chip — status color rendered as a filled chip (never bare text on the
// white canvas, which would fail AA).
const TREND_TONES: Record<TrendDirection, string> = {
  up: "bg-success-subtle text-success-subtle-foreground",
  down: "bg-destructive-subtle text-destructive-subtle-foreground",
  neutral: "bg-muted text-muted-foreground",
};

const TREND_ICON: Record<TrendDirection, LucideIcon> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  neutral: ArrowRight,
};

export interface StatCardProps {
  /** Small caption above the value. */
  label: string;
  /** The headline metric (string, number, or formatted node). */
  value: React.ReactNode;
  /** Optional lucide icon rendered in a tinted tile. */
  icon?: LucideIcon;
  /** Tint of the icon tile. Default "neutral". */
  tone?: StatTone;
  /** Supporting micro-copy under the value. */
  hint?: string;
  /** Optional trend chip, e.g. { direction: "up", label: "+12%" }. */
  trend?: { direction: TrendDirection; label: string };
  /** Visual density. "compact" for dense grids. Default "default". */
  size?: "default" | "compact";
  className?: string;
  "data-testid"?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  hint,
  trend,
  size = "default",
  className,
  "data-testid": testId,
}: StatCardProps) {
  const TrendIcon = trend ? TREND_ICON[trend.direction] : null;
  const compact = size === "compact";

  return (
    <Card className={className}>
      <CardContent className={cn("flex items-center gap-4", compact ? "p-4" : "p-6")}>
        {Icon && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl",
              TILE_TONES[tone],
              compact ? "h-10 w-10" : "h-12 w-12",
            )}
          >
            <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} aria-hidden="true" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p
              className={cn("font-bold tracking-tight", compact ? "text-2xl" : "text-3xl")}
              data-testid={testId}
            >
              {value}
            </p>
            {trend && TrendIcon && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-xs font-medium",
                  TREND_TONES[trend.direction],
                )}
              >
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                {trend.label}
              </span>
            )}
          </div>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
