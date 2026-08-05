import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Calendar, TrendingDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { paymentBreakdown, type MortgageResults } from "./mortgageMath";

export function MonthlyPaymentCard({ results }: { results: MortgageResults }) {
  return (
    <Card className="border-2 border-primary bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Monthly Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-4xl font-bold text-primary" data-testid="text-monthly-payment">
            {formatCurrency(results.totalMonthlyPayment)}
          </p>
          <p className="mt-2 text-muted-foreground">per month</p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Legend plus stacked bar; zero components are dropped by paymentBreakdown. */
export function PaymentBreakdownCard({ results }: { results: MortgageResults }) {
  const slices = paymentBreakdown(results);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {slices.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${item.color}`} />
                <span className="text-sm">{item.label}</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-muted">
          {slices.map((item) => (
            <div
              key={item.label}
              className={`inline-block h-full ${item.color}`}
              style={{
                width: `${(item.value / results.totalMonthlyPayment) * 100}%`,
              }}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Principal and interest only, over the full scheduled term — the labels say
 * so. Taxes, insurance, PMI and HOA are not rolled in.
 */
export function LoanSummaryCard({ results }: { results: MortgageResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Loan Summary
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loan Amount</span>
            <span className="font-medium" data-testid="text-loan-amount">
              {formatCurrency(results.loanAmount)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Interest Paid</span>
            <span className="font-medium text-destructive" data-testid="text-total-interest">
              {formatCurrency(results.totalInterestPaid)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-3">
            <span className="font-medium">Total Cost of Loan</span>
            <span className="font-bold" data-testid="text-total-cost">
              {formatCurrency(results.totalCostOfLoan)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AmortizationPreviewCard({ results }: { results: MortgageResults }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Amortization Preview
        </CardTitle>
        <CardDescription>First 5 years of payments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {results.amortizationSchedule.slice(0, 5).map((year) => (
            <div key={year.year} className="flex items-center justify-between text-sm">
              <span>Year {year.year}</span>
              <div className="flex gap-4">
                <span className="text-success-subtle-foreground">
                  +{formatCurrency(year.principal)} principal
                </span>
                <span className="text-muted-foreground">
                  Balance: {formatCurrency(year.balance)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
