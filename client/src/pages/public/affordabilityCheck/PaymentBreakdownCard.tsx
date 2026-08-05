import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/formatters";
import type { AffordabilityResult } from "./types";

export function PaymentBreakdownCard({ result }: { result: AffordabilityResult }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Monthly Payment Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold mb-4" data-testid="text-monthly-payment">
          {formatCurrency(result.monthlyPayment)}
          <span className="text-base font-normal text-muted-foreground">/mo</span>
        </p>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Principal & Interest</span>
            <span className="font-medium">{formatCurrency(result.principalInterest)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Property Tax</span>
            <span className="font-medium">{formatCurrency(result.monthlyTax)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Home Insurance</span>
            <span className="font-medium">{formatCurrency(result.monthlyInsurance)}</span>
          </div>
          {result.monthlyPMI > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">PMI</span>
              <span className="font-medium">{formatCurrency(result.monthlyPMI)}</span>
            </div>
          )}
          {result.monthlyHOA > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">HOA</span>
              <span className="font-medium">{formatCurrency(result.monthlyHOA)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Loan Amount</span>
            <span className="font-medium">{formatCurrency(result.loanAmount)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
