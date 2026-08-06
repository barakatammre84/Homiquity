import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Loader2, Play } from "lucide-react";
import {
  bestEstimateValue,
  mapPropertyType,
  PRODUCT_FILTERS,
  type AddressSuggestion,
  type PropertyDetail,
  type ScenarioResponse,
} from "./scenarioSimulator/types";
import { AddressIntake } from "./scenarioSimulator/AddressIntake";
import { ScenarioInputsForm } from "./scenarioSimulator/ScenarioInputsForm";
import { ScenarioResults } from "./scenarioSimulator/ScenarioResults";

// -----------------------------------------------------------------------------
// LO-2 — What-If Scenario Simulator (LO Advisor Program).
//
// Per-row dialog on the LO Command Center (pattern: RateLockDialog). The LO
// dials a scenario — optionally prefilled from a typed address via the
// licensed realty adapter (never scraped) — and reads qualified-or-not,
// payment, cash-to-close, and APR from POST /api/scenarios/simulate, which
// composes the deterministic engines server-side and persists every run.
//
// Honesty rails are rendered, not just returned. They live in the child
// modules this file composes — keep them there when editing:
//  - simulated-rate provenance banner (I10) — scenarioSimulator/ScenarioResults.tsx,
//    shown on a status === "OK" result whenever the response is `simulated`;
//  - the §1026.36(e)(2)-(3) anti-steering option set — ScenarioResults.tsx,
//    always rendered above the full offer table;
//  - the FICO what-if is labeled hypothetical, it never triggers a pull (I6) —
//    scenarioSimulator/ScenarioInputsForm.tsx.
// -----------------------------------------------------------------------------

interface ScenarioSimulatorDialogProps {
  applicationId: string;
  borrowerName: string;
}

