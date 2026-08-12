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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  calculateResults,
  defaultInputs,
  type CalculatorInputs,
  type CalculatorResults,
} from "@/lib/rentVsBuyEstimate";
import {
  Home,
  DollarSign,
  TrendingUp,
  Calculator,
  ArrowRight,
  CheckCircle2,
  Building,
  Calendar,
} from "lucide-react";

export default function RentVsBuyCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
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
      // No calculatorResultKeys.all() invalidation: POST /api/calculator-results
      // saves the result, but no client surface QUERIES the saved-results list, so
      // the invalidation matched nothing (guard:querykeys reachability). Re-add it
      // here when a "my saved calculations" view lands.
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Renting Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="monthlyRent">Monthly Rent</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="monthlyRent"
                      type="number"
                      value={inputs.monthlyRent}
                      onChange={(e) => updateInput("monthlyRent", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-monthly-rent"
                    />
                  </div>
                </div>
                <div>
                  <Label>Annual Rent Increase: {inputs.annualRentIncrease}%</Label>
                  <Slider
                    value={[inputs.annualRentIncrease]}
                    onValueChange={([v]) => updateInput("annualRentIncrease", v)}
                    min={0}
                    max={10}
                    step={0.5}
                    className="mt-2"
                    data-testid="slider-rent-increase"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Home Purchase Details
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
                    Down Payment: {inputs.downPaymentPercent}% (
                    {formatCurrency((inputs.homePrice * inputs.downPaymentPercent) / 100)})
                  </Label>
                  <Slider
                    value={[inputs.downPaymentPercent]}
                    onValueChange={([v]) => updateInput("downPaymentPercent", v)}
                    min={3}
                    max={30}
                    step={1}
                    className="mt-2"
                    data-testid="slider-down-payment"
                  />
                </div>
                <div>
                  <Label>Interest Rate: {inputs.interestRate}%</Label>
                  <Slider
                    value={[inputs.interestRate]}
                    onValueChange={([v]) => updateInput("interestRate", v)}
                    min={3}
                    max={10}
                    step={0.125}
                    className="mt-2"
                    data-testid="slider-interest-rate"
                  />
                </div>
                <div>
                  <Label htmlFor="hoaMonthly">Monthly HOA Fees</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="hoaMonthly"
                      type="number"
                      value={inputs.hoaMonthly}
                      onChange={(e) => updateInput("hoaMonthly", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-hoa"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Timeline & Assumptions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Years You Plan to Stay: {inputs.yearsToStay} years</Label>
                  <Slider
                    value={[inputs.yearsToStay]}
                    onValueChange={([v]) => updateInput("yearsToStay", v)}
                    min={1}
                    max={30}
                    step={1}
                    className="mt-2"
                    data-testid="slider-years-stay"
                  />
                </div>
                <div>
                  <Label>Annual Home Appreciation: {inputs.annualAppreciation}%</Label>
                  <Slider
                    value={[inputs.annualAppreciation]}
                    onValueChange={([v]) => updateInput("annualAppreciation", v)}
                    min={-5}
                    max={10}
                    step={0.5}
                    className="mt-2"
                    data-testid="slider-appreciation"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              className={`border-2 ${
                results.recommendation === "buy"
                  ? "border-border bg-success-subtle"
                  : results.recommendation === "rent"
                  ? "border-border bg-info-subtle"
                  : "border-muted"
              }`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Recommendation
                  </span>
                  {results.recommendation !== "neutral" && (
                    <CheckCircle2
                      className={`h-6 w-6 ${
                        results.recommendation === "buy" ? "text-success-subtle-foreground" : "text-info"
                      }`}
                    />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-recommendation">
                    {results.recommendation === "buy"
                      ? "Buying Makes Sense!"
                      : results.recommendation === "rent"
                      ? "Renting is Better For Now"
                      : "It's a Close Call"}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    Based on a {inputs.yearsToStay}-year timeline
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <div className="flex items-center gap-2">
                      <Building className="h-5 w-5 text-info" />
                      <span>Monthly Rent</span>
                    </div>
                    <span className="text-xl font-bold" data-testid="text-monthly-rent">
                      {formatCurrency(inputs.monthlyRent)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-success-subtle-foreground" />
                      <span>Monthly Ownership</span>
                    </div>
                    <span className="text-xl font-bold" data-testid="text-monthly-ownership">
                      {formatCurrency(results.totalMonthlyOwnership)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>
                  {inputs.yearsToStay}-Year Cost Comparison
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Total Rent Paid</span>
                      <span className="font-medium" data-testid="text-total-rent">
                        {formatCurrency(results.totalRentCost)}
                      </span>
                    </div>
                    <div className="mt-1 h-3 rounded-full bg-info-subtle">
                      <div
                        className="h-3 rounded-full bg-info"
                        style={{
                          width: `${Math.min(
                            100,
                            (results.netCostRenting /
                              Math.max(results.netCostRenting, results.netCostBuying)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Net cost: {formatCurrency(results.netCostRenting)}
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span>Total Ownership Cost</span>
                      <span className="font-medium" data-testid="text-total-ownership">
                        {formatCurrency(results.totalOwnershipCost)}
                      </span>
                    </div>
                    <div className="mt-1 h-3 rounded-full bg-success-subtle">
                      <div
                        className="h-3 rounded-full bg-success"
                        style={{
                          width: `${Math.min(
                            100,
                            (results.netCostBuying /
                              Math.max(results.netCostRenting, results.netCostBuying)) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Net cost (after equity): {formatCurrency(results.netCostBuying)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Wealth Building
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Home Equity After {inputs.yearsToStay} Years</span>
                    <span className="font-bold text-success-subtle-foreground" data-testid="text-home-equity">
                      {formatCurrency(results.homeEquity)}
                    </span>
                  </div>
                  {results.breakEvenYears > 0 && (
                    <div className="flex justify-between">
                      <span>Break-Even Point</span>
                      <span className="font-medium" data-testid="text-break-even">
                        ~{results.breakEvenYears} years
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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
