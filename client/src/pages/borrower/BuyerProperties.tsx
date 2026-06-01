import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddressInput } from "@/components/AddressInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/formatters";
import type { Property, LoanApplication } from "@shared/schema";
import {
  Search,
  MapPin,
  Bed,
  Bath,
  Square,
  Heart,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Home,
  Calculator,
  Filter,
  Sparkles,
} from "lucide-react";

const PROPERTY_TYPES = [
  { value: "all", label: "All Types" },
  { value: "single_family", label: "Single Family" },
  { value: "condo", label: "Condo" },
  { value: "townhouse", label: "Townhouse" },
  { value: "multi_family", label: "Multi-Family" },
];

interface AffordabilityCheck {
  meetsGuidelines: boolean;
  estimatedPayment: number;
  dtiWithProperty: number;
  reasons: string[];
  status: "within_guidelines" | "requires_review" | "exceeds_guidelines";
}

function calculateAffordability(
  property: Property,
  preApprovalAmount: number,
  monthlyIncome: number,
  monthlyDebts: number,
  creditScore?: number
): AffordabilityCheck {
  const price = parseFloat(property.price);
  const reasons: string[] = [];
  
  if (monthlyIncome <= 0) {
    return {
      meetsGuidelines: false,
      estimatedPayment: 0,
      dtiWithProperty: 0,
      reasons: ["Income data required for affordability check"],
      status: "exceeds_guidelines",
    };
  }
  
  const baseRate = creditScore && creditScore >= 760 ? 0.0625 : creditScore && creditScore >= 720 ? 0.065 : creditScore && creditScore >= 680 ? 0.07 : 0.075;
  
  // Estimate monthly payment (P&I at rate-adjusted for 30 years + taxes + insurance)
  const downPaymentPercent = 5; // Standard minimum
  const loanAmount = price * (1 - downPaymentPercent / 100);
  const monthlyRate = baseRate / 12;
  const numPayments = 360;
  const monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  
  const monthlyTax = (price * 0.0125) / 12; // 1.25% annual property tax
  const monthlyInsurance = Math.max(100, price * 0.003 / 12); // ~0.3% of home value annually
  const pmi = loanAmount > price * 0.8 ? (loanAmount * 0.008) / 12 : 0; // ~0.8% PMI rate
  
  const estimatedPayment = monthlyPI + monthlyTax + monthlyInsurance + pmi;
  const dtiWithProperty = ((estimatedPayment + monthlyDebts) / monthlyIncome) * 100;
  
  // Check qualification using deterministic rules
  let status: "within_guidelines" | "requires_review" | "exceeds_guidelines" = "within_guidelines";
  
  // Price vs pre-approval check
  if (price > preApprovalAmount) {
    reasons.push(`Price exceeds pre-approval of ${formatCurrency(preApprovalAmount)}`);
    status = "exceeds_guidelines";
  }
  
  // DTI checks (aligned with GSE guidelines)
  if (dtiWithProperty > 50) {
    reasons.push(`DTI would be ${dtiWithProperty.toFixed(1)}% (max allowed is 50%)`);
    status = "exceeds_guidelines";
  } else if (dtiWithProperty > 43) {
    reasons.push(`DTI of ${dtiWithProperty.toFixed(1)}% may require compensating factors`);
    if (status !== "exceeds_guidelines") status = "requires_review";
  } else if (dtiWithProperty <= 36) {
    reasons.push(`DTI of ${dtiWithProperty.toFixed(1)}% is within guidelines`);
  } else {
    reasons.push(`DTI of ${dtiWithProperty.toFixed(1)}% is within guidelines`);
  }
  
  return {
    meetsGuidelines: status !== "exceeds_guidelines",
    estimatedPayment,
    dtiWithProperty,
    reasons,
    status,
  };
}

function AffordabilityBadge({ status }: { status: "within_guidelines" | "requires_review" | "exceeds_guidelines" }) {
  if (status === "within_guidelines") {
    return (
      <Badge className="gap-1 bg-green-500/90 text-white hover:bg-green-500">
        <CheckCircle className="h-3 w-3" />
        Within Guidelines
      </Badge>
    );
  }
  if (status === "requires_review") {
    return (
      <Badge className="gap-1 bg-yellow-500/90 text-white hover:bg-yellow-500">
        <AlertTriangle className="h-3 w-3" />
        Requires Review
      </Badge>
    );
  }
  return (
    <Badge className="gap-1 bg-red-500/90 text-white hover:bg-red-500" variant="destructive">
      <XCircle className="h-3 w-3" />
      Exceeds Guidelines
    </Badge>
  );
}

