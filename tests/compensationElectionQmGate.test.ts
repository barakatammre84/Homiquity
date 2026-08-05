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
  evaluateFileQmFloor,
  evaluatePlatformQmFloor,
  resolvePlatformFinanceCharges,
  knownPrepaidFinanceCharges,
  maxElectableCompensationBps,
  MAX_ELECTABLE_COMPENSATION_BPS,
  regulationZTotalLoanAmountStandIn,
  ORIGINATION_FEE_RATE,
  PLATFORM_APPLICATION_FEE,
  PLATFORM_FINANCE_CHARGES,
  PLATFORM_FINANCE_CHARGE_TOTAL,
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

describe("F-19 — a platform charge cannot shrink the cap without counting against it", () => {
  // The defect: the tax service fee was a prepaid finance charge in
  // knownPrepaidFinanceCharges and in apr.ts, and absent from the
  // points-and-fees floor — so the same $100 reduced the Reg Z Total Loan
  // Amount (shrinking the cap) while not being charged against that cap.
  //
  // The fix is structural, not arithmetic: ONE list feeds both computations.
  // These guards pin that, so re-introducing the asymmetry fails the suite
  // rather than quietly loosening the gate.

  it("the floor's platform charges are exactly what the stand-in subtracts", () => {
    // knownPrepaidFinanceCharges(0, 0) is the platform's own contribution with
    // no origination fee and no points — i.e. the denominator's deduction.
    expect(PLATFORM_FINANCE_CHARGE_TOTAL).toBe(knownPrepaidFinanceCharges(0, 0));

    // And the numerator counts the same total. Lender-paid at 0 bps isolates
    // the platform charges: no origination fee, no points, no compensation.
    const floor = evaluatePlatformQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: 0 }).floor!;
    expect(floor.amount).toBe(PLATFORM_FINANCE_CHARGE_TOTAL);
  });

  it("includes the tax service fee — the charge that was missing", () => {
    expect(PLATFORM_FINANCE_CHARGES.map(c => c.amount)).toContain(PLATFORM_TAX_SERVICE_FEE);
    const floor = evaluatePlatformQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: 200 }).floor!;
    expect(floor.components.map(c => c.name)).toContain("Tax service fee");
  });

  it("holds under the borrower-paid branch, which sums separately", () => {
    // pointsAndFeesFloor takes max(origination, comp) under borrower-paid to
    // avoid double-counting, and that branch adds the platform total by hand —
    // a second place the asymmetry could hide.
    const loanAmount = 400_000;
    const floor = evaluatePlatformQmFloor(NOTE_DATE, loanAmount, {
      model: "borrower_paid",
      bps: 100,
    }).floor!;
    expect(floor.amount).toBe(loanAmount * ORIGINATION_FEE_RATE + PLATFORM_FINANCE_CHARGE_TOTAL);
  });

  it("stays consistent if the schedule changes — the invariant, not the numbers", () => {
    // The point of the fix: whatever the list becomes, both sides move
    // together. Adding a charge must raise the floor by exactly its amount.
    const listed = PLATFORM_FINANCE_CHARGES.reduce((sum, c) => sum + c.amount, 0);
    expect(listed).toBe(PLATFORM_FINANCE_CHARGE_TOTAL);
    expect(knownPrepaidFinanceCharges(1_000, 500)).toBe(1_500 + PLATFORM_FINANCE_CHARGE_TOTAL);
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

    // Exactly at the ceiling: allowed. One basis point above: refused. Scored
    // through evaluateFileQmFloor, because the ceiling reflects what the file
    // would ACTUALLY be charged after the F-17 fee fit.
    expect(evaluateFileQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: ceiling! }).verdict)
      .not.toBe("over_cap");
    expect(evaluateFileQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: ceiling! + 1 }).verdict)
      .toBe("over_cap");
  });

  it("is now bounded by compensation, not by loan size", () => {
    // Before the F-17 fee fit the ceiling collapsed on small loans because a
    // fixed fee ate the cap. Now the platform's own fees get out of the way,
    // so every realistic loan size clears the seeded comp plans (max 275 bps).
    for (const amount of [120_000, 150_000, 200_000, 250_000, 400_000]) {
      const ceiling = maxElectableCompensationBps(NOTE_DATE, amount, "lender_paid");
      expect(`${amount}:${ceiling !== null && ceiling >= 275}`).toBe(`${amount}:true`);
    }
  });

  it("returns null only when compensation alone exceeds the whole cap", () => {
    // The residual, and the honest one: the top tier caps points and fees at
    // 3% of the Reg Z total, so a comp plan at or above ~3% cannot be rescued
    // by charging the borrower nothing. That is a comp-plan problem.
    expect(maxElectableCompensationBps(NOTE_DATE, 400_000, "lender_paid")).toBeLessThan(300);
    expect(evaluateFileQmFloor(NOTE_DATE, 400_000, { model: "lender_paid", bps: 320 }).verdict)
      .toBe("over_cap");
  });

  it("never exceeds the rate the election schema will accept", () => {
    const ceiling = maxElectableCompensationBps(NOTE_DATE, 5_000_000, "lender_paid");
    expect(ceiling).toBeLessThanOrEqual(MAX_ELECTABLE_COMPENSATION_BPS);
  });
});

