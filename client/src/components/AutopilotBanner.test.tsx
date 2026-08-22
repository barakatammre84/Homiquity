import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AutopilotBanner } from "./AutopilotBanner";
import type { AutopilotStatus } from "@shared/autopilotStatus";

/**
 * The banner's tone used to be an if/else chain whose ELSE branch was the green
 * check plus "Looks good! No issues found." Everything that was not
 * `items_needed` or `reviewing` landed there — including the two states that
 * know nothing about the file. These tests pin that only `clean` gets the
 * success treatment.
 */

const status = (partial: Partial<AutopilotStatus>): AutopilotStatus => ({
  applicationId: "app-1",
  phase: "clean",
  message: "Looks good! No issues found.",
  outstandingConditions: 0,
  readyToSubmitToLender: false,
  readiness: { completed: 0, total: 0 },
  updatedAt: "2026-08-20T00:00:00.000Z",
  ...partial,
});

// No jest-dom in the client lane (vitest.client.config.ts sets no setupFiles) —
// house convention, see Lenders.test.tsx. Plain DOM assertions only.
const banner = () => screen.getByTestId("autopilot-banner");

describe("AutopilotBanner — only an earned all-clear looks like one", () => {
  it("renders the success tone for clean", () => {
    render(<AutopilotBanner status={status({ phase: "clean" })} />);
    expect(banner().getAttribute("data-phase")).toBe("clean");
    expect(banner().className).toContain("bg-success-subtle");
    expect(banner().textContent).toContain("Looks good! No issues found.");
  });

  it("does NOT render the success tone for a file nothing has been raised on", () => {
    render(
      <AutopilotBanner
        status={status({
          phase: "no_items_yet",
          message: "Nothing needed from you yet — anything we need will show up here.",
        })}
      />,
    );
    expect(banner().getAttribute("data-phase")).toBe("no_items_yet");
    expect(banner().className).not.toContain("bg-success-subtle");
    expect(banner().textContent ?? "").not.toMatch(/no issues found/i);
  });

  it("does NOT render the success tone when the status could not be read", () => {
    render(
      <AutopilotBanner
        status={status({
          phase: "unavailable",
          message: "We couldn't check your file's status just now — retrying.",
        })}
      />,
    );
    expect(banner().getAttribute("data-phase")).toBe("unavailable");
    expect(banner().className).not.toContain("bg-success-subtle");
    expect(banner().textContent ?? "").not.toMatch(/no issues found/i);
  });

  it("still counts and links outstanding items", () => {
    render(<AutopilotBanner status={status({ phase: "items_needed", outstandingConditions: 3 })} />);
    expect(banner().textContent).toContain("A few items needed (3).");
    expect(screen.getByTestId("autopilot-banner-tasks-link")).toBeTruthy();
  });

  it("keeps saying so when the live channel is lost, whatever the phase", () => {
    render(<AutopilotBanner status={status({ phase: "no_items_yet" })} live="lost" />);
    expect(screen.getByTestId("autopilot-banner-stale")).toBeTruthy();
  });
});
