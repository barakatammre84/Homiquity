import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { onboardingStatusKeys, consentKeys, loanApplicationKeys } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { Link } from "wouter";
import {
  Rocket,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Target,
} from "lucide-react";
import { PageShell } from "@/components/PageShell";
import {
  getBorrowerTypeDescription,
  getBorrowerTypeIcon,
  getBorrowerTypeLabel,
  getJourneySteps,
  summariseJourney,
  type OnboardingStatus,
} from "./onboardingJourney/journeySteps";
import { JourneyTimeline } from "./onboardingJourney/JourneyTimeline";
import { FirstTimeBuyerTips, SelfEmployedChecklist } from "./onboardingJourney/BorrowerTypeCards";
import { FeedbackForm } from "./onboardingJourney/FeedbackForm";

export default function OnboardingJourney() {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const { data: status, isLoading, isError, error, refetch } = useQuery<OnboardingStatus>({
    queryKey: onboardingStatusKeys.root(),
  });

  // Real consent status for the e_consent/credit_consent steps — these used to
  // hardcode complete: false unconditionally, so progress could never reach
  // 100% and "next step" perpetually pointed back at a step the borrower had
  // already finished (ux-07).
  const applicationId = status?.applicationId;
  const { data: eDisclosureCheck } = useQuery<{ hasConsent: boolean }>({
    queryKey: consentKeys.check(applicationId!, "e_disclosure"),
    enabled: !!applicationId,
  });
  const { data: creditSummary } = useQuery<{ hasActiveConsent: boolean }>({
    queryKey: loanApplicationKeys.credit.summary(applicationId!),
    enabled: !!applicationId,
  });

  if (isLoading) {
    return (
      <PageShell width="content" contentClassName="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-48" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </PageShell>
    );
  }

  // A server failure used to render a blank page (`if (!status) return null`) —
  // show an honest error + retry instead (ux-01).
  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <QueryErrorState
          error={error}
          onRetry={() => refetch()}
          title="We couldn't load your journey"
          data-testid="onboarding-error"
        />
      </div>
    );
  }

  if (!status) return null;

  const BorrowerIcon = getBorrowerTypeIcon(status.borrowerType);
  const steps = getJourneySteps(status, {
    eDisclosureGiven: !!eDisclosureCheck?.hasConsent,
    creditConsentGiven: !!creditSummary?.hasActiveConsent,
  });
  const { progressPercent, nextStep } = summariseJourney(steps);

  return (
    <PageShell
      width="content"
      icon={
        <div className="p-2 bg-primary/10 rounded-lg">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
      }
      title="Your Mortgage Journey"
      subtitle="Here's every step from application to closing."
      titleTestId="text-journey-title"
    >

      <Card className="mb-6" data-testid="card-borrower-profile">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <BorrowerIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" data-testid="badge-borrower-type">{getBorrowerTypeLabel(status.borrowerType)} Path</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{getBorrowerTypeDescription(status.borrowerType)}</p>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-muted-foreground">Overall Progress</span>
              <span className="text-xs font-semibold text-foreground" data-testid="text-progress-percent">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                data-testid="progress-bar"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {nextStep && (
        <Card className="mb-6 border-primary/20" data-testid="card-next-step">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Up Next</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground" data-testid="text-next-step-title">{nextStep.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{nextStep.description}</p>
              </div>
              {nextStep.href && (
                <Button size="sm" asChild data-testid="button-next-step">
                  <Link href={nextStep.href}>
                    Continue
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <JourneyTimeline steps={steps} />

      {status.borrowerType === "first_time_buyer" && <FirstTimeBuyerTips />}

      {status.borrowerType === "self_employed" && <SelfEmployedChecklist />}

      <Card data-testid="card-feedback">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Share Your Feedback</CardTitle>
          </div>
          <CardDescription>Help us improve the onboarding experience for future borrowers.</CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackSubmitted ? (
            <div className="text-center py-4" data-testid="feedback-thanks">
              <CheckCircle2 className="h-8 w-8 text-success-subtle-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">Thank you for your feedback!</p>
            </div>
          ) : (
            <FeedbackForm onSubmitted={() => setFeedbackSubmitted(true)} />
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
