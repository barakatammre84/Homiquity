// The platform fee schedule became admin-editable (audit F-17's business lever
// made operable). Two properties have to survive that, and these pin them:
//
//   1. PURITY. services/loanCosts.ts still takes the schedule as a PARAMETER
//      and reads no global. That is what keeps a Loan Estimate reproducible
//      from the schedule it was priced under, and what keeps the whole model
//      testable without a database.
//   2. F-19's INVARIANT holds for EVERY schedule, not just the compiled-in
//      one — a charge still cannot shrink the QM cap without counting against
//      it once an admin can change the numbers.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  computeClosingCosts,
  DEFAULT_PLATFORM_FEE_SCHEDULE,
  evaluateFileQmFloor,
  evaluatePlatformQmFloor,
  knownPrepaidFinanceCharges,
  maxElectableCompensationBps,
  platformFinanceCharges,
  platformFinanceChargeTotal,
  regulationZTotalLoanAmountStandIn,
  resolvePlatformFinanceCharges,
  PLATFORM_APPLICATION_FEE,
  PLATFORM_FINANCE_CHARGE_TOTAL,
  PLATFORM_TAX_SERVICE_FEE,
  PLATFORM_UNDERWRITING_FEE,
  type PlatformFeeSchedule,
} from "../server/services/loanCosts";

const repoRoot = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(repoRoot, p), "utf8");

const NOTE_DATE = "2026-03-15";
const LENDER_PAID = { model: "lender_paid" as const, bps: 200 };

/** A deliberately different schedule — cheaper fees, halved origination. */
const LEAN: PlatformFeeSchedule = {
  applicationFee: 250,
  underwritingFee: 750,
  taxServiceFee: 60,
  originationFeeRate: 0.005,
};

/** An expensive schedule, so the trim path is exercised under a NON-default. */
const RICH: PlatformFeeSchedule = {
  applicationFee: 1_500,
  underwritingFee: 2_500,
  taxServiceFee: 120,
  originationFeeRate: 0.01,
};

const baseCosts = {
  purchasePrice: 500_000,
  downPayment: 100_000,
  loanAmount: 400_000,
  interestRate: 6.875,
  monthlyPMI: 0,
  prepaidInterestDays: 15,
};

describe("the compiled-in baseline is unchanged", () => {
  it("still equals the documented constants", () => {
    expect(DEFAULT_PLATFORM_FEE_SCHEDULE).toEqual({
      applicationFee: PLATFORM_APPLICATION_FEE,
      underwritingFee: PLATFORM_UNDERWRITING_FEE,
      taxServiceFee: PLATFORM_TAX_SERVICE_FEE,
      originationFeeRate: 0.01,
    });
  });

  it("is what every function falls back to when no schedule is passed", () => {
    // Back-compat is the whole safety argument for this refactor: an omitted
    // schedule must behave exactly as the constants did before it existed.
    expect(platformFinanceChargeTotal()).toBe(PLATFORM_FINANCE_CHARGE_TOTAL);
    expect(platformFinanceChargeTotal(DEFAULT_PLATFORM_FEE_SCHEDULE)).toBe(
      PLATFORM_FINANCE_CHARGE_TOTAL,
    );
  });
});

describe("a published schedule flows through every surface", () => {
  it("changes the charge list", () => {
    const charges = platformFinanceCharges(LEAN);
    expect(charges.map(c => c.amount)).toEqual([250, 750, 60]);
    expect(platformFinanceChargeTotal(LEAN)).toBe(1_060);
  });

  it("changes what the Loan Estimate discloses", () => {
    const costs = computeClosingCosts({ ...baseCosts, compensation: LENDER_PAID, feeSchedule: LEAN });
    expect(costs.applicationFee).toBe(250);
    expect(costs.underwritingFee).toBe(750);
    expect(costs.taxServiceFee).toBe(60);
    expect(costs.platformFees.standardTotal).toBe(1_060);
  });

  it("changes the borrower-paid origination fee", () => {
    const costs = computeClosingCosts({
      ...baseCosts,
      compensation: { model: "borrower_paid", bps: 100 },
      feeSchedule: LEAN,
    });
    // 0.5% of $400,000 under the lean schedule, not the baseline's 1%.
    expect(costs.originationFee).toBe(2_000);
  });

  it("changes the Reg Z Total Loan Amount stand-in", () => {
    expect(regulationZTotalLoanAmountStandIn(400_000, LENDER_PAID, platformFinanceChargeTotal(LEAN), LEAN))
      .toBe(400_000 - 1_060);
  });

  it("changes the QM ceiling — cheaper fees leave more room for compensation", () => {
    const baseline = maxElectableCompensationBps(NOTE_DATE, 150_000, "lender_paid")!;
    const lean = maxElectableCompensationBps(NOTE_DATE, 150_000, "lender_paid", LEAN)!;
    expect(lean).toBeGreaterThanOrEqual(baseline);
  });
});

