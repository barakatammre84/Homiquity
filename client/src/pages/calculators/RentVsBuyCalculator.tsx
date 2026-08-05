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
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { calculateResults } from "./rentVsBuy/calculate";
import { defaultInputs, type CalculatorInputs, type CalculatorResults } from "./rentVsBuy/types";
import { InputsPanel } from "./rentVsBuy/InputsPanel";
import { ResultsPanel } from "./rentVsBuy/ResultsPanel";

export default function RentVsBuyCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<CalculatorInputs>(defaultInputs);

  usePageView("/calculators/rent-vs-buy");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculateResults(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/rent-vs-buy", { type: "rent_vs_buy" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: CalculatorInputs; results: CalculatorResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "rent_vs_buy",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({
        title: "Results Saved",
        description: "Your calculator results have been saved to your profile.",
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

  const handleStartPreApproval = () => {
    if (user) {
      saveResultsMutation.mutate({ inputs, results });
    }
    navigate(PRELAUNCH_GATED ? "/" : "/apply");
  };

  const updateInput = (field: keyof CalculatorInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Rent vs. Buy Calculator — Compare the True Cost of Renting and Owning"
        description="Free rent vs. buy calculator. Compare monthly costs, equity built, and long-term net worth between renting and owning to see which makes sense for you."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Rent vs. Buy Calculator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Compare the costs of renting versus buying to make an informed decision
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-2">
          <InputsPanel inputs={inputs} onChange={updateInput} />

          <div className="space-y-6">
            <ResultsPanel inputs={inputs} results={results} />

            <Button
              size="lg"
              className="w-full"
              onClick={handleStartPreApproval}
              data-testid="button-start-preapproval"
            >
              {PRELAUNCH_GATED ? (
                <>
                  Join the Waitlist
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : results.recommendation === "buy" ? (
                <>
                  Get Pre-Approved Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  Explore Your Options
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            {user && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => saveResultsMutation.mutate({ inputs, results })}
                disabled={saveResultsMutation.isPending}
                data-testid="button-save-results"
              >
                Save Results to My Profile
              </Button>
            )}
          </div>
        </div>
      </PageShell>
    </div>
  );
}
