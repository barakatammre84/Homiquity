import { DollarSign, MapPin, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatInputCurrency, parseCurrencyInput } from "@/lib/formatters";
import type { AffordabilityInputs } from "./types";

export interface LoanDetailsCardProps {
  inputs: AffordabilityInputs;
  updateInput: (field: keyof AffordabilityInputs, value: number | string) => void;
}

export function LoanDetailsCard({ inputs, updateInput }: LoanDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Down Payment & Loan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="downPaymentSaved">Down Payment Saved</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="downPaymentSaved"
              value={formatInputCurrency(inputs.downPaymentSaved)}
              onChange={(e) => updateInput("downPaymentSaved", parseCurrencyInput(e.target.value))}
              className="pl-9"
              data-testid="input-down-payment"
            />
          </div>
        </div>
        <div>
          <Label>Credit Score: {inputs.creditScore}</Label>
          <Slider
            value={[inputs.creditScore]}
            onValueChange={([v]) => updateInput("creditScore", v)}
            min={580}
            max={850}
            step={10}
            className="mt-2"
            data-testid="slider-credit-score"
          />
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>580</span>
            <span>700</span>
            <span>850</span>
          </div>
        </div>
        <div>
          <Label>Interest Rate: {inputs.interestRate}%</Label>
          <Slider
            value={[inputs.interestRate]}
            onValueChange={([v]) => updateInput("interestRate", v)}
            min={3}
            max={10}
            step={0.125}
            className="mt-2"
            data-testid="slider-interest-rate"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Loan Term</Label>
            <Select
              value={String(inputs.loanTermYears)}
              onValueChange={(v) => updateInput("loanTermYears", Number(v))}
            >
              <SelectTrigger data-testid="select-loan-term">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 Years</SelectItem>
                <SelectItem value="20">20 Years</SelectItem>
                <SelectItem value="30">30 Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="zipCode">ZIP Code</Label>
            <div className="relative mt-1">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="zipCode"
                maxLength={5}
                placeholder="60462"
                value={inputs.zipCode}
                onChange={(e) => updateInput("zipCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
                className="pl-9"
                data-testid="input-zip-code"
              />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Property Tax: {inputs.propertyTaxRate}%</Label>
            <Slider
              value={[inputs.propertyTaxRate]}
              onValueChange={([v]) => updateInput("propertyTaxRate", v)}
              min={0}
              max={3}
              step={0.1}
              className="mt-2"
              data-testid="slider-property-tax"
            />
          </div>
          <div>
            <Label>Insurance: {inputs.insuranceRate}%</Label>
            <Slider
              value={[inputs.insuranceRate]}
              onValueChange={([v]) => updateInput("insuranceRate", v)}
              min={0}
              max={2}
              step={0.1}
              className="mt-2"
              data-testid="slider-insurance"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="hoaMonthly">Monthly HOA (Optional)</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="hoaMonthly"
              type="number"
              value={inputs.hoaMonthly}
              onChange={(e) => updateInput("hoaMonthly", Number(e.target.value))}
              className="pl-9"
              data-testid="input-hoa"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
