import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { AffordabilityResults } from "./types";

export interface PriceRangesCardProps {
  results: AffordabilityResults;
}

export function PriceRangesCard({ results }: PriceRangesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Price Ranges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-success-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success-subtle-foreground" />
              <span className="text-sm font-medium">Comfortable</span>
            </div>
            <span className="font-bold text-success-subtle-foreground" data-testid="text-comfortable-price">
              {formatCurrency(results.comfortablePrice)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground pl-6">Room for savings and lifestyle</p>
        </div>
        <div className="rounded-lg bg-warning-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-subtle-foreground" />
              <span className="text-sm font-medium">Stretch</span>
            </div>
            <span className="font-bold text-warning-subtle-foreground" data-testid="text-stretch-price">
              {formatCurrency(results.stretchPrice)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground pl-6">Tighter budget, less flexibility</p>
        </div>
      </CardContent>
    </Card>
  );
}
