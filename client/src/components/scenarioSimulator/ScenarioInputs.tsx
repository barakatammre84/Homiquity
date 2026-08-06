import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PRODUCT_FILTERS,
  type DownPaymentUnit,
  type OccupancyType,
  type ProductFilter,
  type PropertyType,
  type ScenarioFormState,
} from "./types";

interface ScenarioInputsProps {
  form: ScenarioFormState;
  onChange: <K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) => void;
}

/**
 * Every dial the LO can turn. Purely controlled — all state lives in the
 * dialog, and the request these produce is built by buildScenarioPayload so
 * that what reaches the engine is testable without rendering any of this.
 */
export function ScenarioInputs({ form, onChange }: ScenarioInputsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="scenario-price">Purchase price</Label>
        <Input
          id="scenario-price"
          type="number"
          inputMode="decimal"
          min="1"
          value={form.purchasePrice}
          onChange={(e) => onChange("purchasePrice", e.target.value)}
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
            value={form.downPaymentValue}
            onChange={(e) => onChange("downPaymentValue", e.target.value)}
            data-testid="scenario-dp-input"
          />
          <Select
            value={form.downPaymentUnit}
            onValueChange={(v) => onChange("downPaymentUnit", v as DownPaymentUnit)}
          >
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
        <Select
          value={form.productFilter}
          onValueChange={(v) => onChange("productFilter", v as ProductFilter)}
        >
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
        <Select
          value={form.occupancyType}
          onValueChange={(v) => onChange("occupancyType", v as OccupancyType)}
        >
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
        <Select
          value={form.propertyType}
          onValueChange={(v) => onChange("propertyType", v as PropertyType)}
        >
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

      {form.propertyType === "multi_family" && (
        <div className="space-y-1.5">
          <Label htmlFor="scenario-units">Units</Label>
          <Select value={form.numberOfUnits} onValueChange={(v) => onChange("numberOfUnits", v)}>
            <SelectTrigger id="scenario-units" data-testid="scenario-units-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["2", "3", "4"].map((u) => (
                <SelectItem key={u} value={u}>
                  {u} units
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        {/* Labeled hypothetical on the control itself (I6): this never triggers
            a credit pull, and an LO must not be able to believe otherwise. */}
        <Label htmlFor="scenario-fico">FICO what-if (hypothetical — never pulls credit)</Label>
        <Input
          id="scenario-fico"
          type="number"
          inputMode="numeric"
          min="300"
          max="850"
          placeholder="Score on file"
          value={form.ficoWhatIf}
          onChange={(e) => onChange("ficoWhatIf", e.target.value)}
          data-testid="scenario-fico-input"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="scenario-lock">Lock term</Label>
        <Select value={form.lockTermDays} onValueChange={(v) => onChange("lockTermDays", v)}>
          <SelectTrigger id="scenario-lock" data-testid="scenario-lock-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {["15", "30", "45", "60", "90"].map((d) => (
              <SelectItem key={d} value={d}>
                {d} days
              </SelectItem>
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
          value={form.annualTaxes}
          onChange={(e) => onChange("annualTaxes", e.target.value)}
          data-testid="scenario-taxes-input"
        />
      </div>
    </div>
  );
}
