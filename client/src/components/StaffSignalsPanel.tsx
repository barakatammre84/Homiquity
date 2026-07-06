import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Building2, CheckCircle2, Clock, FileWarning, Radio, TimerReset } from "lucide-react";

interface StaffSignal {
  type: "preuw_flag" | "conditions_review" | "stalled" | "docs_expiring" | "investor_candidate";
  priority: 1 | 2 | 3 | 4;
  applicationId: string | null;
  userId?: string;
  borrowerName: string;
  title: string;
  detail: string;
}

const SIGNAL_META: Record<
  StaffSignal["type"],
  { label: string; icon: typeof AlertTriangle; chipClass: string }
> = {
  preuw_flag: {
    label: "Flag",
    icon: AlertTriangle,
    chipClass: "bg-status-danger/10 text-status-danger",
  },
  conditions_review: {
    label: "Review",
    icon: FileWarning,
    chipClass: "bg-status-warning/10 text-status-warning",
  },
  stalled: {
    label: "Stalled",
    icon: Clock,
    chipClass: "bg-primary/10 text-primary",
  },
  docs_expiring: {
    label: "Aging docs",
    icon: TimerReset,
    chipClass: "bg-muted text-muted-foreground",
  },
  investor_candidate: {
    label: "Investor lead",
    icon: Building2,
    chipClass: "bg-status-success/10 text-status-success",
  },
};

/**
 * The loan-officer signals queue: a prioritized "who needs attention first"
 * feed of machine-generated signals (pre-UW flags, conditions awaiting
 * review, stalled files, aging documents). Each row deep-links into the
 * borrower file.
 */
export function StaffSignalsPanel() {
  const { data, isLoading } = useQuery<{ signals: StaffSignal[] }>({
    queryKey: ["/api/signals/staff"],
    refetchInterval: 60_000,
  });

  const signals = data?.signals ?? [];

  return (
    <Card data-testid="card-staff-signals">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Radio className="h-4 w-4 text-primary" />
          Signals
          {signals.length > 0 && (
            <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-[10px]">
              {signals.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        ) : signals.length === 0 ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" data-testid="text-signals-clear">
            <CheckCircle2 className="h-4 w-4 text-status-success" />
            All clear — no files need attention right now.
          </div>
        ) : (
          signals.map((signal, i) => {
            const meta = SIGNAL_META[signal.type];
            const Icon = meta.icon;
            const row = (
              <div
                className={`flex items-start gap-3 rounded-lg border border-transparent bg-muted/40 p-3 ${signal.applicationId ? "hover-elevate cursor-pointer" : ""}`}
                data-testid={`signal-${signal.type}-${signal.applicationId ?? signal.userId ?? i}`}
              >
                <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${meta.chipClass}`}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {signal.borrowerName}
                    <span className="text-muted-foreground font-normal"> — {signal.title}</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{signal.detail}</p>
                </div>
              </div>
            );
            // Signals without an application (e.g. incubator tax insights)
            // have no borrower file to deep-link into yet.
            return signal.applicationId ? (
              <Link key={`${signal.type}-${signal.applicationId}-${i}`} href={`/borrower-file/${signal.applicationId}`}>
                {row}
              </Link>
            ) : (
              <div key={`${signal.type}-${signal.userId ?? "user"}-${i}`}>{row}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
