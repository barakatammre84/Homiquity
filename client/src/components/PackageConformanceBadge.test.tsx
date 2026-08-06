import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PackageConformanceBadge } from "./PackageConformanceBadge";

// The recorded XSD result on a submission's immutable snapshot had zero client
// readers, while the service comment claimed it was "shown to staff". These pin
// the three honest states — above all that `skipped` never reads as a pass,
// which is the exact lie being fixed (when xmllint is missing the recorded
// `valid` is false AND meaningless).

const SUBMISSION_ID = "sub-1";

describe("PackageConformanceBadge", () => {
  it("says the check did not run when it was skipped — never implying a pass", () => {
    // Note the shape the server actually records when xmllint is absent:
    // valid:false + skipped:true. Branching on `valid` first would mislabel this
    // as non-conformant; branching on it at all would risk labelling it a pass.
    render(
      <PackageConformanceBadge
        submissionId={SUBMISSION_ID}
        conformance={{ valid: false, skipped: true, offendingElements: [] }}
      />,
    );
    const el = screen.getByTestId(`xsd-skipped-${SUBMISSION_ID}`);
    expect(el.textContent).toContain("not run");
    expect(el.textContent).toContain("Not a pass");
    expect(screen.queryByTestId(`xsd-conformant-${SUBMISSION_ID}`)).toBeNull();
    expect(screen.queryByTestId(`xsd-non-conformant-${SUBMISSION_ID}`)).toBeNull();
  });

  it("reports a conformant package", () => {
    render(
      <PackageConformanceBadge
        submissionId={SUBMISSION_ID}
        conformance={{ valid: true, skipped: false, offendingElements: [] }}
      />,
    );
    expect(screen.getByTestId(`xsd-conformant-${SUBMISSION_ID}`).textContent).toContain(
      "Schema conformant",
    );
    expect(screen.queryByTestId(`xsd-skipped-${SUBMISSION_ID}`)).toBeNull();
  });

  it("reports non-conformance and lists the offending elements on expand, without blocking", async () => {
    const user = userEvent.setup();
    render(
      <PackageConformanceBadge
        submissionId={SUBMISSION_ID}
        conformance={{
          valid: false,
          skipped: false,
          offendingElements: ["ContactPointTelephoneValue", "IntentToOccupyIndicator"],
        }}
      />,
    );
    const el = screen.getByTestId(`xsd-non-conformant-${SUBMISSION_ID}`);
    expect(el.textContent).toContain("Schema non-conformant");
    // Non-blocking framing is the point — staff must see it, not be stopped.
    expect(el.textContent).toContain("did not block this submission");

    // Elements are behind an expand, so the row stays small.
    expect(screen.queryByTestId(`xsd-elements-${SUBMISSION_ID}`)).toBeNull();
    await user.click(screen.getByTestId(`xsd-elements-toggle-${SUBMISSION_ID}`));
    const list = screen.getByTestId(`xsd-elements-${SUBMISSION_ID}`);
    expect(list.textContent).toContain("ContactPointTelephoneValue");
    expect(list.textContent).toContain("IntentToOccupyIndicator");
  });

  it("renders nothing when the submission never recorded a result", () => {
    const { container } = render(
      <PackageConformanceBadge submissionId={SUBMISSION_ID} conformance={undefined} />,
    );
    expect(container.textContent).toBe("");
  });
});
