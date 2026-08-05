import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest, calculatorResultKeys } from "@/lib/queryClient";
import { PresalesDisclaimer } from "@/components/PresalesDisclaimer";
import { PageShell } from "@/components/PageShell";
import { SEOHead } from "@/components/SEOHead";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import { ArrowRight, Calculator } from "lucide-react";
import { calculate, defaultInputs, type PayoffInputs, type PayoffResults } from "./mortgagePayoff/payoffMath";
import {
  CurrentLoanCard,
  InterestSavedCard,
  PayoffComparisonCard,
  StrategyCard,
} from "./mortgagePayoff/PayoffPanels";

export default function MortgagePayoffCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<PayoffInputs>(defaultInputs);

  usePageView("/calculators/payoff");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculate(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/payoff", { type: "mortgage_payoff" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: PayoffInputs; results: PayoffResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "mortgage_payoff",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your payoff plan has been saved to your profile." });
      queryClient.invalidateQueries({ queryKey: calculatorResultKeys.all() });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save results. Please try again.", variant: "destructive" });
    },
  });

  const handleSave = () => saveResultsMutation.mutate({ inputs, results });

  const handleRefinance = () => {
    if (user) handleSave();
    navigate(PRELAUNCH_GATED ? "/" : "/refinance");
  };

  const updateInput = <K extends keyof PayoffInputs>(field: K, value: PayoffInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Mortgage Payoff Calculator — Pay Off Your Home Faster"
        description="Free mortgage payoff calculator. See how extra monthly payments, a one-time lump sum, or a biweekly schedule can shorten your loan and save thousands in interest."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Mortgage Payoff Calculator
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            See how extra payments — or refinancing — could help you pay off your mortgage faster.
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <CurrentLoanCard inputs={inputs} basePayment={results.basePayment} updateInput={updateInput} />
            <StrategyCard inputs={inputs} updateInput={updateInput} />
          </div>

          <div className="space-y-6">
            <InterestSavedCard results={results} />
            <PayoffComparisonCard results={results} />

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Could a Refinance Do Even Better?
                </CardTitle>
                <CardDescription>
                  A lower rate or shorter term can accelerate payoff without a bigger check each month.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button size="lg" className="w-full" onClick={handleRefinance} data-testid="button-refinance">
                  {PRELAUNCH_GATED ? "Join the Waitlist" : "Compare Refinance Options"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {user && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSave}
                disabled={saveResultsMutation.isPending}
                data-testid="button-save-results"
              >
                Save Results to My Profile
              </Button>
            )}

            <ConversionCTA context="calculator" />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
