import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/PageShell";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { SEOHead } from "@/components/SEOHead";
import { QueryErrorState } from "@/components/ui/query-boundary";
import { RentCard } from "./rentToOwnReadiness/RentCard";
import { SituationCard } from "./rentToOwnReadiness/SituationCard";
import { AssumptionsCard } from "./rentToOwnReadiness/AssumptionsCard";
import { ResultsSidebar } from "./rentToOwnReadiness/ResultsSidebar";
import { PaymentBreakdownCard } from "./rentToOwnReadiness/PaymentBreakdownCard";
import { ReadinessGapCard } from "./rentToOwnReadiness/ReadinessGapCard";
import { CreditTierTable } from "./rentToOwnReadiness/CreditTierTable";
import { computeTierResult, defaultInputs, type CreditTiersResponse, type RentInputs } from "./rentToOwnReadiness/types";

export default function RentToOwnReadiness() {
  const [inputs, setInputs] = useState<RentInputs>(defaultInputs);

  usePageView("/calculators/rent-to-own");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const {
    data: tierData,
    isLoading: tiersLoading,
    isError: tiersError,
    error: tiersErrorObj,
    refetch: refetchTiers,
  } = useQuery<CreditTiersResponse>({
    queryKey: ["/api/calculators/credit-tiers"],
  });

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/rent-to-own", { type: "rent_to_own" });
    }
  }, [trackActivity]);

  const tiers = tierData?.tiers ?? [];

  const activeTier = useMemo(() => {
    if (tiers.length === 0) return undefined;
    return (
      tiers.find((t) => inputs.creditScore >= t.minScore && inputs.creditScore <= t.maxScore) ??
      tiers[tiers.length - 1]
    );
  }, [tiers, inputs.creditScore]);

  const primary = useMemo(() => {
    if (!activeTier) return undefined;
    return computeTierResult(inputs.monthlyRent, activeTier, inputs);
  }, [activeTier, inputs]);

  const updateInput = (field: keyof RentInputs, value: number | string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <SEOHead
        title="Rent-to-Own Readiness Calculator"
        description="See what home price your current rent could cover, the credit and down payment you'd need, and a clear plan to go from renting to owning. No login required."
        canonical="/calculators/rent-to-own"
      />
      <PageShell width="wide">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Turn Your Rent Into a Mortgage
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Your rent is already a monthly housing payment. See what home price it could cover, what
            you'd need to qualify, and your clearest path from renting to owning.
          </p>
        </div>

        {/* Before the calculator grid: a failed credit-tiers load leaves `tiers`
            at its `?? []` default, which the sidebar would otherwise show as an
            endless "Calculating..." spinner instead of an honest failure. */}
        {tiersError && (
          <QueryErrorState
            error={tiersErrorObj}
            onRetry={() => void refetchTiers()}
            title="We couldn't load current pricing"
            className="mb-8"
            data-testid="rent-to-own-error"
          />
        )}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
          {/* Inputs */}
          <div className="lg:col-span-3 space-y-6">
            <RentCard monthlyRent={inputs.monthlyRent} onChange={(value) => updateInput("monthlyRent", value)} />

            <SituationCard inputs={inputs} updateInput={updateInput} />

            <AssumptionsCard inputs={inputs} updateInput={updateInput} />
          </div>

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            <ResultsSidebar inputs={inputs} primary={primary} loading={tiersLoading} />

            {primary && <PaymentBreakdownCard primary={primary} />}
          </div>
        </div>

        {/* Readiness gap + credit tiers (full width) */}
        {primary && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ReadinessGapCard
              primary={primary}
              tiers={tiers}
              downPaymentSaved={inputs.downPaymentSaved}
              creditScore={inputs.creditScore}
            />

            <CreditTierTable tiers={tiers} inputs={inputs} activeTierId={activeTier?.id} />
          </div>
        )}
      </PageShell>
    </>
  );
}