export default function BuyerProperties() {
  const [searchQuery, setSearchQuery] = useState("");
  const [propertyType, setPropertyType] = useState("all");
  const [showOnlyAffordable, setShowOnlyAffordable] = useState(false); // Default to false, show all properties
  const [priceRange, setPriceRange] = useState([0, 2000000]);

  // Get user's pre-approval data
  const { data: applications } = useQuery<LoanApplication[]>({
    queryKey: ["/api/loan-applications"],
  });

  const { data: properties, isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  // Get the latest pre-approved application
  const preApproval = useMemo(() => {
    if (!applications?.length) return null;
    const approved = applications.find(
      (app) => app.status === "pre_approved" || app.status === "approved"
    );
    return approved || applications[0];
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

  // Calculate affordability for each property (only if pre-approved)
  const propertiesWithAffordability = useMemo(() => {
    if (!properties) return [];
    
    // If no pre-approval, return properties without affordability data
    if (!hasPreApproval) {
      return properties.map((property) => ({
        ...property,
        affordability: {
          meetsGuidelines: false,
          estimatedPayment: 0,
          dtiWithProperty: 0,
          reasons: [],
          status: "exceeds_guidelines" as const,
        },
      }));
    }
    
    return properties.map((property) => ({
      ...property,
      affordability: calculateAffordability(
        property,
        preApprovalAmount,
        monthlyIncome,
        monthlyDebts,
        creditScore
      ),
    }));
  }, [properties, hasPreApproval, preApprovalAmount, monthlyIncome, monthlyDebts, creditScore]);

  // Filter properties - affordability filtering only when pre-approved AND toggle is on
  const filteredProperties = useMemo(() => {
    return propertiesWithAffordability.filter((property) => {
      const price = parseFloat(property.price);
      
      // Only filter by affordability if user has pre-approval AND toggle is on
      if (hasPreApproval && showOnlyAffordable && !property.affordability.meetsGuidelines) return false;
      
      // Standard filters always apply
      if (propertyType !== "all" && property.propertyType !== propertyType) return false;
      if (price < priceRange[0] || price > priceRange[1]) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!property.address.toLowerCase().includes(query) &&
            !property.city.toLowerCase().includes(query) &&
            !property.state.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      return true;
    });
  }, [propertiesWithAffordability, hasPreApproval, showOnlyAffordable, propertyType, priceRange, searchQuery]);

  // Stats - only calculate when user has pre-approval
  const stats = useMemo(() => {
    if (!hasPreApproval) {
      return { withinGuidelines: 0, requiresReview: 0, exceedsGuidelines: 0, total: 0 };
    }
    const withinGuidelines = propertiesWithAffordability.filter(p => p.affordability.status === "within_guidelines").length;
    const requiresReview = propertiesWithAffordability.filter(p => p.affordability.status === "requires_review").length;
    const exceedsGuidelines = propertiesWithAffordability.filter(p => p.affordability.status === "exceeds_guidelines").length;
    return { withinGuidelines, requiresReview, exceedsGuidelines, total: propertiesWithAffordability.length };
  }, [propertiesWithAffordability, hasPreApproval]);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-primary to-primary/80 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-3xl font-bold text-white sm:text-4xl">
                <Sparkles className="h-8 w-8" />
                Homes You Can Afford
              </h1>
              <p className="mt-2 text-lg text-white/80">
                Based on your pre-approval, we found properties that match your budget
              </p>
            </div>
            
            {hasPreApproval ? (
              <Card className="w-full bg-white/10 backdrop-blur-sm lg:w-auto">
                <CardContent className="p-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm text-white/70">Pre-Approved For</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(preApprovalAmount)}
                      </p>
                    </div>
                    <div className="h-12 w-px bg-white/20" />
                    <div>
                      <p className="text-sm text-white/70">Monthly Income</p>
                      <p className="text-lg font-semibold text-white">
                        {formatCurrency(monthlyIncome)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="w-full bg-yellow-500/20 backdrop-blur-sm lg:w-auto">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertTriangle className="h-6 w-6 text-yellow-300" />
                  <div>
                    <p className="font-medium text-white">Get Pre-Approved First</p>
                    <p className="text-sm text-white/70">Complete an application to see personalized affordability</p>
                  </div>
                  <Link href="/apply">
                    <Button variant="secondary" size="sm" className="ml-2">
                      Apply Now
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Stats - Only show when pre-approved */}
          {hasPreApproval && (
            <div className="mt-8 grid grid-cols-3 gap-4">
              <Card className="bg-green-500/20 backdrop-blur-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <CheckCircle className="h-8 w-8 text-green-300" />
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.withinGuidelines}</p>
                    <p className="text-sm text-white/70">Within Guidelines</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-500/20 backdrop-blur-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <AlertTriangle className="h-8 w-8 text-yellow-300" />
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.requiresReview}</p>
                    <p className="text-sm text-white/70">Requires Review</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-red-500/20 backdrop-blur-sm">
                <CardContent className="flex items-center gap-3 p-4">
                  <XCircle className="h-8 w-8 text-red-300" />
                  <div>
                    <p className="text-2xl font-bold text-white">{stats.exceedsGuidelines}</p>
                    <p className="text-sm text-white/70">Exceeds Guidelines</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label className="mb-2 block text-sm font-medium">Search Location</label>
                <AddressInput
                  placeholder="City, address, or ZIP code"
                  defaultValue={searchQuery}
                  onSelect={(result) => {
                    const loc = result.city && result.state ? `${result.city}, ${result.state}` : result.formattedAddress;
                    setSearchQuery(loc);
                  }}
                />
              </div>

              <div className="w-full lg:w-48">
                <label className="mb-2 block text-sm font-medium">Property Type</label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full lg:w-64">
                <label className="mb-2 block text-sm font-medium">
                  Max Price: {formatCurrency(priceRange[1])}
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  min={0}
                  max={Math.max(preApprovalAmount * 1.5, 2000000)}
                  step={25000}
                  className="py-2"
                />
              </div>

              {hasPreApproval && (
                <div className="flex items-center gap-2">
                  <Switch
                    checked={showOnlyAffordable}
                    onCheckedChange={setShowOnlyAffordable}
                    data-testid="switch-affordable"
                  />
                  <label className="text-sm font-medium">Only show affordable</label>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results Count */}
        <div className="mb-6 flex items-center justify-between">
          <p className="text-muted-foreground">
            {filteredProperties.length} homes {hasPreApproval && showOnlyAffordable ? "you can afford" : "found"}
          </p>
          {!hasPreApproval && (
            <Link href="/apply">
              <Button className="gap-2">
                <Calculator className="h-4 w-4" />
                Get Pre-Approved First
              </Button>
            </Link>
          )}
        </div>

        {/* Property Grid */}
        {propertiesLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-96" />
            ))}
          </div>
        ) : filteredProperties.length === 0 ? (
          <div className="py-16 text-center">
            <Home className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No matching properties</h3>
            <p className="mt-2 text-muted-foreground">
              {hasPreApproval && showOnlyAffordable 
                ? "Try turning off the 'Only show affordable' filter"
                : "Try adjusting your search filters"}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredProperties.map((property) => (
              <Link key={property.id} href={`/property/${property.id}`}>
                <Card className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg">
                  {/* Property Image */}
                  <div className="relative h-48 bg-muted">
                    {property.images && property.images.length > 0 ? (
                      <img
                        src={property.images[0]}
                        alt={property.address}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Home className="h-16 w-16 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    {/* Affordability Badge - Only show with pre-approval */}
                    {hasPreApproval && (
                      <div className="absolute left-3 top-3">
                        <AffordabilityBadge status={property.affordability.status} />
                      </div>
                    )}
                    
                    {/* Save Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-3 top-3 bg-white/80 hover:bg-white"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                    >
                      <Heart className="h-4 w-4" />
                    </Button>
                  </div>

                  <CardContent className="p-4">
                    {/* Price */}
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(parseFloat(property.price))}
                      </p>
                      {hasPreApproval && property.affordability.status === "within_guidelines" && (
                        <Badge variant="outline" className="text-green-600">
                          <TrendingUp className="mr-1 h-3 w-3" />
                          Within Guidelines
                        </Badge>
                      )}
                    </div>

                    {/* Address */}
                    <p className="mt-2 font-medium text-foreground">{property.address}</p>
                    <p className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {property.city}, {property.state} {property.zipCode}
                    </p>

                    {/* Property Details */}
                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Bed className="h-4 w-4" />
                        {property.bedrooms} bd
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath className="h-4 w-4" />
                        {property.bathrooms} ba
                      </span>
                      {property.squareFeet && (
                        <span className="flex items-center gap-1">
                          <Square className="h-4 w-4" />
                          {property.squareFeet.toLocaleString()} sqft
                        </span>
                      )}
                    </div>

                    {/* Monthly Payment Estimate - Only show with pre-approval */}
                    {hasPreApproval ? (
                      <div className="mt-4 rounded-lg bg-muted/50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Est. Monthly</span>
                          <span className="font-semibold">
                            {formatCurrency(property.affordability.estimatedPayment)}/mo
                          </span>
                        </div>
                        <div className="mt-2">
                          <div className="flex items-center justify-between text-xs">
                            <span>DTI Impact</span>
                            <span className={
                              property.affordability.dtiWithProperty > 43 
                                ? "text-yellow-600" 
                                : "text-green-600"
                            }>
                              {property.affordability.dtiWithProperty.toFixed(1)}%
                            </span>
                          </div>
                          <Progress 
                            value={Math.min(property.affordability.dtiWithProperty, 50)} 
                            className="mt-1 h-1.5"
                          />
                        </div>
                        {/* Reason */}
                        {property.affordability.reasons.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {property.affordability.reasons[0]}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg bg-primary/5 p-3 text-center">
                        <p className="text-sm text-muted-foreground">
                          Get pre-approved to see your monthly payment
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
