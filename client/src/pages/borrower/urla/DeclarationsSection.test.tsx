import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import type { BorrowerDeclarations } from "@shared/schema";
import { DeclarationsSection } from "./DeclarationsSection";
import { DECLARATION_QUESTIONS } from "./types";

// Characterization first (house rule): these pin the section's OUTWARD contract
// — boolean answers flowing through onChange under the select-declaration-*
// testids — so the DeclarationsGroup migration can be proven behavior-
// preserving. The escape-hatch tests below pin the migration's one new rule:
// the master covers ONLY the E–K financial-history block, never A–D, and it is
// derived, never stored.

function Harness({ initial = {} }: { initial?: Partial<BorrowerDeclarations> }) {
  const [declarations, setDeclarations] = useState<Partial<BorrowerDeclarations>>(initial);
  return (
    <DeclarationsSection declarations={declarations} onChange={setDeclarations} activeSeq={1} />
  );
}

const pressed = (testId: string) =>
  screen.getByTestId(testId).getAttribute("aria-pressed");

describe("DeclarationsSection (URLA section 5)", () => {
  it("renders all eleven questions, individually answerable as booleans", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    for (const q of DECLARATION_QUESTIONS) {
      expect(screen.getByText(q.label)).toBeTruthy();
    }

    await user.click(screen.getByTestId("select-declaration-willOccupyAsPrimaryResidence-yes"));
    expect(pressed("select-declaration-willOccupyAsPrimaryResidence-yes")).toBe("true");

    await user.click(screen.getByTestId("select-declaration-hasDeclaredBankruptcy-no"));
    expect(pressed("select-declaration-hasDeclaredBankruptcy-no")).toBe("true");
    // The occupancy answer survives the bankruptcy click — answers accumulate.
    expect(pressed("select-declaration-willOccupyAsPrimaryResidence-yes")).toBe("true");
  });

  it("keeps existing answers when hydrated from a saved slice", () => {
    render(
      <Harness
        initial={{ willOccupyAsPrimaryResidence: true, hasOutstandingJudgments: false }}
      />,
    );
    expect(pressed("select-declaration-willOccupyAsPrimaryResidence-yes")).toBe("true");
    expect(pressed("select-declaration-hasOutstandingJudgments-no")).toBe("true");
  });
});

describe("DeclarationsSection escape hatch (post-migration contract)", () => {
  it("master answers 'No' to the E–K history block only — A–D stay untouched", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("select-declaration-master"));

    // The seven financial-history questions flip to No…
    for (const key of [
      "hasOutstandingJudgments",
      "isDelinquentOnFederalDebt",
      "isPartyToLawsuit",
      "hasConveyedTitleInLieuOfForeclosure",
      "hasCompletedShortSale",
      "hasBeenForeclosed",
      "hasDeclaredBankruptcy",
    ]) {
      expect(pressed(`select-declaration-${key}-no`)).toBe("true");
    }

    // …and the substantive A–D questions are NOT answered by the shortcut.
    for (const key of [
      "willOccupyAsPrimaryResidence",
      "hasOwnershipInterestInPast3Years",
      "isBorrowingForDownPayment",
      "hasCoMakerEndorser",
    ]) {
      expect(pressed(`select-declaration-${key}-no`)).toBe("false");
      expect(pressed(`select-declaration-${key}-yes`)).toBe("false");
    }
  });

  it("master is derived: flipping one history answer to Yes releases it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByTestId("select-declaration-master"));
    expect(
      screen.getByTestId("select-declaration-master").getAttribute("data-state"),
    ).toBe("checked");

    await user.click(screen.getByTestId("select-declaration-hasDeclaredBankruptcy-yes"));
    expect(
      screen.getByTestId("select-declaration-master").getAttribute("data-state"),
    ).toBe("unchecked");
    expect(pressed("select-declaration-hasOutstandingJudgments-no")).toBe("true");
  });
});
