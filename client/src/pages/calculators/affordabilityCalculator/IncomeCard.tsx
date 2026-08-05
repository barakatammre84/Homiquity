import { Briefcase, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatInputCurrency, parseCurrencyInput } from "@/lib/formatters";

export interface IncomeCardProps {
  annualIncome: number;
  onChange: (value: number) => void;
}

export function IncomeCard({ annualIncome, onChange }: IncomeCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Income
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="annualIncome">Annual Gross Income</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="annualIncome"
              value={formatInputCurrency(annualIncome)}
              onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
              className="pl-9"
              data-testid="input-annual-income"
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Monthly: {formatCurrency(annualIncome / 12)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
