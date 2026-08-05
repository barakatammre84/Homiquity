import { Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { AffordabilityResult } from "./types";

export interface QualificationCardProps {
  result: AffordabilityResult;
  /** Price the affordability math ran against — list price, or the AVM fallback. */
  basisPrice: number;
}

export function QualificationCard({ result, basisPrice }: QualificationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Qualification Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Front-End DTI (Housing)</span>
            <span className={`text-sm font-medium ${result.frontEndDTI > 28 ? "text-destructive" : "text-success-subtle-foreground"}`}>
              {result.frontEndDTI.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${result.frontEndDTI > 28 ? "bg-destructive" : result.frontEndDTI > 25 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.min(result.frontEndDTI / 40 * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Target: 28% or less</p>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Back-End DTI (All Debts)</span>
            <span className={`text-sm font-medium ${result.backEndDTI > result.maxBackEndDTI ? "text-destructive" : "text-success-subtle-foreground"}`}>
              {result.backEndDTI.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${result.backEndDTI > result.maxBackEndDTI ? "bg-destructive" : result.backEndDTI > result.maxBackEndDTI - 5 ? "bg-warning" : "bg-success"}`}
              style={{ width: `${Math.min(result.backEndDTI / 55 * 100, 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Target: {result.maxBackEndDTI}% or less (based on your credit score)</p>
        </div>

        {result.downPaymentPercent < 20 && (
          <div className="bg-warning-subtle border border-border rounded-md p-3">
            <p className="text-xs text-warning-subtle-foreground">
              Your down payment is {result.downPaymentPercent.toFixed(1)}% — below 20%. PMI of {formatCurrency(result.monthlyPMI)}/mo is included.
              Increasing your down payment to {formatCurrency(basisPrice * 0.2)} eliminates PMI.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
