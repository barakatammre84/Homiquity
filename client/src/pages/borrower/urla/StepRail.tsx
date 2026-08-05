import { Check } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STEPS, type StepContext } from "./steps";

/**
 * The step rail. Check marks are advisory progress only — every step stays
 * reachable regardless of completeness (URLA is save-as-you-go and must never
 * trap a borrower behind a section they can't finish yet).
 */
export function StepRail({ stepContext }: { stepContext: StepContext }) {
  return (
    <TabsList className="flex h-auto w-full items-stretch justify-start gap-1 overflow-x-auto bg-transparent p-0 lg:flex-col lg:overflow-visible">
      {STEPS.map((step, index) => {
        const complete = step.isComplete(stepContext);
        return (
          <TabsTrigger
            key={step.id}
            value={step.id}
            data-testid={`tab-${step.id}`}
            className="h-auto shrink-0 justify-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left text-muted-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none"
          >
            {complete ? (
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success-subtle-foreground">
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">Section complete:</span>
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium"
              >
                {index + 1}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{step.label}</span>
              <span className="hidden text-[11px] font-normal text-muted-foreground lg:block">
                {step.estimate}
              </span>
            </span>
          </TabsTrigger>
        );
      })}
    </TabsList>
  );
}