describe("F-19's invariant survives an editable schedule", () => {
  it("numerator and denominator use the same total, for any schedule", () => {
    for (const schedule of [DEFAULT_PLATFORM_FEE_SCHEDULE, LEAN]) {
      const total = platformFinanceChargeTotal(schedule);
      expect(knownPrepaidFinanceCharges(0, 0, total)).toBe(total);

      // Lender-paid at 0 bps isolates the platform charges in the floor.
      const floor = evaluatePlatformQmFloor(
        NOTE_DATE,
        400_000,
        { model: "lender_paid", bps: 0 },
        platformFinanceCharges(schedule),
        schedule,
      ).floor!;
      expect(floor.amount).toBe(total);
    }
  });

  it("keeps the vendor pass-through non-reducible under a published schedule", () => {
    const resolved = resolvePlatformFinanceCharges(NOTE_DATE, 150_000, LENDER_PAID, RICH);
    expect(resolved.reduced).toBe(true);
    // We still cannot discount someone else's charge, whatever the schedule.
    expect(resolved.charges.find(c => c.id === "tax_service")!.amount).toBe(RICH.taxServiceFee);
  });

  it("trims relative to the published schedule's own total, not the baseline's", () => {
    const resolved = resolvePlatformFinanceCharges(NOTE_DATE, 150_000, LENDER_PAID, RICH);
    expect(resolved.standardTotal).toBe(4_120);
    expect(resolved.total).toBeLessThan(4_120);
  });

  it("a cheap enough schedule simply never needs trimming — the F-17 lever", () => {
    // This is what an admin buys by lowering fees: the trim stops firing at all
    // across the whole realistic range, and every file pays the full schedule.
    for (const amount of [100_000, 150_000, 200_000, 250_000, 400_000]) {
      const resolved = resolvePlatformFinanceCharges(NOTE_DATE, amount, LENDER_PAID, LEAN);
      expect(`${amount}:${resolved.reduced}`).toBe(`${amount}:false`);
      expect(`${amount}:${resolved.originable}`).toBe(`${amount}:true`);
    }
  });
});

describe("F-17's resolution holds under a published schedule", () => {
  it("still clears every loan size at the seeded comp plans", () => {
    for (const bps of [175, 200, 225, 275]) {
      for (const amount of [90_000, 120_000, 150_000, 200_000, 400_000]) {
        const verdict = evaluateFileQmFloor(NOTE_DATE, amount, { model: "lender_paid", bps }, LEAN)
          .verdict;
        expect(`${bps}/${amount}:${verdict !== "over_cap"}`).toBe(`${bps}/${amount}:true`);
      }
    }
  });
});

