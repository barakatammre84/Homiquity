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
import RatePageHeader, {
  AssumptionField,
  QuotedAssumptions,
  RateRow,
  hasQuotedAssumptions,
} from "@/components/RatePageHeader";
import { SEOHead } from "@/components/SEOHead";
import { usePageView } from "@/hooks/useActivityTracker";
import { useRateSearch } from "@/hooks/useRateSearch";
import { formatRateTerm, formatRatePoints } from "@/lib/formatters";
import type { MortgageRateWithProgram } from "@/types/rates";

// Refinancing is a transaction purpose, not a product: what is offered for it
// is a conforming first mortgage. The one constant feeds both the request and
// the query key, so the cache can never describe a request that wasn't made.
const RATE_LOAN_TYPE = "conventional";

export default function RefinanceRates() {
  usePageView("/rates/refinance");
  // ZIP, the ZIP→state derivation, the debounce and the request all live in the
  // hook now — this page only says which product it advertises.
  const { zipcode, setZipcode, assumptions, setAssumptions, rates, isLoading, isFetching } =
    useRateSearch(RATE_LOAN_TYPE);

  const quoted = rates?.find(hasQuotedAssumptions);

  // Narrowed server-side by RATE_LOAN_TYPE — no render-path filter to forget.
  const refinanceRates = rates;

  const formatTerm = (rate: MortgageRateWithProgram) => formatRateTerm(rate);
  const formatPoints = (rate: MortgageRateWithProgram) => formatRatePoints(rate);

  return (
    <>
      <SEOHead
        title="Refinance Mortgage Rates"
        description="Compare current refinance mortgage rate and APR trends, with the loan assumptions behind every quote — no personal information required."
        canonical="/rates/refinance"
      />
      <RatePageHeader
        loanType="refinance"
        title="Refinance rates today"
        zipcode={zipcode}
        onZipcodeChange={setZipcode}
        isLoading={isFetching}
        assumptions={
          <>
            <AssumptionField
              label="Property Value"
              value={assumptions.propertyValue}
              onChange={(propertyValue) => setAssumptions({ propertyValue })}
              data-testid="input-property-value"
            />
            <AssumptionField
              label="Current Mortgage balance"
              value={assumptions.mortgageBalance}
              onChange={(mortgageBalance) => setAssumptions({ mortgageBalance })}
              className="w-40"
              data-testid="input-mortgage-balance"
            />
          </>
        }
        advanced={quoted && <QuotedAssumptions rate={quoted} />}
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
                <Button asChild className="bg-accent hover:bg-accent/90 text-white">
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
              <Button asChild className="bg-accent hover:bg-accent/90 text-white">
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