describe("F-17 — the non-QM dead band is resolved, by construction", () => {
  // The band existed because a FIXED fee met a cap that is proportional in the
  // tiers that matter. No choice of fixed number fixes that — only removing the
  // fixedness does. The platform schedule is now a CEILING: a file is charged
  // the standard schedule when it fits, and the reducible part trims when it
  // does not. Charging less needs no changed circumstance and is the
  // borrower-favourable direction.
  const clears = (amount: number, bps: number): boolean =>
    evaluateFileQmFloor(NOTE_DATE, amount, { model: "lender_paid", bps }).verdict !== "over_cap";

  it("no longer has a band — every loan size clears at every seeded comp plan", () => {
    // The exact amounts that used to fail, and the edges of the old bands.
    for (const bps of [175, SUMMIT, ATLAS, 275]) {
      for (const amount of [90_623, 101_951, 120_000, 150_000, 200_000, 216_299, 288_399, 400_000]) {
        expect(`${bps}bps/${amount}`).toBe(`${bps}bps/${amount}`);
        expect(clears(amount, bps), `${bps} bps at $${amount} must be originable`).toBe(true);
      }
    }
  });

  it("is monotonic again — no bigger loan fails where a smaller one passed", () => {
    // The band's strangest property was non-monotonicity: $100k fine, $150k
    // not, $400k fine again. Sweep the old range and assert it is gone.
    for (let amount = 60_000; amount <= 400_000; amount += 1_000) {
      expect(`${amount}:${clears(amount, SUMMIT)}`).toBe(`${amount}:true`);
    }
  });

  it("charges the standard schedule whenever it fits — no revenue given away", () => {
    const resolved = resolvePlatformFinanceCharges(NOTE_DATE, 400_000, {
      model: "lender_paid",
      bps: SUMMIT,
    });
    expect(resolved.reduced).toBe(false);
    expect(resolved.total).toBe(PLATFORM_FINANCE_CHARGE_TOTAL);
  });

  it("trims only what is ours — a vendor pass-through is never discounted", () => {
    const resolved = resolvePlatformFinanceCharges(NOTE_DATE, 150_000, {
      model: "lender_paid",
      bps: SUMMIT,
    });
    expect(resolved.reduced).toBe(true);
    expect(resolved.total).toBeLessThan(PLATFORM_FINANCE_CHARGE_TOTAL);
    // We cannot discount someone else's charge, so it survives at full value.
    const taxService = resolved.charges.find(c => c.id === "tax_service")!;
    expect(taxService.amount).toBe(PLATFORM_TAX_SERVICE_FEE);
  });

  it("never trims to a total that still breaches the cap", () => {
    for (const amount of [95_000, 120_000, 150_000, 180_000, 210_000]) {
      const resolved = resolvePlatformFinanceCharges(NOTE_DATE, amount, {
        model: "lender_paid",
        bps: ATLAS,
      });
      expect(resolved.total).toBeLessThanOrEqual(resolved.standardTotal);
      expect(`${amount}:${clears(amount, ATLAS)}`).toBe(`${amount}:true`);
    }
  });

  it("does not pretend a compensation problem is a fee problem", () => {
    // 320 bps exceeds the entire 3% cap. There is nothing to trim toward, so
    // the schedule stays standard, the file is not originable, and the gate
    // still refuses — the honest residual.
    const resolved = resolvePlatformFinanceCharges(NOTE_DATE, 400_000, {
      model: "lender_paid",
      bps: 320,
    });
    expect(resolved.originable).toBe(false);
    expect(resolved.reduced).toBe(false);
    expect(resolved.total).toBe(PLATFORM_FINANCE_CHARGE_TOTAL);
    expect(clears(400_000, 320)).toBe(false);
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
    expect(electionSrc).toContain("evaluateFileQmFloor");
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
    expect(validationSrc).toContain("evaluateFileQmFloor");
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
