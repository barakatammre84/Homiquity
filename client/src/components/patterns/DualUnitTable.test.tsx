import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DualUnitTable } from "./DualUnitTable";

describe("DualUnitTable", () => {
  it("shows every amount in annual and derived monthly, with — for N/A", () => {
    render(
      <DualUnitTable
        caption="Qualifying income"
        totalLabel="Total qualifying income"
        groups={[
          {
            label: "Employment",
            note: "Income must be consistent for a 2-year period.",
            rows: [
              { label: "Base salary", annual: 84000 },
              { label: "Overtime", annual: null },
            ],
          },
        ]}
      />,
    );

    expect(screen.getByText("Qualifying income")).toBeTruthy();

    const row = screen.getByText("Base salary").closest("tr")!;
    expect(row.textContent).toContain("$84,000");
    expect(row.textContent).toContain("$7,000");

    const naRow = screen.getByText("Overtime").closest("tr")!;
    expect(naRow.textContent).toContain("—");
    expect(naRow.textContent).not.toContain("$0");

    const total = screen.getByText("Total qualifying income").closest("tr")!;
    expect(total.textContent).toContain("$84,000");
    expect(total.textContent).toContain("$7,000");
  });
});
