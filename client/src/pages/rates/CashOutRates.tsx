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
  Calculator
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

// Cash-out refinancing is a transaction purpose, not a product: what is offered
// for it is a conforming first mortgage. The one constant feeds both the request
// and the query key, so the cache can never describe a request that wasn't made.
const RATE_LOAN_TYPE = "conventional";

export default function CashOutRates() {
  usePageView("/rates/cash-out");
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
  const cashOutRates = rates;

  const formatTerm = (rate: MortgageRateWithProgram) => formatRateTerm(rate);
  const formatPoints = (rate: MortgageRateWithProgram) => formatRatePoints(rate);

  return (
    <>
      <SEOHead
        title="Cash-Out Refinance Rates"
        description="See current cash-out refinance rate and APR trends, with the loan assumptions behind every quote — no personal information required."
        canonical="/rates/cash-out"
      />
      <RatePageHeader
        loanType="cashout"
        title="Cash-out refinance rates today"
        zipcode={zipcode}
        onZipcodeChange={setZipcode}
        onSearch={handleSearch}
        isLoading={isFetching}
        showCashOutAmount={true}
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
        ) : cashOutRates && cashOutRates.length > 0 ? (
          <>
            <div className="space-y-4 mb-12">
              {cashOutRates.map((rate) => {
                const { points, cost } = formatPoints(rate);
                return (
                  <RateRow
                    key={rate.id}
                    term={formatTerm(rate)}
                    rate={`${parseFloat(rate.rate).toFixed(3)}%`}
                    apr={`${parseFloat(rate.apr).toFixed(3)}%`}
                    points={points}
                    pointsCost={cost}
                    ctaHref="/apply?type=cashout"
                  />
                );
              })}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Tap into your home equity</h3>
                  <p className="text-muted-foreground">Get cash for renovations, debt payoff, or other expenses</p>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                  <Link href="/apply?type=cashout" data-testid="link-apply-cashout">
                    Start Cash-Out Application
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Calculator className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No cash-out rates available</h3>
              <p className="text-muted-foreground mb-6">
                Enter your ZIP code above to see current cash-out refinance rates for your area.
              </p>
              <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                <Link href="/apply?type=cashout" data-testid="link-apply-cashout-empty">
                  Apply for Cash-Out Refinance
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
                What is a cash-out refinance?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                A cash-out refinance replaces your current mortgage with a larger one, 
                allowing you to take the difference in cash. You can use the funds for 
                home improvements, debt consolidation, or other major expenses.
              </p>
              <p>
                Most lenders allow you to borrow up to 80% of your home's value, 
                minus your current mortgage balance. Cash-out rates are typically 
                slightly higher than standard refinance rates.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                Smart uses for cash-out
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Home Improvements:</span>
                  Renovations that add value to your home
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Debt Consolidation:</span>
                  Pay off high-interest credit cards
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">College Tuition:</span>
                  Fund education expenses
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Emergency Fund:</span>
                  Build financial security
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
                Rates shown are estimates based on $50,000 cash-out, 
                $350,000 property value, $200,000 existing balance, and 760+ credit score. 
                Your actual rate may vary.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
