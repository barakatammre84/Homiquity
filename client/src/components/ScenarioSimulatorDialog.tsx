import { useEffect, useMemo, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatCurrencyDecimal } from "@/lib/formatters";
import { Calculator, Info, Loader2, MapPin, Play, Scale } from "lucide-react";
import {
  PRODUCT_FILTERS,
  buildScenarioPayload,
  derivePropertyPrefill,
  type AddressSuggestion,
  type AntiSteeringOption,
  type EvaluatedOffer,
  type OfferQualification,
  type PropertyDetail,
  type ScenarioResponse,
} from "./scenarioSimulator/scenarioRequest";

// -----------------------------------------------------------------------------
// LO-2 — What-If Scenario Simulator (LO Advisor Program).
//
// Per-row dialog on the LO Command Center (pattern: RateLockDialog). The LO
// dials a scenario — optionally prefilled from a typed address via the
// licensed realty adapter (never scraped) — and reads qualified-or-not,
// payment, cash-to-close, and APR from POST /api/scenarios/simulate, which
// composes the deterministic engines server-side and persists every run.
//
// Honesty rails rendered here, not just returned:
//  - simulated-rate provenance banner (I10) on every result;
//  - the §1026.36(e)(2)-(3) anti-steering option set is always shown first;
//  - the FICO what-if is labeled hypothetical — it never triggers a pull (I6).
// -----------------------------------------------------------------------------

const OPTION_LABELS: Record<AntiSteeringOption["key"], string> = {
  lowest_rate: "Lowest rate",
  lowest_rate_no_risky_features: "Lowest rate, no risky features",
  lowest_points_and_fees: "Lowest points & fees",
};

