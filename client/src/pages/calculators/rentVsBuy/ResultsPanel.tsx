import { Building, Calculator, CheckCircle2, Home, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { CalculatorInputs, CalculatorResults } from "./types";

/** Bar width as a share of the larger of the two net costs. */
function barWidth(value: number, other: number): string {
  return `${Math.min(100, (value / Math.max(value, other)) * 100)}%`;
}

export function ResultsPanel({
  inputs,
  results,
}: {
  inputs: CalculatorInputs;
  results: CalculatorResults;
}) {
  return (
    <>
      <Card
        className={`border-2 ${
          results.recommendation === "buy"
            ? "border-border bg-success-subtle"
            : results.recommendation === "rent"
            ? "border-border bg-info-subtle"
            : "border-muted"
        }`}
      >
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Recommendation
            </span>
            {results.recommendation !== "neutral" && (
              <CheckCircle2
                className={`h-6 w-6 ${
                  results.recommendation === "buy" ? "text-success-subtle-foreground" : "text-info"
                }`}
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <p className="text-2xl font-bold" data-testid="text-recommendation">
              {results.recommendation === "buy"
                ? "Buying Makes Sense!"
                : results.recommendation === "rent"
                ? "Renting is Better For Now"
                : "It's a Close Call"}
            </p>
            <p className="mt-2 text-muted-foreground">
              Based on a {inputs.yearsToStay}-year timeline
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-info" />
                <span>Monthly Rent</span>
              </div>
              <span className="text-xl font-bold" data-testid="text-monthly-rent">
                {formatCurrency(inputs.monthlyRent)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <div className="flex items-center gap-2">
                <Home className="h-5 w-5 text-success-subtle-foreground" />
                <span>Monthly Ownership</span>
              </div>
              <span className="text-xl font-bold" data-testid="text-monthly-ownership">
                {formatCurrency(results.totalMonthlyOwnership)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {inputs.yearsToStay}-Year Cost Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm">
                <span>Total Rent Paid</span>
                <span className="font-medium" data-testid="text-total-rent">
                  {formatCurrency(results.totalRentCost)}
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-info-subtle">
                <div
                  className="h-3 rounded-full bg-info"
                  style={{ width: barWidth(results.netCostRenting, results.netCostBuying) }}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Net cost: {formatCurrency(results.netCostRenting)}
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm">
                <span>Total Ownership Cost</span>
                <span className="font-medium" data-testid="text-total-ownership">
                  {formatCurrency(results.totalOwnershipCost)}
                </span>
              </div>
              <div className="mt-1 h-3 rounded-full bg-success-subtle">
                <div
                  className="h-3 rounded-full bg-success"
                  style={{ width: barWidth(results.netCostBuying, results.netCostRenting) }}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Net cost (after equity): {formatCurrency(results.netCostBuying)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Wealth Building
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Home Equity After {inputs.yearsToStay} Years</span>
              <span className="font-bold text-success-subtle-foreground" data-testid="text-home-equity">
                {formatCurrency(results.homeEquity)}
              </span>
            </div>
            {/* 0 is the "never breaks even in 30 years" sentinel — hide the
                row rather than printing "~0 years". */}
            {results.breakEvenYears > 0 && (
              <div className="flex justify-between">
                <span>Break-Even Point</span>
                <span className="font-medium" data-testid="text-break-even">
                  ~{results.breakEvenYears} years
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
