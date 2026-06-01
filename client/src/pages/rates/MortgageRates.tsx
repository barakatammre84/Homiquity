import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { usePageView } from "@/hooks/useActivityTracker";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  Clock, 
  Info, 
  MapPin, 
  Search,
  ArrowRight,
  Shield,
  Calculator
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MortgageRateProgram {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  termYears: number | null;
  isAdjustable: boolean | null;
  adjustmentPeriod: string | null;
  loanType: string | null;
  displayOrder: number | null;
  isActive: boolean | null;
}

interface MortgageRateWithProgram {
  id: string;
  state: string | null;
  zipcode: string | null;
  programId: string;
  rate: string;
  apr: string;
  points: string | null;
  pointsCost: string | null;
  loanAmount: string | null;
  downPaymentPercent: number | null;
  creditScoreMin: number | null;
  isActive: boolean | null;
  effectiveDate: string | null;
  program: MortgageRateProgram;
}

export default function MortgageRates() {
  const [zipcode, setZipcode] = useState("");
  const [searchZipcode, setSearchZipcode] = useState("");

  usePageView("/rates");

  const { data: rates, isLoading } = useQuery<MortgageRateWithProgram[]>({
    queryKey: ["/api/mortgage-rates", { zipcode: searchZipcode }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchZipcode) {
        params.append("zipcode", searchZipcode);
        const stateFromZip = getStateFromZip(searchZipcode);
        if (stateFromZip) params.append("state", stateFromZip);
      }
      const res = await fetch(`/api/mortgage-rates${params.toString() ? `?${params}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch rates");
      return res.json();
    },
  });

  const handleSearch = () => {
    if (zipcode.length === 5) {
      setSearchZipcode(zipcode);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });

  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <>
      <SEOHead title="Today's Mortgage Rates" description="Compare current mortgage rates for purchase, refinance, cash-out, HELOC, and VA loans. Updated daily with competitive rates from top lenders." />
      <div className="bg-gradient-to-b from-primary/5 to-background pb-12">
        <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              Mortgage Rates Today
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Here are today's mortgage rates{searchZipcode ? ` in ${searchZipcode}` : ""}. 
              Get a personalized quote in as little as 3 minutes. No hard credit check.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center max-w-md mx-auto mb-8">
            <div className="relative flex-1 w-full">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter ZIP code"
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyPress={handleKeyPress}
                className="pl-10 h-12"
                maxLength={5}
                data-testid="input-zipcode"
              />
            </div>
            <Button 
              onClick={handleSearch} 
              size="lg" 
              className="w-full sm:w-auto"
              disabled={zipcode.length !== 5}
              data-testid="button-search-rates"
            >
              <Search className="h-4 w-4 mr-2" />
              Get Rates
            </Button>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Rates updated at {currentTime} on {currentDate}</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-16">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-24 mb-4" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : rates && rates.length > 0 ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-12">
              {rates.map((rate) => (
                <RateCard key={rate.id} rate={rate} />
              ))}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Have another rate?</h3>
                  <p className="text-muted-foreground">Let us match or beat it</p>
                </div>
                <Button asChild>
                  <Link href="/apply" data-testid="link-match-rate">
                    Get Your Custom Quote
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No rates available</h3>
              <p className="text-muted-foreground mb-6">
                Enter your ZIP code above to see current mortgage rates for your area.
              </p>
              <Button asChild>
                <Link href="/apply" data-testid="link-get-preapproved">
                  Get Pre-Approved Instead
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                What are today's interest rates?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                Mortgage rates refer to the current interest rates that lenders offer on mortgage loans. 
                Rates can change based on factors like the economy, Federal Reserve policies, and market expectations.
              </p>
              <p>
                Your rate impacts the home's affordability and the total interest paid over the loan's life. 
                That's why it's crucial for homebuyers or those refinancing to monitor current mortgage rates.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Factors that affect your rate
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Credit Score:</span>
                  Higher scores generally result in lower rates
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Down Payment:</span>
                  20%+ down can lower your rate
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Loan Term:</span>
                  Shorter terms often have lower rates
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Loan Type:</span>
                  Conventional, FHA, VA have different rates
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-muted/50">
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              <span>
                Rates shown are estimates based on a ${rates?.[0]?.loanAmount ? parseInt(rates[0].loanAmount).toLocaleString() : "160,000"} loan, 
                {rates?.[0]?.downPaymentPercent || 20}% down payment, and {rates?.[0]?.creditScoreMin || 760}+ credit score. 
                Your actual rate may vary.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RateCard({ rate }: { rate: MortgageRateWithProgram }) {
  const isFixed = !rate.program.isAdjustable;
  const isFHA = rate.program.loanType === "fha";
  const isVA = rate.program.loanType === "va";

  return (
    <Card className="overflow-hidden transition-shadow hover-elevate" data-testid={`card-rate-${rate.program.slug}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{rate.program.name}</CardTitle>
          {isFHA && <Badge variant="secondary">FHA</Badge>}
          {isVA && <Badge variant="secondary">VA</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold tracking-tight">{parseFloat(rate.rate).toFixed(3)}%</span>
          <span className="text-muted-foreground">Rate</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                  APR
                  <Info className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Annual Percentage Rate includes the interest rate plus lender fees,
                    giving you the true cost of borrowing.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="font-semibold text-lg">{parseFloat(rate.apr).toFixed(3)}%</p>
          </div>
          <div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                  Points
                  <Info className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Points are upfront fees you can pay to lower your rate.
                    1 point = 1% of the loan amount.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <p className="font-semibold text-lg">
              {rate.points ? parseFloat(rate.points).toFixed(2) : "0.00"}
              {rate.pointsCost && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  (${parseInt(rate.pointsCost).toLocaleString()})
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isFixed ? `${rate.program.termYears}-year fixed` : `Adjustable (${rate.program.adjustmentPeriod})`}
            </span>
            {isFixed ? (
              <Badge variant="outline" className="text-xs">
                Stable Payment
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Lower Initial Rate
              </Badge>
            )}
          </div>
        </div>

        <Button asChild className="w-full" data-testid={`button-lock-rate-${rate.program.slug}`}>
          <Link href="/apply">
            Lock This Rate
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function getStateFromZip(zip: string): string | undefined {
  const zipNum = parseInt(zip.substring(0, 3));
  
  if (zipNum >= 900 && zipNum <= 961) return "CA";
  if (zipNum >= 100 && zipNum <= 149) return "NY";
  if (zipNum >= 750 && zipNum <= 799) return "TX";
  if (zipNum >= 330 && zipNum <= 349) return "FL";
  if (zipNum >= 600 && zipNum <= 629) return "IL";
  if (zipNum >= 150 && zipNum <= 196) return "PA";
  if (zipNum >= 430 && zipNum <= 459) return "OH";
  if (zipNum >= 300 && zipNum <= 319) return "GA";
  if (zipNum >= 270 && zipNum <= 289) return "NC";
  if (zipNum >= 480 && zipNum <= 499) return "MI";
  
  return undefined;
}
