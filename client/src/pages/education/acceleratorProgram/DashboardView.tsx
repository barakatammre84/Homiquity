import { ProgramHeader } from "./ProgramHeader";
import { FinancialSnapshot } from "./FinancialSnapshot";
import { MilestonesSection } from "./MilestonesSection";
import { CoachingSessionsSection } from "./CoachingSessionsSection";
import type { AcceleratorEnrollment } from "./types";

/** The enrolled view: header + progress, financial snapshot, milestones, sessions. */
export function DashboardView({ enrollment }: { enrollment: AcceleratorEnrollment }) {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto" data-testid="accelerator-dashboard">
      <ProgramHeader enrollment={enrollment} />
      <FinancialSnapshot enrollment={enrollment} />
      <MilestonesSection enrollmentId={enrollment.id} />
      <CoachingSessionsSection enrollmentId={enrollment.id} />
    </div>
  );
}
