// Audit finding F-18 — the QM points-and-fees check ran at the wrong end of
// the file.
//
// The elected compensation rate is the single input that decides whether a
// file can clear the Reg Z points-and-fees cap, and the election FREEZES once
// the Loan Estimate issues (changing who pays the originator after disclosure
// is a changed circumstance + redisclosure). Yet the only consumer of
// evaluatePointsAndFeesFloor was the submission-readiness path — so the check
// ran after its own remedy had expired: the file was fully costed, then
// blocked at AUS/package assembly, with the fix out of reach.
//
// These guards pin the fix:
//   1. the basis is derived ONCE, in services/loanCosts.ts, so the election
//      and the submission check cannot score the same file differently,
//   2. the election refuses a definitively over-cap rate and reports the
//      ceiling that would fit,
//   3. the F-17 loan-size floors stay visible — if the fee schedule moves,
//      these numbers move and someone has to look.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";
import {
  estimatedNoteDate,
  evaluatePlatformQmFloor,
  maxElectableCompensationBps,
  MAX_ELECTABLE_COMPENSATION_BPS,
  regulationZTotalLoanAmountStandIn,
  ORIGINATION_FEE_RATE,
  PLATFORM_APPLICATION_FEE,
  PLATFORM_TAX_SERVICE_FEE,
  PLATFORM_UNDERWRITING_FEE,
} from "../server/services/loanCosts";

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

// 2026 note-date table, top tier: 3% of the Reg Z Total Loan Amount.
const NOTE_DATE = "2026-03-15";

// The comp plans seeded on the wholesale lenders (server/seedMarketPricing.ts).
const SUMMIT = 200;
const ATLAS = 225;

describe("F-18 — Reg Z Total Loan Amount stand-in is derived once", () => {
  it("subtracts the platform's own prepaid finance charges under a lender-paid plan", () => {
    // No borrower-paid origination fee exists under lender-paid, so the only
    // deduction is the flat platform schedule.
    const flat = PLATFORM_APPLICATION_FEE + PLATFORM_UNDERWRITING_FEE + PLATFORM_TAX_SERVICE_FEE;
    expect(regulationZTotalLoanAmountStandIn(400_000, { model: "lender_paid", bps: SUMMIT }))
      .toBe(400_000 - flat);
  });

  it("also subtracts the origination fee under a borrower-paid plan", () => {
    const flat = PLATFORM_APPLICATION_FEE + PLATFORM_UNDERWRITING_FEE + PLATFORM_TAX_SERVICE_FEE;
    expect(regulationZTotalLoanAmountStandIn(400_000, { model: "borrower_paid", bps: 100 }))
      .toBe(400_000 - flat - 400_000 * ORIGINATION_FEE_RATE);
  });

  it("treats a file with no election as having no origination fee", () => {
    const flat = PLATFORM_APPLICATION_FEE + PLATFORM_UNDERWRITING_FEE + PLATFORM_TAX_SERVICE_FEE;
    expect(regulationZTotalLoanAmountStandIn(400_000, null)).toBe(400_000 - flat);
  });

  it("never goes negative", () => {
    expect(regulationZTotalLoanAmountStandIn(500, { model: "lender_paid", bps: 200 })).toBe(0);
  });

  it("is always below the note amount — the cap it yields is tighter, never looser", () => {
    for (const amount of [100_000, 250_000, 400_000, 900_000]) {
      const standIn = regulationZTotalLoanAmountStandIn(amount, { model: "lender_paid", bps: SUMMIT });
      expect(standIn).toBeLessThan(amount);
    }
  });
});

describe("F-18 — the election can be scored before it is frozen", () => {
  it("clears a comfortable file without ever claiming it passed", () => {
    const result = evaluatePlatformQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: SUMMIT });
    // `not_cleared` is the strongest verdict a floor can produce: the complete
    // §1026.32(b)(1) figure is still unknown. It must never read as "QM".
    expect(result.verdict).toBe("not_cleared");
    expect(result.floor?.isLowerBound).toBe(true);
  });

  it("refuses a $200k file at the default 200 bps plan — the F-17 case", () => {
    const result = evaluatePlatformQmFloor(NOTE_DATE, 200_000, { model: "lender_paid", bps: SUMMIT });
    expect(result.verdict).toBe("over_cap");
    // Definitive: the floor alone exceeds the cap, so the true figure does too.
    expect(result.floor!.amount).toBeGreaterThan(result.maxAllowableAmount!);
  });

  it("does not evaluate when there is no threshold table for the note year", () => {
    const result = evaluatePlatformQmFloor("2019-01-01", 400_000, { model: "lender_paid", bps: SUMMIT });
    expect(result.verdict).toBe("not_evaluated");
  });
});

