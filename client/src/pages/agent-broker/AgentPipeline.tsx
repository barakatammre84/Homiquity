import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Users,
  MapPin,
  DollarSign,
  Calendar,
  ArrowRight,
  Clock,
  CheckCircle2,
  FileText,
  ClipboardList,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";

interface PipelineItem {
  id: string;
  applicationId: string;
  borrowerName: string | null;
  currentStage: string | null;
  lastMilestone: string | null;
  nextStep: string | null;
  estimatedCloseDate: string | null;
  loanAmount: string | null;
  propertyAddress: string | null;
  lastUpdatedAt: string;
}

const PIPELINE_STAGES = [
  "application",
  "processing",
  "underwriting",
  "conditional",
  "clear_to_close",
  "closing",
  "funded",
] as const;

const STAGE_CONFIG: Record<string, { label: string; className: string }> = {
  application: {
    label: "Application",
    className: "bg-info/10 text-info",
  },
  processing: {
    label: "Processing",
    className: "bg-warning/10 text-warning-subtle-foreground",
  },
  underwriting: {
    label: "Underwriting",
    className: "bg-primary/10 text-primary",
  },
  conditional: {
    label: "Conditional",
    className: "bg-warning/10 text-warning-subtle-foreground",
  },
  clear_to_close: {
    label: "Clear to Close",
    className: "bg-success/10 text-success-subtle-foreground",
  },
  closing: {
    label: "Closing",
    className: "bg-success/10 text-success-subtle-foreground",
  },
  funded: {
    label: "Funded",
    className: "bg-success/10 text-success-subtle-foreground",
  },
};

function StageBadge({ stage }: { stage: string | null }) {
  const config = stage ? STAGE_CONFIG[stage] : null;
  if (!config) {
    return (
      <Badge variant="secondary" data-testid={`badge-stage-unknown`}>
        Unknown
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className={config.className} data-testid={`badge-stage-${stage}`}>
      {config.label}
    </Badge>
  );
}

function StageProgress({ currentStage }: { currentStage: string | null }) {
  const currentIndex = currentStage
    ? PIPELINE_STAGES.indexOf(currentStage as (typeof PIPELINE_STAGES)[number])
    : -1;

  return (
    <div className="flex items-center gap-1" data-testid="stage-progress">
      {PIPELINE_STAGES.map((stage, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <div
            key={stage}
            className={`h-1.5 flex-1 rounded-full ${
              isCompleted
                ? "bg-primary"
                : isCurrent
                  ? "bg-primary/60"
                  : "bg-muted"
            }`}
            title={STAGE_CONFIG[stage]?.label || stage}
            data-testid={`progress-segment-${stage}`}
          />
        );
      })}
    </div>
  );
}



function PipelineCard({ item }: { item: PipelineItem }) {
  return (
    <Card className="hover-elevate" data-testid={`card-pipeline-${item.id}`}>
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-semibold text-foreground" data-testid={`text-borrower-${item.id}`}>
                {item.borrowerName || "Unnamed Borrower"}
              </h3>
              <StageBadge stage={item.currentStage} />
            </div>

            {item.propertyAddress && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                <MapPin className="h-3 w-3 shrink-0" />
                <span data-testid={`text-address-${item.id}`}>{item.propertyAddress}</span>
              </div>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              {item.loanAmount && (
                <span className="flex items-center gap-1" data-testid={`text-amount-${item.id}`}>
                  <DollarSign className="h-3 w-3" />
                  {formatCurrency(item.loanAmount)}
                </span>
              )}
              {item.estimatedCloseDate && (
                <span className="flex items-center gap-1" data-testid={`text-close-date-${item.id}`}>
                  <Calendar className="h-3 w-3" />
                  Est. Close: {format(new Date(item.estimatedCloseDate), "MMM d, yyyy")}
                </span>
              )}
              <span className="flex items-center gap-1" data-testid={`text-updated-${item.id}`}>
                <Clock className="h-3 w-3" />
                Updated: {format(new Date(item.lastUpdatedAt), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <StageProgress currentStage={item.currentStage} />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {item.lastMilestone && (
            <div className="flex items-start gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Last Milestone</span>
                <p className="text-foreground font-medium" data-testid={`text-milestone-${item.id}`}>
                  {item.lastMilestone}
                </p>
              </div>
            </div>
          )}
          {item.nextStep && (
            <div className="flex items-start gap-2 text-xs">
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <span className="text-muted-foreground">Next Step</span>
                <p className="text-foreground font-medium" data-testid={`text-next-step-${item.id}`}>
                  {item.nextStep}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" data-testid="pipeline-loading">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-3 w-48" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-1.5 w-full" />
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AgentPipeline() {
  const {
    data: pipeline = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<PipelineItem[]>({
    queryKey: ["/api/agent-pipeline"],
  });

  return (
    <PageShell width="content">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-pipeline-title">
              Client Pipeline
            </h1>
            <p className="text-sm text-muted-foreground">
              Track your referred clients through the loan process in real time.
            </p>
          </div>
        </div>
      </div>

      {!isLoading && pipeline.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground" data-testid="text-pipeline-count">
            {pipeline.length} client{pipeline.length !== 1 ? "s" : ""} in pipeline
          </p>
        </div>
      )}

      {/* Error before empty: "No referred clients yet" would otherwise tell an
          agent their referrals produced nothing when the API simply failed. */}
      {isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => void refetch()}
          title="We couldn't load your pipeline"
          data-testid="agent-pipeline-error"
        />
      ) : isLoading ? (
        <LoadingSkeleton />
      ) : pipeline.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No referred clients in the pipeline yet"
          description="Share your co-branded referral link with clients to start tracking their loan progress here."
          data-testid="card-empty-pipeline"
          action={
            <Button variant="outline" size="sm" className="touch-target" asChild data-testid="button-go-cobranding">
              <Link href="/co-branding">
                <FileText className="mr-1 h-4 w-4" />
                Set Up Co-Branding
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3" data-testid="pipeline-list">
          {pipeline.map((item) => (
            <PipelineCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
