/**
 * The Homebuyer Accelerator program — its six phases, and the derivation that
 * turns milestone state into program progress.
 *
 * Two things lived apart before this module and disagreed about the same fact:
 * the server seeded milestone categories from an inline list ("Financial
 * Assessment", "Credit Optimization", …) while the client rendered a different
 * hand-written map of six phase names ("Foundation", "Financial Fitness", …).
 * A borrower reading the header saw one name for the phase and a different one
 * on every milestone inside it (DESIGN_SYSTEM §13, Agreement). One definition
 * now feeds both.
 *
 * Progress is *derived*, never incremented. Un-ticking a milestone has to walk
 * the program back exactly as ticking it walked it forward, and a derivation is
 * the only shape that is correct in both directions.
 */

/** One phase of the program, with the milestones seeded at enrollment. */
export interface AcceleratorPhase {
  /** 1-based; matches `accelerator_milestones.phase`. */
  readonly phase: number;
  /** The phase's one name — the header label and the seeded milestone category. */
  readonly name: string;
  readonly milestones: readonly string[];
}

export const ACCELERATOR_PHASES: readonly AcceleratorPhase[] = [
  {
    phase: 1,
    name: "Financial Assessment",
    milestones: ["Review credit report", "Calculate current DTI", "Set budget"],
  },
  {
    phase: 2,
    name: "Credit Optimization",
    milestones: [
      "Dispute errors on credit report",
      "Pay down high-utilization cards",
      "Avoid new credit inquiries",
    ],
  },
  {
    phase: 3,
    name: "Savings Plan",
    milestones: [
      "Open dedicated savings account",
      "Set up automatic transfers",
      "Reach 25% of down payment goal",
    ],
  },
  {
    phase: 4,
    name: "Debt Reduction",
    milestones: ["Create debt payoff plan", "Reduce DTI below 43%", "Close unnecessary accounts"],
  },
  {
    phase: 5,
    name: "Pre-Approval Ready",
    milestones: [
      "Gather income documents",
      "Complete pre-approval application",
      "Get pre-approved",
    ],
  },
  {
    phase: 6,
    name: "Home Shopping",
    milestones: ["Connect with real estate agent", "Attend open houses", "Make an offer"],
  },
];

/** The program's phase count — the default denominator of `totalPhases`. */
export const ACCELERATOR_TOTAL_PHASES = ACCELERATOR_PHASES.length;

/** Phase number → its one name. Rendered by the client, seeded by the server. */
export const ACCELERATOR_PHASE_NAMES: Record<number, string> = Object.fromEntries(
  ACCELERATOR_PHASES.map((p) => [p.phase, p.name]),
);

/** The only fields of a milestone that progress depends on. */
export interface MilestoneProgressInput {
  phase: number;
  isCompleted: boolean | null;
}

export interface AcceleratorProgress {
  /** The lowest phase that still has unfinished work; the last phase once finished. */
  currentPhase: number;
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
}

function clampPhase(phase: number, totalPhases: number): number {
  if (!Number.isFinite(phase)) return 1;
  return Math.min(Math.max(Math.trunc(phase), 1), totalPhases);
}

/**
 * Derive where the borrower actually stands from their milestone set.
 *
 * A program with no milestones is *not* complete — an empty plan is a seeding
 * failure, and reporting it as a finished program would be the flattering
 * reading of missing data.
 */
export function deriveAcceleratorProgress(
  milestones: readonly MilestoneProgressInput[],
  totalPhases: number = ACCELERATOR_TOTAL_PHASES,
): AcceleratorProgress {
  const phases =
    Number.isFinite(totalPhases) && totalPhases >= 1
      ? Math.trunc(totalPhases)
      : ACCELERATOR_TOTAL_PHASES;

  const totalCount = milestones.length;
  const completedCount = milestones.filter((m) => m.isCompleted === true).length;

  if (totalCount === 0) {
    return { currentPhase: 1, completedCount: 0, totalCount: 0, isComplete: false };
  }

  const unfinished = milestones.filter((m) => m.isCompleted !== true);

  if (unfinished.length === 0) {
    const lastPhase = milestones.reduce((max, m) => Math.max(max, m.phase), 1);
    return {
      currentPhase: clampPhase(lastPhase, phases),
      completedCount,
      totalCount,
      isComplete: true,
    };
  }

  const nextPhase = unfinished.reduce((min, m) => Math.min(min, m.phase), Number.POSITIVE_INFINITY);
  return {
    currentPhase: clampPhase(nextPhase, phases),
    completedCount,
    totalCount,
    isComplete: false,
  };
}

/** The enrollment fields progress owns. */
export interface EnrollmentProgressState {
  currentPhase: number | null;
  status: string;
  completedAt: Date | string | null;
}

export interface EnrollmentProgressPatch {
  currentPhase?: number;
  status?: string;
  completedAt?: Date | null;
}

/**
 * The write the enrollment needs so it agrees with the milestones — or `null`
 * when it already does, so a toggle that changes nothing writes nothing.
 *
 * Only `active` ⇄ `completed` are touched. A program a human paused or withdrew
 * is not silently reactivated by a checkbox.
 */
export function enrollmentProgressPatch(
  progress: AcceleratorProgress,
  current: EnrollmentProgressState,
  now: Date,
): EnrollmentProgressPatch | null {
  const patch: EnrollmentProgressPatch = {};

  if (current.currentPhase !== progress.currentPhase) {
    patch.currentPhase = progress.currentPhase;
  }

  if (progress.isComplete && current.status !== "completed") {
    patch.status = "completed";
    patch.completedAt = now;
  } else if (!progress.isComplete && current.status === "completed") {
    patch.status = "active";
    patch.completedAt = null;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}