describe("F-18 — the ceiling the endpoint reports back", () => {
  it("returns the highest rate that is not definitively over cap", () => {
    const ceiling = maxElectableCompensationBps(NOTE_DATE, 400_000, "lender_paid");
    expect(ceiling).not.toBeNull();

    // Exactly at the ceiling: allowed. One basis point above: refused. This is
    // the property the endpoint's error message promises.
    expect(evaluatePlatformQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: ceiling! }).verdict)
      .not.toBe("over_cap");
    expect(evaluatePlatformQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: ceiling! + 1 }).verdict)
      .toBe("over_cap");
  });

  it("shrinks as the loan amount shrinks — the structural F-17 relationship", () => {
    const big = maxElectableCompensationBps(NOTE_DATE, 400_000, "lender_paid")!;
    const mid = maxElectableCompensationBps(NOTE_DATE, 250_000, "lender_paid")!;
    const small = maxElectableCompensationBps(NOTE_DATE, 200_000, "lender_paid")!;
    expect(big).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThan(small);
  });

  it("returns null when the fixed platform fees alone exhaust the cap", () => {
    // At $25,000 the 2026 table's cap is a flat $1,380 — less than the $2,000
    // of fixed platform fees. No compensation rate rescues the file; the fee
    // schedule or the loan amount is what has to move.
    expect(maxElectableCompensationBps(NOTE_DATE, 25_000, "lender_paid")).toBeNull();
  });

  it("never exceeds the rate the election schema will accept", () => {
    const ceiling = maxElectableCompensationBps(NOTE_DATE, 5_000_000, "lender_paid");
    expect(ceiling).toBeLessThanOrEqual(MAX_ELECTABLE_COMPENSATION_BPS);
  });
});

describe("F-17 — the non-QM dead band stays visible", () => {
  // The fixed platform fees do not create a simple floor. The QM cap changes
  // SHAPE across the note-date tiers — 5% of the Reg Z total, then a flat
  // $4,139, then 3% — so a fixed $2,000 clears the generous low tiers, fails
  // the flat tier as the loan grows past it, and clears again once 3% of a
  // large loan outruns it. The result is a BAND of loan amounts that cannot be
  // originated, with viable amounts on both sides.
  //
  // These edges are a property of the fee schedule, not a preference: if
  // someone changes the platform fees or the comp plans, they move, and the
  // change has to be noticed deliberately.
  const clears = (amount: number, bps: number): boolean =>
    evaluatePlatformQmFloor(NOTE_DATE, amount, { model: "lender_paid", bps }).verdict !== "over_cap";

  it("runs $106,951–$206,299 at the default Summit plan (200 bps)", () => {
    expect(clears(106_950, SUMMIT)).toBe(true);
    expect(clears(106_951, SUMMIT)).toBe(false);
    expect(clears(206_299, SUMMIT)).toBe(false);
    expect(clears(206_300, SUMMIT)).toBe(true);
  });

  it("runs $95,067–$275,067 at the highest seeded plan (Atlas, 225 bps)", () => {
    expect(clears(95_066, ATLAS)).toBe(true);
    expect(clears(95_067, ATLAS)).toBe(false);
    expect(clears(275_067, ATLAS)).toBe(false);
    expect(clears(275_068, ATLAS)).toBe(true);
  });

  it("is non-monotonic in loan size — a bigger loan can be the one that fails", () => {
    // The counterintuitive product property this finding exists to surface: a
    // borrower at $100k is fine, the same borrower at $150k is not.
    expect(clears(100_000, SUMMIT)).toBe(true);
    expect(clears(150_000, SUMMIT)).toBe(false);
    expect(clears(400_000, SUMMIT)).toBe(true);
  });

  it("excludes third-party charges, so the real band is wider still", () => {
    const floor = evaluatePlatformQmFloor(NOTE_DATE, 207_000, { model: "lender_paid", bps: SUMMIT }).floor!;
    const names = floor.components.map(c => c.name).join(" ");
    expect(names).not.toMatch(/appraisal|title|recording|transfer/i);
    expect(floor.isLowerBound).toBe(true);
  });
});

