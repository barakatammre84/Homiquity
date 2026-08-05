import { Calendar, GraduationCap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { FinancialUpdateDialog } from "./FinancialUpdateDialog";
import { PHASE_NAMES, PROGRAM_TYPES, type AcceleratorEnrollment } from "./types";

export function ProgramHeader({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  const progressPercent = Math.round((enrollment.currentPhase / enrollment.totalPhases) * 100);
  const programLabel = PROGRAM_TYPES.find((p) => p.key === enrollment.programType)?.title || enrollment.programType;

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
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span>{PHASE_NAMES[enrollment.currentPhase] || `Phase ${enrollment.currentPhase}`}</span>
          <span data-testid="text-progress-percent">{progressPercent}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted" data-testid="progress-bar">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progressPercent}%` }}
            data-testid="progress-bar-fill"
          />
        </div>
      </div>
    </div>
  );
}
