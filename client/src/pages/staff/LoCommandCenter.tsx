import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, ApiError } from "@/lib/queryClient";
import { downloadResponseAsFile } from "@/lib/downloadFile";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { RateLockDialog } from "@/components/RateLockDialog";
import { ScenarioSimulatorDialog } from "@/components/ScenarioSimulatorDialog";
import { SubmissionReadinessDialog } from "@/components/SubmissionReadinessDialog";
import { isInternalStaffRole } from "@shared/roles";
import { getLoanAppStatusMeta } from "@shared/schema";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  Inbox,
  Loader2,
  MessageSquare,
  Phone,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

// -----------------------------------------------------------------------------
// LO Command Center — advisory cockpit (LO Advisor Program prompt LO-1).
//
// Three panes, one question answered without navigating away: "where does this
// file stand and what do I do next?"
//   Left  — attention rail: signalEngine feed (priority-sorted) + pipeline queue.
//   Center— active borrower: on select, the file's cockpit loads in place
//           (status, UAL income evaluation, conditions, documents, messages).
//   Right — actions: pre-approval letter, What-If simulator (LO-2), rate lock,
//           MISMO export, and a Call Prep digest.
//
// Wiring, not greenfield: every pane reads endpoints that already exist plus the
// two LO-1 additions (GET /api/staff/signals, GET /api/staff/applications/:id/
// cockpit). Client role gate mirrors the server (isInternalStaffRole); PII stays
// masked — the cockpit shows operational data, full PII lives behind the
// deep-linked BorrowerFile's audited reveal.
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
  conditionsOutstanding: number;
  conditionsTotal: number;
  nextAction: string;
  priority: "normal" | "high" | "urgent";
  daysIdle: number | null;
  fileHealth: FileHealth;
}

interface QueueData {
  total: number;
  queue: PipelineSummary[];
}

// Mirrors server/services/signalEngine.ts StaffSignal.
interface StaffSignal {
  type: "preuw_flag" | "conditions_review" | "stalled" | "docs_expiring" | "investor_candidate";
  priority: 1 | 2 | 3 | 4;
  applicationId: string | null;
  userId?: string;
  borrowerName: string;
  title: string;
  detail: string;
}

interface IncomePath {
  pathId: string;
  role: "component" | "alternative";
  status: "applicable" | "not_indicated" | "unavailable";
  kind: "dti_income" | "coverage_ratio";
  monthlyQualifyingIncome?: number;
  appliedToDti?: boolean;
  coverageRatio?: number | null;
  requiresManualReview: boolean;
}

// Mirrors GET /api/staff/applications/:id/cockpit.
interface CockpitData {
  application: {
    id: string;
    borrowerUserId: string;
    borrowerName: string;
    status: string;
    loanPurpose: string | null;
    purchasePrice: string | null;
    downPayment: string | null;
    propertyState: string | null;
    propertyType: string | null;
    isVeteran: boolean;
    closingDate: string | null;
    createdAt: string | null;
  };
  income: {
    primaryMonthlyQualifyingIncome: number;
    incomeBasis: string;
    recommendedPathId: string | null;
    requiresManualReview: boolean;
    evaluatedAt: string | null;
    paths: IncomePath[];
  } | null;
  conditions: {
    total: number;
    open: number;
    items: { id: string; title: string; category: string; status: string; priority: string }[];
  };
  documents: {
    uploadedCount: number;
    verifiedCount: number;
    byType: { type: string; status: string; fileName: string }[];
  };
  messages: {
    unreadFromBorrower: number;
    recent: { id: string; fromBorrower: boolean; snippet: string; createdAt: string | null }[];
  };
  activity: {
    totalPageViews: number;
    propertySearches: number;
    calculatorUses: number;
    propertyViews: number;
  };
}

