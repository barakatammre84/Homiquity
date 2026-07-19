import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/us-states";
import { isLicensedState, unlicensedStateMessage } from "@shared/companyIdentity";
import { Check, ChevronsUpDown } from "lucide-react";

/**
 * Property-state step (extracted from PreApproval.tsx). Carries the
 * licensed-state gate (roadmap A5), mirroring the server's 422: selecting a
 * state outside LICENSED_STATES shows the notice and does NOT advance the
 * funnel; a licensed state advances after the selection settles.
 */
export function StateStep({
  value,
  onSelectState,
  onAdvance,
}: {
  value: string;
  onSelectState: (stateValue: string) => void;
  onAdvance: () => void;
}) {
  const [stateComboOpen, setStateComboOpen] = useState(false);
  const selectedStateOption = US_STATES.find((s) => s.value === value);
  return (
    <div className="w-full max-w-lg mx-auto">
      <Popover open={stateComboOpen} onOpenChange={setStateComboOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={stateComboOpen}
            size="lg"
            data-testid="button-state-combobox"
            className="w-full justify-between font-medium"
          >
            {selectedStateOption
              ? `${selectedStateOption.label} (${selectedStateOption.value})`
              : "Search for a state..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Type a state name or abbreviation..." data-testid="input-state-search" />
            <CommandList>
              <CommandEmpty>No state found.</CommandEmpty>
              <CommandGroup>
                {US_STATES.map((state) => (
                  <CommandItem
                    key={state.value}
                    value={`${state.label} ${state.value}`}
                    data-testid={`option-state-${state.value}`}
                    onSelect={() => {
                      onSelectState(state.value);
                      setStateComboOpen(false);
                      // Licensed-state gate (roadmap A5), mirroring the
                      // server's 422: don't advance into a funnel we
                      // can't finish — the notice below explains why.
                      if (isLicensedState(state.value)) {
                        setTimeout(() => onAdvance(), 200);
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === state.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{state.label}</span>
                    <span className="ml-auto text-muted-foreground">{state.value}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !isLicensedState(value) && (
        <div
          className="mt-4 rounded-md border p-4 text-left text-sm text-muted-foreground"
          role="alert"
          data-testid="notice-unlicensed-state"
        >
          <p className="font-medium text-foreground">
            We can't take applications in {selectedStateOption?.label ?? value} yet
          </p>
          <p className="mt-1 leading-relaxed">{unlicensedStateMessage(value)}</p>
          <p className="mt-2 leading-relaxed">
            Pick a different state to continue, or see{" "}
            <a href="/disclosures" className="font-medium text-primary underline underline-offset-2">
              where we're licensed
            </a>
            .
          </p>
        </div>
      )}
    </div>
  );
}
