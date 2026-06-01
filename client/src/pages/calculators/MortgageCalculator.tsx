import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ConversionCTA } from "@/components/ConversionCTA";
import {
  Home,
  DollarSign,
  Calculator,
  ArrowRight,
  Percent,
  Calendar,
  PiggyBank,
  TrendingDown,
} from "lucide-react";

interface MortgageInputs {
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  loanTermYears: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  pmiRate: number;
}

interface MortgageResults {
  loanAmount: number;
  downPayment: number;
  monthlyPrincipalInterest: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  totalMonthlyPayment: number;
  totalInterestPaid: number;
  totalCostOfLoan: number;
  amortizationSchedule: { year: number; principal: number; interest: number; balance: number }[];
}

const defaultInputs: MortgageInputs = {
  homePrice: 400000,
  downPaymentPercent: 20,
  interestRate: 6.5,
  loanTermYears: 30,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  pmiRate: 0.5,
};

function calculateMortgage(inputs: MortgageInputs): MortgageResults {
  const {
    homePrice,
    downPaymentPercent,
    interestRate,
    loanTermYears,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    pmiRate,
  } = inputs;

  const downPayment = homePrice * (downPaymentPercent / 100);
  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;

  const monthlyPrincipalInterest =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyPropertyTax = (homePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (homePrice * (insuranceRate / 100)) / 12;
  const monthlyPMI = downPaymentPercent < 20 ? (loanAmount * (pmiRate / 100)) / 12 : 0;
  const monthlyHOA = hoaMonthly;

  const totalMonthlyPayment =
    monthlyPrincipalInterest + monthlyPropertyTax + monthlyInsurance + monthlyPMI + monthlyHOA;

  const totalInterestPaid = monthlyPrincipalInterest * numPayments - loanAmount;
  const totalCostOfLoan = monthlyPrincipalInterest * numPayments;

  const amortizationSchedule: { year: number; principal: number; interest: number; balance: number }[] = [];
  let balance = loanAmount;
  
  for (let year = 1; year <= Math.min(loanTermYears, 30); year++) {
    let yearlyPrincipal = 0;
    let yearlyInterest = 0;
    
    for (let month = 0; month < 12; month++) {
      if (balance <= 0) break;
      const interestPayment = balance * monthlyRate;
      const principalPayment = Math.min(monthlyPrincipalInterest - interestPayment, balance);
      yearlyPrincipal += principalPayment;
      yearlyInterest += interestPayment;
      balance -= principalPayment;
    }
    
    amortizationSchedule.push({
      year,
      principal: yearlyPrincipal,
      interest: yearlyInterest,
      balance: Math.max(0, balance),
    });
  }

  return {
    loanAmount,
    downPayment,
    monthlyPrincipalInterest,
    monthlyPropertyTax,
    monthlyInsurance,
    monthlyPMI,
    monthlyHOA,
    totalMonthlyPayment,
    totalInterestPaid,
    totalCostOfLoan,
    amortizationSchedule,
  };
}

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
      queryClient.invalidateQueries({ queryKey: ["/api/calculator-results"] });
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
      const { amortizationSchedule, ...resultsWithoutSchedule } = results;
      saveResultsMutation.mutate({ inputs, results: resultsWithoutSchedule });
    }
    navigate("/apply");
  };

  const updateInput = (field: keyof MortgageInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const paymentBreakdown = [
    { label: "Principal & Interest", value: results.monthlyPrincipalInterest, color: "bg-blue-500" },
    { label: "Property Tax", value: results.monthlyPropertyTax, color: "bg-green-500" },
    { label: "Insurance", value: results.monthlyInsurance, color: "bg-yellow-500" },
    { label: "PMI", value: results.monthlyPMI, color: "bg-orange-500" },
    { label: "HOA", value: results.monthlyHOA, color: "bg-purple-500" },
  ].filter((item) => item.value > 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Mortgage Calculator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Calculate your monthly mortgage payment and see the full cost breakdown
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Property Details
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
                    {formatCurrency(results.downPayment)})
                  </Label>
                  <Slider
                    value={[inputs.downPaymentPercent]}
                    onValueChange={([v]) => updateInput("downPaymentPercent", v)}
                    min={3}
                    max={50}
                    step={1}
                    className="mt-2"
                    data-testid="slider-down-payment"
                  />
                  {inputs.downPaymentPercent < 20 && (
                    <p className="mt-1 text-sm text-yellow-600">
                      PMI required (less than 20% down)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Loan Terms
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
                  <PiggyBank className="h-5 w-5" />
                  Additional Costs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
          </div>

          <div className="space-y-6">
            <Card className="border-2 border-primary bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Monthly Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-4xl font-bold text-primary" data-testid="text-monthly-payment">
                    {formatCurrency(results.totalMonthlyPayment)}
                  </p>
                  <p className="mt-2 text-muted-foreground">per month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Breakdown</CardTitle>
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
                </div>
                <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted">
                  {paymentBreakdown.map((item, index) => (
                    <div
                      key={item.label}
                      className={`inline-block h-full ${item.color}`}
                      style={{
                        width: `${(item.value / results.totalMonthlyPayment) * 100}%`,
                      }}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5" />
                  Loan Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan Amount</span>
                    <span className="font-medium" data-testid="text-loan-amount">
                      {formatCurrency(results.loanAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Interest Paid</span>
                    <span className="font-medium text-red-600" data-testid="text-total-interest">
                      {formatCurrency(results.totalInterestPaid)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="font-medium">Total Cost of Loan</span>
                    <span className="font-bold" data-testid="text-total-cost">
                      {formatCurrency(results.totalCostOfLoan)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Amortization Preview
                </CardTitle>
                <CardDescription>First 5 years of payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.amortizationSchedule.slice(0, 5).map((year) => (
                    <div key={year.year} className="flex items-center justify-between text-sm">
                      <span>Year {year.year}</span>
                      <div className="flex gap-4">
                        <span className="text-green-600">
                          +{formatCurrency(year.principal)} principal
                        </span>
                        <span className="text-muted-foreground">
                          Balance: {formatCurrency(year.balance)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Button
              size="lg"
              className="w-full"
              onClick={handleStartPreApproval}
              data-testid="button-start-preapproval"
            >
              Get Pre-Approved Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            {user && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const { amortizationSchedule, ...resultsWithoutSchedule } = results;
                  saveResultsMutation.mutate({ inputs, results: resultsWithoutSchedule });
                }}
                disabled={saveResultsMutation.isPending}
                data-testid="button-save-results"
              >
                Save Results to My Profile
              </Button>
            )}

            <ConversionCTA context="calculator" purchasePrice={String(inputs.homePrice)} />
          </div>
        </div>
      </div>
    </div>
  );
}