export function ScenarioSimulatorDialog({ applicationId, borrowerName }: ScenarioSimulatorDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  // --- Address-first intake -------------------------------------------------
  const [addressInput, setAddressInput] = useState("");
  const [debouncedAddress, setDebouncedAddress] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [addressContext, setAddressContext] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedAddress(addressInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [addressInput]);

  const { data: suggestions } = useQuery<AddressSuggestion[]>({
    queryKey: [`/api/properties/auto-complete?input=${encodeURIComponent(debouncedAddress)}`],
    enabled: open && debouncedAddress.length >= 3 && !selectedPropertyId,
    staleTime: 60_000,
  });

  const { data: propertyDetail, isLoading: detailLoading } = useQuery<PropertyDetail>({
    queryKey: [`/api/properties/detail-live?propertyId=${selectedPropertyId}`],
    enabled: open && !!selectedPropertyId,
    staleTime: 60_000,
    retry: false,
  });

  // --- Scenario inputs ------------------------------------------------------
  const [purchasePrice, setPurchasePrice] = useState("");
  const [downPaymentValue, setDownPaymentValue] = useState("20");
  const [downPaymentUnit, setDownPaymentUnit] = useState<"percent" | "amount">("percent");
  const [productFilter, setProductFilter] = useState<(typeof PRODUCT_FILTERS)[number]>("ALL");
  const [occupancyType, setOccupancyType] = useState<"primary_residence" | "second_home" | "investment">("primary_residence");
  const [propertyType, setPropertyType] = useState<"single_family" | "condo" | "townhouse" | "multi_family">("single_family");
  const [numberOfUnits, setNumberOfUnits] = useState("2");
  const [ficoWhatIf, setFicoWhatIf] = useState("");
  const [lockTermDays, setLockTermDays] = useState("30");
  const [annualTaxes, setAnnualTaxes] = useState("");
  const [propertyValue, setPropertyValue] = useState("");
  const [result, setResult] = useState<ScenarioResponse | null>(null);

  // Prefill once per loaded property detail (licensed data, never scraped).
  useEffect(() => {
    if (!propertyDetail) return;
    const estimate = bestEstimateValue(propertyDetail.estimates);
    const price = propertyDetail.price > 0 ? propertyDetail.price : estimate;
    if (price) setPurchasePrice(String(Math.round(price)));
    if (estimate) setPropertyValue(String(Math.round(estimate)));
    const latestTax = propertyDetail.taxHistory?.[0]?.tax;
    if (latestTax && latestTax > 0) setAnnualTaxes(String(Math.round(latestTax)));
    setPropertyType(mapPropertyType(propertyDetail.propertyType));
    setAddressContext({
      line: propertyDetail.address,
      city: propertyDetail.city,
      stateCode: propertyDetail.stateCode,
      zipcode: propertyDetail.zipcode,
      propertyId: propertyDetail.property_id,
      source: "realty-us",
      observedPropertyType: propertyDetail.propertyType,
    });
  }, [propertyDetail]);

  const simulate = useMutation({
    mutationFn: async (): Promise<ScenarioResponse> => {
      const price = parseFloat(purchasePrice);
      const dpValue = parseFloat(downPaymentValue);
      const scenario: Record<string, unknown> = {
        purchasePrice: price,
        ...(downPaymentUnit === "percent"
          ? { downPaymentPercent: dpValue }
          : { downPaymentAmount: dpValue }),
        occupancyType,
        propertyType,
        lockTermDays: Number(lockTermDays),
      };
      if (productFilter !== "ALL") scenario.productTypes = [productFilter];
      if (propertyType === "multi_family") scenario.numberOfUnits = Number(numberOfUnits);
      if (ficoWhatIf.trim() !== "") scenario.ficoWhatIf = Number(ficoWhatIf);
      if (annualTaxes.trim() !== "") scenario.annualPropertyTaxes = parseFloat(annualTaxes);
      if (propertyValue.trim() !== "") scenario.propertyValue = parseFloat(propertyValue);
      if (addressContext) {
        scenario.addressContext = addressContext;
        if (addressContext.stateCode?.length === 2) scenario.propertyState = addressContext.stateCode;
      }
      const res = await apiRequest("POST", "/api/scenarios/simulate", { applicationId, scenario });
      return res.json();
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => {
      toast({ title: "Scenario failed", description: error.message, variant: "destructive" });
    },
  });

  const priceValid = parseFloat(purchasePrice) > 0;
  const dpValid = parseFloat(downPaymentValue) >= 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`open-simulator-${applicationId}`}>
          <Calculator className="mr-1 h-4 w-4" aria-hidden="true" />
          What-If
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" data-testid="scenario-simulator-dialog">
        <DialogHeader>
          <DialogTitle>What-If Simulator — {borrowerName}</DialogTitle>
          <DialogDescription>
            Deterministic scenario from the platform engines: pricing → qualification → APR →
            cash-to-close. Income comes from the file's persisted evaluation.
          </DialogDescription>
        </DialogHeader>

        <AddressIntake
          addressInput={addressInput}
          onAddressInputChange={(value) => {
            setAddressInput(value);
            setSelectedPropertyId(null);
          }}
          suggestions={suggestions}
          selectedPropertyId={selectedPropertyId}
          onSelectSuggestion={(propertyId, label) => {
            setSelectedPropertyId(propertyId);
            setAddressInput(label);
          }}
          detailLoading={detailLoading}
          addressContext={addressContext}
        />

        <ScenarioInputsForm
          purchasePrice={purchasePrice}
          onPurchasePriceChange={setPurchasePrice}
          downPaymentValue={downPaymentValue}
          onDownPaymentValueChange={setDownPaymentValue}
          downPaymentUnit={downPaymentUnit}
          onDownPaymentUnitChange={setDownPaymentUnit}
          productFilter={productFilter}
          onProductFilterChange={setProductFilter}
          occupancyType={occupancyType}
          onOccupancyTypeChange={setOccupancyType}
          propertyType={propertyType}
          onPropertyTypeChange={setPropertyType}
          numberOfUnits={numberOfUnits}
          onNumberOfUnitsChange={setNumberOfUnits}
          ficoWhatIf={ficoWhatIf}
          onFicoWhatIfChange={setFicoWhatIf}
          lockTermDays={lockTermDays}
          onLockTermDaysChange={setLockTermDays}
          annualTaxes={annualTaxes}
          onAnnualTaxesChange={setAnnualTaxes}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Runs are recorded to the file's audit trail. Simulated rate data until the PPE
            contract — never quote as lockable terms.
          </p>
          <Button
            onClick={() => simulate.mutate()}
            disabled={simulate.isPending || !priceValid || !dpValid}
            data-testid="scenario-run-button"
          >
            {simulate.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="mr-1 h-4 w-4" aria-hidden="true" />
            )}
            Run scenario
          </Button>
        </div>

        {result && <ScenarioResults result={result} />}
      </DialogContent>
    </Dialog>
  );
}
