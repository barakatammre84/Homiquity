import { describe, it, expect } from "vitest";
import { creditScoreBand } from "./creditScoreBand";

describe("creditScoreBand", () => {
  it("labels each band at its boundaries", () => {
    expect(creditScoreBand(740)).toBe("740+");
    expect(creditScoreBand(850)).toBe("740+");
    expect(creditScoreBand(739)).toBe("680-739");
    expect(creditScoreBand(680)).toBe("680-739");
    expect(creditScoreBand(679)).toBe("620-679");
    expect(creditScoreBand(620)).toBe("620-679");
  });

  it("says Pending when no score has been pulled", () => {
    expect(creditScoreBand(null)).toBe("Pending");
    expect(creditScoreBand(undefined)).toBe("Pending");
    expect(creditScoreBand(0)).toBe("Pending");
  });

  it("PINNED QUIRK: a sub-620 score also reads 'Pending'", () => {
    // Existing behaviour, preserved by this refactor rather than changed. A
    // 580 file has been scored — it is not awaiting a pull — so the caption
    // is misleading, though the score itself renders directly above it.
    // Changing it is a product call, not a refactor's to make.
    expect(creditScoreBand(619)).toBe("Pending");
    expect(creditScoreBand(580)).toBe("Pending");
  });
});
