import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { ConsentField } from "./ConsentField";

// Pins the honesty rules (§6): positive opt-in, never pre-ticked, consequence
// stated outside the label, dev warnings on negative language and pre-granted
// consent.

afterEach(() => {
  vi.restoreAllMocks();
});

function Harness({ initial = false, label }: { initial?: boolean; label: string }) {
  const [checked, setChecked] = useState(initial);
  return (
    <ConsentField
      id="credit-consent"
      label={label}
      consequence="We'll run a soft credit check, which never affects your score."
      checked={checked}
      onCheckedChange={setChecked}
    />
  );
}

describe("ConsentField", () => {
  it("starts unchecked and toggles on a positive action", async () => {
    const user = userEvent.setup();
    render(<Harness label="I agree to a soft credit check" />);

    const checkbox = screen.getByTestId("consent-field-checkbox");
    expect(checkbox.getAttribute("data-state")).toBe("unchecked");
    await user.click(checkbox);
    expect(checkbox.getAttribute("data-state")).toBe("checked");
  });

  it("renders the consequence outside the label element", () => {
    render(<Harness label="I agree to a soft credit check" />);
    const consequence = screen.getByTestId("consent-field-consequence");
    expect(consequence.textContent).toMatch(/never affects your score/);
    expect(consequence.tagName).not.toBe("LABEL");
    expect(consequence.closest("label")).toBeNull();
  });

  it("warns in dev when consent arrives pre-granted", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Harness initial label="I agree to a soft credit check" />);
    expect(String(warn.mock.calls.flat().join(" "))).toContain("pre-granted");
  });

  it("warns in dev on negative-language labels", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<Harness label="I do not want to skip the credit check" />);
    expect(String(warn.mock.calls.flat().join(" "))).toContain("negative");
  });
});
