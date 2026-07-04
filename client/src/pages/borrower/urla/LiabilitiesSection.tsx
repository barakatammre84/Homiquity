import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { MoneyInput } from "./MoneyInput";
import { LIABILITY_TYPES, type LiabilityForm } from "./types";

interface LiabilitiesSectionProps {
  liabilities: LiabilityForm[];
  onChange: (value: LiabilityForm[]) => void;
}

export function LiabilitiesSection({ liabilities, onChange }: LiabilitiesSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Section 2: Liabilities - Debts and Obligations</CardTitle>
            <CardDescription>
              What you pay each month — credit cards, loans, alimony, and the like. Being
              thorough here prevents surprises during underwriting; nothing on this list
              disqualifies you.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange([...liabilities, {}])}
            data-testid="button-add-liability"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Liability
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {liabilities.map((liability, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Liability {index + 1}</h4>
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="icon" aria-label="Delete"
                  onClick={() => onChange(liabilities.filter((_, i) => i !== index))}
                  data-testid={`button-remove-liability-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-2">
                <Label>Liability Type</Label>
                <Select
                  value={liability.liabilityType || ""}
                  onValueChange={(value) => {
                    const updated = [...liabilities];
                    updated[index] = { ...updated[index], liabilityType: value };
                    onChange(updated);
                  }}
                >
                  <SelectTrigger data-testid={`select-liability-type-${index}`}>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LIABILITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Creditor Name</Label>
                <Input
                  placeholder="Creditor"
                  value={liability.creditorName || ""}
                  onChange={(e) => {
                    const updated = [...liabilities];
                    updated[index] = { ...updated[index], creditorName: e.target.value };
                    onChange(updated);
                  }}
                  data-testid={`input-creditor-${index}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Unpaid Balance</Label>
                <MoneyInput
                  value={liability.unpaidBalance || ""}
                  onChange={(e) => {
                    const updated = [...liabilities];
                    updated[index] = { ...updated[index], unpaidBalance: e.target.value };
                    onChange(updated);
                  }}
                  data-testid={`input-balance-${index}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Monthly Payment</Label>
                <MoneyInput
                  value={liability.monthlyPayment || ""}
                  onChange={(e) => {
                    const updated = [...liabilities];
                    updated[index] = { ...updated[index], monthlyPayment: e.target.value };
                    onChange(updated);
                  }}
                  data-testid={`input-monthly-payment-${index}`}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id={`paid-off-${index}`}
                  checked={liability.toBePaidOff || false}
                  onCheckedChange={(checked) => {
                    const updated = [...liabilities];
                    updated[index] = { ...updated[index], toBePaidOff: !!checked };
                    onChange(updated);
                  }}
                  data-testid={`checkbox-paid-off-${index}`}
                />
                <Label htmlFor={`paid-off-${index}`} className="font-normal text-sm">To be paid off</Label>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
