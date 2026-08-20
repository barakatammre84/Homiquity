import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProgramHeader } from "./ProgramHeader";
import { PHASE_NAMES, type AcceleratorEnrollment, type AcceleratorMilestone } from "./types";
import { ACCELERATOR_PHASES } from "@shared/acceleratorProgram";

// The accelerator's headline number used to be `currentPhase / totalPhases`,
// which told a borrower who had done nothing that they were 17% of the way
// through their program — and never moved, because nothing on the server ever
// advanced `currentPhase`. These pin the two properties that fixes:
//   1. the percentage is the milestones actually ticked off, over a denominator
//      seeded once at enrollment (DESIGN_SYSTEM §13, provenance + agreement);
//   2. the phase name comes from the same definition the server seeds the
//      milestone categories from, so the header and the milestones below it
//      cannot name the same phase differently.

const ENROLLMENT_ID = "enr-1";

const enrollment: AcceleratorEnrollment = {
  id: ENROLLMENT_ID,
  userId: "user-1",
  programType: "first_time_buyer",
  currentPhase: 1,
  totalPhases: 6,
  targetDate: null,
  currentCreditScore: null,
  targetCreditScore: null,
  currentSavings: null,
  targetDownPayment: null,
  currentDti: null,
  targetDti: null,
  monthlyBudget: null,
  status: "active",
  completedAt: null,
  createdAt: "2026-08-01T12:00:00.000Z",
};

/** The 18 milestones a real enrollment is seeded with. */
function seededMilestones(completedThroughPhase = 0): AcceleratorMilestone[] {
  return ACCELERATOR_PHASES.flatMap((p) =>
    p.milestones.map((title, i) => ({
      id: `${p.phase}-${i}`,
      enrollmentId: ENROLLMENT_ID,
      phase: p.phase,
      title,
      description: null,
      category: p.name,
      targetValue: null,
      currentValue: null,
      isCompleted: p.phase <= completedThroughPhase,
      completedAt: null,
      dueDate: null,
    })),
  );
}

function renderHeader(
  milestones: AcceleratorMilestone[] | undefined,
  overrides: Partial<AcceleratorEnrollment> = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  if (milestones) {
    client.setQueryData(["/api/accelerator/milestones", ENROLLMENT_ID], milestones);
  }
  return render(
    <QueryClientProvider client={client}>
      <ProgramHeader enrollment={{ ...enrollment, ...overrides }} />
    </QueryClientProvider>,
  );
}

describe("ProgramHeader progress", () => {
  it("shows 0% — not 17% — to a borrower who has just enrolled", () => {
    renderHeader(seededMilestones(0));
    const label = screen.getByTestId("text-progress-percent").textContent ?? "";
    expect(label).toContain("0 of 18 milestones complete");
    expect(label).toContain("0%");
    expect(screen.getByTestId("progress-bar-fill").style.width).toBe("0%");
  });

  it("moves as milestones are completed", () => {
    renderHeader(seededMilestones(2), { currentPhase: 3 });
    const label = screen.getByTestId("text-progress-percent").textContent ?? "";
    // 6 of 18 = 33%.
    expect(label).toContain("6 of 18 milestones complete");
    expect(label).toContain("33%");
    expect(screen.getByTestId("progress-bar-fill").style.width).toBe("33%");
  });

  it("reaches 100% only when the last milestone is done", () => {
    renderHeader(seededMilestones(6), { currentPhase: 6 });
    expect(screen.getByTestId("text-progress-percent").textContent).toContain("18 of 18");
    expect(screen.getByTestId("progress-bar-fill").style.width).toBe("100%");
  });

  it("states no fraction at all while the milestones are still loading", () => {
    renderHeader(undefined);
    expect(screen.queryByTestId("text-progress-percent")).toBeNull();
    expect(screen.getByTestId("text-progress-loading")).toBeTruthy();
  });

  it("carries the progress on the bar for assistive technology", () => {
    renderHeader(seededMilestones(2), { currentPhase: 3 });
    const bar = screen.getByTestId("progress-bar");
    expect(bar.getAttribute("role")).toBe("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("33");
    expect(bar.getAttribute("aria-label")).toBe("6 of 18 milestones complete");
  });
});

describe("ProgramHeader phase name", () => {
  it("names the phase the way the seeded milestones in it are named", () => {
    renderHeader(seededMilestones(0), { currentPhase: 1 });
    // The milestones the server seeds into phase 1 carry this category.
    expect(ACCELERATOR_PHASES[0].name).toBe(PHASE_NAMES[1]);
    expect(screen.getByText(PHASE_NAMES[1])).toBeTruthy();
    expect(screen.getByTestId("text-phase-info").textContent).toBe("Phase 1 of 6");
  });

  it("follows the enrollment's phase once the server advances it", () => {
    renderHeader(seededMilestones(1), { currentPhase: 2 });
    expect(screen.getByText(PHASE_NAMES[2])).toBeTruthy();
    expect(screen.getByTestId("text-phase-info").textContent).toBe("Phase 2 of 6");
  });
});
