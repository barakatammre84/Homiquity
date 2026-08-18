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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import { calculate, defaultInputs, type AmortizationInputs } from "@/lib/amortizationEstimate";
import {
  DollarSign,
  Calculator,
  ArrowRight,
  Percent,
  Calendar,
  TrendingDown,
  Zap,
} from "lucide-react";

export default function AmortizationCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [inputs, setInputs] = useState<AmortizationInputs>(defaultInputs);

  usePageView("/calculators/amortization");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculate(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/amortization", { type: "amortization" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: AmortizationInputs; results: Record<string, number> }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "amortization",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your amortization schedule has been saved to your profile." });
      // No calculatorResultKeys.all() invalidation: POST /api/calculator-results
      // saves the result, but no client surface QUERIES the saved-results list, so
      // the invalidation matched nothing (guard:querykeys reachability). Re-add it
      // here when a "my saved calculations" view lands.
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save results. Please try again.", variant: "destructive" });
    },
  });

  const summaryResults = () => ({
    monthlyPayment: results.monthlyPayment,
    totalInterest: results.totalInterest,
    totalPaid: results.totalPaid,
    payoffMonths: results.payoffMonths,
    interestSaved: results.interestSaved,
    monthsSaved: results.monthsSaved,
  });

  const handleSave = () => saveResultsMutation.mutate({ inputs, results: summaryResults() });

  const handleStartPreApproval = () => {
    if (user) handleSave();
    navigate(PRELAUNCH_GATED ? "/" : "/apply");
  };

  const updateInput = (field: keyof AmortizationInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const maxYearInterest = Math.max(...results.yearly.map((y) => y.principal + y.interest), 1);

  return (
    <>
      <SEOHead
        title="Amortization Calculator — See Your Full Mortgage Payoff Schedule"
        description="Free amortization calculator. See how much of every mortgage payment goes to principal vs. interest, your full year-by-year payoff schedule, and how extra payments save you interest and time."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Amortization Calculator
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            See how much of each mortgage payment reduces your loan balance and how much goes to interest.
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Loan Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="loanAmount">Loan Amount</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="loanAmount"
                      type="number"
                      value={inputs.loanAmount}
                      onChange={(e) => updateInput("loanAmount", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-loan-amount"
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
                  <Label>Loan Term</Label>
                  <Select
                    value={String(inputs.loanTermYears)}
                    onValueChange={(v) => updateInput("loanTermYears", Number(v))}
                  >
                    <SelectTrigger data-testid="select-loan-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 Years</SelectItem>
                      <SelectItem value="15">15 Years</SelectItem>
                      <SelectItem value="20">20 Years</SelectItem>
                      <SelectItem value="30">30 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Pay It Off Faster
                </CardTitle>
                <CardDescription>Add an extra amount to every monthly payment</CardDescription>
              </CardHeader>
              <CardContent>
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
                {inputs.extraMonthly > 0 && results.interestSaved > 0 && (
                  <p className="mt-3 text-sm text-success-subtle-foreground" data-testid="text-savings-note">
                    You'd save {formatCurrency(results.interestSaved)} in interest and pay off{" "}
                    {formatDuration(results.monthsSaved)} sooner.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Monthly Payment (Principal & Interest)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-monthly-payment">
                    {formatCurrency(results.monthlyPayment)}
                  </p>
                  <p className="mt-2 text-muted-foreground">per month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Payoff Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Interest Paid</span>
                    <span className="font-medium text-destructive" data-testid="text-total-interest">
                      {formatCurrency(results.totalInterest)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payoff Time</span>
                    <span className="font-medium" data-testid="text-payoff-time">
                      {formatDuration(results.payoffMonths)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-medium">Total of All Payments</span>
                    <span className="font-bold" data-testid="text-total-paid">
                      {formatCurrency(results.totalPaid)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Amortization Schedule
                </CardTitle>
                <CardDescription>
                  How each payment splits between principal and interest over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="yearly">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="yearly" data-testid="tab-yearly">By Year</TabsTrigger>
                    <TabsTrigger value="monthly" data-testid="tab-monthly">First 12 Months</TabsTrigger>
                  </TabsList>

                  <TabsContent value="yearly">
                    <div className="max-h-80 overflow-y-auto pr-1">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 font-medium">Year</th>
                            <th className="py-2 text-right font-medium">Principal</th>
                            <th className="py-2 text-right font-medium">Interest</th>
                            <th className="py-2 text-right font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody data-testid="table-yearly-schedule">
                          {results.yearly.map((y) => (
                            <tr key={y.year} className="border-b last:border-0">
                              <td className="py-2">{y.year}</td>
                              <td className="py-2 text-right tabular-nums text-success-subtle-foreground">
                                {formatCurrency(y.principal)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-muted-foreground">
                                {formatCurrency(y.interest)}
                              </td>
                              <td className="py-2 text-right tabular-nums font-medium">
                                {formatCurrency(y.endingBalance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 space-y-2">
                      <p className="text-xs text-muted-foreground">Principal vs. interest each year</p>
                      {results.yearly.filter((_, i) => i % Math.ceil(results.yearly.length / 10 || 1) === 0).map((y) => (
                        <div key={y.year} className="flex items-center gap-2">
                          <span className="w-8 text-xs text-muted-foreground">Yr {y.year}</span>
                          <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
                            <div
                              className="bg-chart-1"
                              style={{ width: `${(y.principal / maxYearInterest) * 100}%` }}
                            />
                            <div
                              className="bg-chart-4"
                              style={{ width: `${(y.interest / maxYearInterest) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-chart-1" /> Principal
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-full bg-chart-4" /> Interest
                        </span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="monthly">
                    <div className="max-h-80 overflow-y-auto pr-1">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="py-2 font-medium">Mo.</th>
                            <th className="py-2 text-right font-medium">Principal</th>
                            <th className="py-2 text-right font-medium">Interest</th>
                            <th className="py-2 text-right font-medium">Balance</th>
                          </tr>
                        </thead>
                        <tbody data-testid="table-monthly-schedule">
                          {results.monthly.slice(0, 12).map((m) => (
                            <tr key={m.month} className="border-b last:border-0">
                              <td className="py-2">{m.month}</td>
                              <td className="py-2 text-right tabular-nums text-success-subtle-foreground">
                                {formatCurrency(m.principal)}
                              </td>
                              <td className="py-2 text-right tabular-nums text-muted-foreground">
                                {formatCurrency(m.interest)}
                              </td>
                              <td className="py-2 text-right tabular-nums font-medium">
                                {formatCurrency(m.balance)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
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

            <ConversionCTA context="calculator" />
          </div>
        </div>
      </PageShell>
    </>
  );
}
