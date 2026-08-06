import { useCallback, useEffect, useState } from "react";
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
import { AddressPrefill } from "./scenarioSimulator/AddressPrefill";
import { ScenarioInputs } from "./scenarioSimulator/ScenarioInputs";
import { ScenarioGapCard, ScenarioResults } from "./scenarioSimulator/ScenarioResults";
import {
  buildScenarioPayload,
  prefillFromProperty,
  scenarioValidity,
} from "./scenarioSimulator/scenarioPayload";
import type {
  AddressSuggestion,
  PropertyDetail,
  ScenarioFormState,
  ScenarioResponse,
} from "./scenarioSimulator/types";

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
//
// This file is orchestration only: state, the two queries, the mutation. The
// request body, the prefill rules and the validity check are pure functions in
// ./scenarioSimulator/scenarioPayload.ts, where they are tested — what gets
// POSTed from here is also what is written to the file's audit trail, so it is
// worth being able to assert on it without mounting a dialog.
// -----------------------------------------------------------------------------

const INITIAL_FORM: ScenarioFormState = {
  purchasePrice: "",
  downPaymentValue: "20",
  downPaymentUnit: "percent",
  productFilter: "ALL",
  occupancyType: "primary_residence",
  propertyType: "single_family",
  numberOfUnits: "2",
  ficoWhatIf: "",
  lockTermDays: "30",
  annualTaxes: "",
  propertyValue: "",
  addressContext: null,
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

  const [form, setForm] = useState<ScenarioFormState>(INITIAL_FORM);
  const [result, setResult] = useState<ScenarioResponse | null>(null);

  const updateForm = useCallback(
    <K extends keyof ScenarioFormState>(key: K, value: ScenarioFormState[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

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

  // Prefill once per loaded property detail (licensed data, never scraped).
  // prefillFromProperty omits anything it has no value for, so a property with
  // no listed price or no tax history leaves the LO's own entry alone rather
  // than overwriting it with a zero.
  useEffect(() => {
    if (!propertyDetail) return;
    setForm((prev) => ({ ...prev, ...prefillFromProperty(propertyDetail) }));
  }, [propertyDetail]);

  const simulate = useMutation({
    mutationFn: async (): Promise<ScenarioResponse> => {
      const res = await apiRequest("POST", "/api/scenarios/simulate", {
        applicationId,
        scenario: buildScenarioPayload(form),
      });
      return res.json();
    },
    onSuccess: (data) => setResult(data),
    onError: (error: Error) => {
      toast({ title: "Scenario failed", description: error.message, variant: "destructive" });
    },
  });

  const { valid } = scenarioValidity(form);

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

        <AddressPrefill
          addressInput={addressInput}
          onAddressInputChange={(value) => {
            setAddressInput(value);
            setSelectedPropertyId(null);
          }}
          suggestions={suggestions}
          showSuggestions={!selectedPropertyId}
          onSelectSuggestion={(s) => {
            setSelectedPropertyId(s.id.replace(/^addr:/, ""));
            setAddressInput(s.label);
          }}
          detailLoading={detailLoading}
          addressContext={form.addressContext}
        />

        <ScenarioInputs form={form} onChange={updateForm} />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Runs are recorded to the file's audit trail. Simulated rate data until the PPE
            contract — never quote as lockable terms.
          </p>
          <Button
            onClick={() => simulate.mutate()}
            disabled={simulate.isPending || !valid}
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

        {result && <ScenarioGapCard result={result} />}
        {result && <ScenarioResults result={result} />}
      </DialogContent>
    </Dialog>
  );
}
