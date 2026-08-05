import { DollarSign, MapPin, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { formatInputCurrency, parseCurrencyInput } from "@/lib/formatters";
import type { RentInputs } from "./types";

export interface SituationCardProps {
  inputs: RentInputs;
  updateInput: (field: keyof RentInputs, value: number | string) => void;
}

export function SituationCard({ inputs, updateInput }: SituationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Your Situation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="downPaymentSaved">Savings for Down Payment</Label>
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
          <Label htmlFor="zipCode">ZIP Code (Optional)</Label>
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
      </CardContent>
    </Card>
  );
}
