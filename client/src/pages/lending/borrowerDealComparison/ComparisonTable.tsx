import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { formatRate } from "./offerMath";
import type { BorrowerOffer } from "./types";

export function ComparisonTable({
  offers,
  onClear,
}: {
  offers: BorrowerOffer[];
  onClear: () => void;
}) {
  return (
    <Card className="mb-6" data-testid="card-comparison">
      <CardHeader>
        <CardTitle className="text-lg">Side-by-Side Comparison</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4">Feature</th>
                {offers.map((offer) => (
                  <th key={offer.id} className="text-center py-2 px-4">
                    {offer.optionLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">Interest Rate</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4 font-medium">{formatRate(offer.rate)}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">APR</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4">{formatRate(offer.apr)}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">Monthly Payment</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4 font-medium">{formatCurrency(offer.monthlyPayment)}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">Points</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4">{offer.points > 0 ? offer.points.toFixed(2) : "None"}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">Cash to Close</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4">{formatCurrency(offer.cashToClose)}</td>
                ))}
              </tr>
              <tr className="border-b">
                <td className="py-2 pr-4 text-muted-foreground">Total Cost @ 3 Years</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4">{formatCurrency(offer.totalCost3yr)}</td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-4 text-muted-foreground">Total Cost @ 5 Years</td>
                {offers.map((offer) => (
                  <td key={offer.id} className="text-center py-2 px-4">{formatCurrency(offer.totalCost5yr)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClear} data-testid="button-clear-comparison">
            Clear Comparison
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
