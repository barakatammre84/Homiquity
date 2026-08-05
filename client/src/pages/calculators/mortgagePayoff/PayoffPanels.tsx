import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Clock, DollarSign, Percent, TrendingDown, Zap } from "lucide-react";
import { formatCurrency, formatDuration } from "@/lib/formatters";
import { payoffProgressPercent, type PayoffInputs, type PayoffResults } from "./payoffMath";

export type UpdateInput = <K extends keyof PayoffInputs>(field: K, value: PayoffInputs[K]) => void;

export function CurrentLoanCard({
  inputs,
  basePayment,
  updateInput,
}: {
  inputs: PayoffInputs;
  basePayment: number;
  updateInput: UpdateInput;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Your Current Loan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="currentBalance">Current Balance</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="currentBalance"
              type="number"
              value={inputs.currentBalance}
              onChange={(e) => updateInput("currentBalance", Number(e.target.value))}
              className="pl-9"
              data-testid="input-current-balance"
            />
          </div>
        </div>
        <div>
          <Label>Interest Rate: {inputs.interestRate}%</Label>
          <Slider
            value={[inputs.interestRate]}
            onValueChange={([v]) => updateInput("interestRate", v)}
            min={2}
            max={12}
            step={0.125}
            className="mt-2"
            data-testid="slider-interest-rate"
          />
        </div>
        <div>
          <Label>Years Remaining: {inputs.remainingTermYears}</Label>
          <Slider
            value={[inputs.remainingTermYears]}
            onValueChange={([v]) => updateInput("remainingTermYears", v)}
            min={1}
            max={30}
            step={1}
            className="mt-2"
            data-testid="slider-remaining-term"
          />
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <span className="text-muted-foreground">Current scheduled payment (P&amp;I): </span>
          <span className="font-medium" data-testid="text-base-payment">
            {formatCurrency(basePayment)}/mo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * The three accelerators. Both dollar inputs floor at 0 — a negative "extra
 * payment" would model paying less than scheduled, which is not what this page
 * is for and would silently lengthen the projected payoff.
 */
export function StrategyCard({ inputs, updateInput }: { inputs: PayoffInputs; updateInput: UpdateInput }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Your Payoff Strategy
        </CardTitle>
        <CardDescription>Add any combination below</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="extraMonthly">Extra Monthly Payment</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="extraMonthly"
              type="number"
              value={inputs.extraMonthly}
              onChange={(e) => updateInput("extraMonthly", Math.max(0, Number(e.target.value)))}
              className="pl-9"
              data-testid="input-extra-monthly"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="oneTimeExtra">One-Time Extra Payment (now)</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="oneTimeExtra"
              type="number"
              value={inputs.oneTimeExtra}
              onChange={(e) => updateInput("oneTimeExtra", Math.max(0, Number(e.target.value)))}
              className="pl-9"
              data-testid="input-one-time-extra"
            />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div>
            <Label htmlFor="biweekly" className="cursor-pointer">Biweekly payments</Label>
            <p className="text-xs text-muted-foreground">
              Half-payments every two weeks = one extra payment a year
            </p>
          </div>
          <Switch
            id="biweekly"
            checked={inputs.biweekly}
            onCheckedChange={(v) => updateInput("biweekly", v)}
            data-testid="switch-biweekly"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function InterestSavedCard({ results }: { results: PayoffResults }) {
  return (
    <Card className="border-2 border-primary bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Interest You'd Save
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-4xl font-bold text-primary" data-testid="text-interest-saved">
            {formatCurrency(results.interestSaved)}
          </p>
          <p className="mt-2 text-muted-foreground" data-testid="text-time-saved">
            and pay off {formatDuration(results.monthsSaved)} sooner
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Two bars: the current plan always at 100%, the strategy scaled against it. */
export function PayoffComparisonCard({ results }: { results: PayoffResults }) {
  const progressPct = payoffProgressPercent(results);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Payoff Comparison
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Current plan</span>
              <span className="font-medium" data-testid="text-baseline-time">
                {formatDuration(results.baselineMonths)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-chart-4" style={{ width: "100%" }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(results.baselineInterest)} total interest
            </p>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">With your strategy</span>
              <span className="font-medium" data-testid="text-accelerated-time">
                {formatDuration(results.acceleratedMonths)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-chart-1" style={{ width: `${progressPct}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatCurrency(results.acceleratedInterest)} total interest
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
