import { useMemo } from "react";
import { ArrowRight, CheckCircle2, AlertTriangle, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { CreditTier, TierResult } from "./types";

export interface ReadinessGapCardProps {
  primary: TierResult;
  tiers: CreditTier[];
  downPaymentSaved: number;
  creditScore: number;
}

export function ReadinessGapCard({ primary, tiers, downPaymentSaved, creditScore }: ReadinessGapCardProps) {
  const downPaymentGap = primary.downPaymentNeeded - downPaymentSaved;
  const hasDownPayment = downPaymentGap <= 0;

  const tierForThreePct = tiers.find((t) => t.minDownPaymentPct <= 0.03);
  const creditReadyForBest = tierForThreePct ? creditScore >= tierForThreePct.minScore : false;

  const nextSteps = useMemo(() => {
    const steps: { icon: typeof CheckCircle2; tone: "good" | "todo"; text: string }[] = [];

    if (hasDownPayment) {
      steps.push({
        icon: CheckCircle2,
        tone: "good",
        text: `Your savings cover the ${formatCurrency(primary.downPaymentNeeded)} down payment needed at this price.`,
      });
    } else {
      steps.push({
        icon: Wallet,
        tone: "todo",
        text: `Save about ${formatCurrency(downPaymentGap)} more to reach the ${formatCurrency(primary.downPaymentNeeded)} down payment for this price.`,
      });
    }

    if (!creditReadyForBest && tierForThreePct) {
      steps.push({
        icon: TrendingUp,
        tone: "todo",
        text: `Raise your credit score to ${tierForThreePct.minScore}+ to unlock a 3% down payment and better pricing.`,
      });
    } else {
      steps.push({
        icon: CheckCircle2,
        tone: "good",
        text: `Your credit score qualifies you for this tier's best available down payment of ${(primary.minDownPaymentPct * 100).toFixed(0)}%.`,
      });
    }

    if (hasDownPayment && creditReadyForBest) {
      steps.push({
        icon: Sparkles,
        tone: "good",
        text: "You look ready — start your pre-approval to lock in the details.",
      });
    } else {
      steps.push({
        icon: ArrowRight,
        tone: "todo",
        text: "You can still get pre-approved now to see your real numbers and a personalized plan.",
      });
    }

    return steps;
  }, [primary, hasDownPayment, downPaymentGap, creditReadyForBest, tierForThreePct]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your Readiness Gap</CardTitle>
        <CardDescription>What stands between you and this home.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Down payment needed</p>
            <p className="text-lg font-bold" data-testid="text-down-needed">
              {formatCurrency(primary.downPaymentNeeded)}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">You've saved</p>
            <p className="text-lg font-bold" data-testid="text-down-saved">
              {formatCurrency(downPaymentSaved)}
            </p>
          </div>
        </div>

        {hasDownPayment ? (
          <div className="flex items-start gap-2 rounded-lg bg-success-subtle p-3">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-subtle-foreground" />
            <p className="text-sm">
              You have enough saved for the down payment on a {formatCurrency(primary.homePrice)} home.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-lg bg-warning-subtle p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-subtle-foreground" />
            <p className="text-sm" data-testid="text-down-gap">
              You're {formatCurrency(downPaymentGap)} short of the down payment for this price.
            </p>
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium">Your next steps</p>
          {nextSteps.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={i} className="flex items-start gap-2 text-sm" data-testid={`next-step-${i}`}>
                <Icon
                  className={`mt-0.5 h-4 w-4 shrink-0 ${
                    step.tone === "good"
                      ? "text-success-subtle-foreground"
                      : "text-muted-foreground"
                  }`}
                />
                <span className="text-muted-foreground">{step.text}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
