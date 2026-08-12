import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingDown, 
  Info, 
  Shield,
  Wallet
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

// A HELOC IS a product (unlike purchase/refinance, which are transaction
// purposes), so the page names it directly. Stated as the same named constant
// its five siblings use, so one grep answers "what does this page advertise".
const RATE_LOAN_TYPE = "heloc";

export default function HelocRates() {
  usePageView("/rates/heloc");
  // ZIP, the ZIP→state derivation, the debounce and the request all live in the
  // hook now — this page only says which product it advertises.
  const { zipcode, setZipcode, assumptions, setAssumptions, rates, isLoading, isFetching } =
    useRateSearch(RATE_LOAN_TYPE);

  const quoted = rates?.find(hasQuotedAssumptions);

  const formatTerm = (rate: MortgageRateWithProgram) => formatRateTerm(rate, true);
  const formatPoints = (rate: MortgageRateWithProgram) => formatRatePoints(rate, 100000);

  return (
    <>
      <SEOHead
        title="HELOC Rates"
        description="Explore current home equity line of credit rate and APR trends, with the assumptions behind every quote — no personal information required."
        canonical="/rates/heloc"
      />
      <RatePageHeader
        loanType="heloc"
        title="HELOC rates today"
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
        ) : rates && rates.length > 0 ? (
          <>
            <div className="space-y-4 mb-12">
              {rates.map((rate) => {
                const { points, cost } = formatPoints(rate);
                return (
                  <RateRow
                    key={rate.id}
                    term={formatTerm(rate)}
                    rate={`${parseFloat(rate.rate).toFixed(3)}%`}
                    apr={`${parseFloat(rate.apr).toFixed(3)}%`}
                    points={points}
                    pointsCost={cost}
                    ctaHref="/apply?type=heloc"
                  />
                );
              })}
            </div>

            <Card className="bg-primary/5 border-primary/20 mb-12">
              <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
                <div className="text-center sm:text-left">
                  <h3 className="text-lg font-semibold mb-1">Access your home equity</h3>
                  <p className="text-muted-foreground">Flexible credit line with competitive rates</p>
                </div>
                <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                  <Link href="/apply?type=heloc" data-testid="link-apply-heloc">
                    Apply for HELOC
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No HELOC rates available</h3>
              <p className="text-muted-foreground mb-6">
                Enter your ZIP code above to see current HELOC rates for your area.
              </p>
              <Button asChild className="bg-accent hover:bg-accent/90 text-white">
                <Link href="/apply?type=heloc" data-testid="link-apply-heloc-empty">
                  Apply for HELOC
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
                What is a HELOC?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-4">
              <p>
                A Home Equity Line of Credit (HELOC) is a revolving credit line secured by your home. 
                You can borrow against your home's equity as needed, up to a set limit.
              </p>
              <p>
                Unlike a cash-out refinance, a HELOC is a second mortgage that doesn't replace your 
                current one. You only pay interest on what you borrow, making it flexible for 
                ongoing expenses.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-primary" />
                HELOC vs Cash-Out Refinance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              <ul className="space-y-3">
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">HELOC:</span>
                  Draw funds as needed, variable rate, keeps current mortgage
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Cash-Out:</span>
                  Lump sum, fixed rate option, replaces current mortgage
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Best for HELOC:</span>
                  Ongoing expenses, low current rate, uncertain amount needed
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium text-foreground">Best for Cash-Out:</span>
                  Large one-time expense, high current rate, want fixed payment
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
                HELOC rates are typically variable and tied to the prime rate. 
                Your actual rate depends on credit score, home equity, and loan amount.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
