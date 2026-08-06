import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, MapPin } from "lucide-react";
import type { AddressSuggestion } from "./types";

interface AddressPrefillProps {
  addressInput: string;
  onAddressInputChange: (value: string) => void;
  suggestions: AddressSuggestion[] | undefined;
  showSuggestions: boolean;
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  detailLoading: boolean;
  addressContext: Record<string, string> | null;
}

/**
 * Address-first intake. The prefill comes from the licensed realty adapter —
 * never scraped — and the note below the field says so, because everything it
 * fills in is editable and the LO needs to know which numbers they did not type.
 */
export function AddressPrefill({
  addressInput,
  onAddressInputChange,
  suggestions,
  showSuggestions,
  onSelectSuggestion,
  detailLoading,
  addressContext,
}: AddressPrefillProps) {
  const addressSuggestions = (suggestions ?? []).filter((s) => s.type === "address").slice(0, 5);

  return (
    <div className="space-y-2">
      <Label htmlFor="scenario-address">Subject property address (optional prefill)</Label>
      <div className="relative">
        <MapPin
          className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="scenario-address"
          className="pl-8"
          placeholder="Start typing an address…"
          value={addressInput}
          autoComplete="off"
          onChange={(e) => onAddressInputChange(e.target.value)}
          data-testid="scenario-address-input"
        />
      </div>

      {showSuggestions && addressSuggestions.length > 0 && (
        <ul
          className="divide-y divide-border rounded-md border border-border"
          data-testid="scenario-address-suggestions"
        >
          {addressSuggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => onSelectSuggestion(s)}
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
  );
}
