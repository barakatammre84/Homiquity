import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { computeTierResult, type CreditTier, type RentInputs } from "./types";

export interface CreditTierTableProps {
  tiers: CreditTier[];
  inputs: RentInputs;
  activeTierId: string | undefined;
}

export function CreditTierTable({ tiers, inputs, activeTierId }: CreditTierTableProps) {
  const tierRows = useMemo(() => {
    return tiers.map((tier) => ({
      tier,
      result: computeTierResult(inputs.monthlyRent, tier, inputs),
    }));
  }, [tiers, inputs]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Requirements by Credit Tier</CardTitle>
        <CardDescription>
          How your buying power changes with your credit score, at this rent.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tierRows.map(({ tier, result }) => {
            const isActive = activeTierId === tier.id;
            return (
              <div
                key={tier.id}
                className={`rounded-md p-3 ${
                  isActive ? "bg-primary/10 ring-1 ring-primary/30" : "bg-muted/40"
                }`}
                data-testid={`tier-row-${tier.id}`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{tier.label}</span>
                    {isActive && (
                      <Badge variant="secondary" className="text-xs">
                        You
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-bold" data-testid={`tier-price-${tier.id}`}>
                    {formatCurrency(result.homePrice)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    Score {tier.minScore}
                    {tier.maxScore >= 850 ? "+" : `–${tier.maxScore}`}
                  </span>
                  <span>{(tier.minDownPaymentPct * 100).toFixed(0)}% down</span>
                  <span>{tier.interestRate.toFixed(3)}% rate</span>
                  <span>{formatCurrency(result.downPaymentNeeded)} down</span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Estimates use representative pricing from our underwriting engine. Your actual rate
          and terms are confirmed during pre-approval.
        </p>
      </CardContent>
    </Card>
  );
}
