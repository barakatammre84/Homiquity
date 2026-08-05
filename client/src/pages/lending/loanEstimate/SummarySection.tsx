import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "@/lib/formatters";
import type { LoanEstimateData } from "./types";

/**
 * Issue date, the TRID three-business-day badge, and the three headline terms.
 *
 * The badge reflects the server's `tridCompliance.withinThreeBusinessDays`
 * verbatim — the deadline under 12 CFR §1026.19(e)(1)(iii) is computed where
 * the disclosure is generated, never re-derived here from dates on screen.
 */
export function SummarySection({ le }: { le: LoanEstimateData }) {
  return (
    <>
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">Loan Estimate</CardTitle>
              <CardDescription className="text-base mt-1">
                Save this Loan Estimate to compare with your Closing Disclosure.
              </CardDescription>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Date Issued</p>
              <p className="font-semibold" data-testid="text-date-issued">{formatDate(le.dateIssued)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {le.tridCompliance.withinThreeBusinessDays ? (
              <Badge className="bg-success">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                TRID Compliant
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                TRID Deadline Passed
              </Badge>
            )}
            <Badge variant="outline">
              <Clock className="mr-1 h-3 w-3" />
              Expires {formatDate(le.expirationDate)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Loan Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-loan-amount">
              {le.loanTerms.loanAmountFormatted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interest Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-interest-rate">
              {le.loanTerms.interestRateFormatted}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly P&I</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="text-monthly-pi">
              {le.loanTerms.monthlyPIFormatted}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
