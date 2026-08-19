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
} from "lucide-react";

interface EquityInputs {
  homeValue: number;
  mortgageBalance: number;
  maxCltvPercent: number;
}

interface EquityResults {
  equity: number;
  equityPercent: number;
  currentLtv: number;
  borrowable: number;
  borrowableAt80: number;
}

const defaultInputs: EquityInputs = {
  homeValue: 500000,
  mortgageBalance: 300000,
  maxCltvPercent: 85,
};

function calculate(inputs: EquityInputs): EquityResults {
  const { homeValue, mortgageBalance, maxCltvPercent } = inputs;
  const value = Math.max(0, homeValue);
  const balance = Math.max(0, Math.min(mortgageBalance, value));
  const equity = value - balance;
  const equityPercent = value > 0 ? (equity / value) * 100 : 0;
  const currentLtv = value > 0 ? (balance / value) * 100 : 0;
  const borrowable = Math.max(0, value * (maxCltvPercent / 100) - balance);
  const borrowableAt80 = Math.max(0, value * 0.8 - balance);
  return { equity, equityPercent, currentLtv, borrowable, borrowableAt80 };
}

export default function HomeEquityCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [inputs, setInputs] = useState<EquityInputs>(defaultInputs);

  usePageView("/calculators/home-equity");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculate(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/home-equity", { type: "home_equity" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: EquityInputs; results: EquityResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "home_equity",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your home equity estimate has been saved to your profile." });
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

  const handleTapEquity = () => {
    if (user) handleSave();
    navigate(PRELAUNCH_GATED ? "/" : "/apply?type=heloc");
  };

  const updateInput = (field: keyof EquityInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const equityPct = Math.max(0, Math.min(100, results.equityPercent));

  return (
    <>
      <SEOHead
        title="Home Equity Calculator — How Much Equity Do You Have?"
        description="Free home equity calculator. Enter your home's value and what you still owe to see your equity, your loan-to-value, and how much you could potentially borrow with a HELOC or cash-out refinance."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Home Equity Calculator
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Learn how much cash you have in your home based on its value and what you still owe.
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Your Home
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="homeValue">Estimated Home Value</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="homeValue"
                      type="number"
                      value={inputs.homeValue}
                      onChange={(e) => updateInput("homeValue", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-home-value"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="mortgageBalance">Remaining Mortgage Balance</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="mortgageBalance"
                      type="number"
                      value={inputs.mortgageBalance}
                      onChange={(e) => updateInput("mortgageBalance", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-mortgage-balance"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Borrowing Assumptions
                </CardTitle>
                <CardDescription>
                  Lenders typically let you borrow against your home up to a combined
                  loan-to-value (CLTV) limit.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Label>Max Combined Loan-to-Value: {inputs.maxCltvPercent}%</Label>
                <Slider
                  value={[inputs.maxCltvPercent]}
                  onValueChange={([v]) => updateInput("maxCltvPercent", v)}
                  min={70}
                  max={90}
                  step={1}
                  className="mt-2"
                  data-testid="slider-max-cltv"
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  Most HELOC and cash-out programs cap out around 80–85% CLTV.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Your Home Equity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-equity">
                    {formatCurrency(results.equity)}
                  </p>
                  <p className="mt-2 text-muted-foreground" data-testid="text-equity-percent">
                    {results.equityPercent.toFixed(0)}% of your home's value
                  </p>
                </div>
                <div className="mt-6">
                  <div className="flex h-5 overflow-hidden rounded-full bg-muted" data-testid="bar-equity">
                    <div
                      className="flex items-center justify-center bg-chart-1 text-xs font-medium text-white"
                      style={{ width: `${equityPct}%` }}
                    >
                      {equityPct >= 15 ? "Equity" : ""}
                    </div>
                    <div
                      className="flex items-center justify-center bg-chart-4 text-xs font-medium text-white"
                      style={{ width: `${100 - equityPct}%` }}
                    >
                      {100 - equityPct >= 15 ? "Owed" : ""}
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>Your equity: {formatCurrency(results.equity)}</span>
                    <span>Still owed: {formatCurrency(inputs.mortgageBalance)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PiggyBank className="h-5 w-5" />
                  What You Could Tap
                </CardTitle>
                <CardDescription>Estimated cash available to borrow, subject to lender approval</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current loan-to-value</span>
                    <span className="font-medium" data-testid="text-current-ltv">
                      {results.currentLtv.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available at 80% CLTV</span>
                    <span className="font-medium" data-testid="text-borrowable-80">
                      {formatCurrency(results.borrowableAt80)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-medium">Available at {inputs.maxCltvPercent}% CLTV</span>
                    <span className="font-bold text-primary" data-testid="text-borrowable">
                      {formatCurrency(results.borrowable)}
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Estimates only. Your actual borrowing limit depends on a current appraisal,
                  your credit, income, and the lender's program guidelines.
                </p>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={handleTapEquity} data-testid="button-tap-equity">
              {PRELAUNCH_GATED ? "Join the Waitlist" : "Explore HELOC & Cash-Out Options"}
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

            <ConversionCTA context="calculator" />
          </div>
        </div>
      </PageShell>
    </>
  );
}
