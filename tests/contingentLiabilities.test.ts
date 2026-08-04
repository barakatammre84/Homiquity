// Audit finding F-13 — the contingent-liability register.
//
// For an asset-light broker the contingent exposures ARE the balance sheet,
// and none of them was enumerated anywhere. "Is our reserve adequate?" had no
// answer — not a hard one, no answer, because the question had no operands.
//
// The property these tests defend hardest: the register must never present a
// complete-looking total while real exposures sit unquantified inside it.
import { describe, it, expect } from "vitest";
import {
  ASSUMED_EXTENSION_BPS_PER_DAY,
  ASSUMED_EXTENSION_DAYS,
  ASSUMED_RATE_SHOCK_POINTS,
  buildContingentLiabilityRegister,
  type RegisterInputs,
} from "../shared/contingentLiabilities";

const EMPTY: RegisterInputs = {
  tridCure: { amount: 0, fileCount: 0 },
  clawback: { totalAtRisk: 0, atRiskCount: 0, indeterminateCount: 0, usesAssumedWindow: false },
  locks: { unconfirmedCount: 0, unconfirmedLoanVolume: 0, expiringSoonCount: 0, expiringSoonLoanVolume: 0 },
  regZExposedLoanCount: 0,
};

const LOADED: RegisterInputs = {
  tridCure: { amount: 1_650, fileCount: 3 },
  clawback: { totalAtRisk: 19_000, atRiskCount: 3, indeterminateCount: 1, usesAssumedWindow: true },
  locks: {
    unconfirmedCount: 2,
    unconfirmedLoanVolume: 800_000,
    expiringSoonCount: 4,
    expiringSoonLoanVolume: 1_600_000,
  },
  regZExposedLoanCount: 2,
};

describe("F-13 — the register never claims to be complete", () => {
  it("names the sum a FLOOR, not a total", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    expect(r).toHaveProperty("quantifiedFloor");
    expect(r).not.toHaveProperty("total");
    expect(r.summary).toMatch(/FLOOR, not a reserve figure/);
  });

  it("reports unquantified exposures alongside the floor, always", () => {
    // Even with a completely empty book the licensing requirements exist.
    const r = buildContingentLiabilityRegister(EMPTY);
    expect(r.incomplete).toBe(true);
    expect(r.unquantifiedCount).toBeGreaterThan(0);
  });

  it("uses null — never 0 — for an exposure it cannot price", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    for (const entry of r.entries.filter(e => e.basis === "policy_unquantified")) {
      // A zero here would read as "no exposure", which is a lie.
      expect(`${entry.category}:${entry.amount}`).toBe(`${entry.category}:null`);
    }
  });

  it("keeps unquantified exposures out of the floor", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    const computedSum = r.entries
      .filter(e => e.basis === "computed")
      .reduce((sum, e) => sum + (e.amount ?? 0), 0);
    expect(r.quantifiedFloor).toBeCloseTo(computedSum, 2);
  });
});

describe("F-13 — exposure arithmetic", () => {
  it("carries the TRID cure exposure through unchanged", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    const trid = r.entries.find(e => e.category === "trid_cure")!;
    expect(trid.amount).toBe(1_650);
    expect(trid.count).toBe(3);
    expect(trid.action).toMatch(/Cure at closing/);
  });

  it("carries the clawback exposure and flags the assumed window", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    const epo = r.entries.find(e => e.category === "epo_clawback")!;
    expect(epo.amount).toBe(19_000);
    expect(epo.assumptions.join(" ")).toMatch(/platform default/i);
    // A funded loan with no remittance is exposed but contributes $0 — say so.
    expect(epo.note).toMatch(/contribute \$0 to the figure despite being exposed/);
  });

  it("sizes unconfirmed-quote honor exposure from the rate-shock scenario", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    const honor = r.entries.find(e => e.category === "lock_honor")!;
    expect(honor.amount).toBe((800_000 * ASSUMED_RATE_SHOCK_POINTS) / 100);
    expect(honor.assumptions.join(" ")).toMatch(/scenario, not a forecast/);
    expect(honor.action).toMatch(/Obtain lender confirmation for 2 open record/);
  });

  it("sizes extension exposure from bps/day over the assumed term", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    const ext = r.entries.find(e => e.category === "lock_extension")!;
    expect(ext.amount).toBe(
      (1_600_000 * ASSUMED_EXTENSION_BPS_PER_DAY * ASSUMED_EXTENSION_DAYS) / 10_000,
    );
  });

  it("counts Reg Z-exposed loans without pricing them", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    const regz = r.entries.find(e => e.category === "regz_lo_comp")!;
    expect(regz.count).toBe(2);
    expect(regz.amount).toBeNull();
    expect(regz.action).toMatch(/require the statute and counsel/);
  });

  it("totals the floor across every computed exposure", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    // 1,650 cure + 19,000 clawback + 16,000 honor + 3,600 extension
    expect(r.quantifiedFloor).toBe(1_650 + 19_000 + 16_000 + 3_600);
  });

  it("reports a zero floor on an empty book without inventing exposure", () => {
    const r = buildContingentLiabilityRegister(EMPTY);
    expect(r.quantifiedFloor).toBe(0);
    expect(r.actions).toEqual(
      expect.arrayContaining([expect.stringMatching(/surety|net worth|statute/i)]),
    );
  });
});

describe("F-13 — assumptions and actions surface together", () => {
  it("collects every assumption a figure rests on, deduplicated", () => {
    const r = buildContingentLiabilityRegister(LOADED);
    expect(r.assumptions.length).toBeGreaterThan(0);
    expect(new Set(r.assumptions).size).toBe(r.assumptions.length);
  });

  it("lists the licensing items as actions even when nothing is exposed", () => {
    const r = buildContingentLiabilityRegister(EMPTY);
    const joined = r.actions.join(" | ");
    expect(joined).toMatch(/surety|bond/i);
    expect(joined).toMatch(/net worth/i);
  });

  it("drops the remittance action once every at-risk loan has one", () => {
    const r = buildContingentLiabilityRegister({
      ...LOADED,
      clawback: { ...LOADED.clawback, indeterminateCount: 0 },
    });
    const epo = r.entries.find(e => e.category === "epo_clawback")!;
    expect(epo.action).toBeNull();
    expect(epo.note).toMatch(/Every at-risk loan has a recorded remittance/);
  });

  it("is deterministic", () => {
    expect(buildContingentLiabilityRegister(LOADED)).toEqual(
      buildContingentLiabilityRegister(LOADED),
    );
  });
});
