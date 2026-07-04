import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AddressInput } from "@/components/AddressInput";
import { US_STATES } from "@/lib/us-states";
import type { LoanApplication, UrlaPropertyInfo } from "@shared/schema";
import { MoneyInput } from "./MoneyInput";

interface PropertySectionProps {
  propertyInfo: Partial<UrlaPropertyInfo>;
  onChange: (value: Partial<UrlaPropertyInfo>) => void;
  app: LoanApplication;
}

export function PropertySection({ propertyInfo, onChange, app }: PropertySectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Property Information and Loan Details</CardTitle>
        <CardDescription>
          The home this loan is for. We've carried over what you told us during pre-approval —
          just confirm or correct it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <h4 className="font-semibold">Property Address</h4>
        <div className="mb-3">
          <Label>Search Address</Label>
          <AddressInput
            placeholder="Start typing the property address..."
            defaultValue={propertyInfo.propertyStreet || app.propertyAddress || ""}
            onSelect={(result) => onChange({
              ...propertyInfo,
              propertyStreet: result.streetAddress || result.formattedAddress,
              propertyCity: result.city,
              propertyState: result.state,
              propertyZip: result.zip,
              propertyCounty: result.county || propertyInfo.propertyCounty,
            })}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="property-street">Street Address</Label>
            <Input
              id="property-street"
              placeholder="Street Address"
              value={propertyInfo.propertyStreet || app.propertyAddress || ""}
              onChange={(e) => onChange({ ...propertyInfo, propertyStreet: e.target.value })}
              data-testid="input-property-street"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-unit">Unit #</Label>
            <Input
              id="property-unit"
              placeholder="Unit #"
              value={propertyInfo.propertyUnit || ""}
              onChange={(e) => onChange({ ...propertyInfo, propertyUnit: e.target.value })}
              data-testid="input-property-unit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-city">City</Label>
            <Input
              id="property-city"
              placeholder="City"
              value={propertyInfo.propertyCity || app.propertyCity || ""}
              onChange={(e) => onChange({ ...propertyInfo, propertyCity: e.target.value })}
              data-testid="input-property-city"
            />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="property-state">State</Label>
            <Select
              value={propertyInfo.propertyState || app.propertyState || ""}
              onValueChange={(value) => onChange({ ...propertyInfo, propertyState: value })}
            >
              <SelectTrigger id="property-state" data-testid="select-property-state">
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.value} value={state.value}>{state.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="property-zip">ZIP Code</Label>
            <Input
              id="property-zip"
              placeholder="ZIP"
              value={propertyInfo.propertyZip || app.propertyZip || ""}
              onChange={(e) => onChange({ ...propertyInfo, propertyZip: e.target.value })}
              data-testid="input-property-zip"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number-of-units">Number of Units</Label>
            <Input
              id="number-of-units"
              type="number"
              min="1"
              value={propertyInfo.numberOfUnits ?? 1}
              onChange={(e) => onChange({ ...propertyInfo, numberOfUnits: parseInt(e.target.value) || 1 })}
              data-testid="input-number-units"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="occupancy-type">Occupancy Type</Label>
            <Select
              value={propertyInfo.occupancyType || "primary_residence"}
              onValueChange={(value) => onChange({ ...propertyInfo, occupancyType: value })}
            >
              <SelectTrigger id="occupancy-type" data-testid="select-occupancy-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary_residence">Primary Residence</SelectItem>
                <SelectItem value="second_home">Second Home</SelectItem>
                <SelectItem value="investment">Investment Property</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <hr />

        <h4 className="font-semibold">Loan Details</h4>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="property-value">Property Value</Label>
            <MoneyInput
              id="property-value"
              value={propertyInfo.propertyValue || app.propertyValue || app.purchasePrice || ""}
              onChange={(e) => onChange({ ...propertyInfo, propertyValue: e.target.value })}
              data-testid="input-property-value"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loan-purpose">Loan Purpose</Label>
            <Select defaultValue={app.loanPurpose || "purchase"} disabled>
              <SelectTrigger id="loan-purpose" data-testid="select-loan-purpose">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">Purchase</SelectItem>
                <SelectItem value="refinance">Refinance</SelectItem>
                <SelectItem value="cash_out">Cash Out Refinance</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set during pre-approval — message your loan team if this should change.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loan-type">Loan Type</Label>
            <Select defaultValue={app.preferredLoanType || "conventional"} disabled>
              <SelectTrigger id="loan-type" data-testid="select-loan-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conventional">Conventional</SelectItem>
                <SelectItem value="fha">FHA</SelectItem>
                <SelectItem value="va">VA</SelectItem>
                <SelectItem value="usda">USDA</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Set during pre-approval — message your loan team if this should change.
            </p>
          </div>
        </div>

        <hr />

        <div className="space-y-4">
          <h4 className="font-semibold">Special Property Characteristics</h4>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mixed-use"
                checked={propertyInfo.isMixedUse || false}
                onCheckedChange={(checked) => onChange({ ...propertyInfo, isMixedUse: !!checked })}
                data-testid="checkbox-mixed-use"
              />
              <Label htmlFor="mixed-use" className="font-normal">
                This property is mixed-use (e.g., residential and commercial)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="manufactured"
                checked={propertyInfo.isManufacturedHome || false}
                onCheckedChange={(checked) => onChange({ ...propertyInfo, isManufacturedHome: !!checked })}
                data-testid="checkbox-manufactured"
              />
              <Label htmlFor="manufactured" className="font-normal">
                This is a manufactured home
              </Label>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
