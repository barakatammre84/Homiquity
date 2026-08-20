import { describe, it, expect } from "vitest";
import {
  ACCELERATOR_PHASES,
  ACCELERATOR_PHASE_NAMES,
  ACCELERATOR_TOTAL_PHASES,
  deriveAcceleratorProgress,
  enrollmentProgressPatch,
  type MilestoneProgressInput,
} from "@shared/acceleratorProgram";

/** The plan a new enrollment is seeded with, as milestone rows. */
function seededPlan(): MilestoneProgressInput[] {
  return ACCELERATOR_PHASES.flatMap((p) =>
    p.milestones.map(() => ({ phase: p.phase, isCompleted: false })),
  );
}

function completeThrough(plan: MilestoneProgressInput[], phase: number): MilestoneProgressInput[] {
  return plan.map((m) => (m.phase <= phase ? { ...m, isCompleted: true } : m));
}

describe("deriveAcceleratorProgress", () => {
  it("a freshly seeded plan sits in phase 1 with nothing done", () => {
    const progress = deriveAcceleratorProgress(seededPlan(), ACCELERATOR_TOTAL_PHASES);
    expect(progress).toEqual({
      currentPhase: 1,
      completedCount: 0,
      totalCount: 18,
      isComplete: false,
    });
  });

  it("advances to phase 2 only once every phase-1 milestone is done", () => {
    const plan = seededPlan();
    // Two of phase 1's three milestones.
    const partial = plan.map((m, i) => (m.phase === 1 && i < 2 ? { ...m, isCompleted: true } : m));
    expect(deriveAcceleratorProgress(partial).currentPhase).toBe(1);

    const finished = completeThrough(plan, 1);
    expect(deriveAcceleratorProgress(finished).currentPhase).toBe(2);
  });

  it("walks the whole program forward, phase by phase", () => {
    const plan = seededPlan();
    for (let phase = 1; phase < ACCELERATOR_TOTAL_PHASES; phase++) {
      expect(deriveAcceleratorProgress(completeThrough(plan, phase)).currentPhase).toBe(phase + 1);
    }
  });

  it("marks the program complete when the last milestone is ticked", () => {
    const progress = deriveAcceleratorProgress(completeThrough(seededPlan(), 6));
    expect(progress.isComplete).toBe(true);
    expect(progress.currentPhase).toBe(6);
    expect(progress.completedCount).toBe(18);
  });

  it("walks back when a milestone is un-ticked — progress is derived, not incremented", () => {
    const done = completeThrough(seededPlan(), 6);
    expect(deriveAcceleratorProgress(done).currentPhase).toBe(6);

    // Reopen one phase-2 milestone. The program returns to phase 2, not to 6.
    const reopenedIndex = done.findIndex((m) => m.phase === 2);
    const reopened = done.map((m, i) => (i === reopenedIndex ? { ...m, isCompleted: false } : m));
    const progress = deriveAcceleratorProgress(reopened);
    expect(progress.currentPhase).toBe(2);
    expect(progress.isComplete).toBe(false);
    expect(progress.completedCount).toBe(17);
  });

  it("treats an empty plan as unfinished, never as a completed program", () => {
    expect(deriveAcceleratorProgress([])).toEqual({
      currentPhase: 1,
      completedCount: 0,
      totalCount: 0,
      isComplete: false,
    });
  });

  it("treats a null isCompleted as not done", () => {
    const progress = deriveAcceleratorProgress([
      { phase: 1, isCompleted: null },
      { phase: 1, isCompleted: true },
    ]);
    expect(progress.completedCount).toBe(1);
    expect(progress.currentPhase).toBe(1);
    expect(progress.isComplete).toBe(false);
  });

  it("clamps a phase beyond the enrollment's totalPhases", () => {
    const progress = deriveAcceleratorProgress([{ phase: 99, isCompleted: false }], 6);
    expect(progress.currentPhase).toBe(6);
  });
});

describe("enrollmentProgressPatch", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("returns null when the enrollment already agrees with the milestones", () => {
    const progress = deriveAcceleratorProgress(seededPlan());
    expect(
      enrollmentProgressPatch(progress, { currentPhase: 1, status: "active", completedAt: null }, now),
    ).toBeNull();
  });

  it("moves the phase when the milestones moved", () => {
    const progress = deriveAcceleratorProgress(completeThrough(seededPlan(), 1));
    expect(
      enrollmentProgressPatch(progress, { currentPhase: 1, status: "active", completedAt: null }, now),
    ).toEqual({ currentPhase: 2 });
  });

  it("completes the enrollment when every milestone is done", () => {
    const progress = deriveAcceleratorProgress(completeThrough(seededPlan(), 6));
    expect(
      enrollmentProgressPatch(progress, { currentPhase: 6, status: "active", completedAt: null }, now),
    ).toEqual({ status: "completed", completedAt: now });
  });

  it("reopens a completed enrollment when a milestone is un-ticked", () => {
    const progress = deriveAcceleratorProgress(completeThrough(seededPlan(), 5));
    expect(
      enrollmentProgressPatch(
        progress,
        { currentPhase: 6, status: "completed", completedAt: now },
        now,
      ),
    ).toEqual({ status: "active", completedAt: null });
  });

  it("never reactivates a program a human paused or withdrew", () => {
    const progress = deriveAcceleratorProgress(seededPlan());
    expect(
      enrollmentProgressPatch(progress, { currentPhase: 1, status: "paused", completedAt: null }, now),
    ).toBeNull();
  });
});

describe("the phase vocabulary", () => {
  it("names every phase exactly once, and the milestone categories match", () => {
    expect(Object.keys(ACCELERATOR_PHASE_NAMES)).toHaveLength(ACCELERATOR_TOTAL_PHASES);
    for (const phase of ACCELERATOR_PHASES) {
      expect(ACCELERATOR_PHASE_NAMES[phase.phase]).toBe(phase.name);
      expect(phase.milestones.length).toBeGreaterThan(0);
    }
  });
});
