import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DATA_PROVENANCE } from "@shared/dataProvenance";
import { ProvenanceBadge } from "./ProvenanceBadge";

// Pins the display vocabulary to the DATA layer's provenance states — the badge
// derives from shared/dataProvenance.ts, never a parallel client enum. (No
// jest-dom in the client lane — house convention, see Lenders.test.tsx.)

describe("ProvenanceBadge", () => {
  it("labels each data-layer provenance state", () => {
    const { rerender } = render(
      <ProvenanceBadge provenance={DATA_PROVENANCE.SELF_REPORTED} />,
    );
    const text = () => screen.getByTestId("provenance-badge").textContent;
    expect(text()).toBe("You told us");

    rerender(<ProvenanceBadge provenance={DATA_PROVENANCE.VERIFIED} />);
    expect(text()).toBe("Verified");

    rerender(<ProvenanceBadge provenance={DATA_PROVENANCE.SYSTEM_CALCULATED} />);
    expect(text()).toBe("Estimated");
  });

  it("renders the soft-check refinement only on verified data", () => {
    const { rerender } = render(
      <ProvenanceBadge provenance={DATA_PROVENANCE.VERIFIED} method="soft_check" />,
    );
    const text = () => screen.getByTestId("provenance-badge").textContent;
    expect(text()).toBe("Soft credit check");

    rerender(
      <ProvenanceBadge
        provenance={DATA_PROVENANCE.SELF_REPORTED}
        method="soft_check"
      />,
    );
    expect(text()).toBe("You told us");
  });

  it("carries a hover explanation from the single display map", () => {
    render(<ProvenanceBadge provenance={DATA_PROVENANCE.SELF_REPORTED} />);
    const title = screen.getByTestId("provenance-badge").getAttribute("title");
    expect(title).toBeTruthy();
    expect(title).toMatch(/confirm it against documents/i);
  });
});
