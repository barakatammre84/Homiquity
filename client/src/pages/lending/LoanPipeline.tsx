import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { IncomeSummaryCard } from "@/components/borrower/IncomeSummaryCard";
import { loanApplicationKeys } from "@/lib/queryClient";
import { SETTLED_CONDITION_STATUSES, type LoanCondition, type Document, type ApplicationProperty, type LoanOption, type LoanApplication } from "@shared/schema";
import { Calendar } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { getStageIndex } from "./loanPipeline/stageOrder";
import { StageTimeline } from "./loanPipeline/StageTimeline";
import { PropertyManagementCard } from "./loanPipeline/PropertyManagementCard";
import { PipelineStatsCards } from "./loanPipeline/PipelineStatsCards";
import { BlockersCard, NextStepsCard, OutstandingConditionsCard, ClearedConditionsCard } from "./loanPipeline/ConditionsCards";
import { LoanSummaryCard, NeedHelpCard } from "./loanPipeline/LoanSummarySection";

interface PipelineData {
  progress: {
    stageProgress: number;
    documentsComplete: number;
    documentsTotal: number;
    conditionsCleared: number;
    conditionsTotal: number;
    readyForNextStage: boolean;
    blockers: string[];
    nextSteps: string[];
  };
  summary: {
    applicationId: string;
    currentStage: string;
    priority: "urgent" | "high" | "normal";
    daysInPipeline: number;
    estimatedClosingDays: number;
    completionPercentage: number;
    documentsRequired: number;
    documentsReceived: number;
    conditionsTotal: number;
    conditionsCleared: number;
    lastActivityAt: Date;
    assignedLO: string | null;
    targetCloseDate: Date | null;
  };
  milestones: Record<string, Date | null>;
  conditions: LoanCondition[];
}

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userId?: string;
}

interface ApplicationData {
  application: LoanApplication;
  options: LoanOption[];
  documents: Document[];
  activities: ActivityItem[];
}

export default function LoanPipeline() {
  const params = useParams();
  const applicationId = params.id as string;
  const { isLoading: authLoading } = useAuth();

  const {
    data: appData,
    isLoading: appLoading,
    isError: appIsError,
    error: appErrorObj,
    refetch: refetchApp,
  } = useQuery<ApplicationData>({
    queryKey: loanApplicationKeys.detail(applicationId),
    enabled: !!applicationId && !authLoading,
  });

  const {
    data: pipelineData,
    isLoading: pipelineLoading,
    isError: pipelineIsError,
    error: pipelineErrorObj,
    refetch: refetchPipeline,
  } = useQuery<PipelineData>({
    queryKey: loanApplicationKeys.pipeline(applicationId),
    enabled: !!applicationId && !authLoading,
  });

  const { data: applicationProperties = [] } = useQuery<ApplicationProperty[]>({
    queryKey: loanApplicationKeys.properties(applicationId),
    enabled: !!applicationId && !authLoading,
  });

  const isLoading = authLoading || appLoading || pipelineLoading;

  if (isLoading) {
    return (
      <PageShell width="wide" contentClassName="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </PageShell>
    );
  }

  // A server failure used to fall through to the "Application Not Found" card,
  // masking the error as a missing application — show an honest error + retry (ux-01).
  if (appIsError || pipelineIsError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <QueryErrorState
            error={appErrorObj ?? pipelineErrorObj}
            onRetry={() => {
              void refetchApp();
              void refetchPipeline();
            }}
            title="We couldn't load your loan progress"
            data-testid="pipeline-error"
          />
        </div>
      </div>
    );
  }

  const application = appData?.application;
  const pipeline = pipelineData;

  if (!application) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Application Not Found</CardTitle>
            <CardDescription>We couldn't find this loan application.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/dashboard">
              <Button data-testid="button-back-dashboard">Back to Dashboard</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const currentStage = pipeline?.summary?.currentStage || application.status || "application";
  const currentStageIndex = getStageIndex(currentStage);
  const defaultProgress = {
    stageProgress: 0,
    documentsComplete: 0,
    documentsTotal: 0,
    conditionsCleared: 0,
    conditionsTotal: 0,
    readyForNextStage: false,
    blockers: [] as string[],
    nextSteps: [] as string[],
  };
  const progress = { ...defaultProgress, ...pipeline?.progress };
  const summary = pipeline?.summary || {
    daysInPipeline: 0,
    estimatedClosingDays: 21,
    completionPercentage: 0,
  };

  // Open/settled must partition the vocabulary — a hand-rolled "cleared or
  // waived" pair drops "not_applicable" conditions from both buckets.
  const outstandingConditions = (pipeline?.conditions || []).filter(
    c => !(SETTLED_CONDITION_STATUSES as readonly string[]).includes(c.status)
  );
  const clearedConditions = (pipeline?.conditions || []).filter(
    c => (SETTLED_CONDITION_STATUSES as readonly string[]).includes(c.status)
  );

  return (
    <PageShell
      width="wide"
      title="Loan Progress"
      subtitle="Track your mortgage application every step of the way"
      titleTestId="text-page-title"
      headerAction={
        <div className="flex items-center gap-2">
          {summary.estimatedClosingDays > 0 && (
            <Badge variant="secondary" className="gap-1" data-testid="badge-est-close">
              <Calendar className="h-3 w-3" />
              Est. {summary.estimatedClosingDays} days to close
            </Badge>
          )}
        </div>
      }
      contentClassName="space-y-6"
    >
      <StageTimeline currentStage={currentStage} currentStageIndex={currentStageIndex} />

      <PropertyManagementCard
        applicationId={applicationId}
        application={application}
        properties={applicationProperties}
      />

      <PipelineStatsCards
        documentsComplete={progress.documentsComplete}
        documentsTotal={progress.documentsTotal}
        conditionsCleared={progress.conditionsCleared}
        conditionsTotal={progress.conditionsTotal}
        daysInPipeline={summary.daysInPipeline}
        estimatedClosingDays={summary.estimatedClosingDays}
      />

      {/* Income transparency: server-gated — the verified breakdown
          post-decision, the educational analyzing state before it. */}
      {applicationId && <IncomeSummaryCard applicationId={applicationId} />}

      <BlockersCard blockers={progress.blockers} />
      <NextStepsCard nextSteps={progress.nextSteps} hasBlockers={progress.blockers.length > 0} />
      <OutstandingConditionsCard conditions={outstandingConditions} />
      <ClearedConditionsCard conditions={clearedConditions} />
      <LoanSummaryCard application={application} />
      <NeedHelpCard />
    </PageShell>
  );
}
