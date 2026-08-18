import { useRef } from "react";
import { Progress } from "@/components/ui/progress";

// Progress whose denominator cannot move (docs/DESIGN-STANDARD.md §6, teardown
// §6.2 — Better shipped a counter that ran BACKWARDS when verification added
// tasks mid-flight). The total is snapshotted on first render; a later change
// is kept out of the UI and warned about loudly in dev instead of silently
// re-basing the fraction. `label` is required: every progress display says
// what it measures.

export function useTaskProgress(completed: number, total: number) {
  const frozenTotal = useRef(total);
  if (import.meta.env.DEV && total !== frozenTotal.current) {
    console.warn(
      `[TaskProgress] total changed ${frozenTotal.current} → ${total} after the ` +
        `snapshot; keeping ${frozenTotal.current}. A fraction whose denominator ` +
        `moves is banned (DESIGN-STANDARD §6) — snapshot totals at task start.`,
    );
  }
  const totalNow = frozenTotal.current;
  return {
    completed: Math.max(0, Math.min(completed, totalNow)),
    total: totalNow,
  };
}

export interface TaskProgressProps {
  /** What this progress measures, e.g. "Documents uploaded". Required. */
  label: string;
  completed: number;
  total: number;
  className?: string;
  "data-testid"?: string;
}

export function TaskProgress({
  label,
  completed,
  total,
  className,
  "data-testid": testId = "task-progress",
}: TaskProgressProps) {
  const snapshot = useTaskProgress(completed, total);
  const percent =
    snapshot.total === 0 ? 0 : (snapshot.completed / snapshot.total) * 100;

  return (
    <div className={className} data-testid={testId}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground" data-testid={`${testId}-count`}>
          {snapshot.completed} of {snapshot.total}
        </p>
      </div>
      <Progress
        value={percent}
        className="mt-2"
        aria-label={label}
        data-testid={`${testId}-bar`}
      />
    </div>
  );
}
