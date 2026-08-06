import { describe, it, expect } from "vitest";
import {
  AUTHORITY_ABBREVIATION,
  INITIAL_POLICY_VERSION,
  POLICY_AUTHORITIES,
  bumpMinorVersion,
  buildProfileId,
  highestVersion,
  nextCloneVersion,
  parseVersion,
  quarterOf,
} from "../shared/policyProfileIdentity";

describe("quarterOf", () => {
  it("maps each month to its calendar quarter", () => {
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    expect(months.map((m) => quarterOf(`2026-${m}-15`))).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
  });

  it("puts quarter boundaries on the right side", () => {
    expect(quarterOf("2026-03-31")).toBe(1);
    expect(quarterOf("2026-04-01")).toBe(2);
    expect(quarterOf("2026-12-31")).toBe(4);
  });
});

describe("buildProfileId", () => {
  it("follows {AUTHORITY}_{PRODUCT}_{YYYY}_Q{n}", () => {
    expect(buildProfileId({ authority: "FANNIE", productType: "CONVENTIONAL", effectiveDate: "2026-08-06" }))
      .toBe("FNMA_CONVENTIONAL_2026_Q3");
  });

  it("uses the standard market abbreviation for each GSE", () => {
    expect(AUTHORITY_ABBREVIATION.FANNIE).toBe("FNMA");
    expect(AUTHORITY_ABBREVIATION.FREDDIE).toBe("FHLMC");
    expect(buildProfileId({ authority: "FREDDIE", productType: "CONVENTIONAL", effectiveDate: "2026-01-01" }))
      .toBe("FHLMC_CONVENTIONAL_2026_Q1");
  });

  it("gives every authority a mapping", () => {
    for (const a of POLICY_AUTHORITIES) {
      expect(AUTHORITY_ABBREVIATION[a], a).toBeTruthy();
    }
  });

  it("falls back to the raw authority rather than dropping the segment", () => {
    // A new authority should produce a visibly odd id someone notices, not an
    // id silently missing its first part.
    expect(buildProfileId({ authority: "GINNIE", productType: "VA", effectiveDate: "2027-11-01" }))
      .toBe("GINNIE_VA_2027_Q4");
  });

  it("takes the year and quarter from the effective date, not from today", () => {
    // Backdating a policy must produce a backdated identifier.
    expect(buildProfileId({ authority: "FHA", productType: "FHA", effectiveDate: "2019-02-14" }))
      .toBe("FHA_FHA_2019_Q1");
  });

  it("is deterministic", () => {
    const parts = { authority: "VA", productType: "VA", effectiveDate: "2026-05-05" };
    expect(buildProfileId(parts)).toBe(buildProfileId(parts));
  });
});

describe("parseVersion / bumpMinorVersion", () => {
  it("parses three-part semver only", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3 });
    expect(parseVersion(" 10.0.4 ")).toEqual({ major: 10, minor: 0, patch: 4 });
    for (const bad of ["1.0", "1", "v1.0.0", "1.0.0-rc1", "2026 Q1", ""]) {
      expect(parseVersion(bad), bad).toBeNull();
    }
  });

  it("bumps the minor and resets the patch", () => {
    expect(bumpMinorVersion("1.0.0")).toBe("1.1.0");
    expect(bumpMinorVersion("1.4.7")).toBe("1.5.0");
    expect(bumpMinorVersion("2.9.0")).toBe("2.10.0");
  });

  it("refuses to invent a version it cannot parse", () => {
    // version is the field the compliance record hangs off. Guessing one would
    // stamp a fabricated version onto a policy document, so this returns null
    // and the endpoint 400s asking the operator to set one.
    expect(bumpMinorVersion("draft")).toBeNull();
    expect(bumpMinorVersion("1.0")).toBeNull();
  });

  it("starts new policies at 1.0.0", () => {
    expect(INITIAL_POLICY_VERSION).toBe("1.0.0");
    expect(parseVersion(INITIAL_POLICY_VERSION)).toEqual({ major: 1, minor: 0, patch: 0 });
  });
});

describe("highestVersion", () => {
  it("compares numerically, not as strings", () => {
    // "10" < "9" lexically; the whole point is that it must not.
    expect(highestVersion(["1.9.0", "1.10.0"])).toBe("1.10.0");
    expect(highestVersion(["2.0.0", "10.0.0"])).toBe("10.0.0");
  });

  it("orders by major, then minor, then patch", () => {
    expect(highestVersion(["1.2.3", "1.2.4", "1.3.0", "0.9.9"])).toBe("1.3.0");
  });

  it("ignores unparseable entries instead of throwing", () => {
    expect(highestVersion(["draft", "1.0.0", "wip"])).toBe("1.0.0");
    expect(highestVersion(["draft", "wip"])).toBeNull();
    expect(highestVersion([])).toBeNull();
  });
});

describe("nextCloneVersion", () => {
  it("bumps from the source when it is the only version", () => {
    expect(nextCloneVersion("1.0.0", ["1.0.0"])).toBe("1.1.0");
  });

  it("bumps from the HIGHEST version in use, not from the source", () => {
    // Cloning the same 1.0.0 twice must give 1.1.0 then 1.2.0. Bumping from
    // the source both times would produce 1.1.0 twice, which the unique index
    // on (profile_id, version) rejects.
    const afterFirst = ["1.0.0", "1.1.0"];
    expect(nextCloneVersion("1.0.0", afterFirst)).toBe("1.2.0");
  });

  it("never returns a version that already exists", () => {
    // The property that matters: whatever is in use, the result is new.
    const existing = ["1.0.0", "1.1.0", "1.2.0", "2.0.0"];
    const next = nextCloneVersion("1.0.0", existing)!;
    expect(existing).not.toContain(next);
    expect(next).toBe("2.1.0");
  });

  it("tolerates unparseable siblings", () => {
    expect(nextCloneVersion("1.0.0", ["1.0.0", "legacy"])).toBe("1.1.0");
  });

  it("refuses when nothing in the set is a version", () => {
    expect(nextCloneVersion("legacy", ["legacy"])).toBeNull();
  });
});
