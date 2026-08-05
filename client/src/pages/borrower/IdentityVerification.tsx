import { useQuery } from "@tanstack/react-query";
import { queryClient, onboardingStatusKeys } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { Fingerprint, Search, Shield } from "lucide-react";
import { PageShell } from "@/components/PageShell";
import { summariseVerification, type OnboardingStatus } from "./identityVerification/types";
import { getStatusBadge } from "./identityVerification/statusPresentation";
import { KBAFlow } from "./identityVerification/KBAFlow";
import { KYCAMLStatus } from "./identityVerification/KYCAMLStatus";
import { BiometricCard, DocumentVerificationCard, SecurityNoticeCard } from "./identityVerification/StaticCards";

export default function IdentityVerification() {
  const { data: status, isLoading, isError, error, refetch } = useQuery<OnboardingStatus>({
    queryKey: onboardingStatusKeys.root(),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <PageShell width="content" contentClassName="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </PageShell>
    );
  }

  // A load failure would otherwise render every step as incomplete — showing the
  // user as fully unverified when they may have passed steps. Error + retry (ux-01).
  if (isError) {
    return (
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        <QueryErrorState
          error={error}
          onRetry={() => refetch()}
          title="We couldn't load your verification status"
          data-testid="identity-error"
        />
      </div>
    );
  }

  const kbaStatus = status?.kba;
  const kycData = status?.kyc;
  const applicationId = status?.applicationId || null;

  const { identityVerified, docsVerified, overallProgress, steps } = summariseVerification(status);

  return (
    <PageShell
      width="content"
      icon={
        <div className="p-2 bg-primary/10 rounded-lg">
          <Shield className="h-5 w-5 text-primary" />
        </div>
      }
      title="Identity Verification"
      subtitle="Secure, automated verification to protect your identity and meet regulatory requirements."
      titleTestId="text-idv-title"
    >

      <Card className="mb-6" data-testid="card-progress-overview">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-sm font-medium text-foreground">Verification Progress</span>
            <Badge variant={overallProgress === 3 ? "default" : "outline"}>
              {overallProgress} of 3 complete
            </Badge>
          </div>
          <div className="flex gap-2">
            {steps.map((step) => (
              <div key={step.id} className="flex-1" data-testid={`step-indicator-${step.id}`}>
                <div className={`h-2 rounded-full ${step.complete ? "bg-success" : "bg-muted"}`} />
                <p className={`text-xs mt-1.5 ${step.complete ? "text-success-subtle-foreground font-medium" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card data-testid="card-kba">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">Knowledge-Based Auth</CardTitle>
              </div>
              {identityVerified ? getStatusBadge("passed") : kbaStatus ? getStatusBadge(kbaStatus.status) : getStatusBadge("not_started")}
            </div>
            <CardDescription>Answer security questions to verify your identity</CardDescription>
          </CardHeader>
          <CardContent>
            <KBAFlow
              kbaStatus={kbaStatus ?? null}
              applicationId={applicationId}
              onComplete={() => queryClient.invalidateQueries({ queryKey: onboardingStatusKeys.root() })}
            />
          </CardContent>
        </Card>

        <Card data-testid="card-kyc">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">KYC / AML Screening</CardTitle>
              </div>
              {kycData ? getStatusBadge(kycData.overallStatus) : getStatusBadge("not_started")}
            </div>
            <CardDescription>Automated compliance and anti-money laundering checks</CardDescription>
          </CardHeader>
          <CardContent>
            <KYCAMLStatus kyc={kycData ?? null} applicationId={applicationId} />
          </CardContent>
        </Card>

        <DocumentVerificationCard docsVerified={docsVerified} />

        <BiometricCard />
      </div>

      <SecurityNoticeCard />

    </PageShell>
  );
}
