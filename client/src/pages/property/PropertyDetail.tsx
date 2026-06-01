import { useMemo, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";

import { Footer } from "@/components/Footer";
import { usePageView, useTrackActivity } from "@/hooks/useActivityTracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import type { Property, LoanApplication, AgentProfile } from "@shared/schema";
import {
  MapPin,
  Bed,
  Bath,
  Square,
  Calendar,
  Home,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Calculator,
  Phone,
  Mail,
  ChevronLeft,
  Heart,
  Share2,
  Percent,
  PiggyBank,
  Building,
} from "lucide-react";

interface QualificationBreakdown {
  meetsGuidelines: boolean;
  status: "within_guidelines" | "requires_review" | "exceeds_guidelines";
  estimatedPayment: number;
  paymentBreakdown: {
    principal: number;
    interest: number;
    taxes: number;
    insurance: number;
    pmi: number;
    hoa: number;
  };
  dtiWithProperty: number;
  requiredDownPayment: number;
  loanAmount: number;
  ltvRatio: number;
  reasons: string[];
  tips: string[];
}

function calculateQualification(
  property: Property,
  preApprovalAmount: number,
  monthlyIncome: number,
  monthlyDebts: number,
  creditScore?: number,
  downPaymentPercent: number = 5
): QualificationBreakdown | null {
  if (monthlyIncome <= 0) {
    return null;
  }
  
  const price = parseFloat(property.price);
  const reasons: string[] = [];
  const tips: string[] = [];
  
  const downPayment = price * (downPaymentPercent / 100);
  const loanAmount = price - downPayment;
  const ltvRatio = (loanAmount / price) * 100;
  
  const annualRate = creditScore && creditScore >= 760 ? 0.0625 : creditScore && creditScore >= 720 ? 0.065 : creditScore && creditScore >= 680 ? 0.07 : 0.075;
  const monthlyRate = annualRate / 12;
  const numPayments = 360;
  
  const monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  // Calculate accurate payment breakdown
  const principalFirstMonth = monthlyPI - (loanAmount * monthlyRate);
  const interestFirstMonth = loanAmount * monthlyRate;
  
  const monthlyTax = (price * 0.0125) / 12;
  const monthlyInsurance = Math.max(100, price * 0.003 / 12);
  const pmi = ltvRatio > 80 ? (loanAmount * 0.008) / 12 : 0;
  const hoa = 0;
  
  const estimatedPayment = monthlyPI + monthlyTax + monthlyInsurance + pmi + hoa;
  const dtiWithProperty = ((estimatedPayment + monthlyDebts) / monthlyIncome) * 100;
  
  // Determine qualification status using deterministic GSE rules
  let status: "within_guidelines" | "requires_review" | "exceeds_guidelines" = "within_guidelines";
  
  if (price > preApprovalAmount) {
    reasons.push(`Property price of ${formatCurrency(price)} exceeds your pre-approval of ${formatCurrency(preApprovalAmount)}`);
    tips.push("Consider properties within your pre-approval amount");
    status = "exceeds_guidelines";
  }
  
  if (dtiWithProperty > 50) {
    reasons.push(`Your DTI would be ${dtiWithProperty.toFixed(1)}% (maximum allowed is 50%)`);
    tips.push("Pay down existing debts to improve your DTI ratio");
    status = "exceeds_guidelines";
  } else if (dtiWithProperty > 43) {
    reasons.push(`DTI of ${dtiWithProperty.toFixed(1)}% requires compensating factors`);
    tips.push("Additional documentation of reserves or income history may be needed");
    if (status !== "exceeds_guidelines") status = "requires_review";
  } else if (dtiWithProperty <= 36) {
    reasons.push(`DTI of ${dtiWithProperty.toFixed(1)}% is within guidelines`);
  } else {
    reasons.push(`DTI of ${dtiWithProperty.toFixed(1)}% is within guidelines`);
  }
  
  if (downPaymentPercent < 20 && pmi > 0) {
    tips.push(`With ${downPaymentPercent}% down, PMI of ${formatCurrency(pmi)}/mo until 20% equity`);
  }
  
  if (creditScore !== undefined && creditScore < 680) {
    tips.push("Improving your credit score could lower your interest rate");
  }
  
  return {
    meetsGuidelines: status !== "exceeds_guidelines",
    status,
    estimatedPayment,
    paymentBreakdown: {
      principal: principalFirstMonth,
      interest: interestFirstMonth,
      taxes: monthlyTax,
      insurance: monthlyInsurance,
      pmi,
      hoa,
    },
    dtiWithProperty,
    requiredDownPayment: downPayment,
    loanAmount,
    ltvRatio,
    reasons,
    tips,
  };
}

export default function PropertyDetail() {
  const params = useParams();
  const propertyId = params?.id as string;
  usePageView("/properties/detail");
  const trackActivity = useTrackActivity();

  useEffect(() => {
    try { localStorage.setItem("homiquity_browsed_properties", "true"); } catch {}
  }, []);

  const { data: property, isLoading: propertyLoading } = useQuery<Property>({
    queryKey: ['/api/properties', propertyId],
  });

  useEffect(() => {
    if (property) {
      trackActivity("property_view", `/properties/${params.id}`, { propertyId: params.id });
    }
  }, [property?.id]);

  const { data: applications } = useQuery<LoanApplication[]>({
    queryKey: ["/api/loan-applications"],
  });

  const { data: agent } = useQuery<AgentProfile & { user?: { firstName: string; lastName: string; email: string } }>({
    queryKey: property?.agentId ? ['/api/agents', property.agentId] : [],
    enabled: !!property?.agentId,
  });

  // Get pre-approval data
  const preApproval = useMemo(() => {
    if (!applications?.length) return null;
    return applications.find(app => app.status === "pre_approved" || app.status === "approved") || applications[0];
  }, [applications]);

  const hasPreApproval = preApproval && 
    preApproval.annualIncome && 
    parseFloat(String(preApproval.annualIncome)) > 0;

  const preApprovalAmount = preApproval?.preApprovalAmount 
    ? parseFloat(String(preApproval.preApprovalAmount))
    : 0;
  const monthlyIncome = preApproval?.annualIncome 
    ? parseFloat(String(preApproval.annualIncome)) / 12
    : 0;
  const monthlyDebts = preApproval?.monthlyDebts 
    ? parseFloat(String(preApproval.monthlyDebts))
    : 0;
  const creditScore = preApproval?.creditScore || undefined;

  // Calculate qualification
  const qualification = useMemo(() => {
    if (!property) return null;
    return calculateQualification(property, preApprovalAmount, monthlyIncome, monthlyDebts, creditScore);
  }, [property, preApprovalAmount, monthlyIncome, monthlyDebts, creditScore]);

  if (propertyLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center">
          <Home className="mx-auto h-16 w-16 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Property Not Found</h1>
          <Link href="/buy">
            <Button className="mt-4">Browse Properties</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Link href="/buy">
          <Button variant="ghost" className="mb-4 gap-2">
            <ChevronLeft className="h-4 w-4" />
            Back to Search
          </Button>
        </Link>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Property Image */}
            <div className="relative mb-6 h-80 overflow-hidden rounded-xl bg-muted lg:h-96">
              {property.images && property.images.length > 0 ? (
                <img
                  src={property.images[0]}
                  alt={property.address}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Home className="h-24 w-24 text-muted-foreground/30" />
                </div>
              )}
              
              {/* Action Buttons */}
              <div className="absolute right-4 top-4 flex gap-2">
                <Button variant="secondary" size="icon">
                  <Heart className="h-4 w-4" />
                </Button>
                <Button variant="secondary" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Property Header */}
            <div className="mb-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-3xl font-bold">{formatCurrency(parseFloat(property.price))}</h1>
                  <p className="mt-1 text-lg font-medium">{property.address}</p>
                  <p className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {property.city}, {property.state} {property.zipCode}
                  </p>
                </div>
                
                {qualification && (
                  <Badge 
                    className={`gap-1 px-3 py-1.5 text-base ${
                      qualification.status === "within_guidelines" ? "bg-green-500" :
                      qualification.status === "requires_review" ? "bg-yellow-500" : "bg-red-500"
                    }`}
                  >
                    {qualification.status === "within_guidelines" && <CheckCircle className="h-4 w-4" />}
                    {qualification.status === "requires_review" && <AlertTriangle className="h-4 w-4" />}
                    {qualification.status === "exceeds_guidelines" && <XCircle className="h-4 w-4" />}
                    {qualification.status === "within_guidelines" ? "Within Guidelines" :
                     qualification.status === "requires_review" ? "Requires Review" : "Exceeds Guidelines"}
                  </Badge>
                )}
              </div>

              {/* Property Stats */}
              <div className="mt-4 flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Bed className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{property.bedrooms}</span>
                  <span className="text-muted-foreground">beds</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bath className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{property.bathrooms}</span>
                  <span className="text-muted-foreground">baths</span>
                </div>
                {property.squareFeet && (
                  <div className="flex items-center gap-2">
                    <Square className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{property.squareFeet.toLocaleString()}</span>
                    <span className="text-muted-foreground">sqft</span>
                  </div>
                )}
                {property.yearBuilt && (
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <span className="text-muted-foreground">Built {property.yearBuilt}</span>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-6" />

            {/* Description */}
            {property.description && (
              <div className="mb-8">
                <h2 className="mb-3 text-xl font-semibold">About This Property</h2>
                <p className="leading-relaxed text-muted-foreground">{property.description}</p>
              </div>
            )}

            {/* Features */}
            {property.features && property.features.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-xl font-semibold">Features</h2>
                <div className="flex flex-wrap gap-2">
                  {property.features.map((feature, i) => (
                    <Badge key={i} variant="secondary">{feature}</Badge>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Sidebar - Qualification Details */}
          <div className="space-y-6">
            {/* No Pre-Approval Banner */}
            {!hasPreApproval && (
              <Card className="border-primary bg-primary/5">
                <CardContent className="p-6 text-center">
                  <Calculator className="mx-auto h-10 w-10 text-primary" />
                  <h3 className="mt-3 text-lg font-semibold">Get Pre-Approved</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Complete a loan application to see personalized affordability calculations for this property
                  </p>
                  <Link href={`/apply?price=${property.price}&state=${property.state || ''}&propertyType=${property.propertyType || ''}&source=property-detail&propertyId=${propertyId}`}>
                    <Button className="mt-4 w-full">
                      Start Pre-Approval
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Monthly Payment Card */}
            {qualification && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5" />
                    Your Monthly Payment
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 text-center">
                    <p className="text-4xl font-bold text-primary">
                      {formatCurrency(qualification.estimatedPayment)}
                    </p>
                    <p className="text-sm text-muted-foreground">per month</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Principal & Interest</span>
                      <span>{formatCurrency(qualification.paymentBreakdown.principal + qualification.paymentBreakdown.interest)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Property Taxes</span>
                      <span>{formatCurrency(qualification.paymentBreakdown.taxes)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Home Insurance</span>
                      <span>{formatCurrency(qualification.paymentBreakdown.insurance)}</span>
                    </div>
                    {qualification.paymentBreakdown.pmi > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">PMI</span>
                        <span>{formatCurrency(qualification.paymentBreakdown.pmi)}</span>
                      </div>
                    )}
                  </div>

                  <Separator className="my-4" />

                  {/* DTI Indicator */}
                  <div className="mb-4">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">Debt-to-Income Ratio</span>
                      <span className={
                        qualification.dtiWithProperty > 43 
                          ? "font-medium text-yellow-600" 
                          : "font-medium text-green-600"
                      }>
                        {qualification.dtiWithProperty.toFixed(1)}%
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(qualification.dtiWithProperty, 50)} 
                      className="h-2"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Maximum allowed: 50% | Ideal: under 36%
                    </p>
                  </div>

                  {/* Loan Details */}
                  <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <PiggyBank className="h-4 w-4" />
                        Down Payment (5%)
                      </span>
                      <span className="font-medium">{formatCurrency(qualification.requiredDownPayment)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Building className="h-4 w-4" />
                        Loan Amount
                      </span>
                      <span className="font-medium">{formatCurrency(qualification.loanAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Percent className="h-4 w-4" />
                        LTV Ratio
                      </span>
                      <span className="font-medium">{qualification.ltvRatio.toFixed(0)}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Qualification Status */}
            {qualification && (
              <Card className={
                qualification.status === "within_guidelines" ? "border-green-200 bg-green-50/50" :
                qualification.status === "requires_review" ? "border-yellow-200 bg-yellow-50/50" : 
                "border-red-200 bg-red-50/50"
              }>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {qualification.status === "within_guidelines" && <CheckCircle className="h-5 w-5 text-green-600" />}
                    {qualification.status === "requires_review" && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                    {qualification.status === "exceeds_guidelines" && <XCircle className="h-5 w-5 text-red-600" />}
                    {qualification.status === "within_guidelines" ? "Within Guidelines" :
                     qualification.status === "requires_review" ? "Requires Review" : "Exceeds Guidelines"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {qualification.reasons.map((reason, i) => (
                      <li key={i} className="text-muted-foreground">{reason}</li>
                    ))}
                  </ul>
                  
                  {qualification.tips.length > 0 && (
                    <div className="mt-4 rounded-lg bg-background/60 p-3">
                      <p className="mb-1 text-xs font-medium">Tips:</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {qualification.tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Agent Card */}
            {agent && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Listing Agent</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {agent.photoUrl && (
                      <img
                        src={agent.photoUrl}
                        alt={agent.user?.firstName}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    )}
                    <div>
                      <p className="font-medium">
                        {agent.user?.firstName} {agent.user?.lastName}
                      </p>
                      {agent.brokerage && (
                        <p className="text-sm text-muted-foreground">{agent.brokerage}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    {agent.phoneNumber && (
                      <Button variant="outline" size="sm" className="flex-1 gap-1">
                        <Phone className="h-4 w-4" />
                        Call
                      </Button>
                    )}
                    <Button size="sm" className="flex-1 gap-1">
                      <Mail className="h-4 w-4" />
                      Message
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="p-6 text-center">
                <TrendingUp className="mx-auto h-8 w-8" />
                <h3 className="mt-2 text-lg font-semibold">Ready to Make an Offer?</h3>
                <p className="mt-1 text-sm opacity-90">
                  Get a detailed loan estimate for this property
                </p>
                <Link href={`/apply?price=${property.price}&state=${property.state || ''}&propertyType=${property.propertyType || ''}&source=property-detail&propertyId=${propertyId}`}>
                  <Button variant="secondary" className="mt-4 w-full">
                    Get Loan Estimate
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