describe("the admin surface cannot quietly lose its guarantees", () => {
  const routeSrc = read("server/routes/admin/pricingPolicy.ts");

  it("gates every pricing-policy endpoint on admin", () => {
    const handlers = routeSrc.match(/app\.(get|post|patch)\(/g) ?? [];
    const gated = routeSrc.match(/requireRole\("admin"\)/g) ?? [];
    expect(handlers.length).toBeGreaterThan(0);
    expect(gated.length).toBe(handlers.length);
  });

  it("audits both a fee publish and a comp-band change", () => {
    expect(routeSrc).toContain('"platform_fee_schedule.published"');
    expect(routeSrc).toContain('"wholesale_lender.compensation_updated"');
  });

  it("publishes append-only — supersede then insert, never an in-place edit", () => {
    // Overwriting a schedule would make an already-issued Loan Estimate
    // unreproducible, so the only UPDATE allowed is the supersede stamp.
    expect(routeSrc).toContain("supersededAt: new Date()");
    expect(routeSrc).toContain(".insert(platformFeeSchedules)");
    expect(routeSrc).not.toMatch(/\.set\(\{\s*applicationFee/);
  });

  it("drops the resolver cache on publish, so the next price uses it", () => {
    expect(routeSrc).toContain("invalidateFeeScheduleCache()");
  });

  it("validates the origination rate as a fraction with a slip-catching cap", () => {
    expect(routeSrc).toMatch(/originationFeeRate: z\.number\(\)\.min\(0\)\.max\(0\.05\)/);
  });

  it("requires a reason for a fee change", () => {
    expect(routeSrc).toMatch(/note: z\.string\(\)\.trim\(\)\.min\(1\)/);
  });

  it("falls back to the baseline rather than failing pricing when the read fails", () => {
    const resolverSrc = read("server/services/platformFeeSchedule.ts");
    expect(resolverSrc).toContain("catch");
    expect(resolverSrc).toContain("baselineFeeSchedule()");
  });
});

// ---------------------------------------------------------------------------
// Audit FA-20 — a file is PINNED to the fee schedule it was disclosed under.
//
// Fees are admin-editable and four of the lines they set are zero-tolerance.
// Resolving the schedule late meant a publish raised those lines on every file
// already in flight, and since a creditor re-pricing itself is not a
// §1026.19(e)(3)(iv) changed circumstance, each of those files became a
// dollar-for-dollar cure. These pin the fix.
// ---------------------------------------------------------------------------
describe("FA-20 — fee schedule version pinning", () => {
  const RAISED: PlatformFeeSchedule = {
    ...DEFAULT_PLATFORM_FEE_SCHEDULE,
    underwritingFee: 1_800,
    originationFeeRate: 0.0125,
  };

  const feesOf = (schedule: PlatformFeeSchedule, loanAmount: number) => {
    const c = computeClosingCosts({
      purchasePrice: loanAmount / 0.8,
      downPayment: (loanAmount / 0.8) * 0.2,
      loanAmount,
      interestRate: 6.875,
      monthlyPMI: 0,
      prepaidInterestDays: 15,
      compensation: { model: "borrower_paid" as const, bps: 200 },
      feeSchedule: schedule,
      noteDate: new Date("2026-09-01"),
    } as any) as any;
    return {
      originationFee: c.originationFee,
      applicationFee: c.applicationFee,
      underwritingFee: c.underwritingFee,
      taxServiceFee: c.taxServiceFee,
    };
  };

  it("re-pricing DOES move zero-tolerance lines — which is why pinning matters", () => {
    const before = feesOf(DEFAULT_PLATFORM_FEE_SCHEDULE, 300_000);
    const after = feesOf(RAISED, 300_000);
    // The exposure the pin exists to prevent, measured on the real functions.
    const delta =
      after.originationFee - before.originationFee +
      (after.underwritingFee - before.underwritingFee);
    expect(delta).toBeGreaterThan(0);
  });

  it("loanEstimate resolves the schedule PER APPLICATION, not globally", () => {
    const src = read("server/services/loanEstimate.ts");
    expect(src).toMatch(/resolveFeeScheduleForApplication\(applicationId\)/);
    // The global reader is what late-bound every in-flight file to a new price.
    expect(src).not.toMatch(/await activeFeeSchedule\(\)/);
  });

  it("both disclosure write paths persist the pin", () => {
    const src = read("server/services/leDisclosureBaseline.ts");
    const writes = src.split("createLoanEstimateDisclosure(").slice(1);
    expect(writes.length).toBe(2); // version 1, and the redisclosure
    for (const write of writes) {
      expect(write.slice(0, 600)).toMatch(/feeScheduleVersion/);
    }
  });

  it("the tolerance evaluator is never handed a bare boolean again (FA-21)", () => {
    for (const file of [
      "server/services/leDisclosureBaseline.ts",
    ]) {
      const src = read(file);
      expect(src).not.toMatch(/evaluateTolerance\([^)]*,\s*(true|false|!!\w+)\s*\)/s);
      expect(src).toMatch(/authorizationFrom\(/);
    }
  });
});
