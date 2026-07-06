import { describe, it, expect } from "vitest";
import {
  isStaffRole,
  isInternalStaffRole,
  isClientRole,
  ROLE_DISPLAY_NAMES,
} from "../shared/roles";
import { makeReferralCode } from "../server/routes/cpaPartners";

/**
 * Unit coverage for the CPA channel's security-load-bearing invariants:
 * the role posture (external partner, never internal staff) and the
 * server-generated, sanitized referral code.
 */

describe("cpa role posture", () => {
  it("is a staff role but NOT an internal staff role", () => {
    // This is the spine of the channel's security model: a CPA can never reach
    // a borrower record through object-level authorization.
    expect(isStaffRole("cpa")).toBe(true);
    expect(isInternalStaffRole("cpa")).toBe(false);
    expect(isClientRole("cpa")).toBe(false);
  });

  it("has a display name", () => {
    expect(ROLE_DISPLAY_NAMES.cpa).toBeTruthy();
  });
});

describe("makeReferralCode", () => {
  it("produces an uppercase slug with a numeric suffix", () => {
    const code = makeReferralCode("Smith & Co. CPAs");
    expect(code).toMatch(/^[A-Z0-9-]+-\d{4}$/);
    expect(code.startsWith("SMITH-CO-CPAS-")).toBe(true);
  });

  it("sanitizes special characters and never emits raw input", () => {
    const code = makeReferralCode("O'Brien / Tax! <script>");
    expect(code).toMatch(/^[A-Z0-9-]+-\d{4}$/);
    expect(code).not.toContain("<");
    expect(code).not.toContain("/");
    expect(code).not.toContain("'");
  });

  it("caps the slug length and always yields a code even for empty-ish input", () => {
    const long = makeReferralCode("A".repeat(100));
    // 24-char slug cap + "-" + 4 digits.
    expect(long.length).toBeLessThanOrEqual(24 + 1 + 4);
    const empty = makeReferralCode("!!!");
    expect(empty).toMatch(/^CPA-\d{4}$/);
  });

  it("varies the suffix across calls (collision resistance)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => makeReferralCode("Same Firm")));
    // Not a strict guarantee, but 20 draws from 9000 values should not all collide.
    expect(codes.size).toBeGreaterThan(1);
  });
});
