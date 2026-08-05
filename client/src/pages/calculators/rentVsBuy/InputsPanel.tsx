import { Building, Calendar, DollarSign, Home } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/formatters";
import type { CalculatorInputs } from "./types";

export interface InputsPanelProps {
  inputs: CalculatorInputs;
  onChange: (field: keyof CalculatorInputs, value: number) => void;
}

/**
 * The three input cards. Note what is NOT here: propertyTaxRate,
 * insuranceRate and maintenanceRate are fixed assumptions with no control —
 * see the header of calculate.ts.
 */
export function InputsPanel({ inputs, onChange }: InputsPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Renting Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="monthlyRent">Monthly Rent</Label>
            <div className="relative mt-1">
              <DollarSign className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="monthlyRent"
                type="number"
                value={inputs.monthlyRent}
                onChange={(e) => onChange("monthlyRent", Number(e.target.value))}
                className="pl-9"
                data-testid="input-monthly-rent"
              />
            </div>
          </div>
          <div>
            <Label>Annual Rent Increase: {inputs.annualRentIncrease}%</Label>
            <Slider
              value={[inputs.annualRentIncrease]}
              onValueChange={([v]) => onChange("annualRentIncrease", v)}
              min={0}
              max={10}
              step={0.5}
              className="mt-2"
              data-testid="slider-rent-increase"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Home className="h-5 w-5" />
            Home Purchase Details
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
                onChange={(e) => onChange("homePrice", Number(e.target.value))}
                className="pl-9"
                data-testid="input-home-price"
              />
            </div>
          </div>
          <div>
            <Label>
              Down Payment: {inputs.downPaymentPercent}% (
              {formatCurrency((inputs.homePrice * inputs.downPaymentPercent) / 100)})
            </Label>
            <Slider
              value={[inputs.downPaymentPercent]}
              onValueChange={([v]) => onChange("downPaymentPercent", v)}
              min={3}
              max={30}
              step={1}
              className="mt-2"
              data-testid="slider-down-payment"
            />
          </div>
          <div>
            <Label>Interest Rate: {inputs.interestRate}%</Label>
            <Slider
              value={[inputs.interestRate]}
              onValueChange={([v]) => onChange("interestRate", v)}
              min={3}
              max={10}
              step={0.125}
              className="mt-2"
              data-testid="slider-interest-rate"
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
                onChange={(e) => onChange("hoaMonthly", Number(e.target.value))}
                className="pl-9"
                data-testid="input-hoa"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Timeline & Assumptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Years You Plan to Stay: {inputs.yearsToStay} years</Label>
            <Slider
              value={[inputs.yearsToStay]}
              onValueChange={([v]) => onChange("yearsToStay", v)}
              min={1}
              max={30}
              step={1}
              className="mt-2"
              data-testid="slider-years-stay"
            />
          </div>
          <div>
            <Label>Annual Home Appreciation: {inputs.annualAppreciation}%</Label>
            <Slider
              value={[inputs.annualAppreciation]}
              onValueChange={([v]) => onChange("annualAppreciation", v)}
              min={-5}
              max={10}
              step={0.5}
              className="mt-2"
              data-testid="slider-appreciation"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
