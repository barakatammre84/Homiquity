import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Wallet,
  CreditCard,
  Briefcase,
  Plus,
  Trash2,
  Car,
  GraduationCap,
  Banknote,
  Heart,
  MoreHorizontal,
  Save,
  Mail,
  Shield,
  MapPin,
  Pencil,
} from "lucide-react";

interface DebtItem {
  id: string;
  type: string;
  name: string;
  monthlyPayment: number;
}

interface AffordabilityInputs {
  annualIncome: number;
  monthlyDebts: number;
  downPaymentSaved: number;
  creditScore: number;
  interestRate: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  loanTermYears: number;
  zipCode: string;
}

interface AffordabilityResults {
  maxHomePrice: number;
  maxMonthlyPayment: number;
  frontEndDTI: number;
  backEndDTI: number;
  comfortablePrice: number;
  stretchPrice: number;
  requiredDownPayment: number;
  monthlyPITI: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  withinGuidelines: boolean;
}

const defaultInputs: AffordabilityInputs = {
  annualIncome: 100000,
  monthlyDebts: 500,
  downPaymentSaved: 50000,
  creditScore: 680,
  interestRate: 6.5,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  loanTermYears: 30,
  zipCode: "",
};

const DEBT_TYPES = [
  { value: "auto_loan", label: "Auto Loan", icon: Car },
  { value: "student_loan", label: "Student Loan", icon: GraduationCap },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "personal_loan", label: "Personal Loan", icon: Banknote },
  { value: "child_support", label: "Child Support / Alimony", icon: Heart },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

