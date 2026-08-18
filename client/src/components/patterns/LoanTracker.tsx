import { Badge } from "@/components/ui/badge";
import { Icons } from "@/lib/icons";
import { cn } from "@/lib/utils";

// Whole road visible, one step lit (knowledge-base/handbook/design/DESIGN_SYSTEM.md §13; teardown §4.1).
// Future steps stay VISIBLE, greyed, each with a plain-English description that
// names the actor ("We review…", "Your loan is prepared…") — answering the
// question borrowers actually have: is something wrong, or is this just how
// long it takes? Reuse the homepage "How it works" labels so the marketing
// promise and the in-app reality are literally the same words.

export type TrackerStepStatus = "done" | "current" | "future" | "blocked";

export interface TrackerStep {
  id: string;
  title: string;
  /** Plain-English description that names the actor. */
  description: string;
  status: TrackerStepStatus;
  /** Plain formatted date for done steps, e.g. "Aug 12, 2026". */
  completedOn?: string;
  /** Inline actions for the current step. */
  actions?: React.ReactNode;
}

export interface LoanTrackerProps {
  /** What this tracker measures, e.g. "Your loan, start to close". Required. */
  label: string;
  steps: readonly TrackerStep[];
  className?: string;
  "data-testid"?: string;
}

export function LoanTracker({
  label,
  steps,
  className,
  "data-testid": testId = "loan-tracker",
}: LoanTrackerProps) {
  return (
    <nav aria-label={label} className={className} data-testid={testId}>
      <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ol className="mt-4">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          return (
            <li
              key={step.id}
              className="relative flex gap-4 pb-8 last:pb-0"
              aria-current={step.status === "current" ? "step" : undefined}
              data-testid={`${testId}-step-${step.id}`}
            >
              {!isLast && (
                <span
                  className="absolute left-4 top-9 -ml-px h-[calc(100%-2.25rem)] w-px bg-border"
                  aria-hidden="true"
                />
              )}

              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
                {step.status === "done" ? (
                  <Icons.done className="h-6 w-6 text-primary" aria-hidden="true" />
                ) : step.status === "blocked" ? (
                  <Icons.time className="h-6 w-6 text-warning-subtle-foreground" aria-hidden="true" />
                ) : (
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-sm",
                      step.status === "current"
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "border border-border text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                )}
              </span>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={cn(
                      "text-base",
                      step.status === "current" && "font-semibold text-foreground",
                      step.status === "done" && "text-muted-foreground line-through",
                      (step.status === "future" || step.status === "blocked") &&
                        "text-muted-foreground",
                    )}
                  >
                    {step.title}
                  </p>
                  {step.status === "done" && (
                    <Badge variant="success" data-testid={`${testId}-${step.id}-done`}>
                      Done{step.completedOn ? ` · ${step.completedOn}` : ""}
                    </Badge>
                  )}
                  {step.status === "current" && (
                    <Badge data-testid={`${testId}-${step.id}-required`}>Required</Badge>
                  )}
                  {step.status === "blocked" && (
                    <Badge variant="warning" data-testid={`${testId}-${step.id}-waiting`}>
                      Waiting
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                {step.status === "current" && step.actions && (
                  <div className="mt-3">{step.actions}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
