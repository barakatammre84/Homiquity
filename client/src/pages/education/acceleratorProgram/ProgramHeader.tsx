import { useQuery } from "@tanstack/react-query";
import { Calendar, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { deriveAcceleratorProgress } from "@shared/acceleratorProgram";
import { FinancialUpdateDialog } from "./FinancialUpdateDialog";
import {
  PHASE_NAMES,
  PROGRAM_TYPES,
  type AcceleratorEnrollment,
  type AcceleratorMilestone,
} from "./types";

export function ProgramHeader({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  // Same query key as MilestonesSection, so this shares that cache entry rather
  // than issuing a second request — and both re-read together when a milestone
  // is toggled.
  const { data: milestones, isSuccess } = useQuery<AcceleratorMilestone[]>({
    queryKey: ["/api/accelerator/milestones", enrollment.id],
  });

  // The bar used to be `currentPhase / totalPhases`, which showed 17% to a
  // borrower who had done nothing at all and 100% while phase 6 was still open.
  // Progress is the work actually ticked off, over a denominator seeded once at
  // enrollment and never added to (DESIGN_SYSTEM §13: provenance, agreement).
  const progress = isSuccess
    ? deriveAcceleratorProgress(milestones ?? [], enrollment.totalPhases)
    : null;
  const progressPercent =
    progress && progress.totalCount > 0
      ? Math.round((progress.completedCount / progress.totalCount) * 100)
      : null;

  const programLabel = PROGRAM_TYPES.find((p) => p.key === enrollment.programType)?.title || enrollment.programType;
  const phaseName = PHASE_NAMES[enrollment.currentPhase] || `Phase ${enrollment.currentPhase}`;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="p-2 bg-primary/10 rounded-lg">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-foreground md:text-2xl" data-testid="text-dashboard-title">
              Accelerator Program
            </h1>
            <Badge variant="secondary" data-testid="badge-program-type">{programLabel}</Badge>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span data-testid="text-phase-info">Phase {enrollment.currentPhase} of {enrollment.totalPhases}</span>
            {enrollment.targetDate && (
              <span className="flex items-center gap-1" data-testid="text-target-date">
                <Calendar className="h-3 w-3" />
                Target: {format(new Date(enrollment.targetDate), "MMM d, yyyy")}
              </span>
            )}
          </div>
        </div>
        <FinancialUpdateDialog enrollment={enrollment} />
      </div>

      <div className="mt-3" data-testid="progress-bar-container">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1 flex-wrap">
          <span>{phaseName}</span>
          {/* Until the milestones have loaded there is no fraction to state, so
              none is stated — a "0%" here would be a claim about the borrower's
              progress made out of missing data. */}
          {progress && progressPercent !== null ? (
            <span data-testid="text-progress-percent">
              {progress.completedCount} of {progress.totalCount} milestones complete ({progressPercent}%)
            </span>
          ) : (
            <span data-testid="text-progress-loading">Loading your progress…</span>
          )}
        </div>
        <div
          className="h-2 w-full rounded-full bg-muted"
          data-testid="progress-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent ?? undefined}
          aria-label={
            progress && progressPercent !== null
              ? `${progress.completedCount} of ${progress.totalCount} milestones complete`
              : "Program progress, still loading"
          }
        >
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progressPercent ?? 0}%` }}
            data-testid="progress-bar-fill"
          />
        </div>
      </div>
    </div>
  );
}
