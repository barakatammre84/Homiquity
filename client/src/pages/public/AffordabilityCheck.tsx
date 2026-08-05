import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { loadBuyingPowerScenario } from "@/lib/buyingPowerScenario";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PropertyMap } from "@/components/PropertyMap";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { calculateAffordabilityForProperty, getBasisPrice } from "./affordabilityCheck/affordability";
import type { FinancialInputs, PropertyData } from "./affordabilityCheck/types";
import { SearchHero } from "./affordabilityCheck/SearchHero";
import { PropertySummaryCard } from "./affordabilityCheck/PropertySummaryCard";
import { FinancialProfileCard } from "./affordabilityCheck/FinancialProfileCard";
import { PaymentBreakdownCard } from "./affordabilityCheck/PaymentBreakdownCard";
import { QualificationCard } from "./affordabilityCheck/QualificationCard";
import { HowItWorksSection } from "./affordabilityCheck/HowItWorksSection";

export default function AffordabilityCheck() {
  const [query, setQuery] = useState("");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Seeded from the landing-page Buying Power Estimator when the visitor
  // arrived through it — never re-ask what the widget already asked.
  const [seeded] = useState(() => loadBuyingPowerScenario());
  const [financials, setFinancials] = useState<FinancialInputs>({
    annualIncome: seeded?.annualIncome ?? 100000,
    monthlyDebts: seeded?.monthlyDebts ?? 500,
    downPayment: seeded?.downPayment ?? 50000,
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
        const basisPrice = getBasisPrice(data.property);
        // Default down payment to 10% of the home — unless the visitor already
        // told the landing-page estimator what cash they actually have.
        if (basisPrice > 0 && !seeded) {
          setFinancials((prev) => ({
            ...prev,
            downPayment: Math.round(basisPrice * 0.1),
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
      price: String(getBasisPrice(property)),
      state: property.stateCode,
      propertyType: property.propertyType === "single_family" ? "single_family" : property.propertyType,
    });
    navigate(`/apply?${params.toString()}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <SearchHero
        query={query}
        onQueryChange={setQuery}
        onSubmit={handleSearch}
        isPending={lookupMutation.isPending}
        notFound={notFound}
      />

      {property && result && (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <PropertySummaryCard property={property} status={result.status} />

          {property.coordinate && (
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <PropertyMap
                  lat={property.coordinate.lat}
                  lng={property.coordinate.lon ?? property.coordinate.lng ?? 0}
                  address={`${property.address}, ${property.city}, ${property.stateCode}`}
                />
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <FinancialProfileCard
              financials={financials}
              onChange={setFinancials}
              downPaymentPercent={result.downPaymentPercent}
            />

            <div className="space-y-6">
              <PaymentBreakdownCard result={result} />

              <QualificationCard result={result} basisPrice={getBasisPrice(property)} />

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

      {!property && !lookupMutation.isPending && <HowItWorksSection />}
    </div>
  );
}
