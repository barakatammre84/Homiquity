import { cn } from "@/lib/utils";

// The macro journey tier (teardown §9, P2): the whole road at squint distance,
// sitting above a LoanTracker's step detail. `label` is required and doubles
// as the accessible name — every progress tier says what it measures
// (DESIGN-STANDARD §8 bans unlabeled progress displays).

export type MilestoneStatus = "done" | "current" | "future";

export interface Milestone {
  id: string;
  name: string;
  status: MilestoneStatus;
}

export interface MilestoneBarProps {
  /** What this bar measures, e.g. "Your journey to keys". Required. */
  label: string;
  milestones: readonly Milestone[];
  className?: string;
  "data-testid"?: string;
}

export function MilestoneBar({
  label,
  milestones,
  className,
  "data-testid": testId = "milestone-bar",
}: MilestoneBarProps) {
  return (
    <nav aria-label={label} className={className} data-testid={testId}>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ol className="mt-3 flex gap-2">
        {milestones.map((milestone) => (
          <li
            key={milestone.id}
            className="min-w-0 flex-1"
            aria-current={milestone.status === "current" ? "step" : undefined}
            data-testid={`${testId}-${milestone.id}`}
          >
            <span
              className={cn(
                "block h-1.5 rounded-full",
                milestone.status === "future" ? "bg-border" : "bg-primary",
              )}
              aria-hidden="true"
            />
            <span
              className={cn(
                "mt-2 block truncate text-xs",
                milestone.status === "current"
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {milestone.name}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
