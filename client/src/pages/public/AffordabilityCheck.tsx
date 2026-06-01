import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressInput, type AddressResult } from "@/components/AddressInput";
import { PropertyMap } from "@/components/PropertyMap";
import { StreetView } from "@/components/StreetView";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Home,
  MapPin,
  BedDouble,
  Bath,
  Maximize,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  Loader2,
  TrendingUp,
  Shield,
  Wallet,
} from "lucide-react";

interface PropertyData {
  propertyId: string;
  price: number;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  zipcode: string;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  yearBuilt: number | null;
  propertyType: string;
  photo: string | null;
  photos: string[];
  status: string;
  propertyTaxRate: number;
  hoaMonthly: number;
  mortgage: { monthlyPayment: number; rate: number | null } | null;
  neighborhoods: { name: string; medianPrice: number | null }[];
}

interface FinancialInputs {
  annualIncome: number;
  monthlyDebts: number;
  downPayment: number;
  creditScore: number;
  interestRate: number;
}

interface AffordabilityResult {
  monthlyPayment: number;
  principalInterest: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyPMI: number;
  monthlyHOA: number;
  loanAmount: number;
  downPaymentPercent: number;
  frontEndDTI: number;
  backEndDTI: number;
  status: "affordable" | "stretch" | "over_budget";
  maxBackEndDTI: number;
}

