import { useQuery } from "@tanstack/react-query";
import { queryClient, dashboardKeys } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import type { LoanApplication, Verification } from "@shared/schema";
import { useActiveApplication } from "@/hooks/useActiveApplication";
import { PageShell } from "@/components/PageShell";
import {
  verificationProgress,
  verificationStatus,
  verificationTypes,
  findVerification,
} from "./verification/verificationTypes";
import { VerificationTypeCard } from "./verification/VerificationTypeCard";
import {
  IdentityCrossLinkCard,
  NoApplicationCard,
  PlaidUnconfiguredCard,
  ProgressCard,
  WhyVerifyCard,
} from "./verification/VerificationCards";

interface DashboardData {
  applications: LoanApplication[];
}

interface VerificationConfig {
  plaidConfigured: boolean;
  supportedVerificationTypes: string[];
}

export default function VerificationPage() {
  const { user, isLoading: authLoading } = useAuth();

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<DashboardData>({
    queryKey: dashboardKeys.root(),
    enabled: !authLoading,
  });

  const { data: configData } = useQuery<VerificationConfig>({
    queryKey: ["/api/verifications/config/status"],
    enabled: !authLoading && !!user,
  });

  const applications = dashboardData?.applications || [];
  const { activeApplication } = useActiveApplication(applications);

  const { data: verifications, refetch } = useQuery<Verification[]>({
    queryKey: ["/api/verifications/application", activeApplication?.id],
    enabled: !!activeApplication,
  });

  const handleVerificationSuccess = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: dashboardKeys.root() });
  };

  if (authLoading || dashboardLoading) {
    return (
      <PageShell width="content">
        <Skeleton className="mb-8 h-8 w-48" />
        <div className="space-y-6">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </PageShell>
    );
  }

  const progress = verificationProgress(verifications);

  return (
    <PageShell
      width="content"
      title="Verification Center"
      subtitle="Verify your employment and identity to speed up your loan approval"
      titleTestId="text-verification-title"
    >
      {!activeApplication ? (
        <NoApplicationCard />
      ) : !configData?.plaidConfigured ? (
        <PlaidUnconfiguredCard />
      ) : (
        <>
          <ProgressCard {...progress} />

          <div className="grid gap-6 md:grid-cols-2">
            {verificationTypes.map((vType) => (
              <VerificationTypeCard
                key={vType.type}
                vType={vType}
                status={verificationStatus(verifications, vType.type)}
                verification={findVerification(verifications, vType.type)}
                applicationId={activeApplication.id}
                onVerified={handleVerificationSuccess}
              />
            ))}
          </div>

          <WhyVerifyCard />
        </>
      )}

      <IdentityCrossLinkCard />
    </PageShell>
  );
}
