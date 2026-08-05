import { CreditCard, DollarSign, Percent } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { AcceleratorEnrollment } from "./types";

export function FinancialSnapshot({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-6" data-testid="financial-snapshot">
      <Card data-testid="card-credit-score">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Credit Score</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground" data-testid="text-current-credit">
              {enrollment.currentCreditScore ?? "--"}
            </span>
            {enrollment.targetCreditScore && (
              <span className="text-xs text-muted-foreground" data-testid="text-target-credit">
                / {enrollment.targetCreditScore}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-savings">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Savings</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground" data-testid="text-current-savings">
              {formatCurrency(enrollment.currentSavings)}
            </span>
            {enrollment.targetDownPayment && (
              <span className="text-xs text-muted-foreground" data-testid="text-target-savings">
                / {formatCurrency(enrollment.targetDownPayment)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-dti">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">DTI Ratio</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-foreground" data-testid="text-current-dti">
              {enrollment.currentDti ? `${enrollment.currentDti}%` : "--"}
            </span>
            {enrollment.targetDti && (
              <span className="text-xs text-muted-foreground" data-testid="text-target-dti">
                / {enrollment.targetDti}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
