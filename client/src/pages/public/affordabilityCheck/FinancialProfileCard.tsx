import { DollarSign, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatInputCurrency, parseCurrencyInput } from "@/lib/formatters";
import type { FinancialInputs } from "./types";

export interface FinancialProfileCardProps {
  financials: FinancialInputs;
  onChange: (financials: FinancialInputs) => void;
  /** Shown under the down-payment field; comes from the computed result. */
  downPaymentPercent: number;
}

export function FinancialProfileCard({ financials, onChange, downPaymentPercent }: FinancialProfileCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" />
          Your Financial Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>Annual Household Income</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={formatInputCurrency(financials.annualIncome)}
              onChange={(e) => onChange({ ...financials, annualIncome: parseCurrencyInput(e.target.value) })}
              data-testid="input-annual-income"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Monthly Debts (car, student loans, etc.)</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={formatInputCurrency(financials.monthlyDebts)}
              onChange={(e) => onChange({ ...financials, monthlyDebts: parseCurrencyInput(e.target.value) })}
              data-testid="input-monthly-debts"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Down Payment</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={formatInputCurrency(financials.downPayment)}
              onChange={(e) => onChange({ ...financials, downPayment: parseCurrencyInput(e.target.value) })}
              data-testid="input-down-payment"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {downPaymentPercent.toFixed(1)}% of purchase price
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Credit Score</Label>
            <span className="text-sm font-medium" data-testid="text-credit-score">{financials.creditScore}</span>
          </div>
          <Slider
            value={[financials.creditScore]}
            onValueChange={([v]) => onChange({ ...financials, creditScore: v })}
            min={580}
            max={850}
            step={10}
            data-testid="slider-credit-score"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>580</span>
            <span>850</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Interest Rate</Label>
            <span className="text-sm font-medium">{financials.interestRate.toFixed(2)}%</span>
          </div>
          {/* The slider works in basis points so the step lands on clean
              hundredths of a percent; the model stores a percentage. */}
          <Slider
            value={[financials.interestRate * 100]}
            onValueChange={([v]) => onChange({ ...financials, interestRate: v / 100 })}
            min={300}
            max={1000}
            step={5}
          />
        </div>
      </CardContent>
    </Card>
  );
}
