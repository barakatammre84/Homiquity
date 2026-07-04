import { useAffordability } from "@/hooks/useAffordability";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, TrendingUp, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface AffordabilityBadgeProps {
  price: number;
  compact?: boolean;
}

export function AffordabilityBadge({ price, compact = false }: AffordabilityBadgeProps) {
  const { data, isLoading, isError } = useAffordability(price);

  if (isLoading) {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1" data-testid="badge-affordability-loading">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Checking...
      </Badge>
    );
  }

  if (isError || !data) return null;

  if (data.meetsGuidelines && data.estimatedDTI && data.estimatedDTI <= 43) {
    return (
      <div className="flex flex-wrap gap-1" data-testid="badge-affordability-fits">
        <Badge variant="secondary" className="text-[10px] gap-1 bg-success-subtle text-success-subtle-foreground no-default-hover-elevate no-default-active-elevate">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Within Guidelines
        </Badge>
        {!compact && data.estimatedDTI && (
          <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
            DTI {data.estimatedDTI}%
          </Badge>
        )}
      </div>
    );
  }

  if (data.meetsGuidelines) {
    return (
      <div className="flex flex-wrap gap-1" data-testid="badge-affordability-stretch">
        <Badge variant="secondary" className="text-[10px] gap-1 bg-warning-subtle text-warning-subtle-foreground no-default-hover-elevate no-default-active-elevate">
          <TrendingUp className="h-2.5 w-2.5" />
          Requires Review
        </Badge>
        {!compact && data.estimatedDTI && (
          <Badge variant="secondary" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
            DTI {data.estimatedDTI}%
          </Badge>
        )}
      </div>
    );
  }

  if (data.additionalSavingsNeeded) {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1 bg-warning-subtle text-warning-subtle-foreground no-default-hover-elevate no-default-active-elevate" data-testid="badge-affordability-savings">
        <AlertTriangle className="h-2.5 w-2.5" />
        {compact ? "Savings Gap" : `Need ${formatCurrency(data.additionalSavingsNeeded)} more`}
      </Badge>
    );
  }

  if (data.estimatedDTI && data.estimatedDTI > 50) {
    return (
      <Badge variant="secondary" className="text-[10px] gap-1 no-default-hover-elevate no-default-active-elevate" data-testid="badge-affordability-over">
        <AlertTriangle className="h-2.5 w-2.5" />
        {compact ? "Exceeds Guidelines" : `DTI ${data.estimatedDTI}% — Exceeds Guidelines`}
      </Badge>
    );
  }

  return null;
}

interface AffordabilityDetailProps {
  price: number;
}

export function AffordabilityDetail({ price }: AffordabilityDetailProps) {
  const { data, isLoading, isError } = useAffordability(price);

  if (isLoading || isError || !data) return null;

  return (
    <div className="space-y-2 text-sm" data-testid="section-affordability-detail">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Est. Monthly Payment</span>
        <span className="font-medium">{data.estimatedMonthlyPayment ? formatCurrency(data.estimatedMonthlyPayment) : "--"}</span>
      </div>
      {data.estimatedDTI !== null && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Your DTI on This Home</span>
          <span className={`font-medium ${data.estimatedDTI <= 43 ? "text-success-subtle-foreground" : data.estimatedDTI <= 50 ? "text-warning-subtle-foreground" : "text-destructive"}`}>
            {data.estimatedDTI}%
          </span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-muted-foreground">Est. Down Payment</span>
        <span className="font-medium">{formatCurrency(data.estimatedDownPayment)}</span>
      </div>
      {data.additionalSavingsNeeded && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Additional Savings Needed</span>
          <span className="font-medium text-warning-subtle-foreground">{formatCurrency(data.additionalSavingsNeeded)}</span>
        </div>
      )}
      {data.eligibleLoanTypes.length > 0 && (
        <div className="flex justify-between">
          <span className="text-muted-foreground">Loan Type</span>
          <span className="font-medium">{data.eligibleLoanTypes.map(t => t.toUpperCase()).join(", ")}</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground italic pt-1">{data.message}</p>
    </div>
  );
}
