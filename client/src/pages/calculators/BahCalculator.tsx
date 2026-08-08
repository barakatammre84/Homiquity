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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import { paymentFactor } from "@shared/lib/amortization";
import {
  DollarSign,
  Calculator,
  ArrowRight,
  Percent,
  Home,
  ShieldCheck,
  Star,
} from "lucide-react";

interface BahInputs {
  monthlyBah: number;
  extraContribution: number;
  interestRate: number;
  loanTermYears: number;
  propertyTaxRate: number;
  insuranceRate: number;
  fundingFeePercent: number;
}

interface BahResults {
  monthlyBudget: number;
  maxHomePrice: number;
  loanWithFundingFee: number;
  monthlyPrincipalInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  budgetRemaining: number;
}

const defaultInputs: BahInputs = {
  monthlyBah: 2400,
  extraContribution: 0,
  interestRate: 6.25,
  loanTermYears: 30,
  propertyTaxRate: 1.1,
  insuranceRate: 0.5,
  fundingFeePercent: 2.15,
};

/**
 * Back into the home price a monthly housing budget supports on a VA loan.
 * VA loans require $0 down and no PMI; the funding fee is financed into the loan.
 *
 * budget = price*(1+ff)*payFactor + price*(tax/12) + price*(ins/12)
 * => price = budget / [ (1+ff)*payFactor + tax/12 + ins/12 ]
 */
function calculate(inputs: BahInputs): BahResults {
  const { monthlyBah, extraContribution, interestRate, loanTermYears, propertyTaxRate, insuranceRate, fundingFeePercent } = inputs;
  const monthlyBudget = Math.max(0, monthlyBah) + Math.max(0, extraContribution);
  const n = loanTermYears * 12;
  const r = interestRate / 100 / 12;
  const ff = fundingFeePercent / 100;

  // Monthly P&I per $1 of loan.
  const payFactor = paymentFactor(interestRate, n);
  const taxMonthlyPerDollar = propertyTaxRate / 100 / 12;
  const insMonthlyPerDollar = insuranceRate / 100 / 12;

  const denominator = (1 + ff) * payFactor + taxMonthlyPerDollar + insMonthlyPerDollar;
  const maxHomePrice = denominator > 0 ? monthlyBudget / denominator : 0;

  const loanWithFundingFee = maxHomePrice * (1 + ff);
  const monthlyPrincipalInterest = loanWithFundingFee * payFactor;
  const monthlyTax = maxHomePrice * taxMonthlyPerDollar;
  const monthlyInsurance = maxHomePrice * insMonthlyPerDollar;
  const totalMonthlyPayment = monthlyPrincipalInterest + monthlyTax + monthlyInsurance;

  return {
    monthlyBudget,
    maxHomePrice,
    loanWithFundingFee,
    monthlyPrincipalInterest,
    monthlyTax,
    monthlyInsurance,
    totalMonthlyPayment,
    budgetRemaining: monthlyBudget - totalMonthlyPayment,
  };
}

