import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation} from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest } from "@/lib/queryClient";
import { PresalesDisclaimer } from "@/components/PresalesDisclaimer";
import { PageShell } from "@/components/PageShell";
import { SEOHead } from "@/components/SEOHead";
import { PRELAUNCH_GATED } from "@/lib/prelaunch";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import {
  Home,
  DollarSign,
  Wallet,
  ArrowRight,
  PiggyBank,
  Landmark,
  Sparkles,
} from "lucide-react";

interface DownPaymentInputs {
  homePrice: number;
  downPaymentPercent: number;
  closingCostPercent: number;
}

interface DownPaymentResults {
  downPayment: number;
  closingCosts: number;
  loanAmount: number;
  cashNeeded: number;
  pmiRequired: boolean;
}

const defaultInputs: DownPaymentInputs = {
  homePrice: 400000,
  downPaymentPercent: 20,
  closingCostPercent: 3,
};

/** Common down-payment tiers shoppers compare, with the program each maps to. */
const TIERS = [
  { percent: 3, label: "3% — Conventional 97" },
  { percent: 3.5, label: "3.5% — FHA" },
  { percent: 5, label: "5% — Conventional" },
  { percent: 10, label: "10% — Conventional" },
  { percent: 20, label: "20% — No PMI" },
];

function calculate(inputs: DownPaymentInputs): DownPaymentResults {
  const { homePrice, downPaymentPercent, closingCostPercent } = inputs;
  const price = Math.max(0, homePrice);
  const downPayment = price * (downPaymentPercent / 100);
  const closingCosts = price * (closingCostPercent / 100);
  const loanAmount = price - downPayment;
  const cashNeeded = downPayment + closingCosts;
  return {
    downPayment,
    closingCosts,
    loanAmount,
    cashNeeded,
    pmiRequired: downPaymentPercent < 20,
  };
}

export default function DownPaymentCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [inputs, setInputs] = useState<DownPaymentInputs>(defaultInputs);

  usePageView("/calculators/down-payment");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculate(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/down-payment", { type: "down_payment" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: DownPaymentInputs; results: DownPaymentResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "down_payment",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your down payment plan has been saved to your profile." });
      // No calculatorResultKeys.all() invalidation: POST /api/calculator-results
      // saves the result, but no client surface QUERIES the saved-results list, so
      // the invalidation matched nothing (guard:querykeys reachability). Re-add it
      // here when a "my saved calculations" view lands.
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save results. Please try again.", variant: "destructive" });
    },
  });

  const handleSave = () => saveResultsMutation.mutate({ inputs, results });

  const handleStartPreApproval = () => {
    if (user) handleSave();
    navigate(PRELAUNCH_GATED ? "/" : "/apply");
  };

  const updateInput = (field: keyof DownPaymentInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <SEOHead
        title="Down Payment Calculator — How Much Cash Do You Need to Buy?"
        description="Free down payment calculator. Enter a home price to see your down payment, estimated closing costs, and the total cash you'll need at the table — plus how much you'd need at 3%, 5%, 10%, and 20% down."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Down Payment Calculator
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Learn how much cash you need to buy the home you have in mind.
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  The Home
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="homePrice">Home Price</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="homePrice"
                      type="number"
                      value={inputs.homePrice}
                      onChange={(e) => updateInput("homePrice", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-home-price"
                    />
                  </div>
                </div>
                <div>
                  <Label>
                    Down Payment: {inputs.downPaymentPercent}% ({formatCurrency(results.downPayment)})
                  </Label>
                  <Slider
                    value={[inputs.downPaymentPercent]}
                    onValueChange={([v]) => updateInput("downPaymentPercent", v)}
                    min={0}
                    max={50}
                    step={0.5}
                    className="mt-2"
                    data-testid="slider-down-payment"
                  />
                  {results.pmiRequired && (
                    <p className="mt-1 text-sm text-warning-subtle-foreground">
                      PMI typically required below 20% down
                    </p>
                  )}
                </div>
                <div>
                  <Label>Estimated Closing Costs: {inputs.closingCostPercent}%</Label>
                  <Slider
                    value={[inputs.closingCostPercent]}
                    onValueChange={([v]) => updateInput("closingCostPercent", v)}
                    min={0}
                    max={6}
                    step={0.5}
                    className="mt-2"
                    data-testid="slider-closing-costs"
                  />
                  <p className="mt-1 text-sm text-muted-foreground">
                    Closing costs usually run 2–5% of the price.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5" />
                  Short on the down payment?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  You may qualify for down payment assistance — grants and low-interest loans
                  that reduce the cash you need up front.
                </p>
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => navigate("/down-payment-wizard")}
                  data-testid="button-dpa-wizard"
                >
                  Find Assistance Programs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Total Cash You'll Need
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-cash-needed">
                    {formatCurrency(results.cashNeeded)}
                  </p>
                  <p className="mt-2 text-muted-foreground">at closing</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  Cash Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Down Payment</span>
                    <span className="font-medium" data-testid="text-down-payment">
                      {formatCurrency(results.downPayment)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Closing Costs</span>
                    <span className="font-medium" data-testid="text-closing-costs">
                      {formatCurrency(results.closingCosts)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-medium">Loan Amount</span>
                    <span className="font-bold" data-testid="text-loan-amount">
                      {formatCurrency(results.loanAmount)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Down Payment by Program
                </CardTitle>
                <CardDescription>What you'd put down on a {formatCurrency(inputs.homePrice)} home</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2" data-testid="table-tiers">
                  {TIERS.map((tier) => (
                    <button
                      key={tier.percent}
                      onClick={() => updateInput("downPaymentPercent", tier.percent)}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
                      data-testid={`tier-${tier.percent}`}
                    >
                      <span className="text-muted-foreground">{tier.label}</span>
                      <span className="font-medium tabular-nums">
                        {formatCurrency(inputs.homePrice * (tier.percent / 100))}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Tap a tier to load it above.</p>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={handleStartPreApproval} data-testid="button-start-preapproval">
              {PRELAUNCH_GATED ? "Join the Waitlist" : "Get Pre-Approved Now"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

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

            <ConversionCTA context="calculator" purchasePrice={String(inputs.homePrice)} />
          </div>
        </div>
      </PageShell>
    </>
  );
}
