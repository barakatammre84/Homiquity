import { Lock, Percent, Star, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TermTooltip } from "@/components/TermTooltip";
import { formatCurrency, formatPercent, getLoanTypeLabel } from "@/lib/formatters";
import type { LoanOption } from "@shared/schema";
import { MonthlyPaymentPanel } from "./MonthlyPaymentPanel";
import { RateBreakdown } from "./RateBreakdown";

export interface LoanOptionCardProps {
  option: LoanOption;
  steeringAcknowledged: boolean;
  lockPending: boolean;
  onLockRate: (optionId: string) => void;
}

export function LoanOptionCard({ option, steeringAcknowledged, lockPending, onLockRate }: LoanOptionCardProps) {
  return (
    <Card
      className={`relative overflow-hidden ${
        option.isRecommended ? "ring-2 ring-primary" : ""
      }`}
      data-testid={`card-loan-option-${option.loanType}`}
    >
      {option.isRecommended && (
        <div className="absolute right-0 top-0 rounded-bl-lg bg-primary px-3 py-1">
          <div className="flex items-center gap-1 text-xs font-medium text-primary-foreground">
            <Star className="h-3 w-3" />
            Recommended
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">
              {getLoanTypeLabel(option.loanType)}
            </CardTitle>
            <CardDescription>
              {option.loanTerm}-year {parseFloat(option.points || "0") > 0 ? "with points" : "no points"}
            </CardDescription>
          </div>
          <Badge variant="secondary">
            {option.loanTerm} yr
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <MonthlyPaymentPanel option={option} />

        <div className="grid grid-cols-2 gap-4 rounded-lg bg-muted/50 p-4">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Percent className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Rate</span>
            </div>
            <p className="text-lg font-semibold">{formatPercent(option.interestRate)}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <TermTooltip term="apr" className="text-sm text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold">{formatPercent(option.apr)}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Loan Amount</span>
            <span className="font-medium">{formatCurrency(option.loanAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Down Payment</span>
            <span className="font-medium">
              {formatCurrency(option.downPaymentAmount || "0")} ({option.downPaymentPercent}%)
            </span>
          </div>
          {parseFloat(option.points || "0") > 0 && (
            <div className="flex items-center justify-between text-sm">
              <TermTooltip term="points" className="text-muted-foreground">Points</TermTooltip>
              <span className="font-medium">
                {option.points} ({formatCurrency(option.pointsCost || "0")})
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-sm">
            <TermTooltip term="closingCosts" className="text-muted-foreground">Closing Costs</TermTooltip>
            <span className="font-medium">{formatCurrency(option.closingCosts || "0")}</span>
          </div>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between">
              <TermTooltip term="cashToClose" className="font-medium">Cash to Close</TermTooltip>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(option.cashToClose || "0")}
              </span>
            </div>
          </div>
        </div>

        {option.pmi && parseFloat(option.pmi) > 0 && (
          <div className="rounded-lg border border-border bg-warning-subtle p-3">
            <p className="text-xs text-warning-subtle-foreground">
              {option.loanType === "fha" ? (
                <>
                  Includes {formatCurrency(option.pmi)}/mo FHA mortgage insurance (MIP),
                  which usually lasts the life of the loan. Many buyers refinance out of
                  it after reaching 20% equity.
                </>
              ) : (
                <>
                  Includes {formatCurrency(option.pmi)}/mo{" "}
                  <TermTooltip term="pmi" showIcon={false} />. It's temporary — you can
                  request removal once you reach 20% equity.
                </>
              )}
            </p>
          </div>
        )}

        <div className="space-y-2">
          {option.isLocked ? (
            <Button className="w-full" variant="secondary" disabled data-testid={`button-locked-${option.loanType}`}>
              <Lock className="mr-2 h-4 w-4" />
              {option.lockExpiresAt
                ? `Locked — expires ${new Date(option.lockExpiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
                : "Rate Locked"}
            </Button>
          ) : (
            <Button
              className="w-full"
              onClick={() => onLockRate(option.id)}
              disabled={lockPending || !steeringAcknowledged}
              title={!steeringAcknowledged ? "Review the loan options disclosure above first" : undefined}
              data-testid={`button-lock-rate-${option.loanType}`}
            >
              <Lock className="mr-2 h-4 w-4" />
              {lockPending ? "Locking..." : "Lock This Rate"}
            </Button>
          )}
          <RateBreakdown optionId={option.id} />
        </div>
      </CardContent>
    </Card>
  );
}