const DECISION_BADGE: Record<
  OfferQualification["decision"],
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  APPROVED: { label: "Qualifies", variant: "success" },
  MANUAL_REVIEW: { label: "Manual review", variant: "warning" },
  REJECTED: { label: "Does not qualify", variant: "destructive" },
};

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
    const prefill = derivePropertyPrefill(propertyDetail);
    if (prefill.purchasePrice) setPurchasePrice(prefill.purchasePrice);
    if (prefill.propertyValue) setPropertyValue(prefill.propertyValue);
    if (prefill.annualTaxes) setAnnualTaxes(prefill.annualTaxes);
    setPropertyType(prefill.propertyType);
    setAddressContext(prefill.addressContext);
  }, [propertyDetail]);

  const simulate = useMutation({
    mutationFn: async (): Promise<ScenarioResponse> => {
      const scenario = buildScenarioPayload({
        purchasePrice,
        downPaymentValue,
        downPaymentUnit,
        productFilter,
        occupancyType,
        propertyType,
        numberOfUnits,
        ficoWhatIf,
        lockTermDays,
        annualTaxes,
        propertyValue,
        addressContext,
      });
      const res = await apiRequest("POST", "/api/scenarios/simulate", { applicationId, scenario });
      return res.json();
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => {
      toast({ title: "Scenario failed", description: error.message, variant: "destructive" });
    },
  });

  const offersById = useMemo(() => {
    const map = new Map<string, EvaluatedOffer>();
    for (const offer of result?.offers ?? []) map.set(`${offer.lenderId}:${offer.productId}`, offer);
    return map;
  }, [result]);

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

        {/* Address-first intake (licensed property data prefill) */}
        <div className="space-y-2">
          <Label htmlFor="scenario-address">Subject property address (optional prefill)</Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="scenario-address"
              className="pl-8"
              placeholder="Start typing an address…"
              value={addressInput}
              autoComplete="off"
              onChange={(e) => {
                setAddressInput(e.target.value);
                setSelectedPropertyId(null);
              }}
              data-testid="scenario-address-input"
            />
          </div>
          {!selectedPropertyId && (suggestions?.length ?? 0) > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border" data-testid="scenario-address-suggestions">
              {suggestions!.filter((s) => s.type === "address").slice(0, 5).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedPropertyId(s.id.replace(/^addr:/, ""));
                      setAddressInput(s.label);
                    }}
                    data-testid={`scenario-suggestion-${s.id}`}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {detailLoading && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading property data…
            </p>
          )}
          {addressContext && (
            <p className="text-sm text-muted-foreground" data-testid="scenario-prefill-note">
              Prefilled from licensed property data: {addressContext.line}, {addressContext.city}{" "}
              {addressContext.stateCode} (taxes and value editable below).
            </p>
          )}
        </div>

        {/* Scenario inputs */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="scenario-price">Purchase price</Label>
            <Input
              id="scenario-price"
              type="number"
              inputMode="decimal"
              min="1"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
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
                onChange={(e) => setDownPaymentValue(e.target.value)}
                data-testid="scenario-dp-input"
              />
              <Select value={downPaymentUnit} onValueChange={(v) => setDownPaymentUnit(v as "percent" | "amount")}>
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
            <Select value={productFilter} onValueChange={(v) => setProductFilter(v as (typeof PRODUCT_FILTERS)[number])}>
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
            <Select value={occupancyType} onValueChange={(v) => setOccupancyType(v as typeof occupancyType)}>
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
            <Select value={propertyType} onValueChange={(v) => setPropertyType(v as typeof propertyType)}>
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
              <Select value={numberOfUnits} onValueChange={setNumberOfUnits}>
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
              onChange={(e) => setFicoWhatIf(e.target.value)}
              data-testid="scenario-fico-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scenario-lock">Lock term</Label>
            <Select value={lockTermDays} onValueChange={setLockTermDays}>
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
              onChange={(e) => setAnnualTaxes(e.target.value)}
              data-testid="scenario-taxes-input"
            />
          </div>
        </div>

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

        {/* Results */}
        {result && result.status !== "OK" && (
          <Card className="border-warning-subtle-foreground/25 bg-warning-subtle" data-testid="scenario-gap-card">
            <CardContent className="p-4 text-warning-subtle-foreground">
              <p className="font-medium">
                {result.status === "NEEDS_INCOME_EVALUATION"
                  ? "No persisted income evaluation"
                  : result.status === "NO_ELIGIBLE_PRODUCTS"
                    ? "No products in the catalog match this scenario"
                    : "More information needed"}
              </p>
              {result.missingItems.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {result.missingItems.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {result && result.status === "OK" && (
          <div className="space-y-4" data-testid="scenario-results">
            {result.simulated && (
              <Card className="border-warning-subtle-foreground/25 bg-warning-subtle" data-testid="scenario-simulated-banner">
                <CardContent className="flex items-start gap-2 p-3 text-sm text-warning-subtle-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    Simulated rate data — deterministic rate sheets stand in until the PPE
                    contract. Directionally useful; not lockable terms.
                  </span>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm" data-testid="scenario-income-strip">
              <span>
                Qualifying income:{" "}
                <span className="font-medium tabular-nums">
                  {formatCurrencyDecimal(result.income?.primaryMonthlyQualifyingIncome ?? 0)}/mo
                </span>{" "}
                <span className="text-muted-foreground">({result.income?.incomeBasis === "urla_line_items" ? "URLA line items" : "application summary"})</span>
              </span>
              <span>
                Monthly debts:{" "}
                <span className="font-medium tabular-nums">{formatCurrencyDecimal(result.monthlyDebts ?? 0)}</span>
              </span>
              <span className="text-muted-foreground">Engine time {result.serverMs}ms</span>
            </div>

            {result.antiSteering && result.antiSteering.options.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Scale className="h-4 w-4 text-primary" aria-hidden="true" />
                  Anti-steering options ({result.antiSteering.citation}) — {result.antiSteering.creditorsQuoted} lenders quoted
                </h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {result.antiSteering.options.map((option) => {
                    const offer = offersById.get(`${option.lenderId}:${option.productId}`);
                    if (!offer) return null;
                    const badge = DECISION_BADGE[offer.qualification.decision];
                    return (
                      <Card key={option.key} data-testid={`anti-steering-${option.key}`}>
                        <CardContent className="space-y-1.5 p-4">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {OPTION_LABELS[option.key]}
                          </p>
                          <p className="text-sm font-medium">{offer.productName}</p>
                          <p className="text-2xl font-semibold tabular-nums">
                            {offer.adjustedRate.toFixed(3)}%
                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                              APR {offer.apr.toFixed(3)}%
                            </span>
                          </p>
                          <p className="text-sm tabular-nums">
                            {formatCurrencyDecimal(offer.payment.totalPiti)}/mo ·{" "}
                            {formatCurrency(offer.costs.cashToClose)} to close
                          </p>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm" data-testid="scenario-offer-table">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-3 py-2">Product</th>
                    <th scope="col" className="px-3 py-2 text-right">Rate</th>
                    <th scope="col" className="px-3 py-2 text-right">APR</th>
                    <th scope="col" className="px-3 py-2 text-right">P&I</th>
                    <th scope="col" className="px-3 py-2 text-right">PITI</th>
                    <th scope="col" className="px-3 py-2 text-right">Cash to close</th>
                    <th scope="col" className="px-3 py-2 text-right">DTI</th>
                    <th scope="col" className="px-3 py-2">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {result.offers.map((offer) => {
                    const badge = DECISION_BADGE[offer.qualification.decision];
                    return (
                      <tr
                        key={`${offer.lenderId}:${offer.productId}`}
                        className="border-b border-border last:border-0"
                        data-testid={`offer-row-${offer.productCode}`}
                      >
                        <td className="px-3 py-2">
                          <span className="font-medium">{offer.productName}</span>{" "}
                          <span className="text-muted-foreground">({offer.productType}, {offer.loanTerm / 12}y)</span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{offer.adjustedRate.toFixed(3)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{offer.apr.toFixed(3)}%</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyDecimal(offer.payment.principalAndInterest)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyDecimal(offer.payment.totalPiti)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(offer.costs.cashToClose)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {offer.qualification.dti !== null ? `${offer.qualification.dti.toFixed(1)}%` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {result.offers.some((o) => o.qualification.reasons.length > 0) && (
              <div className="space-y-1 text-sm text-muted-foreground" data-testid="scenario-reasons">
                {result.offers
                  .filter((o) => o.qualification.reasons.length > 0)
                  .slice(0, 3)
                  .map((o) => (
                    <p key={`${o.lenderId}:${o.productId}`}>
                      <span className="font-medium text-foreground">{o.productCode}:</span>{" "}
                      {o.qualification.reasons.join("; ")}
                    </p>
                  ))}
              </div>
            )}

            {result.excludedProducts.length > 0 && (
              <p className="text-xs text-muted-foreground" data-testid="scenario-excluded">
                Excluded: {result.excludedProducts.join(" · ")}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
