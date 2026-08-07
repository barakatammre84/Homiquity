import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Plus, Trash2 } from "lucide-react";
import { MoneyInput } from "./MoneyInput";
import { ACCOUNT_TYPES, type AssetForm } from "./types";

interface AssetsSectionProps {
  assets: AssetForm[];
  onChange: (value: AssetForm[]) => void;
}

export function AssetsSection({ assets, onChange }: AssetsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Section 2a: Assets - Bank Accounts, Retirement, and Other Accounts</CardTitle>
            <CardDescription>
              Where your down payment and reserves live. Include any account you'd like counted
              toward qualifying.
            </CardDescription>
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lock aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
              Account numbers are encrypted — we only ever display the last four digits back to you.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange([...assets, {}])}
            data-testid="button-add-asset"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Asset
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {assets.map((asset, index) => (
          <div key={index} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Asset {index + 1}
                {asset.__isDraft && (
                  <span className="ml-3 inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 text-xs px-2 py-0.5">Draft</span>
                )}
              </h4>
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="icon" aria-label="Delete"
                  onClick={() => onChange(assets.filter((_, i) => i !== index))}
                  data-testid={`button-remove-asset-${index}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Account Type</Label>
                <Select
                  value={asset.accountType || ""}
                  onValueChange={(value) => {
                    const updated = [...assets];
                    updated[index] = { ...updated[index], accountType: value };
                    onChange(updated);
                  }}
                >
                  <SelectTrigger data-testid={`select-asset-type-${index}`}>
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Financial Institution</Label>
                <Input
                  placeholder="Bank Name"
                  value={asset.financialInstitution || ""}
                  onChange={(e) => {
                    const updated = [...assets];
                    updated[index] = { ...updated[index], financialInstitution: e.target.value };
                    onChange(updated);
                  }}
                  data-testid={`input-institution-${index}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Account Number</Label>
                <Input
                  placeholder={
                    asset.accountNumberLast4
                      ? `On file: ••••${asset.accountNumberLast4} (enter to replace)`
                      : "Account #"
                  }
                  value={asset.accountNumber || ""}
                  onChange={(e) => {
                    const updated = [...assets];
                    updated[index] = { ...updated[index], accountNumber: e.target.value };
                    onChange(updated);
                  }}
                  data-testid={`input-account-number-${index}`}
                />
              </div>
              <div className="space-y-2">
                <Label>Cash or Market Value</Label>
                <MoneyInput
                  value={asset.cashOrMarketValue || ""}
                  onChange={(e) => {
                    const updated = [...assets];
                    updated[index] = { ...updated[index], cashOrMarketValue: e.target.value };
                    onChange(updated);
                  }}
                  data-testid={`input-asset-value-${index}`}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
