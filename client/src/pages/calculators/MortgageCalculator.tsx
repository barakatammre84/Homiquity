import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest, calculatorResultKeys } from "@/lib/queryClient";
import { PresalesDisclaimer } from "@/components/PresalesDisclaimer";
import { PageShell } from "@/components/PageShell";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { ArrowRight } from "lucide-react";
import {
  calculateMortgage,
  defaultInputs,
  type MortgageInputs,
  type MortgageResults,
} from "./mortgageCalculator/mortgageMath";
import {
  AdditionalCostsCard,
  LoanTermsCard,
  PropertyDetailsCard,
} from "./mortgageCalculator/InputPanels";
import {
  AmortizationPreviewCard,
  LoanSummaryCard,
  MonthlyPaymentCard,
  PaymentBreakdownCard,
} from "./mortgageCalculator/ResultsPanels";

export default function MortgageCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<MortgageInputs>(defaultInputs);

  usePageView("/calculators/mortgage");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculateMortgage(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/mortgage", { type: "mortgage" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: MortgageInputs; results: Omit<MortgageResults, 'amortizationSchedule'> }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "mortgage",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({
        title: "Results Saved",
        description: "Your mortgage calculation has been saved to your profile.",
      });
      queryClient.invalidateQueries({ queryKey: calculatorResultKeys.all() });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save results. Please try again.",
        variant: "destructive",
      });
    },
  });

  // The year-by-year schedule is derived, not an input to anything downstream —
  // it is dropped before saving rather than persisted for every calculation.
  const saveResults = () => {
    const { amortizationSchedule, ...resultsWithoutSchedule } = results;
    saveResultsMutation.mutate({ inputs, results: resultsWithoutSchedule });
  };

  const handleStartPreApproval = () => {
    if (user) saveResults();
    navigate(PRELAUNCH_GATED ? "/" : "/apply");
  };

  const updateInput = (field: keyof MortgageInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mortgage Calculator — Monthly Payment & Cost Breakdown"
        description="Free mortgage calculator. See your estimated monthly payment — principal, interest, taxes, insurance, PMI, and HOA — with an interactive amortization schedule. No sign-up required."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Mortgage Calculator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Calculate your monthly mortgage payment and see the full cost breakdown
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <PropertyDetailsCard inputs={inputs} downPayment={results.downPayment} updateInput={updateInput} />
            <LoanTermsCard inputs={inputs} updateInput={updateInput} />
            <AdditionalCostsCard inputs={inputs} updateInput={updateInput} />
          </div>

          <div className="space-y-6">
            <MonthlyPaymentCard results={results} />
            <PaymentBreakdownCard results={results} />
            <LoanSummaryCard results={results} />
            <AmortizationPreviewCard results={results} />

            <Button
              size="lg"
              className="w-full"
              onClick={handleStartPreApproval}
              data-testid="button-start-preapproval"
            >
              {PRELAUNCH_GATED ? "Join the Waitlist" : "Get Pre-Approved Now"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            {user && (
              <Button
                variant="outline"
                className="w-full"
                onClick={saveResults}
                disabled={saveResultsMutation.isPending}
                data-testid="button-save-results"
              >
                Save Results to My Profile
              </Button>
            )}

            <ConversionCTA context="calculator" purchasePrice={String(inputs.homePrice)} />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
