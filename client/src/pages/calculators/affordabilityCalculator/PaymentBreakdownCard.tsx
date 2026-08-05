import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TermTooltip } from "@/components/TermTooltip";
import { formatCurrency } from "@/lib/formatters";
import type { AffordabilityResults } from "./types";

export interface PaymentBreakdownCardProps {
  results: AffordabilityResults;
  hoaMonthly: number;
}

export function PaymentBreakdownCard({ results, hoaMonthly }: PaymentBreakdownCardProps) {
  const paymentBreakdown = [
    { label: "Principal & Interest", value: results.monthlyPI, color: "bg-chart-1" },
    { label: "Property Tax", value: results.monthlyTax, color: "bg-chart-2" },
    { label: "Insurance", value: results.monthlyInsurance, color: "bg-chart-3" },
    { label: "PMI", value: results.monthlyPMI, color: "bg-chart-4" },
    { label: "HOA", value: hoaMonthly, color: "bg-chart-5" },
  ].filter((item) => item.value > 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Monthly Payment (<TermTooltip term="piti" showIcon={false}>PITI</TermTooltip>)
        </CardTitle>
        <CardDescription>{formatCurrency(results.monthlyPITI)}/mo</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-3 overflow-hidden rounded-full bg-muted flex mb-4">
          {paymentBreakdown.map((item) => (
            <div
              key={item.label}
              className={`h-full ${item.color}`}
              style={{ width: `${(item.value / results.monthlyPITI) * 100}%` }}
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
