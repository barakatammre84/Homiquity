import { useQuery, useQueryClient } from "@tanstack/react-query";
import { loanApplicationKeys } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { ConsentGateCard } from "@/components/ConsentGateCard";
import { useParams, Link } from "wouter";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { LoanEstimateData } from "./loanEstimate/types";
import { LoanEstimateHeader } from "./loanEstimate/LoanEstimateHeader";
import { SummarySection } from "./loanEstimate/SummarySection";
import { ProjectedPaymentsCard, CostsAtClosingCard, ClosingCostDetailsCard } from "./loanEstimate/CostSections";
import { ComparisonsCard, ImportantInformationCard } from "./loanEstimate/ComparisonsSection";

export default function LoanEstimate() {
  const { id } = useParams<{ id: string }>();
  const { isLoading: authLoading } = useAuth();

  const queryClient = useQueryClient();
  const { data: le, isLoading, error } = useQuery<LoanEstimateData>({
    queryKey: loanApplicationKeys.loanEstimate(id),
    enabled: !!id && !authLoading,
    retry: (failureCount, err) =>
      !(err instanceof Error && err.message.includes("CONSENT_REQUIRED")) && failureCount < 2,
  });

  const consentRequired = error instanceof Error && error.message.includes("CONSENT_REQUIRED");

  if (isLoading || authLoading) {
    return (
      <div className="overflow-y-auto p-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <Skeleton className="h-12 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (consentRequired && id) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <ConsentGateCard
          applicationId={id}
          consentType="e_disclosure"
          onConsented={() =>
            queryClient.invalidateQueries({ queryKey: loanApplicationKeys.loanEstimate(id) })
          }
        />
      </div>
    );
  }

  if (error || !le) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Loan Estimate</CardTitle>
            <CardDescription>
              Unable to generate the loan estimate for this application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <LoanEstimateHeader applicationId={id} />

      <ScrollArea className="h-[calc(100vh-64px)]">
        <div className="p-6">
          <div className="mx-auto max-w-4xl space-y-6">
            <SummarySection le={le} />
            <ProjectedPaymentsCard le={le} />
            <CostsAtClosingCard le={le} />
            <ClosingCostDetailsCard le={le} />
            <ComparisonsCard le={le} />
            <ImportantInformationCard le={le} />
          </div>
        </div>
      </ScrollArea>
    </>
  );
}
