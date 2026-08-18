import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskProgress } from "./TaskProgress";

// Pins the standard's moving-denominator ban (§6): the total is snapshotted on
// first render; a later change is ignored and warned about, never re-based.

afterEach(() => {
  vi.restoreAllMocks();
});

const count = () => screen.getByTestId("task-progress-count").textContent;

describe("TaskProgress", () => {
  it("says what it measures and renders the fraction", () => {
    render(<TaskProgress label="Documents uploaded" completed={3} total={5} />);
    expect(screen.getByText("Documents uploaded")).toBeTruthy();
    expect(count()).toBe("3 of 5");
  });

  it("freezes the denominator at first render and warns when it moves", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = render(
      <TaskProgress label="Documents uploaded" completed={3} total={5} />,
    );

    rerender(<TaskProgress label="Documents uploaded" completed={3} total={7} />);
    expect(count()).toBe("3 of 5");
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0][0])).toContain("denominator");
  });

  it("clamps completed to the frozen total instead of overflowing", () => {
    render(<TaskProgress label="Tasks" completed={9} total={5} />);
    expect(count()).toBe("5 of 5");
  });

  it("does not pin a loading zero — the first real total becomes the snapshot", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // A consumer that renders while its query is still loading passes 0.
    const { rerender } = render(<TaskProgress label="Tasks" completed={0} total={0} />);
    expect(count()).toBe("0 of 0");

    rerender(<TaskProgress label="Tasks" completed={2} total={6} />);
    expect(count()).toBe("2 of 6");
    expect(warn).not.toHaveBeenCalled();

    // …and that first real total is now frozen like any other.
    rerender(<TaskProgress label="Tasks" completed={2} total={9} />);
    expect(count()).toBe("2 of 6");
    expect(warn).toHaveBeenCalled();
  });
});
