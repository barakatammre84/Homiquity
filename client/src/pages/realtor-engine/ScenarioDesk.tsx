import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Calculator,
  DollarSign,
  Percent,
  Home,
  TrendingUp,
  Shield,
  Info,
  Save,
  RotateCcw,
  CreditCard,
  Building2,
  ChevronRight,
} from "lucide-react";
import { Link } from "wouter";
import { formatCurrency, formatCurrencyDecimal } from "@/lib/formatters";

type LoanProgram = "conventional" | "fha" | "va" | "usda";

interface ScenarioInput {
  purchasePrice: string;
  downPaymentPercent: string;
  creditScore: string;
  loanProgram: LoanProgram;
  annualIncome: string;
  interestRate: string;
  propertyTaxRate: string;
  insuranceRate: string;
}

interface ScenarioResult {
  loanAmount: number;
  downPaymentAmount: number;
  ltv: number;
  monthlyPrincipalInterest: number;
  monthlyPmi: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  totalMonthlyPayment: number;
  dti: number | null;
  programNotes: string[];
  interestRateUsed: number;
}

const DEFAULT_RATES: Record<LoanProgram, number> = {
  conventional: 6.875,
  fha: 6.5,
  va: 6.25,
  usda: 6.375,
};

const PROGRAM_LABELS: Record<LoanProgram, string> = {
  conventional: "Conventional",
  fha: "FHA",
  va: "VA",
  usda: "USDA",
};

function calculateScenario(input: ScenarioInput): ScenarioResult | null {
  const purchasePrice = parseFloat(input.purchasePrice);
  const downPaymentPercent = parseFloat(input.downPaymentPercent);
  const creditScore = parseInt(input.creditScore);

  if (!purchasePrice || purchasePrice <= 0) return null;
  if (isNaN(downPaymentPercent) || downPaymentPercent < 0 || downPaymentPercent > 100) return null;
  if (!creditScore || creditScore < 300 || creditScore > 850) return null;

  const loanProgram = input.loanProgram;
  const interestRate = input.interestRate ? parseFloat(input.interestRate) : DEFAULT_RATES[loanProgram];
  const propertyTaxRate = input.propertyTaxRate ? parseFloat(input.propertyTaxRate) : 1.1;
  const insuranceRate = input.insuranceRate ? parseFloat(input.insuranceRate) : 0.35;
  const annualIncome = input.annualIncome ? parseFloat(input.annualIncome) : null;

  const downPaymentAmount = purchasePrice * (downPaymentPercent / 100);
  const loanAmount = purchasePrice - downPaymentAmount;
  const ltv = (loanAmount / purchasePrice) * 100;

  const monthlyRate = interestRate / 12 / 100;
  const numPayments = 360;
  const monthlyPrincipalInterest =
    monthlyRate > 0
      ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  let monthlyPmi = 0;
  if (loanProgram === "conventional" && ltv > 80) {
    monthlyPmi = (loanAmount * 0.005) / 12;
  } else if (loanProgram === "fha") {
    monthlyPmi = (loanAmount * 0.0085) / 12;
  }

  const monthlyPropertyTax = (purchasePrice * (propertyTaxRate / 100)) / 12;
  const monthlyInsurance = (purchasePrice * (insuranceRate / 100)) / 12;
  const totalMonthlyPayment = monthlyPrincipalInterest + monthlyPmi + monthlyPropertyTax + monthlyInsurance;

  let dti: number | null = null;
  if (annualIncome && annualIncome > 0) {
    dti = (totalMonthlyPayment / (annualIncome / 12)) * 100;
  }

  const programNotes: string[] = [];
  if (loanProgram === "fha") {
    programNotes.push("FHA requires minimum 3.5% down payment with 580+ credit score");
    if (downPaymentPercent < 3.5) {
      programNotes.push("Warning: Down payment is below FHA minimum of 3.5%");
    }
    if (creditScore < 580) {
      programNotes.push("FHA requires 10% down payment for credit scores below 580");
    }
    programNotes.push("FHA MIP is required for the life of the loan with less than 10% down");
  } else if (loanProgram === "va") {
    programNotes.push("VA loans require no down payment and no PMI");
    programNotes.push("VA funding fee may apply (1.25% - 3.3% of loan amount)");
    if (downPaymentPercent === 0) {
      programNotes.push("100% financing available for eligible veterans");
    }
  } else if (loanProgram === "usda") {
    programNotes.push("USDA loans require no down payment for eligible rural areas");
    programNotes.push("USDA guarantee fee: 1% upfront + 0.35% annual");
    programNotes.push("Income limits apply based on county and household size");
  } else if (loanProgram === "conventional") {
    if (ltv > 80) {
      programNotes.push("PMI required when LTV exceeds 80%");
      programNotes.push("PMI can be removed once LTV reaches 78%");
    }
    if (downPaymentPercent < 3) {
      programNotes.push("Conventional loans typically require minimum 3% down payment");
    }
    if (creditScore < 620) {
      programNotes.push("Most conventional loans require minimum 620 credit score");
    }
  }

  if (dti !== null) {
    if (dti > 50) {
      programNotes.push("DTI exceeds 50% - may not qualify for most loan programs");
    } else if (dti > 43) {
      programNotes.push("DTI exceeds 43% - may need compensating factors for approval");
    }
  }

  return {
    loanAmount,
    downPaymentAmount,
    ltv,
    monthlyPrincipalInterest,
    monthlyPmi,
    monthlyPropertyTax,
    monthlyInsurance,
    totalMonthlyPayment,
    dti,
    programNotes,
    interestRateUsed: interestRate,
  };
}

