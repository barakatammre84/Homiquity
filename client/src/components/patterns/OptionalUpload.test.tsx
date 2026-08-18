import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { OptionalUpload } from "./OptionalUpload";

// Pins the honesty contract: the ask is marked Optional, the required
// reassurance states neutrally what skipping means, and no required marker
// can appear.

describe("OptionalUpload", () => {
  it("marks the ask optional and states what skipping means", () => {
    render(
      <OptionalUpload
        title="Gift letter"
        description="Only needed when part of your down payment is a gift."
        reassurance="If no gift funds are part of your down payment, there's nothing to add here — your application is complete without it."
        tips={["Ask the giver to sign and date it."]}
      />,
    );

    expect(screen.getByTestId("optional-upload-optional").textContent).toBe("Optional");
    expect(screen.getByTestId("optional-upload-reassurance").textContent).toContain(
      "nothing to add here",
    );
    expect(screen.getByTestId("optional-upload").textContent).not.toContain("*");
    expect(screen.getByText(/sign and date/)).toBeTruthy();
  });
});
