import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicQueryFn } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  Info, 
  Shield,
  Star
} from "lucide-react";
import RatePageHeader, { RateRow } from "@/components/RatePageHeader";
import { SEOHead } from "@/components/SEOHead";
import { usePageView } from "@/hooks/useActivityTracker";
import { formatRateTerm, formatRatePoints } from "@/lib/formatters";
import type { MortgageRateWithProgram } from "@/types/rates";

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

export default function VaRates() {
  usePageView("/rates/va");
  const [zipcode, setZipcode] = useState("");
  const [searchZipcode, setSearchZipcode] = useState("");

  const { data: rates, isLoading, isFetching } = useQuery<MortgageRateWithProgram[]>({
    // The key carries the exact request params — getPublicQueryFn builds the URL
    // from it, so the cache identity and the request can't drift apart.
    queryKey: [
      "/api/mortgage-rates",
      {
        loanType: "va",
        zipcode: searchZipcode,
        state: getStateFromZip(searchZipcode),
      },
    ],
    queryFn: getPublicQueryFn<MortgageRateWithProgram[]>(),
  });

  const handleSearch = useCallback(() => {
    if (zipcode.length === 5) {
      setSearchZipcode(zipcode);
    }
  }, [zipcode]);

  const vaRates = rates?.filter(r => r.program.loanType === "va");

  const formatTerm = (rate: MortgageRateWithProgram) => formatRateTerm(rate);
  const formatPoints = (rate: MortgageRateWithProgram) => formatRatePoints(rate);

  return (
    <>
      <SEOHead
        title="VA Loan Rates"
        description="See current VA loan rate and APR trends for eligible veterans and service members, with the loan assumptions behind every quote."
        canonical="/rates/va"
      />
      <RatePageHeader
        loanType="va"
        title="VA loan rates today"
        zipcode={zipcode}
        onZipcodeChange={setZipcode}
        onSearch={handleSearch}
        isLoading={isFetching}
        showPropertyValue={true}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <Card className="bg-info-subtle border-border mb-8">
          <CardContent className="flex items-center gap-4 py-4">
            <Star className="h-8 w-8 text-info flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-info">Thank You for Your Service</h3>
              <p className="text-sm text-info">
                VA loans offer exclusive benefits including no down payment, no PMI, and competitive rates for eligible veterans, 
                active-duty service members, and surviving spouses.
              </p>
            </div>
          </CardContent>
        </Card>

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
        ) : vaRates && vaRates.length > 0 ? (
          <>
            <div className="space-y-4 mb-12">
              {vaRates.map((rate) => {
                const { points, cost } = formatPoints(rate);
                return (
                  <RateRow
                    key={rate.id}
                    term={formatTerm(rate)}
                    rate={`${parseFloat(rate.rate).toFixed(3)}%`}
                    apr={`${parseFloat(rate.apr).toFixed(3)}%`}
                    points={points}
                    pointsCost={cost}
                    ctaHref="/apply?type=va"
                  />
                );
              })}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Ready to use your VA benefit?</h3>
                  <p className="text-muted-foreground">Get pre-approved with $0 down payment</p>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                  <Link href="/apply?type=va" data-testid="link-apply-va">
                    Start VA Loan Application
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No VA rates available</h3>
              <p className="text-muted-foreground mb-6">
                Enter your ZIP code above to see current VA loan rates for your area.
              </p>
              <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                <Link href="/apply?type=va" data-testid="link-apply-va-empty">
                  Apply for VA Loan
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
                VA loan benefits
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                VA loans are backed by the Department of Veterans Affairs and offer some of the 
                best terms available in the mortgage market. They're designed to help veterans 
                and service members achieve homeownership.
              </p>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  No down payment required
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  No private mortgage insurance (PMI)
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Competitive interest rates
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Limited closing costs
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Who is eligible?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Veterans:</span>
                  90+ days active duty during wartime
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Active Duty:</span>
                  181+ days during peacetime
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">National Guard:</span>
                  6+ years of service
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Surviving Spouses:</span>
                  Unremarried spouse of veteran who died in service
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
                VA loan rates shown are estimates. A Certificate of Eligibility (COE) is required to verify VA loan eligibility.
                Your actual rate depends on credit score, loan amount, and funding fee.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
