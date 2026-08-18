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
import { formatCurrency, formatDuration } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import { monthlyPrincipalAndInterest } from "@shared/lib/amortization";
import {
  DollarSign,
  Calculator,
  ArrowRight,
  Percent,
  Zap,
  Clock,
  TrendingDown,
} from "lucide-react";

interface PayoffInputs {
  currentBalance: number;
  interestRate: number;
  remainingTermYears: number;
  extraMonthly: number;
  oneTimeExtra: number;
  biweekly: boolean;
}

interface PayoffResults {
  basePayment: number;
  baselineMonths: number;
  baselineInterest: number;
  acceleratedMonths: number;
  acceleratedInterest: number;
  monthsSaved: number;
  interestSaved: number;
}

const defaultInputs: PayoffInputs = {
  currentBalance: 280000,
  interestRate: 6.5,
  remainingTermYears: 27,
  extraMonthly: 200,
  oneTimeExtra: 0,
  biweekly: false,
};

/** Standard fully-amortizing monthly principal-and-interest payment. */
const monthlyPI = monthlyPrincipalAndInterest;

/**
 * Simulate payoff month-by-month.
 * - basePayment: the scheduled monthly P&I.
 * - extraMonthly: applied to every month's principal.
 * - oneTimeExtra: applied once, in month 1.
 * - biweekly: pay half the monthly payment every two weeks (26 half-payments =
 *   13 full payments a year), approximated as one extra scheduled payment spread
 *   across the year (basePayment / 12 added each month).
 */
function simulate(
  balanceStart: number,
  annualRatePct: number,
  basePayment: number,
  extraMonthly: number,
  oneTimeExtra: number,
  biweekly: boolean,
): { months: number; interest: number } {
  const r = annualRatePct / 100 / 12;
  let balance = balanceStart;
  let totalInterest = 0;
  let months = 0;
  const biweeklyExtra = biweekly ? basePayment / 12 : 0;

  while (balance > 0.01 && months < 1200) {
    const interest = balance * r;
    let principal = basePayment + extraMonthly + biweeklyExtra - interest;
    if (months === 0) principal += oneTimeExtra;
    if (principal <= 0) return { months: Infinity, interest: Infinity };
    principal = Math.min(principal, balance);
    balance -= principal;
    totalInterest += interest;
    months += 1;
  }
  return { months, interest: totalInterest };
}

function calculate(inputs: PayoffInputs): PayoffResults {
  const { currentBalance, interestRate, remainingTermYears, extraMonthly, oneTimeExtra, biweekly } = inputs;
  const scheduledMonths = Math.max(1, Math.round(remainingTermYears * 12));
  const basePayment = monthlyPI(currentBalance, interestRate, scheduledMonths);

  const baseline = simulate(currentBalance, interestRate, basePayment, 0, 0, false);
  const accelerated = simulate(currentBalance, interestRate, basePayment, extraMonthly, oneTimeExtra, biweekly);

  const baselineMonths = baseline.months === Infinity ? scheduledMonths : baseline.months;
  const baselineInterest = baseline.interest === Infinity ? 0 : baseline.interest;
  const acceleratedMonths = accelerated.months === Infinity ? baselineMonths : accelerated.months;
  const acceleratedInterest = accelerated.interest === Infinity ? baselineInterest : accelerated.interest;

  return {
    basePayment,
    baselineMonths,
    baselineInterest,
    acceleratedMonths,
    acceleratedInterest,
    monthsSaved: Math.max(0, baselineMonths - acceleratedMonths),
    interestSaved: Math.max(0, baselineInterest - acceleratedInterest),
  };
}

export default function MortgagePayoffCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
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

  const handleRefinance = () => {
    if (user) handleSave();
    navigate(PRELAUNCH_GATED ? "/" : "/refinance");
  };

  const updateInput = <K extends keyof PayoffInputs>(field: K, value: PayoffInputs[K]) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const progressPct = results.baselineMonths > 0
    ? Math.min(100, (results.acceleratedMonths / results.baselineMonths) * 100)
    : 100;

  return (
    <>
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

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Your Current Loan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="currentBalance">Current Balance</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="currentBalance"
                      type="number"
                      value={inputs.currentBalance}
                      onChange={(e) => updateInput("currentBalance", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-current-balance"
                    />
                  </div>
                </div>
                <div>
                  <Label>Interest Rate: {inputs.interestRate}%</Label>
                  <Slider
                    value={[inputs.interestRate]}
                    onValueChange={([v]) => updateInput("interestRate", v)}
                    min={2}
                    max={12}
                    step={0.125}
                    className="mt-2"
                    data-testid="slider-interest-rate"
                  />
                </div>
                <div>
                  <Label>Years Remaining: {inputs.remainingTermYears}</Label>
                  <Slider
                    value={[inputs.remainingTermYears]}
                    onValueChange={([v]) => updateInput("remainingTermYears", v)}
                    min={1}
                    max={30}
                    step={1}
                    className="mt-2"
                    data-testid="slider-remaining-term"
                  />
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm">
                  <span className="text-muted-foreground">Current scheduled payment (P&amp;I): </span>
                  <span className="font-medium" data-testid="text-base-payment">
                    {formatCurrency(results.basePayment)}/mo
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Your Payoff Strategy
                </CardTitle>
                <CardDescription>Add any combination below</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="extraMonthly">Extra Monthly Payment</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="extraMonthly"
                      type="number"
                      value={inputs.extraMonthly}
                      onChange={(e) => updateInput("extraMonthly", Math.max(0, Number(e.target.value)))}
                      className="pl-9"
                      data-testid="input-extra-monthly"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="oneTimeExtra">One-Time Extra Payment (now)</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="oneTimeExtra"
                      type="number"
                      value={inputs.oneTimeExtra}
                      onChange={(e) => updateInput("oneTimeExtra", Math.max(0, Number(e.target.value)))}
                      className="pl-9"
                      data-testid="input-one-time-extra"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="biweekly" className="cursor-pointer">Biweekly payments</Label>
                    <p className="text-xs text-muted-foreground">
                      Half-payments every two weeks = one extra payment a year
                    </p>
                  </div>
                  <Switch
                    id="biweekly"
                    checked={inputs.biweekly}
                    onCheckedChange={(v) => updateInput("biweekly", v)}
                    data-testid="switch-biweekly"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Interest You'd Save
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-interest-saved">
                    {formatCurrency(results.interestSaved)}
                  </p>
                  <p className="mt-2 text-muted-foreground" data-testid="text-time-saved">
                    and pay off {formatDuration(results.monthsSaved)} sooner
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Payoff Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">Current plan</span>
                      <span className="font-medium" data-testid="text-baseline-time">
                        {formatDuration(results.baselineMonths)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-chart-4" style={{ width: "100%" }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(results.baselineInterest)} total interest
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="text-muted-foreground">With your strategy</span>
                      <span className="font-medium" data-testid="text-accelerated-time">
                        {formatDuration(results.acceleratedMonths)}
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-chart-1" style={{ width: `${progressPct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(results.acceleratedInterest)} total interest
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

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
    </>
  );
}
