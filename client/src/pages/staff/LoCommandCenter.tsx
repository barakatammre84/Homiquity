import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { SubmissionReadinessDialog } from "@/components/SubmissionReadinessDialog";
import { isInternalStaffRole } from "@shared/roles";
import { getLoanAppStatusMeta } from "@shared/schema";
import { AlertCircle, Download, ExternalLink, Gauge, Loader2, Users } from "lucide-react";
import { PageShell } from "@/components/PageShell";

// -----------------------------------------------------------------------------
// LO Command Center — the loan officer's start-of-day pipeline view.
//
// One screen, one question: "which of my files needs a touch right now?"
// Every row is a file the signed-in staffer is on the deal team for (the
// server scopes GET /api/pipeline/queue by deal-team membership; admins see
// everything), sorted stalled-first by the deterministic File Health light.
//
// The MISMO export button intentionally reuses the internal-staff-only export
// route — the client gate below must stay aligned with requireRole on
// GET /api/loan-applications/:id/mismo-export (H8: full-SSN XML never goes to
// external partners).
// -----------------------------------------------------------------------------

type HealthLight = "green" | "yellow" | "red";

interface FileHealth {
  light: HealthLight;
  reasons: string[];
}

// Mirrors server/pipelineEngine.ts PipelineSummary (Dates arrive as ISO strings).
interface PipelineSummary {
  applicationId: string;
  borrowerName: string;
  currentStage: string;
  daysInPipeline: number;
  targetCloseDate: string | null;
  conditionsOutstanding: number;
  conditionsTotal: number;
  percentComplete: number;
  nextAction: string;
  priority: "normal" | "high" | "urgent";
  lastActivityAt: string | null;
  daysIdle: number | null;
  fileHealth: FileHealth;
}

interface QueueData {
  total: number;
  byPriority: { urgent: number; high: number; normal: number };
  byStage: Record<string, PipelineSummary[]>;
  queue: PipelineSummary[];
}

const HEALTH_ORDER: Record<HealthLight, number> = { red: 0, yellow: 1, green: 2 };

const HEALTH_META: Record<
  HealthLight,
  { label: string; dotClass: string; badgeClass: string }
> = {
  red: {
    label: "Stalled",
    dotClass: "bg-destructive",
    badgeClass: "bg-destructive-subtle text-destructive-subtle-foreground",
  },
  yellow: {
    label: "Watch",
    dotClass: "bg-warning",
    badgeClass: "bg-warning-subtle text-warning-subtle-foreground",
  },
  green: {
    label: "On track",
    dotClass: "bg-success",
    badgeClass: "bg-success-subtle text-success-subtle-foreground",
  },
};