function calculateAffordabilityForProperty(
  property: PropertyData,
  inputs: FinancialInputs,
): AffordabilityResult {
  const { annualIncome, monthlyDebts, downPayment, creditScore, interestRate } = inputs;
  const price = property.price;

  if (price <= 0) {
    return {
      monthlyPayment: 0, principalInterest: 0, monthlyTax: 0, monthlyInsurance: 0,
      monthlyPMI: 0, monthlyHOA: 0, loanAmount: 0, downPaymentPercent: 0,
      frontEndDTI: 0, backEndDTI: 0, status: "affordable" as const, maxBackEndDTI: 43,
    };
  }

  const effectiveDown = Math.min(downPayment, price * 0.5);
  const loanAmount = price - effectiveDown;
  const downPaymentPercent = (effectiveDown / price) * 100;
  const monthlyRate = interestRate / 100 / 12;
  const numPayments = 360;

  let principalInterest = 0;
  if (monthlyRate > 0) {
    principalInterest =
      (loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else {
    principalInterest = loanAmount / numPayments;
  }

  const monthlyTax = (price * property.propertyTaxRate) / 100 / 12;
  const monthlyInsurance = (price * 0.005) / 12;
  const monthlyPMI = downPaymentPercent < 20 ? (loanAmount * 0.005) / 12 : 0;
  const monthlyHOA = property.hoaMonthly || 0;
  const monthlyPayment = principalInterest + monthlyTax + monthlyInsurance + monthlyPMI + monthlyHOA;

  const monthlyIncome = annualIncome / 12;
  const frontEndDTI = monthlyIncome > 0 ? (monthlyPayment / monthlyIncome) * 100 : 100;
  const backEndDTI = monthlyIncome > 0 ? ((monthlyPayment + monthlyDebts) / monthlyIncome) * 100 : 100;

  const maxBackEndDTI = creditScore >= 740 ? 45 : creditScore >= 700 ? 43 : 41;

  let status: "affordable" | "stretch" | "over_budget" = "affordable";
  if (backEndDTI > maxBackEndDTI || frontEndDTI > 28) {
    status = "over_budget";
  } else if (backEndDTI > maxBackEndDTI - 5 || frontEndDTI > 25) {
    status = "stretch";
  }

  return {
    monthlyPayment,
    principalInterest,
    monthlyTax,
    monthlyInsurance,
    monthlyPMI,
    monthlyHOA,
    loanAmount,
    downPaymentPercent,
    frontEndDTI,
    backEndDTI,
    status,
    maxBackEndDTI,
  };
}

function StatusBadge({ status }: { status: string }) {
  if (status === "affordable") {
    return (
      <Badge variant="default" className="bg-green-600 text-white gap-1" data-testid="badge-affordable">
        <CheckCircle2 className="h-3 w-3" />
        Within Your Budget
      </Badge>
    );
  }
  if (status === "stretch") {
    return (
      <Badge variant="default" className="bg-amber-500 text-white gap-1" data-testid="badge-stretch">
        <AlertTriangle className="h-3 w-3" />
        Stretch Budget
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="gap-1" data-testid="badge-over-budget">
      <XCircle className="h-3 w-3" />
      Over Budget
    </Badge>
  );
}

function parseCurrencyInput(value: string): number {
  return parseInt(value.replace(/[^0-9]/g, ""), 10) || 0;
}

function formatInputCurrency(value: number): string {
  return value.toLocaleString("en-US");
}

export default function AffordabilityCheck() {
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [financials, setFinancials] = useState<FinancialInputs>({
    annualIncome: 100000,
    monthlyDebts: 500,
    downPayment: 50000,
    creditScore: 700,
    interestRate: 6.75,
  });

  const lookupMutation = useMutation({
    mutationFn: async (q: string) => {
      const res = await apiRequest("POST", "/api/properties/lookup", { query: q });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.found && data.property) {
        setProperty(data.property);
        setNotFound(null);
        if (data.property.price > 0) {
          setFinancials((prev) => ({
            ...prev,
            downPayment: Math.round(data.property.price * 0.1),
          }));
        }
      } else {
        setProperty(null);
        setNotFound(data.message || "No property found at that address.");
      }
    },
    onError: () => {
      toast({
        title: "Lookup failed",
        description: "Couldn't find that property. Make sure the address is correct.",
        variant: "destructive",
      });
    },
  });

  const result = useMemo(() => {
    if (!property) return null;
    return calculateAffordabilityForProperty(property, financials);
  }, [property, financials]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    lookupMutation.mutate(query.trim());
  }

  function handleStartApplication() {
    if (!property || !result) return;
    const params = new URLSearchParams({
      price: String(property.price),
      state: property.stateCode,
      propertyType: property.propertyType === "single_family" ? "single_family" : property.propertyType,
    });
    navigate(`/apply?${params.toString()}`);
  }

  const propertyTypeLabels: Record<string, string> = {
    single_family: "Single Family",
    condo: "Condo",
    townhomes: "Townhouse",
    multi_family: "Multi-Family",
    apartment: "Apartment",
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-primary/5 dark:bg-primary/10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-12 md:py-16 text-center">
          <Link href="/">
            <span className="text-2xl font-bold tracking-tight text-primary cursor-pointer" data-testid="text-brand-logo">
              homiquity
            </span>
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mt-6 mb-3" data-testid="text-page-title">
            Can I Afford This Home?
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Found a home you love on Zillow, Redfin, or Realtor.com?
            Paste the address or listing URL below to get a complete affordability picture.
          </p>
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Paste a Zillow/Redfin URL or type an address..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-12 text-base"
                  data-testid="input-property-search"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                disabled={lookupMutation.isPending || !query.trim()}
                data-testid="button-search-property"
              >
                {lookupMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Analyze"
                )}
              </Button>
            </div>
          </form>
          {notFound && (
            <p className="text-destructive text-sm mt-4" data-testid="text-not-found">{notFound}</p>
          )}
        </div>
      </div>

      {property && result && (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                {property.photo ? (
                  <div className="md:w-80 h-56 md:h-auto flex-shrink-0">
                    <img
                      src={property.photo}
                      alt={property.address}
                      className="w-full h-full object-cover rounded-t-lg md:rounded-l-lg md:rounded-tr-none"
                      data-testid="img-property-photo"
                    />
                  </div>
                ) : property.coordinate && (
                  <div className="md:w-80 h-56 md:h-auto flex-shrink-0 rounded-t-lg md:rounded-l-lg md:rounded-tr-none overflow-hidden">
                    <StreetView lat={property.coordinate.lat} lng={property.coordinate.lon || property.coordinate.lng} height={224} />
                  </div>
                )}
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <p className="text-2xl font-bold" data-testid="text-property-price">
                        {formatCurrency(property.price)}
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 mt-1" data-testid="text-property-address">
                        <MapPin className="h-3.5 w-3.5" />
                        {property.address}, {property.city}, {property.stateCode} {property.zipcode}
                      </p>
                    </div>
                    <StatusBadge status={result.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground">
                    {property.beds !== null && (
                      <span className="flex items-center gap-1" data-testid="text-beds">
                        <BedDouble className="h-4 w-4" /> {property.beds} beds
                      </span>
                    )}
                    {property.baths !== null && (
                      <span className="flex items-center gap-1" data-testid="text-baths">
                        <Bath className="h-4 w-4" /> {property.baths} baths
                      </span>
                    )}
                    {property.sqft !== null && (
                      <span className="flex items-center gap-1" data-testid="text-sqft">
                        <Maximize className="h-4 w-4" /> {property.sqft.toLocaleString()} sqft
                      </span>
                    )}
                    {property.yearBuilt && (
                      <span className="flex items-center gap-1" data-testid="text-year-built">
                        <Calendar className="h-4 w-4" /> Built {property.yearBuilt}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Home className="h-4 w-4" /> {propertyTypeLabels[property.propertyType] || property.propertyType}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {property.coordinate && (
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <PropertyMap
                  lat={property.coordinate.lat}
                  lng={property.coordinate.lon || property.coordinate.lng}
                  address={`${property.address}, ${property.city}, ${property.stateCode}`}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  Your Financial Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Annual Household Income</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={formatInputCurrency(financials.annualIncome)}
                      onChange={(e) => setFinancials({ ...financials, annualIncome: parseCurrencyInput(e.target.value) })}
                      data-testid="input-annual-income"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Monthly Debts (car, student loans, etc.)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={formatInputCurrency(financials.monthlyDebts)}
                      onChange={(e) => setFinancials({ ...financials, monthlyDebts: parseCurrencyInput(e.target.value) })}
                      data-testid="input-monthly-debts"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Down Payment</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      value={formatInputCurrency(financials.downPayment)}
                      onChange={(e) => setFinancials({ ...financials, downPayment: parseCurrencyInput(e.target.value) })}
                      data-testid="input-down-payment"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {result.downPaymentPercent.toFixed(1)}% of purchase price
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Credit Score</Label>
                    <span className="text-sm font-medium" data-testid="text-credit-score">{financials.creditScore}</span>
                  </div>
                  <Slider
                    value={[financials.creditScore]}
                    onValueChange={([v]) => setFinancials({ ...financials, creditScore: v })}
                    min={580}
                    max={850}
                    step={10}
                    data-testid="slider-credit-score"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>580</span>
                    <span>850</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Interest Rate</Label>
                    <span className="text-sm font-medium">{financials.interestRate.toFixed(2)}%</span>
                  </div>
                  <Slider
                    value={[financials.interestRate * 100]}
                    onValueChange={([v]) => setFinancials({ ...financials, interestRate: v / 100 })}
                    min={300}
                    max={1000}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Monthly Payment Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold mb-4" data-testid="text-monthly-payment">
                    {formatCurrency(result.monthlyPayment)}
                    <span className="text-base font-normal text-muted-foreground">/mo</span>
                  </p>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Principal & Interest</span>
                      <span className="font-medium">{formatCurrency(result.principalInterest)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Property Tax</span>
                      <span className="font-medium">{formatCurrency(result.monthlyTax)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Home Insurance</span>
                      <span className="font-medium">{formatCurrency(result.monthlyInsurance)}</span>
                    </div>
                    {result.monthlyPMI > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">PMI</span>
                        <span className="font-medium">{formatCurrency(result.monthlyPMI)}</span>
                      </div>
                    )}
                    {result.monthlyHOA > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">HOA</span>
                        <span className="font-medium">{formatCurrency(result.monthlyHOA)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Loan Amount</span>
                      <span className="font-medium">{formatCurrency(result.loanAmount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Qualification Check
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Front-End DTI (Housing)</span>
                      <span className={`text-sm font-medium ${result.frontEndDTI > 28 ? "text-destructive" : "text-green-600"}`}>
                        {result.frontEndDTI.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${result.frontEndDTI > 28 ? "bg-destructive" : result.frontEndDTI > 25 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(result.frontEndDTI / 40 * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Target: 28% or less</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-muted-foreground">Back-End DTI (All Debts)</span>
                      <span className={`text-sm font-medium ${result.backEndDTI > result.maxBackEndDTI ? "text-destructive" : "text-green-600"}`}>
                        {result.backEndDTI.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${result.backEndDTI > result.maxBackEndDTI ? "bg-destructive" : result.backEndDTI > result.maxBackEndDTI - 5 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${Math.min(result.backEndDTI / 55 * 100, 100)}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Target: {result.maxBackEndDTI}% or less (based on your credit score)</p>
                  </div>

                  {result.downPaymentPercent < 20 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Your down payment is {result.downPaymentPercent.toFixed(1)}% — below 20%. PMI of {formatCurrency(result.monthlyPMI)}/mo is included.
                        Increasing your down payment to {formatCurrency(property.price * 0.2)} eliminates PMI.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full gap-2"
                onClick={handleStartApplication}
                data-testid="button-start-application"
              >
                Start Your Application for This Home
                <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                No hard credit check. Takes about 3 minutes. Pre-filled with this property.
              </p>
            </div>
          </div>
        </div>
      )}

      {!property && !lookupMutation.isPending && (
        <div className="max-w-4xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Paste Any Address</h3>
                <p className="text-sm text-muted-foreground">
                  Copy a listing URL from Zillow, Redfin, or Realtor.com — or just type the address.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">See the Full Picture</h3>
                <p className="text-sm text-muted-foreground">
                  Monthly payment, DTI analysis, PMI, taxes — everything calculated for your specific situation.
                </p>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-6">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <ArrowRight className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">Apply in 3 Minutes</h3>
                <p className="text-sm text-muted-foreground">
                  Ready to move forward? Start a pre-approval application pre-filled with this property.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
