import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

interface PricingBreakdown {
  finalRate: number;
  baseRate: number;
  adjustments: {
    creditScoreAndLtv: number;
    propertyType: number;
    condo: number;
    firstTimeBuyerWaiver: number;
  };
  totalLlpaPoints: number;
  rateEquivalent: number;
  llpaFeeAmount: number;
  inputs: { creditScore: number; ltv: number; loanAmount: number };
}

const ADJUSTMENT_LABELS: Record<keyof PricingBreakdown["adjustments"], string> = {
  creditScoreAndLtv: "Credit score & down payment (LLPA grid)",
  propertyType: "Property / occupancy type",
  condo: "Condo adjustment",
  firstTimeBuyerWaiver: "First-time buyer waiver",
};

/** "Why this rate?" — deterministic LLPA decomposition of the quoted rate. */
export function RateBreakdown({ optionId }: { optionId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery<PricingBreakdown>({
    queryKey: ["/api/loan-options", optionId, "pricing-breakdown"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/loan-options/${optionId}/pricing-breakdown`);
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  const fmtPts = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(3)} pts`;

  return (
    <div className="w-full">
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen((o) => !o)}
        data-testid={`button-rate-breakdown-${optionId}`}
      >
        <Percent className="mr-2 h-4 w-4" />
        {open ? "Hide rate details" : "Why this rate?"}
      </Button>
      {open && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-left text-sm" data-testid={`section-rate-breakdown-${optionId}`}>
          {isLoading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base market rate</span>
                <span className="font-medium">{data.baseRate.toFixed(3)}%</span>
              </div>
              {(Object.keys(data.adjustments) as (keyof PricingBreakdown["adjustments"])[])
                .filter((k) => data.adjustments[k] !== 0)
                .map((k) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{ADJUSTMENT_LABELS[k]}</span>
                    <span className="font-medium">{fmtPts(data.adjustments[k])}</span>
                  </div>
                ))}
              <div className="flex justify-between border-t pt-1.5">
                <span className="text-muted-foreground">
                  Total adjustments ({data.totalLlpaPoints.toFixed(3)} pts ≈ rate)
                </span>
                <span className="font-medium">
                  {data.rateEquivalent > 0 ? "+" : ""}
                  {data.rateEquivalent.toFixed(3)}%
                </span>
              </div>
              <div className="flex justify-between border-t pt-1.5 text-base">
                <span className="font-semibold">Your rate</span>
                <span className="font-bold text-primary" data-testid={`text-final-rate-${optionId}`}>
                  {data.finalRate.toFixed(3)}%
                </span>
              </div>
              <p className="pt-1 text-xs text-muted-foreground">
                Based on your {data.inputs.creditScore} credit score and {data.inputs.ltv}%
                loan-to-value. Adjustments follow standard GSE loan-level price adjustment
                grids — no discretion, no markup by profile.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
