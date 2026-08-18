import { Badge } from "@/components/ui/badge";
import { DATA_PROVENANCE, type DataProvenance } from "@shared/dataProvenance";

// Provenance as a first-class UI element (docs/DESIGN-STANDARD.md §6, teardown
// §4.8): every financial figure declares how it was obtained. The type derives
// from shared/dataProvenance.ts — the data layer's enum, not a parallel client
// vocabulary — so a figure's badge and its decision-grade treatment can never
// disagree. `method: "soft_check"` is a display refinement of HOW a figure was
// verified (a soft credit inquiry), not a fourth provenance state.

export type ProvenanceMethod = "soft_check";

interface ProvenanceDisplay {
  label: string;
  variant: "default" | "success" | "info" | "warning";
  /** Hover explanation — held in one place so every surface says the same thing. */
  explanation: string;
}

export const PROVENANCE_DISPLAY: Record<DataProvenance, ProvenanceDisplay> = {
  [DATA_PROVENANCE.SELF_REPORTED]: {
    label: "You told us",
    variant: "success",
    explanation:
      "Entered by you. We'll confirm it against documents before it backs any decision.",
  },
  [DATA_PROVENANCE.VERIFIED]: {
    label: "Verified",
    variant: "default",
    explanation: "Confirmed against your documents or an authoritative source.",
  },
  [DATA_PROVENANCE.SYSTEM_CALCULATED]: {
    label: "Estimated",
    variant: "warning",
    explanation:
      "Calculated by us from other figures, so it is only as firm as they are.",
  },
};

export const SOFT_CHECK_DISPLAY: ProvenanceDisplay = {
  label: "Soft credit check",
  variant: "info",
  explanation:
    "Read from a soft credit inquiry — the kind that never affects your credit score.",
};

export interface ProvenanceBadgeProps {
  provenance: DataProvenance;
  /** Only meaningful with `verified`; refines the label to "Soft credit check". */
  method?: ProvenanceMethod;
  className?: string;
  "data-testid"?: string;
}

export function ProvenanceBadge({
  provenance,
  method,
  className,
  "data-testid": testId = "provenance-badge",
}: ProvenanceBadgeProps) {
  if (
    import.meta.env.DEV &&
    method === "soft_check" &&
    provenance !== DATA_PROVENANCE.VERIFIED
  ) {
    console.warn(
      `[ProvenanceBadge] method="soft_check" describes how a figure was VERIFIED; ` +
        `it is ignored on "${provenance}" data.`,
    );
  }

  const display =
    method === "soft_check" && provenance === DATA_PROVENANCE.VERIFIED
      ? SOFT_CHECK_DISPLAY
      : PROVENANCE_DISPLAY[provenance];

  return (
    <Badge
      variant={display.variant}
      className={className}
      title={display.explanation}
      data-testid={testId}
    >
      {display.label}
    </Badge>
  );
}
