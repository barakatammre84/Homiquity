import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { PageShell } from "@/components/PageShell";
import { useAuth } from "@/hooks/useAuth";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  DollarSign,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  Save,
  Mail,
  Shield,
  MapPin,
  Wallet,
  TrendingUp,
  Sparkles,
  Loader2,
} from "lucide-react";

interface CreditTier {
  id: string;
  label: string;
  minScore: number;
  maxScore: number;
  representativeScore: number;
  minDownPaymentPct: number;
  interestRate: number;
  pmiAnnualRate: number;
}

interface CreditTiersResponse {
  baseRate: number;
  tiers: CreditTier[];
}

interface RentInputs {
  monthlyRent: number;
  downPaymentSaved: number;
  creditScore: number;
  propertyTaxRate: number;
  insuranceRate: number;
  hoaMonthly: number;
  loanTermYears: number;
  zipCode: string;
}

interface TierResult {
  homePrice: number;
  loanAmount: number;
  downPaymentNeeded: number;
  monthlyPI: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  hoaMonthly: number;
  interestRate: number;
  minDownPaymentPct: number;
  pmiAnnualRate: number;
}

const defaultInputs: RentInputs = {
  monthlyRent: 2000,
  downPaymentSaved: 10000,
  creditScore: 680,
  propertyTaxRate: 1.2,
  insuranceRate: 0.5,
  hoaMonthly: 0,
  loanTermYears: 30,
  zipCode: "",
};

function formatInputCurrency(value: number): string {
  return value.toLocaleString("en-US");
}

function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

// Reverse-affordability: given a target monthly housing payment (the renter's
// current rent), derive the home price that payment could support at a given
// credit tier's rate / PMI / minimum down payment.
function computeTierResult(
  monthlyRent: number,
  tier: CreditTier,
  inputs: RentInputs,
): TierResult {
  const { propertyTaxRate, insuranceRate, hoaMonthly, loanTermYears } = inputs;
  const monthlyRate = tier.interestRate / 100 / 12;
  const n = loanTermYears * 12;
  const d = tier.minDownPaymentPct;

  const factor =
    monthlyRate > 0
      ? (Math.pow(1 + monthlyRate, n) - 1) / (monthlyRate * Math.pow(1 + monthlyRate, n))
      : n;

  const tiRate = (propertyTaxRate + insuranceRate) / 100 / 12;
  const pmiMonthly = d < 0.2 ? tier.pmiAnnualRate / 100 / 12 : 0;

  // payment = loan/factor + (loan/(1-d))*tiRate + loan*pmiMonthly + hoa
  const denom = 1 / factor + tiRate / (1 - d) + pmiMonthly;
  const available = Math.max(0, monthlyRent - hoaMonthly);
  const loanAmount = denom > 0 ? available / denom : 0;
  const homePrice = loanAmount / (1 - d);

  const monthlyPI = loanAmount / factor;
  const monthlyTax = (homePrice * propertyTaxRate) / 100 / 12;
  const monthlyInsurance = (homePrice * insuranceRate) / 100 / 12;
  const monthlyPMI = loanAmount * pmiMonthly;

  return {
    homePrice: Math.max(0, homePrice),
    loanAmount: Math.max(0, loanAmount),
    downPaymentNeeded: Math.max(0, homePrice * d),
    monthlyPI: Math.max(0, monthlyPI),
    monthlyTax: Math.max(0, monthlyTax),
    monthlyInsurance: Math.max(0, monthlyInsurance),
    monthlyPMI: Math.max(0, monthlyPMI),
    hoaMonthly,
    interestRate: tier.interestRate,
    minDownPaymentPct: d,
    pmiAnnualRate: tier.pmiAnnualRate,
  };
}

