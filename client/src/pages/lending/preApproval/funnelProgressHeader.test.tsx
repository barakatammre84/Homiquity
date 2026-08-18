import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

import { FunnelProgressHeader } from "./FunnelChrome";
import {
  computeRoute,
  routeProgress,
  PRE_APPROVAL_DEFAULTS,
  type FunnelStepId,
} from "@/funnel/preApprovalMachine";
import type { PreApprovalFormData } from "@shared/schema";

// The funnel's orientation chrome. What a borrower must be able to read off the
// top of the page at any moment: which numbered step they are on, how much of
// the whole is behind them AS A PERCENTAGE, which named chapter they are
// inside, and roughly how long is left. Before this component the page showed a
// 1px hairline and a muted "Step 3 of 13" — no percentage anywhere, and a time
// estimate hardcoded to step index that was wrong for any route but the base
// one (a veteran answers 15 steps, a self-employed veteran 16).

function answers(overrides: Partial<PreApprovalFormData> = {}): PreApprovalFormData {
  return { ...PRE_APPROVAL_DEFAULTS, ...overrides };
}

function renderAt(stepId: FunnelStepId, overrides: Partial<PreApprovalFormData> = {}, onBack = vi.fn()) {
  const route = computeRoute(answers(overrides));
  const progress = routeProgress(route, stepId);
  render(
    <FunnelProgressHeader
      progress={progress}
      onBack={onBack}
      canGoBack={progress.index > 0}
      showSaved={progress.index > 0}
    />,
  );
  return { progress, onBack };
}

describe("FunnelProgressHeader", () => {
  it("shows the step number and the percentage complete", () => {
    const { progress } = renderAt("annualIncome");
    expect(screen.getByTestId("text-step-counter").textContent).toContain(
      `Step ${progress.index} of ${progress.total}`,
    );
    expect(screen.getByTestId("text-progress-percent").textContent).toBe(
      `${Math.round(progress.percent)}% complete`,
    );
  });

  it("names all four chapters and marks the one the borrower is in", () => {
    renderAt("purchasePrice");
    const rail = screen.getByTestId("progress-section-rail");
    for (const label of ["Your goal", "The home", "Your finances", "Finish"]) {
      expect(within(rail).getByText(label)).toBeTruthy();
    }
    // Chapter 1 is behind them, so it carries a completion check; the chapter
    // they are inside does not.
    expect(screen.getByTestId("icon-section-done-goal")).toBeTruthy();
    expect(screen.queryByTestId("icon-section-done-property")).toBeNull();
    // The chapter is named once, in the rail; row 3 gives the position inside it.
    expect(screen.getByTestId("text-section-position").textContent).toBe("1 of 3 in this section");
  });

  it("reports position within the current chapter", () => {
    renderAt("propertyState");
    // Chapter 2 on the base route is purchasePrice → downPayment → propertyState.
    expect(screen.getByTestId("text-section-position").textContent).toBe("3 of 3 in this section");
  });

  it("counts the VA residual-income steps into the chapter a veteran is in", () => {
    renderAt("propertyState", { isVeteran: true });
    expect(screen.getByTestId("text-section-position").textContent).toBe("3 of 5 in this section");
  });

  it("derives the time estimate from the steps actually left", () => {
    renderAt("loanPurpose");
    expect(screen.getByTestId("text-time-remaining").textContent).toBe("~3 min left");
  });

  it("says the last step is the last step", () => {
    renderAt("final");
    expect(screen.getByTestId("text-time-remaining").textContent).toBe("Last step");
    expect(screen.getByTestId("text-progress-percent").textContent).toBe("100% complete");
  });

  it("exposes the overall figure to assistive tech", () => {
    const { progress } = renderAt("employmentType");
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe(String(Math.round(progress.percent)));
    expect(bar.getAttribute("aria-valuetext")).toContain(`Step ${progress.index} of ${progress.total}`);
  });

  it("goes back on request", () => {
    const onBack = vi.fn();
    renderAt("loanPurpose", {}, onBack);
    fireEvent.click(screen.getByTestId("button-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("hides the back affordance and the autosave chip on the intro", () => {
    renderAt("intro");
    expect((screen.getByTestId("button-back") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByTestId("text-autosave-indicator")).toBeNull();
  });
});
