import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// -----------------------------------------------------------------------------
// MISMO XSD conformance, as RECORDED on the submission's immutable readiness
// snapshot (`readinessSnapshot.xsdConformance`, written by
// server/services/lenderSubmission.ts at submit time).
//
// That service's comment claimed the result was "captured (auditable, shown to
// staff), not silently swallowed" — but nothing in the client had ever read the
// field, so a package could be recorded as schema-non-conformant and no human
// was ever told. This is the "shown to staff" half, and it displays the RECORDED
// snapshot value: no re-validation, no new endpoint, because the snapshot is the
// auditable artifact.
//
// Deliberately NON-BLOCKING. The hard gate is the structural `validateMISMOXML`
// check, which already refused the submission if it failed; this is the stricter
// schema diagnostic whose remaining element gaps are tracked (CTO_ROADMAP
// L6/F-025). Staff need to SEE it, not be stopped by it.
//
// The three states are kept honest and distinct — in particular `skipped` must
// never read as a pass. When xmllint is unavailable the recorded `valid` is
// `false` and meaningless, so `skipped` is checked FIRST.
// -----------------------------------------------------------------------------

export interface XsdConformance {
  valid: boolean;
  skipped: boolean;
  offendingElements?: string[];
}

export function PackageConformanceBadge({
  submissionId,
  conformance,
}: {
  submissionId: string;
  conformance?: XsdConformance | null;
}) {
  const [expanded, setExpanded] = useState(false);

  // Submissions recorded before the snapshot carried the field have nothing to
  // report. Inventing a state for them would be a claim we cannot support.
  if (!conformance) return null;

  if (conformance.skipped) {
    return (
      <div className="flex items-center gap-2" data-testid={`xsd-skipped-${submissionId}`}>
        <Badge variant="secondary">Schema check not run</Badge>
        <span className="text-xs text-muted-foreground">
          The MISMO 3.4 schema validator was unavailable — this package was never checked.
          Not a pass.
        </span>
      </div>
    );
  }

  if (conformance.valid) {
    return (
      <div className="flex items-center gap-2" data-testid={`xsd-conformant-${submissionId}`}>
        <Badge variant="success">Schema conformant</Badge>
        <span className="text-xs text-muted-foreground">
          Validated against the MISMO 3.4 schema at submission.
        </span>
      </div>
    );
  }

  const elements = conformance.offendingElements ?? [];
  return (
    <div className="space-y-1" data-testid={`xsd-non-conformant-${submissionId}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">Schema non-conformant</Badge>
        <span className="text-xs text-muted-foreground">
          Recorded, tracked gap (L6/F-025) — it did not block this submission, and delivery
          is simulated today.
        </span>
        {elements.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
            data-testid={`xsd-elements-toggle-${submissionId}`}
          >
            {expanded ? "Hide" : `Show ${elements.length} element(s)`}
          </Button>
        )}
      </div>
      {expanded && elements.length > 0 && (
        <ul
          className="pl-4 text-xs text-muted-foreground"
          data-testid={`xsd-elements-${submissionId}`}
        >
          {elements.map(el => (
            <li key={el} className="list-disc font-mono">
              {el}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
