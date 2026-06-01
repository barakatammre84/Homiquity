import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  Info, 
  Shield,
  RefreshCw
} from "lucide-react";
import RatePageHeader, { RateRow } from "@/components/RatePageHeader";
import { usePageView } from "@/hooks/useActivityTracker";

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

export default function RefinanceRates() {
  usePageView("/rates/refinance");
  const [zipcode, setZipcode] = useState("");
  const [searchZipcode, setSearchZipcode] = useState("");

  const { data: rates, isLoading, isFetching } = useQuery<MortgageRateWithProgram[]>({
    queryKey: ["/api/mortgage-rates", { zipcode: searchZipcode, loanType: "refinance" }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchZipcode) {
        params.append("zipcode", searchZipcode);
        const stateFromZip = getStateFromZip(searchZipcode);
        if (stateFromZip) params.append("state", stateFromZip);
      }
      const res = await fetch(`/api/mortgage-rates?${params}`);
      if (!res.ok) throw new Error("Failed to fetch rates");
      return res.json();
    },
  });

  const handleSearch = useCallback(() => {
    if (zipcode.length === 5) {
      setSearchZipcode(zipcode);
    }
  }, [zipcode]);

  const refinanceRates = rates?.filter(r => 
    r.program.loanType === "conventional" || r.program.loanType === null
  );

  const formatTerm = (rate: MortgageRateWithProgram) => {
    if (rate.program.isAdjustable) {
      return `${rate.program.adjustmentPeriod || "5/1"} ARM`;
    }
    return `${rate.program.termYears}-yr fixed`;
  };

  const formatPoints = (rate: MortgageRateWithProgram) => {
    const points = rate.points ? parseFloat(rate.points).toFixed(2) : "0.00";
    const loanAmount = rate.loanAmount ? parseInt(rate.loanAmount) : 300000;
    const pointsCost = Math.round(parseFloat(rate.points || "0") * loanAmount / 100);
    return { points, cost: `$${pointsCost.toLocaleString()}` };
  };

  return (
    <>
      <RatePageHeader
        loanType="refinance"
        title="Refinance rates today"
        zipcode={zipcode}
        onZipcodeChange={setZipcode}
        onSearch={handleSearch}
        isLoading={isFetching}
        showPropertyValue={true}
        showMortgageBalance={true}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-6 bg-background border rounded-lg">
                <div className="flex items-center gap-8">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-10 w-28 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : refinanceRates && refinanceRates.length > 0 ? (
          <>
            <div className="space-y-4 mb-12">
              {refinanceRates.map((rate) => {
                const { points, cost } = formatPoints(rate);
                return (
                  <RateRow
                    key={rate.id}
                    term={formatTerm(rate)}
                    rate={`${parseFloat(rate.rate).toFixed(3)}%`}
                    apr={`${parseFloat(rate.apr).toFixed(3)}%`}
                    points={points}
                    pointsCost={cost}
                    ctaHref="/apply?type=refinance"
                  />
                );
              })}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Ready to refinance?</h3>
                  <p className="text-muted-foreground">See how much you could save with a lower rate</p>
                </div>
                <Button asChild className="bg-[#017848] hover:bg-[#015a37] text-white">
                  <Link href="/apply?type=refinance" data-testid="link-apply-refinance">
                    Start Refinance Application
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No refinance rates available</h3>
              <p className="text-muted-foreground mb-6">
                Enter your ZIP code above to see current refinance rates for your area.
              </p>
              <Button asChild className="bg-[#017848] hover:bg-[#015a37] text-white">
                <Link href="/apply?type=refinance" data-testid="link-apply-refinance-empty">
                  Apply for Refinance
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
                When to refinance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                Refinancing replaces your current mortgage with a new one, typically to get a lower rate, 
                reduce your monthly payment, or change your loan term.
              </p>
              <p>
                A general rule is to refinance if you can lower your rate by at least 0.5-1% and 
                plan to stay in your home long enough to recoup closing costs.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Benefits of refinancing
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Lower Payment:</span>
                  Reduce your monthly mortgage payment
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Pay Off Faster:</span>
                  Switch to a shorter loan term
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Save Interest:</span>
                  Reduce total interest paid over time
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Remove PMI:</span>
                  Eliminate mortgage insurance with 20%+ equity
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
                Rates shown are estimates based on a $300,000 loan balance 
                and 760+ credit score. Your actual rate may vary.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
