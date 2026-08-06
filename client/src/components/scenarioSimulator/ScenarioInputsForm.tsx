import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_FILTERS } from "./types";

// The scenario-inputs grid, extracted verbatim from ScenarioSimulatorDialog.tsx.
export function ScenarioInputsForm({
  purchasePrice,
  onPurchasePriceChange,
  downPaymentValue,
  onDownPaymentValueChange,
  downPaymentUnit,
  onDownPaymentUnitChange,
  productFilter,
  onProductFilterChange,
  occupancyType,
  onOccupancyTypeChange,
  propertyType,
  onPropertyTypeChange,
  numberOfUnits,
  onNumberOfUnitsChange,
  ficoWhatIf,
  onFicoWhatIfChange,
  lockTermDays,
  onLockTermDaysChange,
  annualTaxes,
  onAnnualTaxesChange,
}: {
  purchasePrice: string;
  onPurchasePriceChange: (value: string) => void;
  downPaymentValue: string;
  onDownPaymentValueChange: (value: string) => void;
  downPaymentUnit: "percent" | "amount";
  onDownPaymentUnitChange: (value: "percent" | "amount") => void;
  productFilter: (typeof PRODUCT_FILTERS)[number];
  onProductFilterChange: (value: (typeof PRODUCT_FILTERS)[number]) => void;
  occupancyType: "primary_residence" | "second_home" | "investment";
  onOccupancyTypeChange: (value: "primary_residence" | "second_home" | "investment") => void;
  propertyType: "single_family" | "condo" | "townhouse" | "multi_family";
  onPropertyTypeChange: (value: "single_family" | "condo" | "townhouse" | "multi_family") => void;
  numberOfUnits: string;
  onNumberOfUnitsChange: (value: string) => void;
  ficoWhatIf: string;
  onFicoWhatIfChange: (value: string) => void;
  lockTermDays: string;
  onLockTermDaysChange: (value: string) => void;
  annualTaxes: string;
  onAnnualTaxesChange: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="scenario-price">Purchase price</Label>
        <Input
          id="scenario-price"
          type="number"
          inputMode="decimal"
          min="1"
          value={purchasePrice}
          onChange={(e) => onPurchasePriceChange(e.target.value)}
          data-testid="scenario-price-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scenario-down-payment">Down payment</Label>
        <div className="flex gap-2">
          <Input
            id="scenario-down-payment"
            type="number"
            inputMode="decimal"
            min="0"
            value={downPaymentValue}
            onChange={(e) => onDownPaymentValueChange(e.target.value)}
            data-testid="scenario-dp-input"
          />
          <Select value={downPaymentUnit} onValueChange={(v) => onDownPaymentUnitChange(v as "percent" | "amount")}>
            <SelectTrigger className="w-20" aria-label="Down payment unit" data-testid="scenario-dp-unit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">%</SelectItem>
              <SelectItem value="amount">$</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scenario-product">Product</Label>
        <Select value={productFilter} onValueChange={(v) => onProductFilterChange(v as (typeof PRODUCT_FILTERS)[number])}>
          <SelectTrigger id="scenario-product" data-testid="scenario-product-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_FILTERS.map((p) => (
              <SelectItem key={p} value={p}>
                {p === "ALL" ? "All products" : p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scenario-occupancy">Occupancy</Label>
        <Select value={occupancyType} onValueChange={(v) => onOccupancyTypeChange(v as typeof occupancyType)}>
          <SelectTrigger id="scenario-occupancy" data-testid="scenario-occupancy-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="primary_residence">Primary residence</SelectItem>
            <SelectItem value="second_home">Second home</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scenario-property-type">Property type</Label>
        <Select value={propertyType} onValueChange={(v) => onPropertyTypeChange(v as typeof propertyType)}>
          <SelectTrigger id="scenario-property-type" data-testid="scenario-property-type-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="single_family">Single family</SelectItem>
            <SelectItem value="condo">Condo</SelectItem>
            <SelectItem value="townhouse">Townhouse</SelectItem>
            <SelectItem value="multi_family">Multi-family (2–4)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {propertyType === "multi_family" && (
        <div className="space-y-1.5">
          <Label htmlFor="scenario-units">Units</Label>
          <Select value={numberOfUnits} onValueChange={onNumberOfUnitsChange}>
            <SelectTrigger id="scenario-units" data-testid="scenario-units-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["2", "3", "4"].map((u) => (
                <SelectItem key={u} value={u}>{u} units</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="scenario-fico">FICO what-if (hypothetical — never pulls credit)</Label>
        <Input
          id="scenario-fico"
          type="number"
          inputMode="numeric"
          min="300"
          max="850"
          placeholder="Score on file"
          value={ficoWhatIf}
          onChange={(e) => onFicoWhatIfChange(e.target.value)}
          data-testid="scenario-fico-input"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scenario-lock">Lock term</Label>
        <Select value={lockTermDays} onValueChange={onLockTermDaysChange}>
          <SelectTrigger id="scenario-lock" data-testid="scenario-lock-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["15", "30", "45", "60", "90"].map((d) => (
              <SelectItem key={d} value={d}>{d} days</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="scenario-taxes">Annual property taxes (optional)</Label>
        <Input
          id="scenario-taxes"
          type="number"
          inputMode="decimal"
          min="0"
          placeholder="Platform estimate"
          value={annualTaxes}
          onChange={(e) => onAnnualTaxesChange(e.target.value)}
          data-testid="scenario-taxes-input"
        />
      </div>
    </div>
  );
}