function ResultRow({ label, value, icon: Icon, highlight }: { label: string; value: string; icon?: typeof DollarSign; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-2 ${highlight ? "border-t-2 border-primary pt-3 mt-1" : ""}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span>{label}</span>
      </div>
      <span className={`font-medium ${highlight ? "text-lg text-foreground" : "text-sm text-foreground"}`} data-testid={`text-result-${label.toLowerCase().replace(/[^a-z]/g, "-")}`}>
        {value}
      </span>
    </div>
  );
}

export default function ScenarioDesk() {
  const { toast } = useToast();
  const [input, setInput] = useState<ScenarioInput>({
    purchasePrice: "",
    downPaymentPercent: "20",
    creditScore: "740",
    loanProgram: "conventional",
    annualIncome: "",
    interestRate: "",
    propertyTaxRate: "",
    insuranceRate: "",
  });
  const [result, setResult] = useState<ScenarioResult | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!result) return;
      return apiRequest("POST", "/api/deal-desk/threads", {
        subject: `Scenario: ${PROGRAM_LABELS[input.loanProgram]} - ${formatCurrency(parseFloat(input.purchasePrice))} purchase`,
        scenarioType: "pricing",
        loanAmount: result.loanAmount.toString(),
        creditScore: parseInt(input.creditScore),
        notes: [
          `Purchase Price: ${formatCurrency(parseFloat(input.purchasePrice))}`,
          `Down Payment: ${input.downPaymentPercent}% (${formatCurrency(result.downPaymentAmount)})`,
          `Loan Amount: ${formatCurrency(result.loanAmount)}`,
          `Program: ${PROGRAM_LABELS[input.loanProgram]}`,
          `Rate: ${result.interestRateUsed}%`,
          `Monthly P&I: ${formatCurrencyDecimal(result.monthlyPrincipalInterest)}`,
          result.monthlyPmi > 0 ? `Monthly PMI/MIP: ${formatCurrencyDecimal(result.monthlyPmi)}` : null,
          `Monthly Tax: ${formatCurrencyDecimal(result.monthlyPropertyTax)}`,
          `Monthly Insurance: ${formatCurrencyDecimal(result.monthlyInsurance)}`,
          `Total Monthly: ${formatCurrencyDecimal(result.totalMonthlyPayment)}`,
          result.dti !== null ? `DTI: ${result.dti.toFixed(1)}%` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-desk/threads"] });
      toast({ title: "Scenario saved", description: "Your scenario has been saved to the Deal Desk." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save scenario", variant: "destructive" }),
  });

  const handleCalculate = () => {
    const calculated = calculateScenario(input);
    if (calculated) {
      setResult(calculated);
    } else {
      toast({
        title: "Invalid input",
        description: "Please check your values. Purchase price, down payment %, and credit score are required.",
        variant: "destructive",
      });
    }
  };

  const handleReset = () => {
    setInput({
      purchasePrice: "",
      downPaymentPercent: "20",
      creditScore: "740",
      loanProgram: "conventional",
      annualIncome: "",
      interestRate: "",
      propertyTaxRate: "",
      insuranceRate: "",
    });
    setResult(null);
  };

  const updateField = (field: keyof ScenarioInput, value: string) => {
    setInput((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto" data-testid="scenario-desk-page">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Calculator className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-page-title">
              Scenario Calculator
            </h1>
            <p className="text-sm text-muted-foreground">Run instant mortgage scenarios for your clients</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Card data-testid="card-calculator-form">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4" /> Loan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Purchase Price</label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={input.purchasePrice}
                      onChange={(e) => updateField("purchasePrice", e.target.value)}
                      placeholder="450,000"
                      className="pl-8"
                      data-testid="input-purchase-price"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Down Payment %</label>
                  <div className="relative mt-1">
                    <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={input.downPaymentPercent}
                      onChange={(e) => updateField("downPaymentPercent", e.target.value)}
                      placeholder="20"
                      min={0}
                      max={100}
                      step={0.5}
                      className="pl-8"
                      data-testid="input-down-payment"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Credit Score</label>
                  <div className="relative mt-1">
                    <CreditCard className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      type="number"
                      value={input.creditScore}
                      onChange={(e) => updateField("creditScore", e.target.value)}
                      placeholder="740"
                      min={300}
                      max={850}
                      className="pl-8"
                      data-testid="input-credit-score"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Loan Program</label>
                  <Select
                    value={input.loanProgram}
                    onValueChange={(v) => updateField("loanProgram", v)}
                  >
                    <SelectTrigger className="mt-1" data-testid="select-loan-program">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conventional">Conventional</SelectItem>
                      <SelectItem value="fha">FHA</SelectItem>
                      <SelectItem value="va">VA</SelectItem>
                      <SelectItem value="usda">USDA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t pt-4 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                  <Info className="h-3 w-3" /> Optional Fields
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Annual Income</label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        value={input.annualIncome}
                        onChange={(e) => updateField("annualIncome", e.target.value)}
                        placeholder="For DTI calculation"
                        className="pl-8"
                        data-testid="input-annual-income"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Interest Rate % {!input.interestRate && <span className="text-muted-foreground/60">(default: {DEFAULT_RATES[input.loanProgram]}%)</span>}
                    </label>
                    <div className="relative mt-1">
                      <TrendingUp className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        value={input.interestRate}
                        onChange={(e) => updateField("interestRate", e.target.value)}
                        placeholder={DEFAULT_RATES[input.loanProgram].toString()}
                        step={0.125}
                        className="pl-8"
                        data-testid="input-interest-rate"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Property Tax Rate % <span className="text-muted-foreground/60">(default: 1.1%)</span>
                    </label>
                    <div className="relative mt-1">
                      <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        value={input.propertyTaxRate}
                        onChange={(e) => updateField("propertyTaxRate", e.target.value)}
                        placeholder="1.1"
                        step={0.1}
                        className="pl-8"
                        data-testid="input-property-tax-rate"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">
                      Insurance Rate % <span className="text-muted-foreground/60">(default: 0.35%)</span>
                    </label>
                    <div className="relative mt-1">
                      <Shield className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        value={input.insuranceRate}
                        onChange={(e) => updateField("insuranceRate", e.target.value)}
                        placeholder="0.35"
                        step={0.05}
                        className="pl-8"
                        data-testid="input-insurance-rate"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <Button onClick={handleCalculate} data-testid="button-calculate">
                  <Calculator className="h-4 w-4 mr-1" /> Calculate
                </Button>
                <Button variant="outline" onClick={handleReset} data-testid="button-reset">
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          {result ? (
            <div className="space-y-4">
              <Card data-testid="card-results">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Payment Breakdown
                    </span>
                    <Badge variant="outline">{PROGRAM_LABELS[input.loanProgram]}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <ResultRow
                      label="Loan Amount"
                      value={formatCurrency(result.loanAmount)}
                      icon={DollarSign}
                    />
                    <ResultRow
                      label="Down Payment"
                      value={`${formatCurrency(result.downPaymentAmount)} (${parseFloat(input.downPaymentPercent)}%)`}
                    />
                    <ResultRow
                      label="LTV"
                      value={`${result.ltv.toFixed(1)}%`}
                      icon={Percent}
                    />
                    <ResultRow
                      label="Interest Rate"
                      value={`${result.interestRateUsed}%`}
                      icon={TrendingUp}
                    />

                    <div className="my-3 border-t" />

                    <ResultRow
                      label="Principal & Interest"
                      value={formatCurrencyDecimal(result.monthlyPrincipalInterest)}
                    />
                    {result.monthlyPmi > 0 && (
                      <ResultRow
                        label={input.loanProgram === "fha" ? "Monthly MIP" : "Monthly PMI"}
                        value={formatCurrencyDecimal(result.monthlyPmi)}
                      />
                    )}
                    <ResultRow
                      label="Property Tax"
                      value={formatCurrencyDecimal(result.monthlyPropertyTax)}
                    />
                    <ResultRow
                      label="Insurance"
                      value={formatCurrencyDecimal(result.monthlyInsurance)}
                    />

                    <ResultRow
                      label="Total Monthly Payment"
                      value={formatCurrencyDecimal(result.totalMonthlyPayment)}
                      highlight
                    />

                    {result.dti !== null && (
                      <>
                        <div className="my-2 border-t" />
                        <div className="flex items-center justify-between gap-2 py-2">
                          <span className="text-sm text-muted-foreground">Debt-to-Income (DTI)</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground" data-testid="text-result-dti">
                              {result.dti.toFixed(1)}%
                            </span>
                            <Badge
                              variant={result.dti <= 43 ? "secondary" : "destructive"}
                            >
                              {result.dti <= 36 ? "Good" : result.dti <= 43 ? "Acceptable" : "High"}
                            </Badge>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              {result.programNotes.length > 0 && (
                <Card data-testid="card-program-notes">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="h-4 w-4" /> Program Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.programNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <ChevronRight className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                          <span data-testid={`text-note-${i}`}>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-scenario"
                >
                  <Save className="h-4 w-4 mr-1" />
                  {saveMutation.isPending ? "Saving..." : "Save to Deal Desk"}
                </Button>
                <Button variant="ghost" asChild data-testid="link-deal-desk">
                  <Link href="/agent/co-branding">
                    View Deal Desk
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <Card data-testid="card-placeholder">
              <CardContent className="py-12 text-center">
                <Calculator className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-medium text-foreground">Enter loan details</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Fill in the form and click Calculate to see the payment breakdown.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
