import { Building2, CreditCard, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { HomeownerProfile } from "./types";

export function FinancialCards({ profile }: { profile: HomeownerProfile }) {
  const balance = parseFloat(profile.currentLoanBalance || "0");
  const value = parseFloat(profile.propertyValue || "0");
  const equity = value - balance;
  const equityPercent = value > 0 ? ((equity / value) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="financial-summary">
      <Card data-testid="card-balance">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Current Balance</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-balance">{formatCurrency(balance)}</p>
        </CardContent>
      </Card>
      <Card data-testid="card-property-value">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Property Value</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-property-value">{formatCurrency(value)}</p>
        </CardContent>
      </Card>
      <Card data-testid="card-equity">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-success-subtle-foreground" />
            <p className="text-xs text-muted-foreground">Home Equity</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-equity">{formatCurrency(equity)}</p>
          <p className="text-xs text-success-subtle-foreground" data-testid="text-equity-percent">{equityPercent}%</p>
        </CardContent>
      </Card>
      <Card data-testid="card-monthly-payment">
        <CardContent className="py-3">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Monthly Payment</p>
          </div>
          <p className="text-lg font-bold text-foreground" data-testid="text-monthly-payment">{formatCurrency(profile.monthlyPayment)}</p>
        </CardContent>
      </Card>
    </div>
  );
}