export default function RentToOwnReadiness() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputs, setInputs] = useState<RentInputs>(defaultInputs);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveEmail, setSaveEmail] = useState("");
  const [saveFirstName, setSaveFirstName] = useState("");
  const [saveLastName, setSaveLastName] = useState("");
  const [savePhone, setSavePhone] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  usePageView("/calculators/rent-to-own");
  const trackActivity = useTrackActivity();
  const trackedRef = useRef(false);

  const { data: tierData, isLoading: tiersLoading } = useQuery<CreditTiersResponse>({
    queryKey: ["/api/calculators/credit-tiers"],
  });

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackActivity("calculator_use", "/calculators/rent-to-own", { type: "rent_to_own" });
    }
  }, [trackActivity]);

  const tiers = tierData?.tiers ?? [];

  const activeTier = useMemo(() => {
    if (tiers.length === 0) return undefined;
    return (
      tiers.find((t) => inputs.creditScore >= t.minScore && inputs.creditScore <= t.maxScore) ??
      tiers[tiers.length - 1]
    );
  }, [tiers, inputs.creditScore]);

  const primary = useMemo(() => {
    if (!activeTier) return undefined;
    return computeTierResult(inputs.monthlyRent, activeTier, inputs);
  }, [activeTier, inputs]);

  const tierRows = useMemo(() => {
    return tiers.map((tier) => ({
      tier,
      result: computeTierResult(inputs.monthlyRent, tier, inputs),
    }));
  }, [tiers, inputs]);

  const monthlyTotal = primary
    ? primary.monthlyPI + primary.monthlyTax + primary.monthlyInsurance + primary.monthlyPMI + primary.hoaMonthly
    : 0;

  const paymentBreakdown = primary
    ? [
        { label: "Principal & Interest", value: primary.monthlyPI, color: "bg-blue-500" },
        { label: "Property Tax", value: primary.monthlyTax, color: "bg-emerald-500" },
        { label: "Insurance", value: primary.monthlyInsurance, color: "bg-amber-500" },
        { label: "PMI", value: primary.monthlyPMI, color: "bg-orange-500" },
        { label: "HOA", value: primary.hoaMonthly, color: "bg-purple-500" },
      ].filter((item) => item.value > 0)
    : [];

  // Readiness gap analysis
  const downPaymentGap = primary ? primary.downPaymentNeeded - inputs.downPaymentSaved : 0;
  const hasDownPayment = downPaymentGap <= 0;

  const tierForThreePct = tiers.find((t) => t.minDownPaymentPct <= 0.03);
  const creditReadyForBest = tierForThreePct ? inputs.creditScore >= tierForThreePct.minScore : false;

  const nextSteps = useMemo(() => {
    const steps: { icon: typeof CheckCircle2; tone: "good" | "todo"; text: string }[] = [];
    if (!primary) return steps;

    if (hasDownPayment) {
      steps.push({
        icon: CheckCircle2,
        tone: "good",
        text: `Your savings cover the ${formatCurrency(primary.downPaymentNeeded)} down payment needed at this price.`,
      });
    } else {
      steps.push({
        icon: Wallet,
        tone: "todo",
        text: `Save about ${formatCurrency(downPaymentGap)} more to reach the ${formatCurrency(primary.downPaymentNeeded)} down payment for this price.`,
      });
    }

    if (!creditReadyForBest && tierForThreePct) {
      steps.push({
        icon: TrendingUp,
        tone: "todo",
        text: `Raise your credit score to ${tierForThreePct.minScore}+ to unlock a 3% down payment and better pricing.`,
      });
    } else {
      steps.push({
        icon: CheckCircle2,
        tone: "good",
        text: `Your credit score qualifies you for this tier's best available down payment of ${(primary.minDownPaymentPct * 100).toFixed(0)}%.`,
      });
    }

    if (hasDownPayment && creditReadyForBest) {
      steps.push({
        icon: Sparkles,
        tone: "good",
        text: "You look ready — start your pre-approval to lock in the details.",
      });
    } else {
      steps.push({
        icon: ArrowRight,
        tone: "todo",
        text: "You can still get pre-approved now to see your real numbers and a personalized plan.",
      });
    }

    return steps;
  }, [primary, hasDownPayment, downPaymentGap, creditReadyForBest, tierForThreePct]);

  const updateInput = (field: keyof RentInputs, value: number | string) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  const handleLeaseUpload = async (file: File) => {
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/calculators/extract-lease", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      if (data.monthlyRent && data.monthlyRent > 0) {
        updateInput("monthlyRent", Math.round(data.monthlyRent));
        toast({
          title: "Rent detected",
          description: `We found ${formatCurrency(Math.round(data.monthlyRent))}/mo on your lease. Adjust it if needed.`,
        });
      } else {
        toast({
          title: "Couldn't read the rent",
          description: "We couldn't find a monthly rent on that file. Please enter it manually.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Upload issue",
        description: "We couldn't process that file. Please enter your rent manually.",
        variant: "destructive",
      });
    } finally {
      setIsExtracting(false);
    }
  };

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/calculator-profiles", {
        email: saveEmail,
        firstName: saveFirstName || undefined,
        lastName: saveLastName || undefined,
        phone: savePhone || undefined,
        creditScore: inputs.creditScore,
        downPaymentSaved: inputs.downPaymentSaved,
        calculatorInputs: inputs,
        calculatorResults: primary,
        maxHomePrice: primary ? Math.round(primary.homePrice) : undefined,
        zipCode: inputs.zipCode || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: "Results Saved",
        description: "Your info has been saved. When you're ready, start your pre-approval and your data will be pre-filled.",
      });
      setIsSaveDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save your results.", variant: "destructive" });
    },
  });

  const handleStartPreApproval = () => {
    if (!primary) return;
    try {
      sessionStorage.setItem(
        "calculatorPrefill",
        JSON.stringify({
          downPayment: inputs.downPaymentSaved,
          creditScore: inputs.creditScore,
          purchasePrice: Math.round(primary.homePrice),
        }),
      );
    } catch {}
    navigate(`/apply?price=${Math.round(primary.homePrice)}&source=calculator`);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Rent-to-Own Readiness Calculator"
        description="See what home price your current rent could cover, the credit and down payment you'd need, and a clear plan to go from renting to owning. No login required."
        canonical="/calculators/rent-to-own"
      />
      <PageShell width="wide">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" data-testid="text-page-title">
            Turn Your Rent Into a Mortgage
          </h1>
          <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
            Your rent is already a monthly housing payment. See what home price it could cover, what
            you'd need to qualify, and your clearest path from renting to owning.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          {/* Inputs */}
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Your Rent
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isExtracting}
                    data-testid="button-upload-lease"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-1" />
                    )}
                    {isExtracting ? "Reading..." : "Upload Lease"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLeaseUpload(file);
                      e.target.value = "";
                    }}
                    data-testid="input-lease-file"
                  />
                </div>
                <CardDescription>
                  Enter your current monthly rent, or upload your lease to auto-fill it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="monthlyRent">Monthly Rent</Label>
                  <div className="relative mt-1">
                    <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="monthlyRent"
                      value={formatInputCurrency(inputs.monthlyRent)}
                      onChange={(e) => updateInput("monthlyRent", parseCurrencyInput(e.target.value))}
                      className="pl-9"
                      data-testid="input-monthly-rent"
                    />
                  </div>
                  <div className="mt-3">
                    <Slider
                      value={[inputs.monthlyRent]}
                      onValueChange={([v]) => updateInput("monthlyRent", v)}
                      min={500}
                      max={6000}
                      step={50}
                      data-testid="slider-monthly-rent"
                    />
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>$500</span>
                      <span>$6,000</span>
                    </div>
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    Lease upload is optional — your results work without it.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Your Situation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="downPaymentSaved">Savings for Down Payment</Label>
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
                  <Label htmlFor="zipCode">ZIP Code (Optional)</Label>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assumptions</CardTitle>
                <CardDescription>Adjust these to match your local market.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

          {/* Results */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-2 border-primary lg:sticky lg:top-4" style={{ zIndex: 10 }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Home className="h-5 w-5" />
                  Your rent could cover
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tiersLoading || !primary ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Calculating your numbers...
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-4xl font-bold text-primary" data-testid="text-home-price">
                        {formatCurrency(primary.homePrice)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        A home at roughly your rent of{" "}
                        <span className="font-semibold text-foreground">
                          {formatCurrency(inputs.monthlyRent)}/mo
                        </span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" data-testid="badge-rate">
                          {primary.interestRate.toFixed(3)}% rate
                        </Badge>
                        <Badge variant="secondary" data-testid="badge-down-pct">
                          {(primary.minDownPaymentPct * 100).toFixed(0)}% min down
                        </Badge>
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
                              Enter your email to save your readiness results. When you're ready to
                              apply, your information will be pre-filled — no re-entering data.
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
                              <p>Home price: {formatCurrency(primary.homePrice)}</p>
                              <p>Monthly rent: {formatCurrency(inputs.monthlyRent)}</p>
                              <p>Down payment needed: {formatCurrency(primary.downPaymentNeeded)}</p>
                              <p>Savings: {formatCurrency(inputs.downPaymentSaved)}</p>
                            </div>

                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <Shield className="h-4 w-4 shrink-0 mt-0.5" />
                              <p>
                                Your information is encrypted and will only be used to pre-fill your
                                application when you're ready.
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={() => saveProfileMutation.mutate()}
                              disabled={!saveEmail || saveProfileMutation.isPending}
                              className="w-full"
                              data-testid="button-confirm-save"
                            >
                              {saveProfileMutation.isPending ? "Saving..." : "Save Results"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
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
                  </>
                )}
              </CardContent>
            </Card>

            {primary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Estimated Monthly Payment</CardTitle>
                  <CardDescription>{formatCurrency(monthlyTotal)}/mo</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
                    {paymentBreakdown.map((item) => (
                      <div
                        key={item.label}
                        className={`h-full ${item.color}`}
                        style={{ width: `${(item.value / monthlyTotal) * 100}%` }}
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
            )}
          </div>
        </div>

        {/* Readiness gap + credit tiers (full width) */}
        {primary && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your Readiness Gap</CardTitle>
                <CardDescription>What stands between you and this home.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Down payment needed</p>
                    <p className="text-lg font-bold" data-testid="text-down-needed">
                      {formatCurrency(primary.downPaymentNeeded)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">You've saved</p>
                    <p className="text-lg font-bold" data-testid="text-down-saved">
                      {formatCurrency(inputs.downPaymentSaved)}
                    </p>
                  </div>
                </div>

                {hasDownPayment ? (
                  <div className="flex items-start gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-950/30">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400" />
                    <p className="text-sm">
                      You have enough saved for the down payment on a {formatCurrency(primary.homePrice)} home.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 dark:bg-amber-950/30">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm" data-testid="text-down-gap">
                      You're {formatCurrency(downPaymentGap)} short of the down payment for this price.
                    </p>
                  </div>
                )}

                <div className="space-y-2 border-t pt-3">
                  <p className="text-sm font-medium">Your next steps</p>
                  {nextSteps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <div key={i} className="flex items-start gap-2 text-sm" data-testid={`next-step-${i}`}>
                        <Icon
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            step.tone === "good"
                              ? "text-green-600 dark:text-green-400"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span className="text-muted-foreground">{step.text}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Requirements by Credit Tier</CardTitle>
                <CardDescription>
                  How your buying power changes with your credit score, at this rent.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {tierRows.map(({ tier, result }) => {
                    const isActive = activeTier?.id === tier.id;
                    return (
                      <div
                        key={tier.id}
                        className={`rounded-md p-3 ${
                          isActive ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/40"
                        }`}
                        data-testid={`tier-row-${tier.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{tier.label}</span>
                            {isActive && (
                              <Badge variant="secondary" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm font-bold" data-testid={`tier-price-${tier.id}`}>
                            {formatCurrency(result.homePrice)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          <span>
                            Score {tier.minScore}
                            {tier.maxScore >= 850 ? "+" : `–${tier.maxScore}`}
                          </span>
                          <span>{(tier.minDownPaymentPct * 100).toFixed(0)}% down</span>
                          <span>{tier.interestRate.toFixed(3)}% rate</span>
                          <span>{formatCurrency(result.downPaymentNeeded)} down</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Estimates use representative pricing from our underwriting engine. Your actual rate
                  and terms are confirmed during pre-approval.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </PageShell>
    </div>
  );
}
