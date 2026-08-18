import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/lib/icons";
import type { DataProvenance } from "@shared/dataProvenance";
import {
  ProvenanceBadge,
  type ProvenanceMethod,
} from "@/components/patterns/ProvenanceBadge";

// Application-summary block (knowledge-base/handbook/design/DESIGN_SYSTEM.md §13). `source` and
// `whyWeAsk` are REQUIRED: a financial figure cannot render without declaring
// its origin, and an intrusive request cannot ship unexplained — the standard's
// Provenance and Explanation questions moved from code review to the compiler.

export interface SummarySectionProps {
  title: string;
  /** Where the figures in this section came from. Required by design. */
  source: { provenance: DataProvenance; method?: ProvenanceMethod };
  /** What we use this for and what will be asked next to verify it. Required. */
  whyWeAsk: string;
  /** Optional header action (e.g. an Edit link). */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

export function SummarySection({
  title,
  source,
  whyWeAsk,
  action,
  children,
  className,
  "data-testid": testId = "summary-section",
}: SummarySectionProps) {
  return (
    <Card className={className} data-testid={testId}>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            <ProvenanceBadge
              provenance={source.provenance}
              method={source.method}
              data-testid={`${testId}-provenance`}
            />
          </div>
          {action}
        </div>
        <div className="mt-4">{children}</div>
        <p
          className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground"
          data-testid={`${testId}-why-we-ask`}
        >
          <Icons.info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Why we ask: </span>
            {whyWeAsk}
          </span>
        </p>
      </CardContent>
    </Card>
  );
}

// The underwriting rule printed beside the field it governs (teardown §4.10):
// the rule that could disqualify, stated before it bites.
export function UnderwritingRule({
  rule,
  className,
  "data-testid": testId = "underwriting-rule",
}: {
  rule: string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <p
      role="note"
      className={
        "flex items-start gap-2 text-sm text-muted-foreground " + (className ?? "")
      }
      data-testid={testId}
    >
      <Icons.security className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{rule}</span>
    </p>
  );
}
