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

// The one constant feeds both the request and the query key, so the cache can
// never describe a request that wasn't made.
const RATE_LOAN_TYPE = "va";

export default function VaRates() {
  usePageView("/rates/va");
  // ZIP, the ZIP→state derivation, the debounce and the request all live in the
  // hook now — this page only says which product it advertises.
  const { zipcode, setZipcode, assumptions, setAssumptions, rates, isLoading, isFetching } =
    useRateSearch(RATE_LOAN_TYPE);

  const quoted = rates?.find(hasQuotedAssumptions);

  // Narrowed server-side by RATE_LOAN_TYPE — no render-path filter to forget.
  const vaRates = rates;

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
        isLoading={isFetching}
        assumptions={
          <AssumptionField
            label="Property Value"
            value={assumptions.propertyValue}
            onChange={(propertyValue) => setAssumptions({ propertyValue })}
            data-testid="input-property-value"
          />
        }
        advanced={quoted && <QuotedAssumptions rate={quoted} />}
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