function HealthDot({ health }: { health: FileHealth }) {
  const meta = HEALTH_META[health.light];
  const dot = (
    <span className="inline-flex items-center gap-2" data-testid={`health-${health.light}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
      <span className="sr-only">{`File health: ${meta.label}`}</span>
    </span>
  );
  if (health.reasons.length === 0) return dot;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="cursor-help" aria-label={`File health: ${meta.label}`}>
          {dot}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <ul className="list-disc pl-4 space-y-1">
          {health.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export default function LoCommandCenter() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [healthFilter, setHealthFilter] = useState<HealthLight | "all">("all");
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Client gate mirrors the server: /api/pipeline/queue and the MISMO export
  // are requireRole(internal staff) — brokers/lenders get a partner card, not
  // a broken page of 403s.
  const isInternalStaff = isInternalStaffRole(user?.role || "");
  const isAdmin = user?.role === "admin";

  const { data: queueData, isLoading: queueLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/queue"],
    enabled: !authLoading && !!user && isInternalStaff,
  });

  const files = useMemo(() => {
    const queue = queueData?.queue ?? [];
    const filtered =
      healthFilter === "all" ? queue : queue.filter((f) => f.fileHealth.light === healthFilter);
    return [...filtered].sort((a, b) => {
      const byHealth = HEALTH_ORDER[a.fileHealth.light] - HEALTH_ORDER[b.fileHealth.light];
      if (byHealth !== 0) return byHealth;
      const byIdle = (b.daysIdle ?? 0) - (a.daysIdle ?? 0);
      if (byIdle !== 0) return byIdle;
      return b.daysInPipeline - a.daysInPipeline;
    });
  }, [queueData, healthFilter]);

  const healthCounts = useMemo(() => {
    const counts: Record<HealthLight, number> = { red: 0, yellow: 0, green: 0 };
    for (const f of queueData?.queue ?? []) counts[f.fileHealth.light]++;
    return counts;
  }, [queueData]);

  const handleExportMismo = async (applicationId: string) => {
    setExportingId(applicationId);
    try {
      const res = await fetch(`/api/loan-applications/${applicationId}/mismo-export`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          res.status === 403
            ? "MISMO export is restricted to internal staff with access to this application."
            : body?.error || "Failed to generate the MISMO file.",
        );
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mismo-${applicationId}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({
        title: "MISMO 3.4 exported",
        description: "The lender-ready XML package has been downloaded.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setExportingId(null);
    }
  };

  if (authLoading || (isInternalStaff && queueLoading)) {
    return (
      <div className="p-8">
        <Skeleton className="mb-8 h-8 w-64" />
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!user || !isInternalStaff) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="mb-2 text-xl font-semibold">Internal staff only</h2>
            <p className="text-muted-foreground">
              The LO Command Center works on deal-team pipelines and lender-ready
              exports, which are reserved for internal staff.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell width="full" contentClassName="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gauge className="h-6 w-6 text-primary" aria-hidden="true" />
            LO Command Center
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Every active file on the platform, stalled-first."
              : "Your active files, stalled-first. A red light means the No-Stall promise is at risk."}
          </p>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label="Filter by file health">
          <Button
            variant={healthFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setHealthFilter("all")}
            data-testid="filter-all"
          >
            All ({queueData?.total ?? 0})
          </Button>
          {(["red", "yellow", "green"] as const).map((light) => (
            <Button
              key={light}
              variant={healthFilter === light ? "default" : "outline"}
              size="sm"
              onClick={() => setHealthFilter(light)}
              data-testid={`filter-${light}`}
            >
              <span aria-hidden="true" className={`mr-1.5 h-2 w-2 rounded-full ${HEALTH_META[light].dotClass}`} />
              {HEALTH_META[light].label} ({healthCounts[light]})
            </Button>
          ))}
        </div>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">
              {healthFilter === "all" ? "No active files in your pipeline" : "No files in this band"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {healthFilter === "all"
                ? "Files appear here once you're added to their deal team."
                : "Try a different health filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-3">Health</th>
                    <th scope="col" className="px-4 py-3">Borrower</th>
                    <th scope="col" className="px-4 py-3">Stage</th>
                    <th scope="col" className="px-4 py-3 text-right">Idle</th>
                    <th scope="col" className="px-4 py-3 text-right">In pipeline</th>
                    <th scope="col" className="px-4 py-3">Blocking item</th>
                    <th scope="col" className="px-4 py-3 text-right">Open / total cond.</th>
                    <th scope="col" className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => {
                    const statusMeta = getLoanAppStatusMeta(file.currentStage);
                    const blockingItem = file.fileHealth.reasons[0] ?? file.nextAction;
                    return (
                      <tr
                        key={file.applicationId}
                        className="border-b border-border last:border-0 hover:bg-muted/50"
                        data-testid={`file-row-${file.applicationId}`}
                      >
                        <td className="px-4 py-3">
                          <HealthDot health={file.fileHealth} />
                        </td>
                        <td className="px-4 py-3 font-medium">{file.borrowerName}</td>
                        <td className="px-4 py-3">
                          <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {file.daysIdle === null ? "—" : `${file.daysIdle}d`}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{file.daysInPipeline}d</td>
                        <td className="max-w-xs truncate px-4 py-3 text-muted-foreground" title={blockingItem}>
                          {blockingItem}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {file.conditionsOutstanding}/{file.conditionsTotal}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button asChild variant="ghost" size="sm" data-testid={`open-file-${file.applicationId}`}>
                              <Link href={`/borrower-file/${file.applicationId}`}>
                                <ExternalLink className="mr-1 h-4 w-4" aria-hidden="true" />
                                Open
                              </Link>
                            </Button>
                            <SubmissionReadinessDialog
                              applicationId={file.applicationId}
                              borrowerName={file.borrowerName}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={exportingId === file.applicationId}
                              onClick={() => handleExportMismo(file.applicationId)}
                              data-testid={`export-mismo-${file.applicationId}`}
                            >
                              {exportingId === file.applicationId ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Download className="mr-1 h-4 w-4" aria-hidden="true" />
                              )}
                              Export MISMO
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
