import { DollarSign } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { RentInputs } from "./types";

export interface AssumptionsCardProps {
  inputs: RentInputs;
  updateInput: (field: keyof RentInputs, value: number | string) => void;
}

export function AssumptionsCard({ inputs, updateInput }: AssumptionsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Assumptions</CardTitle>
        <CardDescription>Adjust these to match your local market.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