function calculateAffordability(inputs: AffordabilityInputs): AffordabilityResults {
  const {
    annualIncome,
    monthlyDebts,
    downPaymentSaved,
    creditScore,
    interestRate,
    propertyTaxRate,
    insuranceRate,
    hoaMonthly,
    loanTermYears,
  } = inputs;

  const monthlyIncome = annualIncome / 12;
  const maxFrontEndDTI = 0.28;
  const maxBackEndDTI = creditScore >= 740 ? 0.45 : creditScore >= 700 ? 0.43 : 0.41;

  const maxHousingPayment = monthlyIncome * maxFrontEndDTI;
  const maxTotalPayment = monthlyIncome * maxBackEndDTI - monthlyDebts;
  const maxMonthlyPayment = Math.min(maxHousingPayment, maxTotalPayment);

  const monthlyRate = interestRate / 100 / 12;
  const numPayments = loanTermYears * 12;
  const monthlyTaxInsuranceRate = (propertyTaxRate + insuranceRate) / 100 / 12;

  const availableForPI = maxMonthlyPayment - hoaMonthly;

  let maxLoanAmount = 0;
  if (monthlyRate > 0) {
    const factor =
      (Math.pow(1 + monthlyRate, numPayments) - 1) /
      (monthlyRate * Math.pow(1 + monthlyRate, numPayments));
    maxLoanAmount = (availableForPI / (1 + monthlyTaxInsuranceRate * factor)) * factor;
  } else {
    maxLoanAmount = (availableForPI * numPayments) / (1 + monthlyTaxInsuranceRate * numPayments);
  }

  const minDownPaymentPercent = creditScore >= 740 ? 0.03 : creditScore >= 680 ? 0.05 : 0.1;

  let maxHomePrice = maxLoanAmount / (1 - minDownPaymentPercent);
  const maxFromDownPayment = downPaymentSaved / minDownPaymentPercent;
  maxHomePrice = Math.min(maxHomePrice, maxFromDownPayment);

  const comfortablePrice = maxHomePrice * 0.85;
  const stretchPrice = maxHomePrice * 1.1;
  const requiredDownPayment = maxHomePrice * minDownPaymentPercent;

  const loanAmount = maxHomePrice - requiredDownPayment;
  const monthlyPI =
    monthlyRate > 0
      ? (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
        (Math.pow(1 + monthlyRate, numPayments) - 1)
      : loanAmount / numPayments;

  const monthlyTax = (maxHomePrice * propertyTaxRate) / 100 / 12;
  const monthlyInsurance = (maxHomePrice * insuranceRate) / 100 / 12;
  const monthlyPMI = minDownPaymentPercent < 0.2 ? (loanAmount * 0.005) / 12 : 0;
  const monthlyPITI = monthlyPI + monthlyTax + monthlyInsurance + hoaMonthly + monthlyPMI;

  const frontEndDTI = (monthlyPITI / monthlyIncome) * 100;
  const backEndDTI = ((monthlyPITI + monthlyDebts) / monthlyIncome) * 100;
  const withinGuidelines = frontEndDTI <= 28 && backEndDTI <= maxBackEndDTI * 100;

  return {
    maxHomePrice: Math.max(0, maxHomePrice),
    maxMonthlyPayment: Math.max(0, maxMonthlyPayment),
    frontEndDTI,
    backEndDTI,
    comfortablePrice: Math.max(0, comfortablePrice),
    stretchPrice: Math.max(0, stretchPrice),
    requiredDownPayment: Math.max(0, requiredDownPayment),
    monthlyPITI: Math.max(0, monthlyPITI),
    monthlyPI: Math.max(0, monthlyPI),
    monthlyTax: Math.max(0, monthlyTax),
    monthlyInsurance: Math.max(0, monthlyInsurance),
    monthlyPMI: Math.max(0, monthlyPMI),
    withinGuidelines,
  };
}

function formatInputCurrency(value: number): string {
  return value.toLocaleString("en-US");
}

function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

export default function AffordabilityCalculator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<AffordabilityInputs>(defaultInputs);
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [isDebtDialogOpen, setIsDebtDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveEmail, setSaveEmail] = useState("");
  const [saveFirstName, setSaveFirstName] = useState("");
  const [saveLastName, setSaveLastName] = useState("");
  const [savePhone, setSavePhone] = useState("");
  const [newDebtType, setNewDebtType] = useState("auto_loan");
  const [newDebtName, setNewDebtName] = useState("");
  const [newDebtAmount, setNewDebtAmount] = useState("");
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);

  usePageView("/calculators/affordability");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const results = useMemo(() => calculateAffordability(inputs), [inputs]);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/affordability", { type: "affordability" });
    }
  }, [trackActivity]);

  const totalDebtPayments = useMemo(() => {
    return debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  }, [debts]);

  useEffect(() => {
    setInputs((prev) => ({ ...prev, monthlyDebts: totalDebtPayments }));
  }, [totalDebtPayments]);

  const addDebt = useCallback(() => {
    const amount = parseFloat(newDebtAmount) || 0;
    if (amount <= 0) return;

    const typeInfo = DEBT_TYPES.find((t) => t.value === newDebtType);

    if (editingDebtId) {
      setDebts((prev) =>
        prev.map((d) =>
          d.id === editingDebtId
            ? { ...d, type: newDebtType, name: newDebtName || typeInfo?.label || "Debt", monthlyPayment: amount }
            : d
        )
      );
      setEditingDebtId(null);
    } else {
      setDebts((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          type: newDebtType,
          name: newDebtName || typeInfo?.label || "Debt",
          monthlyPayment: amount,
        },
      ]);
    }
    setNewDebtName("");
    setNewDebtAmount("");
    setNewDebtType("auto_loan");
  }, [newDebtType, newDebtName, newDebtAmount, editingDebtId]);

  const startEditDebt = useCallback((debt: DebtItem) => {
    setEditingDebtId(debt.id);
    setNewDebtType(debt.type);
    setNewDebtName(debt.name);
    setNewDebtAmount(String(debt.monthlyPayment));
  }, []);

  const cancelEditDebt = useCallback(() => {
    setEditingDebtId(null);
    setNewDebtName("");
    setNewDebtAmount("");
    setNewDebtType("auto_loan");
  }, []);

  const removeDebt = useCallback((id: string) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
    if (editingDebtId === id) {
      setEditingDebtId(null);
      setNewDebtName("");
      setNewDebtAmount("");
      setNewDebtType("auto_loan");
    }
  }, [editingDebtId]);

  const saveResultsMutation = useMutation({
    mutationFn: async (data: { inputs: AffordabilityInputs; results: AffordabilityResults }) => {
      return apiRequest("POST", "/api/calculator-results", {
        calculatorType: "affordability",
        inputs: data.inputs,
        results: data.results,
      });
    },
    onSuccess: () => {
      toast({ title: "Results Saved", description: "Your affordability analysis has been saved." });
      queryClient.invalidateQueries({ queryKey: ["/api/calculator-results"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save results.", variant: "destructive" });
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calculator-profiles", {
        email: saveEmail,
        firstName: saveFirstName || undefined,
        lastName: saveLastName || undefined,
        phone: savePhone || undefined,
        annualIncome: inputs.annualIncome,
        monthlyDebts: inputs.monthlyDebts,
        creditScore: inputs.creditScore,
        downPaymentSaved: inputs.downPaymentSaved,
        debts: debts.map((d) => ({ type: d.type, name: d.name, monthlyPayment: d.monthlyPayment })),
        calculatorInputs: inputs,
        calculatorResults: results,
        maxHomePrice: Math.round(results.maxHomePrice),
        zipCode: inputs.zipCode || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Profile Saved",
        description: "Your info has been saved. When you're ready, start your pre-approval and your data will be pre-filled.",
      });
      setIsSaveDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save profile.", variant: "destructive" });
    },
  });

  const handleStartPreApproval = () => {
    if (user) {
      saveResultsMutation.mutate({ inputs, results });
    }
    try {
      sessionStorage.setItem("calculatorPrefill", JSON.stringify({
        annualIncome: inputs.annualIncome,
        monthlyDebts: inputs.monthlyDebts,
        downPayment: inputs.downPaymentSaved,
        creditScore: inputs.creditScore,
        purchasePrice: Math.round(results.maxHomePrice),
      }));
    } catch {}
    navigate(`/apply?price=${Math.round(results.maxHomePrice)}&source=calculator`);
  };

  const updateInput = (field: keyof AffordabilityInputs, value: number | string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const getDTIColor = (dti: number) => {
    if (dti <= 28) return "text-green-600 dark:text-green-400";
    if (dti <= 36) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const paymentBreakdown = [
    { label: "Principal & Interest", value: results.monthlyPI, color: "bg-blue-500" },
    { label: "Property Tax", value: results.monthlyTax, color: "bg-emerald-500" },
    { label: "Insurance", value: results.monthlyInsurance, color: "bg-amber-500" },
    { label: "PMI", value: results.monthlyPMI, color: "bg-orange-500" },
    { label: "HOA", value: inputs.hoaMonthly, color: "bg-purple-500" },
  ].filter((item) => item.value > 0);

  const debtTypeIcon = (type: string) => {
    const found = DEBT_TYPES.find((t) => t.value === type);
    return found ? found.icon : MoreHorizontal;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            How Much Home Can You Afford?
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            See your homebuying budget in minutes. Adjust your income, debts, and down payment to find your comfortable price range.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Income
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="annualIncome">Annual Gross Income</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="annualIncome"
                      value={formatInputCurrency(inputs.annualIncome)}
                      onChange={(e) => updateInput("annualIncome", parseCurrencyInput(e.target.value))}
                      className="pl-9"
                      data-testid="input-annual-income"
                    />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Monthly: {formatCurrency(inputs.annualIncome / 12)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Monthly Debts
                  </CardTitle>
                  <Dialog open={isDebtDialogOpen} onOpenChange={setIsDebtDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-debts">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Debts
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Add Monthly Debts</DialogTitle>
                        <DialogDescription>
                          List your recurring monthly debt payments. This helps calculate an accurate debt-to-income ratio.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        {debts.length > 0 && (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {debts.map((debt) => {
                              const Icon = debtTypeIcon(debt.type);
                              const isEditing = editingDebtId === debt.id;
                              return (
                                <div
                                  key={debt.id}
                                  className={`flex items-center justify-between gap-2 rounded-lg p-3 ${isEditing ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/50"}`}
                                  data-testid={`debt-item-${debt.id}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                                    <span className="text-sm truncate">{debt.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium whitespace-nowrap">
                                      {formatCurrency(debt.monthlyPayment)}/mo
                                    </span>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => startEditDebt(debt)}
                                      data-testid={`button-edit-debt-${debt.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => removeDebt(debt.id)}
                                      data-testid={`button-remove-debt-${debt.id}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div className="space-y-3 border-t pt-4">
                          {editingDebtId && (
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-primary">Editing debt</p>
                              <Button variant="ghost" size="sm" onClick={cancelEditDebt} data-testid="button-cancel-edit-debt">
                                Cancel
                              </Button>
                            </div>
                          )}
                          <div>
                            <Label>Debt Type</Label>
                            <Select value={newDebtType} onValueChange={setNewDebtType}>
                              <SelectTrigger data-testid="select-debt-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEBT_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>Description (optional)</Label>
                            <Input
                              placeholder="e.g., Toyota Camry"
                              value={newDebtName}
                              onChange={(e) => setNewDebtName(e.target.value)}
                              data-testid="input-debt-name"
                            />
                          </div>
                          <div>
                            <Label>Monthly Payment</Label>
                            <div className="relative">
                              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                type="number"
                                placeholder="350"
                                value={newDebtAmount}
                                onChange={(e) => setNewDebtAmount(e.target.value)}
                                className="pl-9"
                                data-testid="input-debt-amount"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    addDebt();
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <Button
                            onClick={addDebt}
                            disabled={!newDebtAmount || parseFloat(newDebtAmount) <= 0}
                            className="w-full"
                            data-testid="button-confirm-add-debt"
                          >
                            {editingDebtId ? (
                              <>
                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                Update Debt
                              </>
                            ) : (
                              <>
                                <Plus className="h-4 w-4 mr-1" />
                                Add This Debt
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                      <DialogFooter>
                        <div className="flex items-center justify-between w-full">
                          <p className="text-sm text-muted-foreground">
                            Total: <span className="font-semibold text-foreground">{formatCurrency(totalDebtPayments)}/mo</span>
                          </p>
                          <Button variant="outline" onClick={() => setIsDebtDialogOpen(false)} data-testid="button-done-debts">
                            Done
                          </Button>
                        </div>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
                <CardDescription>
                  Include car loans, student loans, credit cards, and other recurring payments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {debts.length > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {debts.map((debt) => {
                        const Icon = debtTypeIcon(debt.type);
                        return (
                          <div key={debt.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{debt.name}</span>
                            </div>
                            <span className="font-medium">{formatCurrency(debt.monthlyPayment)}/mo</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="font-medium">Total Monthly Debts</span>
                      <span className="text-lg font-bold" data-testid="text-total-debts">
                        {formatCurrency(totalDebtPayments)}/mo
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">No debts added yet</p>
                    <p className="text-xs text-muted-foreground">
                      Click "Add Debts" to itemize your monthly payments for a more accurate calculation
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Down Payment & Loan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="downPaymentSaved">Down Payment Saved</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="downPaymentSaved"
                      value={formatInputCurrency(inputs.downPaymentSaved)}
                      onChange={(e) => updateInput("downPaymentSaved", parseCurrencyInput(e.target.value))}
                      className="pl-9"
                      data-testid="input-down-payment"
                    />
                  </div>
                </div>
                <div>
                  <Label>Credit Score: {inputs.creditScore}</Label>
                  <Slider
                    value={[inputs.creditScore]}
                    onValueChange={([v]) => updateInput("creditScore", v)}
                    min={580}
                    max={850}
                    step={10}
                    className="mt-2"
                    data-testid="slider-credit-score"
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>580</span>
                    <span>700</span>
                    <span>850</span>
                  </div>
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
                <div className="grid grid-cols-2 gap-4">
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
                  <div>
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <div className="relative mt-1">
                      <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="zipCode"
                        maxLength={5}
                        placeholder="60462"
                        value={inputs.zipCode}
                        onChange={(e) => updateInput("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                        className="pl-9"
                        data-testid="input-zip-code"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Property Tax: {inputs.propertyTaxRate}%</Label>
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
                    <Label>Insurance: {inputs.insuranceRate}%</Label>
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
                </div>
                <div>
                  <Label htmlFor="hoaMonthly">Monthly HOA (Optional)</Label>
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

          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 border-primary lg:sticky lg:top-4" style={{ zIndex: 10 }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Home className="h-5 w-5" />
                  You can afford up to
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-4xl font-bold text-primary" data-testid="text-max-price">
                    {formatCurrency(results.maxHomePrice)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Estimated monthly: <span className="font-semibold text-foreground">{formatCurrency(results.monthlyPITI)}/mo</span>
                  </p>
                  <div className="mt-3">
                    {results.withinGuidelines ? (
                      <Badge variant="secondary">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Within lending guidelines
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        DTI may require review
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={handleStartPreApproval}
                    data-testid="button-start-preapproval"
                  >
                    Get Pre-Approved Now
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full" data-testid="button-save-profile">
                        <Save className="h-4 w-4 mr-2" />
                        Save My Results
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[420px]">
                      <DialogHeader>
                        <DialogTitle>Save Your Results</DialogTitle>
                        <DialogDescription>
                          Enter your email to save your affordability profile. When you're ready to apply, your information will be pre-filled — no re-entering data.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="save-email">Email</Label>
                          <div className="relative mt-1">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="save-email"
                              type="email"
                              placeholder="you@example.com"
                              value={saveEmail}
                              onChange={(e) => setSaveEmail(e.target.value)}
                              className="pl-9"
                              data-testid="input-save-email"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="save-first">First Name</Label>
                            <Input
                              id="save-first"
                              placeholder="John"
                              value={saveFirstName}
                              onChange={(e) => setSaveFirstName(e.target.value)}
                              data-testid="input-save-first-name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="save-last">Last Name</Label>
                            <Input
                              id="save-last"
                              placeholder="Smith"
                              value={saveLastName}
                              onChange={(e) => setSaveLastName(e.target.value)}
                              data-testid="input-save-last-name"
                            />
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="save-phone">Phone (Optional)</Label>
                          <Input
                            id="save-phone"
                            type="tel"
                            placeholder="(555) 123-4567"
                            value={savePhone}
                            onChange={(e) => setSavePhone(e.target.value)}
                            data-testid="input-save-phone"
                          />
                        </div>

                        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
                          <p className="font-medium text-foreground">What we'll save:</p>
                          <p>Max home price: {formatCurrency(results.maxHomePrice)}</p>
                          <p>Income: {formatCurrency(inputs.annualIncome)}/yr</p>
                          <p>Monthly debts: {formatCurrency(inputs.monthlyDebts)}</p>
                          <p>Down payment: {formatCurrency(inputs.downPaymentSaved)}</p>
                        </div>

                        <div className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                          <p>Your information is encrypted and will only be used to pre-fill your application when you're ready.</p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => saveProfileMutation.mutate()}
                          disabled={!saveEmail || saveProfileMutation.isPending}
                          className="w-full"
                          data-testid="button-confirm-save"
                        >
                          {saveProfileMutation.isPending ? "Saving..." : "Save Profile"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  {user && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={() => saveResultsMutation.mutate({ inputs, results })}
                      disabled={saveResultsMutation.isPending}
                      data-testid="button-save-results"
                    >
                      Save to My Account
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-center gap-4 border-t pt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Encrypted
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    No Credit Impact
                  </span>
                  <span className="flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    Equal Housing
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Monthly Payment Breakdown</CardTitle>
                <CardDescription>{formatCurrency(results.monthlyPITI)}/mo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-3 overflow-hidden rounded-full bg-muted flex mb-4">
                  {paymentBreakdown.map((item) => (
                    <div
                      key={item.label}
                      className={`h-full ${item.color}`}
                      style={{ width: `${(item.value / results.monthlyPITI) * 100}%` }}
                    />
                  ))}
                </div>
                <div className="space-y-2">
                  {paymentBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                        <span>{item.label}</span>
                      </div>
                      <span className="font-medium">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Price Ranges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium">Comfortable</span>
                    </div>
                    <span className="font-bold text-green-600 dark:text-green-400" data-testid="text-comfortable-price">
                      {formatCurrency(results.comfortablePrice)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground pl-6">Room for savings and lifestyle</p>
                </div>
                <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm font-medium">Stretch</span>
                    </div>
                    <span className="font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-stretch-price">
                      {formatCurrency(results.stretchPrice)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground pl-6">Tighter budget, less flexibility</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Debt-to-Income</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Housing (Front-End)</span>
                    <span className={`font-medium ${getDTIColor(results.frontEndDTI)}`}>
                      {results.frontEndDTI.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={Math.min(results.frontEndDTI, 50)} max={50} />
                  <p className="text-xs text-muted-foreground mt-0.5">Target: 28% or less</p>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Total (Back-End)</span>
                    <span className={`font-medium ${getDTIColor(results.backEndDTI)}`}>
                      {results.backEndDTI.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={Math.min(results.backEndDTI, 50)} max={50} />
                  <p className="text-xs text-muted-foreground mt-0.5">Target: 43% or less</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
