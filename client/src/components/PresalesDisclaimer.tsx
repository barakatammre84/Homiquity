import { Info } from "lucide-react";
import { PRESALES_DISCLAIMER } from "@shared/dataProvenance";

/**
 * Standardized non-binding disclaimer for pre-sales / self-reported estimate
 * flows (calculators, "what could I afford"). Uses the same wording as the
 * server-side AI gateway so the message is identical everywhere. Show this
 * wherever the app presents estimates built on figures the user entered.
 */
export function PresalesDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      data-testid="presales-disclaimer"
      className={`flex items-start gap-2 rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground ${className}`}
    >
      <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
      <p>{PRESALES_DISCLAIMER}</p>
    </div>
  );
}
