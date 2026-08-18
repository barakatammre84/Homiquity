import { type LucideIcon } from "lucide-react";
import { EmptyState as BaseEmptyState } from "@/components/ui/empty-state";

// Scoped empty state (knowledge-base/handbook/design/DESIGN_SYSTEM.md §13): `scope` is required and the
// heading is DERIVED from it, so a component that knows one flow can never
// claim "you're all caught up" about the whole account — the two-sources-of-
// truth defect (teardown §6.1) becomes structurally impossible. Renders through
// the app's shared ui/empty-state so zero-states keep one look.

export interface ScopedEmptyStateProps {
  /**
   * The noun phrase this component actually knows about, e.g.
   * "documents for this loan" → heading "No documents for this loan yet".
   */
  scope: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  bordered?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function EmptyState({
  scope,
  description,
  action,
  icon,
  illustration,
  bordered,
  className,
  "data-testid": testId = "empty-state",
}: ScopedEmptyStateProps) {
  return (
    <BaseEmptyState
      title={`No ${scope} yet`}
      description={description}
      action={action}
      icon={icon}
      illustration={illustration}
      bordered={bordered}
      className={className}
      data-testid={testId}
    />
  );
}
