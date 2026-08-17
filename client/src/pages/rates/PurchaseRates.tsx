import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPublicQueryFn } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  Info, 
  Shield,
  Home
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

// Purchasing is a transaction purpose, not a product: what is offered for it is
// a conforming first mortgage. The one constant feeds both the request and the
// query key, so the cache can never describe a request that wasn't made.
const RATE_LOAN_TYPE = "conventional";

export default function PurchaseRates() {
  usePageView("/rates/purchase");
  const [zipcode, setZipcode] = useState("");
  const [searchZipcode, setSearchZipcode] = useState("");

  const { data: rates, isLoading, isFetching } = useQuery<MortgageRateWithProgram[]>({
    // Their loanType (the Reg Z product-heading fix, now enforced in SQL)
    // rides in the key, and getPublicQueryFn builds the URL from the key —
    // so the cache can never describe a request that was not made.
    queryKey: [
      "/api/mortgage-rates",
      {
        loanType: RATE_LOAN_TYPE,
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

  // Narrowed server-side by RATE_LOAN_TYPE — no render-path filter to forget.
  const purchaseRates = rates;

  const formatTerm = (rate: MortgageRateWithProgram) => formatRateTerm(rate);
  const formatPoints = (rate: MortgageRateWithProgram) => formatRatePoints(rate);

  return (
    <>
      <SEOHead
        title="Purchase Mortgage Rates"
        description="See current purchase mortgage rate and APR trends, with the loan assumptions behind every quote — no personal information required."
        canonical="/rates/purchase"
      />
      <RatePageHeader
        loanType="purchase"
        title="Purchase mortgage rates today"
        zipcode={zipcode}
        onZipcodeChange={setZipcode}
        onSearch={handleSearch}
        isLoading={isFetching}
        showPropertyValue={true}
        showDownPayment={true}
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
        ) : purchaseRates && purchaseRates.length > 0 ? (
          <>
            <div className="space-y-4 mb-12">
              {purchaseRates.map((rate) => {
                const { points, cost } = formatPoints(rate);
                return (
                  <RateRow
                    key={rate.id}
                    term={formatTerm(rate)}
                    rate={`${parseFloat(rate.rate).toFixed(3)}%`}
                    apr={`${parseFloat(rate.apr).toFixed(3)}%`}
                    points={points}
                    pointsCost={cost}
                    ctaHref="/apply"
                  />
                );
              })}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Ready to buy your dream home?</h3>
                  <p className="text-muted-foreground">Get pre-approved in as little as 3 minutes</p>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                  <Link href="/apply" data-testid="link-get-preapproved">
                    Get Pre-Approved
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState
            icon={Home}
            title="No purchase rates available"
            description="Enter your ZIP code above to see current purchase mortgage rates for your area."
            action={
              <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                <Link href="/apply" data-testid="link-get-preapproved-empty">
                  Get Pre-Approved Instead
                </Link>
              </Button>
            }
            data-testid="empty-state-purchase-rates"
          />
        )}

        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                What are purchase mortgage rates?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                Purchase mortgage rates are the interest rates offered when buying a new home. 
                These rates determine your monthly payment and total cost of borrowing over the life of the loan.
              </p>
              <p>
                Getting the best purchase rate can save you tens of thousands of dollars. 
                That's why comparing rates and getting pre-approved is crucial before house hunting.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                How to get the best rate
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Improve Credit:</span>
                  Aim for 760+ for the best rates
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Save More:</span>
                  20%+ down avoids PMI and lowers rates
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Compare Lenders:</span>
                  Get quotes from multiple lenders
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Lock Early:</span>
                  Lock your rate when you find a good one
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
                Rates shown are estimates based on a $300,000 loan, 
                20% down payment, and 760+ credit score. 
                Your actual rate may vary.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
