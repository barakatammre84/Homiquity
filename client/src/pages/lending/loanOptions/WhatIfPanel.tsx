import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";

/**
 * Borrower-facing what-if panel (roadmap ARC-3).
 *
 * The engine behind this is `computePaymentProjection` — the SAME derivation
 * the borrower's Loan Estimate prices from, byte-identical for identical
 * inputs (F-047). A scenario and the disclosure therefore cannot disagree.
 * ARC-3 originally named `/api/scenario-calculator`, which carries its own
 * hardcoded rate table and is blind to credit score, state and LLPA; wiring
 * that here would have shown borrowers a number their own LE contradicts.
 *
 * What this deliberately does NOT show: fees, closing costs, APR, or anything
 * else disclosable. It is a monthly-payment comparison only, framed as an
 * estimate — matching the page's existing "estimates, not offers" posture.
 */

interface Projection {
  loanAmount: number;
  interestRate: number;
  monthlyPrincipalAndInterest: number;
  monthlyMortgageInsurance: number;
  monthlyEscrow: number;
  estimatedMonthlyTotal: number;
}

interface ScenarioResult {
  label: string;
  projection: Projection | null;
  monthlyDeltaFromBaseline: number | null;
  unavailable: string | null;
}

interface WhatIfResponse {
  baseline: Projection | null;
  scenarios: ScenarioResult[];
  unavailable: string | null;
}

export function WhatIfPanel({
  applicationId,
  currentPurchasePrice,
  currentDownPayment,
}: {
  applicationId: string;
  currentPurchasePrice: number | null;
  currentDownPayment: number | null;
}) {
  const [downPayment, setDownPayment] = useState("");
  const [creditScore, setCreditScore] = useState("");
  const [result, setResult] = useState<WhatIfResponse | null>(null);

  const runMutation = useMutation({
    mutationFn: async (): Promise<WhatIfResponse> => {
      const scenarios: Record<string, unknown>[] = [];
      const dp = Number(downPayment);
      const cs = Number(creditScore);
      if (downPayment.trim() !== "" && Number.isFinite(dp)) {
        scenarios.push({ label: `${formatCurrency(dp)} down`, downPayment: dp });
      }
      if (creditScore.trim() !== "" && Number.isFinite(cs)) {
        scenarios.push({ label: `${cs} credit score`, creditScore: cs });
      }
      if (downPayment.trim() !== "" && creditScore.trim() !== "") {
        scenarios.push({
          label: "Both changes together",
          downPayment: dp,
          creditScore: cs,
        });
      }
      const res = await apiRequest("POST", `/api/loan-applications/${applicationId}/what-if`, {
        scenarios,
      });
      return res.json();
    },
    onSuccess: setResult,
  });

  const dpValid =
    downPayment.trim() === "" ||
    (Number.isFinite(Number(downPayment)) &&
      Number(downPayment) >= 0 &&
      (currentPurchasePrice === null || Number(downPayment) < currentPurchasePrice));
  const csValid =
    creditScore.trim() === "" ||
    (Number.isInteger(Number(creditScore)) &&
      Number(creditScore) >= 300 &&
      Number(creditScore) <= 850);
  const canRun =
    (downPayment.trim() !== "" || creditScore.trim() !== "") && dpValid && csValid;

  return (
    <Card className="mb-8" data-testid="card-what-if">
      <CardHeader>
        <CardTitle>What if something changed?</CardTitle>
        <CardDescription>
          See how a bigger down payment or a higher credit score would change your estimated
          monthly payment. These are estimates, not offers, and nothing here changes your
          application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="what-if-down">Down payment ($)</Label>
            <Input
              id="what-if-down"
              inputMode="decimal"
              value={downPayment}
              onChange={event => setDownPayment(event.target.value)}
              placeholder={currentDownPayment !== null ? String(currentDownPayment) : "e.g. 40000"}
              data-testid="input-what-if-down-payment"
            />
            {!dpValid && (
              <p className="text-xs text-destructive" role="alert" data-testid="text-what-if-down-error">
                Enter an amount below your purchase price.
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="what-if-credit">Credit score</Label>
            <Input
              id="what-if-credit"
              inputMode="numeric"
              value={creditScore}
              onChange={event => setCreditScore(event.target.value)}
              placeholder="e.g. 760"
              data-testid="input-what-if-credit-score"
            />
            {!csValid && (
              <p className="text-xs text-destructive" role="alert" data-testid="text-what-if-credit-error">
                Enter a score between 300 and 850.
              </p>
            )}
          </div>
        </div>

        <Button
          size="sm" className="touch-target"
          disabled={!canRun || runMutation.isPending}
          onClick={() => runMutation.mutate()}
          data-testid="button-run-what-if"
        >
          {runMutation.isPending ? "Calculating…" : "See the difference"}
        </Button>

        {runMutation.isError && (
          <Alert variant="warning" data-testid="alert-what-if-error">
            <AlertDescription>
              We couldn&apos;t run that comparison just now. Please try again.
            </AlertDescription>
          </Alert>
        )}

        {result?.unavailable && (
          <Alert variant="info" data-testid="alert-what-if-unavailable">
            <AlertDescription>
              Your file needs a bit more information before we can estimate payments. Your loan
              officer can help fill the gaps.
            </AlertDescription>
          </Alert>
        )}

        {result?.baseline && (
          <div className="space-y-2" data-testid="what-if-results">
            <div className="flex items-baseline justify-between rounded-md border p-3">
              <div>
                <span className="text-sm font-medium">Your file today</span>
                <span className="block text-xs text-muted-foreground">
                  {result.baseline.interestRate}% · {formatCurrency(result.baseline.loanAmount)} loan
                </span>
              </div>
              <span className="text-lg font-semibold" data-testid="text-what-if-baseline">
                {formatCurrency(result.baseline.estimatedMonthlyTotal)}/mo
              </span>
            </div>

            {result.scenarios.map(scenario => (
              <div
                key={scenario.label}
                className="flex items-baseline justify-between rounded-md border p-3"
                data-testid={`row-what-if-${scenario.label.replace(/\s+/g, "-").toLowerCase()}`}
              >
                <div>
                  <span className="text-sm font-medium">{scenario.label}</span>
                  {scenario.projection && (
                    <span className="block text-xs text-muted-foreground">
                      {scenario.projection.interestRate}% ·{" "}
                      {formatCurrency(scenario.projection.loanAmount)} loan
                    </span>
                  )}
                </div>
                {scenario.projection ? (
                  <div className="text-right">
                    <span className="text-lg font-semibold">
                      {formatCurrency(scenario.projection.estimatedMonthlyTotal)}/mo
                    </span>
                    {scenario.monthlyDeltaFromBaseline !== null && (
                      <Badge
                        variant="secondary"
                        className="ml-2"
                        data-testid={`badge-what-if-delta-${scenario.label
                          .replace(/\s+/g, "-")
                          .toLowerCase()}`}
                      >
                        {/* Signed, never absolute — an increase must read as an
                            increase, the same honesty rule the staff
                            pricing-intelligence panel follows. */}
                        {scenario.monthlyDeltaFromBaseline > 0 ? "+" : ""}
                        {formatCurrency(scenario.monthlyDeltaFromBaseline)}/mo
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Not available</span>
                )}
              </div>
            ))}

            <p className="text-xs text-muted-foreground">
              Estimated monthly payment includes principal, interest, mortgage insurance and
              escrow. Estimates only — your actual rate and payment depend on a full review, and
              a change to your file may affect what you qualify for.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