export default function BahCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [inputs, setInputs] = useState<BahInputs>(defaultInputs);

  usePageView("/calculators/bah");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculate(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/bah", { type: "bah" });
    }
  }, [trackActivity]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: BahInputs; results: BahResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "bah",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your BAH estimate has been saved to your profile." });
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
    navigate(PRELAUNCH_GATED ? "/" : "/apply?type=va");
  };

  const updateInput = (field: keyof BahInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const paymentBreakdown = [
    { label: "Principal & Interest", value: results.monthlyPrincipalInterest, color: "bg-chart-1" },
    { label: "Property Tax", value: results.monthlyTax, color: "bg-chart-2" },
    { label: "Insurance", value: results.monthlyInsurance, color: "bg-chart-3" },
  ].filter((item) => item.value > 0);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="BAH Calculator — Turn Your Housing Allowance Into a Home | VA Loan"
        description="Free Basic Allowance for Housing (BAH) calculator for active-duty service members. See how much home your BAH can buy off base with a VA loan — $0 down, no PMI."
      />
      <PageShell width="wide">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            <Star className="h-4 w-4" />
            Active-Duty Service Members
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Basic Allowance for Housing Calculator
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            See how your housing allowance can help you afford a home off base with a VA loan.
          </p>
        </div>

        <PresalesDisclaimer className="mb-6" />

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Your Housing Allowance
                </CardTitle>
                <CardDescription>
                  Find your monthly BAH on your LES or the DoD BAH calculator — it varies by pay
                  grade, dependents, and duty ZIP code.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="monthlyBah">Monthly BAH</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="monthlyBah"
                      type="number"
                      value={inputs.monthlyBah}
                      onChange={(e) => updateInput("monthlyBah", Number(e.target.value))}
                      className="pl-9"
                      data-testid="input-monthly-bah"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="extraContribution">Extra Monthly Contribution (optional)</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="extraContribution"
                      type="number"
                      value={inputs.extraContribution}
                      onChange={(e) => updateInput("extraContribution", Math.max(0, Number(e.target.value)))}
                      className="pl-9"
                      data-testid="input-extra-contribution"
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Amount from your paycheck you'd add on top of BAH each month.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  VA Loan Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
                  <Label>Loan Term</Label>
                  <Select
                    value={String(inputs.loanTermYears)}
                    onValueChange={(v) => updateInput("loanTermYears", Number(v))}
                  >
                    <SelectTrigger data-testid="select-loan-term">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 Years</SelectItem>
                      <SelectItem value="30">30 Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>VA Funding Fee</Label>
                  <Select
                    value={String(inputs.fundingFeePercent)}
                    onValueChange={(v) => updateInput("fundingFeePercent", Number(v))}
                  >
                    <SelectTrigger data-testid="select-funding-fee">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2.15">2.15% — First use, $0 down</SelectItem>
                      <SelectItem value="3.3">3.3% — Subsequent use, $0 down</SelectItem>
                      <SelectItem value="0">0% — Exempt (disability)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-sm text-muted-foreground">
                    The funding fee varies by down payment and prior VA loan use — confirm your
                    exact rate with a loan officer.
                  </p>
                </div>
                <div>
                  <Label>Property Tax Rate: {inputs.propertyTaxRate}%</Label>
                  <Slider
                    value={[inputs.propertyTaxRate]}
                    onValueChange={([v]) => updateInput("propertyTaxRate", v)}
                    min={0}
                    max={3}
                    step={0.1}
                    className="mt-2"
                    data-testid="slider-property-tax"
                  />
                </div>
                <div>
                  <Label>Insurance Rate: {inputs.insuranceRate}%</Label>
                  <Slider
                    value={[inputs.insuranceRate]}
                    onValueChange={([v]) => updateInput("insuranceRate", v)}
                    min={0}
                    max={2}
                    step={0.1}
                    className="mt-2"
                    data-testid="slider-insurance"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Home Price Your BAH Supports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-max-home-price">
                    {formatCurrency(results.maxHomePrice)}
                  </p>
                  <p className="mt-2 text-muted-foreground">with $0 down on a VA loan</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-start gap-3 pt-6">
                <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">VA loan advantages:</span> no down
                  payment and no monthly mortgage insurance (PMI). Your BAH is tax-free, and many
                  lenders can count it as qualifying income.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Payment vs. Your Budget</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${item.color}`} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="font-medium">Total Monthly Payment</span>
                    <span className="font-bold" data-testid="text-total-payment">
                      {formatCurrency(results.totalMonthlyPayment)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Your monthly budget (BAH + extra)</span>
                    <span className="font-medium" data-testid="text-monthly-budget">
                      {formatCurrency(results.monthlyBudget)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full" onClick={handleStartPreApproval} data-testid="button-start-preapproval">
              {PRELAUNCH_GATED ? "Join the Waitlist" : "Get Pre-Approved for a VA Loan"}
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

            <ConversionCTA context="calculator" purchasePrice={String(Math.round(results.maxHomePrice))} />
          </div>
        </div>
      </PageShell>
    </div>
  );
}
