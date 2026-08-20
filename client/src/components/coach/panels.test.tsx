import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { ReadinessPanel } from "./panels";
import type { CoachProfile } from "./types";

/**
 * The readiness panel against a PARTIAL profile — the shape that actually sits
 * in the database.
 *
 * `coach_conversations.financial_profile` was being written from two places: a
 * complete `set_readiness` tool result, and a fallback that spread only the
 * server-derived percentage over `existingProfile`. On a conversation's first
 * turn that fallback's `existingProfile` is `{}`, so the column ended up holding
 * literally `{"completionPercentage": 88}` — verified against the dev database,
 * which has three such rows.
 *
 * `CoachProfile` declared all six fields required, so this panel read
 * `profile.completedInputs.length` off `undefined` and threw, and because it
 * renders inside AppErrorBoundary the whole /ai-coach page went to "Something
 * went wrong". The server no longer writes that shape, but rows in it already
 * exist and cannot be un-written, so the panel has to survive it.
 */

describe("ReadinessPanel", () => {
  it("renders a profile that carries nothing but a completion percentage", () => {
    // Exactly the row shape found in the database — cast because the point of
    // the test is a payload no honest caller would construct.
    const partial = { completionPercentage: 88 } as CoachProfile;

    render(<ReadinessPanel profile={partial} />);

    expect(screen.getByTestId("card-readiness-panel")).toBeTruthy();
    expect(screen.getByTestId("badge-readiness-score").textContent).toContain("88%");
    // No tier was ever recorded, so it falls back rather than blowing up.
    expect(screen.getByTestId("text-readiness-tier").textContent).toBeTruthy();
    // The two input lists simply do not render.
    expect(screen.queryByText("COMPLETED INPUTS")).toBeNull();
    expect(screen.queryByText("OUTSTANDING INPUTS")).toBeNull();
  });

  it("still renders both input lists when the profile is complete", () => {
    const full: CoachProfile = {
      readinessTier: "building",
      completionPercentage: 60,
      statusNote: "Keep going.",
      completedInputs: ["Income", "Credit score"],
      outstandingInputs: ["Down payment"],
      estimatedTimeline: "3-6 months",
    };

    render(<ReadinessPanel profile={full} />);

    expect(screen.getByText("COMPLETED INPUTS")).toBeTruthy();
    expect(screen.getByText("OUTSTANDING INPUTS")).toBeTruthy();
    expect(screen.getByText("Income")).toBeTruthy();
    expect(screen.getByText("Down payment")).toBeTruthy();
    expect(screen.getByTestId("text-readiness-summary").textContent).toBe("Keep going.");
  });
});
