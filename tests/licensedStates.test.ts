import { describe, expect, it } from "vitest";
import {
  LICENSED_STATES,
  LICENSED_STATE_DETAILS,
  isLicensedState,
  isZipInLicensedStates,
  unlicensedStateMessage,
  unlicensedStateRejection,
} from "@shared/companyIdentity";

/**
 * Licensed-state footprint (roadmap A5) — Illinois-only, founder-confirmed
 * 2026-07-17. These tests pin the gate semantics: absent state never rejects
 * (TRID address-last funnel), any concrete unlicensed state always rejects,
 * and the ZIP check covers exactly the licensed states' USPS prefixes.
 */

describe("footprint constants", () => {
  it("is Illinois-only until the founder adds an issued license", () => {
    expect([...LICENSED_STATES]).toEqual(["IL"]);
    expect(LICENSED_STATE_DETAILS.map((s) => s.code)).toEqual(["IL"]);
  });

  it("never carries an invented state license number", () => {
    for (const detail of LICENSED_STATE_DETAILS) {
      // licenseNumber is optional and must only be set from a real document.
      if (detail.licenseNumber !== undefined) {
        expect(detail.licenseNumber.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("isLicensedState", () => {
  it.each(["IL", "il", " Il ", "Illinois", "illinois"])("accepts %j", (state) => {
    expect(isLicensedState(state)).toBe(true);
  });

  it.each(["CA", "ca", "California", "TX", "PR", "XX", "", "  ", null, undefined])(
    "rejects %j",
    (state) => {
      expect(isLicensedState(state as string | null | undefined)).toBe(false);
    },
  );
});

describe("unlicensedStateRejection (route gate)", () => {
  it("passes absent state — the address-last funnel collects the property late", () => {
    expect(unlicensedStateRejection(undefined)).toBeNull();
    expect(unlicensedStateRejection(null)).toBeNull();
    expect(unlicensedStateRejection("")).toBeNull();
    expect(unlicensedStateRejection("   ")).toBeNull();
  });

  it("passes licensed states", () => {
    expect(unlicensedStateRejection("IL")).toBeNull();
    expect(unlicensedStateRejection("Illinois")).toBeNull();
  });

  it("rejects a concrete unlicensed state with the borrower-safe envelope", () => {
    const rejection = unlicensedStateRejection("CA");
    expect(rejection?.code).toBe("UNLICENSED_STATE");
    expect(rejection?.error).toContain("Illinois");
    expect(rejection?.error).toContain("CA");
    expect(rejection?.error).toContain("NMLS");
  });
});

describe("isZipInLicensedStates (ZIP-only surfaces, e.g. MCP pricing)", () => {
  it.each(["60614", "60002", "61101", "62701", "62999"])("accepts IL ZIP %j", (zip) => {
    expect(isZipInLicensedStates(zip)).toBe(true);
  });

  it.each(["59999", "63101", "90210", "10001", "600", "606141", "abcde", "", null, undefined])(
    "rejects %j",
    (zip) => {
      expect(isZipInLicensedStates(zip as string | null | undefined)).toBe(false);
    },
  );
});

describe("unlicensedStateMessage", () => {
  it("names the footprint dynamically and stays verification-forward", () => {
    const message = unlicensedStateMessage("WI");
    expect(message).toContain("Illinois only");
    expect(message).toContain("WI");
    expect(message).toContain("NMLS Consumer Access");
    // Reg N posture: the copy never promises future approval or licensure.
    expect(message.toLowerCase()).not.toContain("guarantee");
    expect(message.toLowerCase()).not.toContain("approved");
  });
});
