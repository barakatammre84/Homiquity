import { describe, it, expect } from "vitest";
import {
  isStaffRole,
  isInternalStaffRole,
  isClientRole,
  isPartnerRole,
  ROLE_DISPLAY_NAMES,
} from "../shared/roles";
import { makeReferralCode } from "../server/routes/cpaPartners";

/**
 * Unit coverage for the CPA channel's security-load-bearing invariants:
 * the role posture (self-registering partner, never staff) and the
 * server-generated, sanitized referral code.
 */

describe("cpa role posture", () => {
  it("is a self-registering PARTNER role, never staff or client", () => {
    // Spine of the channel's security model: CPA registration is public, so a
    // CPA must NOT be isStaffRole — otherwise every isStaffRole()-gated endpoint
    // (staff directory, compliance reports, etc.) would be exposed to anyone.
    expect(isPartnerRole("cpa")).toBe(true);
    expect(isStaffRole("cpa")).toBe(false);
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