const HEALTH_ORDER: Record<HealthLight, number> = { red: 0, yellow: 1, green: 2 };
const HEALTH_META: Record<HealthLight, { label: string; dotClass: string }> = {
  red: { label: "Stalled", dotClass: "bg-destructive" },
  yellow: { label: "Watch", dotClass: "bg-warning" },
  green: { label: "On track", dotClass: "bg-success" },
};

const SIGNAL_META: Record<
  StaffSignal["priority"],
  { label: string; badge: "destructive" | "warning" | "info" | "secondary" }
> = {
  1: { label: "Act now", badge: "destructive" },
  2: { label: "Review", badge: "warning" },
  3: { label: "Rescue", badge: "info" },
  4: { label: "Freshness", badge: "secondary" },
};

function prettyPathId(pathId: string): string {
  return pathId
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Dscr/i, "DSCR")
    .replace(/\bSe\b/i, "Self-Employment");
}

// -----------------------------------------------------------------------------
// Left pane — attention rail
// -----------------------------------------------------------------------------
function AttentionRail({
  queue,
  signals,
  selectedId,
  onSelect,
  loading,
}: {
  queue: PipelineSummary[];
  signals: StaffSignal[];
  selectedId: string | null;
  onSelect: (applicationId: string) => void;
  loading: boolean;
}) {
  const filesSorted = useMemo(
    () =>
      [...queue].sort((a, b) => {
        const byHealth = HEALTH_ORDER[a.fileHealth.light] - HEALTH_ORDER[b.fileHealth.light];
        if (byHealth !== 0) return byHealth;
        return (b.daysIdle ?? 0) - (a.daysIdle ?? 0);
      }),
    [queue],
  );

  // Signals that point at a file the LO can open (priority-sorted already).
  const actionableSignals = useMemo(() => signals.filter((s) => s.applicationId), [signals]);

  if (loading) {
    return (
      <div className="space-y-3" data-testid="attention-rail-loading">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="attention-rail">
      {actionableSignals.length > 0 && (
        <section aria-labelledby="signals-heading">
          <h2
            id="signals-heading"
            className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
            Needs attention ({actionableSignals.length})
          </h2>
          <ul className="space-y-2">
            {actionableSignals.map((signal, idx) => {
              const meta = SIGNAL_META[signal.priority];
              const active = signal.applicationId === selectedId;
              return (
                <li key={`${signal.applicationId}-${signal.type}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => signal.applicationId && onSelect(signal.applicationId)}
                    className={`w-full rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${
                      active ? "border-primary bg-primary/5" : "border-border"
                    }`}
                    data-testid={`signal-${signal.applicationId}`}
                    aria-current={active ? "true" : undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{signal.borrowerName}</span>
                      <Badge variant={meta.badge}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground" title={signal.title}>
                      {signal.title}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="pipeline-heading">
        <h2
          id="pipeline-heading"
          className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Pipeline ({filesSorted.length})
        </h2>
        {filesSorted.length === 0 ? (
          <p className="rounded-md border border-border p-3 text-sm text-muted-foreground">
            No active files in your pipeline yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {filesSorted.map((file) => {
              const meta = HEALTH_META[file.fileHealth.light];
              const active = file.applicationId === selectedId;
              return (
                <li key={file.applicationId}>
                  <button
                    type="button"
                    onClick={() => onSelect(file.applicationId)}
                    className={`flex w-full items-center gap-2 rounded-md border p-2.5 text-left transition-colors hover:bg-muted/50 ${
                      active ? "border-primary bg-primary/5" : "border-transparent"
                    }`}
                    data-testid={`pipeline-file-${file.applicationId}`}
                    aria-current={active ? "true" : undefined}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dotClass}`}
                          aria-label={`File health: ${meta.label}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent side="right">{meta.label}</TooltipContent>
                    </Tooltip>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{file.borrowerName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {file.conditionsOutstanding}/{file.conditionsTotal} cond · {file.daysInPipeline}d
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Center pane — active borrower
// -----------------------------------------------------------------------------
function ActiveBorrowerPane({ applicationId, onBack }: { applicationId: string; onBack: () => void }) {
  const { data, isLoading, isError } = useQuery<CockpitData>({
    queryKey: [`/api/staff/applications/${applicationId}/cockpit`],
  });

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" data-testid="cockpit-loading">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Couldn't load this file</p>
          <p className="mt-1 text-sm text-muted-foreground">You may not have access, or it's no longer active.</p>
        </div>
      </div>
    );
  }

  const { application: app, income, conditions, documents, messages } = data;
  const statusMeta = getLoanAppStatusMeta(app.status);

  return (
    <div className="space-y-4 p-4 md:p-6" data-testid="cockpit-active-borrower">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={onBack}
              aria-label="Back to pipeline"
              data-testid="cockpit-back"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <h2 className="truncate text-xl font-bold" data-testid="cockpit-borrower-name">
              {app.borrowerName}
            </h2>
            {app.isVeteran && <Badge variant="info">Veteran</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Badge variant={statusMeta.badgeVariant}>{statusMeta.label}</Badge>
            {app.loanPurpose && <span className="capitalize">{app.loanPurpose.replace(/_/g, " ")}</span>}
            {app.purchasePrice && <span>{formatCurrency(app.purchasePrice)}</span>}
            {app.propertyState && <span>{app.propertyState}</span>}
            {app.closingDate && <span>Close {formatDate(app.closingDate)}</span>}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" data-testid="cockpit-open-full-file">
          <Link href={`/borrower-file/${app.id}`}>
            <ExternalLink className="mr-1 h-4 w-4" aria-hidden="true" />
            Full file
          </Link>
        </Button>
      </div>

      {/* Income */}
      <Card data-testid="cockpit-income">
        <CardContent className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-primary" aria-hidden="true" />
            Qualifying income
          </h3>
          {income ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-2xl font-semibold tabular-nums">
                  {formatCurrency(income.primaryMonthlyQualifyingIncome)}/mo
                </span>
                <span className="text-xs text-muted-foreground">
                  {income.incomeBasis === "urla_line_items" ? "URLA line items" : "application summary"}
                </span>
                {income.requiresManualReview && <Badge variant="warning">Manual review</Badge>}
              </div>
              <ul className="space-y-1 text-sm">
                {income.paths
                  .filter((p) => p.status === "applicable")
                  .map((p) => (
                    <li key={p.pathId} className="flex items-center justify-between gap-2">
                      <span className="text-muted-foreground">
                        {prettyPathId(p.pathId)}
                        {p.role === "alternative" && <span className="ml-1 text-xs">(alt)</span>}
                      </span>
                      <span className="tabular-nums">
                        {p.kind === "coverage_ratio"
                          ? p.coverageRatio != null
                            ? `DSCR ${p.coverageRatio.toFixed(2)}`
                            : "—"
                          : formatCurrency(p.monthlyQualifyingIncome ?? 0) + "/mo"}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No income evaluation yet. Run the instant decision (or update income) to populate qualifying paths.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Conditions */}
        <Card data-testid="cockpit-conditions">
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
              Open conditions ({conditions.open}/{conditions.total})
            </h3>
            {conditions.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open conditions.</p>
            ) : (
              <ul className="space-y-1.5">
                {conditions.items.map((c) => (
                  <li key={c.id} className="flex items-start gap-2 text-sm" data-testid={`condition-${c.id}`}>
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate">{c.title}</span>
                      {c.status === "submitted" && <Badge variant="info" className="mt-0.5">Ready for review</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card data-testid="cockpit-documents">
          <CardContent className="p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              Documents ({documents.verifiedCount}/{documents.uploadedCount} verified)
            </h3>
            {documents.byType.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {documents.byType.slice(0, 6).map((d) => (
                  <li key={d.type} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate capitalize text-muted-foreground">{d.type.replace(/_/g, " ")}</span>
                    <Badge
                      variant={d.status === "verified" ? "success" : d.status === "rejected" ? "destructive" : "secondary"}
                    >
                      {d.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Messages */}
      <Card data-testid="cockpit-messages">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" aria-hidden="true" />
              Recent messages
              {messages.unreadFromBorrower > 0 && (
                <Badge variant="destructive">{messages.unreadFromBorrower} unread</Badge>
              )}
            </h3>
            <Button asChild variant="ghost" size="sm" data-testid="cockpit-open-messages">
              <Link href="/messages">Open thread</Link>
            </Button>
          </div>
          {messages.recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages with this borrower yet.</p>
          ) : (
            <ul className="space-y-2">
              {messages.recent.map((m) => (
                <li key={m.id} className="text-sm">
                  <span className={`font-medium ${m.fromBorrower ? "text-foreground" : "text-muted-foreground"}`}>
                    {m.fromBorrower ? app.borrowerName.split(" ")[0] : "You"}:
                  </span>{" "}
                  <span className="text-muted-foreground">{m.snippet}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Right pane — actions
// -----------------------------------------------------------------------------
function ActionsRail({
  applicationId,
  borrowerName,
  signals,
  onExportMismo,
  exporting,
}: {
  applicationId: string;
  borrowerName: string;
  signals: StaffSignal[];
  onExportMismo: () => void;
  exporting: boolean;
}) {
  const { toast } = useToast();
  const [generatingLetter, setGeneratingLetter] = useState(false);

  const handleGenerateLetter = async () => {
    setGeneratingLetter(true);
    try {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/generate-letter`, {});
      await res.json().catch(() => null);
      // Download the freshly generated PDF.
      const pdf = await apiRequest("GET", `/api/loan-applications/${applicationId}/letter-pdf`).catch(() => {
        throw new Error("The letter was generated but the PDF isn't ready yet.");
      });
      await downloadResponseAsFile(pdf, `pre-approval-${applicationId}.pdf`);
      toast({ title: "Pre-approval letter ready", description: "The PDF has been downloaded." });
    } catch (error) {
      toast({
        title: "Couldn't generate the letter",
        description:
          error instanceof Error ? error.message : "Only pre-approved files with verified data can produce a letter.",
        variant: "destructive",
      });
    } finally {
      setGeneratingLetter(false);
    }
  };

  return (
    <div className="space-y-2" data-testid="actions-rail">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</p>

      {/* Terminal money-path action: submission-readiness → run AUS → push the
          compliant MISMO package to a wholesale lender. (Re-wired into the
          cockpit — the LO-1 three-pane consolidation dropped it.) */}
      <SubmissionReadinessDialog applicationId={applicationId} borrowerName={borrowerName} />

      <ScenarioSimulatorDialog applicationId={applicationId} borrowerName={borrowerName} />

      <RateLockDialog applicationId={applicationId} borrowerName={borrowerName} />

      <CallPrepDialog applicationId={applicationId} borrowerName={borrowerName} signals={signals} />

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={handleGenerateLetter}
        disabled={generatingLetter}
        data-testid="action-preapproval-letter"
      >
        {generatingLetter ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        Pre-approval letter
      </Button>

      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={onExportMismo}
        disabled={exporting}
        data-testid="action-export-mismo"
      >
        {exporting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        Export MISMO
      </Button>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Call Prep — a one-screen digest for the phone call.
// -----------------------------------------------------------------------------
function CallPrepDialog({
  applicationId,
  borrowerName,
  signals,
}: {
  applicationId: string;
  borrowerName: string;
  signals: StaffSignal[];
}) {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<CockpitData>({
    queryKey: [`/api/staff/applications/${applicationId}/cockpit`],
    enabled: open,
  });

  const openSignals = signals.filter((s) => s.applicationId === applicationId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="w-full justify-start" data-testid="action-call-prep">
          <Phone className="mr-2 h-4 w-4" aria-hidden="true" />
          Call Prep
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto" data-testid="call-prep-dialog">
        <DialogHeader>
          <DialogTitle>Call Prep — {borrowerName}</DialogTitle>
          <DialogDescription>Everything to know before you dial, on one screen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="mb-1.5 text-sm font-semibold">What needs attention</h3>
            {openSignals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open signals — the file is quiet.</p>
            ) : (
              <ul className="space-y-1.5">
                {openSignals.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Badge variant={SIGNAL_META[s.priority].badge}>{SIGNAL_META[s.priority].label}</Badge>
                    <span>
                      <span className="font-medium">{s.title}</span>
                      <span className="block text-muted-foreground">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Next conditions</h3>
            {!data ? (
              <Skeleton className="h-12" />
            ) : data.conditions.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open conditions.</p>
            ) : (
              <ul className="list-disc space-y-0.5 pl-5 text-sm">
                {data.conditions.items.slice(0, 5).map((c) => (
                  <li key={c.id}>{c.title}</li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Recent borrower activity (7 days)</h3>
            {!data ? (
              <Skeleton className="h-8" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {data.activity.propertyViews} property views · {data.activity.propertySearches} searches ·{" "}
                {data.activity.calculatorUses} calculator uses
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------
// Intake inbox — applications that arrived without a loan officer (self-serve
// applicants with no referral). Shown to LO/LOA at the top of the attention
// rail; claiming a file puts it on their desk (server-side assignLoanOfficer
// grants file access + queue visibility in one step) so no applicant sits
// stranded waiting on an admin assignment.
function IntakeInboxCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/unassigned"],
  });

  const claim = useMutation({
    mutationFn: async (applicationId: string) => {
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/claim`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/unassigned"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pipeline/queue"] });
      toast({ title: "File claimed", description: "It's on your desk and in your pipeline now." });
    },
    onError: (error) => {
      toast({
        title: "Couldn't claim this file",
        description: error instanceof Error ? error.message : "Unexpected error.",
        variant: "destructive",
      });
    },
  });

  const pool = data?.queue ?? [];
  if (isLoading || pool.length === 0) return null;

  return (
    <div
      className="mb-3 rounded-lg border border-info-subtle-foreground/25 bg-info-subtle p-3 text-info-subtle-foreground"
      data-testid="intake-inbox"
    >
      <div className="mb-2 flex items-center gap-2">
        <Inbox className="h-4 w-4 shrink-0" aria-hidden="true" />
        <h2 className="text-sm font-semibold">
          Intake inbox — {pool.length} waiting
        </h2>
      </div>
      <ul className="space-y-1.5">
        {pool.map((file) => (
          <li
            key={file.applicationId}
            className="flex items-center justify-between gap-2"
            data-testid={`intake-${file.applicationId}`}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.borrowerName}</p>
              <p className="text-xs opacity-80">waiting {file.daysInPipeline}d</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => claim.mutate(file.applicationId)}
              disabled={claim.isPending}
              data-testid={`claim-${file.applicationId}`}
            >
              {claim.isPending && claim.variables === file.applicationId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                "Claim"
              )}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LoCommandCenter() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [didInitialSelect, setDidInitialSelect] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const isInternalStaff = isInternalStaffRole(user?.role || "");
  const canClaim = user?.role === "lo" || user?.role === "loa";
  const enabled = !authLoading && !!user && isInternalStaff;

  const { data: queueData, isLoading: queueLoading } = useQuery<QueueData>({
    queryKey: ["/api/pipeline/queue"],
    enabled,
  });
  const { data: signalsData } = useQuery<{ signals: StaffSignal[] }>({
    queryKey: ["/api/staff/signals"],
    enabled,
  });

  const queue = queueData?.queue ?? [];
  const signals = useMemo(() => signalsData?.signals ?? [], [signalsData]);

  // Default the center pane to the top signal (or first file) ONCE on first
  // load — not on every deselect, or the mobile back button could never return
  // to the attention rail. Prefer the highest-priority signal's file.
  useEffect(() => {
    if (!didInitialSelect && queue.length > 0) {
      const firstSignal = signals.find((s) => s.applicationId);
      setSelectedId(firstSignal?.applicationId ?? queue[0].applicationId);
      setDidInitialSelect(true);
    }
  }, [didInitialSelect, queue, signals]);

  const selectedBorrowerName = useMemo(
    () => queue.find((f) => f.applicationId === selectedId)?.borrowerName ?? "Borrower",
    [queue, selectedId],
  );

  const handleExportMismo = async (applicationId: string) => {
    setExportingId(applicationId);
    try {
      const res = await apiRequest("GET", `/api/loan-applications/${applicationId}/mismo-export`).catch(
        (err: unknown) => {
          throw new Error(
            err instanceof ApiError && err.status === 403
              ? "MISMO export is restricted to internal staff with access to this application."
              : "Failed to generate the MISMO file.",
          );
        },
      );
      await downloadResponseAsFile(res, `mismo-${applicationId}.xml`);
      toast({ title: "MISMO 3.4 exported", description: "The lender-ready XML package has been downloaded." });
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

  if (authLoading || (enabled && queueLoading)) {
    return (
      <div className="p-8">
        <Skeleton className="mb-6 h-8 w-64" />
        <div className="grid gap-4 lg:grid-cols-[280px_1fr_220px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!user || !isInternalStaff) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Users className="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
            <h2 className="mb-2 text-xl font-semibold">Internal staff only</h2>
            <p className="text-muted-foreground">
              The LO Command Center works on deal-team pipelines and lender-ready exports, which are reserved for
              internal staff.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-testid="lo-command-center">
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Gauge className="h-6 w-6 text-primary" aria-hidden="true" />
          LO Command Center
        </h1>
        <p className="text-sm text-muted-foreground">
          {user.role === "admin"
            ? "Every active file, most urgent first — pick one to see where it stands and what's next."
            : "Your book, most urgent first — pick a file to see where it stands and what's next."}
        </p>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden p-4 md:px-6 lg:grid-cols-[300px_1fr_240px]">
        {/* Left: attention rail (hidden on mobile once a file is open) */}
        <aside className={`overflow-y-auto ${selectedId ? "hidden lg:block" : "block"}`} aria-label="Attention rail">
          {canClaim && <IntakeInboxCard />}
          <AttentionRail
            queue={queue}
            signals={signals}
            selectedId={selectedId}
            onSelect={setSelectedId}
            loading={queueLoading}
          />
        </aside>

        {/* Center: active borrower */}
        <main className={`overflow-y-auto rounded-lg border border-border ${selectedId ? "block" : "hidden lg:block"}`}>
          {selectedId ? (
            <ActiveBorrowerPane applicationId={selectedId} onBack={() => setSelectedId(null)} />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-center">
              <div>
                <Gauge className="mx-auto mb-3 h-10 w-10 text-muted-foreground" aria-hidden="true" />
                <p className="font-medium">Pick a file to open the cockpit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Its status, income, conditions, documents and messages load here — no navigating away.
                </p>
              </div>
            </div>
          )}
        </main>

        {/* Right: actions (only when a file is active) */}
        <aside className={`overflow-y-auto ${selectedId ? "block" : "hidden lg:block"}`} aria-label="Actions">
          {selectedId ? (
            <ActionsRail
              applicationId={selectedId}
              borrowerName={selectedBorrowerName}
              signals={signals}
              onExportMismo={() => handleExportMismo(selectedId)}
              exporting={exportingId === selectedId}
            />
          ) : (
            <p className="hidden text-sm text-muted-foreground lg:block">Actions appear when you pick a file.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