describe("F-18 — note-date selection is shared", () => {
  it("uses the scheduled closing date when there is one", () => {
    expect(estimatedNoteDate("2026-03-15").getFullYear()).toBe(2026);
  });

  it("falls back to today when absent or unparseable", () => {
    const thisYear = new Date().getFullYear();
    expect(estimatedNoteDate(null).getFullYear()).toBe(thisYear);
    expect(estimatedNoteDate("not-a-date").getFullYear()).toBe(thisYear);
  });
});

describe("F-18 — the wiring cannot be silently removed", () => {
  const electionSrc = read("server/routes/lending/pricing.ts");

  it("the election endpoint scores the QM floor and refuses an over-cap rate", () => {
    expect(electionSrc).toContain("evaluatePlatformQmFloor");
    expect(electionSrc).toContain("maxElectableCompensationBps");
    expect(electionSrc).toContain("qm_points_and_fees_exceeded");
    expect(electionSrc).toContain("res.status(422)");
  });

  it("refuses BEFORE writing the election", () => {
    const refusal = electionSrc.indexOf("qm_points_and_fees_exceeded");
    const write = electionSrc.indexOf("storage.updateLoanApplication(id, {");
    expect(refusal).toBeGreaterThan(-1);
    expect(write).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(write);
  });

  it("refuses only on the definitive verdict", () => {
    // `not_cleared` is a lower bound clearing the cap, NOT a pass — and it
    // must never be the thing that blocks an election either.
    expect(electionSrc).toContain('qm.election?.verdict === "over_cap"');
    expect(electionSrc).not.toContain('=== "not_cleared"');
  });

  it("cannot block a file that has no loan amount to score", () => {
    // buildQmPicture returns a null election when there is no loan amount, so
    // the refusal above is unreachable — pricing legitimately precedes a
    // property, and an unscoreable file must stay electable.
    const at = electionSrc.indexOf("function buildQmPicture");
    const body = electionSrc.slice(at, at + 700);
    expect(body).toContain("loanAmount === null || !(loanAmount > 0)");
    expect(body).toContain("election: null");
    expect(body).toContain('reason: "loan_amount_unknown"');
  });

  it("audits the refusal, not just the successful election", () => {
    expect(electionSrc).toContain("loan_application.compensation_election_refused");
  });

  it("exposes the ceiling for reading, behind the same gates as the election", () => {
    // Without a read side the card could only learn the cap by tripping the
    // 422 — the F-18 sequencing defect one layer up.
    expect(electionSrc).toContain('app.get("/api/loan-applications/:id/compensation/qm"');
    const at = electionSrc.indexOf('app.get("/api/loan-applications/:id/compensation/qm"');
    const handler = electionSrc.slice(at, at + 1400);
    expect(handler).toContain("isInternalStaffRole");
    expect(handler).toContain("verifyInternalStaffApplicationAccess");
  });

  it("both compensation surfaces build the picture from one helper", () => {
    // buildQmPicture is the single scorer: the PATCH refuses off it and the
    // GET reports off it, so the two can never disagree about a file.
    const uses = electionSrc.match(/buildQmPicture\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
  });

  it("the staff card consumes the ceiling rather than leaving it unread", () => {
    const card = read("client/src/pages/staff/borrowerFile/CompensationCard.tsx");
    expect(card).toContain("loanApplicationKeys.compensationQm");
    expect(card).toContain("maxElectableBps");
    // Mirrors the server's 422 client-side, per the card's own
    // never-offer-what-the-server-rejects rule.
    expect(card).toContain("overCeiling");
  });

  it("submission-readiness scores the same helper, so the surfaces cannot drift", () => {
    const validationSrc = read("server/services/mismoValidation.ts");
    expect(validationSrc).toContain("evaluatePlatformQmFloor");
    expect(validationSrc).toContain("regulationZTotalLoanAmountStandIn");
  });

  it("no surface reimplements the basis outside loanCosts.ts", () => {
    // The bug this replaces was one computation living in one place and no
    // other surface being able to reach it. Keep it that way: only the fee
    // schedule may assemble the floor's inputs.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (entry.endsWith(".ts") && full !== resolve(repoRoot, "server/services/loanCosts.ts")) {
          if (readFileSync(full, "utf8").includes("evaluatePointsAndFeesFloor(")) {
            offenders.push(full.slice(repoRoot.length + 1));
          }
        }
      }
    };
    walk(resolve(repoRoot, "server"));
    expect(offenders).toEqual([]);
  });
});
