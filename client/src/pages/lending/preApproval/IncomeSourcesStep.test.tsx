import { useState } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncomeSourcesStep } from "./IncomeSourcesStep";
import type { RentalPropertyEntry, IncomeSourceEntry, PreApprovalFormData } from "@shared/schema";

// The complex-income step is CONTROLLED (draft-restore reseeds its stores from
// the parent). This harness hosts the state exactly like PreApproval does and
// captures every rebuilt incomeSources payload.

function Harness({
  employmentType = "employed",
  onEntries,
}: {
  employmentType?: PreApprovalFormData["employmentType"];
  onEntries: (entries: IncomeSourceEntry[]) => void;
}) {
  const [selectedIncomeTypes, setSelectedIncomeTypes] = useState<string[]>([]);
  const [incomeDetails, setIncomeDetails] = useState<Record<string, { annualAmount: string; employerName: string; yearsInRole: string }>>({});
  const [rentalProperties, setRentalProperties] = useState<RentalPropertyEntry[]>([]);
  return (
    <IncomeSourcesStep
      employmentType={employmentType}
      selectedIncomeTypes={selectedIncomeTypes}
      incomeDetails={incomeDetails}
      rentalProperties={rentalProperties}
      setSelectedIncomeTypes={setSelectedIncomeTypes}
      setIncomeDetails={setIncomeDetails}
      setRentalProperties={setRentalProperties}
      setIncomeSources={onEntries}
    />
  );
}

describe("IncomeSourcesStep", () => {
  it("excludes the borrower's primary income type from the additional-sources list", () => {
    render(<Harness onEntries={vi.fn()} />); // employed ⇒ primary is w2
    expect(screen.queryByTestId("toggle-income-w2")).toBeNull();
    expect(screen.getByTestId("toggle-income-rental")).toBeTruthy();
  });

  it("keeps self-employment in the list for self-employed borrowers (1099 detailing)", () => {
    render(<Harness employmentType="self_employed" onEntries={vi.fn()} />);
    expect(screen.getByTestId("toggle-income-self_employed")).toBeTruthy();
    expect(screen.getByTestId("toggle-income-w2")).toBeTruthy();
  });

  it("toggling a type opens its detail card and reports the entry upward", async () => {
    const user = userEvent.setup();
    const onEntries = vi.fn();
    render(<Harness onEntries={onEntries} />);
    await user.click(screen.getByTestId("toggle-income-investment"));
    expect(screen.getByTestId("card-income-investment")).toBeTruthy();
    expect(onEntries).toHaveBeenLastCalledWith([
      expect.objectContaining({ type: "investment", annualAmount: "" }),
    ]);
  });

  it("derives rental annualAmount from Σ monthly rents × 12 — never typed directly", async () => {
    const user = userEvent.setup();
    const onEntries = vi.fn();
    render(<Harness onEntries={onEntries} />);
    await user.click(screen.getByTestId("toggle-income-rental"));
    await user.type(screen.getByTestId("input-rental-income-0"), "2000");
    const last = onEntries.mock.calls.at(-1)![0] as Array<IncomeSourceEntry & { rentalProperties?: RentalPropertyEntry[] }>;
    const rental = last.find((e) => e.type === "rental")!;
    expect(rental.annualAmount).toBe("24,000");
    expect(rental.rentalProperties?.[0]?.monthlyRentalIncome).toBe("2,000");
  });

  it("add/remove rental property rows update the reported entries", async () => {
    const user = userEvent.setup();
    const onEntries = vi.fn();
    render(<Harness onEntries={onEntries} />);
    await user.click(screen.getByTestId("toggle-income-rental"));
    await user.click(screen.getByTestId("button-add-rental-property"));
    expect(screen.getByTestId("rental-property-1")).toBeTruthy();
    await user.click(screen.getByTestId("button-remove-rental-1"));
    expect(screen.queryByTestId("rental-property-1")).toBeNull();
  });
});
