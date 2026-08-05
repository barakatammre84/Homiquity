import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { TierResult } from "./types";

export interface PaymentBreakdownCardProps {
  primary: TierResult;
}

export function PaymentBreakdownCard({ primary }: PaymentBreakdownCardProps) {
  const monthlyTotal =
    primary.monthlyPI + primary.monthlyTax + primary.monthlyInsurance + primary.monthlyPMI + primary.hoaMonthly;

  const paymentBreakdown = [
    { label: "Principal & Interest", value: primary.monthlyPI, color: "bg-chart-1" },
    { label: "Property Tax", value: primary.monthlyTax, color: "bg-chart-2" },
    { label: "Insurance", value: primary.monthlyInsurance, color: "bg-chart-3" },
    { label: "PMI", value: primary.monthlyPMI, color: "bg-chart-4" },
    { label: "HOA", value: primary.hoaMonthly, color: "bg-chart-5" },
  ].filter((item) => item.value > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Estimated Monthly Payment</CardTitle>
        <CardDescription>{formatCurrency(monthlyTotal)}/mo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full bg-muted">
          {paymentBreakdown.map((item) => (
            <div
              key={item.label}
              className={`h-full ${item.color}`}
              style={{ width: `${(item.value / monthlyTotal) * 100}%` }}
            />
          ))}
        </div>
        <div className="space-y-2">
          {paymentBreakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                <span>{item.label}</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
