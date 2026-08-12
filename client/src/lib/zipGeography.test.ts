import { describe, it, expect } from "vitest";
import { averageHomePrice, stateFromZip, DEFAULT_HOME_PRICE } from "./zipGeography";

// -----------------------------------------------------------------------------
// The defect this module exists to close.
//
// `?state=` is a real request input — GET /api/mortgage-rates passes it to
// storage.getMortgageRatesForLocation — and it used to be derived by a
// ten-branch stub copied into each of the six pages under pages/rates/, while
// the page header resolved the SAME ZIP against a 908-prefix table to pick the
// home value it displayed. For a visitor in any of the other forty states the
// header printed a confident state average and the request carried no state.
//
// These tests assert the two halves now agree, and specifically that the forty
// states the stub could not see resolve.
// -----------------------------------------------------------------------------

/** The only states the six per-page stubs could resolve. */
const STATES_THE_OLD_STUB_COVERED = ["CA", "NY", "TX", "FL", "IL", "PA", "OH", "GA", "NC", "MI"];

/**
 * One real ZIP per state the stub was blind to. These are the lookups that
 * silently produced `state: undefined` on a public rate page.
 */
const ZIP_BY_PREVIOUSLY_MISSED_STATE: Record<string, string> = {
  AL: "35201", AK: "99501", AZ: "85001", AR: "71601", CO: "80202",
  CT: "06001", DE: "19701", HI: "96801", ID: "83201", IN: "46201",
  IA: "50301", KS: "66101", KY: "40201", LA: "70112", ME: "04001",
  MD: "21201", MA: "02101", MN: "55101", MS: "38601", MO: "63101",
  MT: "59001", NE: "68001", NV: "89101", NH: "03301", NJ: "07001",
  NM: "87101", ND: "58001", OK: "73001", OR: "97201", RI: "02801",
  SC: "29201", SD: "57001", TN: "37201", UT: "84101", VT: "05401",
  VA: "22001", WA: "98101", WV: "24701", WI: "53001", WY: "82001",
  DC: "20001",
};

describe("stateFromZip", () => {
  it("resolves the states the per-page stub silently missed", () => {
    const wrong: string[] = [];
    for (const [state, zip] of Object.entries(ZIP_BY_PREVIOUSLY_MISSED_STATE)) {
      const got = stateFromZip(zip);
      if (got !== state) wrong.push(`${zip} → ${got ?? "undefined"} (expected ${state})`);
    }
    expect(
      wrong,
      "These are exactly the lookups that used to send no ?state= while the " +
        "header displayed that state's average home price.",
    ).toEqual([]);
  });

  it("still resolves the ten states the stub did cover", () => {
    // No regression on the cases that already worked.
    const samples: Record<string, string> = {
      CA: "90210", NY: "10001", TX: "75001", FL: "33101", IL: "60601",
      PA: "19101", OH: "43001", GA: "30301", NC: "27501", MI: "48201",
    };
    for (const [state, zip] of Object.entries(samples)) {
      expect(stateFromZip(zip), `${zip}`).toBe(state);
    }
    expect(Object.keys(samples).sort()).toEqual([...STATES_THE_OLD_STUB_COVERED].sort());
  });

  it("covers every state a borrower can be in", () => {
    const resolved = new Set(
      [...STATES_THE_OLD_STUB_COVERED, ...Object.keys(ZIP_BY_PREVIOUSLY_MISSED_STATE)],
    );
    // 50 states + DC. Puerto Rico is in the table too but is not a lending
    // jurisdiction here, so it is not asserted.
    expect(resolved.size).toBe(51);
  });

  it("returns undefined — never null or '' — when a ZIP resolves to nothing", () => {
    // `undefined` specifically: buildQueryUrl drops undefined/null/"" alike, so
    // the request omits the param rather than sending `state=null`. Asserting
    // the exact value keeps a future `?? null` from looking harmless.
    // "999" is a REAL Alaska prefix, so it does not belong here — unassigned
    // prefixes are the ones that resolve to nothing (001–005, 099, 213, …).
    for (const nothing of ["", "1", "12", "00000", "09900", "21300"]) {
      expect(stateFromZip(nothing), nothing).toBeUndefined();
    }
    expect(stateFromZip(undefined)).toBeUndefined();
    expect(stateFromZip(null)).toBeUndefined();
  });

  it("reads only the first three digits, so a partial ZIP still resolves", () => {
    expect(stateFromZip("902")).toBe("CA");
    expect(stateFromZip("90210")).toBe("CA");
  });
});

describe("averageHomePrice", () => {
  it("is the state's average once the ZIP resolves", () => {
    expect(averageHomePrice("90210")).toBe(750000); // CA
    expect(averageHomePrice("10001")).toBe(420000); // NY
  });

  it("falls back to the default for an unresolvable ZIP", () => {
    expect(averageHomePrice("00000")).toBe(DEFAULT_HOME_PRICE);
    expect(averageHomePrice("")).toBe(DEFAULT_HOME_PRICE);
  });

  it("agrees with stateFromZip — one derivation, not two", () => {
    // The whole point: the price shown and the state requested come from the
    // same lookup. If these ever disagree the display is describing a different
    // place than the request.
    for (const zip of ["90210", "10001", "35201", "99501", "00000"]) {
      const state = stateFromZip(zip);
      const price = averageHomePrice(zip);
      if (state === undefined) expect(price).toBe(DEFAULT_HOME_PRICE);
      else expect(price).toBeGreaterThan(0);
    }
  });
});
