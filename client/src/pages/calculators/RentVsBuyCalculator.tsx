import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
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

interface CalculatorInputs {
  monthlyRent: number;
  homePrice: number;
  downPaymentPercent: number;
  interestRate: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  maintenanceRate: number;
  yearsToStay: number;
  annualRentIncrease: number;
  annualAppreciation: number;
}

interface CalculatorResults {
  monthlyMortgage: number;
  totalMonthlyOwnership: number;
  totalRentCost: number;
  totalOwnershipCost: number;
  homeEquity: number;
  netCostRenting: number;
  netCostBuying: number;
  breakEvenYears: number;
  recommendation: "rent" | "buy" | "neutral";
}

const defaultInputs: CalculatorInputs = {
  monthlyRent: 2000,
  homePrice: 400000,
  downPaymentPercent: 20,
  interestRate: 6.5,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  maintenanceRate: 1,
  yearsToStay: 5,
  annualRentIncrease: 3,
  annualAppreciation: 3,
};

function calculateResults(inputs: CalculatorInputs): CalculatorResults {
  const {
    monthlyRent,
    homePrice,
    downPaymentPercent,
    interestRate,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    maintenanceRate,
    yearsToStay,
    annualRentIncrease,
    annualAppreciation,
  } = inputs;

  const downPayment = homePrice * (downPaymentPercent / 100);
  const loanAmount = homePrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = 30 * 12;

  const monthlyMortgage =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyPropertyTax = (homePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (homePrice * (insuranceRate / 100)) / 12;
  const monthlyMaintenance = (homePrice * (maintenanceRate / 100)) / 12;
  const totalMonthlyOwnership =
    monthlyMortgage + monthlyPropertyTax + monthlyInsurance + hoaMonthly + monthlyMaintenance;

  let totalRentCost = 0;
  let currentRent = monthlyRent;
  for (let year = 0; year < yearsToStay; year++) {
    totalRentCost += currentRent * 12;
    currentRent *= 1 + annualRentIncrease / 100;
  }

  const totalOwnershipCost = totalMonthlyOwnership * 12 * yearsToStay;

  const futureHomeValue = homePrice * Math.pow(1 + annualAppreciation / 100, yearsToStay);
  
  let remainingBalance = loanAmount;
  for (let month = 0; month < yearsToStay * 12; month++) {
    const interestPayment = remainingBalance * monthlyRate;
    const principalPayment = monthlyMortgage - interestPayment;
    remainingBalance -= principalPayment;
  }
  const homeEquity = futureHomeValue - remainingBalance;

  const netCostRenting = totalRentCost;
  const netCostBuying = totalOwnershipCost + downPayment - homeEquity;

  let breakEvenYears = 0;
  let cumulativeRent = 0;
  let cumulativeOwnership = 0;
  let testRent = monthlyRent;
  let testBalance = loanAmount;
  
  for (let year = 1; year <= 30; year++) {
    cumulativeRent += testRent * 12;
    testRent *= 1 + annualRentIncrease / 100;
    
    cumulativeOwnership += totalMonthlyOwnership * 12;
    
    for (let month = 0; month < 12; month++) {
      const interest = testBalance * monthlyRate;
      testBalance -= monthlyMortgage - interest;
    }
    
    const testHomeValue = homePrice * Math.pow(1 + annualAppreciation / 100, year);
    const testEquity = testHomeValue - Math.max(0, testBalance);
    const netOwnership = cumulativeOwnership + downPayment - testEquity;
    
    if (netOwnership < cumulativeRent && breakEvenYears === 0) {
      breakEvenYears = year;
      break;
    }
  }

  const recommendation: "rent" | "buy" | "neutral" =
    netCostBuying < netCostRenting * 0.9
      ? "buy"
      : netCostRenting < netCostBuying * 0.9
      ? "rent"
      : "neutral";

  return {
    monthlyMortgage,
    totalMonthlyOwnership,
    totalRentCost,
    totalOwnershipCost,
    homeEquity,
    netCostRenting,
    netCostBuying,
    breakEvenYears,
    recommendation,
  };
}

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
      saveResultsMutation.mutate({ inputs, results });
    }
    navigate("/apply");
  };

  const updateInput = (field: keyof CalculatorInputs, value: number) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Rent vs. Buy Calculator
          </h1>
          <p className="mt-2 text-muted-foreground">
            Compare the costs of renting versus buying to make an informed decision
          </p>
        </div>

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
                  ? "border-green-500 bg-green-50 dark:bg-green-950"
                  : results.recommendation === "rent"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
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
                        results.recommendation === "buy" ? "text-green-600" : "text-blue-600"
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
                      <Building className="h-5 w-5 text-blue-600" />
                      <span>Monthly Rent</span>
                    </div>
                    <span className="text-xl font-bold" data-testid="text-monthly-rent">
                      {formatCurrency(inputs.monthlyRent)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <div className="flex items-center gap-2">
                      <Home className="h-5 w-5 text-green-600" />
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
                    <div className="mt-1 h-3 rounded-full bg-blue-200">
                      <div
                        className="h-3 rounded-full bg-blue-600"
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
                    <div className="mt-1 h-3 rounded-full bg-green-200">
                      <div
                        className="h-3 rounded-full bg-green-600"
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
                    <span className="font-bold text-green-600" data-testid="text-home-equity">
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
              {results.recommendation === "buy" ? (
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
      </div>
    </div>
  );
}
