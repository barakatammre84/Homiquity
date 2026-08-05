import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, Home, Percent, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { MortgageInputs } from "./mortgageMath";

export type UpdateInput = (field: keyof MortgageInputs, value: number) => void;

export function PropertyDetailsCard({
  inputs,
  downPayment,
  updateInput,
}: {
  inputs: MortgageInputs;
  downPayment: number;
  updateInput: UpdateInput;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="h-5 w-5" />
          Property Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="homePrice">Home Price</Label>
          <div className="relative mt-1">
            <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="homePrice"
              type="number"
              value={inputs.homePrice}
              onChange={(e) => updateInput("homePrice", Number(e.target.value))}
              className="pl-9"
              data-testid="input-home-price"
            />
          </div>
        </div>
        <div>
          <Label>
            Down Payment: {inputs.downPaymentPercent}% (
            {formatCurrency(downPayment)})
          </Label>
          <Slider
            value={[inputs.downPaymentPercent]}
            onValueChange={([v]) => updateInput("downPaymentPercent", v)}
            min={3}
            max={50}
            step={1}
            className="mt-2"
            data-testid="slider-down-payment"
          />
          {inputs.downPaymentPercent < 20 && (
            <p className="mt-1 text-sm text-warning-subtle-foreground">
              PMI required (less than 20% down)
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function LoanTermsCard({ inputs, updateInput }: { inputs: MortgageInputs; updateInput: UpdateInput }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Loan Terms
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}

export function AdditionalCostsCard({ inputs, updateInput }: { inputs: MortgageInputs; updateInput: UpdateInput }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5" />
          Additional Costs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Property Tax Rate: {inputs.propertyTaxRate}%</Label>
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
          <Label>Insurance Rate: {inputs.insuranceRate}%</Label>
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
        <div>
          <Label htmlFor="hoaMonthly">Monthly HOA Fees</Label>
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
