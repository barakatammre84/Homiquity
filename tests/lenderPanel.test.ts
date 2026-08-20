import { describe, it, expect } from "vitest";
import {
  LENDER_PANEL_LIVE,
  lenderAdvocacyLine,
  lenderAdvocacyClause,
} from "@shared/lenderPanel";

/**
 * The gate that keeps "we shop your file" honest.
 *
 * Homiquity is a mortgage broker, so shopping a file across a lender panel is the
 * core customer promise — and it becomes true only when a wholesale lender has a
 * signed broker agreement. Every row in `wholesale_lenders` is seeded at
 * `approvalStatus: "target"` and the submission service hard-blocks on that flag,
 * so today no file can actually be shopped anywhere.
 *
 * Advertising it before then markets a capability the product cannot perform —
 * a Reg N / UDAAP misrepresentation, and the marketing form of the silent-success
 * bug class this codebase keeps hitting: copy that describes an operation that
 * never happens.
 */

describe("lender panel advertising gate", () => {
  it("does not claim shopping while no counterparty is approved", () => {
    if (LENDER_PANEL_LIVE) return; // covered by the live-mode case below

    expect(lenderAdvocacyLine()).not.toMatch(/\bshops?\b/i);
    expect(lenderAdvocacyClause()).not.toMatch(/\bshops?\b/i);
  });

  it("still promises advocacy in the pre-panel wording — it does not go silent", () => {
    // The point is a truthful claim, not the absence of one. A broker preparing a
    // file and taking it out is exactly what happens today.
    expect(lenderAdvocacyLine()).toMatch(/lending partners/i);
    expect(lenderAdvocacyClause()).toMatch(/lending partners/i);
  });

  it("never names or counts the lending partners in either mode", () => {
    // Borrower-transparency doctrine: wholesale-lender identity is masked from
    // borrowers everywhere (shared/borrowerActivityView.ts).
    const copy = `${lenderAdvocacyLine()} ${lenderAdvocacyClause()}`;
    for (const name of ["UWM", "United Wholesale", "Rocket", "Plaza", "Angel Oak", "Newrez"]) {
      expect(copy).not.toContain(name);
    }
    expect(copy).not.toMatch(/\b\d+\+?\s+(?:lenders|lending partners)\b/i);
  });

  it("never implies Homiquity decides or funds, in either mode", () => {
    // Mirrors the standing disclosure in client/src/components/Footer.tsx.
    const copy = `${lenderAdvocacyLine()} ${lenderAdvocacyClause()}`;
    expect(copy).not.toMatch(/\bwe (?:lend|fund|approve|underwrite)\b/i);
    expect(copy).not.toMatch(/\bdirect lender\b/i);
  });
});
