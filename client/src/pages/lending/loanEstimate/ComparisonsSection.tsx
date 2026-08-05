import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { LoanEstimateData } from "./types";

/**
 * The Comparisons block: five-year totals, APR, and total interest percentage
 * — the three figures the Loan Estimate form exists to make comparable across
 * lenders. All three come from the server; none is recomputed here.
 */
export function ComparisonsCard({ le }: { le: LoanEstimateData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Comparisons
        </CardTitle>
        <CardDescription>
          Use these measures to compare this loan with other loans.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">In 5 Years</p>
            <p className="text-xl font-bold">
              {formatCurrency(le.comparisons.inFiveYears.totalYouWillHavePaid)}
            </p>
            <p className="text-xs text-muted-foreground">Total you will have paid</p>
            <p className="text-lg font-semibold text-success-subtle-foreground mt-2">
              {formatCurrency(le.comparisons.inFiveYears.principalPaidOff)}
            </p>
            <p className="text-xs text-muted-foreground">Principal paid off</p>
          </div>

          <div className="rounded-lg border p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Annual Percentage Rate (APR)</p>
            <p className="text-2xl font-bold" data-testid="text-apr">
              {le.comparisons.apr}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cost over the loan term as a yearly rate
            </p>
          </div>

          <div className="rounded-lg border p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Total Interest Percentage</p>
            <p className="text-2xl font-bold">
              {le.comparisons.totalInterestPercentage}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Total interest as % of loan amount
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Prepayment penalty and balloon payment — both required disclosures on the
 * Loan Estimate — plus the standing caveat that this is an estimate.
 */
export function ImportantInformationCard({ le }: { le: LoanEstimateData }) {
  return (
    <Card className="border-border/30 bg-warning-subtle/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning-subtle-foreground">
          <Info className="h-5 w-5" />
          Important Information
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        <p>
          <strong>Prepayment Penalty:</strong> {le.loanTerms.prepaymentPenalty ? "Yes - see loan documents" : "No prepayment penalty"}
        </p>
        <p>
          <strong>Balloon Payment:</strong> {le.loanTerms.balloonPayment ? "Yes - see loan documents" : "No balloon payment"}
        </p>
        <p>
          Your actual rate, payment, and costs could be higher. Get an official Loan Estimate before choosing a loan.
        </p>
      </CardContent>
    </Card>
  );
}
