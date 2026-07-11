import { describe, it, expect } from "vitest";
import {
  isPartnerRole,
  isStaffRole,
  isInternalStaffRole,
  PARTNER_ROLES,
  ROLE_DISPLAY_NAMES,
} from "../shared/roles";
import {
  PARTNER_PERSONAS,
  LICENSE_VERIFICATION_STATUSES,
  PARTNER_PROFILE_STATUSES,
  insertPartnerProfileSchema,
} from "../shared/schema/partners";
import { makePartnerSlug } from "../server/routes/partners";

/**
 * Unit coverage for the PartnerHub identity spine's security-load-bearing
 * invariants (PH-1, charter §3): the realtor role must be a partner role and
 * never staff; slugs are server-generated, sanitized, and sized to fit
 * users.referral_code; the insert schema rejects unknown personas/statuses.
 */

describe("realtor role placement", () => {
  it("realtor is a PARTNER_ROLE with display metadata", () => {
    expect(PARTNER_ROLES).toContain("realtor");
    expect(isPartnerRole("realtor")).toBe(true);
    expect(ROLE_DISPLAY_NAMES.realtor).toBeTruthy();
  });

  it("realtor is NEVER a staff role (self-registerable roles must not reach isStaffRole gates)", () => {
    expect(isStaffRole("realtor")).toBe(false);
    expect(isInternalStaffRole("realtor")).toBe(false);
  });
});

describe("makePartnerSlug", () => {
  it("generates NAME-NNNN slugs that fit users.referral_code (varchar 20)", () => {
    for (const name of ["Jordan Rivera", "A", "Émile Zola-Smith & Co.", "垚垚垚", ""]) {
      const slug = makePartnerSlug(name);
      expect(slug.length).toBeLessThanOrEqual(19);
      expect(slug).toMatch(/^[A-Z0-9-]+-\d{4}$/);
    }
  });

  it("sanitizes to A-Z0-9 hyphens and falls back to PARTNER", () => {
    expect(makePartnerSlug("!!!")).toMatch(/^PARTNER-\d{4}$/);
    expect(makePartnerSlug("jordan rivera")).toMatch(/^JORDAN-RIVERA-\d{4}$/);
  });
});

describe("insertPartnerProfileSchema", () => {
  const base = {
    userId: "u-1",
    persona: "realtor",
    firmName: "Rivera Realty",
    contactName: "Jordan Rivera",
    email: "jordan@example.com",
    referralSlug: "JORDAN-RIVERA-1234",
  };

  it("accepts a valid realtor profile", () => {
    expect(insertPartnerProfileSchema.safeParse(base).success).toBe(true);
  });

  it("rejects unknown personas (advisor/attorney are deferred lanes, not enum values)", () => {
    for (const persona of ["advisor", "attorney", "builder", "staff", ""]) {
      expect(insertPartnerProfileSchema.safeParse({ ...base, persona }).success).toBe(false);
    }
  });

  it("rejects unknown license-verification and profile statuses", () => {
    expect(
      insertPartnerProfileSchema.safeParse({ ...base, licenseVerificationStatus: "auto_verified" }).success,
    ).toBe(false);
    expect(insertPartnerProfileSchema.safeParse({ ...base, status: "banned" }).success).toBe(false);
  });

  it("keeps the manual-queue vocabulary closed (charter §5-C10)", () => {
    expect([...LICENSE_VERIFICATION_STATUSES].sort()).toEqual(["pending_review", "rejected", "verified"]);
    expect([...PARTNER_PROFILE_STATUSES].sort()).toEqual(["active", "suspended"]);
    expect([...PARTNER_PERSONAS]).toContain("realtor");
  });
});
